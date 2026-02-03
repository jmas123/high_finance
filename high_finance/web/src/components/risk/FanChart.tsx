import { fmtPrice } from "../Functions";

export function FanChart({
  fan,
  s0,
  horizonDays,
}: {
  fan: Array<{
    day: number;
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  }>;
  s0: number;
  horizonDays: number;
}) {
  if (!fan?.length) return null;

  const width = 900;
  const height = 200;
  const pad = { left: 50, right: 20, top: 15, bottom: 30 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const xs = fan.map((d) => d.day);
  const ys = fan.flatMap((d) => [d.p5, d.p95]);

  // Guard against empty arrays and division by zero
  const xMin = 0;
  const xMax = xs.length > 0 ? Math.max(...xs) : 1;
  const yMin = ys.length > 0 ? Math.min(...ys) * 0.98 : 0;
  const yMax = ys.length > 0 ? Math.max(...ys) * 1.02 : 1;

  const sx = (x: number) => xMax > 0 ? pad.left + (x / xMax) * chartW : pad.left;
  const sy = (y: number) => {
    const range = yMax - yMin;
    return range > 0 ? pad.top + (1 - (y - yMin) / range) * chartH : pad.top;
  };

  const bandPath = (upper: keyof (typeof fan)[0], lower: keyof (typeof fan)[0]) => {
    const top = fan
      .map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.day).toFixed(1)} ${sy(d[upper] as number).toFixed(1)}`)
      .join(" ");
    const bot = fan
      .slice()
      .reverse()
      .map((d) => `L ${sx(d.day).toFixed(1)} ${sy(d[lower] as number).toFixed(1)}`)
      .join(" ");
    return `${top} ${bot} Z`;
  };

  const linePath = (key: keyof (typeof fan)[0]) =>
    fan
      .map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.day).toFixed(1)} ${sy(d[key] as number).toFixed(1)}`)
      .join(" ");

  // Grid lines
  const yTicks = 5;
  const yStep = (yMax - yMin) / yTicks;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 200, display: "block" }}>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = yMin + i * yStep;
        return (
          <g key={i}>
            <line
              x1={pad.left}
              y1={sy(y)}
              x2={width - pad.right}
              y2={sy(y)}
              stroke="#222"
              strokeWidth="1"
            />
            <text x={pad.left - 8} y={sy(y) + 3} fill="#555" fontSize="9" textAnchor="end">
              {fmtPrice(y)}
            </text>
          </g>
        );
      })}

      {/* Starting price line */}
      <line
        x1={pad.left}
        y1={sy(s0)}
        x2={width - pad.right}
        y2={sy(s0)}
        stroke="#666"
        strokeWidth="1"
        strokeDasharray="4,4"
      />

      {/* Bands */}
      <path d={bandPath("p95", "p5")} fill="rgba(59, 130, 246, 0.08)" />
      <path d={bandPath("p90", "p10")} fill="rgba(59, 130, 246, 0.12)" />
      <path d={bandPath("p75", "p25")} fill="rgba(59, 130, 246, 0.18)" />

      {/* Lines */}
      <path d={linePath("p50")} fill="none" stroke="rgba(59, 130, 246, 0.95)" strokeWidth="2.5" />
      <path d={linePath("p90")} fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />
      <path d={linePath("p10")} fill="none" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />

      {/* X-axis labels */}
      {[0, Math.floor(horizonDays / 4), Math.floor(horizonDays / 2), Math.floor((3 * horizonDays) / 4), horizonDays].map(
        (day, i) => (
          <text
            key={i}
            x={sx(day)}
            y={height - 8}
            fill="#555"
            fontSize="9"
            textAnchor="middle"
          >
            {day}d
          </text>
        )
      )}

      {/* Legend */}
      <g transform={`translate(${width - 120}, ${pad.top + 10})`}>
        <rect x="0" y="0" width="10" height="10" fill="rgba(59, 130, 246, 0.95)" rx="2" />
        <text x="14" y="9" fill="#888" fontSize="9">Median (p50)</text>
        <rect x="0" y="16" width="10" height="10" fill="rgba(59, 130, 246, 0.18)" rx="2" />
        <text x="14" y="25" fill="#888" fontSize="9">p25-p75</text>
        <rect x="0" y="32" width="10" height="10" fill="rgba(59, 130, 246, 0.08)" rx="2" />
        <text x="14" y="41" fill="#888" fontSize="9">p5-p95</text>
      </g>
    </svg>
  );
}