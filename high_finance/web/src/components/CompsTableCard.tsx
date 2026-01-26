import { useMemo } from "react";
import type { CompsResponse, Fundamentals } from "../lib/types";

// Reusing your formatters for consistency
function formatLarge(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatRatio(value: number | null | undefined): string {
  return value ? `${value.toFixed(1)}x` : "—";
}

function formatPercent(value: number | null | undefined): string {
  return value ? `${(value * 100).toFixed(1)}%` : "—";
}

export function CompsTable({ data }: { data: CompsResponse }) {
  const { target, peers, average_pe, average_ev_ebitda } = data;
  
  // Combine target + peers and sort by Market Cap (descending)
  const allCompanies = useMemo(() => {
    return [target, ...peers].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
  }, [target, peers]);

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
      marginTop: 16
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Comparable Analysis</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
          Relative valuation vs. industry peers ({target.industry})
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "right", borderBottom: "1px solid #333", color: "#888" }}>
              <th style={{ textAlign: "left", padding: "10px 8px", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Company</th>
              <th style={{ padding: "10px 8px", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Mkt Cap</th>
              <th style={{ padding: "10px 8px", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>EV / EBITDA</th>
              <th style={{ padding: "10px 8px", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>P/E</th>
              <th style={{ padding: "10px 8px", fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Rev Growth</th>
            </tr>
          </thead>
          <tbody>
            {allCompanies.map((co) => {
              const isTarget = co.ticker === target.ticker;
              
              // Valuation Logic: Lower than average = Green (Cheap), Higher = Red (Expensive)
              const evColor = !co.ev_to_ebitda || !average_ev_ebitda ? "inherit" 
                : co.ev_to_ebitda < average_ev_ebitda ? "#4ade80" : "#f87171";
                
              const peColor = !co.pe_ratio || !average_pe ? "inherit" 
                : co.pe_ratio < average_pe ? "#4ade80" : "#f87171";

              return (
                <tr key={co.ticker} style={{ 
                  borderBottom: "1px solid #222",
                  background: isTarget ? "rgba(255, 255, 255, 0.03)" : "transparent"
                }}>
                  <td style={{ padding: "10px 8px", textAlign: "left" }}>
                    <span style={{ fontWeight: isTarget ? 700 : 500, color: isTarget ? "#fff" : "#ddd" }}>
                      {co.ticker}
                    </span>
                    {isTarget && <span style={{ marginLeft: 8, fontSize: 10, background: "#333", padding: "2px 6px", borderRadius: 4 }}>TARGET</span>}
                  </td>
                  <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{formatLarge(co.market_cap)}</td>
                  
                  {/* EV/EBITDA */}
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", color: evColor }}>
                    {formatRatio(co.ev_to_ebitda)}
                  </td>
                  
                  {/* P/E Ratio */}
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", color: peColor }}>
                    {formatRatio(co.pe_ratio)}
                  </td>
                  
                  {/* Revenue Growth (Green if positive) */}
                  <td style={{ padding: "10px 8px", fontFamily: "monospace", color: (co.revenue_growth || 0) > 0 ? "#4ade80" : "#f87171" }}>
                    {formatPercent(co.revenue_growth)}
                  </td>
                </tr>
              );
            })}
            
            {/* Industry Average Row */}
            <tr style={{ borderTop: "2px solid #444", fontWeight: 600, background: "#111" }}>
              <td style={{ padding: "10px 8px", textAlign: "left", color: "#888" }}>Peer Mean</td>
              <td style={{ padding: "10px 8px" }}>—</td>
              <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{formatRatio(average_ev_ebitda)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "monospace" }}>{formatRatio(average_pe)}</td>
              <td style={{ padding: "10px 8px" }}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}