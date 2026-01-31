import { fmtPx } from "../Functions";

export function FairValueRangeBar({
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