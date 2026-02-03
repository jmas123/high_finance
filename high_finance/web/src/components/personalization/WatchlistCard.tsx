import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { projectsApi } from "../project/api";
import type { ProjectSummary } from "../../lib/types";
import {
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from "./storage";

interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
}

interface WatchlistCardProps {
  onSelect: (ticker: string) => void;
  /** Called when user clicks on a project badge */
  onOpenProject?: (projectId: number) => void;
  /** Bumped externally whenever the watchlist changes (e.g. user adds from ticker view) */
  refreshKey?: number;
}

export function WatchlistCard({ onSelect, onOpenProject, refreshKey }: WatchlistCardProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [projectsByTicker, setProjectsByTicker] = useState<Record<string, ProjectSummary>>({});

  // Load watchlist from localStorage
  const reload = useCallback(() => {
    setItems(getWatchlist());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // Fetch projects to show indicators
  useEffect(() => {
    projectsApi
      .listProjects()
      .then((projects) => {
        const map: Record<string, ProjectSummary> = {};
        for (const p of projects) {
          // Store first project for each ticker (most recent due to API sort)
          if (!map[p.ticker.toUpperCase()]) {
            map[p.ticker.toUpperCase()] = p;
          }
        }
        setProjectsByTicker(map);
      })
      .catch(() => setProjectsByTicker({}));
  }, [refreshKey]);

  // Fetch quotes for all watchlist tickers
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    async function fetchQuotes() {
      setLoading(true);
      const newQuotes: Record<string, Quote> = {};

      // Batch fetch — use the batch endpoint if available, otherwise parallel single calls
      const results = await Promise.allSettled(
        items.map((item) =>
          api.fundamentals(item.ticker).then((f: any) => {
  const base = f?.target ?? f; // ✅ handles both shapes


  return {
    ticker: item.ticker,
    price: base?.current_price ?? base?.market_price ?? 0,
    change: base?.price_change ?? 0,
    changePct: base?.price_change_pct ?? 0,
  };
  
})

        )
      );

      if (cancelled) return;

      for (const r of results) {
        if (r.status === "fulfilled") {
          newQuotes[r.value.ticker] = r.value;
        }
      }

      setQuotes(newQuotes);
      setLoading(false);
    }

    fetchQuotes();

    // Refresh every 60s
    const interval = setInterval(fetchQuotes, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [items]);

  function handleRemove(e: React.MouseEvent, ticker: string) {
    e.stopPropagation();
    removeFromWatchlist(ticker);
    reload();
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 10,
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>👁️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Watchlist</span>
        </div>
        <div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>
          No tickers yet. Search for a stock and click <b>☆ Watch</b> to add it here.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>👁️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Watchlist</span>
          <span style={{ fontSize: 11, color: "#666" }}>({items.length})</span>
        </div>
        {loading && <span style={{ fontSize: 11, color: "#555" }}>refreshing…</span>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((item) => {
          const q = quotes[item.ticker];
          const positive = q && q.changePct >= 0;
          const project = projectsByTicker[item.ticker.toUpperCase()];

          return (
            <div
              key={item.ticker}
              onClick={() => onSelect(item.ticker)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto 28px",
                alignItems: "center",
                gap: 12,
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Ticker + Name + Project Badge */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {item.ticker}
                  </span>
                  {project && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProject?.(project.id);
                      }}
                      title={`Open project: ${project.title}`}
                      style={{
                        background: "#3b82f620",
                        border: "1px solid #3b82f640",
                        borderRadius: 4,
                        color: "#3b82f6",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: "1px 5px",
                        cursor: "pointer",
                        lineHeight: 1.4,
                      }}
                    >
                      📋
                    </button>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#666",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.name}
                </div>
              </div>

              {/* Price */}
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#ddd", textAlign: "right" }}>
                {q ? `$${q.price.toFixed(2)}` : "—"}
              </div>

              {/* Change */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: q ? (positive ? "#22c55e" : "#ef4444") : "#555",
                  textAlign: "right",
                  minWidth: 60,
                }}
              >
                {q
                  ? `${positive ? "+" : ""}${q.changePct.toFixed(2)}%`
                  : "—"}
              </div>

              {/* Remove */}
              <button
                onClick={(e) => handleRemove(e, item.ticker)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: 0,
                  lineHeight: 1,
                }}
                title="Remove from watchlist"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Data saved locally notice */}
      <div style={{ marginTop: 10, fontSize: 10, color: "#444", textAlign: "center" }}>
        Saved locally on this browser
      </div>
    </div>
  );
}