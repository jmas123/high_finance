import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type TradeContextReason = { type: string; title: string; detail: string };
type TradeContext = { relevance_score: number; relevance_label: string; reasons: TradeContextReason[] };

type Politician = {
  id: number;
  name: string;
  chamber: string | null;
  state: string | null;
  district: string | null;
  party: string | null;
};

type PoliticianTrade = {
  id: number;
  politician_id: number;
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

type CongressTradeNotification = {
  trade: PoliticianTrade;
  politician: Politician;
  context: TradeContext;
};


function fmtMoneyRange(min?: number | null, max?: number | null) {
  const f = (x: number) =>
    `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (max != null) return `≤ ${f(max)}`;
  if (min != null) return `≥ ${f(min)}`;
  return "—";
}

export function NotificationsCard() {
  const [days, setDays] = useState(7);
  const [minAmount, setMinAmount] = useState(50000);
  const [limit, setLimit] = useState(100);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CongressTradeNotification[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.congressTradeNotifications(minAmount, days, limit);
      setItems(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, minAmount, limit]);

  const rows = useMemo(() => items ?? [], [items]);

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Notifications</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Significant Congress trades (default: ≥ ${minAmount.toLocaleString()}), last {days} days
          </div>
        </div>

        <button
          onClick={load}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #444",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>
          Days{" "}
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 70, marginLeft: 6, padding: 6, borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff" }}
          />
        </label>

        <label style={{ fontSize: 12, opacity: 0.8 }}>
          Min ${" "}
          <input
            type="number"
            min={0}
            step={1000}
            value={minAmount}
            onChange={(e) => setMinAmount(Number(e.target.value))}
            style={{ width: 110, marginLeft: 6, padding: 6, borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff" }}
          />
        </label>

        <label style={{ fontSize: 12, opacity: 0.8 }}>
          Limit{" "}
          <input
            type="number"
            min={10}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ width: 80, marginLeft: 6, padding: 6, borderRadius: 6, border: "1px solid #444", background: "#111", color: "#fff" }}
          />
        </label>
      </div>

      {error && (
        <div style={{ marginBottom: 10, padding: 10, background: "#3b1818", border: "1px solid #7f1d1d", borderRadius: 8 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 20, opacity: 0.7 }}>Loading…</div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ padding: 20, opacity: 0.7 }}>
          No significant trades found in the last {days} days.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((x, idx) => {
            const ctx = x.context;
            const t = x.trade;
            const p = x.politician;
            const who = p?.name ?? "Unknown politician";
            const ticker = t?.ticker_raw ?? "—";
            const issuer = t?.issuer_raw ?? "";
            const typ = (t?.transaction_type ?? "").toUpperCase();
            const disclosed = t?.disclosure_date ?? "—";
            const amt = fmtMoneyRange(t?.amount_min, t?.amount_max);
            const url = t?.source_url;

            return (
              <div key={`${t?.id ?? idx}`} style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #2d2d2d",
                background: "#121212",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>
                    {who} · {typ || "TRADE"} · {ticker}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {disclosed}
                  </div>
                </div>
                {ctx && (
  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #2a2a2a", background: "#0f0f0f" }}>
    <div style={{ fontSize: 12, fontWeight: 700 }}>
      Why it matters: {ctx.relevance_label} ({Math.round((ctx.relevance_score ?? 0) * 100)}%)
    </div>
    <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 12, opacity: 0.85 }}>
      {(ctx.reasons ?? []).slice(0, 3).map((r, i) => (
        <li key={i}>
          <b>{r.title}:</b> {r.detail}
        </li>
      ))}
    </ul>
  </div>
)}


                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                  {issuer ? <span style={{ opacity: 0.8 }}>{issuer} · </span> : null}
                  <span>{amt}</span>
                </div>

                {url && (
                  <div style={{ marginTop: 8 }}>
                    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#9bd" }}>
                      View source
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
