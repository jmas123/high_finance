/**
 * Calendar Event Types
 * ====================
 */

export type EventType = "earnings" | "sec_filing" | "ex_dividend" | "catalyst";

export interface CalendarEvent {
  id: string;
  event_type: EventType;
  ticker: string;
  company_name: string | null;
  date: string; // ISO date string
  time: string | null; // BMO/AMC/TBD for earnings
  title: string;
  description: string | null;
  url: string | null;
  metadata: Record<string, any> | null;
}

export interface CalendarEventsRequest {
  tickers: string[];
  start_date: string; // ISO date
  end_date: string; // ISO date
  event_types?: EventType[];
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  by_date: Record<string, CalendarEvent[]>;
}

// Color scheme for event types
export const EVENT_COLORS: Record<EventType, string> = {
  earnings: "#f59e0b", // Amber
  sec_filing: "#3b82f6", // Blue
  ex_dividend: "#22c55e", // Green
  catalyst: "#a855f7", // Purple
};

export const EVENT_LABELS: Record<EventType, string> = {
  earnings: "Earnings",
  sec_filing: "SEC Filing",
  ex_dividend: "Ex-Dividend",
  catalyst: "Catalyst",
};
