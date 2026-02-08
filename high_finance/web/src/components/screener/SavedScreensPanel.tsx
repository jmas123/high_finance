import { useState, useEffect } from "react";
import type { SavedScreen } from "../../lib/types";

type Props = {
  screens: SavedScreen[];
  onLoad: (screen: SavedScreen) => void;
  onDelete: (screenId: number) => void;
  onSave: (name: string) => void;
};

export function SavedScreensPanel({ screens, onLoad, onDelete, onSave }: Props) {
  const [newScreenName, setNewScreenName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Auto-clear undo toast after 5 seconds
  useEffect(() => {
    if (pendingDeleteId == null) return;
    const timer = setTimeout(() => {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [pendingDeleteId, onDelete]);

  const handleSave = () => {
    if (newScreenName.trim()) {
      onSave(newScreenName.trim());
      setNewScreenName("");
      setShowSaveInput(false);
    }
  };

  const handleDeleteClick = (screenId: number) => {
    setPendingDeleteId(screenId);
  };

  const handleUndoDelete = () => {
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId != null) {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getFilterSummary = (screen: SavedScreen): string => {
    const parts: string[] = [];
    const f = screen.filters;

    if (f.sectors) {
      const sectorList = f.sectors.split(",");
      parts.push(sectorList.length === 1 ? sectorList[0] : `${sectorList.length} sectors`);
    }
    if (f.pe_ratio_max != null) parts.push(`P/E < ${f.pe_ratio_max}`);
    if (f.pe_ratio_min != null) parts.push(`P/E > ${f.pe_ratio_min}`);
    if (f.market_cap_min != null) parts.push(`Mkt Cap > $${(f.market_cap_min / 1000).toFixed(0)}B`);
    if (f.has_insider_buys_90d) parts.push("Insider buys");
    if (f.congress_net_value_90d_min != null) parts.push("Congress activity");
    if (f.roe_min != null) parts.push(`ROE > ${(f.roe_min * 100).toFixed(0)}%`);
    if (f.debt_to_equity_max != null) parts.push(`D/E < ${f.debt_to_equity_max}`);

    return parts.length > 0 ? parts.slice(0, 3).join(" \u2022 ") : "No filters";
  };

  // Filter out the pending-delete screen from display
  const visibleScreens = screens.filter(s => s.id !== pendingDeleteId);

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Saved Screens</span>
        {!showSaveInput ? (
          <button
            onClick={() => setShowSaveInput(true)}
            style={{
              padding: "6px 12px",
              background: "#22c55e",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            + Save Current
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Screen name..."
              value={newScreenName}
              onChange={e => setNewScreenName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              autoFocus
              style={{
                padding: "6px 10px",
                background: "#222",
                border: "1px solid #444",
                borderRadius: 4,
                color: "#fff",
                fontSize: 12,
                width: 160,
              }}
            />
            <button
              onClick={handleSave}
              disabled={!newScreenName.trim()}
              style={{
                padding: "6px 12px",
                background: newScreenName.trim() ? "#22c55e" : "#333",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 11,
                cursor: newScreenName.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save
            </button>
            <button
              onClick={() => { setShowSaveInput(false); setNewScreenName(""); }}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid #444",
                borderRadius: 4,
                color: "#888",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Undo toast */}
      {pendingDeleteId != null && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "#3b1818",
          border: "1px solid #ef4444",
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 12,
        }}>
          <span>Screen deleted.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleUndoDelete}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid #ef4444",
                borderRadius: 4,
                color: "#ef4444",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Undo
            </button>
            <button
              onClick={handleConfirmDelete}
              style={{
                padding: "4px 10px",
                background: "#ef4444",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {visibleScreens.length === 0 && pendingDeleteId == null ? (
        <div style={{
          padding: 20,
          textAlign: "center",
          color: "#666",
          fontSize: 13,
        }}>
          No saved screens yet. Apply some filters and save them for quick access.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleScreens.map(screen => (
            <div
              key={screen.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "#222",
                borderRadius: 6,
                border: "1px solid #333",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{screen.name}</span>
                  {screen.last_result_count != null && (
                    <span style={{
                      background: "#333",
                      padding: "2px 6px",
                      borderRadius: 999,
                      fontSize: 10,
                      color: "#888",
                    }}>
                      {screen.last_result_count} stocks
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>
                  {getFilterSummary(screen)}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  Last run: {formatDate(screen.last_run_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onLoad(screen)}
                  style={{
                    padding: "6px 12px",
                    background: "#3b82f6",
                    border: "none",
                    borderRadius: 4,
                    color: "#fff",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Load
                </button>
                <button
                  onClick={() => handleDeleteClick(screen.id)}
                  style={{
                    padding: "6px 10px",
                    background: "transparent",
                    border: "1px solid #444",
                    borderRadius: 4,
                    color: "#888",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
