/**
 * Calendar Day Component
 * ======================
 * Single day cell in the calendar grid with event dots
 */

import type { CalendarEvent, EventType } from "./types";
import { EVENT_COLORS } from "./types";

interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onClick: () => void;
}

export function CalendarDay({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  events,
  onClick,
}: CalendarDayProps) {
  // Get unique event types for dots (max 3)
  const eventTypes: EventType[] = [];
  const seen = new Set<EventType>();
  for (const e of events) {
    if (!seen.has(e.event_type)) {
      seen.add(e.event_type);
      eventTypes.push(e.event_type);
    }
    if (eventTypes.length >= 3) break;
  }

  const hasMoreEvents = events.length > 3;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        aspectRatio: "1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: 4,
        background: isSelected ? "#333" : isToday ? "#252525" : "transparent",
        border: isToday ? "1px solid #555" : "1px solid transparent",
        borderRadius: 6,
        cursor: isCurrentMonth ? "pointer" : "default",
        opacity: isCurrentMonth ? 1 : 0.3,
        transition: "background 0.15s",
      }}
      disabled={!isCurrentMonth}
    >
      {/* Day number */}
      <span
        style={{
          fontSize: 13,
          fontWeight: isToday ? 600 : 400,
          color: isSelected ? "#fff" : isToday ? "#3b82f6" : "#ccc",
        }}
      >
        {date.getDate()}
      </span>

      {/* Event dots */}
      {events.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 3,
            alignItems: "center",
            minHeight: 8,
          }}
        >
          {eventTypes.map((type, i) => (
            <span
              key={`${type}-${i}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: EVENT_COLORS[type],
              }}
            />
          ))}
          {hasMoreEvents && (
            <span style={{ fontSize: 9, color: "#888" }}>
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
