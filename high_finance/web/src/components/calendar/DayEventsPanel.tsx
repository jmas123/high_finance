/**
 * Day Events Panel Component
 * ==========================
 * Shows event list for a selected day
 */

import type { CalendarEvent } from "./types";
import { EventCard } from "./EventCard";

interface DayEventsPanelProps {
  date: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onTickerClick?: (ticker: string) => void;
}

export function DayEventsPanel({
  date,
  events,
  onClose,
  onTickerClick,
}: DayEventsPanelProps) {
  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div
      style={{
        padding: 16,
        borderTop: "1px solid #333",
        maxHeight: 300,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(date)}</div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            fontSize: 16,
            cursor: "pointer",
            padding: 4,
          }}
        >
          &times;
        </button>
      </div>

      {/* Event count */}
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
        {events.length} event{events.length !== 1 ? "s" : ""}
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: "#666", textAlign: "center", padding: 20 }}>
          No events on this day
        </div>
      ) : (
        events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onTickerClick={onTickerClick}
          />
        ))
      )}
    </div>
  );
}
