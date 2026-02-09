import { useState, memo } from "react";
import type { AISuggestion } from "../../lib/types";
import { fmtPct } from "../Functions";
import { InfoTip } from "../common/InfoTip";

interface AISuggestionPanelProps {
  suggestion: AISuggestion;
  currentValues: { growth: number; margin: number; tax: number; wacc: number; terminal_g: number };
  onApply: () => void;
  onDismiss: () => void;
  hasApplied: boolean;
  onRestore: () => void;
}

const PARAM_LABELS: Record<string, string> = {
  growth: "Revenue Growth",
  margin: "Operating Margin",
  wacc: "WACC",
  tax: "Tax Rate",
  terminal_g: "Terminal Growth",
};

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  medium: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308", border: "rgba(234, 179, 8, 0.3)" },
  low:    { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
};

export const AISuggestionPanel = memo(function AISuggestionPanel({
  suggestion,
  currentValues,
  onApply,
  onDismiss,
  hasApplied,
  onRestore,
}: AISuggestionPanelProps) {
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  const params = ["growth", "margin", "wacc", "tax", "terminal_g"] as const;

  return (
    <div style={{
      marginTop: 12,
      padding: 16,
      background: "rgba(245, 158, 11, 0.06)",
      border: "1px solid rgba(245, 158, 11, 0.25)",
      borderRadius: 10,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 12,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#f59e0b",
        }}>
          <span style={{ fontSize: 16 }}>&#9733;</span>
          AI Suggested Assumptions
          <InfoTip text="AI analyzes the company's financials, sector, and recent performance to suggest DCF input assumptions. Compare these to your current values and apply if they seem reasonable." />
        </div>
        <button
          onClick={() => {
            if (hasApplied) {
              onRestore();
            }
            onDismiss();
          }}
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
      </div>

      {/* Summary thesis */}
      {suggestion.summary && (
        <div style={{
          fontSize: 12,
          lineHeight: 1.6,
          marginBottom: 14,
          padding: 10,
          background: "rgba(0,0,0,0.2)",
          borderRadius: 6,
          fontStyle: "italic",
          color: "#ccc",
        }}>
          {suggestion.summary}
        </div>
      )}

      {/* Valuation gap note — when DCF structurally can't capture market pricing */}
      {suggestion.valuation_gap_note && (
        <div style={{
          fontSize: 11,
          lineHeight: 1.5,
          marginBottom: 14,
          padding: 10,
          background: "rgba(234, 179, 8, 0.1)",
          border: "1px solid rgba(234, 179, 8, 0.2)",
          borderRadius: 6,
          color: "#eab308",
        }}>
          <span style={{ fontWeight: 600 }}>DCF Limitation:</span>{" "}
          {suggestion.valuation_gap_note}
        </div>
      )}

      {/* Parameter comparison table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
              Parameter
            </th>
            <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
              Current
            </th>
            <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
              AI Suggests
            </th>
            <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>Confidence<InfoTip text="How confident the AI is in this suggestion. High = strong data support. Medium = reasonable estimate. Low = limited data or high uncertainty." /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((key) => {
            const param = suggestion[key];
            const current = currentValues[key];
            const aiVal = param.value;
            const diff = aiVal != null ? aiVal - current : null;
            const isExpanded = expandedParam === key;
            const conf = CONFIDENCE_COLORS[param.confidence] || CONFIDENCE_COLORS.medium;

            return (
              <tr
                key={key}
                onClick={() => setExpandedParam(isExpanded ? null : key)}
                style={{
                  cursor: "pointer",
                  borderBottom: isExpanded ? "none" : "1px solid #222",
                }}
              >
                <td style={{ padding: "8px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 9,
                      color: "#666",
                      transition: "transform 0.15s",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      display: "inline-block",
                    }}>
                      &#9654;
                    </span>
                    {PARAM_LABELS[key]}
                  </div>
                  {isExpanded && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      lineHeight: 1.5,
                      color: "#aaa",
                      paddingLeft: 15,
                      paddingBottom: 4,
                    }}>
                      {param.reasoning}
                    </div>
                  )}
                </td>
                <td style={{
                  textAlign: "right",
                  padding: "8px",
                  fontFamily: "monospace",
                  verticalAlign: "top",
                }}>
                  {fmtPct(current)}
                </td>
                <td style={{
                  textAlign: "right",
                  padding: "8px",
                  fontFamily: "monospace",
                  verticalAlign: "top",
                  color: aiVal != null ? "#f59e0b" : "#666",
                }}>
                  {aiVal != null ? (
                    <span>
                      {fmtPct(aiVal)}
                      {diff != null && Math.abs(diff) > 0.001 && (
                        <span style={{
                          marginLeft: 4,
                          fontSize: 10,
                          color: diff > 0 ? "#22c55e" : "#ef4444",
                        }}>
                          {diff > 0 ? "\u2191" : "\u2193"}
                        </span>
                      )}
                    </span>
                  ) : "\u2014"}
                </td>
                <td style={{
                  textAlign: "right",
                  padding: "8px",
                  verticalAlign: "top",
                }}>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: conf.bg,
                    color: conf.text,
                    border: `1px solid ${conf.border}`,
                  }}>
                    {param.confidence}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onApply}
          disabled={hasApplied}
          style={{
            flex: 1,
            padding: "10px 16px",
            background: hasApplied ? "#444" : "#f59e0b",
            color: hasApplied ? "#888" : "#000",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: hasApplied ? "not-allowed" : "pointer",
          }}
        >
          {hasApplied ? "\u2713 Applied" : "Apply Suggestions"}
        </button>
        <button
          onClick={() => {
            if (hasApplied) {
              onRestore();
            } else {
              onDismiss();
            }
          }}
          style={{
            padding: "10px 16px",
            background: hasApplied ? "rgba(59, 130, 246, 0.1)" : "transparent",
            color: hasApplied ? "#3b82f6" : "#888",
            border: `1px solid ${hasApplied ? "rgba(59, 130, 246, 0.25)" : "#333"}`,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: hasApplied ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {hasApplied ? "\u21a9 Restore Previous" : "Dismiss"}
        </button>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: 12,
        fontSize: 10,
        opacity: 0.5,
        textAlign: "center",
      }}>
        AI-generated for educational purposes. Not investment advice.
        Click any row to see reasoning.
      </div>
    </div>
  );
});
