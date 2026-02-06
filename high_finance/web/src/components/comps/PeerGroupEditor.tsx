/**
 * PeerGroupEditor
 * ================
 * Modal to create or edit a peer group.
 */

import { useState, useEffect } from "react";
import type { PeerGroup, PeerGroupCreate, PeerGroupUpdate } from "../../lib/types";
import { peerGroupsApi } from "../../lib/api/peerGroups";
import { TickerSearchInput } from "../common/TickerSearchInput";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: PeerGroup) => void;
  onDelete?: () => void;
  ticker: string;
  existingGroup?: PeerGroup | null;
};

export function PeerGroupEditor({
  isOpen,
  onClose,
  onSave,
  onDelete,
  ticker,
  existingGroup,
}: Props) {
  const [name, setName] = useState("");
  const [peerTickers, setPeerTickers] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or existingGroup changes
  useEffect(() => {
    if (isOpen) {
      if (existingGroup) {
        setName(existingGroup.name);
        setPeerTickers([...existingGroup.peer_tickers]);
        setIsDefault(existingGroup.is_default);
        setIsGlobal(existingGroup.ticker === null);
      } else {
        setName("");
        setPeerTickers([]);
        setIsDefault(false);
        setIsGlobal(false);
      }
      setError(null);
    }
  }, [isOpen, existingGroup]);

  const handleAddTicker = (tickerToAdd: string) => {
    const t = tickerToAdd.trim().toUpperCase();
    if (!t) return;

    // Validate
    if (t === ticker.toUpperCase()) {
      setError("Cannot add target ticker to peer group");
      return;
    }
    if (peerTickers.includes(t)) {
      setError("Ticker already in group");
      return;
    }
    if (peerTickers.length >= 30) {
      setError("Maximum 30 peers allowed");
      return;
    }

    setPeerTickers([...peerTickers, t]);
    setError(null);
  };

  const handleRemoveTicker = (t: string) => {
    setPeerTickers(peerTickers.filter((x) => x !== t));
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (peerTickers.length === 0) {
      setError("At least one peer ticker is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedGroup: PeerGroup;

      if (existingGroup) {
        // Update existing
        const updateData: PeerGroupUpdate = {
          name: name.trim(),
          peer_tickers: peerTickers,
          is_default: isDefault,
        };
        savedGroup = await peerGroupsApi.update(existingGroup.id, updateData);
      } else {
        // Create new
        const createData: PeerGroupCreate = {
          ticker: isGlobal ? null : ticker,
          name: name.trim(),
          peer_tickers: peerTickers,
          is_default: isDefault,
        };
        savedGroup = await peerGroupsApi.create(createData);
      }

      onSave(savedGroup);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save peer group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingGroup || !onDelete) return;
    if (!window.confirm(`Delete peer group "${existingGroup.name}"?`)) return;

    setDeleting(true);
    setError(null);

    try {
      await peerGroupsApi.delete(existingGroup.id);
      onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete peer group");
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {existingGroup ? "Edit Peer Group" : "Create Peer Group"}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            {isGlobal
              ? "This group can be used with any ticker"
              : `Peers for ${ticker}`}
          </div>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
            Group Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Direct Competitors"
            style={{
              width: "100%",
              background: "#111",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "8px 12px",
              color: "#fff",
              fontSize: 14,
            }}
          />
        </div>

        {/* Global toggle (only for new groups) */}
        {!existingGroup && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                style={{ accentColor: "#3b82f6" }}
              />
              <span style={{ fontSize: 13, color: "#ccc" }}>
                Make this a global group (use with any ticker)
              </span>
            </label>
          </div>
        )}

        {/* Peer tickers input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 4 }}>
            Add Peer Tickers
          </label>
          <TickerSearchInput
            onSelect={(tickerSymbol) => handleAddTicker(tickerSymbol)}
            placeholder="Search company or ticker…"
            clearOnSelect={true}
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 14,
            }}
          />
        </div>

        {/* Peer tickers list */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 8 }}>
            Peers ({peerTickers.length}/30)
          </label>
          <div
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: 6,
              padding: 12,
              minHeight: 60,
              maxHeight: 160,
              overflowY: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {peerTickers.length === 0 ? (
              <span style={{ color: "#444", fontSize: 12 }}>No peers added yet</span>
            ) : (
              peerTickers.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#333",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {t}
                  <button
                    onClick={() => handleRemoveTicker(t)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    title="Remove"
                  >
                    \u00D7
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Default toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              style={{ accentColor: "#22c55e" }}
            />
            <span style={{ fontSize: 13, color: "#ccc" }}>
              Set as default for {isGlobal ? "all tickers" : ticker}
            </span>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              background: "#ef444433",
              border: "1px solid #ef4444",
              borderRadius: 6,
              padding: "8px 12px",
              color: "#ef4444",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
          {existingGroup && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "transparent",
                border: "1px solid #ef4444",
                borderRadius: 6,
                padding: "8px 16px",
                color: "#ef4444",
                cursor: deleting ? "not-allowed" : "pointer",
                fontSize: 13,
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}

          <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
            <button
              onClick={onClose}
              style={{
                background: "#333",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: "#3b82f6",
                border: "none",
                borderRadius: 6,
                padding: "8px 20px",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Saving..." : existingGroup ? "Save Changes" : "Create Group"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
