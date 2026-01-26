import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Politician = {
  id: number;
  name: string;
  chamber: string | null;
  state: string | null;
  district: string | null;
  party: string | null;
};

export type PoliticianTrade = {
  id: number;
  politician_id: number;
  politician: Politician | null;  // 👈 Add this
  company_id: number | null;
  issuer_raw: string | null;
  ticker_raw: string | null;
  transaction_date: string | null;
  disclosure_date: string | null;
  transaction_type: string | null;
  amount_min: number | null;
  amount_max: number | null;
  source_url: string | null;
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

function partyColor(party: string | null) {
  if (!party) return "#666";
  const p = party.toUpperCase();
  if (p.includes("DEMOCRAT") || p === "D") return "#3b82f6";
  if (p.includes("REPUBLICAN") || p === "R") return "#ef4444";
  return "#666";
}

export function PoliticianTradesCard({ ticker }: { ticker: string }) {
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PoliticianTrade[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.politicianTrades(ticker, limit);
        if (mounted) setRows((data ?? []) as PoliticianTrade[]);
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
      if (t.includes("BUY") || t === "PURCHASE") buys++;
      else if (t.includes("SELL")) sells++;
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
                const isBuy = action.includes("BUY") || action === "PURCHASE";
                const isSell = action.includes("SELL");
                const politician = trade.politician;

                return (
                  <tr key={trade.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "10px 8px" }}>
                      {politician ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600 }}>{politician.name}</span>
                            <span style={{ 
                              fontSize: 10, 
                              padding: "2px 6px", 
                              borderRadius: 4,
                              background: partyColor(politician.party),
                              opacity: 0.9
                            }}>
                              {politician.party?.[0] || "?"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                            {politician.chamber}{politician.state ? ` • ${politician.state}` : ""}
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.6 }}>Unknown #{trade.politician_id}</span>
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
            Note: Disclosure dates can lag transaction dates.
          </div>
        </div>
      )}
    </div>
  );
}