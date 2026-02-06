import { api } from "../lib/api";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
interface PredictionCardProps {
  ticker: string;
  initialData?: any | null;
}



// Explanations for all terms
const EXPLANATIONS: Record<string, string> = {
  // Model metrics
  direction_accuracy: "Percentage of times the model correctly predicted whether the stock would go up or down. >55% is considered good for financial markets.",
  r_squared: "R² measures how well the model explains variance in returns. 0 = no predictive power, 1 = perfect prediction. In finance, even 0.01-0.05 can be meaningful.",
  mse: "Mean Squared Error - average of squared prediction errors. Lower is better. Hard to interpret alone; compare across models.",
  training_samples: "Number of historical data points used to train the model. More data generally improves reliability.",
  
  // Backtest metrics
  sharpe_ratio: "Risk-adjusted return = (Return - Risk Free Rate) / Volatility. >1 is good, >2 is very good, >3 is excellent. Measures return per unit of risk.",
  annual_return: "Strategy's projected yearly return based on backtest performance. Assumes similar market conditions continue.",
  annual_volatility: "Standard deviation of returns annualized. Higher = more risk. Compare to S&P 500's ~15-20% historical volatility.",
  max_drawdown: "Largest peak-to-trough decline during the backtest. -10% means at worst you'd be down 10% from your high point.",
  win_rate: "Percentage of trades that were profitable. >50% needed for profit, but depends on avg win vs avg loss size.",
  num_trades: "Total position changes in backtest. More trades = more transaction costs. Too few = may not be statistically significant.",
  
  // Buy & Hold comparison
  buy_hold_sharpe: "Sharpe ratio if you simply bought and held the stock. Compare to strategy Sharpe to see if active trading adds value.",
  buy_hold_return: "Total return from buying at start of test period and holding. Benchmark for any active strategy.",
  alpha: "Excess return vs buy-and-hold. Positive alpha = strategy beat passive investing. This is what active managers try to generate.",
  
  // Technical indicators
  rsi: "Relative Strength Index (0-100). >70 = overbought (may fall), <30 = oversold (may rise). Measures momentum.",
  macd: "Moving Average Convergence Divergence. Positive = bullish momentum, Negative = bearish. Crossovers signal trend changes.",
  trend: "Based on 50-day vs 200-day moving average. Bullish = 50 > 200 (golden cross). Bearish = 50 < 200 (death cross).",
  volatility: "20-day rolling standard deviation of returns. Higher volatility = bigger price swings = more risk.",
  ma_ratio: "Current price relative to moving average. Positive = trading above average (bullish), Negative = below (bearish).",
  volume_ratio: "Current volume vs 20-day average. >1 = higher than normal activity, often confirms price moves.",
  
  // Features
  feature_importance: "How much each input contributes to predictions. Higher % = model relies more on this indicator. Helps understand what drives predictions.",
  
  // Sections
  backtest: "Simulates how the strategy would have performed historically. Includes transaction costs. Past performance ≠ future results.",
  prediction: "Model's forecast for next trading day. Based on current technical indicators and learned patterns from 5 years of data.",
  confidence: "Based on predicted return magnitude. HIGH = |return| > 0.5%, MEDIUM = > 0.1%, LOW = smaller moves are harder to predict.",
};


function InfoButton({ term }: { term: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const explanation = EXPLANATIONS[term];
  
  useEffect(() => {
    if (show && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    }
  }, [show]);
  
  if (!explanation) return null;
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setShow(!show)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid #555",
          background: show ? "#3b82f6" : "#333",
          color: show ? "#fff" : "#999",
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 6,
          padding: 0,
          transition: "all 0.15s ease",
        }}
      >
        ?
      </button>
      {show && createPortal(
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
            }}
            onClick={() => setShow(false)}
          />
          {/* Tooltip */}
          <div style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            transform: "translate(-50%, -100%)",
            width: 300,
            padding: 14,
            background: "#0a0a0a",
            border: "2px solid #3b82f6",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#ffffff",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,1)",
            textAlign: "left",
          }}>
            {explanation}
            {/* Arrow */}
            <div style={{
              position: "absolute",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 12,
              height: 12,
              background: "#0a0a0a",
              borderRight: "2px solid #3b82f6",
              borderBottom: "2px solid #3b82f6",
            }} />
          </div>
        </>,
        document.body
      )}
    </>
  );
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

export function PredictionCard({ ticker, initialData }: PredictionCardProps) {
  const [prediction, setPrediction] = useState<any | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with initialData from bundle when it arrives
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
          ML Return Prediction & Backtesting
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
          Train a <strong>Random Forest Regression</strong> model on 5 years of historical data with 15+ technical indicators.
          Includes backtesting with Sharpe ratio, drawdown analysis, and buy-and-hold comparison.
        </div>
      )}

      {prediction && (
        <div>
          {/* Main Prediction */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16
          }}>
            {/* Prediction Box */}
            <div style={{
              background: prediction.prediction.direction === "UP"
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${prediction.prediction.direction === "UP" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              borderRadius: 8,
              padding: 16,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Next Day Prediction
                <InfoButton term="prediction" />
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: prediction.prediction.direction === "UP" ? "#22c55e" : "#ef4444"
              }}>
                {prediction.prediction.direction === "UP" ? "▲" : "▼"} {prediction.prediction.predicted_return > 0 ? "+" : ""}{prediction.prediction.predicted_return}%
              </div>
              <div style={{ fontSize: 14, marginTop: 8, opacity: 0.8 }}>
                ${prediction.prediction.current_price} → ${prediction.prediction.predicted_price}
              </div>
              <div style={{
                fontSize: 12,
                marginTop: 8,
                padding: "4px 8px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center"
              }}>
                Confidence: {prediction.prediction.confidence}
                <InfoButton term="confidence" />
              </div>
            </div>

            {/* Backtest Summary */}
            <div style={{
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 8,
              padding: 16,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Strategy Backtest
                <InfoButton term="backtest" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {prediction.backtest.sharpe_ratio}
                <InfoButton term="sharpe_ratio" />
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Sharpe Ratio</div>
              <div style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginTop: 12,
                fontSize: 13
              }}>
                <span style={{ color: prediction.backtest.total_return > 0 ? "#22c55e" : "#ef4444" }}>
                  Return: {prediction.backtest.total_return > 0 ? "+" : ""}{prediction.backtest.total_return}%
                </span>
                <span style={{ color: "#ef4444", display: "flex", alignItems: "center" }}>
                  Max DD: {prediction.backtest.max_drawdown}%
                  <InfoButton term="max_drawdown" />
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Metrics Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 16
          }}>
            {/* Model Performance */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
              <SectionHeader title="Model Performance" />
              <MetricRow label="Direction Accuracy" value={`${prediction.model_metrics.direction_accuracy}%`} term="direction_accuracy" />
              <MetricRow label="Test R²" value={prediction.model_metrics.test_r2} term="r_squared" />
              <MetricRow label="Test MSE" value={prediction.model_metrics.test_mse} term="mse" />
              <MetricRow label="Training Samples" value={prediction.model_metrics.training_samples} term="training_samples" />
            </div>

            {/* Backtest Results */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
              <SectionHeader title="Backtest Results" term="backtest" />
              <MetricRow label="Annual Return" value={`${prediction.backtest.annual_return}%`} highlight={prediction.backtest.annual_return > 0} term="annual_return" />
              <MetricRow label="Annual Volatility" value={`${prediction.backtest.annual_volatility}%`} term="annual_volatility" />
              <MetricRow label="Win Rate" value={`${prediction.backtest.win_rate}%`} term="win_rate" />
              <MetricRow label="# Trades" value={prediction.backtest.num_trades} term="num_trades" />
            </div>

            {/* vs Buy & Hold */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
              <SectionHeader title="vs Buy & Hold" />
              <MetricRow label="Strategy Sharpe" value={prediction.backtest.sharpe_ratio} term="sharpe_ratio" />
              <MetricRow label="B&H Sharpe" value={prediction.backtest.buy_hold_sharpe} term="buy_hold_sharpe" />
              <MetricRow label="B&H Return" value={`${prediction.backtest.buy_hold_return}%`} term="buy_hold_return" />
              <MetricRow 
                label="Alpha" 
                value={`${prediction.backtest.strategy_vs_buyhold > 0 ? "+" : ""}${prediction.backtest.strategy_vs_buyhold}%`}
                highlight={prediction.backtest.strategy_vs_buyhold > 0}
                negative={prediction.backtest.strategy_vs_buyhold < 0}
                term="alpha"
              />
            </div>
          </div>

          {/* Feature Importance & Technical Indicators */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16
          }}>
            {/* Top Features */}
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
              <SectionHeader title="Top Features (Importance)" term="feature_importance" />
              {prediction.top_features.map((f: any, i: number) => (
                <div key={`${f.feature}-${i}`} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ opacity: 0.8 }}>{f.feature}</span>
                    <span style={{ fontFamily: "monospace" }}>{f.importance}%</span>
                  </div>
                  <div style={{ 
                    height: 4, 
                    background: "rgba(255,255,255,0.1)", 
                    borderRadius: 2,
                    overflow: "hidden"
                  }}>
                    <div style={{ 
                      width: `${f.importance * 3}%`, 
                      height: "100%", 
                      background: "#3b82f6",
                      borderRadius: 2
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

          {/* Mini Cumulative Returns Chart */}
          {prediction.backtest.cumulative_returns && (
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 12 }}>
              <SectionHeader title="Cumulative Returns (Test Period)" term="backtest" />
              <CumulativeReturnsChart data={prediction.backtest.cumulative_returns} />
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            fontSize: 11,
            opacity: 0.5,
            marginTop: 12,
            padding: 8,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 4,
            textAlign: "center"
          }}>
            ⚠️ Educational ML model using Random Forest Regression with 15+ technical indicators.
            Backtest includes transaction costs. Not financial advice.
          </div>
        </div>
      )}
    </div>
  );
}

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
        color: highlight ? "#22c55e" : negative ? "#ef4444" : "inherit"
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

  // Guard against empty data array
  if (!data || data.length === 0) {
    return <svg width="100%" height={height}><text x="50%" y="50%" fill="#666" textAnchor="middle">No data</text></svg>;
  }

  const allValues = data.flatMap(d => [d.strategy, d.buyHold]);
  const minVal = (allValues.length > 0 ? Math.min(...allValues) : 0) * 0.99;
  const maxVal = (allValues.length > 0 ? Math.max(...allValues) : 1) * 1.01;
  const yRange = maxVal - minVal || 1; // Prevent division by zero

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