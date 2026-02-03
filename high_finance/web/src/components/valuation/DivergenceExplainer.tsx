import { useState } from "react";
import type { DivergenceAnalysis, ValuationScenarioInputs } from "../../lib/types";
import { fmtPct, fmtPctSigned, fmtPx } from "../Functions";

interface DivergenceExplainerProps {
  divergence: DivergenceAnalysis;
  currentInputs: ValuationScenarioInputs;
  currentPrice: number;
  fairValue: number;
  onUseMarketAssumptions: () => void;
  onKeepMyAssumptions: () => void;
  hasPreMarketValues: boolean;
}

export function DivergenceExplainer({
  divergence,
  currentInputs,
  currentPrice,
  fairValue,
  onUseMarketAssumptions,
  onKeepMyAssumptions,
  hasPreMarketValues,
}: DivergenceExplainerProps) {
  const [expanded, setExpanded] = useState(divergence.divergence_tier === "extreme");

  const implied = divergence.implied_assumptions;
  const isDownside = divergence.divergence_pct < 0;
  const tierColor = divergence.divergence_tier === "extreme"
    ? "#f59e0b"
    : divergence.divergence_tier === "notable"
      ? "#eab308"
      : "#6b7280";

  // Build comparison rows
  const comparisons = [
    {
      label: "Revenue Growth",
      yours: currentInputs.growth,
      market: implied.implied_growth,
      isPrimary: implied.primary_driver === "growth",
    },
    {
      label: "Operating Margin",
      yours: currentInputs.margin,
      market: implied.implied_margin,
      isPrimary: implied.primary_driver === "margin",
    },
    {
      label: "WACC",
      yours: currentInputs.wacc,
      market: implied.implied_wacc,
      isPrimary: implied.primary_driver === "wacc",
    },
  ];

  // Handler just calls the callback - DCFCard uses captured values to prevent oscillation
  const handleUseMarket = () => {
    onUseMarketAssumptions();
  };

  // Collapsed view for notable tier
  if (!expanded && divergence.divergence_tier === "notable") {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: `${tierColor}15`,
          border: `1px solid ${tierColor}40`,
          borderRadius: 8,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#9888;</span>
          <span style={{ fontSize: 12 }}>
            Your assumptions differ {isDownside ? "significantly below" : "significantly above"} market pricing
          </span>
        </div>
        <span style={{ fontSize: 11, opacity: 0.6 }}>Click to see why</span>
      </div>
    );
  }

  // Normal tier - don't show anything
  if (divergence.divergence_tier === "normal") {
    return null;
  }

  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: `${tierColor}10`,
      border: `1px solid ${tierColor}50`,
      borderRadius: 10,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 14,
      }}>
        <div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: tierColor,
          }}>
            <span style={{ fontSize: 16 }}>&#9888;</span>
            {divergence.divergence_tier === "extreme"
              ? "Large Divergence from Market"
              : "Notable Divergence from Market"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Your DCF: <strong>{fmtPx(fairValue)}</strong> ({fmtPctSigned(divergence.divergence_pct)})
            &nbsp;vs&nbsp;
            Market: <strong>{fmtPx(currentPrice)}</strong>
          </div>
        </div>
        {divergence.divergence_tier === "notable" && (
          <button
            onClick={() => setExpanded(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
            }}
          >
            &times;
          </button>
        )}
      </div>

      {/* Explanation */}
      {divergence.explanation && (
        <div style={{
          fontSize: 12,
          lineHeight: 1.6,
          marginBottom: 14,
          padding: 10,
          background: "rgba(0,0,0,0.2)",
          borderRadius: 6,
        }}>
          {divergence.explanation}
        </div>
      )}

      {/* Comparison Table */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          opacity: 0.5,
          marginBottom: 8,
        }}>
          Assumption Comparison
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
                Parameter
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
                You Assume
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
                Market Implies
              </th>
              <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((row) => {
              const gap = row.market !== null ? (row.market - row.yours) * 100 : null;
              const showCapped = row.market !== null && row.market >= 0.50;

              return (
                <tr
                  key={row.label}
                  style={{
                    background: row.isPrimary ? `${tierColor}20` : "transparent",
                  }}
                >
                  <td style={{
                    padding: "8px",
                    fontWeight: row.isPrimary ? 600 : 400,
                  }}>
                    {row.label}
                    {row.isPrimary && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 9,
                        background: tierColor,
                        color: "#000",
                        padding: "2px 5px",
                        borderRadius: 3,
                        fontWeight: 600,
                      }}>
                        PRIMARY
                      </span>
                    )}
                  </td>
                  <td style={{
                    textAlign: "right",
                    padding: "8px",
                    fontFamily: "monospace",
                  }}>
                    {fmtPct(row.yours)}
                  </td>
                  <td style={{
                    textAlign: "right",
                    padding: "8px",
                    fontFamily: "monospace",
                    color: row.isPrimary ? tierColor : "inherit",
                  }}>
                    {row.market !== null ? (
                      <>
                        {showCapped ? ">50%" : fmtPct(row.market)}
                      </>
                    ) : "—"}
                  </td>
                  <td style={{
                    textAlign: "right",
                    padding: "8px",
                    fontFamily: "monospace",
                    color: gap !== null
                      ? (gap > 0 ? "#22c55e" : "#ef4444")
                      : "inherit",
                  }}>
                    {gap !== null && !showCapped ? `${gap > 0 ? "+" : ""}${gap.toFixed(0)}pp` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleUseMarket}
          disabled={hasPreMarketValues}
          style={{
            flex: 1,
            padding: "10px 16px",
            background: hasPreMarketValues ? "#444" : tierColor,
            color: hasPreMarketValues ? "#888" : "#000",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: hasPreMarketValues ? "not-allowed" : "pointer",
          }}
        >
          {hasPreMarketValues ? "✓ Market-Implied Applied" : "Use Market-Implied Assumptions"}
        </button>
        <button
          onClick={() => {
            if (hasPreMarketValues) {
              onKeepMyAssumptions();
            } else {
              setExpanded(false);
            }
          }}
          style={{
            padding: "10px 16px",
            background: hasPreMarketValues ? "#3b82f620" : "transparent",
            color: hasPreMarketValues ? "#3b82f6" : "#888",
            border: `1px solid ${hasPreMarketValues ? "#3b82f640" : "#333"}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: hasPreMarketValues ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {hasPreMarketValues ? "↩ Restore My Assumptions" : "Keep My Assumptions"}
        </button>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 12,
        fontSize: 10,
        opacity: 0.5,
        textAlign: "center",
      }}>
        Market-implied values are reverse-engineered from current price.
        Neither view is "correct" — this highlights your implicit beliefs vs market's.
      </div>
    </div>
  );
}
