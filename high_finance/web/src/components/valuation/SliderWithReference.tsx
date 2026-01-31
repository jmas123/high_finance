import type { SliderReference } from "../../lib/types";
import type { Warning } from "../../lib/types";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function ReferenceMarker({ 
  reference, 
  positionPct,
  min,
  max,
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
        left: Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
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

function LabelTooltip({
  tooltip,
  triggerRef,
  onClose,
}: {
  tooltip: string;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0, flipped: false });

  useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = 100; // Approximate tooltip height
      const spaceAbove = rect.top;
      const shouldFlip = spaceAbove < tooltipHeight + 20;
      
      setPosition({
        top: shouldFlip ? rect.bottom + 10 : rect.top - 10,
        left: Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
        flipped: shouldFlip,
      });
    }
  }, [triggerRef]);

  return createPortal(
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
        onClick={onClose}
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
        border: "2px solid #3b82f6",
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.6,
        color: "#ffffff",
        zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,1)",
        textAlign: "left",
      }}>
        {tooltip}
        {/* Arrow */}
        <div style={{
          position: "absolute",
          ...(position.flipped 
            ? {
                top: -8,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                borderLeft: "2px solid #3b82f6",
                borderTop: "2px solid #3b82f6",
                borderRight: "none",
                borderBottom: "none",
              }
            : {
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
                borderRight: "2px solid #3b82f6",
                borderBottom: "2px solid #3b82f6",
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
  const [showLabelTooltip, setShowLabelTooltip] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const hasWarning = paramWarnings.some(w => w.severity === "warning" || w.severity === "error");
  const hasError = paramWarnings.some(w => w.severity === "error");

  const positionPct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

  return (
    <div style={{ 
      border: `1px solid ${hasError ? "rgba(239, 68, 68, 0.4)" : hasWarning ? "rgba(245, 158, 11, 0.4)" : "#2a2a2a"}`, 
      borderRadius: 10, 
      padding: 12, 
      background: hasError ? "rgba(239, 68, 68, 0.05)" : hasWarning ? "rgba(245, 158, 11, 0.05)" : "rgba(255,255,255,0.02)" 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div 
          ref={labelRef}
          style={{ fontSize: 12, opacity: 0.7, position: "relative", cursor: tooltip ? "help" : "default" }}
          onClick={() => tooltip && setShowLabelTooltip(!showLabelTooltip)}
        >
          {label}
          {tooltip && <span style={{ marginLeft: 4, opacity: 0.5 }}>ⓘ</span>}
          
          {/* Label tooltip */}
          {showLabelTooltip && tooltip && (
            <LabelTooltip 
              tooltip={tooltip} 
              triggerRef={labelRef} 
              onClose={() => setShowLabelTooltip(false)} 
            />
          )}
        </div>
        <div style={{ 
          fontSize: 13, 
          fontWeight: 600,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: hasError ? "#f87171" : hasWarning ? "#fbbf24" : "#3b82f6",
        }}>
          {(value * 100).toFixed(1)}%
        </div>
      </div>
      
      {/* Slider with reference markers */}
      <div style={{ position: "relative", marginTop: 12, marginBottom: 8 }}>
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

      {/* Min/Max labels */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        fontSize: 10, 
        opacity: 0.4,
        marginTop: 4,
      }}>
        <span>{(min * 100).toFixed(0)}%</span>
        <span>{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}