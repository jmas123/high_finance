import { useEffect, useMemo, useState, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import { DrawerOverlay } from "./DrawOverlay";

import type { MacroIndicator } from "../../lib/types";
import { useIsMobile } from "../../lib/useIsMobile";

/* ─── Colour helpers ─────────────────────────────────────────── */

const C = {
  bg: "#111",
  card: "#1a1a1a",
  panel: "#0f0f0f",
  border: "#333",
  borderSubtle: "#292929",
  text: "#e4e4e7",
  textSec: "#a1a1aa",
  textMuted: "#71717a",
  green: "#34d399",
  greenDim: "#6ee7b7",
  red: "#f87171",
  redDim: "#fca5a5",
  amber: "#fcd34d",
  blue: "#60a5fa",
  blueBg: "rgba(59,130,246,0.1)",
};

/* ─── Types ──────────────────────────────────────────────────── */

interface MacroData {
  indicators: MacroIndicator[];
  summary: {
    rate_environment: string;
    inflation_trend: string;
    yield_curve: string;
    market_volatility: string;
  };
}

interface MacroOverlayCardProps {
  ticker?: string;
  onIndicatorClick?: (indicator: MacroIndicator) => void;
  initialData?: MacroData | null;
}

/* ─── Formatting ─────────────────────────────────────────────── */

function fmtChange(x: number, pct: number) {
  const sign = x >= 0 ? "+" : "";
  return `${sign}${x.toFixed(2)} (${sign}${pct.toFixed(1)}%)`;
}

function getTrendColor(name: string, trend: MacroIndicator["trend"]): string {
  if (trend === "stable") return C.textMuted;
  const isBadUp =
    name.includes("CPI") || name.includes("PCE") || name === "VIX" || name.includes("Fed Funds");
  if (trend === "up") return isBadUp ? C.red : C.green;
  return isBadUp ? C.green : C.red;
}

function getValueColor(name: string, value: number): string {
  if (name === "VIX") {
    if (value < 15) return C.greenDim;
    if (value < 25) return C.amber;
    return C.redDim;
  }
  if (name.includes("Yield Curve")) return value < 0 ? C.amber : C.greenDim;
  if (name.includes("CPI") || name.includes("PCE")) {
    if (value < 2.5) return C.greenDim;
    if (value < 4) return C.amber;
    return C.redDim;
  }
  return C.text;
}

/* ─── Trend icon ─────────────────────────────────────────────── */

function TrendIcon({ trend, color }: { trend: MacroIndicator["trend"]; color: string }) {
  if (trend === "up") return <TrendingUp size={14} color={color} />;
  if (trend === "down") return <TrendingDown size={14} color={color} />;
  return <Minus size={14} color={color} />;
}

/* ─── Component ──────────────────────────────────────────────── */

export default function MacroOverlayCard({ ticker, onIndicatorClick, initialData }: MacroOverlayCardProps) {
  const isMobile = useIsMobile();
  const [data, setData] = useState<MacroData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState<MacroIndicator | null>(null);
  const fetchedRef = useRef(!!initialData); // Skip fetch if initialData provided

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchMacroData();
  }, []);

  const fetchMacroData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/market/macro-indicators`);
      if (!res.ok) throw new Error("Failed to fetch macro data");
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const primary = useMemo(() => ["Fed Funds Rate", "10-Year Treasury", "CPI YoY", "VIX"], []);

  const indicators = useMemo(() => {
    if (!data) return { kpis: [] as MacroIndicator[], rest: [] as MacroIndicator[], all: [] as MacroIndicator[] };
    const byName = new Map(data.indicators.map((i) => [i.name, i]));
    const kpis = primary.map((n) => byName.get(n)).filter((x): x is MacroIndicator => Boolean(x));
    const rest = data.indicators.filter((i) => !primary.includes(i.name));
    return { kpis, rest, all: [...kpis, ...rest] };
  }, [data, primary]);

  const regime = useMemo(() => {
    if (!data) return "";
    return `Rates: ${data.summary.rate_environment} · Inflation: ${data.summary.inflation_trend} · Curve: ${data.summary.yield_curve} · Vol: ${data.summary.market_volatility}`;
  }, [data]);

  const lastUpdated = useMemo(() => {
    if (!data?.indicators?.length) return null;
    const times = data.indicators
      .map((i) => (i.last_updated ? Date.parse(i.last_updated) : NaN))
      .filter((t) => !Number.isNaN(t));
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }, [data]);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading macro data…</div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div style={{ background: C.card, border: "1px solid #7f1d1d", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={C.red} />
          <span style={{ fontSize: 13, color: C.redDim }}>Failed to load macro data</span>
          <button onClick={fetchMacroData} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 6 }}>
            <RefreshCw size={14} color={C.textSec} />
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ position: "relative", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>

      {/* ─── Header ─── */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Macro Overlay
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 8 }}>Regime</span>
            <span style={{ color: C.text }}>{regime}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={fetchMacroData} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }} title="Refresh">
            <RefreshCw size={14} color={C.textSec} />
          </button>
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {indicators.kpis.map((i) => {
            const tColor = getTrendColor(i.name, i.trend);
            const vColor = getValueColor(i.name, i.value);
            return (
              <button
                key={i.name}
                onClick={() => { setActive(i); onIndicatorClick?.(i); }}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${C.borderSubtle}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "inherit",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={isMobile ? undefined : (e) => (e.currentTarget.style.borderColor = "#555")}
                onMouseLeave={isMobile ? undefined : (e) => (e.currentTarget.style.borderColor = C.borderSubtle)}
              >
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i.name}
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4 }}>
                  <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 600, color: vColor }}>
                    {i.value.toFixed(2)}
                    <span style={{ marginLeft: 3, fontSize: 11, color: C.textMuted }}>{i.unit}</span>
                  </div>
                  <TrendIcon trend={i.trend} color={tColor} />
                </div>
                <div style={{ marginTop: 4, fontSize: 11, fontFamily: "monospace", color: tColor }}>
                  {fmtChange(i.change, i.change_pct)}
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── More indicators list ─── */}
        <div style={{ marginTop: 16, border: `1px solid ${C.borderSubtle}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{
            padding: "8px 12px",
            background: "rgba(255,255,255,0.02)",
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {showAll ? "All indicators" : "More indicators"}
            </span>
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{ fontSize: 11, color: C.textSec, background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
            >
              {showAll ? "Show less" : `View all (${data.indicators.length})`}
            </button>
          </div>

          <div>
            {(showAll ? indicators.all : indicators.rest.slice(0, 6)).map((i, idx) => {
              const tColor = getTrendColor(i.name, i.trend);
              const vColor = getValueColor(i.name, i.value);
              return (
                <button
                  key={i.name}
                  onClick={() => { setActive(i); onIndicatorClick?.(i); }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "none",
                    border: "none",
                    borderTop: idx > 0 ? `1px solid ${C.borderSubtle}` : "none",
                    cursor: "pointer",
                    color: "inherit",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={isMobile ? undefined : (e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={isMobile ? undefined : (e) => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Prev {i.previous_value?.toFixed?.(2) ?? "—"}{i.unit}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: vColor }}>
                      {i.value.toFixed(2)}
                      <span style={{ marginLeft: 3, fontSize: 10, color: C.textMuted }}>{i.unit}</span>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: tColor }}>{fmtChange(i.change, i.change_pct)}</div>
                  </div>
                  <div style={{ width: 24, display: "flex", justifyContent: "flex-end" }}>
                    <TrendIcon trend={i.trend} color={tColor} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Ticker context ─── */}
        {ticker && (
          <div style={{
            marginTop: 16,
            borderRadius: 8,
            border: `1px solid ${C.borderSubtle}`,
            background: "rgba(255,255,255,0.02)",
            padding: 12,
            fontSize: 12,
            color: C.textSec,
            lineHeight: 1.5,
          }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{ticker}</span>: In a{" "}
            <span style={{ color: C.text, fontWeight: 500 }}>{data.summary.rate_environment}</span>{" "}
            rate regime, valuation multiples for long-duration/growth names can be more sensitive to yields.
          </div>
        )}
      </div>

      {/* ─── Detail Drawer ─── */}
      <DrawerOverlay open={!!active} onClose={() => setActive(null)} title="Indicator detail">
        {active && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <Info size={14} color={C.blue} />
                  Indicator detail
                </div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: C.text }}>{active.name}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22, fontFamily: "monospace", fontWeight: 600, color: getValueColor(active.name, active.value) }}>
                    {active.value.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{active.unit}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontFamily: "monospace", color: getTrendColor(active.name, active.trend) }}>
                    {fmtChange(active.change, active.change_pct)}
                  </span>
                </div>
              </div>
              <button onClick={() => setActive(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }} title="Close">
                <X size={16} color={C.textSec} />
              </button>
            </div>

            <div style={{ marginTop: 20, borderRadius: 8, border: `1px solid ${C.borderSubtle}`, background: "rgba(255,255,255,0.03)", padding: 14 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Why it matters</div>
              <p style={{ marginTop: 8, fontSize: 13, color: "#d4d4d8", lineHeight: 1.6 }}>
                {active.impact_description}
              </p>
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: C.textMuted }}>
              Last updated:{" "}
              <span style={{ color: "#d4d4d8" }}>
                {active.last_updated ? new Date(active.last_updated).toLocaleString() : "—"}
              </span>
            </div>
          </>
        )}
      </DrawerOverlay>
    </div>
  );
}