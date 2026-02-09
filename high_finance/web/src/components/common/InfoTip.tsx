import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../../lib/useIsMobile";

// Module-level singleton: only one tooltip open at a time
let closeActive: (() => void) | null = null;

export function InfoTip({ text }: { text: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, flipped: false });
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      // Close any previously open tooltip
      closeActive?.();
      closeActive = close;

      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const tooltipH = 120;
        const spaceAbove = rect.top;
        const shouldFlip = spaceAbove < tooltipH + 20;

        setPos({
          top: shouldFlip ? rect.bottom + 8 : rect.top - 8,
          left: Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
          flipped: shouldFlip,
        });
      }
    } else if (closeActive === close) {
      closeActive = null;
    }
  }, [open, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (closeActive === close) closeActive = null;
    };
  }, [close]);

  const toggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => !v);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") toggle(e);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-label="More info"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: isMobile ? 28 : 15,
          height: isMobile ? 28 : 15,
          borderRadius: "50%",
          border: "1px solid #555",
          background: open ? "#3b82f6" : "transparent",
          color: open ? "#fff" : "#777",
          fontSize: 9,
          fontWeight: 700,
          cursor: "pointer",
          marginLeft: 5,
          padding: 0,
          lineHeight: 1,
          verticalAlign: "middle",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
      >
        i
      </button>

      {open &&
        createPortal(
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
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            {/* Tooltip */}
            <div
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                transform: pos.flipped
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
                width: 280,
                padding: "12px 14px",
                background: "#0a0a0a",
                border: "2px solid #3b82f6",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6,
                color: "#ddd",
                zIndex: 9999,
                boxShadow: "0 8px 32px rgba(0,0,0,0.9)",
                textAlign: "left",
              }}
            >
              {text}
              {/* Arrow */}
              <div
                style={{
                  position: "absolute",
                  ...(pos.flipped
                    ? {
                        top: -7,
                        left: "50%",
                        transform: "translateX(-50%) rotate(45deg)",
                        borderLeft: "2px solid #3b82f6",
                        borderTop: "2px solid #3b82f6",
                        borderRight: "none",
                        borderBottom: "none",
                      }
                    : {
                        bottom: -7,
                        left: "50%",
                        transform: "translateX(-50%) rotate(45deg)",
                        borderRight: "2px solid #3b82f6",
                        borderBottom: "2px solid #3b82f6",
                        borderLeft: "none",
                        borderTop: "none",
                      }),
                  width: 12,
                  height: 12,
                  background: "#0a0a0a",
                }}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
