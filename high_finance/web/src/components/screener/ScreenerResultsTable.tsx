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
};

const COLUMNS: { key: keyof ScreenerResult; label: string; align: "left" | "right"; format?: (v: any) => string }[] = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "company_name", label: "Company", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "market_cap", label: "Mkt Cap", align: "right", format: formatLarge },
  { key: "current_price", label: "Price", align: "right", format: v => v != null ? `$${v.toFixed(2)}` : "—" },
  { key: "price_change_1d", label: "1D Chg", align: "right", format: formatPct },
  { key: "pe_ratio", label: "P/E", align: "right", format: formatNum },
  { key: "forward_pe", label: "Fwd P/E", align: "right", format: formatNum },
  { key: "pb_ratio", label: "P/B", align: "right", format: formatNum },
  { key: "ev_to_ebitda", label: "EV/EBITDA", align: "right", format: formatNum },
  { key: "revenue_growth", label: "Rev Growth", align: "right", format: formatPct },
  { key: "dividend_yield", label: "Div Yield", align: "right", format: formatPct },
  { key: "insider_net_shares_90d", label: "Insider Net", align: "right", format: formatShares },
];

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

function formatShares(v: number | null): string {
  if (v == null) return "—";
  if (v === 0) return "0";
  const sign = v > 0 ? "+" : "";
  if (Math.abs(v) >= 1e6) return `${sign}${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${sign}${(v / 1e3).toFixed(1)}K`;
  return `${sign}${v}`;
}

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
}: Props) {
  const total = results?.total ?? 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

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
      {/* Header with count and pagination */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #333",
      }}>
        <span style={{ fontSize: 13, color: "#888" }}>
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()} stocks
          {loading && <span style={{ marginLeft: 8, color: "#3b82f6" }}>Updating...</span>}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
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
          <span style={{ fontSize: 12, color: "#888", padding: "0 8px" }}>
            Page {currentPage} of {totalPages}
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
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  style={{
                    ...thBase,
                    ...(col.align === "left" ? left : right),
                    cursor: "pointer",
                    userSelect: "none",
                    position: "relative",
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
                {COLUMNS.map(col => {
                  const val = row[col.key];
                  let displayVal = col.format ? col.format(val as any) : (val ?? "—");
                  let color = "#fff";

                  // Color coding for change columns
                  if (col.key === "price_change_1d" && typeof val === "number") {
                    color = val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
                  }
                  if (col.key === "revenue_growth" && typeof val === "number") {
                    color = val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
                  }
                  if (col.key === "insider_net_shares_90d" && typeof val === "number") {
                    color = val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
                  }

                  // Ticker gets special styling
                  if (col.key === "ticker") {
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tdBase,
                          ...left,
                          fontWeight: 600,
                          color: "#3b82f6",
                        }}
                      >
                        {displayVal}
                      </td>
                    );
                  }

                  // Company name gets truncation
                  if (col.key === "company_name") {
                    return (
                      <td
                        key={col.key}
                        style={{
                          ...tdBase,
                          ...left,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#aaa",
                        }}
                        title={val as string}
                      >
                        {displayVal}
                      </td>
                    );
                  }

                  // Sector gets a pill style
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
