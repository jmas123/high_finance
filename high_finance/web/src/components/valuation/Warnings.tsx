import { memo } from "react";
import type { Warning } from "../../lib/types";

export const WarningBadge = memo(function WarningBadge({ warning }: { warning: Warning }) {
  const colors = {
    info: { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)", text: "#60a5fa" },
    warning: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", text: "#fbbf24" },
    error: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)", text: "#f87171" },
  };
  const c = colors[warning.severity];

  return (
    <div style={{
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${c.border}`,
      background: c.bg,
      fontSize: 12,
    }}>
      <div style={{ color: c.text, fontWeight: 600, marginBottom: 2 }}>
        {warning.severity === "error" ? "⚠️" : warning.severity === "warning" ? "⚡" : "ℹ️"} {warning.message}
      </div>
      {warning.suggestion && (
        <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>{warning.suggestion}</div>
      )}
    </div>
  );
});
