import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { LeaderboardEntry, LeaderboardResponse } from "../../lib/types";
import { thBase, tdBase, right } from "../../lib/types";
import { InfoTip } from "../common/InfoTip";
import { CONGRESS_TIPS } from "../../lib/tooltips";
import { useIsMobile } from "../../lib/useIsMobile";
import { MobileCardRow, MobileCardField } from "../common/MobileCard";

type SortKey = keyof LeaderboardEntry;

const DELAY_OPTIONS = [0, 1, 3, 7, 14];
const HOLD_OPTIONS = [30, 60, 90];
const CHAMBER_OPTIONS = ["", "Senate", "House"];
const PARTY_OPTIONS = ["", "Democrat", "Republican"];
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i);

/** Null-safe toFixed helper */
function safeFixed(val: number | null | undefined, digits: number): string {
  return val != null ? val.toFixed(digits) : "—";
}

function gradeColor(grade: string | null): string {
  if (!grade) return "#666";
  if (grade === "A+" || grade === "A") return "#22c55e";
  if (grade === "B") return "#3b82f6";
  if (grade === "C") return "#f59e0b";
  if (grade === "D") return "#ef4444";
  return "#ef4444"; // F
}

function partyColor(party: string | null): string {
  if (!party) return "#666";
  const p = party.toLowerCase();
  if (p.includes("democrat")) return "#3b82f6";
  if (p.includes("republican")) return "#ef4444";
  return "#888";
}

function returnColor(val: number | null): string {
  if (val == null) return "#888";
  return val > 0 ? "#22c55e" : val < 0 ? "#ef4444" : "#888";
}

/** Months of backtest history between first and last trade dates */
function historyMonths(first: string | null | undefined, last: string | null | undefined): number | null {
  if (!first || !last) return null;
  const a = new Date(first);
  const b = new Date(last);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

const SHORT_HISTORY_MONTHS = 24;
const VALID_SORT_KEYS = new Set<string>([
  "politician_name", "num_trades_priced", "win_rate", "total_return_pct",
  "avg_return_per_trade_pct", "annualized_return_pct", "alpha_pct",
  "max_drawdown_pct", "grade",
]);

export function CongressLeaderboard() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params — preserves filters across navigation
  const [delayDays, setDelayDays] = useState(() => {
    const v = Number(searchParams.get("delay"));
    return DELAY_OPTIONS.includes(v) ? v : 3;
  });
  const [holdDays, setHoldDays] = useState(() => {
    const v = Number(searchParams.get("hold"));
    return HOLD_OPTIONS.includes(v) ? v : 30;
  });
  const [chamber, setChamber] = useState(() => {
    const v = searchParams.get("chamber") ?? "";
    return CHAMBER_OPTIONS.includes(v) ? v : "";
  });
  const [party, setParty] = useState(() => {
    const v = searchParams.get("party") ?? "";
    return PARTY_OPTIONS.includes(v) ? v : "";
  });
  const [sinceYear, setSinceYear] = useState(() => {
    const v = Number(searchParams.get("year"));
    return YEAR_OPTIONS.includes(v) ? v : 2020;
  });

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const v = searchParams.get("sort");
    return v && VALID_SORT_KEYS.has(v) ? (v as SortKey) : "total_return_pct";
  });
  const [sortAsc, setSortAsc] = useState(() => searchParams.get("asc") === "1");
  const abortRef = useRef<AbortController | null>(null);

  // Sync state → URL (replace so we don't pollute history)
  useEffect(() => {
    const params = new URLSearchParams();
    if (delayDays !== 3) params.set("delay", String(delayDays));
    if (holdDays !== 30) params.set("hold", String(holdDays));
    if (chamber) params.set("chamber", chamber);
    if (party) params.set("party", party);
    if (sinceYear !== 2020) params.set("year", String(sinceYear));
    if (sortKey !== "total_return_pct") params.set("sort", sortKey);
    if (sortAsc) params.set("asc", "1");
    setSearchParams(params, { replace: true });
  }, [delayDays, holdDays, chamber, party, sinceYear, sortKey, sortAsc, setSearchParams]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    api.politicianLeaderboard(delayDays, holdDays, {
      sinceYear,
    })
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load leaderboard");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [delayDays, holdDays, sinceYear]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Client-side filtering for chamber/party (avoids separate cache keys per combo)
  const filtered = useMemo(() => data?.entries.filter((e) => {
    if (chamber && !(e.chamber ?? "").toLowerCase().includes(chamber.toLowerCase())) return false;
    if (party && !(e.party ?? "").toLowerCase().includes(party.toLowerCase())) return false;
    return true;
  }) ?? [], [data, chamber, party]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  }), [filtered, sortKey, sortAsc]);

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

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return <span style={{ marginLeft: 4 }}>{sortAsc ? "▲" : "▼"}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Congress Trading Leaderboard
        </div>
        <div style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center" }}>
          Backtested returns if you copied each politician's disclosed Buy trades
          with a {delayDays}-day delay and held for {holdDays} days.
          Starting capital: $10,000.<InfoTip text={CONGRESS_TIPS.backtest} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {/* Delay */}
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
            Copy Delay<InfoTip text={CONGRESS_TIPS.copy_delay} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {DELAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDelayDays(d)}
                style={pillStyle(delayDays === d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Hold Period */}
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
            Hold Period<InfoTip text={CONGRESS_TIPS.hold_period} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {HOLD_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setHoldDays(h)}
                style={pillStyle(holdDays === h)}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>

        {/* Chamber */}
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
            Chamber
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {CHAMBER_OPTIONS.map((c) => (
              <button
                key={c || "all"}
                onClick={() => setChamber(chamber === c ? "" : c)}
                style={pillStyle(chamber === c)}
              >
                {c || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Party */}
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
            Party
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {PARTY_OPTIONS.map((p) => (
              <button
                key={p || "all"}
                onClick={() => setParty(party === p ? "" : p)}
                style={pillStyle(party === p)}
              >
                {p || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Since Year */}
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase" }}>
            Since
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => setSinceYear(y)}
                style={pillStyle(sinceYear === y)}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 14 }}>
              Computing backtests... this may take a moment on first load.
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: 24, color: "#ef4444" }}>Error: {error}</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
            No politicians matched the criteria.
          </div>
        ) : (
          isMobile ? (
            <div style={{ padding: 8 }}>
              {sorted.map((e, i) => (
                <MobileCardRow
                  key={e.politician_id}
                  onClick={() => navigate(`/congress/${e.politician_id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#666", fontSize: 12 }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#3b82f6" }}>{e.politician_name}</span>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          background: partyColor(e.party) + "20",
                          color: partyColor(e.party),
                        }}
                      >
                        {e.party?.charAt(0) || "?"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: gradeColor(e.grade),
                      }}
                    >
                      {e.grade || "—"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                    {e.chamber || "—"}{e.state ? ` • ${e.state}` : ""} • {e.num_trades_priced} positions
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <MobileCardField label="Win Rate" value={`${safeFixed(e.win_rate, 1)}%`} />
                    <MobileCardField label="Total Return" value={
                      <span style={{ color: returnColor(e.total_return_pct), fontWeight: 600 }}>
                        {e.total_return_pct > 0 ? "+" : ""}{safeFixed(e.total_return_pct, 1)}%
                      </span>
                    } />
                    <MobileCardField label="Avg/Trade" value={
                      <span style={{ color: returnColor(e.avg_return_per_trade_pct ?? null) }}>
                        {e.avg_return_per_trade_pct != null
                          ? `${e.avg_return_per_trade_pct > 0 ? "+" : ""}${e.avg_return_per_trade_pct.toFixed(1)}%`
                          : "—"}
                      </span>
                    } />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
                    <MobileCardField label="Alpha vs SPY" value={
                      <span style={{ color: returnColor(e.alpha_pct), fontWeight: 600 }}>
                        {e.alpha_pct > 0 ? "+" : ""}{safeFixed(e.alpha_pct, 1)}%
                      </span>
                    } />
                    <MobileCardField label="Ann. Return" value={
                      <span style={{ color: returnColor(e.annualized_return_pct) }}>
                        {e.annualized_return_pct != null
                          ? `${e.annualized_return_pct > 0 ? "+" : ""}${e.annualized_return_pct.toFixed(1)}%`
                          : "—"}
                      </span>
                    } />
                    <MobileCardField label="Max DD" value={
                      <span style={{ color: e.max_drawdown_pct ? "#ef4444" : "#888" }}>
                        {e.max_drawdown_pct ? `-${safeFixed(e.max_drawdown_pct, 1)}%` : "0.0%"}
                      </span>
                    } />
                  </div>
                </MobileCardRow>
              ))}
            </div>
          ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign: "left", paddingLeft: 16 }}>#</th>
                  <th
                    style={{ ...thBase, textAlign: "left", cursor: "pointer" }}
                    onClick={() => handleSort("politician_name")}
                  >
                    Name <SortArrow col="politician_name" />
                  </th>
                  <th style={{ ...thBase, textAlign: "center" }}>Party</th>
                  <th style={{ ...thBase, textAlign: "left" }}>Chamber</th>
                  <th style={{ ...thBase, textAlign: "left" }}>State</th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("num_trades_priced")}
                  >
                    Positions <SortArrow col="num_trades_priced" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("win_rate")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>Win Rate<InfoTip text={CONGRESS_TIPS.win_rate} /></span> <SortArrow col="win_rate" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("total_return_pct")}
                  >
                    Total Return <SortArrow col="total_return_pct" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("avg_return_per_trade_pct")}
                  >
                    Avg/Trade <SortArrow col="avg_return_per_trade_pct" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("annualized_return_pct")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>Ann. Return<InfoTip text={CONGRESS_TIPS.ann_return} /></span> <SortArrow col="annualized_return_pct" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("alpha_pct")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>Alpha vs SPY<InfoTip text={CONGRESS_TIPS.alpha_vs_spy} /></span> <SortArrow col="alpha_pct" />
                  </th>
                  <th
                    style={{ ...thBase, ...right, cursor: "pointer" }}
                    onClick={() => handleSort("max_drawdown_pct")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>Max DD<InfoTip text={CONGRESS_TIPS.max_dd} /></span> <SortArrow col="max_drawdown_pct" />
                  </th>
                  <th
                    style={{ ...thBase, textAlign: "center", cursor: "pointer" }}
                    onClick={() => handleSort("grade")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>Grade<InfoTip text={CONGRESS_TIPS.grade} /></span> <SortArrow col="grade" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr
                    key={e.politician_id}
                    onClick={() => navigate(`/congress/${e.politician_id}`)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid #222",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={isMobile ? undefined : (ev) => {
                      (ev.currentTarget as HTMLTableRowElement).style.background = "#252525";
                    }}
                    onMouseLeave={isMobile ? undefined : (ev) => {
                      (ev.currentTarget as HTMLTableRowElement).style.background = "transparent";
                    }}
                  >
                    <td style={{ ...tdBase, paddingLeft: 16, color: "#666", fontSize: 12 }}>
                      {i + 1}
                    </td>
                    <td style={{ ...tdBase, fontFamily: "system-ui" }}>
                      <span
                        style={{ fontWeight: 600, color: "#3b82f6" }}
                        onMouseEnter={isMobile ? undefined : (ev) => { ev.currentTarget.style.textDecoration = "underline"; }}
                        onMouseLeave={isMobile ? undefined : (ev) => { ev.currentTarget.style.textDecoration = "none"; }}
                      >
                        {e.politician_name}
                      </span>
                      {(() => {
                        const months = historyMonths(e.first_trade_date, e.last_trade_date);
                        if (months != null && months < SHORT_HISTORY_MONTHS) {
                          return (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontSize: 9,
                                fontWeight: 700,
                                background: "#f59e0b20",
                                color: "#f59e0b",
                                verticalAlign: "middle",
                              }}
                            >
                              {months < 12 ? `${months}mo` : `${Math.round(months / 12)}yr`}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td style={{ ...tdBase, textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          background: partyColor(e.party) + "20",
                          color: partyColor(e.party),
                        }}
                      >
                        {e.party?.charAt(0) || "?"}
                      </span>
                    </td>
                    <td style={{ ...tdBase, fontSize: 12, color: "#aaa" }}>
                      {e.chamber || "—"}
                    </td>
                    <td style={{ ...tdBase, fontSize: 12, color: "#aaa" }}>
                      {e.state || "—"}
                    </td>
                    <td style={{ ...tdBase, ...right }}>{e.num_trades_priced}</td>
                    <td style={{ ...tdBase, ...right }}>
                      {safeFixed(e.win_rate, 1)}%
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.total_return_pct), fontWeight: 600 }}>
                      {e.total_return_pct > 0 ? "+" : ""}
                      {safeFixed(e.total_return_pct, 1)}%
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.avg_return_per_trade_pct ?? null) }}>
                      {e.avg_return_per_trade_pct != null
                        ? `${e.avg_return_per_trade_pct > 0 ? "+" : ""}${e.avg_return_per_trade_pct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.annualized_return_pct) }}>
                      {e.annualized_return_pct != null
                        ? `${e.annualized_return_pct > 0 ? "+" : ""}${e.annualized_return_pct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td style={{ ...tdBase, ...right, color: returnColor(e.alpha_pct), fontWeight: 600 }}>
                      {e.alpha_pct > 0 ? "+" : ""}
                      {safeFixed(e.alpha_pct, 1)}%
                    </td>
                    <td style={{ ...tdBase, ...right, color: e.max_drawdown_pct ? "#ef4444" : "#888" }}>
                      {e.max_drawdown_pct ? `-${safeFixed(e.max_drawdown_pct, 1)}%` : "0.0%"}
                    </td>
                    <td style={{ ...tdBase, textAlign: "center" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: gradeColor(e.grade),
                        }}
                      >
                        {e.grade || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>

      {/* Footer disclaimer */}
      {!loading && sorted.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#555", textAlign: "center" }}>
          Backtested using disclosure dates + {delayDays}-day delay. Capital is split among
          concurrent positions (overlapping hold periods). Only Buy/Purchase trades with
          matched price data are included. Past performance does not guarantee future results.
          Tap a name to see their full equity curve and trade history.
          <br />
          <span style={{ color: "#f59e0b" }}>Yellow badges</span> indicate less than 2 years
          of trading history — results may reflect market conditions rather than skill.
        </div>
      )}
    </div>
  );
}
