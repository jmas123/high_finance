/**
 * Calendar Popup Button Component
 * ================================
 * Calendar icon button that opens the calendar popup
 */

import { useState } from "react";
import { CalendarPopup } from "./CalendarPopup";
import { useIsMobile } from "../../lib/useIsMobile";

interface CalendarPopupButtonProps {
  onTickerClick?: (ticker: string) => void;
}

export function CalendarPopupButton({ onTickerClick }: CalendarPopupButtonProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Events Calendar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          background: "#222",
          border: "1px solid #444",
          borderRadius: 8,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={isMobile ? undefined : (e) => {
          e.currentTarget.style.background = "#333";
          e.currentTarget.style.borderColor = "#555";
        }}
        onMouseLeave={isMobile ? undefined : (e) => {
          e.currentTarget.style.background = "#222";
          e.currentTarget.style.borderColor = "#444";
        }}
      >
        <span style={{ fontSize: 16 }}>📅</span>
      </button>

      <CalendarPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTickerClick={onTickerClick}
      />
    </>
  );
}
