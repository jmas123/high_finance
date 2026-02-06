import { useEffect, useState, useCallback } from "react";
import type { RiskBundle } from "../../lib/types";
import { FanChart } from "./FanChart";
import { DistributionChart } from "./DistributionChart";
import { Stat } from "./StatAndProbability";
import { ProbabilityBar } from "./StatAndProbability";
import { SliderControl } from "./SliderAndToggle";
import { ToggleControl } from "./SliderAndToggle";
import { ScenarioCard } from "./RiskScenario";
import { fmtPct, fmtPctSigned, fmtPrice } from "../Functions";


interface RiskCardProps {
  ticker: string;
  initialData?: RiskBundle | null;
}

export function RiskCard({ ticker, initialData }: RiskCardProps) {
  // Controls
  const [period, setPeriod] = useState<"6mo" | "1y" | "2y">("1y");
  const [horizon, setHorizon] = useState<number>(60);
  const [sims, setSims] = useState<number>(500);
  const [volMultiplier, setVolMultiplier] = useState<number>(1.0);
  const [includeEarningsShock, setIncludeEarningsShock] = useState<boolean>(false);
  const [targetPriceOffset, setTargetPriceOffset] = useState<number>(0.1); // +10% default
  const [drawdownThreshold, setDrawdownThreshold] = useState<number>(-0.15);

  // Data - use initial data from bundle if provided
  const [data, setData] = useState<RiskBundle | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Track if params have changed from defaults (then we need to fetch)
  const [paramsChanged, setParamsChanged] = useState(false);

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
    // Use initial data from bundle on first load if available and params haven't changed
    if (initialData !== undefined && !paramsChanged) {
      setData(initialData);
      return;
    }
    // Otherwise fetch with current params
    if (ticker) fetchRisk();
  }, [ticker, period, horizon, sims, volMultiplier, includeEarningsShock, drawdownThreshold, targetPriceOffset, initialData, paramsChanged]);

  // Track when params change from defaults
  useEffect(() => {
    const isDefault = period === "1y" && horizon === 60 && sims === 500 &&
                      volMultiplier === 1.0 && !includeEarningsShock &&
                      targetPriceOffset === 0.1 && drawdownThreshold === -0.15;
    setParamsChanged(!isDefault);
  }, [period, horizon, sims, volMultiplier, includeEarningsShock, targetPriceOffset, drawdownThreshold]);

  const m = data?.metrics;
  const p = data?.probabilities;
  const s = data?.scenarios;
  const closePrice = data?.as_of_close ?? 0;

  // Safe price target calculation (guards against null/undefined close price)
  const calcPriceTarget = (returnPct: number) => closePrice > 0 ? closePrice * (1 + returnPct) : 0;

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
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <ScenarioCard
              label="Stress (p5)"
              returnPct={s.stress_p5}
              priceTarget={calcPriceTarget(s.stress_p5)}
              color="#ef4444"
            />
            <ScenarioCard
              label="Bear (p10)"
              returnPct={s.stress_p10}
              priceTarget={calcPriceTarget(s.stress_p10)}
              color="#f97316"
            />
            <ScenarioCard
              label="Base (p50)"
              returnPct={s.base_p50}
              priceTarget={calcPriceTarget(s.base_p50)}
              color="#3b82f6"
            />
            <ScenarioCard
              label="Bull (p90)"
              returnPct={s.bull_p90}
              priceTarget={calcPriceTarget(s.bull_p90)}
              color="#22c55e"
            />
            <ScenarioCard
              label="Extreme (p95)"
              returnPct={s.bull_p95}
              priceTarget={calcPriceTarget(s.bull_p95)}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
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
            <Stat label="Current Price" value={fmtPrice(closePrice)} hint={ticker} />
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
                s0={closePrice}
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
                currentPrice={closePrice}
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