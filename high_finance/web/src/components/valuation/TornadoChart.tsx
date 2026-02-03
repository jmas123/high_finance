import type { SensitivityItem } from "../../lib/types";
import { fmtPx } from "../Functions";

export function TornadoChart({ sensitivities, baseFV }: { sensitivities: SensitivityItem[]; baseFV: number }) {
  if (!sensitivities?.length) return null;

  const width = 500;
  const height = sensitivities.length * 44 + 40;
  const pad = { left: 120, right: 30, top: 25, bottom: 15 };
  const chartW = width - pad.left - pad.right;

  const allValues = sensitivities.flatMap(s => [s.fv_at_low, s.fv_at_high]).filter(v => v != null && Number.isFinite(v));
  const minFV = allValues.length > 0 ? Math.min(...allValues, baseFV) : baseFV;
  const maxFV = allValues.length > 0 ? Math.max(...allValues, baseFV) : baseFV;
  const range = maxFV - minFV || 1; // Prevent division by zero
  const padding = range * 0.1;

  const xMin = minFV - padding;
  const xMax = maxFV + padding;

  const sx = (v: number) => pad.left + ((v - xMin) / (xMax - xMin)) * chartW;
  const baseX = sx(baseFV);

  const barHeight = 24;
  const rowHeight = 44;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }}>
      <line x1={baseX} y1={pad.top - 10} x2={baseX} y2={height - pad.bottom} stroke="#666" strokeWidth="1" strokeDasharray="4,4" />
      <text x={baseX} y={pad.top - 15} fill="#888" fontSize="10" textAnchor="middle">Base: {fmtPx(baseFV)}</text>

      {sensitivities.map((item, i) => {
        const y = pad.top + i * rowHeight;
        const lowX = sx(item.fv_at_low);
        const highX = sx(item.fv_at_high);
        const lowIsBetter = item.param === "wacc" || item.param === "tax";
        
        return (
          <g key={item.param}>
            <text x={pad.left - 8} y={y + barHeight / 2 + 4} fill="#aaa" fontSize="11" textAnchor="end">{item.label}</text>

            {item.fv_at_low < baseFV ? (
              <rect x={lowX} y={y} width={baseX - lowX} height={barHeight} fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"} rx="4" />
            ) : (
              <rect x={baseX} y={y} width={lowX - baseX} height={barHeight} fill={lowIsBetter ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"} rx="4" />
            )}

            {item.fv_at_high > baseFV ? (
              <rect x={baseX} y={y} width={highX - baseX} height={barHeight} fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"} rx="4" />
            ) : (
              <rect x={highX} y={y} width={baseX - highX} height={barHeight} fill={lowIsBetter ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)"} rx="4" />
            )}

            <text x={Math.min(lowX, highX) - 5} y={y + barHeight / 2 + 4} fill="#888" fontSize="9" textAnchor="end">{fmtPx(Math.min(item.fv_at_low, item.fv_at_high))}</text>
            <text x={Math.max(lowX, highX) + 5} y={y + barHeight / 2 + 4} fill="#888" fontSize="9" textAnchor="start">{fmtPx(Math.max(item.fv_at_low, item.fv_at_high))}</text>
          </g>
        );
      })}
    </svg>
  );
}