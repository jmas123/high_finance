import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { ForwardReturnEvent, EventStatsResponse, EventSummaryResponse } from "../../lib/types";
import { thBase, tdBase, right } from "../../lib/types";
import { useIsMobile } from "../../lib/useIsMobile";
import { MobileCardRow, MobileCardField } from "../common/MobileCard";

// ── Helpers ──────────────────────────────────────────────────────────────

function returnColor(val: number | null): string {
  if (val == null) return "#888";
  return val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
}

function fmtPct(val: number | null): string {
  if (val == null) return "—";
  return `${val > 0 ? "+" : ""}${(val * 100).toFixed(1)}%`;
}

function fmtPrice(val: number | null): string {
  if (val == null) return "—";
  return `$${val.toFixed(2)}`;
}

function fmtAmount(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  const fmt = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };
  if (min != null && max != null && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt(min ?? max!);
}

function alpha30d(e: ForwardReturnEvent): number | null {
  if (e.ret_30d == null || e.spy_ret_30d == null) return null;
  return e.ret_30d - e.spy_ret_30d;
}

// ── Sort types ───────────────────────────────────────────────────────────

type SortKey = "event_date" | "actor_name" | "ticker" | "anchor_price" | "ret_7d" | "ret_30d" | "ret_90d" | "ret_180d";

const SORTABLE_COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "event_date", label: "Date" },
  { key: "actor_name", label: "Politician" },
  { key: "ticker", label: "Ticker" },
  { key: "anchor_price", label: "Price", align: "right" },
  { key: "ret_7d", label: "7d", align: "right" },
  { key: "ret_30d", label: "30d", align: "right" },
  { key: "ret_90d", label: "90d", align: "right" },
  { key: "ret_180d", label: "180d", align: "right" },
];

const PAGE_SIZE = 50;
const WINDOWS = [7, 30, 60, 90, 180] as const;

// ── Pill style ───────────────────────────────────────────────────────────

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: "5px 12px",
  borderRadius: 6,
  border: `1px solid ${active ? "#3b82f6" : "#444"}`,
  background: active ? "#3b82f620" : "#222",
  color: active ? "#3b82f6" : "#aaa",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: active ? 600 : 400,
});

// ═══════════════════════════════════════════════════════════════════════════
// FORWARD RETURNS CARD
// ═══════════════════════════════════════════════════════════════════════════

export function ForwardReturnsCard() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filter state (from URL params) ──────────────────────────────────
  const [ticker, setTicker] = useState(() => searchParams.get("ticker") || "");
  const [actorName, setActorName] = useState(() => searchParams.get("actor") || "");
  const [direction, setDirection] = useState<string>(() => searchParams.get("dir") || "");
  const [sortBy, setSortBy] = useState<SortKey>(() => {
    const v = searchParams.get("sort") as SortKey | null;
    return v && SORTABLE_COLUMNS.some(c => c.key === v) ? v : "ret_30d";
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() =>
    searchParams.get("asc") === "1" ? "asc" : "desc"
  );
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get("page"));
    return p >= 1 ? p : 1;
  });

  // ── Data state ──────────────────────────────────────────────────────
  const [events, setEvents] = useState<ForwardReturnEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EventStatsResponse | null>(null);

  // ── Summary state ─────────────────────────────────────────────────
  const [summaryWindow, setSummaryWindow] = useState<number>(30);
  const [summary, setSummary] = useState<EventSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Debounce refs for text filters
  const tickerDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const actorDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [draftTicker, setDraftTicker] = useState(ticker);
  const [draftActor, setDraftActor] = useState(actorName);

  // ── Sync filters to URL ────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (ticker) params.set("ticker", ticker);
    if (actorName) params.set("actor", actorName);
    if (direction) params.set("dir", direction);
    if (sortBy !== "ret_30d") params.set("sort", sortBy);
    if (sortDir === "asc") params.set("asc", "1");
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [ticker, actorName, direction, sortBy, sortDir, page, setSearchParams]);

  // ── Fetch data ─────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    api.forwardReturns({
      ticker: ticker || undefined,
      direction: direction || undefined,
      actor_name: actorName || undefined,
      date_from: "2020-01-01",
      has_returns: true,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      page_size: PAGE_SIZE,
    }, controller.signal)
      .then((res) => {
        setEvents(res.events);
        setTotal(res.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") console.error("Failed to fetch forward returns:", e);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ticker, actorName, direction, sortBy, sortDir, page]);

  // ── Fetch stats (once on mount) ────────────────────────────────────
  useEffect(() => {
    api.eventStats().then(setStats).catch(() => {});
  }, []);

  // ── Fetch summary ─────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setSummaryLoading(true);
    setSummaryError(null);
    api.eventSummary({
      window: summaryWindow,
      direction: direction || "all",
      ticker: ticker || undefined,
    }, controller.signal)
      .then(setSummary)
      .catch((e) => {
        if (e.name !== "AbortError") setSummaryError(e.message || "Failed to load summary");
      })
      .finally(() => setSummaryLoading(false));
    return () => controller.abort();
  }, [summaryWindow, direction, ticker]);

  // ── Debounced text filter handlers ─────────────────────────────────
  function handleTickerChange(val: string) {
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 10);
    setDraftTicker(sanitized);
    if (tickerDebounce.current) clearTimeout(tickerDebounce.current);
    tickerDebounce.current = setTimeout(() => {
      setTicker(sanitized);
      setPage(1);
    }, 400);
  }

  function handleActorChange(val: string) {
    setDraftActor(val);
    if (actorDebounce.current) clearTimeout(actorDebounce.current);
    actorDebounce.current = setTimeout(() => {
      setActorName(val);
      setPage(1);
    }, 400);
  }

  // ── Sort handler ───────────────────────────────────────────────────
  function handleSort(col: SortKey) {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  }

  function handleDirectionFilter(val: string) {
    setDirection(direction === val ? "" : val);
    setPage(1);
  }

  // ── Pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  const inputStyle: React.CSSProperties = {
    background: "#222",
    border: "1px solid #444",
    borderRadius: 6,
    color: "#fff",
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    width: isMobile ? "100%" : 140,
  };

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: isMobile ? 12 : 20 }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Forward Returns
      </div>

      {/* ── Stats Banner ──────────────────────────────────────────── */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginBottom: 20,
          padding: 14,
          background: "rgba(59, 130, 246, 0.05)",
          borderRadius: 8,
          border: "1px solid rgba(59, 130, 246, 0.1)",
        }}>
          <StatCell label="Total Events" value={stats.total_events.toLocaleString()} />
          <StatCell label="With Returns" value={stats.events_with_returns.toLocaleString()} />
          <StatCell
            label="Win Rate (30d)"
            value={stats.win_rate_30d != null ? `${(stats.win_rate_30d * 100).toFixed(1)}%` : "—"}
            color={stats.win_rate_30d != null && stats.win_rate_30d > 0.5 ? "#22c55e" : "#ef4444"}
          />
          <StatCell
            label="Avg Return (30d)"
            value={fmtPct(stats.avg_ret_30d)}
            color={returnColor(stats.avg_ret_30d)}
          />
          <StatCell
            label="Avg Alpha (30d)"
            value={fmtPct(stats.avg_alpha_30d)}
            color={returnColor(stats.avg_alpha_30d)}
          />
        </div>
      )}

      {/* ── Window Selector ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setSummaryWindow(w)}
            style={pillStyle(summaryWindow === w)}
          >
            {w}d
          </button>
        ))}
      </div>

      {/* ── Summary Blocks ─────────────────────────────────────────── */}
      {summaryError && (
        <div style={{
          padding: "8px 12px", marginBottom: 16, borderRadius: 6,
          background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
          color: "#ef4444", fontSize: 12,
        }}>
          Summary unavailable: {summaryError}
        </div>
      )}

      {summaryLoading && !summary && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12, marginBottom: 20,
        }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              background: "#222", borderRadius: 8, padding: 16, height: 80,
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      )}

      {summary && (
        <>
          {/* Direction cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 12, marginBottom: 16,
          }}>
            <DirectionCard label="BUY" stats={summary.buys} color="#22c55e" />
            <DirectionCard label="SELL" stats={summary.sells} color="#ef4444" />
          </div>

          {/* Distribution */}
          {summary.distribution.total_with_data > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: 12, marginBottom: 16,
              padding: 14, background: "#1f1f1f", borderRadius: 8, border: "1px solid #333",
            }}>
              <StatCell label="Median Alpha" value={fmtPct(summary.distribution.median_return)} color={returnColor(summary.distribution.median_return)} />
              <StatCell label="P25" value={fmtPct(summary.distribution.p25_return)} color={returnColor(summary.distribution.p25_return)} />
              <StatCell label="P75" value={fmtPct(summary.distribution.p75_return)} color={returnColor(summary.distribution.p75_return)} />
              <StatCell label="Worst" value={fmtPct(summary.distribution.worst_return)} color="#ef4444" />
              <StatCell label="Best" value={fmtPct(summary.distribution.best_return)} color="#22c55e" />
              <StatCell label="Trades" value={summary.distribution.total_with_data.toLocaleString()} />
            </div>
          )}

          {/* Regime stats */}
          {summary.regime_stats && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12, marginBottom: 16,
            }}>
              <RegimeCard label="Low Vol" stats={summary.regime_stats.low_vol} />
              <RegimeCard label="High Vol" stats={summary.regime_stats.high_vol} />
            </div>
          )}

          {/* Top politicians */}
          {summary.top_politicians.length > 0 && (
            <div style={{
              marginBottom: 16, background: "#1f1f1f", borderRadius: 8,
              border: "1px solid #333", overflow: "hidden",
            }}>
              <div style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, borderBottom: "1px solid #333" }}>
                Top Politicians by Alpha ({summaryWindow}d)
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thBase, paddingLeft: 14 }}>Politician</th>
                      <th style={{ ...thBase, ...right }}>Trades</th>
                      <th style={{ ...thBase, ...right }}>Win Rate</th>
                      <th style={{ ...thBase, ...right, paddingRight: 14 }}>Avg Alpha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.top_politicians.map(p => (
                      <tr key={p.actor_id} style={{ borderBottom: "1px solid #222" }}>
                        <td style={{ ...tdBase, paddingLeft: 14, fontSize: 12 }}>{p.name}</td>
                        <td style={{ ...tdBase, ...right, fontSize: 12 }}>{p.trade_count}</td>
                        <td style={{ ...tdBase, ...right, fontSize: 12, color: p.win_rate != null && p.win_rate > 0.5 ? "#22c55e" : "#ef4444" }}>
                          {p.win_rate != null ? `${(p.win_rate * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td style={{ ...tdBase, ...right, paddingRight: 14, fontSize: 12, fontWeight: 600, color: returnColor(p.avg_alpha) }}>
                          {fmtPct(p.avg_alpha)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "6px 14px", fontSize: 10, color: "#666", borderTop: "1px solid #222" }}>
                Min. {summary.min_trades_filter} trades required
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <input
          placeholder="Ticker..."
          value={draftTicker}
          onChange={e => handleTickerChange(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Politician..."
          value={draftActor}
          onChange={e => handleActorChange(e.target.value)}
          style={{ ...inputStyle, width: isMobile ? "100%" : 160 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => handleDirectionFilter("")} style={pillStyle(!direction)}>All</button>
          <button onClick={() => handleDirectionFilter("buy")} style={pillStyle(direction === "buy")}>Buy</button>
          <button onClick={() => handleDirectionFilter("sell")} style={pillStyle(direction === "sell")}>Sell</button>
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, opacity: 0.5 }}>Loading...</div>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!loading && events.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
          No events found matching your filters.
        </div>
      )}

      {/* ── Desktop Table ─────────────────────────────────────────── */}
      {!loading && events.length > 0 && !isMobile && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {SORTABLE_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      ...thBase,
                      ...(col.align === "right" ? right : {}),
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {col.label}
                    <SortArrow col={col.key} />
                  </th>
                ))}
                <th style={{ ...thBase, textAlign: "center" }}>Dir</th>
                <th style={{ ...thBase, ...right }}>Amount</th>
                <th style={{ ...thBase, ...right }}>Alpha 30d</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => {
                const a30 = alpha30d(e);
                return (
                  <tr key={e.event_id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={tdBase}>{e.event_date}</td>
                    <td style={tdBase}>{e.actor_name}</td>
                    <td style={tdBase}>
                      <Link
                        to={`/quote/${e.ticker}`}
                        style={{ color: "#3b82f6", textDecoration: "none" }}
                      >
                        {e.ticker}
                      </Link>
                    </td>
                    <td style={{ ...tdBase, ...right }}>{fmtPrice(e.anchor_price)}</td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.ret_7d) }}>
                      {fmtPct(e.ret_7d)}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.ret_30d) }}>
                      {fmtPct(e.ret_30d)}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.ret_90d) }}>
                      {fmtPct(e.ret_90d)}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.ret_180d) }}>
                      {fmtPct(e.ret_180d)}
                    </td>
                    <td style={{ ...tdBase, textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: e.direction === "buy" ? "#22c55e20" : "#ef444420",
                        color: e.direction === "buy" ? "#22c55e" : "#ef4444",
                      }}>
                        {e.direction === "buy" ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td style={{ ...tdBase, ...right, fontSize: 11 }}>
                      {fmtAmount(e.amount_min, e.amount_max)}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(a30), fontWeight: 600 }}>
                      {fmtPct(a30)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile Cards ──────────────────────────────────────────── */}
      {!loading && events.length > 0 && isMobile && (
        <div>
          {events.map(e => {
            const a30 = alpha30d(e);
            return (
              <MobileCardRow key={e.event_id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <Link
                      to={`/quote/${e.ticker}`}
                      style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
                    >
                      {e.ticker}
                    </Link>
                    <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>{e.event_date}</span>
                  </div>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: e.direction === "buy" ? "#22c55e20" : "#ef444420",
                    color: e.direction === "buy" ? "#22c55e" : "#ef4444",
                  }}>
                    {e.direction === "buy" ? "BUY" : "SELL"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
                  {e.actor_name}
                  {e.anchor_price != null && (
                    <span style={{ marginLeft: 8, color: "#888" }}>@ {fmtPrice(e.anchor_price)}</span>
                  )}
                  <span style={{ marginLeft: 8, color: "#666" }}>{fmtAmount(e.amount_min, e.amount_max)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))", gap: 6 }}>
                  <MobileCardField label="7d" value={
                    <span style={{ color: returnColor(e.ret_7d), fontWeight: 600 }}>{fmtPct(e.ret_7d)}</span>
                  } />
                  <MobileCardField label="30d" value={
                    <span style={{ color: returnColor(e.ret_30d), fontWeight: 600 }}>{fmtPct(e.ret_30d)}</span>
                  } />
                  <MobileCardField label="90d" value={
                    <span style={{ color: returnColor(e.ret_90d), fontWeight: 600 }}>{fmtPct(e.ret_90d)}</span>
                  } />
                  <MobileCardField label="180d" value={
                    <span style={{ color: returnColor(e.ret_180d), fontWeight: 600 }}>{fmtPct(e.ret_180d)}</span>
                  } />
                  <MobileCardField label="Alpha" value={
                    <span style={{ color: returnColor(a30), fontWeight: 600 }}>{fmtPct(a30)}</span>
                  } />
                </div>
              </MobileCardRow>
            );
          })}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────── */}
      {!loading && total > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
          padding: "8px 0",
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              ...pillStyle(false),
              opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? "default" : "pointer",
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#888" }}>
            Page {page} of {totalPages} ({total.toLocaleString()} results)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              ...pillStyle(false),
              opacity: page >= totalPages ? 0.4 : 1,
              cursor: page >= totalPages ? "default" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color || "#fff" }}>{value}</div>
    </div>
  );
}

function DirectionCard({ label, stats, color }: {
  label: string;
  stats: { trades: number; win_rate: number | null; avg_return: number | null; avg_alpha: number | null };
  color: string;
}) {
  if (stats.trades === 0) {
    return (
      <div style={{
        background: "#1f1f1f", borderRadius: 8, padding: 16,
        border: "1px solid #333",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#666" }}>No trades</div>
      </div>
    );
  }
  return (
    <div style={{
      background: "#1f1f1f", borderRadius: 8, padding: 16,
      border: "1px solid #333",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 12, color: "#888" }}>{stats.trades.toLocaleString()} trades</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Win Rate</div>
          <div style={{
            fontSize: 16, fontWeight: 600,
            color: stats.win_rate != null && stats.win_rate > 0.5 ? "#22c55e" : "#ef4444",
          }}>
            {stats.win_rate != null ? `${(stats.win_rate * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Avg Return</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: returnColor(stats.avg_return) }}>
            {fmtPct(stats.avg_return)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Avg Alpha</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: returnColor(stats.avg_alpha) }}>
            {fmtPct(stats.avg_alpha)}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegimeCard({ label, stats }: {
  label: string;
  stats: { trades: number; win_rate: number | null; avg_alpha: number | null };
}) {
  return (
    <div style={{
      background: "#1f1f1f", borderRadius: 8, padding: 14,
      border: "1px solid #333",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#aaa", marginBottom: 8 }}>
        {label} Regime
      </div>
      {stats.trades === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>No data</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Trades</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{stats.trades.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Win Rate</div>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: stats.win_rate != null && stats.win_rate > 0.5 ? "#22c55e" : "#ef4444",
            }}>
              {stats.win_rate != null ? `${(stats.win_rate * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Avg Alpha</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: returnColor(stats.avg_alpha) }}>
              {fmtPct(stats.avg_alpha)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
