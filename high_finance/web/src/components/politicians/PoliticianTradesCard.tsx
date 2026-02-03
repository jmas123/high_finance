import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { PoliticianTradeWithContext, Politician, PoliticianTrade } from "../../lib/types";

type FlatRow = PoliticianTrade & {
  politician: Politician; // guaranteed after flatten
  context?: PoliticianTradeWithContext["context"];
};

function formatAmount(min?: number | null, max?: number | null) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min != null) return `≥ $${min.toLocaleString()}`;
  return `≤ $${(max as number).toLocaleString()}`;
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  return s;
}

function pillStyle(bg: string) {
  return {
    background: bg,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: "18px",
  } as const;
}

function partyColor(party: string | null | undefined) {
  if (!party) return "#666";
  const p = party.toUpperCase();
  if (p.includes("DEMOCRAT") || p === "D") return "#3b82f6";
  if (p.includes("REPUBLICAN") || p === "R") return "#ef4444";
  return "#666";
}

function hitRateColor(hitRate: number | null | undefined): string {
  if (hitRate == null) return "#666";
  if (hitRate >= 0.7) return "#22c55e";  // Green - great
  if (hitRate >= 0.55) return "#a3e635"; // Light green - good
  if (hitRate >= 0.45) return "#facc15"; // Yellow - neutral
  if (hitRate >= 0.3) return "#f97316";  // Orange - poor
  return "#ef4444";                       // Red - bad
}

export function PoliticianTradesCard({ ticker }: { ticker: string }) {
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IMPORTANT: rows are FLATTENED rows, not the raw API shape
  const [rows, setRows] = useState<FlatRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!ticker) return;
      setLoading(true);
      setError(null);

      try {
        // API returns PoliticianTradeWithContext[]
        const data = await api.politicianTrades(ticker, limit);

        const flattened: FlatRow[] = (data ?? []).map((r: PoliticianTradeWithContext) => ({
          ...r.trade,
          politician: r.politician ?? (r.trade as any).politician, // fallback if backend nests it too
          context: r.context,
        }));

        if (mounted) setRows(flattened);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load politician trades");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [ticker, limit]);

  const counts = useMemo(() => {
    let buys = 0;
    let sells = 0;

    for (const trade of rows) {
      const t = (trade.transaction_type ?? "").toUpperCase();
      if (t === "PURCHASE" || t.includes("BUY")) buys++;
      else if (t === "SALE" || t.includes("SELL")) sells++;
    }

    return { buys, sells };
  }, [rows]);

  return (
    <div
      style={{
        marginTop: 16,
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 650 }}>Capitol Activity</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
            Recent disclosed trades linked to {ticker}.{" "}
            <span style={{ opacity: 0.85 }}>
              {rows.length > 0 ? `${counts.buys} buys • ${counts.sells} sells` : "No trades found"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Rows</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              background: "#111",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "6px 10px",
              outline: "none",
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "#3b1818",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <b>Error:</b> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, opacity: 0.7 }}>Loading trades…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 24, opacity: 0.7 }}>No recent disclosures found for this ticker.</div>
      ) : (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                <th style={{ padding: "10px 8px" }}>Politician</th>
                <th style={{ padding: "10px 8px" }} title="Percentage of recent trades that generated positive returns within 30 days of disclosure">
                  Win Rate <span style={{ opacity: 0.5, fontSize: 10 }}>ⓘ</span>
                </th>
                <th style={{ padding: "10px 8px" }}>Action</th>
                <th style={{ padding: "10px 8px" }}>Disclosure</th>
                <th style={{ padding: "10px 8px" }}>Trade Date</th>
                <th style={{ padding: "10px 8px" }}>Amount</th>
                <th style={{ padding: "10px 8px" }}>Source</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((trade) => {
                const action = (trade.transaction_type ?? "—").toUpperCase();
                const isBuy = action === "PURCHASE" || action.includes("BUY");
                const isSell = action === "SALE" || action.includes("SELL");

                const politician = trade.politician;

                return (
                  <tr key={trade.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "10px 8px" }}>
                      {politician ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{politician.name}</span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: partyColor(politician.party),
                                opacity: 0.9,
                              }}
                            >
                              {politician.party?.[0] || "?"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                            {politician.chamber ?? "—"}
                            {politician.state ? ` • ${politician.state}` : ""}
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.6 }}>Unknown #{trade.politician_id}</span>
                      )}
                    </td>

                    <td style={{ padding: "10px 8px" }}>
                      {politician?.hit_rate != null ? (
                        <span style={{
                          color: hitRateColor(politician.hit_rate),
                          fontWeight: 600,
                          fontFamily: "monospace",
                          fontSize: 13,
                        }}>
                          {Math.round(politician.hit_rate * 100)}%
                        </span>
                      ) : (
                        <span style={{ opacity: 0.4, fontSize: 12 }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "10px 8px" }}>
                      <span style={pillStyle(isBuy ? "#14532d" : isSell ? "#7f1d1d" : "#374151")}>
                        {action}
                      </span>
                    </td>

                    <td style={{ padding: "10px 8px" }}>{formatDate(trade.disclosure_date)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDate(trade.transaction_date)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatAmount(trade.amount_min, trade.amount_max)}</td>

                    <td style={{ padding: "10px 8px" }}>
                      {trade.source_url ? (
                        <a
                          href={trade.source_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#60a5fa", textDecoration: "none" }}
                        >
                          View
                        </a>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
            Note: Disclosure dates can lag transaction dates. Win rate reflects the percentage of recent trades with positive returns within 30 days.
          </div>
        </div>
      )}
    </div>
  );
}
