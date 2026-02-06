/**
 * useDrawingHistory Hook
 * ======================
 * Provides local undo/redo functionality for drawing operations.
 * Note: History is cleared on page refresh (by design - see plan).
 */

import { useState, useCallback } from "react";
import type { ChartDrawing, ChartDrawingCreate } from "../types/drawing";

interface DrawingAction {
  type: "create" | "update" | "delete";
  drawing: ChartDrawing;
  previousState?: ChartDrawing | null;
}

interface UseDrawingHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => DrawingAction | null;
  redo: () => DrawingAction | null;
  recordCreate: (drawing: ChartDrawing) => void;
  recordUpdate: (drawing: ChartDrawing, previousState: ChartDrawing) => void;
  recordDelete: (drawing: ChartDrawing) => void;
  clear: () => void;
}

const MAX_HISTORY = 50;

/**
 * Hook for managing local undo/redo history for drawing operations.
 * History is intentionally not persisted and is cleared on page refresh.
 */
export function useDrawingHistory(): UseDrawingHistoryResult {
  const [history, setHistory] = useState<DrawingAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  /**
   * Add an action to the history.
   * Clears any "redo" actions when a new action is recorded.
   */
  const addAction = useCallback(
    (action: DrawingAction) => {
      setHistory((prev) => {
        // Remove any actions after current index (discard redo stack)
        const newHistory = prev.slice(0, historyIndex + 1);

        // Add new action
        newHistory.push(action);

        // Limit history size
        if (newHistory.length > MAX_HISTORY) {
          return newHistory.slice(-MAX_HISTORY);
        }

        return newHistory;
      });

      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    },
    [historyIndex]
  );

  /**
   * Record a create action.
   */
  const recordCreate = useCallback(
    (drawing: ChartDrawing) => {
      addAction({
        type: "create",
        drawing,
        previousState: null,
      });
    },
    [addAction]
  );

  /**
   * Record an update action.
   */
  const recordUpdate = useCallback(
    (drawing: ChartDrawing, previousState: ChartDrawing) => {
      addAction({
        type: "update",
        drawing,
        previousState,
      });
    },
    [addAction]
  );

  /**
   * Record a delete action.
   */
  const recordDelete = useCallback(
    (drawing: ChartDrawing) => {
      addAction({
        type: "delete",
        drawing,
        previousState: drawing,
      });
    },
    [addAction]
  );

  /**
   * Undo the last action.
   * Returns the action that was undone, or null if nothing to undo.
   */
  const undo = useCallback((): DrawingAction | null => {
    if (!canUndo) return null;

    const action = history[historyIndex];
    setHistoryIndex((prev) => prev - 1);

    return action;
  }, [canUndo, history, historyIndex]);

  /**
   * Redo the last undone action.
   * Returns the action that was redone, or null if nothing to redo.
   */
  const redo = useCallback((): DrawingAction | null => {
    if (!canRedo) return null;

    const nextIndex = historyIndex + 1;
    const action = history[nextIndex];
    setHistoryIndex(nextIndex);

    return action;
  }, [canRedo, history, historyIndex]);

  /**
   * Clear all history.
   */
  const clear = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    recordCreate,
    recordUpdate,
    recordDelete,
    clear,
  };
}

/**
 * Helper to apply an undo action to the drawings state.
 */
export function applyUndo(
  action: DrawingAction,
  drawings: ChartDrawing[]
): { drawings: ChartDrawing[]; apiAction?: { type: string; data: any } } {
  switch (action.type) {
    case "create":
      // Undo create = delete
      return {
        drawings: drawings.filter((d) => d.id !== action.drawing.id),
        apiAction: { type: "delete", data: { id: action.drawing.id } },
      };

    case "update":
      // Undo update = restore previous state
      if (action.previousState) {
        return {
          drawings: drawings.map((d) =>
            d.id === action.drawing.id ? action.previousState! : d
          ),
          apiAction: {
            type: "update",
            data: { ...action.previousState, id: action.drawing.id },
          },
        };
      }
      return { drawings };

    case "delete":
      // Undo delete = restore
      if (action.previousState) {
        return {
          drawings: [...drawings, action.previousState],
          apiAction: { type: "create", data: action.previousState },
        };
      }
      return { drawings };

    default:
      return { drawings };
  }
}

/**
 * Helper to apply a redo action to the drawings state.
 */
export function applyRedo(
  action: DrawingAction,
  drawings: ChartDrawing[]
): { drawings: ChartDrawing[]; apiAction?: { type: string; data: any } } {
  switch (action.type) {
    case "create":
      // Redo create = add back
      return {
        drawings: [...drawings, action.drawing],
        apiAction: { type: "create", data: action.drawing },
      };

    case "update":
      // Redo update = apply the update
      return {
        drawings: drawings.map((d) =>
          d.id === action.drawing.id ? action.drawing : d
        ),
        apiAction: { type: "update", data: action.drawing },
      };

    case "delete":
      // Redo delete = remove
      return {
        drawings: drawings.filter((d) => d.id !== action.drawing.id),
        apiAction: { type: "delete", data: { id: action.drawing.id } },
      };

    default:
      return { drawings };
  }
}
