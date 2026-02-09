import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";
import { useIsMobile } from "../../lib/useIsMobile";
import { MobileCardRow, MobileCardField } from "../common/MobileCard";

// ===== EXPLANATIONS =====
const EXPLANATIONS: Record<string, string> = {
  // Top metrics
  put_call_ratio: "Ratio of put volume to call volume. < 0.7 = Bullish (more calls), > 1.0 = Bearish (more puts). Indicates market sentiment.",
  call_volume: "Total call option contracts traded today. Calls = bullish bets (right to BUY stock at strike price).",
  put_volume: "Total put option contracts traded today. Puts = bearish bets or hedges (right to SELL stock at strike price).",
  max_pain: "Strike price where most options expire worthless. Market makers often hedge to push stock toward this price by expiration.",
  iv_percentile: "Where current implied volatility ranks vs last year. High (>80%) = options expensive, Low (<20%) = options cheap.",
  
  // Expected move section
  expected_move: "Implied price range by expiration, calculated from ATM straddle price. Market's best guess of how much the stock will move.",
  atm_iv: "At-the-money implied volatility (annualized). Higher IV = market expects bigger moves = more expensive options.",
  nearest_expiry: "Options expiring soonest. These have the most gamma (price sensitivity) and often drive unusual activity.",
  
  // Volume chart
  volume_by_strike: "Shows where traders are placing bets. Left = puts (bearish/hedging), Right = calls (bullish). Longer bars = more activity at that strike.",
  
  // Unusual activity
  unusual_activity: "Trades where today's volume exceeds 2x open interest. Could signal informed traders making large directional bets.",
  volume: "Number of contracts traded TODAY at this strike.",
  open_interest: "Contracts that existed BEFORE today. Volume >> OI means new positions being opened.",
  vol_oi_ratio: "Volume divided by Open Interest. Higher ratio (3x+) = more unusual, potentially significant activity.",
  iv: "Implied volatility for this specific contract. Higher IV = more expensive premium.",
  premium: "Total money spent on these contracts (Volume × Price × 100 shares). Shows conviction size.",
  signal: "BULLISH = OTM calls (betting up), BEARISH = OTM puts (betting down), ITM = could be hedging or assignment plays.",
  
  // Signals explained
  bullish_signal: "Out-of-the-money CALL being bought. Trader profits if stock rises above strike price. Pure directional bet.",
  bearish_signal: "Out-of-the-money PUT being bought. Trader profits if stock falls below strike price. Could be hedge or directional.",
  itm_call: "In-the-money call. Already has intrinsic value. Could be used for leverage, covered calls, or stock replacement.",
  itm_put: "In-the-money put. Already has intrinsic value. Often used for hedging existing long positions.",
};

// ===== INFO BUTTON COMPONENT =====
function InfoButton({ term }: { term: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const explanation = EXPLANATIONS[term];

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    }
  };

  if (!explanation) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          updatePosition();
          setShow(!show);
        }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "1px solid #555",
          background: show ? "#3b82f6" : "#333",
          color: show ? "#fff" : "#999",
          fontSize: 9,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 4,
          padding: 0,
          transition: "all 0.15s ease",
          verticalAlign: "middle",
        }}
      >
        ?
      </button>
      {show && createPortal(
        <>
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
          <div style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            transform: "translate(-50%, -100%)",
            width: 280,
            padding: 12,
            background: "#000000",
            border: "2px solid #3b82f6",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            color: "#ffffff",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,1)",
            textAlign: "left",
          }}>
            {explanation}
            <div style={{
              position: "absolute",
              bottom: -8,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 12,
              height: 12,
              background: "#000000",
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

// ===== TYPES =====
type UnusualActivity = {
  type: "CALL" | "PUT";
  strike: number;
  volume: number;
  open_interest: number;
  volume_oi_ratio: number;
  last_price: number;
  implied_volatility: number;
  moneyness: number;
  premium_value: number;
  signal: string;
};

type StrikeVolume = {
  strike: number;
  call_volume: number;
  put_volume: number;
};

type OptionsData = {
  ticker: string;
  current_price: number | null;
  expirations: string[];
  put_call_ratio: number | null;
  total_call_volume: number;
  total_put_volume: number;
  total_call_oi: number;
  total_put_oi: number;
  max_pain: number | null;
  unusual_activity: UnusualActivity[];
  iv_percentile: number | null;
  nearest_expiry_analysis: {
    expiry: string;
    days_to_expiry: number;
    atm_strike: number | null;
    atm_iv: number | null;
    expected_move: number | null;
    expected_move_pct: number | null;
    strike_volume: StrikeVolume[];
  } | null;
};

// ===== HELPERS =====
function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

// ===== MAIN COMPONENT =====
interface OptionsFlowCardProps {
  ticker: string;
  initialData?: OptionsData | null;
}

export function OptionsFlowCard({ ticker, initialData }: OptionsFlowCardProps) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OptionsData | null>(initialData ?? null);

  useEffect(() => {
    // Skip fetch if we have initial data from bundle (even if null)
    if (initialData !== undefined) {
      setData(initialData);
      return;
    }

    let mounted = true;

    async function load() {
      if (!ticker) return;
      setLoading(true);
      setError(null);
      try {
        const result = await api.optionsOverview(ticker);
        if (mounted) setData(result);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load options data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [ticker, initialData]);

  // Determine sentiment
  const sentiment = data?.put_call_ratio
    ? data.put_call_ratio < 0.7 ? { label: "BULLISH", color: "#22c55e" }
      : data.put_call_ratio > 1.0 ? { label: "BEARISH", color: "#ef4444" }
      : { label: "NEUTRAL", color: "#9ca3af" }
    : null;

  // IV interpretation
  const ivLabel = data?.iv_percentile
    ? data.iv_percentile > 80 ? { label: "HIGH (Expensive)", color: "#ef4444" }
      : data.iv_percentile < 20 ? { label: "LOW (Cheap)", color: "#22c55e" }
      : { label: "NORMAL", color: "#9ca3af" }
    : null;

  // Max volume for bar scaling
  const maxVolume = data?.nearest_expiry_analysis?.strike_volume
    ? Math.max(...data.nearest_expiry_analysis.strike_volume.map(s => Math.max(s.call_volume, s.put_volume)))
    : 0;

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Options Flow</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            Unusual activity & market sentiment
          </div>
        </div>

        {sentiment && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            {ivLabel && (
              <span style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: `${ivLabel.color}22`,
                color: ivLabel.color,
                display: "inline-flex",
                alignItems: "center",
              }}>
                IV: {ivLabel.label}
                <InfoButton term="iv_percentile" />
              </span>
            )}
            <span style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: `${sentiment.color}22`,
              color: sentiment.color,
              display: "inline-flex",
              alignItems: "center",
            }}>
              {sentiment.label}
              <InfoButton term="put_call_ratio" />
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: "#3b1818",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
        }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, opacity: 0.7 }}>Loading options data…</div>
      ) : !data || data.expirations.length === 0 ? (
        <div style={{ padding: 24, opacity: 0.7, textAlign: "center" }}>
          No options data available for this ticker.
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: "rgba(99, 102, 241, 0.05)",
            borderRadius: 8,
            border: "1px solid rgba(99, 102, 241, 0.1)",
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center" }}>
                Put/Call Ratio
                <InfoButton term="put_call_ratio" />
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                color: sentiment?.color || "inherit"
              }}>
                {data.put_call_ratio?.toFixed(2) || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center" }}>
                Call Volume
                <InfoButton term="call_volume" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#22c55e" }}>
                {formatNumber(data.total_call_volume)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center" }}>
                Put Volume
                <InfoButton term="put_volume" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#ef4444" }}>
                {formatNumber(data.total_put_volume)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center" }}>
                Max Pain
                <InfoButton term="max_pain" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                ${data.max_pain?.toFixed(0) || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6, display: "flex", alignItems: "center" }}>
                IV Percentile
                <InfoButton term="iv_percentile" />
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                color: ivLabel?.color || "inherit"
              }}>
                {data.iv_percentile !== null ? `${data.iv_percentile}%` : "—"}
              </div>
            </div>
          </div>

          {/* Expected Move */}
          {data.nearest_expiry_analysis && (
            <div style={{
              display: "flex",
              gap: 16,
              marginBottom: 16,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "flex", alignItems: "center" }}>
                  Nearest Expiry: {data.nearest_expiry_analysis.expiry} ({data.nearest_expiry_analysis.days_to_expiry}d)
                  <InfoButton term="nearest_expiry" />
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ opacity: 0.6, fontSize: 12 }}>Expected Move: </span>
                    <span style={{ fontWeight: 600, marginLeft: 4 }}>
                      ±${data.nearest_expiry_analysis.expected_move?.toFixed(2) || "—"}
                      {data.nearest_expiry_analysis.expected_move_pct && (
                        <span style={{ opacity: 0.7 }}> ({data.nearest_expiry_analysis.expected_move_pct}%)</span>
                      )}
                    </span>
                    <InfoButton term="expected_move" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ opacity: 0.6, fontSize: 12 }}>ATM IV: </span>
                    <span style={{ fontWeight: 600, marginLeft: 4 }}>{data.nearest_expiry_analysis.atm_iv || "—"}%</span>
                    <InfoButton term="atm_iv" />
                  </div>
                  <div>
                    <span style={{ opacity: 0.6, fontSize: 12 }}>Price: </span>
                    <span style={{ fontWeight: 600 }}>${data.current_price?.toFixed(2) || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Volume by Strike Chart */}
          {data.nearest_expiry_analysis?.strike_volume && data.nearest_expiry_analysis.strike_volume.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center" }}>
                Volume by Strike
                <InfoButton term="volume_by_strike" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.nearest_expiry_analysis.strike_volume.map((sv) => {
                  const isATM = data.current_price && Math.abs(sv.strike - data.current_price) < data.current_price * 0.02;
                  return (
                    <div key={sv.strike} style={{ display: "flex", alignItems: "center", gap: 8, height: 20 }}>
                      {/* Put bar (left) */}
                      <div style={{ width: 80, display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                          height: 14,
                          width: maxVolume > 0 ? `${(sv.put_volume / maxVolume) * 100}%` : 0,
                          background: "#ef4444",
                          borderRadius: "2px 0 0 2px",
                          minWidth: sv.put_volume > 0 ? 2 : 0,
                        }} />
                      </div>

                      {/* Strike */}
                      <div style={{
                        width: 60,
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: isATM ? 700 : 400,
                        color: isATM ? "#fff" : "rgba(255,255,255,0.6)",
                        background: isATM ? "#3b82f6" : "transparent",
                        borderRadius: 2,
                        padding: "1px 4px",
                      }}>
                        ${sv.strike}
                      </div>

                      {/* Call bar (right) */}
                      <div style={{ width: 80 }}>
                        <div style={{
                          height: 14,
                          width: maxVolume > 0 ? `${(sv.call_volume / maxVolume) * 100}%` : 0,
                          background: "#22c55e",
                          borderRadius: "0 2px 2px 0",
                          minWidth: sv.call_volume > 0 ? 2 : 0,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, opacity: 0.6 }}>
                <span>◀ Puts</span>
                <span>Calls ▶</span>
              </div>
            </div>
          )}

          {/* Unusual Activity Table */}
          {data.unusual_activity.length > 0 && (
            <div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center" }}>
                Unusual Activity (Volume {'>'} 2x Open Interest)
                <InfoButton term="unusual_activity" />
              </div>
              {isMobile ? (
                <div>
                  {data.unusual_activity.map((ua, i) => (
                    <MobileCardRow key={`${ua.type}-${ua.strike}-${i}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: ua.type === "CALL" ? "#14532d" : "#7f1d1d",
                          }}>
                            {ua.type}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>${ua.strike}</span>
                        </div>
                        <span style={{
                          color: ua.signal === "BULLISH" ? "#22c55e" : ua.signal === "BEARISH" ? "#ef4444" : "#9ca3af",
                          fontWeight: 600,
                          fontSize: 12,
                        }}>
                          {ua.signal}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <MobileCardField label="Premium" value={formatMoney(ua.premium_value)} />
                        <MobileCardField label="Volume" value={formatNumber(ua.volume)} />
                        <MobileCardField label="Vol/OI" value={
                          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{ua.volume_oi_ratio}x</span>
                        } />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                        <MobileCardField label="OI" value={formatNumber(ua.open_interest)} />
                        <MobileCardField label="IV" value={`${ua.implied_volatility}%`} />
                      </div>
                    </MobileCardRow>
                  ))}
                </div>
              ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #333" }}>
                      <th style={{ padding: "8px 6px", textAlign: "left", opacity: 0.6, fontWeight: 500 }}>Type</th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>Strike</th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          Volume
                          <InfoButton term="volume" />
                        </span>
                      </th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          OI
                          <InfoButton term="open_interest" />
                        </span>
                      </th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          Vol/OI
                          <InfoButton term="vol_oi_ratio" />
                        </span>
                      </th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          IV
                          <InfoButton term="iv" />
                        </span>
                      </th>
                      <th style={{ padding: "8px 6px", textAlign: "right", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          Premium
                          <InfoButton term="premium" />
                        </span>
                      </th>
                      <th style={{ padding: "8px 6px", textAlign: "left", opacity: 0.6, fontWeight: 500 }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          Signal
                          <InfoButton term="signal" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unusual_activity.map((ua, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                        <td style={{ padding: "8px 6px" }}>
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: ua.type === "CALL" ? "#14532d" : "#7f1d1d",
                          }}>
                            {ua.type}
                          </span>
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace" }}>
                          ${ua.strike}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                          {formatNumber(ua.volume)}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace", opacity: 0.7 }}>
                          {formatNumber(ua.open_interest)}
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#f59e0b" }}>
                          {ua.volume_oi_ratio}x
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace" }}>
                          {ua.implied_volatility}%
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace" }}>
                          {formatMoney(ua.premium_value)}
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <span style={{
                            color: ua.signal === "BULLISH" ? "#22c55e" : ua.signal === "BEARISH" ? "#ef4444" : "#9ca3af",
                            fontWeight: 500,
                          }}>
                            {ua.signal}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {data.unusual_activity.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
              No unusual options activity detected today.
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
            textAlign: "center",
          }}>
            Options data may be delayed. Volume/OI ratios {'>'} 2x flagged as unusual. Not financial advice.
          </div>
        </>
      )}
    </div>
  );
}