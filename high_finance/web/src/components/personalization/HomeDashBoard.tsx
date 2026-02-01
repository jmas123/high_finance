import { useState, useEffect } from "react";
import { PortfolioCard } from "./PortfolioCard";
import { WatchlistCard } from "./WatchlistCard";
import { getRecentTickers, exportAllData, importAllData, clearAllData } from "../../lib/storage";

interface HomeDashboardProps {
  onSelect: (ticker: string) => void;
  watchlistRefreshKey: number;
  portfolioRefreshKey: number;
}

export function HomeDashboard({
  onSelect,
  watchlistRefreshKey,
  portfolioRefreshKey,
}: HomeDashboardProps) {
  const [recentTickers, setRecentTickers] = useState<string[]>([]);
  const [showDataMenu, setShowDataMenu] = useState(false);

  useEffect(() => {
    setRecentTickers(getRecentTickers());
  }, []);

  function handleExport() {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `high_finance_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDataMenu(false);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const success = importAllData(reader.result as string);
        if (success) {
          setRecentTickers(getRecentTickers());
          window.location.reload(); // easiest way to refresh all state
        } else {
          alert("Invalid backup file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setShowDataMenu(false);
  }

  function handleClear() {
    if (confirm("This will delete your watchlist, portfolio, and recent tickers. Continue?")) {
      clearAllData();
      window.location.reload();
    }
    setShowDataMenu(false);
  }

  return (
    <div>
      {/* Welcome Header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff" }}>Dashboard</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
            Your watchlist, portfolio, and recent activity
          </p>
        </div>

        {/* Data management */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowDataMenu(!showDataMenu)}
            style={{
              background: "#222",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#888",
              fontSize: 12,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            ⚙ Data
          </button>
          {showDataMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                padding: 4,
                zIndex: 100,
                minWidth: 160,
              }}
            >
              <button onClick={handleExport} style={menuItem}>
                📥 Export Backup
              </button>
              <button onClick={handleImport} style={menuItem}>
                📤 Import Backup
              </button>
              <div style={{ borderTop: "1px solid #333", margin: "4px 0" }} />
              <button onClick={handleClear} style={{ ...menuItem, color: "#ef4444" }}>
                🗑 Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two Column: Watchlist + Portfolio */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
        <WatchlistCard onSelect={onSelect} refreshKey={watchlistRefreshKey} />
        <PortfolioCard onSelect={onSelect} refreshKey={portfolioRefreshKey} />
      </div>

      {/* Recent Tickers */}
      {recentTickers.length > 0 && (
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>
            🕐 Recent
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentTickers.map((t) => (
              <button
                key={t}
                onClick={() => onSelect(t)}
                style={{
                  background: "#222",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#ccc",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2a2a2a";
                  e.currentTarget.style.borderColor = "#555";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#222";
                  e.currentTarget.style.borderColor = "#333";
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  color: "#ccc",
  fontSize: 12,
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: 4,
};