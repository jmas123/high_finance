/**
 * Calendar Popup Component
 * ========================
 * Modal overlay with month view calendar
 */

import { useState, useMemo } from "react";
import { useUserData } from "../../lib/userData";
import { useCalendarEvents } from "./useCalendarEvents";
import { CalendarGrid } from "./CalendarGrid";
import { DayEventsPanel } from "./DayEventsPanel";
import type { EventType } from "./types";
import { EVENT_COLORS, EVENT_LABELS } from "./types";

interface CalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onTickerClick?: (ticker: string) => void;
}

export function CalendarPopup({ isOpen, onClose, onTickerClick }: CalendarPopupProps) {
  const { watchlist } = useUserData();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [enabledTypes, setEnabledTypes] = useState<EventType[]>([
    "earnings",
    "ex_dividend",
    "catalyst",
  ]);

  // Get tickers from watchlist
  const tickers = useMemo(
    () => watchlist.map((w) => w.ticker),
    [watchlist]
  );

  // Fetch events
  const { data, loading, error } = useCalendarEvents({
    tickers,
    year,
    month,
    eventTypes: enabledTypes.length > 0 ? enabledTypes : undefined,
  });

  // Navigation
  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(null);
  };

  // Filter toggle
  const toggleEventType = (type: EventType) => {
    setEnabledTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate || !data) return [];
    const key = selectedDate.toISOString().split("T")[0];
    return data.by_date[key] || [];
  }, [selectedDate, data]);

  // Month name
  const monthName = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 12,
          width: 420,
          maxWidth: "min(90vw, 480px)",
          border: "1px solid #333",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Prev button */}
            <button
              onClick={goToPrevMonth}
              style={{
                background: "#222",
                border: "1px solid #444",
                borderRadius: 4,
                color: "#fff",
                fontSize: 14,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              &lsaquo;
            </button>

            {/* Month/Year */}
            <span style={{ fontSize: 16, fontWeight: 600, minWidth: 140, textAlign: "center" }}>
              {monthName}
            </span>

            {/* Next button */}
            <button
              onClick={goToNextMonth}
              style={{
                background: "#222",
                border: "1px solid #444",
                borderRadius: 4,
                color: "#fff",
                fontSize: 14,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              &rsaquo;
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Today button */}
            <button
              onClick={goToToday}
              style={{
                background: "transparent",
                border: "1px solid #444",
                borderRadius: 4,
                color: "#888",
                fontSize: 12,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Today
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                fontSize: 20,
                cursor: "pointer",
                padding: 4,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Event type filters */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 16px",
            borderBottom: "1px solid #333",
            flexWrap: "wrap",
          }}
        >
          {(["earnings", "ex_dividend", "catalyst"] as EventType[]).map((type) => {
            const isActive = enabledTypes.includes(type);
            const color = EVENT_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => toggleEventType(type)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  background: isActive ? `${color}20` : "transparent",
                  border: `1px solid ${isActive ? color : "#444"}`,
                  borderRadius: 999,
                  color: isActive ? color : "#888",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isActive ? color : "#666",
                  }}
                />
                {EVENT_LABELS[type]}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          {/* Empty watchlist message */}
          {tickers.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#888",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128197;</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                Add tickers to your watchlist
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Events for your watchlist will appear here
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && tickers.length > 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
              Loading events...
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                padding: 12,
                background: "#3b1818",
                border: "1px solid #7f1d1d",
                borderRadius: 8,
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Calendar grid */}
          {!loading && tickers.length > 0 && data && (
            <CalendarGrid
              year={year}
              month={month}
              eventsByDate={data.by_date}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}

          {/* No events message */}
          {!loading && tickers.length > 0 && data && data.events.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 20,
                color: "#888",
                fontSize: 13,
                marginTop: 12,
              }}
            >
              No events in {monthName}
            </div>
          )}
        </div>

        {/* Selected day panel */}
        {selectedDate && (
          <DayEventsPanel
            date={selectedDate}
            events={selectedDateEvents}
            onClose={() => setSelectedDate(null)}
            onTickerClick={(ticker) => {
              onTickerClick?.(ticker);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
