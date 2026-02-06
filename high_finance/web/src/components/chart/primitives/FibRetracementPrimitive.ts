/**
 * FibRetracementPrimitive
 * =======================
 * Renders Fibonacci retracement levels between two price points.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import { FIB_LEVELS } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  applyLineStyle,
  drawLabel,
  drawHandle,
  isNearPoint,
  formatPrice,
} from "./BasePrimitive";

export interface FibRetracementHitTest {
  hit: boolean;
  handleType?: "start" | "end" | "body";
}

/**
 * Render Fibonacci retracement levels on the chart.
 */
export function renderFibRetracement(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas, chartWidth } = ctx;

  if (drawing.points.length < 2) return;

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return;

  const style = drawing.style;
  const price1 = drawing.points[0].price;
  const price2 = drawing.points[1].price;
  const priceRange = price2 - price1;

  // Draw each Fibonacci level
  for (const fib of FIB_LEVELS) {
    const price = price1 + priceRange * fib.level;
    const y = p1.y + (p2.y - p1.y) * fib.level;

    // Draw horizontal line at this level
    applyLineStyle(canvas, {
      ...style,
      lineStyle: fib.level === 0 || fib.level === 1 ? "solid" : "dashed",
      lineWidth: fib.level === 0 || fib.level === 1 ? style.lineWidth : 1,
    });

    canvas.beginPath();
    canvas.moveTo(Math.min(p1.x, p2.x) - 20, y);
    canvas.lineTo(Math.max(p1.x, p2.x) + 20, y);
    canvas.stroke();

    // Draw label
    if (style.showLabels) {
      drawLabel(
        canvas,
        `${fib.label} (${formatPrice(price)})`,
        Math.max(p1.x, p2.x) + 25,
        y,
        style,
        { align: "left", baseline: "middle", background: true }
      );
    }
  }

  // Draw handles if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p1.x, p1.y, style, isSelected);
    drawHandle(canvas, p2.x, p2.y, style, isSelected);
  }
}

/**
 * Render a preview Fibonacci retracement while drawing.
 */
export function renderFibRetracementPreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext
): void {
  const { canvas, chartWidth } = ctx;

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

  const price1 = points[0].price;
  const price2 = points[1].price;

  // Draw preview levels
  for (const fib of FIB_LEVELS) {
    const y = p1.y + (p2.y - p1.y) * fib.level;

    applyLineStyle(canvas, {
      ...style,
      lineStyle: fib.level === 0 || fib.level === 1 ? "solid" : "dashed",
      lineWidth: 1,
    });

    canvas.beginPath();
    canvas.moveTo(Math.min(p1.x, p2.x) - 20, y);
    canvas.lineTo(Math.max(p1.x, p2.x) + 20, y);
    canvas.stroke();
  }

  drawHandle(canvas, p1.x, p1.y, style, true);
  drawHandle(canvas, p2.x, p2.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a Fibonacci retracement.
 */
export function hitTestFibRetracement(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): FibRetracementHitTest {
  if (drawing.points.length < 2) {
    return { hit: false };
  }

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return { hit: false };

  // Check handles
  if (isNearPoint(mouseX, mouseY, p1.x, p1.y, 10)) {
    return { hit: true, handleType: "start" };
  }

  if (isNearPoint(mouseX, mouseY, p2.x, p2.y, 10)) {
    return { hit: true, handleType: "end" };
  }

  // Check if near any Fib level line
  const minX = Math.min(p1.x, p2.x) - 20;
  const maxX = Math.max(p1.x, p2.x) + 20;

  if (mouseX >= minX && mouseX <= maxX) {
    for (const fib of FIB_LEVELS) {
      const y = p1.y + (p2.y - p1.y) * fib.level;
      if (Math.abs(mouseY - y) <= 5) {
        return { hit: true, handleType: "body" };
      }
    }
  }

  return { hit: false };
}

/**
 * Calculate new points when dragging a Fibonacci retracement.
 */
export function dragFibRetracement(
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
      const dy = newPoint.price - points[0].price;
      points[0] = { ...points[0], price: points[0].price + dy };
      points[1] = { ...points[1], price: points[1].price + dy };
      break;
  }

  return points;
}
