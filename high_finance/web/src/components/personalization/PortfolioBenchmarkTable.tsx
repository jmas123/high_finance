/**
 * Portfolio Benchmark Comparison Table
 * ====================================
 * Shows portfolio performance vs selected benchmarks across multiple time periods.
 */

import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { Sparkline } from "../common/Sparkline";
import type { PortfolioPosition } from "../../lib/userData";
import type { PortfolioPerformanceResponse } from "../../lib/types";

interface Props {
  positions: PortfolioPosition[];
  selectedBenchmarks: string[];
  onBenchmarksChange: (benchmarks: string[]) => void;
}

const DEFAULT_BENCHMARKS = [
  { ticker: "SPY", name: "S&P 500" },
  { ticker: "QQQ", name: "Nasdaq 100" },
  { ticker: "IWM", name: "Russell 2000" },
  { ticker: "GLD", name: "Gold" },
  { ticker: "SLV", name: "Silver" },
  { ticker: "BTC-USD", name: "Bitcoin" },
  { ticker: "TLT", name: "20+ Yr Treasury" },
  { ticker: "DIA", name: "Dow Jones" },
];

const PERIOD_LABELS: Record<string, string> = {
  "1d": "1D",
  "1w": "1W",
  "1mo": "1M",
  "3mo": "3M",
  "ytd": "YTD",
  "1y": "1Y",
};

export function PortfolioBenchmarkTable({
  positions,
  selectedBenchmarks,
  onBenchmarksChange,
}: Props) {
  const [data, setData] = useState<PortfolioPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch performance data when positions or benchmarks change
  useEffect(() => {
    if (positions.length === 0) {
      setData(null);
      return;
    }

    // Debounce to avoid excessive API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.portfolio.getPerformance(
          positions.map((p) => ({
            ticker: p.ticker,
            shares: p.shares,
            avg_cost: p.avg_cost,
          })),
          selectedBenchmarks
        );
        setData(result);
      } catch (e) {
        console.error("Failed to fetch portfolio performance:", e);
        setError("Failed to load performance data");
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [positions, selectedBenchmarks]);

  const formatReturn = (val: number | null | undefined): string => {
    if (val == null) return "—";
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}%`;
  };

  const returnColor = (val: number | null | undefined): string => {
    if (val == null) return "#666";
    return val >= 0 ? "#22c55e" : "#ef4444";
  };

  const toggleBenchmark = (ticker: string) => {
    if (selectedBenchmarks.includes(ticker)) {
      onBenchmarksChange(selectedBenchmarks.filter((t) => t !== ticker));
    } else {
      onBenchmarksChange([...selectedBenchmarks, ticker]);
    }
  };


  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
          Performance vs Benchmarks
        </span>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: "none",
            border: "none",
            color: showSettings ? "#3b82f6" : "#666",
            cursor: "pointer",
            fontSize: 14,
            padding: "2px 6px",
          }}
          title="Configure benchmarks"
        >
          ⚙
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: "#151515",
            borderRadius: 6,
            border: "1px solid #333",
          }}
        >
          <div style={{ fontSize: 10, color: "#666", marginBottom: 8 }}>
            SELECT BENCHMARKS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEFAULT_BENCHMARKS.map((b) => {
              const isSelected = selectedBenchmarks.includes(b.ticker);
              return (
                <button
                  key={b.ticker}
                  onClick={() => toggleBenchmark(b.ticker)}
                  style={{
                    background: isSelected ? "#3b82f620" : "#1a1a1a",
                    border: `1px solid ${isSelected ? "#3b82f6" : "#333"}`,
                    borderRadius: 4,
                    color: isSelected ? "#3b82f6" : "#888",
                    fontSize: 11,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  {b.ticker}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading / Error States */}
      {loading && !data && (
        <div style={{ padding: 20, textAlign: "center", color: "#555", fontSize: 12 }}>
          Loading performance data…
        </div>
      )}

      {error && (
        <div style={{ padding: 12, textAlign: "center", color: "#ef4444", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Comparison Table */}
      {data && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thStyle}>Asset</th>
                <th style={{ ...thStyle, textAlign: "center" }}>30D</th>
                {data.periods.map((p) => (
                  <th key={p} style={{ ...thStyle, textAlign: "right" }}>
                    {PERIOD_LABELS[p] || p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Portfolio Row (highlighted) */}
              <tr style={{ background: "#1a2a1a" }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#3b82f6" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📊</span>
                    <span>Allocation Backtest</span>
                    <span
                      title="Hypothetical returns assuming current weights held for entire period"
                      style={{ cursor: "help", opacity: 0.5, fontSize: 12 }}
                    >
                      ⓘ
                    </span>
                  </div>
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <Sparkline
                    data={data.portfolio.sparkline || []}
                    width={70}
                    height={20}
                  />
                </td>
                {data.periods.map((p) => (
                  <td
                    key={p}
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontFamily: "monospace",
                      color: returnColor(data.portfolio.returns?.[p]),
                      fontWeight: 600,
                    }}
                  >
                    {formatReturn(data.portfolio.returns?.[p])}
                  </td>
                ))}
              </tr>

              {/* Benchmark Rows */}
              {selectedBenchmarks.map((ticker) => {
                const benchmark = data.benchmarks[ticker];
                if (!benchmark) return null;

                return (
                  <tr key={ticker}>
                    <td style={tdStyle}>
                      <div style={{ color: "#fff" }}>{ticker}</div>
                      <div style={{ fontSize: 9, color: "#555" }}>{benchmark.name}</div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <Sparkline
                        data={benchmark.sparkline || []}
                        width={70}
                        height={20}
                      />
                    </td>
                    {data.periods.map((p) => (
                      <td
                        key={p}
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: returnColor(benchmark.returns?.[p]),
                        }}
                      >
                        {formatReturn(benchmark.returns?.[p])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Risk Metrics */}
          {data.risk_metrics && (data.risk_metrics.beta != null || data.risk_metrics.sharpe != null) && (
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11 }}>
              {data.risk_metrics.beta != null && (
                <div>
                  <span style={{ color: "#666" }}>Beta vs SPY: </span>
                  <span
                    style={{
                      color: data.risk_metrics.beta > 1 ? "#f59e0b" : "#22c55e",
                      fontFamily: "monospace",
                    }}
                    title="Beta > 1 = more volatile than market, < 1 = less volatile"
                  >
                    {data.risk_metrics.beta.toFixed(2)}
                  </span>
                </div>
              )}
              {data.risk_metrics.sharpe != null && (
                <div>
                  <span style={{ color: "#666" }}>Sharpe Ratio: </span>
                  <span
                    style={{
                      color: data.risk_metrics.sharpe >= 1 ? "#22c55e" : data.risk_metrics.sharpe >= 0 ? "#f59e0b" : "#ef4444",
                      fontFamily: "monospace",
                    }}
                    title="Risk-adjusted return. > 1 = good, > 2 = very good"
                  >
                    {data.risk_metrics.sharpe.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ fontSize: 9, color: "#555", marginTop: 8, fontStyle: "italic" }}>
            Backtest assumes current allocation held for each period. Not actual returns.
          </div>
        </div>
      )}

      {/* Loading indicator overlay */}
      {loading && data && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 8,
            fontSize: 10,
            color: "#555",
          }}
        >
          Updating…
        </div>
      )}
    </div>
  );
}

// Styles
const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontSize: 9,
  fontWeight: 500,
  color: "#666",
  borderBottom: "1px solid #2a2a2a",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #1a1a1a",
  color: "#aaa",
};

export default PortfolioBenchmarkTable;
