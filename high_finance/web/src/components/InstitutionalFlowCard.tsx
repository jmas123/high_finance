import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Holder = {
  holder: string;
  shares: number;
  value: number | null;
  pct_held: number | null;
  pct_change: number | null;
  date_reported: string | null;
};

type FlowData = {
  summary: {
    institutional_ownership_pct: number;
    insider_ownership_pct: number;
    shares_outstanding: number;
    float_shares: number;
    total_institutional_holders: number;
    total_mutual_fund_holders: number;
    total_institutional_value: number;
    total_institutional_shares: number;
  };
  top_institutional_holders: Holder[];
  top_mutual_fund_holders: Holder[];
  increasing_positions: Holder[];
  decreasing_positions: Holder[];
};

function formatValue(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatShares(shares: number | null | undefined): string {
  if (shares == null) return "—";
  if (Math.abs(shares) >= 1e9) return `${(shares / 1e9).toFixed(2)}B`;
  if (Math.abs(shares) >= 1e6) return `${(shares / 1e6).toFixed(2)}M`;
  if (Math.abs(shares) >= 1e3) return `${(shares / 1e3).toFixed(1)}K`;
  return shares.toLocaleString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatPercentChange(value: number | null | undefined): string {
  if (value == null) return "—";
  const pct = value * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function InstitutionalFlowCard({ ticker }: { ticker: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FlowData | null>(null);
  const [activeTab, setActiveTab] = useState<"top" | "increasing" | "decreasing" | "funds">("top");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const flowData = await api.institutionalFlow(ticker);
        if (mounted) setData(flowData);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load institutional data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [ticker]);

  const tabs = [
    { key: "top", label: "Top Holders" },
    { key: "increasing", label: "📈 Increasing" },
    { key: "decreasing", label: "📉 Decreasing" },
    { key: "funds", label: "Mutual Funds" },
  ] as const;

  const getHoldersList = (): Holder[] => {
    if (!data) return [];
    switch (activeTab) {
      case "top": return data.top_institutional_holders;
      case "increasing": return data.increasing_positions;
      case "decreasing": return data.decreasing_positions;
      case "funds": return data.top_mutual_fund_holders;
      default: return [];
    }
  };

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Institutional Flow</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
          Smart money positions & changes
        </div>
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: "#3b1818",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span><b>Error:</b> {error}</span>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              api.institutionalFlow(ticker)
                .then(setData)
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
        <div style={{ padding: 24, opacity: 0.7 }}>Loading institutional data…</div>
      ) : !data ? (
        <div style={{ padding: 24, opacity: 0.7 }}>No institutional data available.</div>
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: "rgba(99, 102, 241, 0.1)",
            borderRadius: 8,
            border: "1px solid rgba(99, 102, 241, 0.2)",
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Institutional %</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#818cf8" }}>
                {formatPercent(data.summary.institutional_ownership_pct)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Insider %</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {formatPercent(data.summary.insider_ownership_pct)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}># Institutions</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {data.summary.total_institutional_holders}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Total Value</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {formatValue(data.summary.total_institutional_value)}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  background: activeTab === tab.key ? "#6366f1" : "#2d2d2d",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: activeTab === tab.key ? 600 : 400,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Holders Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Holder</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Shares</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Value</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>% Held</th>
                  <th style={{ padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {getHoldersList().length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 20, textAlign: "center", opacity: 0.6 }}>
                      No data available for this category.
                    </td>
                  </tr>
                ) : (
                  getHoldersList().map((holder, i) => (
                    <tr
                      key={`${holder.holder}-${i}`}
                      style={{ 
                        borderBottom: "1px solid #222",
                        background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"
                      }}
                    >
                      <td style={{ padding: "10px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {holder.holder}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                        {formatShares(holder.shares)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                        {formatValue(holder.value)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                        {formatPercent(holder.pct_held)}
                      </td>
                      <td style={{ 
                        padding: "10px 8px", 
                        textAlign: "right", 
                        fontFamily: "monospace",
                        color: holder.pct_change && holder.pct_change > 0 ? "#22c55e" : 
                               holder.pct_change && holder.pct_change < 0 ? "#ef4444" : "inherit"
                      }}>
                        {formatPercentChange(holder.pct_change)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}