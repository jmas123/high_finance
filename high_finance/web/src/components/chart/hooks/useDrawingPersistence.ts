/**
 * useDrawingPersistence Hook
 * ==========================
 * Manages CRUD operations for chart drawings with optimistic updates,
 * conflict handling, and debounced saves for drag operations.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../../lib/api";
import type {
  ChartDrawing,
  ChartDrawingCreate,
  ChartDrawingUpdate,
} from "../types/drawing";

interface UseDrawingPersistenceResult {
  drawings: ChartDrawing[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  loadDrawings: () => Promise<void>;
  createDrawing: (data: ChartDrawingCreate) => Promise<ChartDrawing | null>;
  updateDrawing: (id: number, updates: Partial<ChartDrawingUpdate>) => void;
  updateDrawingImmediate: (id: number, updates: Partial<ChartDrawingUpdate>) => Promise<ChartDrawing | null>;
  deleteDrawing: (id: number) => Promise<boolean>;
  deleteAllDrawings: () => Promise<number>;
  getDrawing: (id: number) => ChartDrawing | undefined;
}

/**
 * Hook for managing chart drawing persistence with the API.
 *
 * @param ticker - The stock ticker symbol
 * @param isAuthenticated - Whether the user is authenticated
 * @param debounceMs - Debounce delay for updates (default 300ms)
 */
export function useDrawingPersistence(
  ticker: string,
  isAuthenticated: boolean,
  debounceMs = 300
): UseDrawingPersistenceResult {
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track pending updates for debouncing
  const pendingUpdates = useRef<Map<number, { updates: Partial<ChartDrawingUpdate>; timer: ReturnType<typeof setTimeout> }>>(
    new Map()
  );

  // Load drawings when ticker changes
  useEffect(() => {
    if (!isAuthenticated || !ticker) {
      setDrawings([]);
      return;
    }

    loadDrawings();

    // Cleanup pending updates on unmount
    return () => {
      // Flush all pending updates
      pendingUpdates.current.forEach((pending, id) => {
        clearTimeout(pending.timer);
        // Fire and forget the final update
        const drawing = drawings.find((d) => d.id === id);
        if (drawing) {
          api.drawings.update(id, { version: drawing.version, ...pending.updates }).catch(() => {});
        }
      });
      pendingUpdates.current.clear();
    };
  }, [ticker, isAuthenticated]);

  const loadDrawings = useCallback(async () => {
    if (!isAuthenticated || !ticker) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.drawings.list(ticker);
      setDrawings(result.items);
    } catch (e: any) {
      setError("Failed to load drawings");
      console.error("Failed to load drawings:", e);
    } finally {
      setLoading(false);
    }
  }, [ticker, isAuthenticated]);

  const createDrawing = useCallback(
    async (data: ChartDrawingCreate): Promise<ChartDrawing | null> => {
      if (!isAuthenticated) {
        setError("Please sign in to save drawings");
        return null;
      }

      try {
        const created = await api.drawings.create(data);
        setDrawings((prev) => [...prev, created]);
        return created;
      } catch (e: any) {
        if (e.status === 400) {
          setError(e.message || "Invalid drawing data");
        } else {
          setError("Failed to save drawing");
        }
        console.error("Failed to create drawing:", e);
        return null;
      }
    },
    [isAuthenticated]
  );

  /**
   * Debounced update for drag operations.
   * Applies optimistic update immediately, but delays API call.
   */
  const updateDrawing = useCallback(
    (id: number, updates: Partial<ChartDrawingUpdate>) => {
      // Find the current drawing
      const drawing = drawings.find((d) => d.id === id);
      if (!drawing) return;

      // Apply optimistic update immediately
      setDrawings((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );

      // Cancel existing pending update for this drawing
      const existing = pendingUpdates.current.get(id);
      if (existing) {
        clearTimeout(existing.timer);
      }

      // Merge updates
      const mergedUpdates = existing
        ? { ...existing.updates, ...updates }
        : updates;

      // Schedule debounced API call
      const timer = setTimeout(async () => {
        pendingUpdates.current.delete(id);

        try {
          const updated = await api.drawings.update(id, {
            version: drawing.version,
            ...mergedUpdates,
          });
          // Update with server response (new version)
          setDrawings((prev) => prev.map((d) => (d.id === id ? updated : d)));
        } catch (e: any) {
          // Rollback on conflict
          if (e.status === 409) {
            setError("Drawing was modified elsewhere. Refreshing...");
            await loadDrawings();
          } else {
            // Rollback to original
            setDrawings((prev) => prev.map((d) => (d.id === id ? drawing : d)));
            setError("Failed to save changes");
          }
          console.error("Failed to update drawing:", e);
        }
      }, debounceMs);

      pendingUpdates.current.set(id, { updates: mergedUpdates, timer });
    },
    [drawings, debounceMs, loadDrawings]
  );

  /**
   * Immediate update (no debounce) for critical changes.
   */
  const updateDrawingImmediate = useCallback(
    async (id: number, updates: Partial<ChartDrawingUpdate>): Promise<ChartDrawing | null> => {
      // Cancel any pending debounced update
      const pending = pendingUpdates.current.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingUpdates.current.delete(id);
      }

      const drawing = drawings.find((d) => d.id === id);
      if (!drawing) return null;

      // Apply optimistic update
      setDrawings((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );

      try {
        const updated = await api.drawings.update(id, {
          version: drawing.version,
          ...updates,
        });
        setDrawings((prev) => prev.map((d) => (d.id === id ? updated : d)));
        return updated;
      } catch (e: any) {
        if (e.status === 409) {
          setError("Drawing was modified elsewhere. Refreshing...");
          await loadDrawings();
        } else {
          // Rollback
          setDrawings((prev) => prev.map((d) => (d.id === id ? drawing : d)));
          setError("Failed to save changes");
        }
        console.error("Failed to update drawing:", e);
        return null;
      }
    },
    [drawings, loadDrawings]
  );

  const deleteDrawing = useCallback(
    async (id: number): Promise<boolean> => {
      const drawing = drawings.find((d) => d.id === id);
      if (!drawing) return false;

      // Optimistic removal
      setDrawings((prev) => prev.filter((d) => d.id !== id));

      try {
        await api.drawings.delete(id);
        return true;
      } catch (e: any) {
        // Rollback
        setDrawings((prev) => [...prev, drawing]);
        setError("Failed to delete drawing");
        console.error("Failed to delete drawing:", e);
        return false;
      }
    },
    [drawings]
  );

  const deleteAllDrawings = useCallback(async (): Promise<number> => {
    if (!ticker) return 0;

    const original = [...drawings];

    // Optimistic removal
    setDrawings([]);

    try {
      const result = await api.drawings.deleteAll(ticker);
      return result.deleted;
    } catch (e: any) {
      // Rollback
      setDrawings(original);
      setError("Failed to delete drawings");
      console.error("Failed to delete all drawings:", e);
      return 0;
    }
  }, [ticker, drawings]);

  const getDrawing = useCallback(
    (id: number): ChartDrawing | undefined => {
      return drawings.find((d) => d.id === id);
    },
    [drawings]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    drawings,
    loading,
    error,
    clearError,
    loadDrawings,
    createDrawing,
    updateDrawing,
    updateDrawingImmediate,
    deleteDrawing,
    deleteAllDrawings,
    getDrawing,
  };
}
