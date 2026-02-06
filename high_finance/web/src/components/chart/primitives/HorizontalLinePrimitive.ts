/**
 * HorizontalLinePrimitive
 * =======================
 * Renders a horizontal support/resistance line across the chart.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawHorizontalLine,
  drawLabel,
  drawHandle,
  isNearPoint,
  formatPrice,
} from "./BasePrimitive";

export interface HorizontalLineHitTest {
  hit: boolean;
  handleType?: "start" | "body";
}

/**
 * Render a horizontal line on the chart.
 */
export function renderHorizontalLine(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas, chartWidth } = ctx;

  if (drawing.points.length < 1) return;

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return;

  const style = drawing.style;

  // Draw the horizontal line
  drawHorizontalLine(canvas, p.y, style, { left: 0, right: chartWidth });

  // Draw price label on the right
  if (style.showLabels) {
    drawLabel(
      canvas,
      formatPrice(drawing.points[0].price),
      chartWidth - 60,
      p.y - 12,
      style,
      { align: "right", baseline: "bottom" }
    );
  }

  // Draw handle if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, 30, p.y, style, isSelected);
  }
}

/**
 * Render a preview horizontal line while drawing.
 */
export function renderHorizontalLinePreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext
): void {
  const { canvas, chartWidth } = ctx;

  if (points.length < 1) return;

  const p = pointToPixel(points[0], ctx);
  if (!p) return;

  canvas.globalAlpha = 0.6;

  drawHorizontalLine(canvas, p.y, style, { left: 0, right: chartWidth });

  if (style.showLabels) {
    drawLabel(canvas, formatPrice(points[0].price), chartWidth - 60, p.y - 12, style, {
      align: "right",
      baseline: "bottom",
    });
  }

  drawHandle(canvas, 30, p.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a horizontal line.
 */
export function hitTestHorizontalLine(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): HorizontalLineHitTest {
  const { chartWidth } = ctx;

  if (drawing.points.length < 1) {
    return { hit: false };
  }

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return { hit: false };

  // Check handle
  if (isNearPoint(mouseX, mouseY, 30, p.y, 10)) {
    return { hit: true, handleType: "start" };
  }

  // Check line (within 5px vertically)
  if (Math.abs(mouseY - p.y) <= 5 && mouseX >= 0 && mouseX <= chartWidth) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new point when dragging a horizontal line.
 */
export function dragHorizontalLine(
  drawing: ChartDrawing,
  handleType: "start" | "body",
  newPoint: DrawingPoint
): DrawingPoint[] {
  // Only update the price, keep the time
  return [{ time: drawing.points[0].time, price: newPoint.price }];
}
