import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import {
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from "../../lib/storage";

interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
}

interface WatchlistCardProps {
  onSelect: (ticker: string) => void;
  /** Bumped externally whenever the watchlist changes (e.g. user adds from ticker view) */
  refreshKey?: number;
}

export function WatchlistCard({ onSelect, refreshKey }: WatchlistCardProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);

  // Load watchlist from localStorage
  const reload = useCallback(() => {
    setItems(getWatchlist());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

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
          api.fundamentals(item.ticker).then((f: any) => ({
            ticker: item.ticker,
            price: f?.current_price ?? f?.market_price ?? 0,
            change: f?.price_change ?? 0,
            changePct: f?.price_change_pct ?? 0,
          }))
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
              {/* Ticker + Name */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  {item.ticker}
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