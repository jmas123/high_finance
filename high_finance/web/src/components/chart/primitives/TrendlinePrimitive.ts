/**
 * TrendlinePrimitive
 * ==================
 * Renders a trend line between two price points with optional extension.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawLine,
  drawLabel,
  drawHandle,
  isNearPoint,
  isNearLine,
  formatPercent,
} from "./BasePrimitive";

export interface TrendlineHitTest {
  hit: boolean;
  handleType?: "start" | "end" | "body";
}

/**
 * Render a trend line on the chart.
 */
export function renderTrendline(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas, chartWidth, chartHeight: _chartHeight } = ctx;

  if (drawing.points.length < 2) return;

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return;

  const style = drawing.style;

  // Draw the line
  drawLine(
    canvas,
    p1,
    p2,
    style,
    { left: style.extendLeft, right: style.extendRight },
    { left: 0, right: chartWidth }
  );

  // Draw labels if enabled
  if (style.showLabels) {
    const priceDiff = drawing.points[1].price - drawing.points[0].price;
    const percentChange = priceDiff / drawing.points[0].price;
    const timeDiff = drawing.points[1].time - drawing.points[0].time;
    const days = Math.round(timeDiff / 86400); // seconds to days

    // Position label at midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const label = `${formatPercent(percentChange)} (${days}d)`;
    drawLabel(canvas, label, midX, midY - 12, style, {
      align: "center",
      baseline: "bottom",
    });
  }

  // Draw handles if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p1.x, p1.y, style, isSelected);
    drawHandle(canvas, p2.x, p2.y, style, isSelected);
  }
}

/**
 * Render a preview trend line while drawing.
 */
export function renderTrendlinePreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext
): void {
  const { canvas, chartWidth } = ctx;

  if (points.length < 1) return;

  const p1 = pointToPixel(points[0], ctx);
  if (!p1) return;

  if (points.length === 1) {
    // Just draw the starting handle
    drawHandle(canvas, p1.x, p1.y, style, true);
    return;
  }

  const p2 = pointToPixel(points[1], ctx);
  if (!p2) return;

  // Draw preview line with reduced opacity
  const previewStyle = { ...style, lineWidth: style.lineWidth };
  canvas.globalAlpha = 0.6;

  drawLine(
    canvas,
    p1,
    p2,
    previewStyle,
    { left: style.extendLeft, right: style.extendRight },
    { left: 0, right: chartWidth }
  );

  // Draw handles
  drawHandle(canvas, p1.x, p1.y, style, true);
  drawHandle(canvas, p2.x, p2.y, style, true);

  // Draw label
  if (style.showLabels) {
    const priceDiff = points[1].price - points[0].price;
    const percentChange = points[0].price > 0 ? priceDiff / points[0].price : 0;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    drawLabel(canvas, formatPercent(percentChange), midX, midY - 12, style, {
      align: "center",
      baseline: "bottom",
    });
  }

  canvas.globalAlpha = 1;
}

/**
 * Hit test a trend line to check if a point is on it.
 */
export function hitTestTrendline(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): TrendlineHitTest {
  if (drawing.points.length < 2) {
    return { hit: false };
  }

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) {
    return { hit: false };
  }

  // Check handles first
  if (isNearPoint(mouseX, mouseY, p1.x, p1.y, 10)) {
    return { hit: true, handleType: "start" };
  }

  if (isNearPoint(mouseX, mouseY, p2.x, p2.y, 10)) {
    return { hit: true, handleType: "end" };
  }

  // Check line body
  if (isNearLine(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y, 5)) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new points when dragging a trendline.
 */
export function dragTrendline(
  _drawing: ChartDrawing,
  handleType: "start" | "end" | "body",
  newPoint: DrawingPoint,
  originalPoints: DrawingPoint[]
): DrawingPoint[] {
  const points = [...originalPoints];

  switch (handleType) {
    case "start":
      points[0] = newPoint;
      break;
    case "end":
      points[1] = newPoint;
      break;
    case "body":
      // Move both points by the same delta
      const dx = newPoint.time - points[0].time;
      const dy = newPoint.price - points[0].price;
      points[0] = { time: points[0].time + dx, price: points[0].price + dy };
      points[1] = { time: points[1].time + dx, price: points[1].price + dy };
      break;
  }

  return points;
}
