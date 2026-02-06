/**
 * BasePrimitive
 * =============
 * Shared utilities for drawing primitives on lightweight-charts.
 * Provides coordinate conversion and common rendering helpers.
 */

import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import type { DrawingPoint, DrawingStyle } from "../types/drawing";

export interface RenderContext {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  canvas: CanvasRenderingContext2D;
  isIntraday: boolean;
  chartWidth: number;
  chartHeight: number;
}

/**
 * Convert a DrawingPoint to pixel coordinates.
 */
export function pointToPixel(
  point: DrawingPoint,
  ctx: RenderContext
): { x: number; y: number } | null {
  const { chart, series, isIntraday } = ctx;

  // Convert timestamp to chart's expected Time format
  const chartTime: Time = isIntraday
    ? (point.time as UTCTimestamp)
    : new Date(point.time * 1000).toISOString().slice(0, 10);

  const x = chart.timeScale().timeToCoordinate(chartTime);
  const y = series.priceToCoordinate(point.price);

  if (x === null || y === null) return null;
  return { x, y };
}

/**
 * Apply line style to canvas context.
 */
export function applyLineStyle(
  canvas: CanvasRenderingContext2D,
  style: DrawingStyle
): void {
  canvas.strokeStyle = style.color;
  canvas.lineWidth = style.lineWidth;

  switch (style.lineStyle) {
    case "dashed":
      canvas.setLineDash([8, 4]);
      break;
    case "dotted":
      canvas.setLineDash([2, 4]);
      break;
    default:
      canvas.setLineDash([]);
  }
}

/**
 * Apply fill style to canvas context.
 */
export function applyFillStyle(
  canvas: CanvasRenderingContext2D,
  style: DrawingStyle
): void {
  const color = style.fillColor || style.color;
  const opacity = style.fillOpacity;

  // Parse hex color and apply opacity
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  canvas.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Draw a line between two pixel points.
 */
export function drawLine(
  canvas: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  style: DrawingStyle,
  extend?: { left?: boolean; right?: boolean },
  bounds?: { left: number; right: number }
): void {
  applyLineStyle(canvas, style);

  let x1 = p1.x;
  let y1 = p1.y;
  let x2 = p2.x;
  let y2 = p2.y;

  // Handle line extension
  if (extend && bounds) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx !== 0) {
      const slope = dy / dx;

      if (extend.left) {
        const extX = bounds.left;
        const extY = y1 + slope * (extX - x1);
        x1 = extX;
        y1 = extY;
      }

      if (extend.right) {
        const extX = bounds.right;
        const extY = y1 + slope * (extX - x1);
        x2 = extX;
        y2 = extY;
      }
    }
  }

  canvas.beginPath();
  canvas.moveTo(x1, y1);
  canvas.lineTo(x2, y2);
  canvas.stroke();
}

/**
 * Draw a horizontal line across the chart.
 */
export function drawHorizontalLine(
  canvas: CanvasRenderingContext2D,
  y: number,
  style: DrawingStyle,
  bounds: { left: number; right: number }
): void {
  applyLineStyle(canvas, style);

  canvas.beginPath();
  canvas.moveTo(bounds.left, y);
  canvas.lineTo(bounds.right, y);
  canvas.stroke();
}

/**
 * Draw a vertical line across the chart.
 */
export function drawVerticalLine(
  canvas: CanvasRenderingContext2D,
  x: number,
  style: DrawingStyle,
  bounds: { top: number; bottom: number }
): void {
  applyLineStyle(canvas, style);

  canvas.beginPath();
  canvas.moveTo(x, bounds.top);
  canvas.lineTo(x, bounds.bottom);
  canvas.stroke();
}

/**
 * Draw a rectangle between two points.
 */
export function drawRectangle(
  canvas: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  style: DrawingStyle,
  fill = true
): void {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);

  if (fill) {
    applyFillStyle(canvas, style);
    canvas.fillRect(x, y, width, height);
  }

  applyLineStyle(canvas, style);
  canvas.strokeRect(x, y, width, height);
}

/**
 * Draw a label on the chart.
 */
export function drawLabel(
  canvas: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: DrawingStyle,
  options?: {
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    background?: boolean;
    padding?: number;
  }
): void {
  const {
    align = "left",
    baseline = "middle",
    background = true,
    padding = 4,
  } = options || {};

  canvas.font = `${style.fontSize}px sans-serif`;
  canvas.textAlign = align;
  canvas.textBaseline = baseline;

  if (background) {
    const metrics = canvas.measureText(text);
    const textWidth = metrics.width;
    const textHeight = style.fontSize;

    // Calculate background position based on alignment
    let bgX = x - padding;
    if (align === "center") bgX = x - textWidth / 2 - padding;
    if (align === "right") bgX = x - textWidth - padding;

    let bgY = y - textHeight / 2 - padding;
    if (baseline === "top") bgY = y - padding;
    if (baseline === "bottom") bgY = y - textHeight - padding;

    // Draw background
    canvas.fillStyle = "rgba(0, 0, 0, 0.7)";
    canvas.fillRect(bgX, bgY, textWidth + padding * 2, textHeight + padding * 2);
  }

  // Draw text
  canvas.fillStyle = style.color;
  canvas.fillText(text, x, y);
}

/**
 * Draw a handle (draggable point) on the chart.
 */
export function drawHandle(
  canvas: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: DrawingStyle,
  isSelected = false
): void {
  const radius = isSelected ? 6 : 4;

  canvas.beginPath();
  canvas.arc(x, y, radius, 0, Math.PI * 2);

  if (isSelected) {
    canvas.fillStyle = style.color;
    canvas.fill();
    canvas.strokeStyle = "#fff";
    canvas.lineWidth = 2;
    canvas.stroke();
  } else {
    canvas.fillStyle = "#fff";
    canvas.fill();
    canvas.strokeStyle = style.color;
    canvas.lineWidth = 2;
    canvas.stroke();
  }
}

/**
 * Check if a point is near another point (for hit testing).
 */
export function isNearPoint(
  px: number,
  py: number,
  targetX: number,
  targetY: number,
  threshold = 10
): boolean {
  const dx = px - targetX;
  const dy = py - targetY;
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Check if a point is near a line segment (for hit testing).
 */
export function isNearLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  threshold = 5
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return isNearPoint(px, py, x1, y1, threshold);
  }

  // Project point onto line
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return isNearPoint(px, py, projX, projY, threshold);
}

/**
 * Format price for display.
 */
export function formatPrice(price: number): string {
  if (Math.abs(price) >= 1000) {
    return price.toFixed(2);
  }
  if (Math.abs(price) >= 1) {
    return price.toFixed(2);
  }
  return price.toFixed(4);
}

/**
 * Format percentage for display.
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
