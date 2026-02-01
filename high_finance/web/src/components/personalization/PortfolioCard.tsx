import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import {
  getPortfolio,
  addPosition,
  removePosition,
  updatePosition,
  type PortfolioPosition,
} from "../../lib/storage";

interface LivePosition extends PortfolioPosition {
  currentPrice: number;
  marketValue: number;
  totalCost: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
  dayChangePct: number;
}

interface PortfolioCardProps {
  onSelect: (ticker: string) => void;
  refreshKey?: number;
}

// ── Ticker Search Autocomplete ──────────────────────────────────────────────
function TickerInput({
  onSelect,
}: {
  onSelect: (ticker: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string; type: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(val: string) {
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.search(val.trim());
        setResults(res.slice(0, 6));
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  function handleSelect(symbol: string, name: string) {
    setQuery(symbol);
    setShowDropdown(false);
    setResults([]);
    onSelect(symbol, name);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        placeholder="Search ticker…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        style={{
          ...inputStyle,
          width: "100%",
        }}
      />
      {searching && (
        <span style={{ position: "absolute", right: 8, top: 6, fontSize: 10, color: "#555" }}>
          …
        </span>
      )}
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            background: "#1a1a1a",
            border: "1px solid #444",
            borderRadius: 6,
            zIndex: 200,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <div
              key={r.symbol}
              onClick={() => handleSelect(r.symbol, r.name)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                cursor: "pointer",
                fontSize: 12,
                borderBottom: "1px solid #252525",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: "#fff", flexShrink: 0 }}>{r.symbol}</span>
                <span
                  style={{
                    color: "#888",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name}
                </span>
              </div>
              <span style={{ fontSize: 10, color: "#555", flexShrink: 0, marginLeft: 8 }}>
                {r.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function PortfolioCard({ onSelect, refreshKey }: PortfolioCardProps) {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [live, setLive] = useState<LivePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);

  // Form state
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formCost, setFormCost] = useState("");

  const reload = useCallback(() => {
    setPositions(getPortfolio());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  // Fetch live prices
  useEffect(() => {
    if (positions.length === 0) {
      setLive([]);
      return;
    }
    let cancelled = false;

    async function fetchPrices() {
      setLoading(true);
      const results = await Promise.allSettled(
        positions.map((pos) =>
          api.fundamentals(pos.ticker).then((f: any) => ({
            ...pos,
            currentPrice: f?.current_price ?? f?.market_price ?? 0,
            dayChange: f?.price_change ?? 0,
            dayChangePct: f?.price_change_pct ?? 0,
          }))
        )
      );

      if (cancelled) return;

      const livePositions: LivePosition[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          const d = r.value;
          const marketValue = d.shares * d.currentPrice;
          const totalCost = d.shares * d.avgCost;
          const pnl = marketValue - totalCost;
          const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
          livePositions.push({ ...d, marketValue, totalCost, pnl, pnlPct });
        }
      }

      setLive(livePositions);
      setLoading(false);
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [positions]);

  // Totals
  const totalValue = live.reduce((s, p) => s + p.marketValue, 0);
  const totalCost = live.reduce((s, p) => s + p.totalCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalDayChange = live.reduce((s, p) => s + p.dayChange * p.shares, 0);

  function handleTickerSelected(ticker: string, name: string) {
    setSelectedTicker(ticker.toUpperCase());
    setSelectedName(name);
  }

  function handleAdd() {
    if (!selectedTicker.trim() || !formShares || !formCost) return;
    addPosition(
      selectedTicker.trim(),
      selectedName || selectedTicker.trim().toUpperCase(),
      parseFloat(formShares),
      parseFloat(formCost)
    );
    setSelectedTicker("");
    setSelectedName("");
    setFormShares("");
    setFormCost("");
    setShowAddForm(false);
    reload();
  }

  function handleRemove(e: React.MouseEvent, ticker: string) {
    e.stopPropagation();
    if (confirm(`Remove ${ticker} from portfolio?`)) {
      removePosition(ticker);
      reload();
    }
  }

  function handleEdit(e: React.MouseEvent, pos: LivePosition) {
    e.stopPropagation();
    setEditingTicker(pos.ticker);
    setFormShares(String(pos.shares));
    setFormCost(String(pos.avgCost));
  }

  function handleSaveEdit() {
    if (!editingTicker || !formShares || !formCost) return;
    updatePosition(editingTicker, parseFloat(formShares), parseFloat(formCost));
    setEditingTicker(null);
    setFormShares("");
    setFormCost("");
    reload();
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Empty State ──────────────────────────────────────────────────────────
  if (positions.length === 0 && !showAddForm) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>💼</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Portfolio</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              background: "#22c55e20",
              border: "1px solid #22c55e40",
              borderRadius: 6,
              color: "#22c55e",
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            + Add Position
          </button>
        </div>
        <div style={{ color: "#666", fontSize: 13, lineHeight: 1.6 }}>
          Track your positions and P&L. Click <b>+ Add Position</b> to get started.
        </div>
      </div>
    );
  }

  // ── Main View ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💼</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Portfolio</span>
          <span style={{ fontSize: 11, color: "#666" }}>({positions.length})</span>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setSelectedTicker("");
            setSelectedName("");
            setFormShares("");
            setFormCost("");
          }}
          style={{
            background: "#22c55e20",
            border: "1px solid #22c55e40",
            borderRadius: 6,
            color: "#22c55e",
            fontSize: 12,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          + Add
        </button>
      </div>

      {/* Totals Row */}
      {live.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 12,
            marginBottom: 14,
            padding: "10px 12px",
            background: "#111",
            borderRadius: 8,
            border: "1px solid #2a2a2a",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>TOTAL VALUE</div>
            <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "monospace", color: "#fff" }}>
              ${fmt(totalValue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>TOTAL COST</div>
            <div style={{ fontSize: 15, fontFamily: "monospace", color: "#aaa" }}>
              ${fmt(totalCost)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>TOTAL P&L</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "monospace",
                color: totalPnl >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              {totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}{" "}
              <span style={{ fontSize: 11 }}>
                ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>TODAY</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "monospace",
                color: totalDayChange >= 0 ? "#22c55e" : "#ef4444",
              }}
            >
              {totalDayChange >= 0 ? "+" : ""}${fmt(totalDayChange)}
            </div>
          </div>
        </div>
      )}

      {/* Add Position Form — with autocomplete */}
      {showAddForm && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#151515",
            borderRadius: 8,
            border: "1px solid #333",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 90px auto", gap: 8, alignItems: "end" }}>
            {/* Ticker search with autocomplete */}
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>TICKER</div>
              <TickerInput onSelect={handleTickerSelected} />
            </div>

            {/* Shares */}
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>SHARES</div>
              <input
                placeholder="0"
                type="number"
                step="any"
                value={formShares}
                onChange={(e) => setFormShares(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Avg Cost */}
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>AVG COST ($)</div>
              <input
                placeholder="0.00"
                type="number"
                step="any"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={handleAdd} style={btnGreen} disabled={!selectedTicker}>
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedTicker("");
                  setSelectedName("");
                }}
                style={{ ...btnGreen, background: "#33333380", borderColor: "#555", color: "#aaa" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Show selected ticker confirmation */}
          {selectedTicker && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
              Selected: <span style={{ color: "#fff", fontWeight: 600 }}>{selectedTicker}</span>
              {selectedName && <span style={{ color: "#666" }}> — {selectedName}</span>}
            </div>
          )}
        </div>
      )}

      {/* Positions Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Ticker", "Shares", "Avg Cost", "Price", "Mkt Value", "P&L", "Day", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: h === "Ticker" ? "left" : "right",
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#666",
                      borderBottom: "1px solid #2a2a2a",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {live.map((pos) => {
              const isEditing = editingTicker === pos.ticker;

              return (
                <tr
                  key={pos.ticker}
                  onClick={() => onSelect(pos.ticker)}
                  style={{ cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1f1f1f")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Ticker */}
                  <td style={{ padding: "8px", fontWeight: 600, color: "#fff" }}>
                    <div>{pos.ticker}</div>
                    <div style={{ fontSize: 10, color: "#555", fontWeight: 400 }}>{pos.name}</div>
                  </td>

                  {/* Shares */}
                  <td style={tdRight}>
                    {isEditing ? (
                      <input
                        value={formShares}
                        onChange={(e) => setFormShares(e.target.value)}
                        type="number"
                        step="any"
                        style={{ ...inputStyle, width: 60, textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      pos.shares.toLocaleString()
                    )}
                  </td>

                  {/* Avg Cost */}
                  <td style={tdRight}>
                    {isEditing ? (
                      <input
                        value={formCost}
                        onChange={(e) => setFormCost(e.target.value)}
                        type="number"
                        step="any"
                        style={{ ...inputStyle, width: 70, textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      `$${fmt(pos.avgCost)}`
                    )}
                  </td>

                  {/* Current Price */}
                  <td style={tdRight}>${fmt(pos.currentPrice)}</td>

                  {/* Market Value */}
                  <td style={tdRight}>${fmt(pos.marketValue)}</td>

                  {/* P&L */}
                  <td
                    style={{
                      ...tdRight,
                      color: pos.pnl >= 0 ? "#22c55e" : "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    <div>
                      {pos.pnl >= 0 ? "+" : ""}${fmt(pos.pnl)}
                    </div>
                    <div style={{ fontSize: 10 }}>
                      {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                    </div>
                  </td>

                  {/* Day Change */}
                  <td
                    style={{
                      ...tdRight,
                      color: pos.dayChangePct >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {pos.dayChangePct >= 0 ? "+" : ""}{pos.dayChangePct.toFixed(2)}%
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>
                    {isEditing ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        style={{ ...actionBtn, color: "#22c55e" }}
                      >
                        ✓
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={(e) => handleEdit(e, pos)} style={actionBtn} title="Edit">
                          ✎
                        </button>
                        <button
                          onClick={(e) => handleRemove(e, pos.ticker)}
                          style={{ ...actionBtn, color: "#666" }}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {loading && live.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#555" }}>
                  Loading prices…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "#444", textAlign: "center" }}>
        Saved locally on this browser
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const tdRight: React.CSSProperties = {
  padding: "8px",
  textAlign: "right",
  fontFamily: "monospace",
  color: "#ccc",
};

const inputStyle: React.CSSProperties = {
  background: "#222",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#fff",
  padding: "5px 8px",
  fontSize: 12,
  outline: "none",
  width: "100%",
};

const btnGreen: React.CSSProperties = {
  background: "#22c55e20",
  border: "1px solid #22c55e40",
  borderRadius: 4,
  color: "#22c55e",
  fontSize: 12,
  padding: "5px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const actionBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#888",
  cursor: "pointer",
  fontSize: 13,
  padding: "2px 4px",
};