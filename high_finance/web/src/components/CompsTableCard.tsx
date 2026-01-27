import { useMemo } from "react";
import type { CompsResponse } from "../lib/types";

import { thBase, tdBase, left, right } from "../lib/types";

function formatLarge(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatMetric(metric: string, value: number | null | undefined): string {
  if (value == null) return "—";

  if (metric === "market_cap") return formatLarge(value);

  const percent = new Set(["revenue_growth", "roe", "dividend_yield", "gross_margins"]);
  if (percent.has(metric)) return `${(value * 100).toFixed(1)}%`;

  // ratios / multiples
  return `${value.toFixed(1)}x`;
}

function metricLabel(metric: string): string {
  switch (metric) {
    case "market_cap": return "Mkt Cap";
    case "pe_ratio": return "P/E";
    case "pb_ratio": return "P/B";
    case "roe": return "ROE";
    case "ev_to_ebitda": return "EV / EBITDA";
    case "ev_to_sales": return "EV / Sales";
    case "revenue_growth": return "Rev Growth";
    case "gross_margins": return "Gross Margin";
    case "dividend_yield": return "Div Yield";
    default: return metric;
  }
}

export function CompsTable({ data }: { data: CompsResponse }) {
  const { target, peers, template, averages } = data;

  const metrics = template?.metrics ?? ["market_cap", "pe_ratio", "revenue_growth"];

  const allCompanies = useMemo(() => {
    return [target, ...peers].sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
  }, [target, peers]);

  const showPeerMean = averages && Object.values(averages).some((v) => v != null);

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Comparable Analysis</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
          {template?.label ?? "Relative valuation"} vs. peers ({target.industry})
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, ...left }}>Company</th>
              {metrics.map((m) => (
                <th key={m} style={{ ...thBase, ...right }}>{metricLabel(m)}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {allCompanies.map((co) => {
              const isTarget = co.ticker === target.ticker;

              return (
                <tr
                  key={co.ticker}
                  style={{
                    borderBottom: "1px solid #222",
                    background: isTarget ? "rgba(255, 255, 255, 0.03)" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 8px", ...left }}>
                    <span style={{ fontWeight: isTarget ? 700 : 500, color: isTarget ? "#fff" : "#ddd" }}>
                      {co.ticker}
                    </span>
                    {isTarget && (
                      <span style={{ marginLeft: 8, fontSize: 10, background: "#333", padding: "2px 6px", borderRadius: 4 }}>
                        TARGET
                      </span>
                    )}
                  </td>

                  {metrics.map((m) => {
                    const val = (co as any)[m] as number | null | undefined;
                    return (
                      <td key={m} style={{ ...tdBase, ...right }}>
                        {formatMetric(m, val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {showPeerMean && (
              <tr style={{ borderTop: "2px solid #444", fontWeight: 600, background: "#111" }}>
                <td style={{ padding: "10px 8px", ...left, color: "#888" }}>Peer Mean</td>
                {metrics.map((m) => (
                  <td key={m} style={{ ...tdBase, ...right, color: "#bbb" }}>
                    {formatMetric(m, averages?.[m])}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
