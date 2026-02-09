import { useState, useCallback } from "react";
import { api } from "../../lib/api";
import type { AIRiskAssessment, TailoredScenario, RiskFactor } from "../../lib/types";
import { InfoTip } from "../common/InfoTip";

// ── Color maps ──────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: "#22c55e22", border: "#22c55e55", text: "#22c55e" },
  moderate: { bg: "#3b82f622", border: "#3b82f655", text: "#3b82f6" },
  elevated: { bg: "#f9731622", border: "#f9731655", text: "#f97316" },
  high:     { bg: "#ef444422", border: "#ef444455", text: "#ef4444" },
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  low:    { bg: "#22c55e22", text: "#22c55e" },
  medium: { bg: "#f59e0b22", text: "#f59e0b" },
  high:   { bg: "#ef444422", text: "#ef4444" },
};

const LIKELIHOOD_COLORS: Record<string, { bg: string; text: string }> = {
  low:      { bg: "#6b728022", text: "#9ca3af" },
  medium:   { bg: "#f59e0b22", text: "#f59e0b" },
  plausible: { bg: "#3b82f622", text: "#3b82f6" },
};

// ── Sub-components ──────────────────────────────────────────────────────

function Chip({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        background: colors.bg,
        color: colors.text,
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
      }}
    >
      {label}
    </span>
  );
}

function RiskFactorCard({ factor }: { factor: RiskFactor }) {
  const [expanded, setExpanded] = useState(false);
  const colors = SEVERITY_COLORS[factor.severity] || SEVERITY_COLORS.medium;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "rgba(255,255,255,0.02)",
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Chip label={factor.severity} colors={colors} />
          <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {factor.title}
          </span>
        </div>
        <span style={{ fontSize: 10, opacity: 0.4, flexShrink: 0 }}>
          {expanded ? "−" : "+"}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>
            {factor.detail}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.15)",
              fontSize: 11,
              opacity: 0.7,
            }}
          >
            Simulation impact: {factor.monte_carlo_impact}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioActionCard({
  scenario,
  onApply,
  isActive,
}: {
  scenario: TailoredScenario;
  onApply: (params: TailoredScenario["parameters"], name: string) => void;
  isActive: boolean;
}) {
  const lColors = LIKELIHOOD_COLORS[scenario.estimated_likelihood] || LIKELIHOOD_COLORS.medium;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: isActive ? "1px solid #3b82f6" : "1px solid #2a2a2a",
        background: isActive ? "rgba(59, 130, 246, 0.08)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{scenario.name}</div>
        <Chip label={scenario.estimated_likelihood} colors={lColors} />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, opacity: 0.7 }}>
        {scenario.narrative}
      </div>

      {/* Parameter badges */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span style={paramBadge}>
          vol: {scenario.parameters.vol_multiplier}x
        </span>
        <span style={paramBadge}>
          horizon: {scenario.parameters.horizon_days}d
        </span>
        {scenario.parameters.include_earnings_shock && (
          <span style={paramBadge}>
            + earnings shock
          </span>
        )}
      </div>

      <button
        onClick={() => onApply(scenario.parameters, scenario.name)}
        disabled={isActive}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "8px 12px",
          borderRadius: 8,
          border: "none",
          background: isActive ? "#2a2a2a" : "#3b82f6",
          color: isActive ? "#888" : "#fff",
          fontSize: 12,
          fontWeight: 600,
          cursor: isActive ? "default" : "pointer",
          opacity: isActive ? 0.6 : 1,
        }}
      >
        {isActive ? "Active" : "Run This Scenario"}
      </button>
    </div>
  );
}

const paramBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid #333",
  fontSize: 10,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#aaa",
};

// ── Main panel ──────────────────────────────────────────────────────────

interface AIRiskPanelProps {
  ticker: string;
  onApplyScenario: (params: { vol_multiplier: number; horizon_days: number; include_earnings_shock: boolean }, name: string) => void;
  onApplyBase: (params: { vol_multiplier: number; horizon_days: number }, rationale: string) => void;
  activeScenarioName: string | null;
}

export function AIRiskPanel({ ticker, onApplyScenario, onApplyBase, activeScenarioName }: AIRiskPanelProps) {
  const [data, setData] = useState<AIRiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.riskAIAssessment(ticker);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI assessment");
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  // Haven't fetched yet — show the trigger button
  if (!data && !loading && !error) {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <button
          onClick={fetchAssessment}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #3b82f655",
            background: "rgba(59, 130, 246, 0.1)",
            color: "#3b82f6",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Analyze Risk Profile with AI
        </button>
        <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>
          Analyzes fundamentals, volatility, ownership, and sentiment
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 24, fontSize: 13, opacity: 0.6 }}>
        <div style={{ marginBottom: 8 }}>Analyzing {ticker} risk profile...</div>
        <div style={{ fontSize: 11, opacity: 0.5 }}>
          Gathering financials, volatility, ownership, and sentiment data
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <div style={{ color: "#ef4444", marginBottom: 10, fontSize: 13 }}>{error}</div>
        <button
          onClick={fetchAssessment}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #ef444455",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const tierColors = TIER_COLORS[data.overall_risk_tier] || TIER_COLORS.moderate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Risk Tier Badge + Summary */}
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          border: `1px solid ${tierColors.border}`,
          background: tierColors.bg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 6,
              background: tierColors.text,
              color: "#000",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {data.overall_risk_tier} risk
          </span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
          {data.summary}
        </div>
      </div>

      {/* Risk Factors */}
      {data.risk_factors.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.5,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            Key Risk Factors<InfoTip text="AI-identified risks specific to this stock, based on fundamentals, volatility patterns, ownership concentration, and recent news sentiment." />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.risk_factors.map((f, i) => (
              <RiskFactorCard key={`${f.category}-${i}`} factor={f} />
            ))}
          </div>
        </div>
      )}

      {/* Tailored Scenarios */}
      {data.tailored_scenarios.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.5,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            Tailored Scenarios<InfoTip text="Custom stress scenarios designed for this specific stock. Click 'Apply' to run the Monte Carlo simulation with these parameters and see the impact." />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {data.tailored_scenarios.map((sc, i) => (
              <ScenarioActionCard
                key={`${sc.name}-${i}`}
                scenario={sc}
                onApply={onApplyScenario}
                isActive={activeScenarioName === sc.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suggested Base Parameters */}
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: "1px solid #2a2a2a",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center" }}>Suggested Base Parameters<InfoTip text="AI-recommended starting values for the simulation sliders, calibrated to this stock's current volatility regime and risk profile." /></div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 }}>
              {data.suggested_base_parameters.rationale}
            </div>
          </div>
          <button
            onClick={() =>
              onApplyBase(
                {
                  vol_multiplier: data.suggested_base_parameters.vol_multiplier,
                  horizon_days: data.suggested_base_parameters.horizon_days,
                },
                data.suggested_base_parameters.rationale,
              )
            }
            disabled={activeScenarioName === "__base__"}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #3b82f655",
              background: activeScenarioName === "__base__" ? "#2a2a2a" : "rgba(59, 130, 246, 0.15)",
              color: activeScenarioName === "__base__" ? "#888" : "#3b82f6",
              fontSize: 11,
              fontWeight: 600,
              cursor: activeScenarioName === "__base__" ? "default" : "pointer",
            }}
          >
            {activeScenarioName === "__base__" ? "Applied" : "Apply Base"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <span style={paramBadge}>
            vol: {data.suggested_base_parameters.vol_multiplier}x
          </span>
          <span style={paramBadge}>
            horizon: {data.suggested_base_parameters.horizon_days}d
          </span>
        </div>
      </div>

      {/* Token usage */}
      <div style={{ fontSize: 10, opacity: 0.3, textAlign: "right" }}>
        {data.model} | {data.input_tokens + data.output_tokens} tokens
      </div>
    </div>
  );
}
