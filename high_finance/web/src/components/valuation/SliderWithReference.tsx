import type { SliderReference } from "../../lib/types";
import type { Warning } from "../../lib/types";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { InfoTip } from "../common/InfoTip";
import { useIsMobile } from "../../lib/useIsMobile";

function ReferenceMarker({
  reference,
  positionPct,
  min: _min,
  max: _max,
}: {
  reference: SliderReference;
  positionPct: number;
  min: number;
  max: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, flipped: false });
  const markerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (showTooltip && markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      const tooltipHeight = 80; // Approximate tooltip height
      const spaceAbove = rect.top;
      const shouldFlip = spaceAbove < tooltipHeight + 20;
      
      setPosition({
        top: shouldFlip ? rect.bottom + 10 : rect.top - 10,
        left: Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)),
        flipped: shouldFlip,
      });
    }
  }, [showTooltip]);
  
  return (
    <div
      ref={markerRef}
      style={{
        position: "absolute",
        left: `${positionPct}%`,
        top: 20,
        transform: "translateX(-50%)",
        zIndex: showTooltip ? 20 : 10,
      }}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      {/* Tick mark */}
      <div 
        style={{
          width: 3,
          height: 12,
          background: reference.color,
          borderRadius: 1,
          cursor: "pointer",
          transition: "transform 0.15s ease",
          transform: showTooltip ? "scaleY(1.3)" : "scaleY(1)",
        }} 
      />
      
      {/* Tooltip */}
      {showTooltip && createPortal(
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
            }}
            onClick={() => setShowTooltip(false)}
          />
          {/* Tooltip */}
          <div style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            transform: position.flipped ? "translate(-50%, 0)" : "translate(-50%, -100%)",
            width: 300,
            padding: 14,
            background: "#0a0a0a",
            border: `2px solid ${reference.color}`,
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            color: "#ffffff",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,1)",
            textAlign: "left",
          }}>
            <div style={{ fontSize: 12, color: reference.color, fontWeight: 600, marginBottom: 4 }}>
              {reference.label}
            </div>
            <div style={{ 
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}>
              {(reference.value * 100).toFixed(1)}%
            </div>
            {/* Arrow */}
            <div style={{
              position: "absolute",
              ...(position.flipped 
                ? {
                    top: -8,
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    borderLeft: `2px solid ${reference.color}`,
                    borderTop: `2px solid ${reference.color}`,
                    borderRight: "none",
                    borderBottom: "none",
                  }
                : {
                    bottom: -8,
                    left: "50%",
                    transform: "translateX(-50%) rotate(45deg)",
                    borderRight: `2px solid ${reference.color}`,
                    borderBottom: `2px solid ${reference.color}`,
                    borderLeft: "none",
                    borderTop: "none",
                  }
              ),
              width: 12,
              height: 12,
              background: "#0a0a0a",
            }} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export function SliderWithReferences({
  label,
  value,
  setValue,
  min,
  max,
  step,
  references,
  paramWarnings,
  tooltip,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
  references: SliderReference[];
  paramWarnings: Warning[];
  tooltip?: string;
}) {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const hasWarning = paramWarnings.some(w => w.severity === "warning" || w.severity === "error");
  const hasError = paramWarnings.some(w => w.severity === "error");

  const positionPct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  // Stepper functions for mobile
  const increment = () => setValue(Math.min(max, value + step));
  const decrement = () => setValue(Math.max(min, value - step));

  // Direct input handlers
  const handleValueClick = () => {
    setEditValue((value * 100).toFixed(1));
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    const parsed = parseFloat(editValue) / 100;
    if (!isNaN(parsed)) {
      setValue(Math.max(min, Math.min(max, parsed)));
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleEditSubmit();
    if (e.key === "Escape") setIsEditing(false);
  };

  return (
    <div style={{ 
      border: `1px solid ${hasError ? "rgba(239, 68, 68, 0.4)" : hasWarning ? "rgba(245, 158, 11, 0.4)" : "#2a2a2a"}`, 
      borderRadius: 10, 
      padding: 12, 
      background: hasError ? "rgba(239, 68, 68, 0.05)" : hasWarning ? "rgba(245, 158, 11, 0.05)" : "rgba(255,255,255,0.02)" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7, display: "flex", alignItems: "center" }}>
          {label}
          {tooltip && <InfoTip text={tooltip} />}
        </div>
        {/* Tappable value - click to edit directly */}
        {isEditing ? (
          <input
            autoFocus
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditSubmit}
            onKeyDown={handleEditKeyDown}
            style={{
              width: 60,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: hasError ? "#f87171" : hasWarning ? "#fbbf24" : "#3b82f6",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 4,
              padding: "2px 4px",
              textAlign: "right",
              outline: "none",
            }}
          />
        ) : (
          <div
            onClick={handleValueClick}
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: hasError ? "#f87171" : hasWarning ? "#fbbf24" : "#3b82f6",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
              transition: "background 0.15s",
            }}
            title="Click to edit"
            onMouseEnter={isMobile ? undefined : (e) => e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)"}
            onMouseLeave={isMobile ? undefined : (e) => e.currentTarget.style.background = "transparent"}
          >
            {(value * 100).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Slider with stepper buttons for mobile */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 8 }}>
        {/* Decrement button */}
        <button
          onClick={decrement}
          disabled={value <= min}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid #333",
            background: value <= min ? "#1a1a1a" : "#222",
            color: value <= min ? "#444" : "#888",
            fontSize: 16,
            fontWeight: 600,
            cursor: value <= min ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          title={`Decrease by ${(step * 100).toFixed(1)}%`}
        >
          −
        </button>

        {/* Slider */}
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            style={{
              width: "100%",
              accentColor: hasError ? "#ef4444" : hasWarning ? "#f59e0b" : "#3b82f6",
              cursor: "pointer"
            }}
          />

          {/* Reference markers with tooltips */}
          {references.map((ref, i) => (
            <ReferenceMarker
              key={i}
              reference={ref}
              positionPct={positionPct(ref.value)}
              min={min}
              max={max}
            />
          ))}
        </div>

        {/* Increment button */}
        <button
          onClick={increment}
          disabled={value >= max}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid #333",
            background: value >= max ? "#1a1a1a" : "#222",
            color: value >= max ? "#444" : "#888",
            fontSize: 16,
            fontWeight: 600,
            cursor: value >= max ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          title={`Increase by ${(step * 100).toFixed(1)}%`}
        >
          +
        </button>
      </div>

      {/* Min/Max labels */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        opacity: 0.4,
        marginTop: 4,
        paddingLeft: 36,  /* Account for stepper button width + gap */
        paddingRight: 36,
      }}>
        <span>{(min * 100).toFixed(0)}%</span>
        <span>{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}