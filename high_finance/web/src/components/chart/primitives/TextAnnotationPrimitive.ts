/**
 * TextAnnotationPrimitive
 * =======================
 * Renders a text annotation on the chart.
 */

import type { ChartDrawing, DrawingPoint, DrawingStyle } from "../types/drawing";
import type { RenderContext } from "./BasePrimitive";
import {
  pointToPixel,
  drawLabel,
  drawHandle,
  isNearPoint,
} from "./BasePrimitive";

export interface TextAnnotationHitTest {
  hit: boolean;
  handleType?: "start" | "body";
}

/**
 * Render a text annotation on the chart.
 */
export function renderTextAnnotation(
  drawing: ChartDrawing,
  ctx: RenderContext,
  isSelected: boolean,
  isHovered: boolean
): void {
  const { canvas } = ctx;

  if (drawing.points.length < 1) return;
  if (!drawing.text_content) return;

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return;

  const style = drawing.style;

  // Draw text with background
  drawLabel(canvas, drawing.text_content, p.x, p.y, style, {
    align: "left",
    baseline: "middle",
    background: true,
    padding: 6,
  });

  // Draw handle if selected
  if (isSelected || isHovered) {
    // Calculate text bounds for handle positioning
    canvas.font = `${style.fontSize}px sans-serif`;
    const metrics = canvas.measureText(drawing.text_content);
    const textWidth = metrics.width;

    drawHandle(canvas, p.x - 8, p.y, style, isSelected);
  }
}

/**
 * Render a preview text annotation while drawing.
 */
export function renderTextAnnotationPreview(
  points: DrawingPoint[],
  style: DrawingStyle,
  ctx: RenderContext,
  textContent?: string
): void {
  const { canvas } = ctx;

  if (points.length < 1) return;

  const p = pointToPixel(points[0], ctx);
  if (!p) return;

  const text = textContent || "Text annotation";

  canvas.globalAlpha = 0.6;

  drawLabel(canvas, text, p.x, p.y, style, {
    align: "left",
    baseline: "middle",
    background: true,
    padding: 6,
  });

  drawHandle(canvas, p.x - 8, p.y, style, true);

  canvas.globalAlpha = 1;
}

/**
 * Hit test a text annotation.
 */
export function hitTestTextAnnotation(
  drawing: ChartDrawing,
  mouseX: number,
  mouseY: number,
  ctx: RenderContext
): TextAnnotationHitTest {
  if (drawing.points.length < 1 || !drawing.text_content) {
    return { hit: false };
  }

  const p = pointToPixel(drawing.points[0], ctx);
  if (!p) return { hit: false };

  const style = drawing.style;
  const { canvas } = ctx;

  // Calculate text bounds
  canvas.font = `${style.fontSize}px sans-serif`;
  const metrics = canvas.measureText(drawing.text_content);
  const textWidth = metrics.width;
  const textHeight = style.fontSize;
  const padding = 6;

  // Check handle
  if (isNearPoint(mouseX, mouseY, p.x - 8, p.y, 10)) {
    return { hit: true, handleType: "start" };
  }

  // Check text box bounds
  const boxLeft = p.x - padding;
  const boxRight = p.x + textWidth + padding;
  const boxTop = p.y - textHeight / 2 - padding;
  const boxBottom = p.y + textHeight / 2 + padding;

  if (mouseX >= boxLeft && mouseX <= boxRight && mouseY >= boxTop && mouseY <= boxBottom) {
    return { hit: true, handleType: "body" };
  }

  return { hit: false };
}

/**
 * Calculate new point when dragging a text annotation.
 */
export function dragTextAnnotation(
  drawing: ChartDrawing,
  handleType: "start" | "body",
  newPoint: DrawingPoint
): DrawingPoint[] {
  return [newPoint];
}
