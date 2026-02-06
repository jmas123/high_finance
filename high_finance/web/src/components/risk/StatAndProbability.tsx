import { memo } from "react";

export const Stat = memo(function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "red" | "blue" | "amber";
}) {
  const accentColors = {
    green: "rgba(34, 197, 94, 0.15)",
    red: "rgba(239, 68, 68, 0.15)",
    blue: "rgba(59, 130, 246, 0.15)",
    amber: "rgba(245, 158, 11, 0.15)",
  };
  const borderColors = {
    green: "rgba(34, 197, 94, 0.3)",
    red: "rgba(239, 68, 68, 0.3)",
    blue: "rgba(59, 130, 246, 0.3)",
    amber: "rgba(245, 158, 11, 0.3)",
  };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${accent ? borderColors[accent] : "#2a2a2a"}`,
        background: accent ? accentColors[accent] : "rgba(255,255,255,0.02)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.6,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>{hint}</div>
      )}
    </div>
  );
});

export const ProbabilityBar = memo(function ProbabilityBar({
  label,
  probability,
  color = "#3b82f6",
}: {
  label: string;
  probability: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, probability)) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        <span style={{ opacity: 0.8 }}>{label}</span>
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 600,
          }}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
});
