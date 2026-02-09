import { api } from "../lib/api";
import { useState, useEffect } from "react";
import type { PredictionResponse, PredictionSignal } from "../lib/types";
import { InfoTip } from "./common/InfoTip";
import { PREDICTION_TIPS } from "../lib/tooltips";

interface PredictionCardProps {
  ticker: string;
  initialData?: PredictionResponse | null;
}

function InfoButton({ term }: { term: string }) {
  const explanation = PREDICTION_TIPS[term];
  if (!explanation) return null;
  return <InfoTip text={explanation} />;
}


function SectionHeader({ title, term }: { title: string; term?: string }) {
  return (
    <div style={{
      fontSize: 11,
      opacity: 0.6,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      display: "flex",
      alignItems: "center"
    }}>
      {title}
      {term && <InfoButton term={term} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const SIGNAL_COLORS: Record<PredictionSignal, { bg: string; border: string; text: string }> = {
  BULLISH: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.3)", text: "#22c55e" },
  BEARISH: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", text: "#ef4444" },
  NEUTRAL: { bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.3)", text: "#94a3b8" },
};

const SIGNAL_ICONS: Record<PredictionSignal, string> = {
  BULLISH: "▲",
  BEARISH: "▼",
  NEUTRAL: "—",
};


// ═══════════════════════════════════════════════════════════════════════════════
// PROBABILITY GAUGE
// ═══════════════════════════════════════════════════════════════════════════════

function ProbabilityGauge({ probabilityUp, signal }: { probabilityUp: number; signal: PredictionSignal }) {
  const colors = SIGNAL_COLORS[signal];
  const pct = probabilityUp; // 0-100

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.5, marginBottom: 4 }}>
        <span>BEARISH 0%</span>
        <span>50%</span>
        <span>100% BULLISH</span>
      </div>
      {/* Gauge track */}
      <div style={{
        position: "relative",
        height: 8,
        background: "rgba(255,255,255,0.1)",
        borderRadius: 4,
        overflow: "hidden",
      }}>
        {/* Neutral zone (42-58%) */}
        <div style={{
          position: "absolute",
          left: "42%",
          width: "16%",
          height: "100%",
          background: "rgba(148, 163, 184, 0.15)",
        }} />
        {/* Fill */}
        <div style={{
          position: "absolute",
          left: 0,
          width: `${pct}%`,
          height: "100%",
          background: colors.text,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }} />
      </div>
      {/* Marker */}
      <div style={{
        position: "relative",
        height: 12,
      }}>
        <div style={{
          position: "absolute",
          left: `${pct}%`,
          transform: "translateX(-50%)",
          width: 2,
          height: 8,
          background: colors.text,
          borderRadius: 1,
        }} />
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PredictionCard({ ticker, initialData }: PredictionCardProps) {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData !== undefined && initialData !== null) {
      setPrediction(initialData);
    }
  }, [initialData]);

  async function handlePredict() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.prediction(ticker);
      setPrediction(result);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate prediction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center" }}>
          ML Direction Forecast
          <InfoButton term="backtest" />
        </h3>
        <button
          onClick={handlePredict}
          disabled={loading}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            cursor: loading ? "wait" : "pointer",
            background: prediction ? "#22c55e" : "#f59e0b",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <span>🤖</span>
          {loading ? "Training Model..." : prediction ? "Re-run Model" : "Run ML Prediction"}
        </button>
      </div>

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          color: "#ef4444"
        }}>
          {error}
        </div>
      )}

      {!prediction && !loading && !error && (
        <div style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.6 }}>
          Train a <strong>Gradient Boosting Classifier</strong> on 5 years of historical data with {19} technical features.
          Predicts <strong>5-day direction</strong> with calibrated probabilities. Includes confidence gating (NEUTRAL when uncertain),
          purged walk-forward validation, bootstrap CIs, and factor attribution.
        </div>
      )}

      {prediction && <PredictionDisplay prediction={prediction} />}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTION DISPLAY (broken out for readability)
// ═══════════════════════════════════════════════════════════════════════════════

function PredictionDisplay({ prediction }: { prediction: PredictionResponse }) {
  const p = prediction.prediction;
  const m = prediction.model_metrics;
  const bt = prediction.backtest;
  const q = prediction.model_quality;
  const signal = p.signal as PredictionSignal;
  const colors = SIGNAL_COLORS[signal];

  return (
    <div>
      {/* ── Auto-Suppression Banner ────────────────────────────────────── */}
      {q.suppressed && (
        <div style={{
          background: q.grade === "no_signal"
            ? "rgba(239, 68, 68, 0.12)"
            : "rgba(245, 158, 11, 0.12)",
          border: `1px solid ${q.grade === "no_signal" ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)"}`,
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 600,
            color: q.grade === "no_signal" ? "#ef4444" : "#f59e0b",
          }}>
            {q.grade === "no_signal" ? "⚠ No Detectable Edge" : "⚠ Weak Signal"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6, marginBottom: 8 }}>
            {q.message}
          </div>
          {q.failures.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.7 }}>
              {q.failures.map((f, i) => (
                <div key={i} style={{ fontFamily: "monospace" }}>• {f}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Redeemed Banner (marginal — has issues but shows real signal) ── */}
      {q.redeemed && !q.suppressed && (
        <div style={{
          background: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 600,
            color: "#3b82f6",
          }}>
            Marginal Signal — Use With Caution
          </div>
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6, marginBottom: 8 }}>
            {q.message}
          </div>
          {q.failures.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.7, marginBottom: 6 }}>
              <div style={{ marginBottom: 2, fontWeight: 500 }}>Issues detected:</div>
              {q.failures.map((f, i) => (
                <div key={i} style={{ fontFamily: "monospace" }}>• {f}</div>
              ))}
            </div>
          )}
          {q.redemption_reasons.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.7 }}>
              <div style={{ marginBottom: 2, fontWeight: 500, color: "#22c55e" }}>But the model shows real signal:</div>
              {q.redemption_reasons.map((r, i) => (
                <div key={i} style={{ fontFamily: "monospace", color: "#22c55e" }}>+ {r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Signal + Probability Gauge ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}>
        {/* Signal Box */}
        <div style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: 16,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {p.horizon_days}-Day Forecast
            <InfoButton term="signal" />
          </div>
          {/* Big signal display */}
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.text,
          }}>
            {SIGNAL_ICONS[signal]} {signal}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            marginTop: 4,
            fontFamily: "monospace",
            color: colors.text,
          }}>
            {p.probability_up}% UP
          </div>

          {/* Probability Gauge */}
          <ProbabilityGauge probabilityUp={p.probability_up} signal={signal} />

          {/* Predicted return (secondary, smaller) */}
          <div style={{
            fontSize: 11,
            marginTop: 8,
            opacity: 0.6,
            fontFamily: "monospace",
          }}>
            Magnitude est: {p.predicted_return > 0 ? "+" : ""}{p.predicted_return}%
            &nbsp;(${p.current_price} → ${p.predicted_price})
          </div>
        </div>

        {/* Backtest Summary */}
        <div style={{
          background: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: 8,
          padding: 16,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            Strategy Backtest
            <InfoButton term="backtest" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {bt.sharpe_ratio}
            <InfoButton term="sharpe_ratio" />
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Sharpe Ratio</div>
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginTop: 12,
            fontSize: 13,
          }}>
            <span style={{ color: bt.total_return > 0 ? "#22c55e" : "#ef4444" }}>
              Return: {bt.total_return > 0 ? "+" : ""}{bt.total_return}%
            </span>
            <span style={{ color: "#ef4444", display: "flex", alignItems: "center" }}>
              Max DD: {bt.max_drawdown}%
              <InfoButton term="max_drawdown" />
            </span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
            Selectivity: {bt.selectivity_pct}% of days traded
          </div>
        </div>
      </div>

      {/* ── Direction Accuracy vs Baseline ─────────────────────────────── */}
      <div style={{
        background: m.accuracy_vs_baseline > 0
          ? "rgba(34, 197, 94, 0.08)"
          : m.accuracy_vs_baseline < 0
            ? "rgba(239, 68, 68, 0.08)"
            : "rgba(255,255,255,0.02)",
        border: `1px solid ${m.accuracy_vs_baseline > 0 ? "rgba(34, 197, 94, 0.2)" : m.accuracy_vs_baseline < 0 ? "rgba(239, 68, 68, 0.2)" : "#333"}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}>
        <SectionHeader title="Direction Accuracy vs Baseline" term="accuracy_vs_baseline" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
              Model <InfoButton term="direction_accuracy" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
              {m.direction_accuracy}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
              Baseline (Always UP) <InfoButton term="baseline_accuracy" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", opacity: 0.5 }}>
              {m.baseline_accuracy}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5 }}>Edge vs Baseline</div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "monospace",
              color: m.accuracy_vs_baseline > 0 ? "#22c55e" : m.accuracy_vs_baseline < 0 ? "#ef4444" : "inherit",
            }}>
              {m.accuracy_vs_baseline > 0 ? "+" : ""}{m.accuracy_vs_baseline}%
            </div>
          </div>
          {m.gated_accuracy != null && (
            <div>
              <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
                Gated Only ({m.gated_trades}/{m.gated_total}) <InfoButton term="gated_accuracy" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "#3b82f6" }}>
                {m.gated_accuracy}%
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
              Info Coefficient <InfoButton term="information_coefficient" />
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "monospace",
              color: m.information_coefficient > 0.05 ? "#22c55e" : m.information_coefficient > 0 ? "#f59e0b" : "#ef4444",
            }}>
              {m.information_coefficient.toFixed(4)}
            </div>
          </div>
        </div>
        {/* Bootstrap CI */}
        {prediction.bootstrap_ci && (
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, display: "flex", alignItems: "center" }}>
            95% CI: [{prediction.bootstrap_ci.ci_95_low}%, {prediction.bootstrap_ci.ci_95_high}%]
            <InfoButton term="bootstrap_ci" />
          </div>
        )}
      </div>

      {/* ── Walk-Forward Validation ────────────────────────────────────── */}
      {prediction.walk_forward?.summary && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <SectionHeader title={`Purged Walk-Forward (${prediction.walk_forward.summary.purge_window}d purge)`} term="walk_forward" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 8 }}>
            <MetricRow label="Avg Direction Acc" value={`${prediction.walk_forward.summary.direction_accuracy_mean}%`} term="direction_accuracy" />
            <MetricRow label="Avg Baseline" value={`${prediction.walk_forward.summary.baseline_accuracy_mean}%`} term="baseline_accuracy" />
            <MetricRow
              label="Avg Edge"
              value={`${prediction.walk_forward.summary.accuracy_vs_baseline_mean > 0 ? "+" : ""}${prediction.walk_forward.summary.accuracy_vs_baseline_mean}%`}
              highlight={prediction.walk_forward.summary.accuracy_vs_baseline_mean > 0}
              negative={prediction.walk_forward.summary.accuracy_vs_baseline_mean < 0}
            />
            <MetricRow label="Avg Sharpe" value={`${prediction.walk_forward.summary.sharpe_mean} ± ${prediction.walk_forward.summary.sharpe_std}`} term="sharpe_ratio" />
            <MetricRow label="Positive Sharpe Folds" value={`${prediction.walk_forward.summary.positive_sharpe_pct}%`} />
          </div>
          {/* Per-fold detail */}
          {prediction.walk_forward.folds.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
              {prediction.walk_forward.folds.map((f) => (
                <div key={f.fold} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontFamily: "monospace" }}>
                  <span>Fold {f.fold} ({f.test_start})</span>
                  <span>
                    Dir {f.direction_accuracy}%
                    {f.accuracy_vs_baseline > 0 ? ` (+${f.accuracy_vs_baseline}%)` : ` (${f.accuracy_vs_baseline}%)`}
                    {" | "}Sharpe {f.sharpe}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detailed Metrics Grid ──────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}>
        {/* Backtest Results */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
          <SectionHeader title="Backtest Results" term="backtest" />
          <MetricRow label="Annual Return" value={`${bt.annual_return}%`} highlight={bt.annual_return > 0} term="annual_return" />
          <MetricRow label="Annual Volatility" value={`${bt.annual_volatility}%`} term="annual_volatility" />
          <MetricRow label="Calmar Ratio" value={bt.calmar_ratio} term="calmar_ratio" />
          <MetricRow label="Win Rate" value={`${bt.win_rate}%`} term="win_rate" />
          <MetricRow label="Trades" value={bt.num_trades} />
        </div>

        {/* vs Buy & Hold */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
          <SectionHeader title="vs Buy & Hold" />
          <MetricRow label="Strategy Sharpe" value={bt.sharpe_ratio} term="sharpe_ratio" />
          <MetricRow label="B&H Sharpe" value={bt.buy_hold_sharpe} term="buy_hold_sharpe" />
          <MetricRow label="B&H Return" value={`${bt.buy_hold_return}%`} term="buy_hold_return" />
          <MetricRow label="B&H Calmar" value={bt.buy_hold_calmar} term="calmar_ratio" />
          <MetricRow
            label="Alpha"
            value={`${bt.strategy_vs_buyhold > 0 ? "+" : ""}${bt.strategy_vs_buyhold}%`}
            highlight={bt.strategy_vs_buyhold > 0}
            negative={bt.strategy_vs_buyhold < 0}
            term="alpha"
          />
        </div>

        {/* Model Info */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
          <SectionHeader title="Model Performance" />
          <MetricRow label="Test R²" value={m.test_r2} term="r_squared" />
          <MetricRow label="Train R²" value={m.train_r2} term="r_squared" />
          <MetricRow label="Overfit Gap" value={`${(m.train_r2 - m.test_r2).toFixed(4)}`} />
          <MetricRow label="Training Samples" value={m.training_samples} />
          <MetricRow label="Model" value={m.model_type.replace("GradientBoosting", "GBM ")} />
        </div>
      </div>

      {/* ── Factor Attribution ─────────────────────────────────────────── */}
      {prediction.factor_attribution && !prediction.factor_attribution.error && prediction.factor_attribution.alpha_annualized != null && (
        <div style={{
          background: "rgba(168, 85, 247, 0.08)",
          border: "1px solid rgba(168, 85, 247, 0.2)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <SectionHeader title="Factor Attribution (Alpha vs Beta)" term="factor_attribution" />
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 8,
          }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
                Annualized Alpha <InfoButton term="factor_alpha" />
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "monospace",
                color: prediction.factor_attribution.alpha_annualized > 0 ? "#22c55e" : "#ef4444",
              }}>
                {prediction.factor_attribution.alpha_annualized > 0 ? "+" : ""}{prediction.factor_attribution.alpha_annualized}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
                Market Beta <InfoButton term="factor_beta" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                {prediction.factor_attribution.beta}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, opacity: 0.5 }}>Regression R²</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                {prediction.factor_attribution.r_squared}
              </div>
            </div>
          </div>
          {prediction.factor_attribution.interpretation && (
            <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.6 }}>
              {prediction.factor_attribution.interpretation}
            </div>
          )}
        </div>
      )}

      {/* ── Feature Importance & Technical Indicators ──────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginBottom: 16,
      }}>
        {/* Top Features */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
          <SectionHeader title="Top Features (Importance)" term="feature_importance" />
          {prediction.top_features.map((f, i) => (
            <div key={`${f.feature}-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ opacity: 0.8 }}>{f.feature}</span>
                <span style={{ fontFamily: "monospace" }}>{f.importance}%</span>
              </div>
              <div style={{
                height: 4,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${f.importance * 3}%`,
                  height: "100%",
                  background: "#3b82f6",
                  borderRadius: 2,
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Technical Indicators */}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
          <SectionHeader title="Current Technical Indicators" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Indicator
              label="RSI (14)"
              value={prediction.technical_indicators.rsi_14}
              color={prediction.technical_indicators.rsi_14 > 70 ? "#ef4444" : prediction.technical_indicators.rsi_14 < 30 ? "#22c55e" : undefined}
              term="rsi"
            />
            <Indicator
              label="Trend"
              value={prediction.technical_indicators.trend}
              color={prediction.technical_indicators.trend === "BULLISH" ? "#22c55e" : "#ef4444"}
              term="trend"
            />
            <Indicator
              label="MACD"
              value={prediction.technical_indicators.macd.toFixed(4)}
              term="macd"
            />
            <Indicator
              label="Volatility (20d)"
              value={`${prediction.technical_indicators.volatility_20d}%`}
              term="volatility"
            />
            <Indicator
              label="BB Position"
              value={prediction.technical_indicators.bb_position.toFixed(2)}
              color={prediction.technical_indicators.bb_position > 1 ? "#ef4444" : prediction.technical_indicators.bb_position < -1 ? "#22c55e" : undefined}
              term="bb_position"
            />
            <Indicator
              label="Vol Regime"
              value={`${prediction.technical_indicators.vol_regime.toFixed(2)}x`}
              color={prediction.technical_indicators.vol_regime > 1.3 ? "#ef4444" : prediction.technical_indicators.vol_regime < 0.7 ? "#22c55e" : undefined}
              term="vol_regime"
            />
            <Indicator
              label="MA10 Ratio"
              value={`${prediction.technical_indicators.ma_10_ratio > 0 ? "+" : ""}${prediction.technical_indicators.ma_10_ratio}%`}
              color={prediction.technical_indicators.ma_10_ratio > 0 ? "#22c55e" : "#ef4444"}
              term="ma_ratio"
            />
            <Indicator
              label="Volume Ratio"
              value={`${prediction.technical_indicators.volume_ratio}x`}
              term="volume_ratio"
            />
          </div>
        </div>
      </div>

      {/* ── Model Health ───────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}>
        <SectionHeader title="Model Health" term="model_health" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <MetricRow label="Horizon" value={prediction.model_health.horizon} />
          <MetricRow label="Training Period" value={prediction.model_health.training_period} />
          <MetricRow label="Training Days" value={prediction.model_health.training_days} />
          <MetricRow
            label="Vol Regime"
            value={prediction.model_health.vol_regime}
            highlight={prediction.model_health.vol_regime === "Low Volatility"}
            negative={prediction.model_health.vol_regime === "High Volatility"}
          />
          <MetricRow label="Features Used" value={prediction.model_health.n_features} />
        </div>
      </div>

      {/* ── Cumulative Returns Chart ───────────────────────────────────── */}
      {bt.cumulative_returns && bt.cumulative_returns.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <SectionHeader title="Cumulative Returns (Test Period)" term="backtest" />
          <CumulativeReturnsChart data={bt.cumulative_returns} />
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 11,
        opacity: 0.5,
        padding: 8,
        background: "rgba(255,255,255,0.02)",
        borderRadius: 4,
        textAlign: "center",
        lineHeight: 1.6,
      }}>
        {prediction.model_health.disclaimer}
        {" "}Confidence-gated: model sits flat when probability is between {p.confidence_thresholds.bearish_below}%–{p.confidence_thresholds.bullish_above}%.
        {" "}Backtest uses weekly rebalancing with transaction costs. Not financial advice.
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function MetricRow({ label, value, highlight, negative, term }: {
  label: string;
  value: any;
  highlight?: boolean;
  negative?: boolean;
  term?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
      <span style={{ opacity: 0.7, display: "flex", alignItems: "center" }}>
        {label}
        {term && <InfoButton term={term} />}
      </span>
      <span style={{
        fontFamily: "monospace",
        fontWeight: 500,
        color: highlight ? "#22c55e" : negative ? "#ef4444" : "inherit",
      }}>
        {value}
      </span>
    </div>
  );
}

function Indicator({ label, value, color, term }: {
  label: string;
  value: any;
  color?: string;
  term?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, opacity: 0.5, display: "flex", alignItems: "center" }}>
        {label}
        {term && <InfoButton term={term} />}
      </div>
      <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 500, color }}>{value}</div>
    </div>
  );
}

function CumulativeReturnsChart({ data }: { data: Array<{ date: string; strategy: number; buyHold: number }> }) {
  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (!data || data.length === 0) {
    return <svg width="100%" height={height}><text x="50%" y="50%" fill="#666" textAnchor="middle">No data</text></svg>;
  }

  const allValues = data.flatMap(d => [d.strategy, d.buyHold]);
  const minVal = (allValues.length > 0 ? Math.min(...allValues) : 0) * 0.99;
  const maxVal = (allValues.length > 0 ? Math.max(...allValues) : 1) * 1.01;
  const yRange = maxVal - minVal || 1;

  const xScale = (i: number) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
  const yScale = (val: number) => padding.top + chartHeight - ((val - minVal) / yRange) * chartHeight;

  const strategyPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.strategy)}`).join(' ');
  const buyHoldPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.buyHold)}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <line x1={padding.left} y1={yScale(1)} x2={width - padding.right} y2={yScale(1)} stroke="#333" strokeDasharray="4" />
      <path d={buyHoldPath} fill="none" stroke="#666" strokeWidth={1.5} />
      <path d={strategyPath} fill="none" stroke="#3b82f6" strokeWidth={2} />
      <line x1={padding.left} y1={height - 5} x2={padding.left + 20} y2={height - 5} stroke="#3b82f6" strokeWidth={2} />
      <text x={padding.left + 25} y={height - 2} fill="#888" fontSize={10}>Strategy</text>
      <line x1={padding.left + 80} y1={height - 5} x2={padding.left + 100} y2={height - 5} stroke="#666" strokeWidth={1.5} />
      <text x={padding.left + 105} y={height - 2} fill="#888" fontSize={10}>Buy & Hold</text>
      <text x={padding.left - 5} y={padding.top + 5} fill="#666" fontSize={10} textAnchor="end">
        {(maxVal).toFixed(2)}
      </text>
      <text x={padding.left - 5} y={height - padding.bottom} fill="#666" fontSize={10} textAnchor="end">
        {(minVal).toFixed(2)}
      </text>
    </svg>
  );
}
