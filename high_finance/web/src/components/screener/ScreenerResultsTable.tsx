import { useState } from "react";
import type { ScreenerResponse, ScreenerResult } from "../../lib/types";
import { thBase, tdBase, left, right } from "../../lib/types";

type Props = {
  results: ScreenerResponse | null;
  loading: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort: (column: string) => void;
  onSelectTicker?: (ticker: string) => void;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  universeTotal: number;
};

// Column definitions — all possible columns
type ColumnDef = {
  key: keyof ScreenerResult;
  label: string;
  align: "left" | "right";
  format?: (v: any) => string;
  heatmap?: "valuation" | "growth" | "quality" | "risk";
  defaultVisible?: boolean;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: "ticker", label: "Ticker", align: "left", defaultVisible: true },
  { key: "company_name", label: "Company", align: "left", defaultVisible: true },
  { key: "sector", label: "Sector", align: "left", defaultVisible: true },
  { key: "market_cap", label: "Mkt Cap", align: "right", format: formatLarge, defaultVisible: true },
  { key: "current_price", label: "Price", align: "right", format: v => v != null ? `$${v.toFixed(2)}` : "—", defaultVisible: true },
  { key: "price_change_1d", label: "1D Chg", align: "right", format: formatPct, defaultVisible: true },
  { key: "pe_ratio", label: "P/E", align: "right", format: formatNum, heatmap: "valuation", defaultVisible: true },
  { key: "forward_pe", label: "Fwd P/E", align: "right", format: formatNum, heatmap: "valuation", defaultVisible: true },
  { key: "pb_ratio", label: "P/B", align: "right", format: formatNum, defaultVisible: false },
  { key: "ev_to_ebitda", label: "EV/EBITDA", align: "right", format: formatNum, heatmap: "valuation", defaultVisible: true },
  { key: "roe", label: "ROE", align: "right", format: formatPct, heatmap: "quality", defaultVisible: true },
  { key: "profit_margin", label: "Margin", align: "right", format: formatPct, heatmap: "quality", defaultVisible: true },
  { key: "debt_to_equity", label: "D/E", align: "right", format: formatRatio, defaultVisible: true },
  { key: "fcf_yield", label: "FCF Yield", align: "right", format: formatPct, heatmap: "quality", defaultVisible: true },
  { key: "beta", label: "Beta", align: "right", format: formatRatio, heatmap: "risk", defaultVisible: true },
  { key: "revenue_growth", label: "Rev Growth", align: "right", format: formatPct, heatmap: "growth", defaultVisible: true },
  { key: "dividend_yield", label: "Div Yield", align: "right", format: formatPct, defaultVisible: false },
  { key: "insider_net_shares_90d", label: "Insider Net", align: "right", format: formatShares, defaultVisible: true },
];

const COL_STORAGE_KEY = "hf_screener_columns";

function loadVisibleColumns(): Set<string> {
  try {
    const saved = localStorage.getItem(COL_STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
}

function saveVisibleColumns(cols: Set<string>) {
  try {
    localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(Array.from(cols)));
  } catch {}
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatLarge(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function formatNum(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function formatRatio(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

function formatShares(v: number | null): string {
  if (v == null) return "—";
  if (v === 0) return "0";
  const sign = v > 0 ? "+" : "";
  if (Math.abs(v) >= 1e6) return `${sign}${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${sign}${(v / 1e3).toFixed(1)}K`;
  return `${sign}${v}`;
}

// ─── Heatmap helpers ──────────────────────────────────────────────────────────

function getHeatmapBg(
  value: number | null,
  type: ColumnDef["heatmap"],
  allValues: number[],
): string | undefined {
  if (value == null || !type || allValues.length === 0) return undefined;

  // Normalize value within the visible set (0 = worst, 1 = best)
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.filter(v => v <= value).length / sorted.length;

  // For valuation metrics, lower = better (green). For quality/growth, higher = better.
  let normalizedGood: number;
  if (type === "valuation") {
    normalizedGood = 1 - rank; // Low P/E = good
  } else if (type === "risk") {
    // Beta: middle (around 1) is neutral, extreme = red
    const distFromOne = Math.abs(value - 1);
    normalizedGood = Math.max(0, 1 - distFromOne / 2);
  } else {
    normalizedGood = rank; // High ROE, margin, growth = good
  }

  // Map to color — very subtle backgrounds
  if (normalizedGood > 0.75) return "rgba(34, 197, 94, 0.08)";
  if (normalizedGood > 0.5) return "rgba(34, 197, 94, 0.03)";
  if (normalizedGood < 0.25) return "rgba(239, 68, 68, 0.08)";
  if (normalizedGood < 0.5) return "rgba(239, 68, 68, 0.03)";
  return undefined;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCsv(results: ScreenerResult[], columns: ColumnDef[]) {
  const headers = columns.map(c => c.label);
  const rows = results.map(row =>
    columns.map(col => {
      const val = row[col.key];
      if (val == null) return "";
      return String(val);
    })
  );

  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(v => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `screener_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Freshness helper ─────────────────────────────────────────────────────────

function formatFreshness(cachedAt: string | null): { text: string; stale: boolean } {
  if (!cachedAt) return { text: "", stale: false };
  const date = new Date(cachedAt);
  const now = new Date();
  const hoursAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  const text = `Data as of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return { text, stale: hoursAgo > 24 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenerResultsTable({
  results,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onSelectTicker,
  limit,
  offset,
  onPageChange,
  universeTotal,
}: Props) {
  const [visibleCols, setVisibleCols] = useState<Set<string>>(loadVisibleColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const total = results?.total_count ?? results?.total ?? 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeColumns = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  const toggleColumn = (key: string) => {
    const next = new Set(visibleCols);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisibleCols(next);
    saveVisibleColumns(next);
  };

  // Pre-compute column value arrays for heatmapping
  const columnValues: Record<string, number[]> = {};
  if (results) {
    for (const col of activeColumns) {
      if (col.heatmap) {
        columnValues[col.key] = results.results
          .map(r => r[col.key] as number | null)
          .filter((v): v is number => v != null);
      }
    }
  }

  const freshness = formatFreshness(results?.cached_at ?? null);

  if (loading && !results) {
    return (
      <div style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 40,
        textAlign: "center",
        color: "#888",
      }}>
        Loading screener results...
      </div>
    );
  }

  if (!results || results.results.length === 0) {
    return (
      <div style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 40,
        textAlign: "center",
        color: "#888",
      }}>
        No stocks match your filters. Try adjusting your criteria.
      </div>
    );
  }

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header with count, freshness, column picker, CSV export, pagination */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid #333",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#888" }}>
            {total.toLocaleString()} {universeTotal > 0 ? `of ${universeTotal.toLocaleString()} stocks` : "matches"}
            {loading && <span style={{ marginLeft: 8, color: "#3b82f6" }}>Updating...</span>}
          </span>
          {freshness.text && (
            <span style={{
              fontSize: 11,
              color: freshness.stale ? "#f59e0b" : "#666",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              {freshness.stale && <span style={{ fontSize: 10 }}>!</span>}
              {freshness.text}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Column picker toggle */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              style={{
                padding: "4px 8px",
                background: showColumnPicker ? "#3b82f6" : "#333",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Columns ({activeColumns.length})
            </button>
            {showColumnPicker && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 4,
                background: "#222",
                border: "1px solid #444",
                borderRadius: 6,
                padding: 8,
                zIndex: 100,
                minWidth: 180,
                maxHeight: 300,
                overflowY: "auto",
              }}>
                {ALL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 4px",
                      fontSize: 11,
                      cursor: "pointer",
                      color: visibleCols.has(col.key) ? "#fff" : "#666",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      style={{ accentColor: "#3b82f6" }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* CSV Export */}
          <button
            onClick={() => exportToCsv(results.results, activeColumns)}
            style={{
              padding: "4px 8px",
              background: "#333",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>

          {/* Pagination */}
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: "4px 10px",
              background: "#333",
              border: "none",
              borderRadius: 4,
              color: offset === 0 ? "#555" : "#fff",
              cursor: offset === 0 ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#888", padding: "0 4px" }}>
            {currentPage}/{totalPages}
          </span>
          <button
            onClick={() => onPageChange(offset + limit)}
            disabled={offset + limit >= total}
            style={{
              padding: "4px 10px",
              background: "#333",
              border: "none",
              borderRadius: 4,
              color: offset + limit >= total ? "#555" : "#fff",
              cursor: offset + limit >= total ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#222" }}>
              {activeColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  style={{
                    ...thBase,
                    ...(col.align === "left" ? left : right),
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {col.label}
                  {sortBy === col.key && (
                    <span style={{ marginLeft: 4 }}>
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.results.map((row, idx) => (
              <tr
                key={row.ticker}
                onClick={() => onSelectTicker?.(row.ticker)}
                style={{
                  background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  cursor: onSelectTicker ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background =
                    idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";
                }}
              >
                {activeColumns.map(col => {
                  const val = row[col.key];
                  const displayVal = col.format ? col.format(val as any) : (val ?? "—");
                  let color = "#fff";

                  // Color coding for signed columns
                  if (
                    (col.key === "price_change_1d" || col.key === "revenue_growth" ||
                     col.key === "insider_net_shares_90d") &&
                    typeof val === "number"
                  ) {
                    color = val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
                  }

                  // Heatmap background
                  const heatBg = col.heatmap
                    ? getHeatmapBg(val as number | null, col.heatmap, columnValues[col.key] || [])
                    : undefined;

                  // Ticker — special styling
                  if (col.key === "ticker") {
                    return (
                      <td key={col.key} style={{ ...tdBase, ...left, fontWeight: 600, color: "#3b82f6" }}>
                        {displayVal}
                      </td>
                    );
                  }

                  // Company name — truncated
                  if (col.key === "company_name") {
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tdBase, ...left,
                          maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", color: "#aaa",
                        }}
                        title={val as string}
                      >
                        {displayVal}
                      </td>
                    );
                  }

                  // Sector — pill
                  if (col.key === "sector" && val) {
                    return (
                      <td key={col.key} style={{ ...tdBase, ...left }}>
                        <span style={{
                          background: "#333",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          color: "#aaa",
                        }}>
                          {displayVal}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.key}
                      style={{
                        ...tdBase,
                        ...(col.align === "left" ? left : right),
                        color,
                        background: heatBg,
                      }}
                    >
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
