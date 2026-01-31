import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Zap,
  Clock,
  Calendar,
  CalendarDays,
  X,
  Minus,
} from "lucide-react";
import { DrawerOverlay } from "./DrawOverlay";
import type { SectorHeatmapCardProps, SectorResponse, TimeFrame, SectorData } from "./lib/types";

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
};

/* ─── Heatmap colour from value ──────────────────────────────── */

function heatmapBg(value: number, maxAbs: number): string {
  const intensity = Math.min(Math.abs(value) / Math.max(maxAbs, 1), 1);
  if (value > 0) {
    if (intensity > 0.8) return "#10b981";
    if (intensity > 0.6) return "#059669";
    if (intensity > 0.4) return "#047857";
    if (intensity > 0.2) return "#065f46";
    return "#064e3b";
  }
  if (value < 0) {
    if (intensity > 0.8) return "#ef4444";
    if (intensity > 0.6) return "#dc2626";
    if (intensity > 0.4) return "#b91c1c";
    if (intensity > 0.2) return "#991b1b";
    return "#7f1d1d";
  }
  return "#3f3f46";
}

function heatmapText(value: number, maxAbs: number): string {
  const intensity = Math.min(Math.abs(value) / Math.max(maxAbs, 1), 1);
  if (intensity > 0.4) return "#fff";
  if (value > 0) return "#6ee7b7";
  if (value < 0) return "#fca5a5";
  return "#d4d4d8";
}

/* ─── Component ──────────────────────────────────────────────── */

const SectorHeatmapCard: React.FC<SectorHeatmapCardProps> = ({
  highlightSector,
  onSectorClick,
}) => {
  const [data, setData] = useState<SectorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1d");
  const [viewMode, setViewMode] = useState<"heatmap" | "bars">("heatmap");
  const [activeSector, setActiveSector] = useState<SectorData | null>(null);

  useEffect(() => { fetchSectorData(); }, []);

  const fetchSectorData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/market/sectors");
      if (!response.ok) throw new Error("Failed to fetch sector data");
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getPerf = (sector: SectorData): number => {
    switch (timeFrame) {
      case "1d": return sector.performance_1d;
      case "1w": return sector.performance_1w;
      case "1m": return sector.performance_1m;
      case "ytd": return sector.performance_ytd;
    }
  };

  const sortedSectors = useMemo(() => {
    if (!data) return [];
    return [...data.sectors].sort((a, b) => getPerf(b) - getPerf(a));
  }, [data, timeFrame]);

  const maxAbsValue = useMemo(() => {
    if (!sortedSectors.length) return 1;
    return Math.max(...sortedSectors.map((s) => Math.abs(getPerf(s))));
  }, [sortedSectors]);

  const tfOptions: { value: TimeFrame; label: string; Icon: React.FC<any> }[] = [
    { value: "1d", label: "1D", Icon: Clock },
    { value: "1w", label: "1W", Icon: Calendar },
    { value: "1m", label: "1M", Icon: CalendarDays },
    { value: "ytd", label: "YTD", Icon: BarChart3 },
  ];

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading sector data…</div>
      </div>
    );
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div style={{ background: C.card, border: "1px solid #7f1d1d", borderRadius: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color={C.red} />
          <span style={{ fontSize: 13, color: "#fca5a5" }}>Failed to load sector data</span>
          <button onClick={fetchSectorData} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 6 }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BarChart3 size={16} color={C.textSec} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sector Heatmap
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* View mode toggle */}
          <div style={{ display: "flex", background: "#222", borderRadius: 6, padding: 2 }}>
            {(["heatmap", "bars"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === m ? "#444" : "transparent",
                  color: viewMode === m ? C.text : C.textMuted,
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button onClick={fetchSectorData} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Refresh">
            <RefreshCw size={14} color={C.textMuted} />
          </button>
        </div>
      </div>

      {/* ─── Timeframe + Breadth ─── */}
      <div style={{ padding: "8px 16px", borderBottom: `1px solid ${C.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {tfOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTimeFrame(value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: timeFrame === value ? "#444" : "transparent",
                color: timeFrame === value ? C.text : C.textMuted,
                transition: "all 0.15s",
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
          <span style={{ color: C.textMuted }}>Breadth</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.green }}>
            <TrendingUp size={12} /> {data.breadth.positive}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.red }}>
            <TrendingDown size={12} /> {data.breadth.negative}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.textSec }}>
            <Minus size={12} /> {data.breadth.unchanged}
          </span>
        </div>
      </div>

      {/* ─── Heatmap ─── */}
      {viewMode === "heatmap" && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {sortedSectors.map((sector) => {
              const value = getPerf(sector);
              const bg = heatmapBg(value, maxAbsValue);
              const fg = heatmapText(value, maxAbsValue);
              const isHighlighted = highlightSector === sector.sector;
              const isActive = activeSector?.sector === sector.sector;

              return (
                <button
                  key={sector.sector}
                  onClick={() => { setActiveSector(sector); onSectorClick?.(sector); }}
                  style={{
                    position: "relative",
                    padding: 12,
                    borderRadius: 8,
                    background: bg,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    outline: isHighlighted
                      ? "2px solid #60a5fa"
                      : isActive
                      ? "2px solid rgba(255,255,255,0.4)"
                      : "2px solid transparent",
                    outlineOffset: 1,
                    transition: "outline 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <div style={{ fontSize: 11, fontWeight: 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sector.sector}
                  </div>
                  <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, marginTop: 4, color: fg }}>
                    {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.7, color: fg }}>{sector.ticker}</div>
                  {sector.volume_vs_avg > 1.2 && (
                    <Zap size={12} color="#fcd34d" style={{ position: "absolute", top: 8, right: 8 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Bars ─── */}
      {viewMode === "bars" && (
        <div style={{ padding: 16 }}>
          {sortedSectors.map((sector) => {
            const value = getPerf(sector);
            const barWidth = (Math.abs(value) / maxAbsValue) * 100;
            const isActive = activeSector?.sector === sector.sector;
            const isHighlighted = highlightSector === sector.sector;

            return (
              <button
                key={sector.sector}
                onClick={() => { setActiveSector(sector); onSectorClick?.(sector); }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: isActive || isHighlighted ? "rgba(255,255,255,0.05)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  marginBottom: 4,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Label */}
                <div style={{ width: 120, textAlign: "left", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#d4d4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sector.sector}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{sector.ticker}</div>
                </div>

                {/* Bar */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", height: 20 }}>
                  {value < 0 && (
                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                      <div style={{ height: 16, background: "rgba(239,68,68,0.7)", borderRadius: "4px 0 0 4px", width: `${barWidth}%`, transition: "width 0.3s" }} />
                    </div>
                  )}
                  <div style={{ width: 1, height: 20, background: "#555", flexShrink: 0 }} />
                  {value >= 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 16, background: "rgba(16,185,129,0.7)", borderRadius: "0 4px 4px 0", width: `${barWidth}%`, transition: "width 0.3s" }} />
                    </div>
                  )}
                  {value < 0 && <div style={{ flex: 1 }} />}
                </div>

                {/* Value */}
                <div style={{ width: 60, textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: value >= 0 ? C.green : C.red, flexShrink: 0 }}>
                  {value >= 0 ? "+" : ""}{value.toFixed(2)}%
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Footer ─── */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSubtle}`, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: C.textSec }}>
          <span style={{ color: C.green, fontWeight: 500 }}>{data.market_leader}</span> leading |{" "}
          <span style={{ color: C.red, fontWeight: 500 }}>{data.market_laggard}</span> lagging
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* ─── Drawer ─── */}
      <DrawerOverlay open={!!activeSector} onClose={() => setActiveSector(null)} title="Sector detail">
        {activeSector && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sector</div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 600, color: C.text }}>{activeSector.sector}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: C.textSec }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{activeSector.ticker}</span> · ${activeSector.market_cap_billions.toLocaleString()}B market cap
                </div>
              </div>
              <button onClick={() => setActiveSector(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Close">
                <X size={16} color={C.textSec} />
              </button>
            </div>

            {/* Performance grid */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["1d", "1w", "1m", "ytd"] as const).map((tf) => {
                const perf = tf === "1d" ? activeSector.performance_1d
                  : tf === "1w" ? activeSector.performance_1w
                  : tf === "1m" ? activeSector.performance_1m
                  : activeSector.performance_ytd;
                return (
                  <div key={tf} style={{
                    padding: 8,
                    borderRadius: 8,
                    textAlign: "center",
                    border: `1px solid ${tf === timeFrame ? "#555" : C.borderSubtle}`,
                    background: tf === timeFrame ? "rgba(255,255,255,0.04)" : "transparent",
                  }}>
                    <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase" }}>{tf}</div>
                    <div style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 600, color: perf >= 0 ? C.green : C.red, marginTop: 2 }}>
                      {perf >= 0 ? "+" : ""}{perf.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Volume */}
            <div style={{ marginTop: 16, borderRadius: 8, border: `1px solid ${C.borderSubtle}`, background: "rgba(255,255,255,0.03)", padding: 14 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Activity</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#d4d4d8" }}>Volume vs avg</span>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: C.text }}>{activeSector.volume_vs_avg.toFixed(2)}×</span>
              </div>
              {activeSector.volume_vs_avg > 1.2 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.amber, display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={14} /> Elevated volume in this sector today
                </div>
              )}
            </div>

            {/* Top movers */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top movers</div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activeSector.top_movers.map((m) => (
                  <div key={m.symbol} style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px solid ${C.borderSubtle}`,
                    background: "rgba(255,255,255,0.02)",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{ color: C.text, fontWeight: 500 }}>{m.symbol}</span>
                    <span style={{ color: m.change >= 0 ? C.green : C.red }}>
                      {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DrawerOverlay>
    </div>
  );
};

export default SectorHeatmapCard;