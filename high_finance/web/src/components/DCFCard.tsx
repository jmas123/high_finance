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
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Metric({ label, value, hint, accent }: { 
  label: string; 
  value: string; 
  hint?: string;
  accent?: "green" | "red" | "blue";
}) {
  const colors = {
    green: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.25)" },
    red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.25)" },
    blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.25)" },
  };
  const style = accent ? colors[accent] : { bg: "rgba(255,255,255,0.02)", border: "#2a2a2a" };

  return (
    <div style={{ 
      padding: 14, 
      borderRadius: 10, 
      border: `1px solid ${style.border}`, 
      background: style.bg 
    }}>
      <div style={{ 
        fontSize: 10, 
        opacity: 0.6, 
        marginBottom: 6, 
        textTransform: "uppercase", 
        letterSpacing: "0.5px",
        fontWeight: 500,
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 18, 
        fontWeight: 700, 
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" 
      }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  setValue,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div style={{ 
      border: "1px solid #2a2a2a", 
      borderRadius: 10, 
      padding: 12, 
      background: "rgba(255,255,255,0.02)" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        <div style={{ 
          fontSize: 12, 
          fontWeight: 600,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: "#3b82f6",
        }}>
          {(value * 100).toFixed(1)}%
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: "100%", marginTop: 10, accentColor: "#3b82f6", cursor: "pointer" }}
      />
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        fontSize: 10, 
        opacity: 0.4, 
        marginTop: 6 
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

function TornadoChart({ 
  sensitivities, 
  baseFV 
}: { 
  sensitivities: SensitivityItem[]; 
  baseFV: number;
}) {
  if (!sensitivities?.length) return null;

  const width = 500;
  const height = sensitivities.length * 44 + 40;
  const pad = { left: 120, right: 30, top: 25, bottom: 15 };
  const chartW = width - pad.left - pad.right;

  // Find the range
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
      {/* Base line */}
      <line 
        x1={baseX} 
        y1={pad.top - 10} 
        x2={baseX} 
        y2={height - pad.bottom} 
        stroke="#666" 
        strokeWidth="1" 
        strokeDasharray="4,4"
      />
      
      {/* Base label */}
      <text 
        x={baseX} 
        y={pad.top - 15} 
        fill="#888" 
        fontSize="10" 
        textAnchor="middle"
      >
        Base: {fmtPx(baseFV)}
      </text>

      {sensitivities.map((item, i) => {
        const y = pad.top + i * rowHeight;
        const lowX = sx(item.fv_at_low);
        const highX = sx(item.fv_at_high);
        
        // Determine which side is "bad" (red) and "good" (green)
        // For most params, higher FV is better, but for WACC/Tax it's inverted
        const lowIsBetter = item.param === "wacc" || item.param === "tax";
        
        return (
          <g key={item.param}>
            {/* Label */}
            <text 
              x={pad.left - 8} 
              y={y + barHeight / 2 + 4} 
              fill="#aaa" 
              fontSize="11" 
              textAnchor="end"
            >
              {item.label}
            </text>

            {/* Low bar (left of base or right, depending on value) */}
            {item.fv_at_low < baseFV ? (
              <rect
                x={lowX}
                y={y}
                width={baseX - lowX}
                height={barHeight}
                fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"}
                rx="4"
              />
            ) : (
              <rect
                x={baseX}
                y={y}
                width={lowX - baseX}
                height={barHeight}
                fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"}
                rx="4"
              />
            )}

            {/* High bar */}
            {item.fv_at_high > baseFV ? (
              <rect
                x={baseX}
                y={y}
                width={highX - baseX}
                height={barHeight}
                fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"}
                rx="4"
              />
            ) : (
              <rect
                x={highX}
                y={y}
                width={baseX - highX}
                height={barHeight}
                fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"}
                rx="4"
              />
            )}

            {/* Value labels */}
            <text
              x={Math.min(lowX, highX) - 5}
              y={y + barHeight / 2 + 4}
              fill="#888"
              fontSize="9"
              textAnchor="end"
            >
              {fmtPx(Math.min(item.fv_at_low, item.fv_at_high))}
            </text>
            <text
              x={Math.max(lowX, highX) + 5}
              y={y + barHeight / 2 + 4}
              fill="#888"
              fontSize="9"
              textAnchor="start"
            >
              {fmtPx(Math.max(item.fv_at_low, item.fv_at_high))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAIR VALUE RANGE BAR
// ═══════════════════════════════════════════════════════════════════════════════

function FairValueRangeBar({
  low,
  mid,
  high,
  current,
}: {
  low: number;
  mid: number;
  high: number;
  current: number | null;
}) {
  const width = 100; // percentage-based
  const allValues = [low, mid, high, current].filter(v => v !== null) as number[];
  const min = Math.min(...allValues) * 0.9;
  const max = Math.max(...allValues) * 1.1;
  
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ 
        position: "relative", 
        height: 40, 
        background: "linear-gradient(90deg, rgba(239,68,68,0.2) 0%, rgba(59,130,246,0.2) 50%, rgba(34,197,94,0.2) 100%)",
        borderRadius: 8,
      }}>
        {/* Range bar */}
        <div style={{
          position: "absolute",
          left: `${pos(low)}%`,
          right: `${100 - pos(high)}%`,
          top: 12,
          height: 16,
          background: "linear-gradient(90deg, #ef4444 0%, #3b82f6 50%, #22c55e 100%)",
          borderRadius: 8,
          opacity: 0.8,
        }} />

        {/* Low marker */}
        <div style={{
          position: "absolute",
          left: `${pos(low)}%`,
          top: 0,
          transform: "translateX(-50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 2 }}>BEAR</div>
          <div style={{ 
            width: 2, 
            height: 40, 
            background: "#ef4444",
            margin: "0 auto",
          }} />
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "#ef4444" }}>
            {fmtPx(low)}
          </div>
        </div>

        {/* Mid marker */}
        <div style={{
          position: "absolute",
          left: `${pos(mid)}%`,
          top: 0,
          transform: "translateX(-50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 2 }}>BASE</div>
          <div style={{ 
            width: 3, 
            height: 40, 
            background: "#3b82f6",
            margin: "0 auto",
          }} />
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "#3b82f6" }}>
            {fmtPx(mid)}
          </div>
        </div>

        {/* High marker */}
        <div style={{
          position: "absolute",
          left: `${pos(high)}%`,
          top: 0,
          transform: "translateX(-50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 9, opacity: 0.6, marginBottom: 2 }}>BULL</div>
          <div style={{ 
            width: 2, 
            height: 40, 
            background: "#22c55e",
            margin: "0 auto",
          }} />
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: "#22c55e" }}>
            {fmtPx(high)}
          </div>
        </div>

        {/* Current price marker */}
        {current && (
          <div style={{
            position: "absolute",
            left: `${pos(current)}%`,
            top: -8,
            transform: "translateX(-50%)",
            textAlign: "center",
            zIndex: 10,
          }}>
            <div style={{ 
              fontSize: 9, 
              background: "#fff", 
              color: "#000",
              padding: "2px 6px",
              borderRadius: 4,
              fontWeight: 600,
            }}>
              NOW: {fmtPx(current)}
            </div>
            <div style={{ 
              width: 0, 
              height: 0, 
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #fff",
              margin: "0 auto",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLES TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function MultiplesTable({ 
  multiples,
  currentPrice,
}: { 
  multiples: ValuationBundle["multiples"];
  currentPrice: number | null;
}) {
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
            {currentPrice && (
              <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>vs Current</th>
            )}
          </tr>
        </thead>
        <tbody>
          {multiples.implied_values.map((item, i) => {
            const upside = currentPrice ? (item.fair_value - currentPrice) / currentPrice : null;
            return (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "10px 0", fontWeight: 500 }}>{item.method}</td>
                <td style={{ 
                  padding: "10px 0", 
                  textAlign: "right",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}>
                  {item.multiple.toFixed(1)}×
                </td>
                <td style={{ 
                  padding: "10px 0", 
                  textAlign: "right",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontWeight: 600,
                }}>
                  {fmtPx(item.fair_value)}
                </td>
                {currentPrice && upside !== null && (
                  <td style={{ 
                    padding: "10px 0", 
                    textAlign: "right",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontWeight: 600,
                    color: upside >= 0 ? "#22c55e" : "#ef4444",
                  }}>
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
  const [growth, setGrowth] = useState(0.10);
  const [margin, setMargin] = useState(0.20);
  const [tax, setTax] = useState(0.21);
  const [wacc, setWacc] = useState(0.10);
  const [terminalG, setTerminalG] = useState(0.03);

  const [data, setData] = useState<ValuationBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"dcf" | "multiples" | "sensitivity">("dcf");

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr(null);
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
        if (mounted) setErr(e?.message ?? "Failed to load valuation");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (ticker) run();
    return () => { mounted = false; };
  }, [ticker, growth, margin, tax, wacc, terminalG]);

  const upside = data?.upside_downside;
  const fvRange = data?.fair_value_range;

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
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>
            Valuation Engine
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            DCF + Multiples + Sensitivity Analysis
          </div>
        </div>

        {/* Headline fair value & upside */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            DCF Fair Value
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 2, letterSpacing: "-1px" }}>
            {data?.fair_value_per_share_est ? fmtPx(data.fair_value_per_share_est) : "—"}
          </div>
          {upside && (
            <div style={{ 
              marginTop: 4,
              fontSize: 14,
              fontWeight: 700,
              color: upside.upside_pct >= 0 ? "#22c55e" : "#ef4444",
            }}>
              {fmtPctSigned(upside.upside_pct)} vs ${upside.current_price.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {err && (
        <div style={{ 
          marginTop: 14, 
          padding: 12, 
          borderRadius: 10, 
          border: "1px solid rgba(239, 68, 68, 0.3)", 
          background: "rgba(239, 68, 68, 0.1)" 
        }}>
          <b>Error:</b> {err}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 14, opacity: 0.6, fontSize: 13 }}>Recomputing…</div>
      )}

      {!loading && data?.error && (
        <div style={{ 
          marginTop: 14, 
          padding: 12, 
          borderRadius: 10, 
          border: "1px solid rgba(239, 68, 68, 0.3)", 
          background: "rgba(239, 68, 68, 0.1)" 
        }}>
          <b>Valuation unavailable:</b> {data.error}
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
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: "flex", 
        gap: 4, 
        marginTop: 16,
        borderBottom: "1px solid #2a2a2a",
        paddingBottom: 0,
      }}>
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
        {activeTab === "dcf" && (
          <>
            {/* Sliders */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <SliderRow label="Revenue Growth (5y CAGR)" value={growth} setValue={setGrowth} min={-0.10} max={0.50} step={0.01} />
              <SliderRow label="Operating Margin" value={margin} setValue={setMargin} min={-0.10} max={0.50} step={0.01} />
              <SliderRow label="Tax Rate" value={tax} setValue={setTax} min={0.10} max={0.35} step={0.01} />
              <SliderRow label="WACC (Discount Rate)" value={wacc} setValue={setWacc} min={0.05} max={0.20} step={0.005} />
              <SliderRow label="Terminal Growth" value={terminalG} setValue={setTerminalG} min={0.00} max={0.04} step={0.005} />
            </div>

            {/* DCF Metrics */}
            {!loading && data && !data.error && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <Metric label="Revenue (LTM)" value={fmtMoney(data.facts.revenue0)} />
                <Metric label="EBITDA" value={fmtMoney(data.facts.ebitda)} />
                <Metric label="Net Debt" value={fmtMoney(data.facts.net_debt_est)} />
                <Metric 
                  label="Enterprise Value" 
                  value={fmtMoney(data.dcf.enterprise_value)} 
                  hint={`Terminal: ${fmtPct(data.dcf.terminal_pct_of_ev)} of EV`}
                />
              </div>
            )}

            {/* Scenario Cards */}
            {!loading && data?.scenarios && !("error" in data.scenarios) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.5, marginBottom: 8 }}>
                  Scenario Analysis
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {(["bear", "base", "bull"] as const).map(scenario => {
                    const s = data.scenarios[scenario];
                    const color = scenario === "bear" ? "#ef4444" : scenario === "bull" ? "#22c55e" : "#3b82f6";
                    const currentPrice = data.facts.current_price;
                    const upside = currentPrice ? (s.fair_value_per_share - currentPrice) / currentPrice : null;
                    
                    return (
                      <div key={scenario} style={{
                        padding: 14,
                        borderRadius: 10,
                        border: `1px solid ${color}33`,
                        background: `${color}11`,
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.6, letterSpacing: "0.5px" }}>
                          {scenario}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color }}>
                          {fmtPx(s.fair_value_per_share)}
                        </div>
                        {upside !== null && (
                          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                            {fmtPctSigned(upside)} vs current
                          </div>
                        )}
                        <div style={{ fontSize: 9, marginTop: 6, opacity: 0.5 }}>
                          g: {fmtPct(s.inputs.growth, 0)} · m: {fmtPct(s.inputs.margin, 0)} · wacc: {fmtPct(s.inputs.wacc, 0)}
                        </div>
                      </div>
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
              <MultiplesTable 
                multiples={data.multiples} 
                currentPrice={data.facts.current_price}
              />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 12 }}>Loading multiples…</div>
            )}
          </div>
        )}

        {activeTab === "sensitivity" && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>
              Impact of ±3% change in each input on fair value
            </div>
            {data?.sensitivity?.sensitivities ? (
              <TornadoChart 
                sensitivities={data.sensitivity.sensitivities}
                baseFV={data.sensitivity.base_fair_value}
              />
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