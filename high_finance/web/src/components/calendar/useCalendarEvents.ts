/**
 * Calendar Events Hook
 * ====================
 * Fetches calendar events for the current month and watchlist
 */

import { useState, useEffect, useCallback } from "react";
import type { CalendarEventsResponse, EventType } from "./types";

const BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";

interface UseCalendarEventsOptions {
  tickers: string[];
  year: number;
  month: number; // 0-indexed (0 = January)
  eventTypes?: EventType[];
}

interface UseCalendarEventsResult {
  data: CalendarEventsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCalendarEvents({
  tickers,
  year,
  month,
  eventTypes,
}: UseCalendarEventsOptions): UseCalendarEventsResult {
  const [data, setData] = useState<CalendarEventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (tickers.length === 0) {
      setData({ events: [], by_date: {} });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate date range for the month
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0); // Last day of month

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const body = {
        tickers,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        event_types: eventTypes,
      };

      const res = await fetch(`${BASE}/calendar/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Auth token if present
          ...(localStorage.getItem("hf_access_token")
            ? { Authorization: `Bearer ${localStorage.getItem("hf_access_token")}` }
            : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const result: CalendarEventsResponse = await res.json();
      setData(result);
    } catch (err: any) {
      console.error("Failed to fetch calendar events:", err);
      setError(err?.message ?? "Failed to load events");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tickers, year, month, eventTypes]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { data, loading, error, refresh: fetchEvents };
}
