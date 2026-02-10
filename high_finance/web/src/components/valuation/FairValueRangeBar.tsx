import { memo } from "react";
import { fmtPx } from "../Functions";

export const FairValueRangeBar = memo(function FairValueRangeBar({
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
  const allValues = [low, mid, high, current, analystTarget, analystLow, analystHigh].filter(v => v != null && Number.isFinite(v)) as number[];
  if (allValues.length === 0) return null;
  const min = Math.min(...allValues) * 0.9;
  const max = Math.max(...allValues) * 1.1;
  const range = max - min || 1; // prevent division by zero if all values identical

  const pos = (v: number) => ((v - min) / range) * 100;

  // Check if DCF values are clustered (all within 15% of chart width)
  const dcfSpread = pos(high) - pos(low);
  const isClustered = dcfSpread < 15;

  // When clustered, show a compact summary instead of overlapping markers
  const clusterCenter = (pos(low) + pos(high)) / 2;

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{
        position: "relative",
        height: isClustered ? 50 : 60,
        background: "linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(59,130,246,0.15) 50%, rgba(34,197,94,0.15) 100%)",
        borderRadius: 8,
      }}>
        {/* DCF Range bar */}
        <div style={{
          position: "absolute",
          left: `${pos(low)}%`,
          right: `${100 - pos(high)}%`,
          top: isClustered ? 20 : 20,
          height: 20,
          background: "linear-gradient(90deg, #ef4444 0%, #3b82f6 50%, #22c55e 100%)",
          borderRadius: 6,
          opacity: 0.8,
          minWidth: 8,
        }} />

        {/* Analyst range (if available) */}
        {analystLow != null && analystHigh != null && (
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

        {isClustered ? (
          /* Clustered view: single compact label for all DCF values */
          <div style={{
            position: "absolute",
            left: `${Math.max(0, Math.min(clusterCenter, 85))}%`,
            top: -8,
            transform: clusterCenter < 15 ? "translateX(0)" : "translateX(-50%)",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 10,
            whiteSpace: "nowrap",
            zIndex: 5,
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span>
                <span style={{ color: "#ef4444", fontWeight: 600 }}>Bear</span>
                <span style={{ opacity: 0.6 }}> {fmtPx(low)}</span>
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>
                <span style={{ color: "#3b82f6", fontWeight: 600 }}>Base</span>
                <span style={{ opacity: 0.6 }}> {fmtPx(mid)}</span>
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>
                <span style={{ color: "#22c55e", fontWeight: 600 }}>Bull</span>
                <span style={{ opacity: 0.6 }}> {fmtPx(high)}</span>
              </span>
            </div>
          </div>
        ) : (
          /* Normal view: separate markers */
          <>
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
          </>
        )}

        {/* Current price marker */}
        {current != null && (
          <div style={{ position: "absolute", left: `${pos(current)}%`, top: isClustered ? 16 : -12, transform: "translateX(-50%)", textAlign: "center", zIndex: 20 }}>
            <div style={{ fontSize: 9, background: "#fff", color: "#000", padding: "2px 6px", borderRadius: 4, fontWeight: 600, border: "2px solid #333", boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
              NOW: {fmtPx(current)}
            </div>
            <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #333", margin: "0 auto" }} />
          </div>
        )}

        {/* Analyst target marker */}
        {analystTarget != null && (
          <div style={{ position: "absolute", left: `${pos(analystTarget)}%`, bottom: -8, transform: "translateX(-50%)", textAlign: "center", zIndex: 10 }}>
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid #a855f7", margin: "0 auto" }} />
            <div style={{ fontSize: 9, background: "#a855f7", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 600, marginTop: 2 }}>
              ST: {fmtPx(analystTarget)}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {analystTarget != null && (
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
});