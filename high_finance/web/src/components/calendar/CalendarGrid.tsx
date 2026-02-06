/**
 * Calendar Grid Component
 * =======================
 * 7-column grid showing a month of days
 */

import type { CalendarEvent } from "./types";
import { CalendarDay } from "./CalendarDay";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed
  eventsByDate: Record<string, CalendarEvent[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  year,
  month,
  eventsByDate,
  selectedDate,
  onSelectDate,
}: CalendarGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Build array of dates to display (including prev/next month padding)
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month padding
  const prevMonth = new Date(year, month, 0);
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonth.getDate() - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: new Date(year, month, day),
      isCurrentMonth: true,
    });
  }

  // Next month padding (fill to complete last row)
  const remainder = days.length % 7;
  if (remainder > 0) {
    const toAdd = 7 - remainder;
    for (let i = 1; i <= toAdd; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
  }

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const key = date.toISOString().split("T")[0];
    return eventsByDate[key] || [];
  };

  const isSameDay = (a: Date, b: Date | null): boolean => {
    if (!b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  return (
    <div>
      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: 4,
        }}
      >
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#666",
              textAlign: "center",
              padding: "4px 0",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
        }}
      >
        {days.map(({ date, isCurrentMonth }, idx) => (
          <CalendarDay
            key={`${date.toISOString()}-${idx}`}
            date={date}
            isCurrentMonth={isCurrentMonth}
            isToday={isSameDay(date, today)}
            isSelected={isSameDay(date, selectedDate)}
            events={getEventsForDate(date)}
            onClick={() => onSelectDate(date)}
          />
        ))}
      </div>
    </div>
  );
}
