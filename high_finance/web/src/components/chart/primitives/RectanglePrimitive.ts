/**
 * RectanglePrimitive
 * ==================
 * Renders a rectangle to highlight a price/time zone.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawRectangle,
  drawHandle,
  isNearPoint,
} from "./BasePrimitive";

export interface RectangleHitTest {
  hit: boolean;
  handleType?: "start" | "end" | "body";
}

/**
 * Render a rectangle on the chart.
 */
export function renderRectangle(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas } = ctx;

  if (drawing.points.length < 2) return;

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return;

  const style = drawing.style;

  // Draw the rectangle with fill
  drawRectangle(canvas, p1, p2, style, true);

  // Draw handles if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p1.x, p1.y, style, isSelected);
    drawHandle(canvas, p2.x, p2.y, style, isSelected);
    // Also draw corner handles for better UX
    drawHandle(canvas, p2.x, p1.y, style, isSelected);
    drawHandle(canvas, p1.x, p2.y, style, isSelected);
  }
}

/**
 * Render a preview rectangle while drawing.
 */
export function renderRectanglePreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext
): void {
  const { canvas } = ctx;

  if (points.length < 1) return;

  const p1 = pointToPixel(points[0], ctx);
  if (!p1) return;

  if (points.length === 1) {
    drawHandle(canvas, p1.x, p1.y, style, true);
    return;
  }

  const p2 = pointToPixel(points[1], ctx);
  if (!p2) return;

  canvas.globalAlpha = 0.6;

  drawRectangle(canvas, p1, p2, style, true);
  drawHandle(canvas, p1.x, p1.y, style, true);
  drawHandle(canvas, p2.x, p2.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a rectangle.
 */
export function hitTestRectangle(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): RectangleHitTest {
  if (drawing.points.length < 2) {
    return { hit: false };
  }

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return { hit: false };

  // Check corner handles
  if (isNearPoint(mouseX, mouseY, p1.x, p1.y, 10)) {
    return { hit: true, handleType: "start" };
  }

  if (isNearPoint(mouseX, mouseY, p2.x, p2.y, 10)) {
    return { hit: true, handleType: "end" };
  }

  // Check if inside rectangle
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new points when dragging a rectangle.
 */
export function dragRectangle(
  drawing: ChartDrawing,
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
