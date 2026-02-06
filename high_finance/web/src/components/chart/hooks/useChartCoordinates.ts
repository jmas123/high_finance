/**
 * useChartCoordinates Hook
 * ========================
 * Provides period-aware coordinate conversion between pixel and price/time coordinates.
 * Handles the complexity of intraday (UTCTimestamp) vs daily (BusinessDay string) chart formats.
 */

import { useCallback } from "react";
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import type { DrawingPoint } from "../types/drawing";

interface PriceData {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface UseChartCoordinatesResult {
  /**
   * Convert pixel coordinates to drawing point (time + price)
   */
  pixelToCoords: (x: number, y: number) => DrawingPoint | null;

  /**
   * Convert drawing point to pixel coordinates
   */
  coordsToPixel: (point: DrawingPoint) => { x: number; y: number } | null;

  /**
   * Get the chart's Time format for a DrawingPoint
   */
  getTimeForChart: (point: DrawingPoint) => Time;

  /**
   * Clamp a timestamp to the nearest trading session
   */
  clampToTradingTime: (time: number) => number;
}

/**
 * Hook for period-aware coordinate conversion on lightweight-charts.
 *
 * @param chart - The chart API instance
 * @param series - The candlestick series API instance
 * @param chartData - The price data array
 * @param isIntraday - Whether the chart is showing intraday data (1D, 5D)
 */
export function useChartCoordinates(
  chart: IChartApi | null,
  series: ISeriesApi<"Candlestick"> | null,
  chartData: PriceData[],
  isIntraday: boolean
): UseChartCoordinatesResult {
  /**
   * Clamp a Unix timestamp to the nearest trading session.
   * This handles weekends/holidays where the exact time may not exist on the chart.
   */
  const clampToTradingTime = useCallback(
    (time: number): number => {
      if (chartData.length === 0) return time;

      const tradingTimes = chartData.map((d) => d.timestamp);

      // Find the closest trading time
      return tradingTimes.reduce((prev, curr) =>
        Math.abs(curr - time) < Math.abs(prev - time) ? curr : prev
      );
    },
    [chartData]
  );

  /**
   * Convert stored timestamp to chart's expected Time format.
   * Intraday charts use UTCTimestamp (number), daily+ charts use "YYYY-MM-DD" strings.
   */
  const getTimeForChart = useCallback(
    (point: DrawingPoint): Time => {
      if (isIntraday) {
        return point.time as UTCTimestamp;
      }
      // Convert Unix timestamp to YYYY-MM-DD string for daily charts
      const date = new Date(point.time * 1000);
      return date.toISOString().slice(0, 10);
    },
    [isIntraday]
  );

  /**
   * Convert pixel coordinates to a DrawingPoint.
   */
  const pixelToCoords = useCallback(
    (x: number, y: number): DrawingPoint | null => {
      console.log("[Coords] pixelToCoords called with:", { x, y });
      console.log("[Coords] chart:", chart ? "exists" : "null", "series:", series ? "exists" : "null");

      if (!chart || !series) {
        console.log("[Coords] Chart or series is null, returning null");
        return null;
      }

      const time = chart.timeScale().coordinateToTime(x);
      const price = series.coordinateToPrice(y);
      console.log("[Coords] Converted:", { time, price });

      if (time === null || price === null) {
        console.log("[Coords] Time or price is null, returning null");
        return null;
      }

      // Convert Time to Unix timestamp
      let timestamp: number;
      if (typeof time === "number") {
        // Already a UTCTimestamp (intraday)
        timestamp = time;
      } else if (typeof time === "string") {
        // BusinessDay string "YYYY-MM-DD" (daily+)
        timestamp = new Date(time).getTime() / 1000;
      } else {
        // BusinessDay object { year, month, day }
        const { year, month, day } = time as { year: number; month: number; day: number };
        timestamp = new Date(year, month - 1, day).getTime() / 1000;
      }

      // Clamp to nearest trading session to handle gaps
      const clampedTime = clampToTradingTime(timestamp);

      return { time: clampedTime, price };
    },
    [chart, series, clampToTradingTime]
  );

  /**
   * Convert a DrawingPoint to pixel coordinates.
   */
  const coordsToPixel = useCallback(
    (point: DrawingPoint): { x: number; y: number } | null => {
      if (!chart || !series) return null;

      const chartTime = getTimeForChart(point);
      const x = chart.timeScale().timeToCoordinate(chartTime);
      const y = series.priceToCoordinate(point.price);

      if (x === null || y === null) return null;
      return { x, y };
    },
    [chart, series, getTimeForChart]
  );

  return {
    pixelToCoords,
    coordsToPixel,
    getTimeForChart,
    clampToTradingTime,
  };
}

/**
 * Determine if a period string represents intraday data.
 */
export function isIntradayPeriod(period: string): boolean {
  return period === "1d" || period === "5d";
}

/**
 * Get visible price range from chart data.
 */
export function getVisiblePriceRange(
  chartData: PriceData[]
): { min: number; max: number } | null {
  if (chartData.length === 0) return null;

  const lows = chartData.map((d) => d.low);
  const highs = chartData.map((d) => d.high);

  return {
    min: Math.min(...lows),
    max: Math.max(...highs),
  };
}

/**
 * Get visible time range from chart data.
 */
export function getVisibleTimeRange(
  chartData: PriceData[]
): { start: number; end: number } | null {
  if (chartData.length === 0) return null;

  return {
    start: chartData[0].timestamp,
    end: chartData[chartData.length - 1].timestamp,
  };
}
