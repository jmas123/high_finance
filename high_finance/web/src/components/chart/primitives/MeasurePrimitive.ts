/**
 * MeasurePrimitive
 * ================
 * Renders a measure tool showing price and time distance between two points.
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
  formatPrice,
  formatPercent,
} from "./BasePrimitive";

export interface MeasureHitTest {
  hit: boolean;
  handleType?: "start" | "end" | "body";
}

/**
 * Format time difference for display.
 */
function formatTimeDiff(seconds: number): string {
  const absSec = Math.abs(seconds);

  if (absSec < 3600) {
    return `${Math.round(absSec / 60)}m`;
  }
  if (absSec < 86400) {
    return `${(absSec / 3600).toFixed(1)}h`;
  }
  if (absSec < 604800) {
    return `${Math.round(absSec / 86400)}d`;
  }
  if (absSec < 2592000) {
    return `${(absSec / 604800).toFixed(1)}w`;
  }
  return `${(absSec / 2592000).toFixed(1)}mo`;
}

/**
 * Render a measure tool on the chart.
 */
export function renderMeasure(
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

  // Draw the line
  drawLine(canvas, p1, p2, { ...style, lineStyle: "dashed" });

  // Calculate measurements
  const priceDiff = drawing.points[1].price - drawing.points[0].price;
  const percentChange = drawing.points[0].price > 0 ? priceDiff / drawing.points[0].price : 0;
  const timeDiff = drawing.points[1].time - drawing.points[0].time;

  // Draw measurement box at midpoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  // Multi-line label
  const lines = [
    `${priceDiff >= 0 ? "+" : ""}${formatPrice(priceDiff)} (${formatPercent(percentChange)})`,
    formatTimeDiff(timeDiff),
  ];

  // Draw background box
  canvas.font = `${style.fontSize}px sans-serif`;
  const maxWidth = Math.max(...lines.map((l) => canvas.measureText(l).width));
  const lineHeight = style.fontSize + 4;
  const boxPadding = 8;
  const boxWidth = maxWidth + boxPadding * 2;
  const boxHeight = lines.length * lineHeight + boxPadding * 2;

  canvas.fillStyle = "rgba(0, 0, 0, 0.8)";
  canvas.fillRect(midX - boxWidth / 2, midY - boxHeight / 2, boxWidth, boxHeight);

  canvas.strokeStyle = style.color;
  canvas.lineWidth = 1;
  canvas.setLineDash([]);
  canvas.strokeRect(midX - boxWidth / 2, midY - boxHeight / 2, boxWidth, boxHeight);

  // Draw text
  canvas.fillStyle = style.color;
  canvas.textAlign = "center";
  canvas.textBaseline = "middle";

  lines.forEach((line, i) => {
    const y = midY - (lines.length - 1) * lineHeight / 2 + i * lineHeight;
    canvas.fillText(line, midX, y);
  });

  // Draw handles if selected
  if (isSelected || isHovered) {
    drawHandle(canvas, p1.x, p1.y, style, isSelected);
    drawHandle(canvas, p2.x, p2.y, style, isSelected);
  }
}

/**
 * Render a preview measure tool while drawing.
 */
export function renderMeasurePreview(
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

  // Draw the line
  drawLine(canvas, p1, p2, { ...style, lineStyle: "dashed" });

  // Calculate measurements
  const priceDiff = points[1].price - points[0].price;
  const percentChange = points[0].price > 0 ? priceDiff / points[0].price : 0;
  const timeDiff = points[1].time - points[0].time;

  // Draw measurement at midpoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const label = `${formatPercent(percentChange)} | ${formatTimeDiff(timeDiff)}`;
  drawLabel(canvas, label, midX, midY - 12, style, {
    align: "center",
    baseline: "bottom",
  });

  drawHandle(canvas, p1.x, p1.y, style, true);
  drawHandle(canvas, p2.x, p2.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a measure tool.
 */
export function hitTestMeasure(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): MeasureHitTest {
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

  // Check line
  if (isNearLine(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y, 5)) {
    return { hit: true, handleType: "body" };
  }

  // Check measurement box at midpoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const boxSize = 60;

  if (
    mouseX >= midX - boxSize / 2 &&
    mouseX <= midX + boxSize / 2 &&
    mouseY >= midY - boxSize / 2 &&
    mouseY <= midY + boxSize / 2
  ) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new points when dragging a measure tool.
 */
export function dragMeasure(
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
      const dx = newPoint.time - points[0].time;
      const dy = newPoint.price - points[0].price;
      points[0] = { time: points[0].time + dx, price: points[0].price + dy };
      points[1] = { time: points[1].time + dx, price: points[1].price + dy };
      break;
  }

  return points;
}
