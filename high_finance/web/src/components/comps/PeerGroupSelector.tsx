/**
 * PeerGroupSelector
 * =================
 * Dropdown to select a saved peer group or create a new one.
 */

import { useState, useEffect, useRef } from "react";
import type { PeerGroup } from "../../lib/types";
import { peerGroupsApi } from "../../lib/api/peerGroups";

type Props = {
  ticker: string;
  selectedGroupId: number | null;
  onSelect: (groupId: number | null, peerTickers: string[] | null) => void;
  onCreateNew: () => void;
  onEdit: (group: PeerGroup) => void;
  isAuthenticated: boolean;
  refreshKey?: number;  // Increment to trigger refetch
};

export function PeerGroupSelector({
  ticker,
  selectedGroupId,
  onSelect,
  onCreateNew,
  onEdit,
  isAuthenticated,
  refreshKey = 0,
}: Props) {
  const [groups, setGroups] = useState<PeerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef<string | null>(null); // Prevents StrictMode double-fetch

  // Fetch peer groups when authenticated and ticker changes
  useEffect(() => {
    if (!isAuthenticated) {
      setGroups([]);
      return;
    }

    // Prevent StrictMode double-fetch
    const key = `${ticker}-${refreshKey}`;
    if (fetchingRef.current === key) return;
    fetchingRef.current = key;

    const fetchGroups = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await peerGroupsApi.list({ ticker });
        setGroups(result.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load peer groups");
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [ticker, isAuthenticated, refreshKey]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const displayText = selectedGroup
    ? selectedGroup.name
    : "Auto-Selected";

  const handleSelect = (group: PeerGroup | null) => {
    if (group) {
      onSelect(group.id, group.peer_tickers);
    } else {
      onSelect(null, null);
    }
    setIsOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ fontSize: 12, color: "#666" }}>
        Sign in to save custom peer groups
      </div>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "#222",
          border: "1px solid #444",
          borderRadius: 6,
          padding: "6px 12px",
          color: "#fff",
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 160,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>
          {loading ? "Loading..." : displayText}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>
          {isOpen ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 8,
            minWidth: 220,
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {/* Auto-select option */}
          <div
            onClick={() => handleSelect(null)}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              borderBottom: "1px solid #333",
              background: selectedGroupId === null ? "#333" : "transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ flex: 1 }}>Auto-Selected</span>
            {selectedGroupId === null && (
              <span style={{ color: "#22c55e", fontSize: 10 }}>\u2713</span>
            )}
          </div>

          {/* Saved groups */}
          {groups.length > 0 && (
            <>
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 10,
                  color: "#666",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #222",
                }}
              >
                Saved Groups
              </div>
              {groups.map((group) => (
                <div
                  key={group.id}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #222",
                    background: selectedGroupId === group.id ? "#333" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    onClick={() => handleSelect(group)}
                    style={{ flex: 1 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {group.name}
                      {group.is_default && (
                        <span
                          style={{
                            fontSize: 9,
                            background: "#22c55e33",
                            color: "#22c55e",
                            padding: "1px 4px",
                            borderRadius: 3,
                          }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                      {group.peer_tickers.slice(0, 4).join(", ")}
                      {group.peer_tickers.length > 4 && ` +${group.peer_tickers.length - 4}`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(group);
                      setIsOpen(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      cursor: "pointer",
                      padding: 4,
                      fontSize: 12,
                    }}
                    title="Edit group"
                  >
                    \u270E
                  </button>
                  {selectedGroupId === group.id && (
                    <span style={{ color: "#22c55e", fontSize: 10 }}>\u2713</span>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Create new option */}
          <div
            onClick={() => {
              onCreateNew();
              setIsOpen(false);
            }}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>+</span>
            <span>Create New Group...</span>
          </div>

          {/* Error message */}
          {error && (
            <div style={{ padding: "8px 12px", color: "#ef4444", fontSize: 11 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
