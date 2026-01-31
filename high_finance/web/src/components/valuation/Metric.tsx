import { useState } from "react";
export function Metric({ label, value, hint, accent, tooltip }: { 
  label: string; 
  value: string; 
  hint?: string;
  accent?: "green" | "red" | "blue";
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
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
        position: "relative",
        cursor: tooltip ? "help" : "default",
      }}
      onMouseEnter={() => tooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{ 
        fontSize: 10, 
        opacity: 0.6, 
        marginBottom: 6, 
        textTransform: "uppercase", 
        letterSpacing: "0.5px",
        fontWeight: 500,
      }}>
        {label}
        {tooltip && <span style={{ marginLeft: 4, opacity: 0.5 }}>ⓘ</span>}
      </div>
      <div style={{ 
        fontSize: 18, 
        fontWeight: 700, 
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" 
      }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 5 }}>{hint}</div>}
      
      {/* Tooltip */}
      {showTooltip && tooltip && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 8,
          background: "#1a1a1a",
          border: "1px solid #444",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          width: 200,
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          color: "#ccc",
          textTransform: "none",
          letterSpacing: "normal",
          fontWeight: "normal",
        }}>
          {tooltip}
          <div style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid #444",
          }} />
        </div>
      )}
    </div>
  );
}