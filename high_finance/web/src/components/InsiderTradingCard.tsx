import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type InsiderTrade = {
  insider: string;
  position: string;
  transaction_type: string;
  shares: number;
  value: number | null;
  date: string | null;
  url: string | null;
};

type InsiderSummary = {
  total_trades: number;
  buys: number;
  sells: number;
  buy_shares: number;
  sell_shares: number;
  net_shares: number;
  buy_value: number;
  sell_value: number;
  net_value: number;
  recent_trades: InsiderTrade[];
};

function formatValue(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatShares(shares: number | null | undefined): string {
  if (shares == null) return "—";
  if (Math.abs(shares) >= 1e6) return `${(shares / 1e6).toFixed(2)}M`;
  if (Math.abs(shares) >= 1e3) return `${(shares / 1e3).toFixed(1)}K`;
  return shares.toLocaleString();
}

function pillStyle(type: string) {
  const colors: Record<string, string> = {
    'BUY': "#14532d",
    'SELL': "#7f1d1d", 
    'OPTION': "#1e3a5f",
    'GIFT': "#5b21b6",
    'AWARD': "#065f46",
    'AUTO': "#374151",
    'OTHER': "#374151",
    'UNKNOWN': "#374151",
  };
  
  return {
    background: colors[type] || "#374151",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  } as const;
}

interface InsiderTradingCardProps {
  ticker: string;
  initialData?: InsiderSummary | null;
}

export function InsiderTradingCard({ ticker, initialData }: InsiderTradingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InsiderSummary | null>(initialData ?? null);

  useEffect(() => {
    // Skip fetch if we have initial data from bundle (even if null means no data)
    if (initialData !== undefined) {
      setSummary(initialData);
      return;
    }

    let mounted = true;

    async function load() {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.insiderSummary(ticker);
        if (mounted) setSummary(data);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load insider trades");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [ticker, initialData]);

  const sentiment = useMemo(() => {
    if (!summary) return null;
    const netValue = summary.net_value;
    if (netValue > 1000000) return { label: "Strong Buying", color: "#22c55e" };
    if (netValue > 100000) return { label: "Net Buying", color: "#86efac" };
    if (netValue < -1000000) return { label: "Strong Selling", color: "#ef4444" };
    if (netValue < -100000) return { label: "Net Selling", color: "#fca5a5" };
    return { label: "Neutral", color: "#9ca3af" };
  }, [summary]);

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Insider Trading</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            Executive buy/sell activity
          </div>
        </div>
        {sentiment && (
          <span style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            background: `${sentiment.color}22`,
            color: sentiment.color,
          }}>
            {sentiment.label}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: "#3b1818",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span><b>Error:</b> {error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              api.insiderSummary(ticker)
                .then(setSummary)
                .catch((e) => setError(e?.message ?? "Failed"))
                .finally(() => setLoading(false));
            }}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: "#7f1d1d",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, opacity: 0.7 }}>Loading insider data…</div>
      ) : !summary || summary.total_trades === 0 ? (
        <div style={{ padding: 24, opacity: 0.7 }}>No insider trading data available.</div>
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Total Trades</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{summary.total_trades}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Buys / Sells</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                <span style={{ color: "#22c55e" }}>{summary.buys}</span>
                {" / "}
                <span style={{ color: "#ef4444" }}>{summary.sells}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Net Shares</div>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 600,
                color: summary.net_shares > 0 ? "#22c55e" : summary.net_shares < 0 ? "#ef4444" : "inherit"
              }}>
                {summary.net_shares > 0 ? "+" : ""}{formatShares(summary.net_shares)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Net Value</div>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 600,
                color: summary.net_value > 0 ? "#22c55e" : summary.net_value < 0 ? "#ef4444" : "inherit"
              }}>
                {summary.net_value > 0 ? "+" : ""}{formatValue(summary.net_value)}
              </div>
            </div>
          </div>

          {/* Recent Trades Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Insider</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Type</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Shares</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Value</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_trades.slice(0, 10).map((trade, i) => (
                  <tr key={`${trade.insider}-${trade.date ?? 'nodate'}-${i}`} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 500 }}>{trade.insider}</div>
                      {trade.position && (
                        <div style={{ fontSize: 11, opacity: 0.6 }}>{trade.position}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={pillStyle(trade.transaction_type)}>
                        {trade.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                      {formatShares(trade.shares)}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                      {formatValue(trade.value)}
                    </td>
                    <td style={{ padding: "10px 8px", opacity: 0.8 }}>
                      {trade.date || "—"}
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}