import { useState, memo } from "react";
import { fmtPctSigned, fmtPx, fmtPct } from "../Functions";

export const ScenarioCard = memo(function ScenarioCard({
  scenario,
  fairValue,
  upsidePct,
  inputs,
  color,
  description,
}: {
  scenario: "bear" | "base" | "bull";
  fairValue: number;
  upsidePct: number | null;
  inputs: { growth: number; margin: number; wacc: number };
  color: string;
  description: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      style={{ 
        padding: 14, 
        borderRadius: 10, 
        border: `1px solid ${color}33`, 
        background: `${color}11`, 
        textAlign: "center",
        position: "relative",
        cursor: "help",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", opacity: 0.6, letterSpacing: "0.5px" }}>
        {scenario}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color }}>
        {fmtPx(fairValue)}
      </div>
      {upsidePct !== null && (
        <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
          {fmtPctSigned(upsidePct)} vs current
        </div>
      )}
      <div style={{ fontSize: 9, marginTop: 6, opacity: 0.5 }}>
        g: {fmtPct(inputs.growth, 0)} • m: {fmtPct(inputs.margin, 0)} • wacc: {fmtPct(inputs.wacc, 0)}
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 8,
          background: "#1a1a1a",
          border: `1px solid ${color}66`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.5,
          width: 200,
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          color: "#ccc",
          textAlign: "left",
        }}>
          <div style={{ fontWeight: 600, color, marginBottom: 6, textTransform: "uppercase", fontSize: 10 }}>
            {scenario} Case
          </div>
          {description}
          <div style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid ${color}66`,
          }} />
        </div>
      )}
    </div>
  );
});
