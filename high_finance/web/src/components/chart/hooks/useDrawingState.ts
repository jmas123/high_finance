/**
 * useDrawingState Hook
 * ====================
 * Manages drawing mode, selection, and pending drawing state.
 */

import { useState, useCallback } from "react";
import type {
  DrawingMode,
  DrawingType,
  DrawingPoint,
  DrawingStyle,
  DrawingSelection,
  PendingDrawing,
} from "../types/drawing";

interface UseDrawingStateResult {
  // Mode
  mode: DrawingMode;
  setMode: (mode: DrawingMode) => void;
  isDrawing: boolean;

  // Selection
  selectedDrawing: DrawingSelection | null;
  selectDrawing: (id: number, handleType?: "start" | "end" | "body") => void;
  clearSelection: () => void;

  // Pending drawing (in-progress)
  pendingDrawing: PendingDrawing | null;
  startDrawing: (type: DrawingType, point: DrawingPoint, style?: DrawingStyle) => void;
  addPoint: (point: DrawingPoint) => DrawingPoint[] | null; // Returns final points if complete, null otherwise
  updateLastPoint: (point: DrawingPoint) => void;
  cancelDrawing: () => void;
  clearPendingDrawing: () => void; // Clear pending without resetting mode
  getPendingPoints: () => DrawingPoint[];

  // Style for new drawings
  currentStyle: DrawingStyle;
  setCurrentStyle: (style: DrawingStyle) => void;
  updateStyleProperty: <K extends keyof DrawingStyle>(key: K, value: DrawingStyle[K]) => void;

  // Text input for text annotations
  textInput: string;
  setTextInput: (text: string) => void;
}

const defaultStyle: DrawingStyle = {
  color: "#3b82f6",
  lineWidth: 2,
  lineStyle: "solid",
  fillOpacity: 0.1,
  showLabels: true,
  extendLeft: false,
  extendRight: false,
  fontSize: 12,
};

const requiredPoints: Record<DrawingType, number> = {
  trendline: 2,
  horizontal: 1,
  vertical: 1,
  fib_retracement: 2,
  rectangle: 2,
  channel: 2,
  text: 1,
  measure: 2,
};

/**
 * Hook for managing drawing interaction state.
 */
export function useDrawingState(): UseDrawingStateResult {
  const [mode, setMode] = useState<DrawingMode>("select");
  const [selectedDrawing, setSelectedDrawing] = useState<DrawingSelection | null>(null);
  const [pendingDrawing, setPendingDrawing] = useState<PendingDrawing | null>(null);
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>(defaultStyle);
  const [textInput, setTextInput] = useState("");

  const isDrawing = mode !== "select";

  /**
   * Set the drawing mode and clear any in-progress drawing.
   */
  const handleSetMode = useCallback((newMode: DrawingMode) => {
    setMode(newMode);
    setPendingDrawing(null);
    setSelectedDrawing(null);
  }, []);

  /**
   * Select a drawing for editing.
   */
  const selectDrawing = useCallback((id: number, handleType?: "start" | "end" | "body") => {
    setSelectedDrawing({ drawingId: id, handleType });
  }, []);

  /**
   * Clear the current selection.
   */
  const clearSelection = useCallback(() => {
    setSelectedDrawing(null);
  }, []);

  /**
   * Start a new drawing with the first point.
   */
  const startDrawing = useCallback(
    (type: DrawingType, point: DrawingPoint, style?: DrawingStyle) => {
      setPendingDrawing({
        type,
        points: [point],
        style: style || currentStyle,
        text_content: type === "text" ? textInput : undefined,
      });
    },
    [currentStyle, textInput]
  );

  /**
   * Add a point to the pending drawing.
   * Returns the final points array if complete, null otherwise.
   */
  const addPoint = useCallback(
    (point: DrawingPoint): DrawingPoint[] | null => {
      if (!pendingDrawing) return null;

      const needed = requiredPoints[pendingDrawing.type];

      // For 2-point drawings, validate that the second point is different from the first
      if (needed === 2 && pendingDrawing.points.length === 1) {
        const firstPoint = pendingDrawing.points[0];
        // Reject if time values are identical (backend requires different times for trendlines, etc.)
        if (firstPoint.time === point.time) {
          return null;
        }
      }

      const newPoints = [...pendingDrawing.points, point];

      setPendingDrawing((prev) =>
        prev ? { ...prev, points: newPoints } : null
      );

      if (newPoints.length >= needed) {
        // Drawing is complete - return the points directly (not from state!)
        return newPoints.slice(0, needed);
      }

      // Still need more points
      return null;
    },
    [pendingDrawing]
  );

  /**
   * Update the last point (for mouse move preview).
   */
  const updateLastPoint = useCallback(
    (point: DrawingPoint) => {
      if (!pendingDrawing) return;

      const needed = requiredPoints[pendingDrawing.type];

      if (pendingDrawing.points.length < needed) {
        // Add a preview point if we don't have enough yet
        const newPoints =
          pendingDrawing.points.length === 1
            ? [...pendingDrawing.points, point]
            : [...pendingDrawing.points.slice(0, -1), point];

        setPendingDrawing((prev) =>
          prev ? { ...prev, points: newPoints } : null
        );
      }
    },
    [pendingDrawing]
  );

  /**
   * Cancel the current in-progress drawing and return to select mode.
   */
  const cancelDrawing = useCallback(() => {
    setPendingDrawing(null);
    setMode("select");
  }, []);

  /**
   * Clear the pending drawing but keep the current mode (for continuous drawing).
   */
  const clearPendingDrawing = useCallback(() => {
    setPendingDrawing(null);
  }, []);

  /**
   * Get the points from the pending drawing.
   */
  const getPendingPoints = useCallback((): DrawingPoint[] => {
    return pendingDrawing?.points || [];
  }, [pendingDrawing]);

  /**
   * Update a single style property.
   */
  const updateStyleProperty = useCallback(
    <K extends keyof DrawingStyle>(key: K, value: DrawingStyle[K]) => {
      setCurrentStyle((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return {
    // Mode
    mode,
    setMode: handleSetMode,
    isDrawing,

    // Selection
    selectedDrawing,
    selectDrawing,
    clearSelection,

    // Pending drawing
    pendingDrawing,
    startDrawing,
    addPoint,
    updateLastPoint,
    cancelDrawing,
    clearPendingDrawing,
    getPendingPoints,

    // Style
    currentStyle,
    setCurrentStyle,
    updateStyleProperty,

    // Text input
    textInput,
    setTextInput,
  };
}
