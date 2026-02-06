import { useState, useEffect } from "react";
import { projectsApi } from "./api";
import type { ProjectPeer } from "./types";
import { cardStyle, sectionHeader, inputStyle } from "./sharedStyles";
import { TickerSearchInput } from "../common/TickerSearchInput";

interface PeerSetSectionProps {
  projectId: number;
  peers: ProjectPeer[];
  onUpdate: () => void;
}

export function PeerSetSection({ projectId, peers, onUpdate }: PeerSetSectionProps) {
  const [days, setDays] = useState(30);
  const [returnsByTicker, setReturnsByTicker] = useState<Record<string, number | null>>({});
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  async function addPeer(tickerToAdd: string) {
    const t = tickerToAdd.trim().toUpperCase();
    if (!t) return;
    if (peers.some((p) => p.ticker === t)) {
      return;
    }
    await projectsApi.addPeer(projectId, t);
    onUpdate();
  }

  async function removePeer(peerId: number) {
    await projectsApi.removePeer(projectId, peerId);
    onUpdate();
  }

  // Fetch % moves when peers or days changes
  useEffect(() => {
    const tickers = peers.map((p) => p.ticker).filter(Boolean);
    if (tickers.length === 0) {
      setReturnsByTicker({});
      setReturnsError(null);
      return;
    }

    let cancelled = false;
    setReturnsLoading(true);
    setReturnsError(null);

    projectsApi
      .getReturns(tickers, days)
      .then((map) => {
        if (cancelled) return;
        const normalized: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(map ?? {})) {
          normalized[k.toUpperCase()] = v == null ? null : Number(v);
        }
        setReturnsByTicker(normalized);
      })
      .catch((e) => {
        if (cancelled) return;
        setReturnsError(e?.message ?? "Failed to load peer moves");
      })
      .finally(() => {
        if (cancelled) return;
        setReturnsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [peers, days]);

  function fmtMove(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "—";
    const pct = v * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  }

  function moveColor(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return "#666";
    return v >= 0 ? "#22c55e" : "#ef4444";
  }

  return (
    <div style={cardStyle}>
      <div style={sectionHeader}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span>🔒 Peer Set</span>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>
            Locked for consistent comps
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#666" }}>Move</span>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ ...inputStyle, width: 90, fontSize: 11 }}
            title="Time window for peer performance"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
          </select>
        </div>
      </div>

      {(returnsLoading || returnsError) && (
        <div style={{ fontSize: 11, color: returnsError ? "#ef4444" : "#666", marginBottom: 8 }}>
          {returnsError ? returnsError : "Loading moves…"}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {peers.map((p) => {
          const mv = returnsByTicker[p.ticker?.toUpperCase() ?? ""] ?? null;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: 6,
              }}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                {p.ticker}
              </span>

              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: moveColor(mv),
                  background: `${moveColor(mv)}12`,
                  border: `1px solid ${moveColor(mv)}28`,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
                title={`Percent move over the past ${days} days`}
              >
                {fmtMove(mv)}
              </span>

              <button
                onClick={() => removePeer(p.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#555",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                  marginLeft: 2,
                }}
                title="Remove peer"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Inline add */}
        <div style={{ width: 160 }}>
          <TickerSearchInput
            onSelect={(ticker) => addPeer(ticker)}
            placeholder="Search ticker…"
            clearOnSelect={true}
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </div>
      </div>

      {peers.length === 0 && (
        <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginTop: 6 }}>
          Add comparable tickers to lock a consistent peer set for relative valuation.
        </div>
      )}
    </div>
  );
}
