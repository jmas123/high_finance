/**
 * Chart Drawing Types
 * ===================
 * TypeScript types for chart annotation/drawing tools.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DrawingType =
  | "trendline"
  | "horizontal"
  | "vertical"
  | "fib_retracement"
  | "rectangle"
  | "channel"
  | "text"
  | "measure";

export type LineStyle = "solid" | "dashed" | "dotted";

// ═══════════════════════════════════════════════════════════════════════════════
// POINT AND STYLE
// ═══════════════════════════════════════════════════════════════════════════════

export interface DrawingPoint {
  time: number;   // Unix timestamp in seconds
  price: number;  // Price level
}

export interface DrawingStyle {
  color: string;           // Hex color (e.g., "#3b82f6")
  lineWidth: number;       // 1-10
  lineStyle: LineStyle;
  fillColor?: string;      // Hex color for filled areas
  fillOpacity: number;     // 0-1
  showLabels: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  fontSize: number;        // 8-24 for text annotations
}

// Default style for new drawings
export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: "#3b82f6",
  lineWidth: 2,
  lineStyle: "solid",
  fillOpacity: 0.1,
  showLabels: true,
  extendLeft: false,
  extendRight: false,
  fontSize: 12,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHART DRAWING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChartDrawing {
  id: number;
  user_id: string;
  ticker: string;
  drawing_type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  text_content?: string | null;
  is_visible: boolean;
  is_locked: boolean;
  layer_order: number;
  version: number;
  created_at: string;
  updated_at?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChartDrawingCreate {
  ticker: string;
  drawing_type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  text_content?: string;
  is_visible?: boolean;
  is_locked?: boolean;
  layer_order?: number;
}

export interface ChartDrawingUpdate {
  version: number;  // Required for optimistic concurrency
  points?: DrawingPoint[];
  style?: DrawingStyle;
  text_content?: string;
  is_visible?: boolean;
  is_locked?: boolean;
  layer_order?: number;
}

export interface ChartDrawingList {
  items: ChartDrawing[];
  total: number;
}

export interface BatchDrawingCreate {
  drawings: ChartDrawingCreate[];
}

export interface BatchDrawingResponse {
  created: ChartDrawing[];
  errors: Array<{ index: number; error: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWING STATE
// ═══════════════════════════════════════════════════════════════════════════════

export type DrawingMode = "select" | DrawingType;

export interface PendingDrawing {
  type: DrawingType;
  points: DrawingPoint[];
  style: DrawingStyle;
  text_content?: string;
}

export interface DrawingSelection {
  drawingId: number;
  handleType?: "start" | "end" | "body";
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWING TOOL METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface DrawingToolInfo {
  type: DrawingType;
  label: string;
  icon: string;        // Emoji icon
  description: string;
  requiredPoints: number;
}

export const DRAWING_TOOLS: DrawingToolInfo[] = [
  {
    type: "trendline",
    label: "Trend Line",
    icon: "📈",
    description: "Draw a line between two points",
    requiredPoints: 2,
  },
  {
    type: "horizontal",
    label: "Horizontal Line",
    icon: "➖",
    description: "Draw a horizontal support/resistance line",
    requiredPoints: 1,
  },
  {
    type: "vertical",
    label: "Vertical Line",
    icon: "|",
    description: "Mark a specific date/time",
    requiredPoints: 1,
  },
  {
    type: "fib_retracement",
    label: "Fibonacci",
    icon: "🌀",
    description: "Draw Fibonacci retracement levels",
    requiredPoints: 2,
  },
  {
    type: "rectangle",
    label: "Rectangle",
    icon: "▢",
    description: "Highlight a price/time zone",
    requiredPoints: 2,
  },
  {
    type: "channel",
    label: "Channel",
    icon: "⫽",
    description: "Draw parallel trend lines",
    requiredPoints: 2,
  },
  {
    type: "text",
    label: "Text",
    icon: "T",
    description: "Add a text annotation",
    requiredPoints: 1,
  },
  {
    type: "measure",
    label: "Measure",
    icon: "📏",
    description: "Measure price/time distance",
    requiredPoints: 2,
  },
];

// Helper to get tool info by type
export function getDrawingToolInfo(type: DrawingType): DrawingToolInfo | undefined {
  return DRAWING_TOOLS.find((t) => t.type === type);
}

// Required points per drawing type
export const REQUIRED_POINTS: Record<DrawingType, number> = {
  trendline: 2,
  horizontal: 1,
  vertical: 1,
  fib_retracement: 2,
  rectangle: 2,
  channel: 2,
  text: 1,
  measure: 2,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIBONACCI LEVELS
// ═══════════════════════════════════════════════════════════════════════════════

export const FIB_LEVELS = [
  { level: 0, label: "0%" },
  { level: 0.236, label: "23.6%" },
  { level: 0.382, label: "38.2%" },
  { level: 0.5, label: "50%" },
  { level: 0.618, label: "61.8%" },
  { level: 0.786, label: "78.6%" },
  { level: 1, label: "100%" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════════

export const DRAWING_COLORS = [
  "#3b82f6", // Blue
  "#22c55e", // Green
  "#ef4444", // Red
  "#f59e0b", // Orange
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#ffffff", // White
  "#6b7280", // Gray
];
