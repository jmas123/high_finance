/**
 * ChannelPrimitive
 * ================
 * Renders parallel trend lines (channel) on the chart.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawLine,
  applyFillStyle,
  drawHandle,
  isNearPoint,
  isNearLine,
} from "./BasePrimitive";

export interface ChannelHitTest {
  hit: boolean;
  handleType?: "start" | "end" | "body";
}

/**
 * Render a channel (parallel trend lines) on the chart.
 */
export function renderChannel(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas, chartWidth, chartHeight } = ctx;

  if (drawing.points.length < 2) return;

  const p1 = pointToPixel(drawing.points[0], ctx);
  const p2 = pointToPixel(drawing.points[1], ctx);

  if (!p1 || !p2) return;

  const style = drawing.style;

  // Calculate channel height (use half the price difference)
  const priceDiff = Math.abs(drawing.points[1].price - drawing.points[0].price) * 0.5;
  const channelOffset = Math.abs(p2.y - p1.y) * 0.5;

  // Draw the main trend line
  drawLine(
    canvas,
    p1,
    p2,
    style,
    { left: style.extendLeft, right: style.extendRight },
    { left: 0, right: chartWidth }
  );

  // Draw parallel line above
  const p1Above = { x: p1.x, y: p1.y - channelOffset };
  const p2Above = { x: p2.x, y: p2.y - channelOffset };
  drawLine(
    canvas,
    p1Above,
    p2Above,
    style,
    { left: style.extendLeft, right: style.extendRight },
    { left: 0, right: chartWidth }
  );

  // Draw parallel line below
  const p1Below = { x: p1.x, y: p1.y + channelOffset };
  const p2Below = { x: p2.x, y: p2.y + channelOffset };
  drawLine(
    canvas,
    p1Below,
    p2Below,
    style,
    { left: style.extendLeft, right: style.extendRight },
    { left: 0, right: chartWidth }
  );

  // Fill the channel area
  if (style.fillOpacity > 0) {
    applyFillStyle(canvas, style);
    canvas.beginPath();
    canvas.moveTo(p1Above.x, p1Above.y);
    canvas.lineTo(p2Above.x, p2Above.y);
    canvas.lineTo(p2Below.x, p2Below.y);
    canvas.lineTo(p1Below.x, p1Below.y);
    canvas.closePath();
    canvas.fill();
  }

  // Draw handles if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p1.x, p1.y, style, isSelected);
    drawHandle(canvas, p2.x, p2.y, style, isSelected);
  }
}

/**
 * Render a preview channel while drawing.
 */
export function renderChannelPreview(
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

  const channelOffset = Math.abs(p2.y - p1.y) * 0.5;

  // Main line
  drawLine(canvas, p1, p2, style, {}, { left: 0, right: chartWidth });

  // Upper line
  drawLine(
    canvas,
    { x: p1.x, y: p1.y - channelOffset },
    { x: p2.x, y: p2.y - channelOffset },
    style,
    {},
    { left: 0, right: chartWidth }
  );

  // Lower line
  drawLine(
    canvas,
    { x: p1.x, y: p1.y + channelOffset },
    { x: p2.x, y: p2.y + channelOffset },
    style,
    {},
    { left: 0, right: chartWidth }
  );

  drawHandle(canvas, p1.x, p1.y, style, true);
  drawHandle(canvas, p2.x, p2.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a channel.
 */
export function hitTestChannel(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): ChannelHitTest {
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

  const channelOffset = Math.abs(p2.y - p1.y) * 0.5;

  // Check main line
  if (isNearLine(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y, 5)) {
    return { hit: true, handleType: "body" };
  }

  // Check upper line
  if (isNearLine(mouseX, mouseY, p1.x, p1.y - channelOffset, p2.x, p2.y - channelOffset, 5)) {
    return { hit: true, handleType: "body" };
  }

  // Check lower line
  if (isNearLine(mouseX, mouseY, p1.x, p1.y + channelOffset, p2.x, p2.y + channelOffset, 5)) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new points when dragging a channel.
 */
export function dragChannel(
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
      const dx = newPoint.time - points[0].time;
      const dy = newPoint.price - points[0].price;
      points[0] = { time: points[0].time + dx, price: points[0].price + dy };
      points[1] = { time: points[1].time + dx, price: points[1].price + dy };
      break;
  }

  return points;
}
