import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { BacktestResponse, EquityCurvePoint, BacktestTradeResult } from "../../lib/types";
import { thBase, tdBase, right } from "../../lib/types";
import { InfoTip } from "../common/InfoTip";
import { CONGRESS_TIPS } from "../../lib/tooltips";

const DELAY_OPTIONS = [0, 1, 3, 7, 14];
const HOLD_OPTIONS = [30, 60, 90];
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);

/** Null-safe toFixed helper */
function safeFixed(val: number | null | undefined, digits: number): string {
  return val != null ? val.toFixed(digits) : "—";
}

function returnColor(val: number | null): string {
  if (val == null) return "#888";
  return val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
}

function partyColor(party: string | null): string {
  if (!party) return "#666";
  const p = party.toLowerCase();
  if (p.includes("democrat")) return "#3b82f6";
  if (p.includes("republican")) return "#ef4444";
  return "#888";
}

function gradeColor(grade: string | null): string {
  if (!grade) return "#666";
  if (grade === "A+" || grade === "A") return "#22c55e";
  if (grade === "B") return "#3b82f6";
  if (grade === "C") return "#f59e0b";
  return "#ef4444";
}

// ── Equity Curve SVG Chart ──────────────────────────────────────────────────

function EquityCurveChart({ data }: { data: EquityCurvePoint[] }) {
  const width = 700;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };

  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  if (!data || data.length === 0) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x="50%" y="50%" fill="#666" textAnchor="middle" fontSize={13}>
          No equity curve data
        </text>
      </svg>
    );
  }

  const allVals = data.flatMap((d) => [d.portfolio_value, d.spy_value]);
  const minVal = allVals.length > 0 ? Math.min(...allVals) * 0.97 : 0;
  const maxVal = allVals.length > 0 ? Math.max(...allVals) * 1.03 : 1;
  const yRange = maxVal - minVal || 1;

  const x = (i: number) =>
    pad.left + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2);
  const y = (v: number) => pad.top + ch - ((v - minVal) / yRange) * ch;

  const portfolioPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.portfolio_value)}`)
    .join(" ");
  const spyPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.spy_value)}`)
    .join(" ");

  // Y axis labels (4 ticks) — format appropriately for the value range
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const val = minVal + pct * yRange;
    const label = val >= 1000
      ? `$${(val / 1000).toFixed(1)}K`
      : `$${Math.round(val)}`;
    return { y: y(val), label };
  });

  // X axis labels (first, middle, last date)
  const xLabels: { x: number; label: string }[] = [];
  if (data.length >= 2) {
    xLabels.push({ x: x(0), label: data[0].date.slice(0, 7) });
    const mid = Math.floor(data.length / 2);
    xLabels.push({ x: x(mid), label: data[mid].date.slice(0, 7) });
    xLabels.push({ x: x(data.length - 1), label: data[data.length - 1].date.slice(0, 7) });
  }

  // $10K baseline
  const baselineY = y(10000);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={pad.left}
          y1={t.y}
          x2={width - pad.right}
          y2={t.y}
          stroke="#222"
          strokeWidth={1}
        />
      ))}

      {/* $10K baseline */}
      {baselineY >= pad.top && baselineY <= pad.top + ch && (
        <line
          x1={pad.left}
          y1={baselineY}
          x2={width - pad.right}
          y2={baselineY}
          stroke="#444"
          strokeDasharray="4"
          strokeWidth={1}
        />
      )}

      {/* SPY line (gray, dashed) */}
      <path d={spyPath} fill="none" stroke="#666" strokeWidth={1.5} strokeDasharray="6 3" />

      {/* Portfolio line (blue, solid) */}
      <path d={portfolioPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />

      {/* Endpoint dots */}
      {data.length > 0 && (
        <>
          <circle
            cx={x(data.length - 1)}
            cy={y(data[data.length - 1].portfolio_value)}
            r={4}
            fill="#3b82f6"
          />
          <circle
            cx={x(data.length - 1)}
            cy={y(data[data.length - 1].spy_value)}
            r={3}
            fill="#666"
          />
        </>
      )}

      {/* Y axis labels */}
      {yTicks.map((t, i) => (
        <text
          key={i}
          x={pad.left - 8}
          y={t.y + 4}
          fill="#666"
          fontSize={10}
          textAnchor="end"
        >
          {t.label}
        </text>
      ))}

      {/* X axis labels */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={height - 6}
          fill="#666"
          fontSize={10}
          textAnchor="middle"
        >
          {l.label}
        </text>
      ))}

      {/* Legend */}
      <line x1={pad.left} y1={height - 16} x2={pad.left + 20} y2={height - 16} stroke="#3b82f6" strokeWidth={2.5} />
      <text x={pad.left + 24} y={height - 13} fill="#aaa" fontSize={10}>
        Portfolio
      </text>
      <line
        x1={pad.left + 90}
        y1={height - 16}
        x2={pad.left + 110}
        y2={height - 16}
        stroke="#666"
        strokeWidth={1.5}
        strokeDasharray="6 3"
      />
      <text x={pad.left + 114} y={height - 13} fill="#aaa" fontSize={10}>
        SPY Buy & Hold
      </text>
    </svg>
  );
}

// ── Stat Box ────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "monospace",
          color: color || "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function BacktestDetailCard() {
  const { politicianId } = useParams<{ politicianId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pid = politicianId ? parseInt(politicianId, 10) : null;

  const [delayDays, setDelayDays] = useState(() => {
    const v = Number(searchParams.get("delay"));
    return DELAY_OPTIONS.includes(v) ? v : 3;
  });
  const [holdDays, setHoldDays] = useState(() => {
    const v = Number(searchParams.get("hold"));
    return HOLD_OPTIONS.includes(v) ? v : 30;
  });
  const [sinceYear, setSinceYear] = useState(() => {
    const v = Number(searchParams.get("year"));
    return YEAR_OPTIONS.includes(v) ? v : 2020;
  });
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!pid) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    api.politicianBacktest(pid, delayDays, holdDays, sinceYear)
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load backtest");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [pid, delayDays, holdDays, sinceYear]);

  if (!pid || isNaN(pid)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Invalid politician ID
      </div>
    );
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: 6,
    border: `1px solid ${active ? "#3b82f6" : "#444"}`,
    background: active ? "#3b82f620" : "#222",
    color: active ? "#3b82f6" : "#aaa",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
  });

  const s = data?.summary;
  const trades = data?.trades ?? [];
  const curve = data?.equity_curve ?? [];

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#3b82f6",
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 16,
          padding: 0,
        }}
      >
        ← Back to Leaderboard
      </button>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div>Loading backtest...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: 24,
            background: "#3b1818",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      ) : s ? (
        <>
          {/* Politician Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.politician_name}</div>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: partyColor(s.party) + "20",
                  color: partyColor(s.party),
                }}
              >
                {s.party || "Unknown"}
              </span>
              {s.grade && (
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: gradeColor(s.grade),
                  }}
                >
                  {s.grade}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              {[s.chamber, s.state].filter(Boolean).join(" · ")}
              {s.first_trade_date && s.last_trade_date && (
                <> · {s.first_trade_date} to {s.last_trade_date}</>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
                Copy Delay
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {DELAY_OPTIONS.map((d) => (
                  <button key={d} onClick={() => setDelayDays(d)} style={pillStyle(delayDays === d)}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
                Hold Period
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {HOLD_OPTIONS.map((h) => (
                  <button key={h} onClick={() => setHoldDays(h)} style={pillStyle(holdDays === h)}>
                    {h}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
                Since
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {YEAR_OPTIONS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSinceYear(y)}
                    style={pillStyle(sinceYear === y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 8,
              marginBottom: 20,
              padding: 12,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 10,
            }}
          >
            <StatBox
              label="Total Return"
              value={`${s.total_return_pct > 0 ? "+" : ""}${safeFixed(s.total_return_pct, 1)}%`}
              color={returnColor(s.total_return_pct)}
            />
            <StatBox
              label="Ann. Return"
              value={
                s.annualized_return_pct != null
                  ? `${s.annualized_return_pct > 0 ? "+" : ""}${s.annualized_return_pct.toFixed(1)}%`
                  : "—"
              }
              color={returnColor(s.annualized_return_pct)}
            />
            <StatBox
              label="Alpha vs SPY"
              value={`${s.alpha_pct > 0 ? "+" : ""}${safeFixed(s.alpha_pct, 1)}%`}
              color={returnColor(s.alpha_pct)}
              tooltip={CONGRESS_TIPS.alpha_vs_spy}
            />
            <StatBox label="Win Rate" value={`${safeFixed(s.win_rate, 1)}%`} tooltip={CONGRESS_TIPS.win_rate} />
            <StatBox
              label="Max Drawdown"
              value={s.max_drawdown_pct ? `-${safeFixed(s.max_drawdown_pct, 1)}%` : "0.0%"}
              color={s.max_drawdown_pct ? "#ef4444" : "#888"}
              tooltip={CONGRESS_TIPS.max_dd}
            />
            <StatBox
              label="Sharpe"
              value={s.sharpe_ratio != null ? s.sharpe_ratio.toFixed(2) : "—"}
              tooltip={CONGRESS_TIPS.sharpe_ratio}
            />
            <StatBox label="Cohorts" value={`${s.num_cohorts ?? "—"}`} tooltip={CONGRESS_TIPS.cohort} />
            <StatBox label="Positions" value={`${s.num_trades_priced}`} />
          </div>

          {/* Data Quality / Dedup Funnel */}
          <div
            style={{
              marginBottom: 16,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid #333",
              borderRadius: 8,
              fontSize: 12,
              color: "#888",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>{s.num_trades} raw trades → {s.num_positions ?? "?"} positions → {s.num_cohorts ?? "?"} cohorts → {s.num_trades_priced} priced<InfoTip text={CONGRESS_TIPS.data_quality} /></span>
            {s.skip_reasons && s.skip_reasons.no_price_data > 0 && (
              <> · {s.skip_reasons.no_price_data} delisted (no price data)</>
            )}
            {s.skip_reasons && s.skip_reasons.no_entry_price > 0 && (
              <> · {s.skip_reasons.no_entry_price} missing entry price</>
            )}
            {s.skip_reasons && s.skip_reasons.no_exit_price > 0 && (
              <> · {s.skip_reasons.no_exit_price} missing exit price</>
            )}
            {s.skip_reasons && s.skip_reasons.invalid_return > 0 && (
              <> · {s.skip_reasons.invalid_return} invalid return</>
            )}
          </div>

          {/* Equity Curve Chart */}
          <div
            style={{
              marginBottom: 20,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center" }}>
              Equity Curve ($10,000 starting capital)<InfoTip text={CONGRESS_TIPS.equity_curve} />
            </div>
            <EquityCurveChart data={curve} />
            {curve.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 12,
                  color: "#888",
                }}
              >
                <span>
                  Portfolio: <b style={{ color: "#3b82f6" }}>${curve[curve.length - 1].portfolio_value.toLocaleString()}</b>
                </span>
                <span>
                  SPY: <b style={{ color: "#888" }}>${curve[curve.length - 1].spy_value.toLocaleString()}</b>
                </span>
              </div>
            )}
          </div>

          {/* Low confidence warning */}
          {s.num_trades_priced < 5 && (
            <div
              style={{
                marginBottom: 16,
                padding: 10,
                background: "#f59e0b10",
                border: "1px solid #f59e0b30",
                borderRadius: 8,
                fontSize: 12,
                color: "#f59e0b",
              }}
            >
              Low confidence: Only {s.num_trades_priced} trades with price data.
              Results may not be statistically meaningful.
            </div>
          )}

          {/* Best / Worst Trade */}
          {(s.best_trade || s.worst_trade) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {s.best_trade && (
                <div
                  style={{
                    padding: 12,
                    background: "#22c55e08",
                    border: "1px solid #22c55e20",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#22c55e", textTransform: "uppercase", marginBottom: 4 }}>
                    Best Trade
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {s.best_trade.ticker}{" "}
                    <span style={{ color: "#22c55e" }}>{s.best_trade.return_pct > 0 ? "+" : ""}{s.best_trade.return_pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {s.best_trade.entry_date} → {s.best_trade.exit_date}
                  </div>
                </div>
              )}
              {s.worst_trade && (
                <div
                  style={{
                    padding: 12,
                    background: "#ef444408",
                    border: "1px solid #ef444420",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#ef4444", textTransform: "uppercase", marginBottom: 4 }}>
                    Worst Trade
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {s.worst_trade.ticker}{" "}
                    <span style={{ color: "#ef4444" }}>{s.worst_trade.return_pct > 0 ? "+" : ""}{s.worst_trade.return_pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {s.worst_trade.entry_date} → {s.worst_trade.exit_date}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trade Details Table */}
          {trades.length > 0 && (
            <div
              style={{
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
                Trade Details ({trades.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thBase, textAlign: "left", paddingLeft: 16 }}>Ticker</th>
                      <th style={{ ...thBase, textAlign: "left" }}>Disclosed</th>
                      <th style={{ ...thBase, textAlign: "left" }}>Entry</th>
                      <th style={{ ...thBase, textAlign: "left" }}>Exit</th>
                      <th style={{ ...thBase, ...right }}>Entry $</th>
                      <th style={{ ...thBase, ...right }}>Exit $</th>
                      <th style={{ ...thBase, ...right }}>Return</th>
                      <th style={{ ...thBase, ...right }}>Cohort Ret.</th>
                      <th style={{ ...thBase, ...right }}>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t: BacktestTradeResult, i: number) => {
                      const prevDate = i > 0 ? trades[i - 1].disclosure_date : null;
                      const isCohortBoundary = prevDate != null && prevDate !== t.disclosure_date;
                      return (
                        <tr
                          key={`${t.ticker}-${t.entry_date}-${i}`}
                          style={{
                            borderTop: isCohortBoundary ? "2px solid #444" : undefined,
                            borderBottom: "1px solid #222",
                          }}
                        >
                          <td style={{ ...tdBase, paddingLeft: 16, fontWeight: 600, fontFamily: "system-ui" }}>
                            {t.ticker}
                          </td>
                          <td style={{ ...tdBase, fontSize: 12, color: "#aaa" }}>{t.disclosure_date}</td>
                          <td style={{ ...tdBase, fontSize: 12, color: "#aaa" }}>{t.entry_date}</td>
                          <td style={{ ...tdBase, fontSize: 12, color: "#aaa" }}>{t.exit_date}</td>
                          <td style={{ ...tdBase, ...right }}>${t.entry_price.toFixed(2)}</td>
                          <td style={{ ...tdBase, ...right }}>${t.exit_price.toFixed(2)}</td>
                          <td
                            style={{
                              ...tdBase,
                              ...right,
                              fontWeight: 600,
                              color: returnColor(t.return_pct),
                            }}
                          >
                            {t.return_pct > 0 ? "+" : ""}
                            {t.return_pct.toFixed(2)}%
                          </td>
                          <td
                            style={{
                              ...tdBase,
                              ...right,
                              fontSize: 12,
                              color: returnColor(t.cohort_return_pct ?? null),
                            }}
                          >
                            {t.cohort_return_pct != null
                              ? `${t.cohort_return_pct > 0 ? "+" : ""}${t.cohort_return_pct.toFixed(2)}%`
                              : "—"}
                          </td>
                          <td style={{ ...tdBase, ...right, color: "#888" }}>{t.hold_days_actual}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop: 12, fontSize: 11, color: "#555", textAlign: "center" }}>
            Simulated returns using disclosure_date + {s.delay_days}d delay, {s.hold_days}d hold.
            Equal-weight cohort compounding: positions on the same disclosure date are averaged, then compounded once per date.
            Does not account for transaction costs, slippage, or taxes.
          </div>
        </>
      ) : null}
    </div>
  );
}
