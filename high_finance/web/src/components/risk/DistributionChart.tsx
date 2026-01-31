export function DistributionChart({
  distribution,
  currentPrice,
}: {
  distribution: Array<{
    return_min: number;
    return_max: number;
    probability: number;
  }>;
  currentPrice: number;
}) {
  if (!distribution?.length) return null;

  const maxProb = Math.max(...distribution.map((d) => d.probability));
  const width = 900;
  const height = 140;
  const pad = { left: 40, right: 20, top: 15, bottom: 25 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const barWidth = chartW / distribution.length - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: 140, display: "block" }}
    >
      {/* Y-axis labels */}
      <text x={pad.left - 8} y={pad.top + 5} fill="#666" fontSize="9" textAnchor="end">
        {(maxProb * 100).toFixed(0)}%
      </text>
      <text x={pad.left - 8} y={height - pad.bottom} fill="#666" fontSize="9" textAnchor="end">
        0%
      </text>

      {/* Zero line */}
      <line
        x1={pad.left}
        y1={height - pad.bottom}
        x2={width - pad.right}
        y2={height - pad.bottom}
        stroke="#333"
        strokeWidth="1"
      />

      {/* Bars */}
      {distribution.map((bin, i) => {
        const x = pad.left + i * (chartW / distribution.length) + 1;
        const barH = (bin.probability / maxProb) * chartH;
        const midReturn = (bin.return_min + bin.return_max) / 2;
        const isNegative = midReturn < 0;

        return (
          <rect
            key={i}
            x={x}
            y={pad.top + chartH - barH}
            width={barWidth}
            height={barH}
            fill={isNegative ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)"}
            rx="2"
          />
        );
      })}

      {/* X-axis labels */}
      {distribution
        .filter((_, i) => i % 5 === 0 || i === distribution.length - 1)
        .map((bin, idx, arr) => {
          const originalIdx = distribution.indexOf(bin);
          const x = pad.left + originalIdx * (chartW / distribution.length) + barWidth / 2;
          return (
            <text
              key={idx}
              x={x}
              y={height - 5}
              fill="#666"
              fontSize="9"
              textAnchor="middle"
            >
              {bin.return_min.toFixed(0)}%
            </text>
          );
        })}
    </svg>
  );
}
