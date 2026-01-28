import { useEffect, useMemo, useState } from "react";
import type { ValuationBundle, SensitivityItem } from "../lib/types";

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtMoney(x: number | null | undefined) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  if (Math.abs(x) >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (Math.abs(x) >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPx(x: number | null | undefined) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

function fmtPct(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtPctSigned(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const val = x * 100;
  return val >= 0 ? `+${val.toFixed(digits)}%` : `${val.toFixed(digits)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type SliderReference = {
  value: number;
  label: string;
  color: string;
};

type Warning = {
  param: string;
  level: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Metric({ label, value, hint, accent, tooltip }: { 
  label: string; 
  value: string; 
  hint?: string;
  accent?: "green" | "red" | "blue";
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = {
    green: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.25)" },
    red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.25)" },
    blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.25)" },
  };
  const style = accent ? colors[accent] : { bg: "rgba(255,255,255,0.02)", border: "#2a2a2a" };

  return (
    <div 
      style={{ 
        padding: 14, 
        borderRadius: 10, 
        border: `1px solid ${style.border}`, 
        background: style.bg,
        position: "relative",
        cursor: tooltip ? "help" : "default",
      }}
      onMouseEnter={() => tooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{ 
        fontSize: 10, 
        opacity: 0.6, 
        marginBottom: 6, 
        textTransform: "uppercase", 
        letterSpacing: "0.5px",
        fontWeight: 500,
      }}>
        {label}
        {tooltip && <span style={{ marginLeft: 4, opacity: 0.5 }}>ⓘ</span>}
      </div>
      <div style={{ 
        fontSize: 18, 
        fontWeight: 700, 
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" 
      }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 5 }}>{hint}</div>}
      
      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 8,
          background: "#1a1a1a",
          border: "1px solid #444",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          width: 200,
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          color: "#ccc",
          textTransform: "none",
          letterSpacing: "normal",
          fontWeight: "normal",
        }}>
          {tooltip}
          <div style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid #444",
          }} />
        </div>
      )}
    </div>
  );
}

function WarningBadge({ warning }: { warning: Warning }) {
  const colors = {
    info: { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)", text: "#60a5fa" },
    warning: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", text: "#fbbf24" },
    error: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)", text: "#f87171" },
  };
  const c = colors[warning.severity];

  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${c.border}`,
      background: c.bg,
      fontSize: 12,
    }}>
      <div style={{ color: c.text, fontWeight: 600, marginBottom: 2 }}>
        {warning.severity === "error" ? "⚠️" : warning.severity === "warning" ? "⚡" : "ℹ️"} {warning.message}
      </div>
      {warning.suggestion && (
        <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>{warning.suggestion}</div>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  fairValue,
  upsidePct,
  inputs,
  color,
  description,
}: {
  scenario: "bear" | "base" | "bull";
  fairValue: number;
  upsidePct: number | null;
  inputs: { growth: number; margin: number; wacc: number };
  color: string;
  description: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      style={{ 
        padding: 14, 
        borderRadius: 10, 
        border: `1px solid ${color}33`, 
        background: `${color}11`, 
        textAlign: "center",
        position: "relative",
        cursor: "help",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.6, letterSpacing: "0.5px" }}>
        {scenario}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color }}>
        {fmtPx(fairValue)}
      </div>
      {upsidePct !== null && (
        <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
          {fmtPctSigned(upsidePct)} vs current
        </div>
      )}
      <div style={{ fontSize: 9, marginTop: 6, opacity: 0.5 }}>
        g: {fmtPct(inputs.growth, 0)} • m: {fmtPct(inputs.margin, 0)} • wacc: {fmtPct(inputs.wacc, 0)}
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 8,
          background: "#1a1a1a",
          border: `1px solid ${color}66`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          width: 200,
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          color: "#ccc",
          textAlign: "left",
        }}>
          <div style={{ fontWeight: 600, color, marginBottom: 6, textTransform: "uppercase", fontSize: 10 }}>
            {scenario} Case
          </div>
          {description}
          <div style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid ${color}66`,
          }} />
        </div>
      )}
    </div>
  );
}

function ReferenceMarker({ 
  reference, 
  positionPct,
  min,
  max,
}: { 
  reference: SliderReference; 
  positionPct: number;
  min: number;
  max: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Clamp position to keep tooltip on screen
  const clampedPct = Math.max(5, Math.min(95, positionPct));
  
  return (
    <div
      style={{
        position: "absolute",
        left: `${positionPct}%`,
        top: 20,
        transform: "translateX(-50%)",
        zIndex: showTooltip ? 20 : 10,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tick mark */}
      <div 
        style={{
          width: 3,
          height: 12,
          background: reference.color,
          borderRadius: 1,
          cursor: "pointer",
          transition: "transform 0.15s ease",
          transform: showTooltip ? "scaleY(1.3)" : "scaleY(1)",
        }} 
      />
      
      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a",
            border: `1px solid ${reference.color}`,
            borderRadius: 6,
            padding: "6px 10px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 10, color: reference.color, fontWeight: 600 }}>
            {reference.label}
          </div>
          <div style={{ 
            fontSize: 12, 
            color: "#fff", 
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            marginTop: 2,
          }}>
            {(reference.value * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

function SliderWithReferences({
  label,
  value,
  setValue,
  min,
  max,
  step,
  references,
  paramWarnings,
  tooltip,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
  references: SliderReference[];
  paramWarnings: Warning[];
  tooltip?: string;
}) {
  const [showLabelTooltip, setShowLabelTooltip] = useState(false);
  const hasWarning = paramWarnings.some(w => w.severity === "warning" || w.severity === "error");
  const hasError = paramWarnings.some(w => w.severity === "error");

  const positionPct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  return (
    <div style={{ 
      border: `1px solid ${hasError ? "rgba(239, 68, 68, 0.4)" : hasWarning ? "rgba(245, 158, 11, 0.4)" : "#2a2a2a"}`, 
      borderRadius: 10, 
      padding: 12, 
      background: hasError ? "rgba(239, 68, 68, 0.05)" : hasWarning ? "rgba(245, 158, 11, 0.05)" : "rgba(255,255,255,0.02)" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div 
          style={{ fontSize: 12, opacity: 0.7, position: "relative", cursor: tooltip ? "help" : "default" }}
          onMouseEnter={() => tooltip && setShowLabelTooltip(true)}
          onMouseLeave={() => setShowLabelTooltip(false)}
        >
          {label}
          {tooltip && <span style={{ marginLeft: 4, opacity: 0.5 }}>ⓘ</span>}
          
          {/* Label tooltip */}
          {showLabelTooltip && tooltip && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 8,
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 11,
              lineHeight: 1.5,
              width: 220,
              zIndex: 100,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              color: "#ccc",
            }}>
              {tooltip}
            </div>
          )}
        </div>
        <div style={{ 
          fontSize: 13, 
          fontWeight: 600,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: hasError ? "#f87171" : hasWarning ? "#fbbf24" : "#3b82f6",
        }}>
          {(value * 100).toFixed(1)}%
        </div>
      </div>
      
      {/* Slider with reference markers */}
      <div style={{ position: "relative", marginTop: 12, marginBottom: 8 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ 
            width: "100%", 
            accentColor: hasError ? "#ef4444" : hasWarning ? "#f59e0b" : "#3b82f6", 
            cursor: "pointer" 
          }}
        />
        
        {/* Reference markers with tooltips */}
        {references.map((ref, i) => (
          <ReferenceMarker
            key={i}
            reference={ref}
            positionPct={positionPct(ref.value)}
            min={min}
            max={max}
          />
        ))}
      </div>

      {/* Min/Max labels */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        fontSize: 10, 
        opacity: 0.4,
        marginTop: 4,
      }}>
        <span>{(min * 100).toFixed(0)}%</span>
        <span>{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TORNADO CHART
// ═══════════════════════════════════════════════════════════════════════════════

function TornadoChart({ sensitivities, baseFV }: { sensitivities: SensitivityItem[]; baseFV: number }) {
  if (!sensitivities?.length) return null;

  const width = 500;
  const height = sensitivities.length * 44 + 40;
  const pad = { left: 120, right: 30, top: 25, bottom: 15 };
  const chartW = width - pad.left - pad.right;

  const allValues = sensitivities.flatMap(s => [s.fv_at_low, s.fv_at_high]);
  const minFV = Math.min(...allValues, baseFV);
  const maxFV = Math.max(...allValues, baseFV);
  const range = maxFV - minFV;
  const padding = range * 0.1;

  const xMin = minFV - padding;
  const xMax = maxFV + padding;

  const sx = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * chartW;
  const baseX = sx(baseFV);

  const barHeight = 24;
  const rowHeight = 44;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }}>
      <line x1={baseX} y1={pad.top - 10} x2={baseX} y2={height - pad.bottom} stroke="#666" strokeWidth="1" strokeDasharray="4,4" />
      <text x={baseX} y={pad.top - 15} fill="#888" fontSize="10" textAnchor="middle">Base: {fmtPx(baseFV)}</text>

      {sensitivities.map((item, i) => {
        const y = pad.top + i * rowHeight;
        const lowX = sx(item.fv_at_low);
        const highX = sx(item.fv_at_high);
        const lowIsBetter = item.param === "wacc" || item.param === "tax";
        
        return (
          <g key={item.param}>
            <text x={pad.left - 8} y={y + barHeight / 2 + 4} fill="#aaa" fontSize="11" textAnchor="end">{item.label}</text>

            {item.fv_at_low < baseFV ? (
              <rect x={lowX} y={y} width={baseX - lowX} height={barHeight} fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"} rx="4" />
            ) : (
              <rect x={baseX} y={y} width={lowX - baseX} height={barHeight} fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"} rx="4" />
            )}

            {item.fv_at_high > baseFV ? (
              <rect x={baseX} y={y} width={highX - baseX} height={barHeight} fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"} rx="4" />
            ) : (
              <rect x={highX} y={y} width={baseX - highX} height={barHeight} fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"} rx="4" />
            )}

            <text x={Math.min(lowX, highX) - 5} y={y + barHeight / 2 + 4} fill="#888" fontSize="9" textAnchor="end">{fmtPx(Math.min(item.fv_at_low, item.fv_at_high))}</text>
            <text x={Math.max(lowX, highX) + 5} y={y + barHeight / 2 + 4} fill="#888" fontSize="9" textAnchor="start">{fmtPx(Math.max(item.fv_at_low, item.fv_at_high))}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAIR VALUE RANGE BAR WITH ANALYST CONSENSUS
// ═══════════════════════════════════════════════════════════════════════════════

function FairValueRangeBar({
  low,
  mid,
  high,
  current,
  analystTarget,
  analystLow,
  analystHigh,
}: {
  low: number;
  mid: number;
  high: number;
  current: number | null;
  analystTarget: number | null;
  analystLow: number | null;
  analystHigh: number | null;
}) {
  const allValues = [low, mid, high, current, analystTarget, analystLow, analystHigh].filter(v => v !== null) as number[];
  const min = Math.min(...allValues) * 0.9;
  const max = Math.max(...allValues) * 1.1;
  
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ 
        position: "relative", 
        height: 60, 
        background: "linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(59,130,246,0.15) 50%, rgba(34,197,94,0.15) 100%)",
        borderRadius: 8,
      }}>
        {/* DCF Range bar */}
        <div style={{
          position: "absolute",
          left: `${pos(low)}%`,
          right: `${100 - pos(high)}%`,
          top: 20,
          height: 20,
          background: "linear-gradient(90deg, #ef4444 0%, #3b82f6 50%, #22c55e 100%)",
          borderRadius: 6,
          opacity: 0.8,
        }} />

        {/* Analyst range (if available) */}
        {analystLow && analystHigh && (
          <div style={{
            position: "absolute",
            left: `${pos(analystLow)}%`,
            right: `${100 - pos(analystHigh)}%`,
            top: 44,
            height: 8,
            background: "rgba(168, 85, 247, 0.6)",
            borderRadius: 4,
          }} />
        )}

        {/* Low marker */}
        <div style={{ position: "absolute", left: `${pos(low)}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ fontSize: 9, opacity: 0.6 }}>BEAR</div>
          <div style={{ width: 2, height: 40, background: "#ef4444", margin: "2px auto" }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "#ef4444" }}>{fmtPx(low)}</div>
        </div>

        {/* Mid marker */}
        <div style={{ position: "absolute", left: `${pos(mid)}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ fontSize: 9, opacity: 0.6 }}>BASE</div>
          <div style={{ width: 3, height: 40, background: "#3b82f6", margin: "2px auto" }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6" }}>{fmtPx(mid)}</div>
        </div>

        {/* High marker */}
        <div style={{ position: "absolute", left: `${pos(high)}%`, top: 0, transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ fontSize: 9, opacity: 0.6 }}>BULL</div>
          <div style={{ width: 2, height: 40, background: "#22c55e", margin: "2px auto" }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: "#22c55e" }}>{fmtPx(high)}</div>
        </div>

        {/* Current price marker */}
        {current && (
          <div style={{ position: "absolute", left: `${pos(current)}%`, top: -12, transform: "translateX(-50%)", textAlign: "center", zIndex: 10 }}>
            <div style={{ fontSize: 9, background: "#fff", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
              NOW: {fmtPx(current)}
            </div>
            <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #fff", margin: "0 auto" }} />
          </div>
        )}

        {/* Analyst target marker */}
        {analystTarget && (
          <div style={{ position: "absolute", left: `${pos(analystTarget)}%`, bottom: -8, transform: "translateX(-50%)", textAlign: "center", zIndex: 10 }}>
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid #a855f7", margin: "0 auto" }} />
            <div style={{ fontSize: 9, background: "#a855f7", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 600, marginTop: 2 }}>
              ST: {fmtPx(analystTarget)}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {analystTarget && (
        <div style={{ marginTop: 16, display: "flex", gap: 16, justifyContent: "center", fontSize: 10, opacity: 0.7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 4, background: "linear-gradient(90deg, #ef4444, #22c55e)", borderRadius: 2 }} />
            <span>Your DCF Range</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 4, background: "#a855f7", borderRadius: 2 }} />
            <span>Street Consensus</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLES TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function MultiplesTable({ multiples, currentPrice }: { multiples: ValuationBundle["multiples"]; currentPrice: number | null }) {
  if (!multiples?.implied_values?.length) {
    return <div style={{ opacity: 0.5, fontSize: 12 }}>No multiples data available</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Method</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Multiple</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Fair Value</th>
            {currentPrice && <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>vs Current</th>}
          </tr>
        </thead>
        <tbody>
          {multiples.implied_values.map((item, i) => {
            const upside = currentPrice ? (item.fair_value - currentPrice) / currentPrice : null;
            return (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "10px 0", fontWeight: 500 }}>{item.method}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{item.multiple.toFixed(1)}×</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>{fmtPx(item.fair_value)}</td>
                {currentPrice && upside !== null && (
                  <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600, color: upside >= 0 ? "#22c55e" : "#ef4444" }}>
                    {fmtPctSigned(upside)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {multiples.multiples_summary && (
        <div style={{ marginTop: 8, fontSize: 10, opacity: 0.5 }}>
          Sector multiples: {multiples.multiples_summary.sector} / {multiples.multiples_summary.industry}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DCFCard({ ticker }: { ticker: string }) {
  const [growth, setGrowth] = useState<number | null>(null);
  const [margin, setMargin] = useState<number | null>(null);
  const [tax, setTax] = useState<number | null>(null);
  const [wacc, setWacc] = useState<number | null>(null);
  const [terminalG, setTerminalG] = useState<number | null>(null);

  const [data, setData] = useState<ValuationBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState<"dcf" | "multiples" | "sensitivity">("dcf");

  // Initial load - let backend compute smart defaults
  useEffect(() => {
    if (!ticker) return;
    
    let mounted = true;
    async function loadInitial() {
      setLoading(true);
      setErr(null);
      setInitialized(false);
      try {
        const res = await fetch(`/api/v1/valuation/${encodeURIComponent(ticker)}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ValuationBundle;
        if (mounted) {
          setData(json);
          // Initialize sliders with smart defaults
          setGrowth(json.inputs.growth);
          setMargin(json.inputs.margin);
          setTax(json.inputs.tax);
          setWacc(json.inputs.wacc);
          setTerminalG(json.inputs.terminal_g);
          setInitialized(true);
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Failed to load valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitial();
    return () => { mounted = false; };
  }, [ticker]);

  // Subsequent updates when sliders change
  useEffect(() => {
    if (!ticker || !initialized || growth === null) return;
    
    let mounted = true;
    async function update() {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          growth: String(growth),
          margin: String(margin),
          tax: String(tax),
          wacc: String(wacc),
          terminal_g: String(terminalG),
        });
        const res = await fetch(`/api/v1/valuation/${encodeURIComponent(ticker)}?${q.toString()}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as ValuationBundle;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Failed to update valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    const timer = setTimeout(update, 300); // Debounce
    return () => { mounted = false; clearTimeout(timer); };
  }, [ticker, growth, margin, tax, wacc, terminalG, initialized]);

  // Build slider references from smart defaults
  const sliderRefs = useMemo(() => {
    if (!data?.smart_defaults) return {};
    const sd = data.smart_defaults;
    
    return {
      growth: [
        sd.growth.historical_3y != null && { value: sd.growth.historical_3y, label: "3Y hist", color: "#60a5fa" },
        sd.growth.analyst_estimate != null && { value: sd.growth.analyst_estimate, label: "Analyst", color: "#a855f7" },
        { value: sd.growth.sector_median, label: "Sector", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      margin: [
        sd.margin.current != null && { value: sd.margin.current, label: "Current", color: "#60a5fa" },
        sd.margin.historical_avg != null && { value: sd.margin.historical_avg, label: "Avg", color: "#888" },
        { value: sd.margin.sector_median, label: "Sector", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      wacc: [
        sd.wacc.beta_implied != null && { value: sd.wacc.beta_implied, label: `CAPM (β=${sd.wacc.beta?.toFixed(1)})`, color: "#60a5fa" },
      ].filter(Boolean) as SliderReference[],
      tax: [
        sd.tax.effective_rate != null && { value: sd.tax.effective_rate, label: "Effective", color: "#60a5fa" },
        { value: 0.21, label: "US Corp", color: "#888" },
      ].filter(Boolean) as SliderReference[],
      terminal_g: [
        { value: 0.025, label: "GDP", color: "#888" },
      ] as SliderReference[],
    };
  }, [data?.smart_defaults]);

  // Group warnings by param
  const warningsByParam = useMemo(() => {
    if (!data?.warnings) return {};
    const map: Record<string, Warning[]> = {};
    for (const w of data.warnings) {
      if (!map[w.param]) map[w.param] = [];
      map[w.param].push(w as Warning);
    }
    return map;
  }, [data?.warnings]);

  const upside = data?.upside_downside;
  const fvRange = data?.fair_value_range;
  const analyst = data?.analyst_consensus;

  if (!initialized && !loading && !err) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: 40, textAlign: "center", opacity: 0.5 }}>
        Loading valuation model...
      </div>
    );
  }

  return (
    <div style={{ 
      background: "linear-gradient(145deg, #1a1a1a 0%, #141414 100%)", 
      border: "1px solid #2a2a2a", 
      borderRadius: 14, 
      padding: 20,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>Valuation Engine</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            {data?.benchmarks?.sector && <span>{data.benchmarks.sector} • </span>}
            DCF + Multiples + Sensitivity
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>DCF Fair Value</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 2, letterSpacing: "-1px" }}>
            {data?.fair_value_per_share_est ? fmtPx(data.fair_value_per_share_est) : "—"}
          </div>
          {upside && (
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: upside.upside_pct >= 0 ? "#22c55e" : "#ef4444" }}>
              {fmtPctSigned(upside.upside_pct)} vs {fmtPx(upside.current_price)}
            </div>
          )}
        </div>
      </div>

      {/* Analyst consensus badge */}
      {analyst?.target_mean && (
        <div style={{ 
          marginTop: 12, 
          padding: "8px 12px", 
          background: "rgba(168, 85, 247, 0.1)", 
          border: "1px solid rgba(168, 85, 247, 0.25)", 
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
        }}>
          <div>
            <span style={{ opacity: 0.7 }}>Street Consensus: </span>
            <span style={{ fontWeight: 600, color: "#a855f7" }}>{fmtPx(analyst.target_mean)}</span>
            {analyst.target_low && analyst.target_high && (
              <span style={{ opacity: 0.5, marginLeft: 8 }}>
                ({fmtPx(analyst.target_low)} – {fmtPx(analyst.target_high)})
              </span>
            )}
          </div>
          <div style={{ opacity: 0.7 }}>
            {analyst.num_analysts} analysts • {analyst.recommendation?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.1)" }}>
          <b>Error:</b> {err}
        </div>
      )}

      {loading && <div style={{ marginTop: 14, opacity: 0.6, fontSize: 13 }}>Recomputing…</div>}

      {!loading && data?.error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.1)" }}>
          <b>Valuation unavailable:</b> {data.error}
        </div>
      )}

      {/* Warnings */}
      {data?.warnings && data.warnings.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {data.warnings.filter(w => w.severity === "error" || w.severity === "warning").map((w, i) => (
            <WarningBadge key={i} warning={w as Warning} />
          ))}
        </div>
      )}

      {/* Fair Value Range */}
      {!loading && fvRange && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 4 }}>
            Fair Value Range (Bear → Bull)
          </div>
          <FairValueRangeBar
            low={fvRange.low}
            mid={fvRange.mid}
            high={fvRange.high}
            current={data?.facts?.current_price ?? null}
            analystTarget={analyst?.target_mean ?? null}
            analystLow={analyst?.target_low ?? null}
            analystHigh={analyst?.target_high ?? null}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginTop: 16, borderBottom: "1px solid #2a2a2a" }}>
        {(["dcf", "multiples", "sensitivity"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? "#2a2a2a" : "transparent",
              color: activeTab === tab ? "#fff" : "#888",
              border: "none",
              borderRadius: "8px 8px 0 0",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {tab === "dcf" ? "DCF Model" : tab === "multiples" ? "Multiples" : "Sensitivity"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: 16 }}>
        {activeTab === "dcf" && initialized && growth !== null && (
          <>
            {/* Sliders with references */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <SliderWithReferences
                label="Revenue Growth (5y CAGR)"
                value={growth}
                setValue={setGrowth}
                min={-0.10}
                max={0.50}
                step={0.01}
                references={sliderRefs.growth || []}
                paramWarnings={warningsByParam.growth || []}
                tooltip="Expected compound annual growth rate over next 5 years. High-growth tech: 15-30%. Mature companies: 3-8%. Hover over markers to see historical and analyst estimates."
              />
              <SliderWithReferences
                label="Operating Margin"
                value={margin!}
                setValue={setMargin}
                min={-0.10}
                max={0.50}
                step={0.01}
                references={sliderRefs.margin || []}
                paramWarnings={warningsByParam.margin || []}
                tooltip="Operating income as % of revenue. Software: 25-40%. Retail: 3-8%. Manufacturing: 10-15%. Expanding margins significantly is rare without structural changes."
              />
              <SliderWithReferences
                label="Tax Rate"
                value={tax!}
                setValue={setTax}
                min={0.10}
                max={0.35}
                step={0.01}
                references={sliderRefs.tax || []}
                paramWarnings={warningsByParam.tax || []}
                tooltip="Effective corporate tax rate. US statutory is 21%. International operations may lower this. Check the company's historical effective rate."
              />
              <SliderWithReferences
                label="WACC (Discount Rate)"
                value={wacc!}
                setValue={setWacc}
                min={0.05}
                max={0.20}
                step={0.005}
                references={sliderRefs.wacc || []}
                paramWarnings={warningsByParam.wacc || []}
                tooltip="Weighted average cost of capital. Lower = less risky = higher valuation. Large-cap stable: 7-9%. Growth stocks: 10-12%. Speculative: 12%+. CAPM estimate uses the stock's beta."
              />
              <SliderWithReferences
                label="Terminal Growth"
                value={terminalG!}
                setValue={setTerminalG}
                min={0.00}
                max={0.04}
                step={0.005}
                references={sliderRefs.terminal_g || []}
                paramWarnings={warningsByParam.terminal_g || []}
                tooltip="Perpetual growth rate after forecast period. Should not exceed long-run GDP growth (~2-3%). Higher values assume company grows faster than the economy forever."
              />
            </div>

            {/* Smart defaults source info */}
            {data?.smart_defaults && (
              <div style={{ marginTop: 12, padding: 10, background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 8, fontSize: 11, opacity: 0.8 }}>
                <span style={{ fontWeight: 600 }}>Defaults: </span>
                Growth from {data.smart_defaults.growth.source} • 
                Margin from {data.smart_defaults.margin.source} • 
                WACC from {data.smart_defaults.wacc.source}
              </div>
            )}

            {/* DCF Metrics */}
            {!loading && data && !data.error && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <Metric 
                  label="Revenue (LTM)" 
                  value={fmtMoney(data.facts.revenue0)} 
                  tooltip="Last twelve months revenue from the most recent annual filing. This is the starting point for projecting future cash flows."
                />
                <Metric 
                  label="EBITDA" 
                  value={fmtMoney(data.facts.ebitda)} 
                  tooltip="Earnings Before Interest, Taxes, Depreciation & Amortization. Proxy for operating cash flow before capex. Used for EV/EBITDA multiple."
                />
                <Metric 
                  label="Net Debt" 
                  value={fmtMoney(data.facts.net_debt_est)} 
                  tooltip="Total debt minus cash & equivalents. Subtracted from enterprise value to get equity value. Negative = net cash position."
                />
                <Metric 
                  label="Enterprise Value" 
                  value={fmtMoney(data.dcf.enterprise_value)} 
                  hint={`Terminal: ${fmtPct(data.dcf.terminal_pct_of_ev)} of EV`}
                  tooltip="Present value of projected free cash flows + terminal value. High terminal % (>70%) means valuation relies heavily on distant future growth."
                />
              </div>
            )}

            {/* Scenarios */}
            {!loading && data?.scenarios && !("error" in data.scenarios) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 8 }}>
                  Scenario Analysis
                  <span style={{ marginLeft: 6, opacity: 0.7, textTransform: "none", letterSpacing: "normal" }}>
                    (hover for details)
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {(["bear", "base", "bull"] as const).map(scenario => {
                    const s = data.scenarios[scenario];
                    const color = scenario === "bear" ? "#ef4444" : scenario === "bull" ? "#22c55e" : "#3b82f6";
                    const currentPrice = data.facts.current_price;
                    const upsidePct = currentPrice ? (s.fair_value_per_share - currentPrice) / currentPrice : null;
                    
                    const scenarioDescriptions = {
                      bear: "Conservative case: Lower growth, compressed margins, higher discount rate. What if things go wrong?",
                      base: "Base case: Your current assumptions. Most likely outcome given inputs.",
                      bull: "Optimistic case: Higher growth, margin expansion, lower risk. What if everything goes right?",
                    };
                    
                    return (
                      <ScenarioCard
                        key={scenario}
                        scenario={scenario}
                        fairValue={s.fair_value_per_share}
                        upsidePct={upsidePct}
                        inputs={s.inputs}
                        color={color}
                        description={scenarioDescriptions[scenario]}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "multiples" && (
          <div>
            {data?.multiples ? (
              <MultiplesTable multiples={data.multiples} currentPrice={data.facts.current_price} />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 12 }}>Loading multiples…</div>
            )}
          </div>
        )}

        {activeTab === "sensitivity" && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Impact of ±3% change in each input on fair value</div>
            {data?.sensitivity?.sensitivities ? (
              <TornadoChart sensitivities={data.sensitivity.sensitivities} baseFV={data.sensitivity.base_fair_value} />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 12 }}>Loading sensitivity…</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, fontSize: 10, opacity: 0.4, textAlign: "center" }}>
        Educational model • Simplified FCFF proxy • Sector multiples are approximations
      </div>
    </div>
  );
}