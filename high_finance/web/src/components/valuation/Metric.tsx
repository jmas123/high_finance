import { memo } from "react";
import { InfoTip } from "../common/InfoTip";

export const Metric = memo(function Metric({ label, value, hint, accent, tooltip }: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "red" | "blue";
  tooltip?: string;
}) {
  const colors = {
    green: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.25)" },
    red: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.25)" },
    blue: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.25)" },
  };
  const style = accent ? colors[accent] : { bg: "rgba(255,255,255,0.02)", border: "#2a2a2a" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${style.border}`,
        background: style.bg,
      }}
    >
      <div style={{
        fontSize: 10,
        opacity: 0.6,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
      }}>
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
      }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 5 }}>{hint}</div>}
    </div>
  );
});