/**
 * Earnings Press Release Analysis Card
 * =====================================
 * On-demand AI analysis of the latest 8-K Item 2.02 filing.
 *
 * Behavior:
 * 1. On mount: check for cached/stored analysis (free, no LLM cost)
 * 2. If found: display structured results
 * 3. If not: show "Analyze Latest Earnings" button
 * 4. On click: trigger POST /analyze (costs tokens), show loading
 * 5. Display: reported results, guidance, sentiment, quotes, summary
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { InfoTip } from "../common/InfoTip";
import { EARNINGS_TIPS } from "../../lib/tooltips";
import type {
  EarningsAnalysisResult,
  EarningsMetric,
  EarningsGuidance,
  EarningsSentiment,
  EarningsKeyQuote,
} from "../../lib/types";

interface Props {
  ticker: string;
  isAuthenticated: boolean;
}

export function EarningsAnalysisCard({ ticker, isAuthenticated }: Props) {
  const [analysis, setAnalysis] = useState<EarningsAnalysisResult | null>(null);
  const [source, setSource] = useState<string>("none");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing analysis on mount (free — no LLM cost)
  useEffect(() => {
    if (!isAuthenticated) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setAnalysis(null);
    setError(null);
    api.earningsAnalysisLatest(ticker)
      .then((res) => {
        if (res.analysis) {
          setAnalysis(res.analysis);
          setSource(res.source ?? "stored");
        }
      })
      .catch(() => {
        // Silently fail — user can still trigger manual analysis
      })
      .finally(() => setChecking(false));
  }, [ticker, isAuthenticated]);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeEarnings(ticker);
      if (res.analysis) {
        setAnalysis(res.analysis);
        setSource("fresh");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      // Try to extract detail from JSON error
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.detail || msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  // Show nothing while checking
  if (checking) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Earnings Press Release Analysis</span>
        </div>
        <div style={{ padding: 20, opacity: 0.5, fontSize: 13 }}>
          Checking for existing analysis...
        </div>
      </div>
    );
  }

  // No analysis yet — show CTA
  if (!analysis) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Earnings Press Release Analysis</span>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ color: "#888", fontSize: 13, margin: "0 0 16px 0" }}>
            AI analysis of the latest 8-K earnings press release from SEC EDGAR.
            Extracts reported results, guidance, sentiment, and key quotes.
          </p>
          {error && (
            <div style={errorStyle}>{error}</div>
          )}
          {isAuthenticated ? (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                ...analyzeButtonStyle,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Analyzing..." : "Analyze Latest Earnings"}
            </button>
          ) : (
            <div style={{ fontSize: 13, color: "#666" }}>
              Sign in to analyze earnings
            </div>
          )}
        </div>
      </div>
    );
  }

  // Display analysis results
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ ...headerStyle, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ fontWeight: 600, fontSize: 15, display: "inline-flex", alignItems: "center" }}>Earnings Press Release Analysis<InfoTip text={EARNINGS_TIPS.item_2_02} /></span>
          {analysis.quarter && (
            <span style={quarterBadgeStyle}>{analysis.quarter}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {source !== "fresh" && source !== "none" && (
            <span style={{ fontSize: 11, color: "#666" }}>
              cached
            </span>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={refreshButtonStyle}
            title="Re-analyze"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filing info */}
      <div style={filingInfoStyle}>
        <span>Filed: {analysis.filing_date}</span>
        {analysis.filing_url && (
          <a
            href={analysis.filing_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3b82f6", fontSize: 12, textDecoration: "none" }}
          >
            View on EDGAR
          </a>
        )}
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div style={sectionStyle}>
          <p style={{ color: "#ccc", fontSize: 13, fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
            {analysis.summary}
          </p>
        </div>
      )}

      {/* Reported Results */}
      {analysis.reported_results && Object.keys(analysis.reported_results).length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>REPORTED RESULTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(analysis.reported_results)
              .filter(([, metric]) => metric != null)
              .map(([key, metric]) => (
                <MetricRow key={key} label={formatLabel(key)} metric={metric} />
              ))}
          </div>
        </div>
      )}

      {/* Other Metrics */}
      {analysis.other_metrics && analysis.other_metrics.length > 0 && (
        <div style={sectionStyle}>
          {analysis.other_metrics.map((m, i) => (
            <OtherMetricRow key={`metric-${m.name}-${i}`} m={m} />
          ))}
        </div>
      )}

      {/* Guidance */}
      {analysis.guidance && <GuidanceSection guidance={analysis.guidance} />}

      {/* Sentiment */}
      {analysis.sentiment && <SentimentSection sentiment={analysis.sentiment} />}

      {/* Key Quotes */}
      {analysis.key_quotes && analysis.key_quotes.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>KEY QUOTES</div>
          {analysis.key_quotes.map((q, i) => (
            <QuoteRow key={`quote-${q.speaker}-${i}`} quote={q} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Inline SVG bar for YoY change — positive = green right, negative = red left */
function YoYBar({ pct }: { pct: number }) {
  const maxBar = 40; // max bar width in px
  const clamped = Math.max(-100, Math.min(100, pct));
  const barWidth = Math.min(maxBar, Math.abs(clamped) * 0.8);
  const color = clamped >= 0 ? "#22c55e" : "#ef4444";
  const sign = clamped >= 0 ? "+" : "";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 100 }}>
      <svg width={maxBar * 2 + 2} height={14} style={{ flexShrink: 0 }}>
        {/* center line */}
        <line x1={maxBar + 1} y1={0} x2={maxBar + 1} y2={14} stroke="#444" strokeWidth={1} />
        {/* bar */}
        <rect
          x={clamped >= 0 ? maxBar + 1 : maxBar + 1 - barWidth}
          y={2}
          width={barWidth}
          height={10}
          rx={2}
          fill={color}
          opacity={0.8}
        />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color, whiteSpace: "nowrap" }}>
        {sign}{clamped.toFixed(1)}%
      </span>
    </div>
  );
}

function MetricRow({ label, metric }: { label: string; metric: EarningsMetric }) {
  if (!metric) return null;

  const pillColor = metric.vs_estimate === "beat" ? "#22c55e"
    : metric.vs_estimate === "miss" ? "#ef4444"
    : metric.vs_estimate === "inline" ? "#888"
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
      <span style={{ color: "#888", minWidth: 100 }}>{label}</span>
      <span style={{ color: "#fff", fontWeight: 600, minWidth: 80 }}>
        {formatValue(metric.value, metric.unit)}
      </span>
      {metric.yoy_change_pct != null && <YoYBar pct={metric.yoy_change_pct} />}
      {pillColor && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 4,
          background: `${pillColor}20`,
          color: pillColor,
          textTransform: "uppercase",
        }}>
          {metric.vs_estimate}
          {metric.surprise_pct != null && ` +${Math.abs(metric.surprise_pct).toFixed(1)}%`}
        </span>
      )}
      {metric.note && (
        <span style={{ color: "#666", fontSize: 12 }}>{metric.note}</span>
      )}
    </div>
  );
}

/** YoY bar for other_metrics — accepts the raw value which might be a number */
function OtherMetricRow({ m }: { m: { name: string; value: string; unit?: string | null; yoy_change_pct?: number | null; note: string | null } }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4, flexWrap: "wrap" }}>
      <span style={{ color: "#888", minWidth: 120 }}>{m.name}</span>
      <span style={{ color: "#fff", fontWeight: 500 }}>{formatMetricValue(m.value, m.unit)}</span>
      {m.yoy_change_pct != null && <YoYBar pct={m.yoy_change_pct} />}
      {m.note && <span style={{ color: "#666", fontSize: 12 }}>{m.note}</span>}
    </div>
  );
}

function GuidanceSection({ guidance }: { guidance: EarningsGuidance }) {
  // If explicitly flagged as no guidance
  if (guidance.has_guidance === false) {
    return (
      <div style={sectionStyle}>
        <div style={{ ...sectionHeaderStyle, display: "flex", alignItems: "center" }}>FORWARD GUIDANCE<InfoTip text={EARNINGS_TIPS.forward_guidance} /></div>
        <div style={{ fontSize: 13, color: "#666", fontStyle: "italic" }}>
          No explicit forward guidance provided in this release.
        </div>
      </div>
    );
  }

  const toneColor = guidance.guidance_tone === "optimistic" ? "#22c55e"
    : guidance.guidance_tone === "cautious" ? "#f59e0b"
    : guidance.guidance_tone === "pessimistic" ? "#ef4444"
    : "#888";

  const rangeRows: Array<{ label: string; range: { low: number | null; high: number | null } | null }> = [
    { label: "Next Q Revenue", range: guidance.next_quarter_revenue },
    { label: "Next Q EPS", range: guidance.next_quarter_eps },
    { label: "Full Year Revenue", range: guidance.full_year_revenue },
    { label: "Full Year EPS", range: guidance.full_year_eps },
  ];

  const hasAnyRange = rangeRows.some(r => r.range && (r.range.low != null || r.range.high != null));
  const otherItems = guidance.other_forward_items?.filter(Boolean) ?? [];

  return (
    <div style={sectionStyle}>
      <div style={{ ...sectionHeaderStyle, display: "flex", alignItems: "center" }}>FORWARD GUIDANCE<InfoTip text={EARNINGS_TIPS.forward_guidance} /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Numeric ranges */}
        {hasAnyRange && rangeRows.map(({ label, range }) => {
          if (!range || (range.low == null && range.high == null)) return null;
          return (
            <div key={label} style={{ fontSize: 13, color: "#ccc" }}>
              {label}: {formatRange(range.low, range.high)}
            </div>
          );
        })}

        {/* Capex */}
        {guidance.capex && (
          <div style={{ fontSize: 13, color: "#ccc" }}>
            Capex: {guidance.capex}
          </div>
        )}

        {/* Other forward items */}
        {otherItems.length > 0 && (
          <div style={{ marginTop: 2 }}>
            {otherItems.map((item, i) => (
              <div key={`fwd-${i}`} style={{ fontSize: 12, color: "#aaa", paddingLeft: 8, borderLeft: "2px solid #333", marginBottom: 3 }}>
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Tone pill */}
        {guidance.guidance_tone && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "#888", display: "inline-flex", alignItems: "center" }}>Tone<InfoTip text={EARNINGS_TIPS.guidance_tone} />:</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              background: `${toneColor}20`,
              color: toneColor,
              textTransform: "capitalize",
            }}>
              {guidance.guidance_tone}
            </span>
          </div>
        )}

        {guidance.guidance_summary && (
          <p style={{ color: "#999", fontSize: 12, margin: "4px 0 0 0", lineHeight: 1.4 }}>
            {guidance.guidance_summary}
          </p>
        )}
      </div>
    </div>
  );
}

/** Confidence arc — a small donut segment showing 0-100 confidence */
function ConfidenceArc({ value }: { value: number }) {
  const radius = 18;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={44} height={44} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={22} cy={22} r={radius} fill="none" stroke="#333" strokeWidth={stroke} />
        <circle cx={22} cy={22} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 700, color, marginLeft: -34 }}>{pct}</span>
    </div>
  );
}

function SentimentSection({ sentiment }: { sentiment: EarningsSentiment }) {
  const overallColor = sentiment.overall === "positive" ? "#22c55e"
    : sentiment.overall === "negative" ? "#ef4444"
    : sentiment.overall === "mixed" ? "#f59e0b"
    : "#888";

  const toneLabel = sentiment.tone_vs_prior === "more_optimistic" ? "More Optimistic"
    : sentiment.tone_vs_prior === "more_cautious" ? "More Cautious"
    : sentiment.tone_vs_prior === "unchanged" ? "Unchanged"
    : null;

  return (
    <div style={sectionStyle}>
      <div style={{ ...sectionHeaderStyle, display: "flex", alignItems: "center" }}>SENTIMENT<InfoTip text={EARNINGS_TIPS.sentiment} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        {/* Confidence arc */}
        {sentiment.confidence != null && (
          <ConfidenceArc value={sentiment.confidence} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 4,
              background: `${overallColor}20`,
              color: overallColor,
              textTransform: "capitalize",
            }}>
              {sentiment.overall}
            </span>
            {toneLabel && (
              <span style={{ fontSize: 12, color: "#888" }}>
                vs Prior: {toneLabel}
              </span>
            )}
          </div>
          {/* Confidence basis */}
          {sentiment.confidence_basis && (
            <span style={{ fontSize: 11, color: "#666", lineHeight: 1.3 }}>
              {sentiment.confidence_basis}
            </span>
          )}
        </div>
      </div>
      {sentiment.key_positive_signals?.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {sentiment.key_positive_signals.map((s, i) => (
            <span key={`pos-${i}`} style={{ fontSize: 12, color: "#22c55e", marginRight: 8 }}>
              + {s}
            </span>
          ))}
        </div>
      )}
      {sentiment.key_concerns?.length > 0 && (
        <div>
          {sentiment.key_concerns.map((c, i) => (
            <span key={`neg-${i}`} style={{ fontSize: 12, color: "#ef4444", marginRight: 8 }}>
              - {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteRow({ quote }: { quote: EarningsKeyQuote }) {
  return (
    <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: "2px solid #333" }}>
      <p style={{ color: "#ccc", fontSize: 13, margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>
        &ldquo;{quote.quote}&rdquo;
      </p>
      <span style={{ fontSize: 11, color: "#666" }}>
        {quote.speaker}
        {quote.context && ` — ${quote.context}`}
      </span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a numeric value with the appropriate unit prefix/suffix.
 * unit: "$" → $124.3B, "%" → 18.7%, "#" → 1.2B, "x" → 3.2x, "" → 124.3B
 * Falls back to "$" for backward compat if unit is null/undefined.
 */
function formatValue(value: number | string | null, unit?: string | null): string {
  if (value == null) return "N/A";
  if (typeof value === "string") return value;

  const prefix = unit === "$" || unit == null ? "$" : "";
  const suffix = unit === "%" ? "%" : unit === "x" ? "x" : "";

  // For percentages, the value is already in human scale (e.g. 18.7 not 0.187)
  if (unit === "%") return `${value}%`;

  // Format large numbers with suffix
  const fmtNum = (n: number): string => {
    const a = Math.abs(n);
    if (a >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
    if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (a >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toFixed(2);
  };

  return `${prefix}${fmtNum(value)}${suffix}`;
}

/**
 * Format other_metrics values — Haiku returns a mix of strings ("18.7%")
 * and raw numbers (40297000). If it's already a human-readable string, pass
 * through. If it's a numeric string (no letters/symbols), format it.
 */
function formatMetricValue(value: string | number | null, unit?: string | null): string {
  if (value == null) return "N/A";
  if (typeof value === "number") return formatValue(value, unit);
  // If the string is purely numeric (possibly with sign/decimal), format it
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (!isNaN(num) && Math.abs(num) >= 1000) return formatValue(num, unit);
  }
  // Already human-readable (e.g. "18.7%", "$40.3M") — pass through
  return value;
}

function formatRange(low: number | null, high: number | null): string {
  if (low != null && high != null) {
    return `${formatValue(low)} - ${formatValue(high)}`;
  }
  if (low != null) return `${formatValue(low)}+`;
  if (high != null) return `up to ${formatValue(high)}`;
  return "N/A";
}

// ── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 12,
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 16px",
  borderBottom: "1px solid #333",
};

const filingInfoStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 16px",
  fontSize: 12,
  color: "#666",
  borderBottom: "1px solid #222",
};

const sectionStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #222",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  color: "#666",
  marginBottom: 8,
};

const quarterBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 4,
  background: "#3b82f620",
  color: "#3b82f6",
};

const analyzeButtonStyle: React.CSSProperties = {
  background: "#3b82f620",
  border: "1px solid #3b82f640",
  borderRadius: 8,
  color: "#3b82f6",
  fontSize: 14,
  fontWeight: 600,
  padding: "10px 20px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const refreshButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#888",
  fontSize: 11,
  padding: "3px 10px",
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  background: "#ef444420",
  border: "1px solid #ef444440",
  borderRadius: 8,
  color: "#ef4444",
  fontSize: 13,
  padding: "10px 14px",
  marginBottom: 12,
};
