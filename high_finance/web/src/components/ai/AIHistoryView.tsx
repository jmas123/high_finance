import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { AIHistoryItem, AIHistoryDetail, AIHistoryStats } from "../../lib/types";
import { renderMarkdown } from "../common/MarkdownRenderer";
import { useAuth } from "../../lib/auth";
import { fmtPct } from "../Functions";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  memo: { label: "Memo", color: "#f59e0b" },
  financial_analysis: { label: "Financial Analysis", color: "#8b5cf6" },
  dcf_suggestion: { label: "Valuation", color: "#22c55e" },
  risk_assessment: { label: "Risk", color: "#ef4444" },
  earnings_analysis: { label: "Earnings", color: "#3b82f6" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || { label: type, color: "#888" };
}

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── DCF suggestion helpers ──────────────────────────────────────────────────

type DCFParam = { value: number | null; confidence: string; reasoning: string };

function tryParseDCF(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "growth" in parsed && "summary" in parsed) {
      return parsed;
    }
  } catch { /* not JSON — fall through */ }
  return null;
}

function dcfPreviewText(content: string): string {
  const dcf = tryParseDCF(content);
  if (!dcf) return content.slice(0, 200);
  const summary = dcf.summary as string;
  if (summary) return summary;
  const g = (dcf.growth as DCFParam)?.value;
  const m = (dcf.margin as DCFParam)?.value;
  return `Growth: ${fmtPct(g)}, Margin: ${fmtPct(m)}`;
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

const DCF_PARAMS = ["growth", "margin", "wacc", "tax", "terminal_g"] as const;

function DCFSuggestionDetail({ content }: { content: string }) {
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const dcf = tryParseDCF(content);
  if (!dcf) return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{content}</div>;

  const summary = dcf.summary as string | undefined;
  const gapNote = dcf.valuation_gap_note as string | null | undefined;

  return (
    <div>
      {/* Summary thesis */}
      {summary && (
        <div style={{
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 14,
          padding: 12,
          background: "rgba(0,0,0,0.2)",
          borderRadius: 8,
          fontStyle: "italic",
          color: "#ccc",
        }}>
          {summary}
        </div>
      )}

      {/* Valuation gap note */}
      {gapNote && (
        <div style={{
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 14,
          padding: 10,
          background: "rgba(234, 179, 8, 0.1)",
          border: "1px solid rgba(234, 179, 8, 0.2)",
          borderRadius: 6,
          color: "#eab308",
        }}>
          <span style={{ fontWeight: 600 }}>DCF Limitation:</span> {gapNote}
        </div>
      )}

      {/* Parameter table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>Parameter</th>
            <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>Value</th>
            <th style={{ textAlign: "right", padding: "6px 8px", opacity: 0.6, fontWeight: 500 }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {DCF_PARAMS.map((key) => {
            const param = dcf[key] as DCFParam | undefined;
            if (!param) return null;
            const conf = CONFIDENCE_COLORS[param.confidence] || CONFIDENCE_COLORS.medium;
            const isExpanded = expandedParam === key;

            return (
              <tr
                key={key}
                onClick={() => setExpandedParam(isExpanded ? null : key)}
                style={{ cursor: "pointer", borderBottom: isExpanded ? "none" : "1px solid #222" }}
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
                    {PARAM_LABELS[key] || key}
                  </div>
                  {isExpanded && param.reasoning && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 12,
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
                  color: "#22c55e",
                }}>
                  {param.value != null ? fmtPct(param.value) : "—"}
                </td>
                <td style={{ textAlign: "right", padding: "8px", verticalAlign: "top" }}>
                  <span style={{
                    fontSize: 10,
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
    </div>
  );
}

// ── Risk assessment helpers ──────────────────────────────────────────────────

function tryParseRisk(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "overall_risk_tier" in parsed) {
      return parsed;
    }
  } catch { /* not JSON — fall through */ }
  return null;
}

function riskPreviewText(content: string): string {
  const risk = tryParseRisk(content);
  if (!risk) return content.slice(0, 200);
  const summary = risk.summary as string;
  if (summary) return summary;
  const tier = risk.overall_risk_tier as string;
  return `Risk tier: ${tier}`;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low:      { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  moderate: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)" },
  elevated: { bg: "rgba(249, 115, 22, 0.15)", text: "#f97316", border: "rgba(249, 115, 22, 0.3)" },
  high:     { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
};

const SEVERITY_COLORS_RISK: Record<string, { bg: string; text: string }> = {
  low:    { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" },
  medium: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308" },
  high:   { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
};

type RiskFactorItem = { category: string; title: string; severity: string; detail: string; monte_carlo_impact: string };
type ScenarioItem = { name: string; narrative: string; parameters: { vol_multiplier: number; horizon_days: number; include_earnings_shock: boolean }; estimated_likelihood: string };

function RiskAssessmentDetail({ content }: { content: string }) {
  const [expandedFactor, setExpandedFactor] = useState<number | null>(null);
  const risk = tryParseRisk(content);
  if (!risk) return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{content}</div>;

  const tier = (risk.overall_risk_tier as string) || "moderate";
  const summary = risk.summary as string | undefined;
  const factors = (risk.risk_factors as RiskFactorItem[]) || [];
  const scenarios = (risk.tailored_scenarios as ScenarioItem[]) || [];
  const baseParms = risk.suggested_base_parameters as { vol_multiplier: number; horizon_days: number; rationale: string } | undefined;
  const tc = TIER_COLORS[tier] || TIER_COLORS.moderate;

  return (
    <div>
      {/* Risk tier + summary */}
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: tc.bg,
        border: `1px solid ${tc.border}`,
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 4,
          background: tc.text,
          color: "#000",
          letterSpacing: "0.3px",
        }}>
          {tier} risk
        </span>
        {summary && (
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "#ccc" }}>
            {summary}
          </div>
        )}
      </div>

      {/* Risk factors */}
      {factors.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>
            Risk Factors
          </div>
          {factors.map((f, i) => {
            const sc = SEVERITY_COLORS_RISK[f.severity] || SEVERITY_COLORS_RISK.medium;
            const isExpanded = expandedFactor === i;
            return (
              <div
                key={`${f.category}-${i}`}
                onClick={() => setExpandedFactor(isExpanded ? null : i)}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #2a2a2a",
                  marginBottom: 4,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: sc.bg,
                    color: sc.text,
                  }}>
                    {f.severity}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.4 }}>{isExpanded ? "−" : "+"}</span>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "#aaa" }}>{f.detail}</div>
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#3b82f6",
                      opacity: 0.8,
                    }}>
                      Simulation impact: {f.monte_carlo_impact}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Tailored scenarios */}
      {scenarios.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>
            Tailored Scenarios
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {scenarios.map((sc, i) => (
              <div key={`${sc.name}-${i}`} style={{
                padding: 10,
                borderRadius: 6,
                border: "1px solid #2a2a2a",
                fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{sc.name}</div>
                <div style={{ color: "#aaa", lineHeight: 1.4, marginBottom: 6 }}>{sc.narrative}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid #333", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
                    vol: {sc.parameters.vol_multiplier}x
                  </span>
                  <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid #333", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
                    {sc.parameters.horizon_days}d
                  </span>
                  {sc.parameters.include_earnings_shock && (
                    <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid #333", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
                      +earnings
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested base parameters */}
      {baseParms && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 6, border: "1px solid #2a2a2a", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested Base Parameters</div>
          <div style={{ color: "#aaa", lineHeight: 1.4, marginBottom: 6 }}>{baseParms.rationale}</div>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid #333", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
              vol: {baseParms.vol_multiplier}x
            </span>
            <span style={{ padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.06)", border: "1px solid #333", fontSize: 10, fontFamily: "monospace", color: "#aaa" }}>
              {baseParms.horizon_days}d
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Earnings analysis helpers ────────────────────────────────────────────────

function tryParseEarnings(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "reported_results" in parsed) {
      return parsed;
    }
  } catch { /* not JSON — fall through */ }
  return null;
}

function earningsPreviewText(content: string): string {
  const ea = tryParseEarnings(content);
  if (!ea) return content.slice(0, 200);
  const summary = ea.summary as string;
  if (summary) return summary;
  const quarter = ea.quarter as string;
  return quarter ? `${quarter} earnings analysis` : "Earnings analysis";
}

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" },
  negative: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
  mixed:    { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" },
  neutral:  { bg: "rgba(136, 136, 136, 0.15)", text: "#888" },
};

const BEAT_MISS_COLORS: Record<string, string> = {
  beat: "#22c55e",
  miss: "#ef4444",
  inline: "#888",
};

function fmtLargeNum(value: unknown, unit?: string | null): string {
  if (value == null) return "N/A";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);
  if (unit === "%") return `${num}%`;
  const prefix = unit === "$" || unit == null ? "$" : "";
  const suffix = unit === "x" ? "x" : "";
  const abs = Math.abs(num);
  const fmt = abs >= 1e12 ? `${(num / 1e12).toFixed(1)}T`
    : abs >= 1e9 ? `${(num / 1e9).toFixed(1)}B`
    : abs >= 1e6 ? `${(num / 1e6).toFixed(1)}M`
    : abs >= 1000 ? `${(num / 1000).toFixed(1)}K`
    : num.toFixed(2);
  return `${prefix}${fmt}${suffix}`;
}

type EAMetric = { value: unknown; unit?: string | null; yoy_change_pct?: number | null; vs_estimate: string | null; surprise_pct: number | null; note: string | null };
type EASentiment = { overall: string; confidence?: number | null; confidence_basis?: string | null; tone_vs_prior: string | null; key_positive_signals: string[]; key_concerns: string[] };
type EAQuote = { speaker: string; quote: string; context: string | null };
type EAGuidance = {
  has_guidance?: boolean;
  guidance_tone: string | null;
  guidance_summary: string | null;
  next_quarter_revenue?: { low: number | null; high: number | null } | null;
  next_quarter_eps?: { low: number | null; high: number | null } | null;
  full_year_revenue?: { low: number | null; high: number | null } | null;
  full_year_eps?: { low: number | null; high: number | null } | null;
  capex?: string | null;
  other_forward_items?: string[] | null;
};

/** Small inline SVG bar for YoY change (same as EarningsAnalysisCard) */
function HistYoYBar({ pct }: { pct: number }) {
  const maxBar = 30;
  const clamped = Math.max(-100, Math.min(100, pct));
  const barWidth = Math.min(maxBar, Math.abs(clamped) * 0.6);
  const color = clamped >= 0 ? "#22c55e" : "#ef4444";
  const sign = clamped >= 0 ? "+" : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <svg width={maxBar * 2 + 2} height={12}>
        <line x1={maxBar + 1} y1={0} x2={maxBar + 1} y2={12} stroke="#444" strokeWidth={1} />
        <rect x={clamped >= 0 ? maxBar + 1 : maxBar + 1 - barWidth} y={1} width={barWidth} height={10} rx={2} fill={color} opacity={0.8} />
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color }}>{sign}{clamped.toFixed(1)}%</span>
    </span>
  );
}

function fmtHistRange(low: number | null | undefined, high: number | null | undefined): string | null {
  if (low != null && high != null) return `${fmtLargeNum(low)} - ${fmtLargeNum(high)}`;
  if (low != null) return `${fmtLargeNum(low)}+`;
  if (high != null) return `up to ${fmtLargeNum(high)}`;
  return null;
}

function EarningsAnalysisDetail({ content }: { content: string }) {
  const ea = tryParseEarnings(content);
  if (!ea) return <div style={{ fontSize: 14, lineHeight: 1.7 }}>{content}</div>;

  const quarter = ea.quarter as string | undefined;
  const summary = ea.summary as string | undefined;
  const filingDate = ea.filing_date as string | undefined;
  const filingUrl = ea.filing_url as string | undefined;
  const results = ea.reported_results as Record<string, EAMetric> | undefined;
  const otherMetrics = ea.other_metrics as Array<{ name: string; value: string; unit?: string | null; yoy_change_pct?: number | null; note: string | null }> | undefined;
  const guidance = ea.guidance as EAGuidance | null | undefined;
  const sentiment = ea.sentiment as EASentiment | undefined;
  const quotes = ea.key_quotes as EAQuote[] | undefined;

  return (
    <div>
      {/* Quarter + filing info */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {quarter && (
          <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#3b82f620", color: "#3b82f6" }}>
            {quarter}
          </span>
        )}
        {filingDate && <span style={{ fontSize: 12, color: "#666" }}>Filed: {filingDate}</span>}
        {filingUrl && (
          <a href={filingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>
            View on EDGAR
          </a>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8, fontStyle: "italic", color: "#ccc" }}>
          {summary}
        </div>
      )}

      {/* Reported Results with YoY bars */}
      {results && Object.keys(results).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>Reported Results</div>
          {Object.entries(results).filter(([, m]) => m != null).map(([key, metric]) => {
            const pillColor = metric.vs_estimate ? BEAT_MISS_COLORS[metric.vs_estimate] : null;
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ color: "#888", minWidth: 100, textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</span>
                <span style={{ color: "#fff", fontWeight: 600, minWidth: 80 }}>{fmtLargeNum(metric.value, metric.unit)}</span>
                {metric.yoy_change_pct != null && <HistYoYBar pct={metric.yoy_change_pct} />}
                {pillColor && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: `${pillColor}20`, color: pillColor, textTransform: "uppercase" }}>
                    {metric.vs_estimate}{metric.surprise_pct != null ? ` +${Math.abs(metric.surprise_pct).toFixed(1)}%` : ""}
                  </span>
                )}
                {metric.note && <span style={{ color: "#666", fontSize: 12 }}>{metric.note}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Other Metrics with YoY bars */}
      {otherMetrics && otherMetrics.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {otherMetrics.map((m, i) => (
            <div key={`${m.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ color: "#888", minWidth: 120 }}>{m.name}</span>
              <span style={{ color: "#fff", fontWeight: 500 }}>{fmtLargeNum(m.value, m.unit)}</span>
              {m.yoy_change_pct != null && <HistYoYBar pct={m.yoy_change_pct} />}
              {m.note && <span style={{ color: "#666", fontSize: 12 }}>{m.note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Guidance — enhanced */}
      {guidance && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 6, border: "1px solid #2a2a2a" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>Forward Guidance</div>
          {guidance.has_guidance === false ? (
            <div style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>No explicit forward guidance provided in this release.</div>
          ) : (
            <>
              {/* Numeric ranges */}
              {[
                { label: "Next Q Revenue", range: guidance.next_quarter_revenue },
                { label: "Next Q EPS", range: guidance.next_quarter_eps },
                { label: "Full Year Revenue", range: guidance.full_year_revenue },
                { label: "Full Year EPS", range: guidance.full_year_eps },
              ].map(({ label, range }) => {
                const text = fmtHistRange(range?.low, range?.high);
                if (!text) return null;
                return <div key={label} style={{ fontSize: 12, color: "#ccc", marginBottom: 3 }}>{label}: {text}</div>;
              })}
              {guidance.capex && <div style={{ fontSize: 12, color: "#ccc", marginBottom: 3 }}>Capex: {guidance.capex}</div>}
              {guidance.other_forward_items?.filter(Boolean).map((item, i) => (
                <div key={`fwd-${i}`} style={{ fontSize: 12, color: "#aaa", paddingLeft: 8, borderLeft: "2px solid #333", marginBottom: 2 }}>{item}</div>
              ))}
              {guidance.guidance_tone && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, textTransform: "capitalize", marginTop: 4, display: "inline-block",
                  background: guidance.guidance_tone === "optimistic" ? "#22c55e20" : guidance.guidance_tone === "cautious" ? "#f59e0b20" : guidance.guidance_tone === "pessimistic" ? "#ef444420" : "#88888820",
                  color: guidance.guidance_tone === "optimistic" ? "#22c55e" : guidance.guidance_tone === "cautious" ? "#f59e0b" : guidance.guidance_tone === "pessimistic" ? "#ef4444" : "#888",
                }}>
                  {guidance.guidance_tone}
                </span>
              )}
              {guidance.guidance_summary && <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.5, marginTop: 6 }}>{guidance.guidance_summary}</div>}
            </>
          )}
        </div>
      )}

      {/* Sentiment with confidence */}
      {sentiment && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>Sentiment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, textTransform: "capitalize",
              background: (SENTIMENT_COLORS[sentiment.overall] || SENTIMENT_COLORS.neutral).bg,
              color: (SENTIMENT_COLORS[sentiment.overall] || SENTIMENT_COLORS.neutral).text,
            }}>
              {sentiment.overall}
            </span>
            {sentiment.confidence != null && (
              <span style={{ fontSize: 11, color: sentiment.confidence >= 80 ? "#22c55e" : sentiment.confidence >= 60 ? "#f59e0b" : "#ef4444", fontWeight: 600 }}>
                {sentiment.confidence}% confidence
              </span>
            )}
            {sentiment.tone_vs_prior && (
              <span style={{ fontSize: 12, color: "#888" }}>
                vs Prior: {sentiment.tone_vs_prior.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {sentiment.confidence_basis && (
            <div style={{ fontSize: 11, color: "#666", marginBottom: 6, lineHeight: 1.3 }}>{sentiment.confidence_basis}</div>
          )}
          {sentiment.key_positive_signals?.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              {sentiment.key_positive_signals.map((s, i) => (
                <span key={`pos-${i}`} style={{ fontSize: 12, color: "#22c55e", marginRight: 8 }}>+ {s}</span>
              ))}
            </div>
          )}
          {sentiment.key_concerns?.length > 0 && (
            <div>
              {sentiment.key_concerns.map((c, i) => (
                <span key={`neg-${i}`} style={{ fontSize: 12, color: "#ef4444", marginRight: 8 }}>- {c}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Quotes */}
      {quotes && quotes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 6 }}>Key Quotes</div>
          {quotes.map((q, i) => (
            <div key={`quote-${i}`} style={{ marginBottom: 8, paddingLeft: 12, borderLeft: "2px solid #333" }}>
              <div style={{ fontSize: 13, color: "#ccc", fontStyle: "italic", lineHeight: 1.4 }}>&ldquo;{q.quote}&rdquo;</div>
              <span style={{ fontSize: 11, color: "#666" }}>{q.speaker}{q.context ? ` — ${q.context}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AIHistoryView() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<AIHistoryItem[]>([]);
  const [stats, setStats] = useState<AIHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<AIHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch list and stats
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      api.aiHistory.list(filter),
      api.aiHistory.stats(),
    ])
      .then(([itemsData, statsData]) => {
        setItems(itemsData);
        setStats(statsData);
      })
      .catch((e) => console.error("Failed to load AI history:", e))
      .finally(() => setLoading(false));
  }, [isAuthenticated, filter]);

  // Fetch detail when expanding
  useEffect(() => {
    if (expandedId == null) {
      setExpandedDetail(null);
      return;
    }
    setDetailLoading(true);
    api.aiHistory
      .detail(expandedId)
      .then(setExpandedDetail)
      .catch((e) => console.error("Failed to load detail:", e))
      .finally(() => setDetailLoading(false));
  }, [expandedId]);

  const renderedContent = useMemo(() => {
    if (!expandedDetail?.content) return null;
    // JSON-based types have their own structured renderers
    if (expandedDetail.analysis_type === "dcf_suggestion") return null;
    if (expandedDetail.analysis_type === "risk_assessment") return null;
    if (expandedDetail.analysis_type === "earnings_analysis") return null;
    return renderMarkdown(expandedDetail.content);
  }, [expandedDetail]);

  // Auth gate
  if (authLoading) {
    return (
      <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>&#x23F3;</div>
        <div style={{ fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F512;</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Sign in to view AI History</div>
        <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
          Your AI-generated memos and analyses are saved here.
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "10px 24px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const FILTERS: Array<{ key: string | undefined; label: string }> = [
    { key: undefined, label: "All" },
    { key: "memo", label: "Memos" },
    { key: "financial_analysis", label: "Financial Analysis" },
    { key: "dcf_suggestion", label: "Valuation" },
    { key: "risk_assessment", label: "Risk" },
    { key: "earnings_analysis", label: "Earnings" },
  ];

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>AI History</h2>
          <div style={{ fontSize: 13, color: "#888" }}>
            All your AI-generated analyses in one place
          </div>
        </div>

        {/* Stats card */}
        {stats && (
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 10,
              padding: "12px 16px",
              minWidth: 220,
            }}
          >
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", marginBottom: 8 }}>
              Monthly AI Usage
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total_count}</div>
                <div style={{ fontSize: 11, color: "#888" }}>Total Analyses</div>
              </div>

            </div>

            {/* Type breakdown */}
            {stats.by_type.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {stats.by_type.map((t) => {
                  const cfg = getTypeConfig(t.analysis_type);
                  return (
                    <div key={t.analysis_type} style={{ fontSize: 11 }}>
                      <span style={{ color: cfg.color }}>{cfg.label}</span>{" "}
                      <span style={{ color: "#888" }}>{t.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(filter === f.key ? undefined : f.key)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
              background: filter === f.key ? "#3b82f6" : "#2d2d2d",
              color: "#fff",
              border: "none",
              borderRadius: 6,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, opacity: 0.6 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>&#x1F4AD;</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No analyses yet</div>
          <div style={{ fontSize: 13, color: "#888" }}>
            Generate an AI analysis or memo on any ticker to see it here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const cfg = getTypeConfig(item.analysis_type);
            const isExpanded = expandedId === item.id;
            const isDCF = item.analysis_type === "dcf_suggestion";
            const isRisk = item.analysis_type === "risk_assessment";
            const isEarnings = item.analysis_type === "earnings_analysis";
            const previewText = isDCF
              ? dcfPreviewText(item.content_preview)
              : isRisk
                ? riskPreviewText(item.content_preview)
                : isEarnings
                  ? earningsPreviewText(item.content_preview)
                  : item.content_preview;

            return (
              <div
                key={item.id}
                style={{
                  background: "#1a1a1a",
                  border: `1px solid ${isExpanded ? "#555" : "#333"}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Summary row — always visible */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Ticker */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/quote/${item.ticker}`);
                    }}
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#3b82f6",
                      cursor: "pointer",
                      minWidth: 60,
                    }}
                  >
                    {item.ticker}
                  </span>

                  {/* Type badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: `${cfg.color}20`,
                      color: cfg.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cfg.label}
                  </span>

                  {/* Preview */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "#888",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {previewText}
                  </span>

                  {/* Relative time */}
                  <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>
                    {relativeTime(item.created_at)}
                  </span>

                  {/* Expand chevron */}
                  <span style={{ fontSize: 12, color: "#666", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                    &#x25BC;
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #333", padding: 16 }}>
                    {detailLoading ? (
                      <div style={{ textAlign: "center", padding: 20, opacity: 0.6 }}>Loading full content...</div>
                    ) : expandedDetail ? (
                      <div>
                        {/* Timestamp */}
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
                          {new Date(expandedDetail.created_at).toLocaleString()}
                        </div>
                        {/* Content — structured for DCF/Risk, markdown for everything else */}
                        {expandedDetail.analysis_type === "dcf_suggestion" ? (
                          <DCFSuggestionDetail content={expandedDetail.content} />
                        ) : expandedDetail.analysis_type === "risk_assessment" ? (
                          <RiskAssessmentDetail content={expandedDetail.content} />
                        ) : expandedDetail.analysis_type === "earnings_analysis" ? (
                          <EarningsAnalysisDetail content={expandedDetail.content} />
                        ) : (
                          <div style={{ fontSize: 14, lineHeight: 1.7 }}>{renderedContent}</div>
                        )}
                      </div>
                    ) : null}
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
