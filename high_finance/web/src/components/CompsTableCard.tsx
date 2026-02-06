import { useMemo, useState, useCallback, useEffect } from "react";
import type { CompsResponse, MetricStats, PeerGroup, Fundamentals } from "../lib/types";
import { thBase, tdBase, left, right } from "../lib/types";
import { PeerGroupSelector } from "./comps/PeerGroupSelector";
import { PeerGroupEditor } from "./comps/PeerGroupEditor";
import { exportCompsToExcel, downloadBlob } from "../lib/api/peerGroups";

function formatLarge(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return "recently";
  }
}

function formatMetric(metric: string, value: number | null | undefined): string {
  if (value == null) return "—";

  if (metric === "market_cap") return formatLarge(value);

  const percent = new Set(["revenue_growth", "roe", "dividend_yield", "gross_margins"]);
  if (percent.has(metric)) return `${(value * 100).toFixed(1)}%`;

  // ratios / multiples
  return `${value.toFixed(1)}x`;
}

function metricLabel(metric: string): string {
  switch (metric) {
    case "market_cap": return "Mkt Cap";
    case "pe_ratio": return "P/E (TTM)";
    case "forward_pe": return "P/E (NTM)";
    case "pb_ratio": return "P/B";
    case "roe": return "ROE";
    case "ev_to_ebitda": return "EV/EBITDA (TTM)";
    case "ev_to_sales": return "EV/Sales (TTM)";
    case "revenue_growth": return "Rev Growth (YoY)";
    case "gross_margins": return "Gross Margin";
    case "dividend_yield": return "Div Yield";
    case "net_debt_est": return "Net Debt";
    default: return metric;
  }
}

// Helper to calculate premium/discount vs median
function formatPremiumDiscount(
  target: number | null | undefined,
  median: number | null | undefined
): { text: string; color: string } | null {
  if (target == null || median == null || median === 0) return null;
  const pct = ((target - median) / median) * 100;
  const isPositive = pct > 0;
  return {
    text: `${isPositive ? "+" : ""}${pct.toFixed(0)}%`,
    color: isPositive ? "#ef4444" : "#22c55e",  // red = expensive, green = cheap
  };
}

// Helper to format a range (e.g., "12.5x - 18.2x")
function formatRange(metric: string, p25: number | null, p75: number | null): string {
  if (p25 == null || p75 == null) return "—";
  return `${formatMetric(metric, p25)} – ${formatMetric(metric, p75)}`;
}

// Check if metric is a valuation multiple (where premium/discount makes sense)
function isValuationMetric(metric: string): boolean {
  return ["pe_ratio", "forward_pe", "ev_to_ebitda", "ev_to_sales", "pb_ratio"].includes(metric);
}

type Props = {
  data: CompsResponse;
  ticker: string;
  isAuthenticated: boolean;
  onRefetch?: (peerGroupId: number | null, peerTickers: string[] | null) => void;
  onTickerClick?: (ticker: string) => void;
};

// Sort state type
type SortState = {
  column: string | null;
  direction: "asc" | "desc";
};

export function CompsTable({ data, ticker, isAuthenticated, onRefetch, onTickerClick }: Props) {
  const { target, peers, template, statistics, implied_prices } = data;

  // Peer group state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [customPeerTickers, setCustomPeerTickers] = useState<string[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PeerGroup | null>(null);
  const [selectorRefreshKey, setSelectorRefreshKey] = useState(0);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Sort state (column sorting)
  const [sort, setSort] = useState<SortState>({ column: null, direction: "desc" });

  const metrics = template?.metrics ?? ["market_cap", "pe_ratio", "revenue_growth"];

  // Filter metrics that have vs median column (valuation multiples only)
  const valuationMetrics = useMemo(() => metrics.filter(isValuationMetric), [metrics]);

  // Toggle sort on column click
  const handleSortClick = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column === column) {
        // Toggle direction or clear
        return prev.direction === "desc"
          ? { column, direction: "asc" }
          : { column: null, direction: "desc" }; // Clear on third click
      }
      return { column, direction: "desc" }; // New column, start descending
    });
  }, []);

  const allCompanies = useMemo(() => {
    // Filter out any peers that failed to load (status field added by backend for missing tickers)
    const validPeers = peers.filter((p) => (p as any).status !== "not_found");
    const all: Fundamentals[] = [target, ...validPeers];

    // Apply sorting (nulls always to bottom)
    if (sort.column) {
      const col = sort.column;
      const dir = sort.direction === "asc" ? 1 : -1;

      return [...all].sort((a: Fundamentals, b: Fundamentals) => {
        // Target always stays at top
        if (a.ticker === target.ticker) return -1;
        if (b.ticker === target.ticker) return 1;

        const aVal = (a as any)[col] as number | null | undefined;
        const bVal = (b as any)[col] as number | null | undefined;

        // Nulls sort to bottom regardless of direction
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        return (aVal - bVal) * dir;
      });
    }

    // Default: sort by market cap descending, target first
    return [...all].sort((a: Fundamentals, b: Fundamentals) => {
      if (a.ticker === target.ticker) return -1;
      if (b.ticker === target.ticker) return 1;
      return (b.market_cap ?? 0) - (a.market_cap ?? 0);
    });
  }, [target, peers, sort]);

  const hasStats = statistics && Object.keys(statistics).length > 0;
  const hasImpliedPrices = implied_prices && Object.values(implied_prices).some((v) => v != null);

  // Get stats for a metric with fallback
  const getStats = (metric: string): MetricStats => {
    return statistics?.[metric] ?? { mean: null, median: null, p25: null, p75: null, min: null, max: null };
  };

  // Handle peer group selection
  const handlePeerGroupSelect = useCallback(
    (groupId: number | null, peerTickers: string[] | null) => {
      setSelectedGroupId(groupId);
      setCustomPeerTickers(peerTickers);
      if (onRefetch) {
        onRefetch(groupId, peerTickers);
      }
    },
    [onRefetch]
  );

  // Handle creating new peer group
  const handleCreateNew = useCallback(() => {
    setEditingGroup(null);
    setEditorOpen(true);
  }, []);

  // Handle editing existing peer group
  const handleEdit = useCallback((group: PeerGroup) => {
    setEditingGroup(group);
    setEditorOpen(true);
  }, []);

  // Handle peer group saved
  const handlePeerGroupSaved = useCallback(
    (group: PeerGroup) => {
      setSelectorRefreshKey((k) => k + 1);  // Refresh dropdown list
      setSelectedGroupId(group.id);
      setCustomPeerTickers(group.peer_tickers);
      if (onRefetch) {
        onRefetch(group.id, group.peer_tickers);
      }
    },
    [onRefetch]
  );

  // Handle peer group deleted
  const handlePeerGroupDeleted = useCallback(() => {
    setSelectorRefreshKey((k) => k + 1);  // Refresh dropdown list
    setSelectedGroupId(null);
    setCustomPeerTickers(null);
    if (onRefetch) {
      onRefetch(null, null);
    }
  }, [onRefetch]);

  // Handle export
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);

    try {
      const blob = await exportCompsToExcel(ticker, {
        peer_group_id: selectedGroupId ?? undefined,
        peers: customPeerTickers ?? undefined,
      });

      const dateStr = new Date().toISOString().split("T")[0];
      downloadBlob(blob, `${ticker}_comps_${dateStr}.xlsx`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [ticker, selectedGroupId, customPeerTickers]);

  // Clear export error after 5 seconds
  useEffect(() => {
    if (exportError) {
      const timer = setTimeout(() => setExportError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [exportError]);

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16, marginTop: 16 }}>
      {/* Header with controls */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Comparable Analysis</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              {template?.label ?? "Relative valuation"} vs. peers ({target.industry})
            </div>
          </div>

          {/* Controls row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* Peer Group Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#888" }}>Peer Group:</span>
              <PeerGroupSelector
                ticker={ticker}
                selectedGroupId={selectedGroupId}
                onSelect={handlePeerGroupSelect}
                onCreateNew={handleCreateNew}
                onEdit={handleEdit}
                isAuthenticated={isAuthenticated}
                refreshKey={selectorRefreshKey}
              />
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                background: "#333",
                border: "1px solid #444",
                borderRadius: 6,
                padding: "6px 12px",
                color: "#fff",
                fontSize: 13,
                cursor: exporting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting ? (
                <>
                  <span style={{ fontSize: 12 }}>Exporting...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14 }}>&#x2913;</span>
                  <span>Export Excel</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Export error */}
        {exportError && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "#ef444433",
              border: "1px solid #ef4444",
              borderRadius: 4,
              fontSize: 12,
              color: "#ef4444",
            }}
          >
            {exportError}
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, ...left }}>Company</th>
              {metrics.map((m) => {
                const isSorted = sort.column === m;
                const sortIndicator = isSorted
                  ? sort.direction === "asc" ? " ▲" : " ▼"
                  : "";
                return (
                  <th
                    key={m}
                    style={{
                      ...thBase,
                      ...right,
                      cursor: "pointer",
                      userSelect: "none",
                      background: isSorted ? "#222" : "transparent",
                    }}
                    onClick={() => handleSortClick(m)}
                    title={`Click to sort by ${metricLabel(m)}`}
                  >
                    {metricLabel(m)}{sortIndicator}
                  </th>
                );
              })}
              {/* vs Median column for valuation metrics */}
              {valuationMetrics.length > 0 && (
                <th style={{ ...thBase, ...right, color: "#666" }}>vs Med</th>
              )}
            </tr>
          </thead>

          <tbody>
            {allCompanies.map((co: Fundamentals) => {
              const isTarget = co.ticker === target.ticker;

              // Calculate premium/discount for target row (use first valuation metric with data)
              let premiumBadge: { text: string; color: string } | null = null;
              if (isTarget && hasStats) {
                for (const m of valuationMetrics) {
                  const targetVal = (co as any)[m] as number | null;
                  const medianVal = getStats(m).median;
                  premiumBadge = formatPremiumDiscount(targetVal, medianVal);
                  if (premiumBadge) break;
                }
              }

              return (
                <tr
                  key={co.ticker}
                  style={{
                    borderBottom: "1px solid #222",
                    background: isTarget ? "rgba(255, 255, 255, 0.03)" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 8px", ...left }}>
                    {isTarget ? (
                      <>
                        <span style={{ fontWeight: 700, color: "#fff" }}>
                          {co.ticker}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: 10, background: "#333", padding: "2px 6px", borderRadius: 4 }}>
                          TARGET
                        </span>
                      </>
                    ) : (
                      <span
                        onClick={() => onTickerClick?.(co.ticker)}
                        style={{
                          fontWeight: 500,
                          color: onTickerClick ? "#3b82f6" : "#ddd",
                          cursor: onTickerClick ? "pointer" : "default",
                          textDecoration: onTickerClick ? "none" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (onTickerClick) e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {co.ticker}
                      </span>
                    )}
                  </td>

                  {metrics.map((m) => {
                    const val = (co as any)[m] as number | null | undefined;
                    return (
                      <td key={m} style={{ ...tdBase, ...right }}>
                        {formatMetric(m, val)}
                      </td>
                    );
                  })}

                  {/* vs Median badge for target */}
                  {valuationMetrics.length > 0 && (
                    <td style={{ ...tdBase, ...right }}>
                      {isTarget && premiumBadge ? (
                        <span
                          style={{
                            color: premiumBadge.color,
                            fontWeight: 600,
                            fontSize: 12,
                            padding: "2px 6px",
                            background: `${premiumBadge.color}15`,
                            borderRadius: 4,
                          }}
                        >
                          {premiumBadge.text}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {/* ── Statistics Rows ── */}
            {hasStats && (
              <>
                {/* Peer Median Row */}
                <tr style={{ borderTop: "2px solid #444", fontWeight: 600, background: "#111" }}>
                  <td style={{ padding: "10px 8px", ...left, color: "#22c55e" }}>Peer Median</td>
                  {metrics.map((m) => (
                    <td key={m} style={{ ...tdBase, ...right, color: "#22c55e" }}>
                      {formatMetric(m, getStats(m).median)}
                    </td>
                  ))}
                  {valuationMetrics.length > 0 && <td style={{ ...tdBase, ...right }}>—</td>}
                </tr>

                {/* Peer Mean Row */}
                <tr style={{ background: "#0d0d0d" }}>
                  <td style={{ padding: "10px 8px", ...left, color: "#888" }}>Peer Mean</td>
                  {metrics.map((m) => (
                    <td key={m} style={{ ...tdBase, ...right, color: "#888" }}>
                      {formatMetric(m, getStats(m).mean)}
                    </td>
                  ))}
                  {valuationMetrics.length > 0 && <td style={{ ...tdBase, ...right }}>—</td>}
                </tr>

                {/* 25th - 75th Percentile Range Row */}
                <tr style={{ background: "#0d0d0d" }}>
                  <td style={{ padding: "10px 8px", ...left, color: "#666", fontSize: 11 }}>25th – 75th</td>
                  {metrics.map((m) => {
                    const s = getStats(m);
                    return (
                      <td key={m} style={{ ...tdBase, ...right, color: "#666", fontSize: 11 }}>
                        {formatRange(m, s.p25, s.p75)}
                      </td>
                    );
                  })}
                  {valuationMetrics.length > 0 && <td style={{ ...tdBase, ...right }}>—</td>}
                </tr>
              </>
            )}

            {/* ── Implied Valuation Row ── */}
            {hasImpliedPrices && (
              <tr style={{ background: "#1a2f1a", borderTop: "2px solid #22c55e" }}>
                <td
                  style={{
                    padding: "12px 8px",
                    ...left,
                    color: "#22c55e",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Implied Price @ Median
                </td>
                <td
                  colSpan={metrics.length + (valuationMetrics.length > 0 ? 1 : 0)}
                  style={{ padding: "12px 8px", ...right }}
                >
                  <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {implied_prices.forward_pe != null && (
                      <span style={{ color: "#fff" }}>
                        <span style={{ color: "#888", fontSize: 11 }}>P/E (NTM):</span>{" "}
                        <span style={{ fontWeight: 600 }}>{formatCurrency(implied_prices.forward_pe)}</span>
                      </span>
                    )}
                    {implied_prices.pe_ratio != null && (
                      <span style={{ color: "#fff" }}>
                        <span style={{ color: "#888", fontSize: 11 }}>P/E (TTM):</span>{" "}
                        <span style={{ fontWeight: 600 }}>{formatCurrency(implied_prices.pe_ratio)}</span>
                      </span>
                    )}
                    {implied_prices.ev_to_ebitda != null && (
                      <span style={{ color: "#fff" }}>
                        <span style={{ color: "#888", fontSize: 11 }}>EV/EBITDA:</span>{" "}
                        <span style={{ fontWeight: 600 }}>{formatCurrency(implied_prices.ev_to_ebitda)}</span>
                      </span>
                    )}
                    {implied_prices.ev_to_sales != null && (
                      <span style={{ color: "#fff" }}>
                        <span style={{ color: "#888", fontSize: 11 }}>EV/Sales:</span>{" "}
                        <span style={{ fontWeight: 600 }}>{formatCurrency(implied_prices.ev_to_sales)}</span>
                      </span>
                    )}
                    {/* Show current price for context */}
                    {target.current_price != null && (
                      <span style={{ color: "#666", fontSize: 11, marginLeft: 8 }}>
                        (Current: {formatCurrency(target.current_price)})
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Data freshness indicator */}
      {target.fetched_at && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#666", textAlign: "right" }}>
          Data fetched {formatRelativeTime(target.fetched_at)} • May not reflect real-time prices
        </div>
      )}

      {/* Peer Group Editor Modal */}
      <PeerGroupEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handlePeerGroupSaved}
        onDelete={editingGroup ? handlePeerGroupDeleted : undefined}
        ticker={ticker}
        existingGroup={editingGroup}
      />
    </div>
  );
}
