import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import type { ScreenerFilters, ScreenerResponse, SavedScreen } from "../../lib/types";
import { ScreenerFiltersPanel } from "./ScreenerFiltersPanel";
import { ScreenerResultsTable } from "./ScreenerResultsTable";
import { SavedScreensPanel } from "./SavedScreensPanel";

const OWNER_ID = "default-user"; // In production, this would come from auth
const STORAGE_KEY = "hf_screener_filters";

// Load filters from localStorage
function loadFilters(): ScreenerFilters {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load screener filters:", e);
  }
  return {
    sort_by: "market_cap",
    sort_order: "desc",
    limit: 50,
  };
}

// Save filters to localStorage
function saveFilters(filters: ScreenerFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error("Failed to save screener filters:", e);
  }
}

type Props = {
  onSelectTicker?: (ticker: string) => void;
};

export function ScreenerCard({ onSelectTicker }: Props) {
  const [filters, setFilters] = useState<ScreenerFilters>(loadFilters);
  const [results, setResults] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [sectorCounts, setSectorCounts] = useState<Record<string, number>>({});

  // Load sector counts on mount
  useEffect(() => {
    api.screenerSectors().then(setSectorCounts).catch(console.error);
  }, []);

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  // Load saved screens
  useEffect(() => {
    api.listSavedScreens(OWNER_ID).then(setSavedScreens).catch(console.error);
  }, []);

  const runScreen = useCallback(async (f: ScreenerFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.screener(f);
      setResults(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run screener");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Run initial screen on mount
  useEffect(() => {
    runScreen();
  }, []);

  const handleApplyFilters = () => {
    setFilters({ ...filters, offset: 0 }); // Reset pagination
    runScreen({ ...filters, offset: 0 });
  };

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
    try {
      const saved = await api.createSavedScreen(OWNER_ID, { name, filters });
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
    try {
      await api.deleteSavedScreen(OWNER_ID, screenId);
      setSavedScreens(savedScreens.filter(s => s.id !== screenId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete screen");
    }
  };

  const handleClearFilters = () => {
    const clearedFilters: ScreenerFilters = {
      sort_by: "market_cap",
      sort_order: "desc",
      limit: 50,
    };
    setFilters(clearedFilters);
    runScreen(clearedFilters);
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
        onChange={setFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        sectorCounts={sectorCounts}
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
      />
    </div>
  );
}
