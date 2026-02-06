/**
 * Sparkline Component
 * ===================
 * A compact mini-chart for showing price trends.
 */

import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showEndDot?: boolean;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color,
  showEndDot = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  const { pathD, endPoint, lineColor } = useMemo(() => {
    if (!data || data.length < 2) {
      return { pathD: "", endPoint: null, lineColor: "#666" };
    }

    // Determine color based on trend (first vs last value)
    const trend = data[data.length - 1] - data[0];
    const autoColor = trend >= 0 ? "#22c55e" : "#ef4444";
    const lineColor = color || autoColor;

    // Calculate min/max for scaling
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1; // Avoid division by zero

    // Add padding
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Build SVG path
    const points: string[] = [];
    const xStep = chartWidth / (data.length - 1);

    for (let i = 0; i < data.length; i++) {
      const x = padding + i * xStep;
      const y = padding + chartHeight - ((data[i] - min) / range) * chartHeight;

      if (i === 0) {
        points.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
      } else {
        points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    }

    const pathD = points.join(" ");

    // End point for dot
    const lastX = padding + (data.length - 1) * xStep;
    const lastY = padding + chartHeight - ((data[data.length - 1] - min) / range) * chartHeight;
    const endPoint = { x: lastX, y: lastY };

    return { pathD, endPoint, lineColor };
  }, [data, width, height, color]);

  if (!data || data.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#444",
          fontSize: 10,
        }}
      >
        —
      </div>
    );
  }

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showEndDot && endPoint && (
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r={2.5}
          fill={lineColor}
        />
      )}
    </svg>
  );
}

export default Sparkline;
