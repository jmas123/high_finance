import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { getWatchlist, getPortfolio } from "../personalization/storage";
import type { CompanyNotification } from "./types";
import { bundleToCompanyNotifs } from "./companyAnnouncements";
import type { PoliticianTradeWithContext } from "../../lib/types";

type CongressTradeNotification = PoliticianTradeWithContext;

function fmtMoneyRange(min?: number | null, max?: number | null) {
  const f = (x: number) =>
    `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (max != null) return `≤ ${f(max)}`;
  if (min != null) return `≥ ${f(min)}`;
  return "—";
}

function hitRateColor(hitRate: number | null | undefined): string {
  if (hitRate == null) return "#666";
  if (hitRate >= 0.7) return "#22c55e";  // Green - great
  if (hitRate >= 0.55) return "#a3e635"; // Light green - good
  if (hitRate >= 0.45) return "#facc15"; // Yellow - neutral
  if (hitRate >= 0.3) return "#f97316";  // Orange - poor
  return "#ef4444";                       // Red - bad
}



function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, opacity: 0.6 }}>{subtitle}</div>}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function CompanyNotifList({ items }: { items: CompanyNotification[] }) {
  if (!items || items.length === 0) {
    return <div style={{ padding: 14, opacity: 0.7 }}>No new alerts for your holdings in the last 7 days.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((n) => (
        <div
          key={n.id}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #2d2d2d",
            background: "#121212",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 700 }}>{n.title}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {new Date(n.created_at).toLocaleString()}
            </div>
          </div>

          {n.subtitle && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
              {n.subtitle}
            </div>
          )}

          {n.url && (
            <div style={{ marginTop: 8 }}>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "#9bd" }}
              >
                Read
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface NotificationsCardProps {
  onPageContextChange?: (context: string) => void;
}


export function NotificationsCard({ onPageContextChange }: NotificationsCardProps) {
  const [days, setDays] = useState(7);
  const [minAmount, setMinAmount] = useState(50000);
  const [limit, setLimit] = useState(100);

  // New filters for politicians
  const [tradeType, setTradeType] = useState<"all" | "buy" | "sell">("all");
  const [party, setParty] = useState<"all" | "D" | "R">("all");
  const [chamber, setChamber] = useState<"all" | "senate" | "house">("all");

  const [watchlistNotifs, setWatchlistNotifs] = useState<CompanyNotification[]>([]);
  const [portfolioNotifs, setPortfolioNotifs] = useState<CompanyNotification[]>([]);
  type Tab = "watchlist" | "portfolio" | "politicians";
  const [tab, setTab] = useState<Tab>("politicians"); // default to politicians for signals

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CongressTradeNotification[]>([]);

  // Filter items client-side based on trade type, party, chamber
  const rows = useMemo<CongressTradeNotification[]>(() => {
    if (!items) return [];
    return items.filter((x) => {
      // Trade type filter
      if (tradeType !== "all") {
        const typ = (x.trade?.transaction_type ?? "").toLowerCase();
        if (tradeType === "buy" && !typ.includes("purchase")) return false;
        if (tradeType === "sell" && !typ.includes("sale")) return false;
      }
      // Party filter
      if (party !== "all") {
        const p = x.politician?.party;
        if (party === "D" && p !== "Democrat") return false;
        if (party === "R" && p !== "Republican") return false;
      }
      // Chamber filter
      if (chamber !== "all") {
        const c = (x.politician?.chamber ?? "").toLowerCase();
        if (chamber === "senate" && !c.includes("senate")) return false;
        if (chamber === "house" && !c.includes("house") && !c.includes("rep")) return false;
      }
      return true;
    });
  }, [items, tradeType, party, chamber]);


  async function loadPoliticians() {
  const pol = await api.congressTradeNotifications(minAmount, days, limit);
  setItems(pol);
}



async function loadWatchlist() {
  const watch = getWatchlist();
  const watchBundles = await Promise.allSettled(watch.map((w) => api.news(w.ticker)));
  const watchNotifs = watchBundles.flatMap((r, i) => {
    if (r.status !== "fulfilled") return [];
    return bundleToCompanyNotifs("watchlist", r.value, days, 3, watch[i]?.name);
  });
  watchNotifs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  setWatchlistNotifs(watchNotifs.slice(0, limit));
}

async function loadPortfolio() {
  const port = getPortfolio();
  const portBundles = await Promise.allSettled(port.map((p) => api.news(p.ticker)));
  const portNotifs = portBundles.flatMap((r, i) => {
    if (r.status !== "fulfilled") return [];
    return bundleToCompanyNotifs("portfolio", r.value, days, 3, port[i]?.name);
  });
  portNotifs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  setPortfolioNotifs(portNotifs.slice(0, limit));
}


 useEffect(() => {
  (async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "watchlist") await loadWatchlist();
      if (tab === "portfolio") await loadPortfolio();
      if (tab === "politicians") await loadPoliticians();
    } catch (e: any) {
      setError(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab, days, limit, tab === "politicians" ? minAmount : null]);

useEffect(() => {
    if (!onPageContextChange || tab !== "politicians") return;
    const summary = rows.slice(0, 200).map((x) => {
      const p = x.politician;
      const t = x.trade;
      const ctx = x.context;
      return [
        `${p?.name ?? "Unknown"} (${p?.party === "Democrat" ? "D" : "R"}, ${p?.chamber})`,
        `${(t?.transaction_type ?? "").toUpperCase()} ${t?.ticker_raw ?? ""}`,
        `Amount: ${t?.amount_min != null ? `$${t.amount_min.toLocaleString()}` : ""}–${t?.amount_max != null ? `$${t.amount_max.toLocaleString()}` : ""}`,
        `Why it matters: ${ctx?.relevance_label ?? ""} (${Math.round((ctx?.relevance_score ?? 0) * 100)}%)`,
        ctx?.reasons?.slice(0, 2).map(r => `  - ${r.title}: ${r.detail}`).join("\n") ?? "",
      ].filter(Boolean).join(" | ");
    }).join("\n");

    const MAX_CONTEXT_CHARS = 5000;
    const header =
      `Congressional trading notifications page.\n` +
      `Filters: Min $${minAmount.toLocaleString()}, Type: ${tradeType}, Party: ${party}, Chamber: ${chamber}, Last ${days} days.\n` +
      `Showing ${rows.length} trades:\n\n`;
    const truncatedSummary = summary.length + header.length > MAX_CONTEXT_CHARS
      ? summary.slice(0, MAX_CONTEXT_CHARS - header.length) + "\n...(truncated)"
      : summary;
    onPageContextChange(header + truncatedSummary);
  }, [rows, tab, minAmount, tradeType, party, chamber, days, onPageContextChange]);


  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Notifications</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Politicians + Watchlist + Portfolio, last {days} days
          </div>
        </div>

        <button
  onClick={async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "watchlist") await loadWatchlist();
      if (tab === "portfolio") await loadPortfolio();
      if (tab === "politicians") await loadPoliticians();
    } catch (e: any) {
      setError(e?.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }}
  style={{
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #444",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  }}
>
  Refresh
</button>

      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {/* Days applies to all tabs */}
        <label style={{ fontSize: 12, opacity: 0.8 }}>
          Days{" "}
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              width: 70,
              marginLeft: 6,
              padding: 6,
              borderRadius: 6,
              border: "1px solid #444",
              background: "#111",
              color: "#fff",
            }}
          />
        </label>

        {/* Limit applies to all tabs */}
        <label style={{ fontSize: 12, opacity: 0.8 }}>
          Limit{" "}
          <input
            type="number"
            min={10}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              width: 80,
              marginLeft: 6,
              padding: 6,
              borderRadius: 6,
              border: "1px solid #444",
              background: "#111",
              color: "#fff",
            }}
          />
        </label>
      </div>

      {/* Politicians-specific filters */}
      {tab === "politicians" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {/* Amount presets - click again to reset to $0 */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>Min $:</span>
            {[
              { label: "$50k", value: 50000 },
              { label: "$100k", value: 100000 },
              { label: "$250k", value: 250000 },
              { label: "$500k", value: 500000 },
              { label: "$1M", value: 1000000 },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => setMinAmount(minAmount === preset.value ? 0 : preset.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #333",
                  background: minAmount === preset.value ? "#3b82f6" : "#1a1a1a",
                  color: minAmount === preset.value ? "#fff" : "#888",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: minAmount === preset.value ? 600 : 400,
                }}
              >
                {preset.label}
              </button>
            ))}
            {minAmount > 0 && (
              <span style={{ fontSize: 10, color: "#888", marginLeft: 4 }}>
                (click again to clear)
              </span>
            )}
          </div>

          {/* Trade type + Party + Chamber filters */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* Trade Type - click again to toggle off */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>Type:</span>
              {([
                { label: "Buys", value: "buy" },
                { label: "Sells", value: "sell" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTradeType(tradeType === opt.value ? "all" : opt.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #333",
                    background: tradeType === opt.value ? (opt.value === "buy" ? "#22c55e" : "#ef4444") : "#1a1a1a",
                    color: tradeType === opt.value ? "#fff" : "#888",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: tradeType === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Party - click again to toggle off */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>Party:</span>
              {([
                { label: "Dem", value: "D", color: "#3b82f6" },
                { label: "Rep", value: "R", color: "#ef4444" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setParty(party === opt.value ? "all" : opt.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #333",
                    background: party === opt.value ? opt.color : "#1a1a1a",
                    color: party === opt.value ? "#fff" : "#888",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: party === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Chamber - click again to toggle off */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, opacity: 0.6, marginRight: 4 }}>Chamber:</span>
              {([
                { label: "Senate", value: "senate" },
                { label: "House", value: "house" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChamber(chamber === opt.value ? "all" : opt.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "1px solid #333",
                    background: chamber === opt.value ? "#8b5cf6" : "#1a1a1a",
                    color: chamber === opt.value ? "#fff" : "#888",
                    fontSize: 11,
                    cursor: "pointer",
                    fontWeight: chamber === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filters summary */}
          {(tradeType !== "all" || party !== "all" || chamber !== "all") && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, opacity: 0.6 }}>Showing:</span>
              <span style={{ fontSize: 11, color: "#22c55e" }}>{rows.length}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>of</span>
              <span style={{ fontSize: 11, color: "#888" }}>{items.length}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>trades</span>
              <button
                onClick={() => {
                  setTradeType("all");
                  setParty("all");
                  setChamber("all");
                }}
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid #333",
                  background: "transparent",
                  color: "#888",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
  {([
    ["watchlist", `Watchlist (${watchlistNotifs.length})`],
    ["portfolio", `Portfolio (${portfolioNotifs.length})`],
    ["politicians", `Politicians (${rows.length})`],
  ] as const).map(([k, label]) => {
    const active = tab === k;
    return (
      <button
        key={k}
        onClick={() => setTab(k)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid #444",
          background: active ? "#222" : "#111",
          color: active ? "#fff" : "#aaa",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: active ? 700 : 500,
        }}
      >
        {label}
      </button>
    );
  })}
</div>


      {error && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            background: "#3b1818",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
          }}
        >
          <b>Error:</b> {error}
        </div>
      )}

      {loading && <div style={{ padding: 20, opacity: 0.7 }}>Loading…</div>}

      {!loading && (
  <>
    {tab === "watchlist" && (
      <Section
        title="Watchlist"
        subtitle={`Announcements from your watchlist · last ${days} days`}
      >
        <CompanyNotifList items={watchlistNotifs} />
      </Section>
    )}

    {tab === "portfolio" && (
      <Section
        title="Portfolio"
        subtitle={`Announcements from your portfolio · last ${days} days`}
      >
        <CompanyNotifList items={portfolioNotifs} />
      </Section>
    )}

    {tab === "politicians" && (
      <Section
        title="Politicians"
        subtitle={`Min trade: $${minAmount.toLocaleString()} · last ${days} days`}
      >
        {rows.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>
            No significant trades found in the last {days} days.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((x, idx) => {
              // KEEP YOUR EXISTING POLITICIAN CARD CODE EXACTLY HERE
              const ctx = x.context;
              const t = x.trade;
              const p = x.politician;
              const who = p?.name ?? "Unknown politician";
              const ticker = t?.ticker_raw ?? "—";
              const issuer = t?.issuer_raw ?? "";
              const typ = (t?.transaction_type ?? "").toUpperCase();
              const disclosed = t?.disclosure_date ?? "—";
              const amt = fmtMoneyRange(t?.amount_min, t?.amount_max);
              const url = t?.source_url;

              return (
                <div
                  key={`${t?.id ?? idx}`}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #2d2d2d",
                    background: "#121212",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{who}</span>
                      {/* Party badge */}
                      {p?.party && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 5px",
                            borderRadius: 3,
                            background: p.party === "Democrat" ? "rgba(59, 130, 246, 0.2)" : p.party === "Republican" ? "rgba(239, 68, 68, 0.2)" : "rgba(136, 136, 136, 0.2)",
                            color: p.party === "Democrat" ? "#60a5fa" : p.party === "Republican" ? "#f87171" : "#888",
                          }}
                        >
                          {p.party === "Democrat" ? "D" : p.party === "Republican" ? "R" : p.party.charAt(0)}
                        </span>
                      )}
                      {/* Chamber badge */}
                      {p?.chamber && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            padding: "2px 5px",
                            borderRadius: 3,
                            background: "rgba(136, 136, 136, 0.15)",
                            color: "#888",
                          }}
                        >
                          {p.chamber.toLowerCase().includes("senate") ? "Senate" : "House"}
                        </span>
                      )}
                      {p?.hit_rate != null && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: hitRateColor(p.hit_rate),
                            background: "#1a1a1a",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                          title="Win rate: % of recent trades with positive 30-day returns"
                        >
                          {Math.round(p.hit_rate * 100)}%
                        </span>
                      )}
                      <span style={{ opacity: 0.7 }}>·</span>
                      {/* Trade type with color */}
                      <span style={{
                        color: typ.includes("PURCHASE") ? "#22c55e" : typ.includes("SALE") ? "#ef4444" : "#888",
                        fontWeight: 600,
                      }}>
                        {typ || "TRADE"}
                      </span>
                      <span style={{ opacity: 0.7 }}>·</span>
                      <span style={{ fontFamily: "monospace" }}>{ticker}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{disclosed}</div>
                  </div>

                  {ctx && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid #2a2a2a",
                        background: "#0f0f0f",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        Why it matters: {ctx.relevance_label} (
                        {Math.round((ctx.relevance_score ?? 0) * 100)}%)
                      </div>
                      <ul
                        style={{
                          marginTop: 6,
                          paddingLeft: 18,
                          fontSize: 12,
                          opacity: 0.85,
                        }}
                      >
                        {(ctx.reasons ?? []).slice(0, 3).map((r, i) => (
                          <li key={i}>
                            <b>{r.title}:</b> {r.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                    {issuer ? <span style={{ opacity: 0.8 }}>{issuer} · </span> : null}
                    <span>{amt}</span>
                  </div>

                  {url && (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#9bd" }}
                      >
                        View source
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    )}
  </>
)}

    </div>
  );
}
