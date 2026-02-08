/**
 * VerticalLinePrimitive
 * =====================
 * Renders a vertical line to mark a specific date/time on the chart.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawVerticalLine,
  drawLabel,
  drawHandle,
  isNearPoint,
} from "./BasePrimitive";

export interface VerticalLineHitTest {
  hit: boolean;
  handleType?: "start" | "body";
}

/**
 * Format a timestamp for display.
 */
function formatDate(timestamp: number, isIntraday: boolean): string {
  const date = new Date(timestamp * 1000);
  if (isIntraday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

/**
 * Render a vertical line on the chart.
 */
export function renderVerticalLine(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas, chartHeight, isIntraday } = ctx;

  if (drawing.points.length < 1) return;

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return;

  const style = drawing.style;

  // Draw the vertical line
  drawVerticalLine(canvas, p.x, style, { top: 0, bottom: chartHeight });

  // Draw date label at top
  if (style.showLabels) {
    drawLabel(
      canvas,
      formatDate(drawing.points[0].time, isIntraday),
      p.x,
      20,
      style,
      { align: "center", baseline: "top" }
    );
  }

  // Draw handle if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p.x, chartHeight - 30, style, isSelected);
  }
}

/**
 * Render a preview vertical line while drawing.
 */
export function renderVerticalLinePreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext
): void {
  const { canvas, chartHeight, isIntraday } = ctx;

  if (points.length < 1) return;

  const p = pointToPixel(points[0], ctx);
  if (!p) return;

  canvas.globalAlpha = 0.6;

  drawVerticalLine(canvas, p.x, style, { top: 0, bottom: chartHeight });

  if (style.showLabels) {
    drawLabel(canvas, formatDate(points[0].time, isIntraday), p.x, 20, style, {
      align: "center",
      baseline: "top",
    });
  }

  drawHandle(canvas, p.x, chartHeight - 30, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a vertical line.
 */
export function hitTestVerticalLine(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): VerticalLineHitTest {
  const { chartHeight } = ctx;

  if (drawing.points.length < 1) {
    return { hit: false };
  }

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return { hit: false };

  // Check handle
  if (isNearPoint(mouseX, mouseY, p.x, chartHeight - 30, 10)) {
    return { hit: true, handleType: "start" };
  }

  // Check line (within 5px horizontally)
  if (Math.abs(mouseX - p.x) <= 5 && mouseY >= 0 && mouseY <= chartHeight) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new point when dragging a vertical line.
 */
export function dragVerticalLine(
  drawing: ChartDrawing,
  _handleType: "start" | "body",
  newPoint: DrawingPoint
): DrawingPoint[] {
  // Only update the time, keep the price
  return [{ time: newPoint.time, price: drawing.points[0].price }];
}
