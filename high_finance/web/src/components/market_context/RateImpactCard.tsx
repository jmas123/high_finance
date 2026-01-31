import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */

interface RateImpactAnalysis {
  sector: string;
  sensitivity: "high" | "medium" | "low";
  correlation_to_rates: number;
  impact_direction: "positive" | "negative" | "neutral";
  explanation: string;
  historical_performance_rising_rates: number;
  historical_performance_falling_rates: number;
}

interface RateImpactResponse {
  analyses: RateImpactAnalysis[];
  by_sensitivity: { high: string[]; medium: string[]; low: string[] };
  rate_beneficiaries: string[];
  rate_sensitive: string[];
}

interface RateImpactCardProps {
  ticker?: string;
  sector?: string;
  currentRateEnvironment?: "rising" | "falling" | "stable";
}

/* ─── Colours ────────────────────────────────────────────────── */

const C = {
  bg: "#111",
  card: "#1a1a1a",
  border: "#333",
  borderSubtle: "#292929",
  text: "#e4e4e7",
  textSec: "#a1a1aa",
  textMuted: "#71717a",
  green: "#34d399",
  red: "#f87171",
  amber: "#fcd34d",
  blue: "#60a5fa",
};

const SENSITIVITY_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: "#fca5a5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
  medium: { color: "#fcd34d", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
  low: { color: "#6ee7b7", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)" },
};

/* ─── Helpers ────────────────────────────────────────────────── */

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === "positive") return <TrendingUp size={16} color={C.green} />;
  if (dir === "negative") return <TrendingDown size={16} color={C.red} />;
  return <Minus size={16} color={C.textSec} />;
}

/* ─── Component ──────────────────────────────────────────────── */

const RateImpactCard: React.FC<RateImpactCardProps> = ({
  ticker,
  sector,
  currentRateEnvironment = "stable",
}) => {
  const [data, setData] = useState<RateImpactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSector, setActiveSector] = useState<string | null>(sector ?? null);

  useEffect(() => { fetchRateImpact(); }, [sector]);

  const fetchRateImpact = async () => {
    setLoading(true);
    try {
      // Always fetch ALL sectors so the list is never empty.
      // We'll pre-select the one matching the ticker's sector.
      const response = await fetch("/api/v1/market/rate-impact");
      if (!response.ok) throw new Error("Failed to fetch rate impact data");
      const result: RateImpactResponse = await response.json();
      setData(result);
      setError(null);

      // Try to pre-select the ticker's sector via fuzzy match
      const match = findMatchingSector(sector, result.analyses);
      setActiveSector(match ?? (result?.analyses?.[0]?.sector ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Yahoo Finance and GICS use different names for the same sectors.
   * Try exact match first, then normalised substring matching.
   */
  function findMatchingSector(
    sectorProp: string | undefined,
    analyses: RateImpactAnalysis[]
  ): string | null {
    if (!sectorProp || !analyses.length) return null;

    // Exact match
    const exact = analyses.find((a) => a.sector === sectorProp);
    if (exact) return exact.sector;

    // Normalise & fuzzy match
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const needle = norm(sectorProp);

    // Common Yahoo → GICS mappings
    const ALIASES: Record<string, string[]> = {
      consumercyclical: ["consumerdiscretionary"],
      consumerdiscretionary: ["consumercyclical"],
      consumerdefensive: ["consumerstaples"],
      consumerstaples: ["consumerdefensive"],
      communicationservices: ["communication"],
      communication: ["communicationservices"],
      informationtechnology: ["technology"],
      technology: ["informationtechnology"],
    };

    // Check if needle matches any sector (substring or alias)
    for (const a of analyses) {
      const aNorm = norm(a.sector);
      if (aNorm.includes(needle) || needle.includes(aNorm)) return a.sector;

      const aliases = ALIASES[needle];
      if (aliases?.some((alias) => aNorm.includes(alias) || alias.includes(aNorm))) {
        return a.sector;
      }
    }

    return null;
  }

  const active = useMemo(() => {
    if (!data) return null;
    return data.analyses.find((a) => a.sector === activeSector) ?? data.analyses[0] ?? null;
  }, [data, activeSector]);

  const getImplication = (a: RateImpactAnalysis) => {
    if (currentRateEnvironment === "rising") {
      if (a.impact_direction === "positive") return { text: "Favorable", color: C.green };
      if (a.impact_direction === "negative") return { text: "Headwind", color: C.red };
    }
    if (currentRateEnvironment === "falling") {
      if (a.impact_direction === "negative") return { text: "Favorable", color: C.green };
      if (a.impact_direction === "positive") return { text: "Headwind", color: C.red };
    }
    return { text: "Neutral", color: C.textSec };
  };

  const envConfig = (() => {
    if (currentRateEnvironment === "rising")
      return { icon: <ArrowUpRight size={14} color={C.red} />, label: "Rising rates", color: "#fca5a5", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };
    if (currentRateEnvironment === "falling")
      return { icon: <ArrowDownRight size={14} color={C.green} />, label: "Falling rates", color: "#6ee7b7", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" };
    return { icon: <Minus size={14} color={C.textSec} />, label: "Stable rates", color: "#d4d4d8", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.2)" };
  })();

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading rate impact data…</div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div style={{ background: C.card, border: "1px solid #7f1d1d", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={C.red} />
          <span style={{ fontSize: 13, color: "#fca5a5" }}>Failed to load rate impact data</span>
          <button onClick={fetchRateImpact} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <RefreshCw size={14} color={C.textSec} />
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const analyses = data.analyses;

  return (
    <div style={{ position: "relative", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>

      {/* ─── Header ─── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ padding: 6, background: "rgba(59,130,246,0.12)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)", display: "flex" }}>
            <TrendingUp size={14} color={C.blue} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Rate Sensitivity
            </div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: `1px solid ${envConfig.border}`,
                background: envConfig.bg,
                color: envConfig.color,
              }}>
                {envConfig.icon} {envConfig.label}
              </span>
              {!sector && <span style={{ fontSize: 11, color: C.textMuted }}>Click a sector to view details</span>}
            </div>
          </div>
        </div>
        <button onClick={fetchRateImpact} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Refresh">
          <RefreshCw size={14} color={C.textMuted} />
        </button>
      </div>

      {/* ─── Quick buckets ─── */}
      {!sector && (
        <div style={{ padding: "8px 16px", borderBottom: `1px solid ${C.borderSubtle}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: C.textMuted, marginRight: 4 }}>Top buckets:</span>
          <span style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#fca5a5" }}>
            High: {data.by_sensitivity.high.slice(0, 2).join(", ")}
          </span>
          <span style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.08)", color: "#6ee7b7" }}>
            Beneficiaries: {data.rate_beneficiaries.slice(0, 2).join(", ")}
          </span>
          <span style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.08)", color: "#fcd34d" }}>
            Sensitive: {data.rate_sensitive.slice(0, 2).join(", ")}
          </span>
        </div>
      )}

      {/* ─── Body: List + Detail ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>

        {/* Left list */}
        <div style={{ borderRight: `1px solid ${C.borderSubtle}`, maxHeight: 360, overflowY: "auto" }}>
          {analyses.map((a, idx) => {
            const isActive = active?.sector === a.sector;
            const imp = getImplication(a);
            const senStyle = SENSITIVITY_STYLES[a.sensitivity] ?? SENSITIVITY_STYLES.low;

            return (
              <button
                key={a.sector}
                onClick={() => setActiveSector(a.sector)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  cursor: "pointer",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none",
                  borderTop: idx > 0 ? `1px solid ${C.borderSubtle}` : "none",
                  color: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flexShrink: 0 }}>
                  <DirectionIcon dir={a.impact_direction} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.sector}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: `1px solid ${senStyle.border}`,
                      background: senStyle.bg,
                      color: senStyle.color,
                    }}>
                      {a.sensitivity}
                    </span>
                    <span style={{ color: imp.color }}>{imp.text}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: C.textSec, flexShrink: 0 }}>
                  {a.correlation_to_rates >= 0 ? "+" : ""}{a.correlation_to_rates.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right detail */}
        <div style={{ padding: 16 }}>
          {active ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected sector</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, color: C.text }}>{active.sector}</div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      borderRadius: 4,
                      border: `1px solid ${(SENSITIVITY_STYLES[active.sensitivity] ?? SENSITIVITY_STYLES.low).border}`,
                      background: (SENSITIVITY_STYLES[active.sensitivity] ?? SENSITIVITY_STYLES.low).bg,
                      color: (SENSITIVITY_STYLES[active.sensitivity] ?? SENSITIVITY_STYLES.low).color,
                    }}>
                      {active.sensitivity} sensitivity
                    </span>
                    <span style={{ fontSize: 11, color: C.textSec }}>
                      Impact:{" "}
                      <span style={{ color: active.impact_direction === "positive" ? C.green : active.impact_direction === "negative" ? C.red : C.textSec }}>
                        {active.impact_direction}
                      </span>
                    </span>
                  </div>
                </div>
                {!sector && (
                  <button onClick={() => setActiveSector(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Clear">
                    <X size={16} color={C.textSec} />
                  </button>
                )}
              </div>

              {/* Correlation bar */}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>Correlation to Fed rates</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CorrelationBar value={active.correlation_to_rates} />
                  <span style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    color: active.correlation_to_rates >= 0 ? C.green : C.red,
                  }}>
                    {active.correlation_to_rates >= 0 ? "+" : ""}{active.correlation_to_rates.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Explanation */}
              <div style={{
                marginTop: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: 12,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                border: `1px solid ${C.borderSubtle}`,
              }}>
                <Info size={14} color={C.blue} style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#d4d4d8", lineHeight: 1.6, margin: 0 }}>{active.explanation}</p>
              </div>

              {/* Historical performance */}
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                    <ArrowUpRight size={12} /> Rising rates (hist.)
                  </div>
                  <div style={{
                    fontSize: 20,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: active.historical_performance_rising_rates >= 0 ? C.green : C.red,
                  }}>
                    {active.historical_performance_rising_rates >= 0 ? "+" : ""}{active.historical_performance_rising_rates.toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                    <ArrowDownRight size={12} /> Falling rates (hist.)
                  </div>
                  <div style={{
                    fontSize: 20,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: active.historical_performance_falling_rates >= 0 ? C.green : C.red,
                  }}>
                    {active.historical_performance_falling_rates >= 0 ? "+" : ""}{active.historical_performance_falling_rates.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Ticker note */}
              {ticker && (
                <div style={{ marginTop: 16, fontSize: 12, color: C.textSec, borderTop: `1px solid ${C.borderSubtle}`, paddingTop: 12 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{ticker}</span>: watch Fed announcements — rate expectations can re-price sector multiples quickly.
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: C.textSec, padding: 20 }}>
              Select a sector to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Correlation Bar ────────────────────────────────────────── */

function CorrelationBar({ value }: { value: number }) {
  const width = Math.min(Math.abs(value), 1) * 100;
  const isPos = value >= 0;

  return (
    <div style={{ display: "flex", width: 100, height: 6, background: "#27272a", borderRadius: 3, overflow: "hidden" }}>
      {!isPos && (
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ height: "100%", background: "#ef4444", borderRadius: "3px 0 0 3px", width: `${width}%` }} />
        </div>
      )}
      <div style={{ width: 1, height: "100%", background: "#555", flexShrink: 0 }} />
      {isPos && (
        <div style={{ flex: 1 }}>
          <div style={{ height: "100%", background: "#10b981", borderRadius: "0 3px 3px 0", width: `${width}%` }} />
        </div>
      )}
      {!isPos && <div style={{ flex: 1 }} />}
    </div>
  );
}

export default RateImpactCard;