import type { CSSProperties } from "react";

// ── Primitive: a single shimmering rectangle ────────────────────────────────
const shimmerBg: CSSProperties = {
  background: "linear-gradient(90deg, #222 25%, #2a2a2a 50%, #222 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.5s ease-in-out infinite",
};

export function SkeletonBlock({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        ...shimmerBg,
        width: width ?? "100%",
        height: height ?? 16,
        borderRadius,
        ...style,
      }}
    />
  );
}

// ── Card-shaped skeleton (matches styles.cardContainer) ─────────────────────
export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div
      style={{
        marginBottom: 20,
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      {/* Title line */}
      <SkeletonBlock width="40%" height={18} style={{ marginBottom: 16 }} />
      {/* Content body */}
      <SkeletonBlock height={height - 80} style={{ marginBottom: 16 }} />
      {/* Bottom stat row */}
      <div style={{ display: "flex", gap: 12 }}>
        <SkeletonBlock width={80} height={14} />
        <SkeletonBlock width={60} height={14} />
        <SkeletonBlock width={100} height={14} />
      </div>
    </div>
  );
}

// ── Chart skeleton: toolbar + tall chart body ───────────────────────────────
export function ChartSkeleton() {
  return (
    <div
      style={{
        marginBottom: 20,
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      {/* Toolbar row (period buttons) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <SkeletonBlock width={48} height={28} borderRadius={6} />
        <SkeletonBlock width={48} height={28} borderRadius={6} />
        <SkeletonBlock width={48} height={28} borderRadius={6} />
        <SkeletonBlock width={48} height={28} borderRadius={6} />
      </div>
      {/* Chart body */}
      <SkeletonBlock height={300} borderRadius={8} />
    </div>
  );
}

// ── Full ticker page skeleton (replaces the hourglass loading state) ────────
export function TickerPageSkeleton() {
  return (
    <div>
      {/* Company name + price header */}
      <div style={{ marginBottom: 20 }}>
        <SkeletonBlock width="30%" height={28} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="20%" height={36} style={{ marginBottom: 12 }} />
        {/* Stats row */}
        <div style={{ display: "flex", gap: 16 }}>
          <SkeletonBlock width={80} height={14} />
          <SkeletonBlock width={100} height={14} />
          <SkeletonBlock width={90} height={14} />
          <SkeletonBlock width={70} height={14} />
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <SkeletonBlock width={100} height={32} borderRadius={8} />
        <SkeletonBlock width={140} height={32} borderRadius={8} />
        <SkeletonBlock width={110} height={32} borderRadius={8} />
      </div>

      {/* Price chart */}
      <ChartSkeleton />

      {/* Two-column grid (DCF + Risk) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Two more stacked cards */}
      <CardSkeleton height={160} />
      <CardSkeleton height={160} />
    </div>
  );
}
