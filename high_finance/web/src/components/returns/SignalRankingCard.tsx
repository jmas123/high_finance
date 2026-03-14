import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import type { SignalRankingResponse } from "../../lib/types";
import { thBase, tdBase, right } from "../../lib/types";

const WINDOWS = [7, 30, 60, 90, 180] as const;

function fmtPct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val > 0 ? "+" : ""}${(val * 100).toFixed(2)}%`;
}

function returnColor(val: number | null | undefined): string {
  if (val == null) return "#888";
  return val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
}

function significanceBadge(sig: string): { label: string; color: string; bg: string } {
  switch (sig) {
    case "significant":
      return { label: "Significant", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
    case "marginal":
      return { label: "Marginal", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    default:
      return { label: "Not Sig.", color: "#888", bg: "rgba(136,136,136,0.1)" };
  }
}

export function SignalRankingCard() {
  const [data, setData] = useState<SignalRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState<number>(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.signalRanking({ window })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load signal ranking");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [window]);

  return (
    <div style={{
      background: "#1a1a1a",
      borderRadius: 12,
      border: "1px solid #333",
      padding: 24,
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Signal Ranking</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
            Trading signals ranked by statistical strength (modified t-statistic). Bonferroni-corrected for multiple testing.
          </p>
        </div>
        {/* Window selector */}
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #444",
                background: window === w ? "#3b82f6" : "transparent",
                color: window === w ? "#fff" : "#888",
                cursor: "pointer",
              }}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Loading signals...</div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>{error}</div>
      )}
      {data && !loading && (
        <>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
            {data.total_signals_evaluated} signals evaluated | Since {data.since_date} | {data.signals.length} met minimum sample
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign: "left" }}>Signal</th>
                  <th style={{ ...thBase, ...right }}>Trades</th>
                  <th style={{ ...thBase, ...right }}>Avg Alpha</th>
                  <th style={{ ...thBase, ...right }}>Win Rate</th>
                  <th style={{ ...thBase, ...right }}>Score</th>
                  <th style={{ ...thBase, ...right }}>p-value</th>
                  <th style={{ ...thBase, textAlign: "center" }}>Significance</th>
                </tr>
              </thead>
              <tbody>
                {data.signals.map((sig) => {
                  const badge = significanceBadge(sig.significance);
                  return (
                    <tr key={sig.signal_id} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ ...tdBase, textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{sig.label}</span>
                          {sig.low_sample && (
                            <span style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: "rgba(245,158,11,0.15)",
                              color: "#f59e0b",
                            }}>
                              LOW N
                            </span>
                          )}
                          {sig.coverage_pct != null && (
                            <span style={{ fontSize: 10, color: "#666" }}>
                              ({(sig.coverage_pct * 100).toFixed(0)}% coverage)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{sig.description}</div>
                      </td>
                      <td style={{ ...tdBase, ...right }}>{sig.trades.toLocaleString()}</td>
                      <td style={{ ...tdBase, ...right, color: returnColor(sig.avg_alpha) }}>
                        {fmtPct(sig.avg_alpha)}
                      </td>
                      <td style={{ ...tdBase, ...right }}>
                        {sig.win_rate != null ? `${(sig.win_rate * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ ...tdBase, ...right, fontWeight: 600 }}>
                        {sig.score != null ? sig.score.toFixed(2) : "—"}
                      </td>
                      <td style={{ ...tdBase, ...right, fontSize: 11 }}>
                        {sig.adjusted_p != null ? (sig.adjusted_p < 0.001 ? "<0.001" : sig.adjusted_p.toFixed(3)) : "—"}
                      </td>
                      <td style={{ ...tdBase, textAlign: "center" }}>
                        <span style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: badge.bg,
                          color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {data.signals.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...tdBase, textAlign: "center", color: "#888" }}>
                      No signals met the minimum sample size for this window and date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
