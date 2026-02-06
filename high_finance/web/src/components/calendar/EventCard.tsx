/**
 * Event Card Component
 * ====================
 * Displays a single calendar event in the day panel
 */

import type { CalendarEvent } from "./types";
import { EVENT_COLORS, EVENT_LABELS } from "./types";

interface EventCardProps {
  event: CalendarEvent;
  onTickerClick?: (ticker: string) => void;
}

export function EventCard({ event, onTickerClick }: EventCardProps) {
  const color = EVENT_COLORS[event.event_type];

  return (
    <div
      style={{
        padding: 12,
        background: "#222",
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      {/* Header: Type badge + Ticker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            color,
            background: `${color}20`,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {EVENT_LABELS[event.event_type]}
        </span>

        <button
          onClick={() => onTickerClick?.(event.ticker)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {event.ticker}
        </button>

        {event.time && (
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
            {event.time}
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, color: "#ddd", marginBottom: 4 }}>
        {event.title}
      </div>

      {/* Description */}
      {event.description && (
        <div style={{ fontSize: 12, color: "#888" }}>{event.description}</div>
      )}

      {/* Company name if different from ticker */}
      {event.company_name && event.company_name !== event.ticker && (
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          {event.company_name}
        </div>
      )}
    </div>
  );
}
