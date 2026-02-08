import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ScreenerFilters, ScreenerResponse, SavedScreen } from "../../lib/types";
import { ScreenerFiltersPanel } from "./ScreenerFiltersPanel";
import { ScreenerResultsTable } from "./ScreenerResultsTable";
import { SavedScreensPanel } from "./SavedScreensPanel";

const STORAGE_KEY = "hf_screener_filters";

const DEFAULT_FILTERS: ScreenerFilters = {
  sort_by: "market_cap",
  sort_order: "desc",
  limit: 50,
};

function loadFilters(): ScreenerFilters {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_FILTERS };
}

function saveFilters(filters: ScreenerFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {}
}

type Props = {
  onSelectTicker?: (ticker: string) => void;
};

export function ScreenerCard({ onSelectTicker }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<ScreenerFilters>(loadFilters);
  const [results, setResults] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [sectorCounts, setSectorCounts] = useState<Record<string, number>>({});
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [universeTotal, setUniverseTotal] = useState<number>(0);

  // Ref to track the latest filters for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load sector counts on mount
  useEffect(() => {
    api.screenerSectors().then(setSectorCounts).catch(console.error);
  }, []);

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  // Load saved screens (only when authenticated)
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      api.listSavedScreens(user.id).then(setSavedScreens).catch(console.error);
    } else {
      setSavedScreens([]);
    }
  }, [isAuthenticated, user?.id]);

  const runScreen = useCallback(async (f: ScreenerFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.screener(f);
      setResults(data);
      setLiveCount(data.total_count ?? data.total);
      setUniverseTotal(data.universe_total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run screener");
    } finally {
      setLoading(false);
    }
  }, []);

  // Run initial screen on mount
  useEffect(() => {
    runScreen(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced live count as filters change (fast — count only)
  const fetchLiveCount = useCallback((f: ScreenerFilters) => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current);
    countTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.screenerCount(f);
        setLiveCount(data.count);
        setUniverseTotal(data.universe_total);
      } catch {}
    }, 200);
  }, []);

  // Debounced auto-run when filters change (300ms)
  const handleFilterChange = useCallback((newFilters: ScreenerFilters) => {
    setFilters(newFilters);
    // Fetch live count immediately (fast)
    fetchLiveCount(newFilters);
    // Debounce full results fetch
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runScreen({ ...newFilters, offset: 0 });
    }, 300);
  }, [fetchLiveCount, runScreen]);

  const handleSort = (column: string) => {
    const newOrder = filters.sort_by === column && filters.sort_order === "desc" ? "asc" : "desc";
    const newFilters = { ...filters, sort_by: column, sort_order: newOrder as "asc" | "desc" };
    setFilters(newFilters);
    runScreen(newFilters);
  };

  const handlePageChange = (newOffset: number) => {
    const newFilters = { ...filters, offset: newOffset };
    setFilters(newFilters);
    runScreen(newFilters);
  };

  const handleSaveScreen = async (name: string) => {
    if (!user?.id) {
      setError("Please sign in to save screens");
      return;
    }
    try {
      const saved = await api.createSavedScreen(user.id, { name, filters });
      setSavedScreens([...savedScreens, saved]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save screen");
    }
  };

  const handleLoadScreen = (screen: SavedScreen) => {
    setFilters(screen.filters);
    runScreen(screen.filters);
    setShowSaved(false);
  };

  const handleDeleteScreen = async (screenId: number) => {
    if (!user?.id) {
      setError("Please sign in to delete screens");
      return;
    }
    try {
      await api.deleteSavedScreen(user.id, screenId);
      setSavedScreens(savedScreens.filter(s => s.id !== screenId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete screen");
    }
  };

  const handleClearFilters = () => {
    const cleared = { ...DEFAULT_FILTERS };
    setFilters(cleared);
    runScreen(cleared);
    setLiveCount(null);
  };

  // Apply a preset (replaces all filters + runs immediately)
  const handlePreset = (preset: ScreenerFilters) => {
    const merged = { ...DEFAULT_FILTERS, ...preset };
    setFilters(merged);
    runScreen(merged);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Stock Screener</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
            Find investment ideas by filtering on fundamentals, insider activity, and more
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowSaved(!showSaved)}
            style={{
              padding: "8px 12px",
              background: showSaved ? "#3b82f6" : "#333",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {showSaved ? "Hide Saved" : "Saved Screens"} ({savedScreens.length})
          </button>
        </div>
      </div>

      {/* Saved Screens Panel */}
      {showSaved && (
        <SavedScreensPanel
          screens={savedScreens}
          onLoad={handleLoadScreen}
          onDelete={handleDeleteScreen}
          onSave={handleSaveScreen}
        />
      )}

      {/* Filters */}
      <ScreenerFiltersPanel
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        onPreset={handlePreset}
        sectorCounts={sectorCounts}
        liveCount={liveCount}
        universeTotal={universeTotal}
      />

      {/* Error */}
      {error && (
        <div style={{
          background: "#3b1818",
          border: "1px solid #ef4444",
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
        }}>
          <b>Error:</b> {error}
        </div>
      )}

      {/* Results */}
      <ScreenerResultsTable
        results={results}
        loading={loading}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={handleSort}
        onSelectTicker={onSelectTicker}
        limit={filters.limit ?? 50}
        offset={filters.offset ?? 0}
        onPageChange={handlePageChange}
        universeTotal={universeTotal}
      />
    </div>
  );
}
