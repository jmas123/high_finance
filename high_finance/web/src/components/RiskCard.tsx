import { useEffect, useMemo, useState, useCallback } from "react";
import type { RiskBundle } from "../lib/types";

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtPct(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtPctSigned(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const val = x * 100;
  return val >= 0 ? `+${val.toFixed(digits)}%` : `${val.toFixed(digits)}%`;
}

function fmtMoney(x: number | null | undefined) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  if (Math.abs(x) >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (Math.abs(x) >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPrice(x: number | null | undefined) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "red" | "blue" | "amber";
}) {
  const accentColors = {
    green: "rgba(34, 197, 94, 0.15)",
    red: "rgba(239, 68, 68, 0.15)",
    blue: "rgba(59, 130, 246, 0.15)",
    amber: "rgba(245, 158, 11, 0.15)",
  };
  const borderColors = {
    green: "rgba(34, 197, 94, 0.3)",
    red: "rgba(239, 68, 68, 0.3)",
    blue: "rgba(59, 130, 246, 0.3)",
    amber: "rgba(245, 158, 11, 0.3)",
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${accent ? borderColors[accent] : "#2a2a2a"}`,
        background: accent ? accentColors[accent] : "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.6,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
}

function ProbabilityBar({
  label,
  probability,
  color = "#3b82f6",
}: {
  label: string;
  probability: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, probability)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        <span style={{ opacity: 0.8 }}>{label}</span>
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 600,
          }}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function ScenarioCard({
  label,
  returnPct,
  priceTarget,
  color,
}: {
  label: string;
  returnPct: number;
  priceTarget: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${color}33`,
        background: `${color}11`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.6,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: returnPct >= 0 ? "#22c55e" : "#ef4444",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {fmtPctSigned(returnPct)}
      </div>
      <div
        style={{
          fontSize: 12,
          opacity: 0.6,
          marginTop: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {fmtPrice(priceTarget)}
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  setValue,
  min,
  max,
  step,
  format = "pct",
  suffix = "",
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format?: "pct" | "days" | "number" | "multiplier";
  suffix?: string;
}) {
  const displayValue = () => {
    switch (format) {
      case "pct":
        return `${(value * 100).toFixed(0)}%`;
      case "days":
        return `${value}d`;
      case "multiplier":
        return `${value.toFixed(1)}×`;
      default:
        return `${value}${suffix}`;
    }
  };

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#3b82f6",
          }}
        >
          {displayValue()}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{
          width: "100%",
          marginTop: 10,
          accentColor: "#3b82f6",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function ToggleControl({
  label,
  value,
  setValue,
  hint,
}: {
  label: string;
  value: boolean;
  setValue: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <button
        onClick={() => setValue(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          background: value ? "#3b82f6" : "#333",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s ease",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: "#fff",
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            transition: "left 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTION HISTOGRAM
// ═══════════════════════════════════════════════════════════════════════════════

function DistributionChart({
  distribution,
  currentPrice,
}: {
  distribution: Array<{
    return_min: number;
    return_max: number;
    probability: number;
  }>;
  currentPrice: number;
}) {
  if (!distribution?.length) return null;

  const maxProb = Math.max(...distribution.map((d) => d.probability));
  const width = 900;
  const height = 140;
  const pad = { left: 40, right: 20, top: 15, bottom: 25 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const barWidth = chartW / distribution.length - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: 140, display: "block" }}
    >
      {/* Y-axis labels */}
      <text x={pad.left - 8} y={pad.top + 5} fill="#666" fontSize="9" textAnchor="end">
        {(maxProb * 100).toFixed(0)}%
      </text>
      <text x={pad.left - 8} y={height - pad.bottom} fill="#666" fontSize="9" textAnchor="end">
        0%
      </text>

      {/* Zero line */}
      <line
        x1={pad.left}
        y1={height - pad.bottom}
        x2={width - pad.right}
        y2={height - pad.bottom}
        stroke="#333"
        strokeWidth="1"
      />

      {/* Bars */}
      {distribution.map((bin, i) => {
        const x = pad.left + i * (chartW / distribution.length) + 1;
        const barH = (bin.probability / maxProb) * chartH;
        const midReturn = (bin.return_min + bin.return_max) / 2;
        const isNegative = midReturn < 0;

        return (
          <rect
            key={i}
            x={x}
            y={pad.top + chartH - barH}
            width={barWidth}
            height={barH}
            fill={isNegative ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)"}
            rx="2"
          />
        );
      })}

      {/* X-axis labels */}
      {distribution
        .filter((_, i) => i % 5 === 0 || i === distribution.length - 1)
        .map((bin, idx, arr) => {
          const originalIdx = distribution.indexOf(bin);
          const x = pad.left + originalIdx * (chartW / distribution.length) + barWidth / 2;
          return (
            <text
              key={idx}
              x={x}
              y={height - 5}
              fill="#666"
              fontSize="9"
              textAnchor="middle"
            >
              {bin.return_min.toFixed(0)}%
            </text>
          );
        })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAN CHART
// ═══════════════════════════════════════════════════════════════════════════════

function FanChart({
  fan,
  s0,
  horizonDays,
}: {
  fan: Array<{
    day: number;
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  }>;
  s0: number;
  horizonDays: number;
}) {
  if (!fan?.length) return null;

  const width = 900;
  const height = 200;
  const pad = { left: 50, right: 20, top: 15, bottom: 30 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const xs = fan.map((d) => d.day);
  const ys = fan.flatMap((d) => [d.p5, d.p95]);

  const xMin = 0;
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.98;
  const yMax = Math.max(...ys) * 1.02;

  const sx = (x: number) => pad.left + (x / xMax) * chartW;
  const sy = (y: number) => pad.top + (1 - (y - yMin) / (yMax - yMin)) * chartH;

  const bandPath = (upper: keyof (typeof fan)[0], lower: keyof (typeof fan)[0]) => {
    const top = fan
      .map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.day).toFixed(1)} ${sy(d[upper] as number).toFixed(1)}`)
      .join(" ");
    const bot = fan
      .slice()
      .reverse()
      .map((d) => `L ${sx(d.day).toFixed(1)} ${sy(d[lower] as number).toFixed(1)}`)
      .join(" ");
    return `${top} ${bot} Z`;
  };

  const linePath = (key: keyof (typeof fan)[0]) =>
    fan
      .map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.day).toFixed(1)} ${sy(d[key] as number).toFixed(1)}`)
      .join(" ");

  // Grid lines
  const yTicks = 5;
  const yStep = (yMax - yMin) / yTicks;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 200, display: "block" }}>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = yMin + i * yStep;
        return (
          <g key={i}>
            <line
              x1={pad.left}
              y1={sy(y)}
              x2={width - pad.right}
              y2={sy(y)}
              stroke="#222"
              strokeWidth="1"
            />
            <text x={pad.left - 8} y={sy(y) + 3} fill="#555" fontSize="9" textAnchor="end">
              {fmtPrice(y)}
            </text>
          </g>
        );
      })}

      {/* Starting price line */}
      <line
        x1={pad.left}
        y1={sy(s0)}
        x2={width - pad.right}
        y2={sy(s0)}
        stroke="#666"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Bands */}
      <path d={bandPath("p95", "p5")} fill="rgba(59, 130, 246, 0.08)" />
      <path d={bandPath("p90", "p10")} fill="rgba(59, 130, 246, 0.12)" />
      <path d={bandPath("p75", "p25")} fill="rgba(59, 130, 246, 0.18)" />

      {/* Lines */}
      <path d={linePath("p50")} fill="none" stroke="rgba(59, 130, 246, 0.95)" strokeWidth="2.5" />
      <path d={linePath("p90")} fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />
      <path d={linePath("p10")} fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />

      {/* X-axis labels */}
      {[0, Math.floor(horizonDays / 4), Math.floor(horizonDays / 2), Math.floor((3 * horizonDays) / 4), horizonDays].map(
        (day, i) => (
          <text
            key={i}
            x={sx(day)}
            y={height - 8}
            fill="#555"
            fontSize="9"
            textAnchor="middle"
          >
            {day}d
          </text>
        )
      )}

      {/* Legend */}
      <g transform={`translate(${width - 120}, ${pad.top + 10})`}>
        <rect x="0" y="0" width="10" height="10" fill="rgba(59, 130, 246, 0.95)" rx="2" />
        <text x="14" y="9" fill="#888" fontSize="9">Median (p50)</text>
        <rect x="0" y="16" width="10" height="10" fill="rgba(59, 130, 246, 0.18)" rx="2" />
        <text x="14" y="25" fill="#888" fontSize="9">p25-p75</text>
        <rect x="0" y="32" width="10" height="10" fill="rgba(59, 130, 246, 0.08)" rx="2" />
        <text x="14" y="41" fill="#888" fontSize="9">p5-p95</text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function RiskCard({ ticker }: { ticker: string }) {
  // Controls
  const [period, setPeriod] = useState<"6mo" | "1y" | "2y">("1y");
  const [horizon, setHorizon] = useState<number>(60);
  const [sims, setSims] = useState<number>(500);
  const [volMultiplier, setVolMultiplier] = useState<number>(1.0);
  const [includeEarningsShock, setIncludeEarningsShock] = useState<boolean>(false);
  const [targetPriceOffset, setTargetPriceOffset] = useState<number>(0.1); // +10% default
  const [drawdownThreshold, setDrawdownThreshold] = useState<number>(-0.15);

  // Data
  const [data, setData] = useState<RiskBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Expanded sections
  const [showControls, setShowControls] = useState(false);

  const fetchRisk = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const targetPrice = data?.as_of_close
        ? data.as_of_close * (1 + targetPriceOffset)
        : undefined;

      const q = new URLSearchParams({
        period,
        horizon_days: String(horizon),
        n_sims: String(sims),
        vol_multiplier: String(volMultiplier),
        include_earnings_shock: String(includeEarningsShock),
        drawdown_threshold: String(drawdownThreshold),
      });

      if (targetPrice) {
        q.set("target_price", String(targetPrice));
      }

      const res = await fetch(`/api/v1/risk/${encodeURIComponent(ticker)}?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as RiskBundle;
      setData(json);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load risk");
    } finally {
      setLoading(false);
    }
  }, [ticker, period, horizon, sims, volMultiplier, includeEarningsShock, drawdownThreshold, targetPriceOffset, data?.as_of_close]);

  useEffect(() => {
    if (ticker) fetchRisk();
  }, [ticker, period, horizon, sims, volMultiplier, includeEarningsShock, drawdownThreshold]);

  const m = data?.metrics;
  const p = data?.probabilities;
  const s = data?.scenarios;

  return (
    <div
      style={{
        background: "linear-gradient(145deg, #1a1a1a 0%, #141414 100%)",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: 20,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px" }}>
            Risk & Probability Analysis
          </div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.5 }}>
            Monte Carlo simulation with actionable probability estimates
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            style={{
              background: "#0a0a0a",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="6mo">6M data</option>
            <option value="1y">1Y data</option>
            <option value="2y">2Y data</option>
          </select>

          <button
            onClick={() => setShowControls(!showControls)}
            style={{
              background: showControls ? "#3b82f6" : "#0a0a0a",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⚙</span>
            <span>Controls</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.1)",
            marginBottom: 16,
          }}
        >
          <b>Error:</b> {err}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
          Running {sims} simulations over {horizon} days...
        </div>
      )}

      {/* Controls Panel */}
      {showControls && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #2a2a2a",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              opacity: 0.5,
              marginBottom: 12,
            }}
          >
            Simulation Parameters
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            <SliderControl
              label="Time Horizon"
              value={horizon}
              setValue={setHorizon}
              min={10}
              max={180}
              step={5}
              format="days"
            />
            <SliderControl
              label="Vol Multiplier"
              value={volMultiplier}
              setValue={setVolMultiplier}
              min={0.5}
              max={2.0}
              step={0.1}
              format="multiplier"
            />
            <SliderControl
              label="Target Price"
              value={targetPriceOffset}
              setValue={setTargetPriceOffset}
              min={-0.2}
              max={0.5}
              step={0.05}
              format="pct"
            />
            <SliderControl
              label="Drawdown Alert"
              value={Math.abs(drawdownThreshold)}
              setValue={(v) => setDrawdownThreshold(-v)}
              min={0.05}
              max={0.4}
              step={0.05}
              format="pct"
            />
            <ToggleControl
              label="Earnings Shock"
              value={includeEarningsShock}
              setValue={setIncludeEarningsShock}
              hint="Inject historical earnings volatility"
            />
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #2a2a2a",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>Simulations</div>
              <select
                value={sims}
                onChange={(e) => setSims(Number(e.target.value))}
                style={{
                  width: "100%",
                  marginTop: 8,
                  background: "#0a0a0a",
                  color: "#fff",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12,
                  outline: "none",
                }}
              >
                <option value={200}>200 (fast)</option>
                <option value={500}>500 (balanced)</option>
                <option value={1000}>1,000 (precise)</option>
                <option value={2000}>2,000 (high fidelity)</option>
              </select>
            </div>
          </div>

          {/* Earnings shock info */}
          {includeEarningsShock && data?.monte_carlo?.earnings_params && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 600 }}>Earnings volatility detected:</span>{" "}
              Avg move {(data.monte_carlo.earnings_params.avg_earnings_move * 100).toFixed(1)}%,
              max {(data.monte_carlo.earnings_params.max_earnings_move * 100).toFixed(1)}%
              (n={data.monte_carlo.earnings_params.n_observations})
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {!loading && !!m && !!p && !!s && (
        <>
          {/* Scenario Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <ScenarioCard
              label="Stress (p5)"
              returnPct={s.stress_p5}
              priceTarget={data.as_of_close * (1 + s.stress_p5)}
              color="#ef4444"
            />
            <ScenarioCard
              label="Bear (p10)"
              returnPct={s.stress_p10}
              priceTarget={data.as_of_close * (1 + s.stress_p10)}
              color="#f97316"
            />
            <ScenarioCard
              label="Base (p50)"
              returnPct={s.base_p50}
              priceTarget={data.as_of_close * (1 + s.base_p50)}
              color="#3b82f6"
            />
            <ScenarioCard
              label="Bull (p90)"
              returnPct={s.bull_p90}
              priceTarget={data.as_of_close * (1 + s.bull_p90)}
              color="#22c55e"
            />
            <ScenarioCard
              label="Extreme (p95)"
              returnPct={s.bull_p95}
              priceTarget={data.as_of_close * (1 + s.bull_p95)}
              color="#10b981"
            />
          </div>

          {/* Probability Section */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* Upside Probabilities */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: "rgba(34, 197, 94, 0.03)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: 0.6,
                  marginBottom: 14,
                  color: "#22c55e",
                }}
              >
                Upside Probability ({horizon}d)
              </div>
              <ProbabilityBar
                label="Positive return"
                probability={p.prob_positive_return}
                color="#22c55e"
              />
              <ProbabilityBar
                label="Return > +5%"
                probability={p.prob_above_5pct}
                color="#22c55e"
              />
              <ProbabilityBar
                label="Return > +10%"
                probability={p.prob_above_10pct}
                color="#22c55e"
              />
              <ProbabilityBar
                label="Return > +20%"
                probability={p.prob_above_20pct}
                color="#16a34a"
              />
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #2a2a2a",
                }}
              >
                <ProbabilityBar
                  label={`Target: ${fmtPrice(p.target_price_used)}`}
                  probability={p.prob_above_target}
                  color="#3b82f6"
                />
              </div>
            </div>

            {/* Downside Probabilities */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: "rgba(239, 68, 68, 0.03)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: 0.6,
                  marginBottom: 14,
                  color: "#ef4444",
                }}
              >
                Downside Risk ({horizon}d)
              </div>
              <ProbabilityBar
                label="Return < -5%"
                probability={p.prob_below_minus_5pct}
                color="#ef4444"
              />
              <ProbabilityBar
                label="Return < -10%"
                probability={p.prob_below_minus_10pct}
                color="#ef4444"
              />
              <ProbabilityBar
                label="Return < -20%"
                probability={p.prob_below_minus_20pct}
                color="#dc2626"
              />
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #2a2a2a",
                }}
              >
                <ProbabilityBar
                  label={`Drawdown > ${(Math.abs(drawdownThreshold) * 100).toFixed(0)}%`}
                  probability={p.prob_drawdown_exceeds_threshold}
                  color="#f97316"
                />
              </div>
            </div>
          </div>

          {/* Historical Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <Stat label="VaR (95%, 1D)" value={fmtPct(m.var_95_1d, 2)} hint="Daily left tail" />
            <Stat label="VaR (99%, 1D)" value={fmtPct(m.var_99_1d, 2)} hint="Extreme tail" />
            <Stat label="Max Drawdown" value={fmtPct(m.max_drawdown, 1)} accent="red" />
            <Stat label="Daily Vol" value={fmtPct(m.daily_volatility, 2)} />
            <Stat
              label="Ann. Vol"
              value={fmtPct(m.annualized_volatility_adjusted, 1)}
              hint={volMultiplier !== 1 ? `${volMultiplier}× adjusted` : "σ × √252"}
              accent={volMultiplier > 1.2 ? "amber" : undefined}
            />
            <Stat label="Current Price" value={fmtPrice(data.as_of_close)} hint={ticker} />
          </div>

          {/* Fan Chart */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid #2a2a2a",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>Price Distribution Fan</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {sims.toLocaleString()} simulations • {horizon}d horizon
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <FanChart
                fan={data.monte_carlo.fan}
                s0={data.as_of_close}
                horizonDays={horizon}
              />
            </div>
          </div>

          {/* Return Distribution Histogram */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #2a2a2a",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid #2a2a2a",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>Terminal Return Distribution</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                Expected: {fmtPctSigned(s.mean)} ± {fmtPct(s.std)}
              </div>
            </div>
            <div style={{ padding: 12 }}>
              <DistributionChart
                distribution={data.distribution}
                currentPrice={data.as_of_close}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div
            style={{
              marginTop: 14,
              fontSize: 10,
              opacity: 0.4,
              textAlign: "center",
            }}
          >
            Educational model only • Past performance ≠ future results • Not financial advice
          </div>
        </>
      )}
    </div>
  );
}