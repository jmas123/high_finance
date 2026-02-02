import { useState } from "react";
import { api } from "./lib/api";
import { projectsApi } from "./components/project/api";
import { PriceChart } from "./components/PriceChart";
import { CompanyHeader } from "./components/CompanyHeader";
import { FundamentalsCard } from "./components/FundamentalsCard";
import { EarningsCard } from "./components/earnings/EarningsCard";
import { NewsCard } from "./components/NewsCard";
import { RiskCard } from "./components/risk/RiskCard";
import { OptionsFlowCard } from "./components/options/OptionsFlowCard";
import { OptionDecaySimulator } from "./components/options/OptionsDecaySimulator";
import { DCFCard } from "./components/valuation/DCFCard";
import { NotificationsCard } from "./components/notifications/NotificationsCard";
import { CompsTable } from "./components/CompsTableCard";
import type { CompsResponse, FinancialStatementsResponse } from "./lib/types";
import { LeadershipTable } from "./components/LeadershipTable";
import { FinancialStatements } from "./components/FinancialStatements";
import { PredictionCard } from "./components/PredictionCard";
import { SearchBar } from "./components/SearchBar";
import { PoliticianTradesCard } from "./components/politicians/PoliticianTradesCard";
import { InsiderTradingCard } from "./components/InsiderTradingCard";
import { InstitutionalFlowCard } from "./components/InstitutionalFlowCard";
import BroaderMarketContext from "./components/market_context/BroaderMarketContextCard";

// ── Personalization ──────────────────────────────────────────────────────────
import { HomeDashboard } from "./components/personalization/HomeDashBoard";
import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  addPosition,
  addRecentTicker,
} from "./components/personalization/storage";

// ── Research Projects ────────────────────────────────────────────────────────
import { ProjectListCard } from "./components/project/ProjectListCard";
import { ProjectWorkspace } from "./components/project/ProjectWorkSpace";

// ── DCF state shape for snapshot wiring ──────────────────────────────────────
type DCFState = {
  growth: number;
  margin: number;
  tax: number;
  wacc: number;
  terminal_g: number;
  fair_value_per_share: number | null;
  enterprise_value: number | null;
  current_price: number | null;
} | null;

export default function App() {
  const [searchedTicker, setSearchedTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<any>(null);
  const [fundamentals, setFundamentals] = useState<any>(null);
  const [ownership, setOwnership] = useState<any[]>([]);
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [leadership, setLeadership] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [financials, setFinancials] = useState<FinancialStatementsResponse | null>(null);

  // ── View state (extended with projects) ────────────────────────────────────
  const [view, setView] = useState<"ticker" | "notifications" | "projects" | "project">("ticker");

  // ── Personalization state ──────────────────────────────────────────────────
  const [watchlistRefresh, setWatchlistRefresh] = useState(0);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);

  // ── Research Projects state ────────────────────────────────────────────────
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [projectRefresh, setProjectRefresh] = useState(0);
  const [currentDCFState, setCurrentDCFState] = useState<DCFState>(null);
  const [returnToProject, setReturnToProject] = useState<number | null>(null);

  // Determine if current ticker is an ETF
  const isETF = fundamentals?.is_etf === true;
  const sector = fundamentals?.sector;
  const isMutualFund = fundamentals?.is_mutual_fund === true;
  const isStock = fundamentals && !isETF && !isMutualFund;

  async function loadTicker(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;

    setLoading(true);
    setError(null);
    setShowAddPosition(false);

    setCompany(null);
    setFundamentals(null);
    setOwnership([]);
    setLeadership([]);
    setPrices([]);
    setFinancials(null);
    setComps(null);
    setCurrentDCFState(null);

    // Make sure we're on the ticker view when loading a ticker
    setView("ticker");

    try {
      // Always load these (work for both stocks and ETFs)
      const [c, f, p] = await Promise.all([
        api.company(t),
        api.fundamentals(t),
        api.prices(t, "1y"),
      ]);

      setCompany(c);
      setFundamentals(f);
      setPrices(p);
      setSearchedTicker(t);

      // ── Personalization tracking ───────────────────────────────────────────
      addRecentTicker(t);
      setInWatchlist(isInWatchlist(t));

      // Only load stock-specific data if NOT an ETF
      const isEtfOrFund = f?.is_etf || f?.is_mutual_fund;

      if (!isEtfOrFund) {
        // Load stock-specific data
        const [o, l, fin, cmp] = await Promise.all([
          api.ownership(t).catch(() => []),
          api.leadership(t).catch(() => []),
          api.financials(t).catch(() => null),
          api.comps(t).catch(() => null),
        ]);

        setOwnership(o);
        setLeadership(l);
        setFinancials(fin);
        setComps(cmp);
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrices(period: string) {
    if (!searchedTicker) return;
    try {
      const p = await api.prices(searchedTicker, period);
      setPrices(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load prices");
    }
  }

  // ── Personalization handlers ─────────────────────────────────────────────
  function toggleWatchlist() {
    if (!searchedTicker || !company) return;
    if (inWatchlist) {
      removeFromWatchlist(searchedTicker);
      setInWatchlist(false);
    } else {
      addToWatchlist(searchedTicker, company.name || company.short_name || searchedTicker);
      setInWatchlist(true);
    }
    setWatchlistRefresh((n) => n + 1);
  }

  function handleAddPosition(shares: number, avgCost: number) {
    if (!searchedTicker || !company) return;
    addPosition(searchedTicker, company.name || company.short_name || searchedTicker, shares, avgCost);
    setPortfolioRefresh((n) => n + 1);
    setShowAddPosition(false);
  }

  function goToDashboard() {
    setSearchedTicker("");
    setCompany(null);
    setFundamentals(null);
    setOwnership([]);
    setLeadership([]);
    setPrices([]);
    setFinancials(null);
    setComps(null);
    setShowAddPosition(false);
    setCurrentDCFState(null);
    setReturnToProject(null);
    setView("ticker");
  }

  // ── Research Projects handlers ───────────────────────────────────────────
  function openProject(projectId: number) {
    setActiveProjectId(projectId);
    setReturnToProject(null);
    setView("project");
  }

  function goToProjectList() {
    setActiveProjectId(null);
    setReturnToProject(null);
    setView("projects");
  }

  /** Navigate to DCF model from a project – remembers which project to return to */
  function openDCFFromProject(ticker: string) {
    if (activeProjectId) {
      setReturnToProject(activeProjectId);
    }
    loadTicker(ticker);
  }

  /** Return from ticker view back to the originating project */
  function returnFromDCFToProject() {
    if (!returnToProject) return;
    setActiveProjectId(returnToProject);
    setReturnToProject(null);
    setView("project");
    // Note: currentDCFState is preserved — DCFCard has been updating it via onStateChange
  }

  async function createProjectFromTicker() {
    if (!searchedTicker || !company) return;
    const title = prompt("Project title:", `${searchedTicker} – Research Project`);
    if (!title) return;
    try {
      const p = await projectsApi.createProject({
        ticker: searchedTicker,
        title,
      });
      setActiveProjectId(p.id);
      setProjectRefresh((n) => n + 1);
      setView("project");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project");
    }
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#111",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 24,
        }}
      >
        {/* Search Bar */}
        <div style={{ marginBottom: 24 }}>
          <SearchBar onSelect={loadTicker} loading={loading} />
        </div>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: "#3b1818",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
            }}
          >
            <b>Error:</b> {error}
          </div>
        )}

        {/* ── Navigation Tabs ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => {
              if (!company) {
                goToDashboard();
              }
              setView("ticker");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: view === "ticker" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {company ? "Ticker" : "Dashboard"}
          </button>

          <button
            onClick={() => setView("projects")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: view === "projects" || view === "project" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Projects
          </button>

          <button
            onClick={() => setView("notifications")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: view === "notifications" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Notifications
          </button>
        </div>

        {/* ── Loading State ─────────────────────────────────────────────── */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              opacity: 0.6,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
            <div style={{ fontSize: 18 }}>Loading data...</div>
          </div>
        )}

        {/* ── Notifications View ────────────────────────────────────────── */}
        {view === "notifications" && !loading && (
          <div style={{ marginBottom: 20 }}>
            <NotificationsCard />
          </div>
        )}

        {/* ============================================================== */}
        {/* PROJECT LIST VIEW                                               */}
        {/* ============================================================== */}
        {view === "projects" && !loading && (
          <ProjectListCard
            onOpenProject={openProject}
            onCreateProject={(ticker?: string) => {
              const t = ticker || prompt("Ticker for new project:");
              if (!t) return;
              const title = prompt("Project title:", `${t.toUpperCase()} – Research Project`);
              if (!title) return;
              projectsApi
                .createProject({ ticker: t.toUpperCase(), title })
                .then((p) => {
                  setActiveProjectId(p.id);
                  setProjectRefresh((n) => n + 1);
                  setView("project");
                })
                .catch((e: any) => setError(e?.message ?? "Failed to create project"));
            }}
            refreshKey={projectRefresh}
          />
        )}

        {/* ============================================================== */}
        {/* SINGLE PROJECT WORKSPACE                                        */}
        {/* ============================================================== */}
        {view === "project" && activeProjectId && !loading && (
          <ProjectWorkspace
            projectId={activeProjectId}
            onBack={goToProjectList}
            onOpenTicker={(ticker) => loadTicker(ticker)}
            onOpenDCF={openDCFFromProject}
            currentDCF={currentDCFState}
            onDCFImported={() => setCurrentDCFState(null)}
          />
        )}

        {/* ============================================================== */}
        {/* HOME DASHBOARD — shown when no ticker loaded                    */}
        {/* ============================================================== */}
        {view === "ticker" && !company && !loading && (
          <HomeDashboard
            onSelect={loadTicker}
            watchlistRefreshKey={watchlistRefresh}
            portfolioRefreshKey={portfolioRefresh}
          />
        )}

        {/* ============================================================== */}
        {/* TICKER VIEW — shown when a stock/etf is loaded                  */}
        {/* ============================================================== */}
        {view === "ticker" && company && fundamentals && !loading && (
          <>
            {/* ETF Badge */}
            {isETF && (
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  background: "#3b82f6",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                📊 ETF
              </div>
            )}

            <CompanyHeader company={company} fundamentals={fundamentals} prices={prices} />

            {/* ── Action Buttons (Watch / Portfolio / Project / Back) ──── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 12 }}>
              <button
                onClick={toggleWatchlist}
                style={{
                  background: inWatchlist ? "#22c55e20" : "#222",
                  border: `1px solid ${inWatchlist ? "#22c55e40" : "#444"}`,
                  borderRadius: 8,
                  color: inWatchlist ? "#22c55e" : "#aaa",
                  fontSize: 13,
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {inWatchlist ? "★ Watching" : "☆ Watch"}
              </button>

              <button
                onClick={() => setShowAddPosition(!showAddPosition)}
                style={{
                  background: showAddPosition ? "#8b5cf620" : "#222",
                  border: `1px solid ${showAddPosition ? "#8b5cf640" : "#444"}`,
                  borderRadius: 8,
                  color: showAddPosition ? "#8b5cf6" : "#aaa",
                  fontSize: 13,
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                💼 Add to Portfolio
              </button>

              {/* ── NEW: Start Project button ──────────────────────────── */}
              {isStock && (
                <button
                  onClick={createProjectFromTicker}
                  style={{
                    background: "#3b82f620",
                    border: "1px solid #3b82f640",
                    borderRadius: 8,
                    color: "#3b82f6",
                    fontSize: 13,
                    padding: "6px 14px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  📋 Start Project
                </button>
              )}

              {/* ── Return to Project button (shown when came from project DCF flow) ── */}
              {returnToProject && (
                <button
                  onClick={returnFromDCFToProject}
                  style={{
                    background: "#a855f720",
                    border: "1px solid #a855f740",
                    borderRadius: 8,
                    color: "#a855f7",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 14px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    marginLeft: "auto",
                  }}
                >
                  ← Import to Project
                </button>
              )}

              <button
                onClick={goToDashboard}
                style={{
                  background: "#222",
                  border: "1px solid #444",
                  borderRadius: 8,
                  color: "#888",
                  fontSize: 13,
                  padding: "6px 14px",
                  cursor: "pointer",
                  marginLeft: returnToProject ? undefined : "auto",
                }}
              >
                ← Dashboard
              </button>
            </div>

            {/* ── Inline Add Position Form ────────────────────────────── */}
            {showAddPosition && (
              <AddPositionInline
                ticker={searchedTicker}
                onAdd={handleAddPosition}
                onCancel={() => setShowAddPosition(false)}
              />
            )}

            {/* Price Chart - Always show */}
            {prices.length > 0 && (
              <div
                style={{
                  marginBottom: 20,
                  background: "#1a1a1a",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <PriceChart data={prices} ticker={searchedTicker} onPeriodChange={loadPrices} />
              </div>
            )}

            {/* ==================== */}
            {/* STOCK-ONLY SECTIONS */}
            {/* ==================== */}
            {isStock && (
              <>
                {/* ML Prediction */}
                <div style={{ marginBottom: 20 }}>
                  <PredictionCard key={`pred-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* DCF + Risk (side by side) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <DCFCard
                    key={`dcf-${searchedTicker}`}
                    ticker={searchedTicker}
                    onStateChange={setCurrentDCFState}
                  />
                  <RiskCard key={`risk-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* Fundamentals + Institutional Flow */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <FundamentalsCard data={fundamentals} />
                  <InstitutionalFlowCard key={`inst-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* Comps Table */}
                {comps && (
                  <div style={{ marginBottom: 16 }}>
                    <CompsTable data={comps} />
                  </div>
                )}

                <div
                  style={{
                    marginBottom: 20,
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <BroaderMarketContext
                    ticker={searchedTicker}
                    sector={sector}
                    showMacro={true}
                    showSectors={true}
                    showRateImpact={true}
                  />
                </div>

                {/* Insider + Politicians */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <InsiderTradingCard key={`insider-${searchedTicker}`} ticker={searchedTicker} />
                  <PoliticianTradesCard key={`pol-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* Leadership */}
                {leadership.length > 0 && <LeadershipTable data={leadership} />}

                {/* Earnings */}
                <div style={{ marginBottom: 20 }}>
                  <EarningsCard key={`earnings-${searchedTicker}`} ticker={searchedTicker} />
                </div>
              </>
            )}

            {/* ==================== */}
            {/* ETF-ONLY SECTIONS */}
            {/* ==================== */}
            {isETF && (
              <>
                {/* ETF Fundamentals Card */}
                <div style={{ marginBottom: 20 }}>
                  <ETFFundamentalsCard data={fundamentals} />
                </div>

                {/* Risk Card - Works for ETFs too */}
                <div style={{ marginBottom: 20 }}>
                  <RiskCard key={`risk-${searchedTicker}`} ticker={searchedTicker} />
                </div>
              </>
            )}

            {/* ==================== */}
            {/* SHARED SECTIONS */}
            {/* ==================== */}

            {/* News - Works for both */}
            <NewsCard ticker={searchedTicker} />

            {/* Options - Works for both (most ETFs have options) */}
            <div style={{ marginBottom: 20 }}>
              <OptionsFlowCard key={`options-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Option Decay Simulator - Works for both */}
            <div style={{ marginBottom: 20 }}>
              <OptionDecaySimulator key={`decay-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Financial Statements - Stock only */}
            {isStock && financials && (
              <div style={{ marginTop: 16 }}>
                <FinancialStatements
                  key={`fin-${searchedTicker}`}
                  data={financials}
                  ticker={searchedTicker}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ADD POSITION INLINE FORM
// ==========================================
function AddPositionInline({
  ticker,
  onAdd,
  onCancel,
}: {
  ticker: string;
  onAdd: (shares: number, cost: number) => void;
  onCancel: () => void;
}) {
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 16,
        padding: 12,
        background: "#151515",
        border: "1px solid #333",
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 12, color: "#888" }}>
        Add <b style={{ color: "#fff" }}>{ticker}</b>:
      </span>
      <input
        placeholder="Shares"
        type="number"
        step="any"
        value={shares}
        onChange={(e) => setShares(e.target.value)}
        style={{
          background: "#222",
          border: "1px solid #444",
          borderRadius: 4,
          color: "#fff",
          padding: "5px 8px",
          fontSize: 12,
          width: 80,
          outline: "none",
        }}
      />
      <input
        placeholder="Avg Cost ($)"
        type="number"
        step="any"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        style={{
          background: "#222",
          border: "1px solid #444",
          borderRadius: 4,
          color: "#fff",
          padding: "5px 8px",
          fontSize: 12,
          width: 100,
          outline: "none",
        }}
      />
      <button
        onClick={() => {
          if (shares && cost) onAdd(parseFloat(shares), parseFloat(cost));
        }}
        style={{
          background: "#22c55e20",
          border: "1px solid #22c55e40",
          borderRadius: 4,
          color: "#22c55e",
          fontSize: 12,
          padding: "5px 12px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Add
      </button>
      <button
        onClick={onCancel}
        style={{
          background: "none",
          border: "none",
          color: "#666",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ==========================================
// ETF FUNDAMENTALS CARD COMPONENT
// ==========================================
function ETFFundamentalsCard({ data }: { data: any }) {
  if (!data) return null;

  const formatPercent = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatMoney = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📊 ETF Overview</div>

      {/* Fund Info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {data.fund_family && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Fund Family</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{data.fund_family}</div>
          </div>
        )}
        {data.category && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Category</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{data.category}</div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          padding: 12,
          background: "rgba(59, 130, 246, 0.05)",
          borderRadius: 8,
          border: "1px solid rgba(59, 130, 246, 0.1)",
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Total Assets (AUM)</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{formatMoney(data.total_assets)}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Expense Ratio</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: data.expense_ratio && data.expense_ratio < 0.002 ? "#22c55e" : "#fff",
            }}
          >
            {data.expense_ratio !== null ? `${(data.expense_ratio * 100).toFixed(2)}%` : "—"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Dividend Yield</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{formatPercent(data.yield)}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Holdings</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{data.holdings_count ?? "—"}</div>
        </div>
      </div>

      {/* Performance */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 12,
            opacity: 0.6,
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Performance
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6 }}>YTD Return</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color:
                  data.ytd_return > 0 ? "#22c55e" : data.ytd_return < 0 ? "#ef4444" : "#fff",
              }}
            >
              {formatPercent(data.ytd_return)}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6 }}>3-Year Avg</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color:
                  data.three_year_return > 0
                    ? "#22c55e"
                    : data.three_year_return < 0
                    ? "#ef4444"
                    : "#fff",
              }}
            >
              {formatPercent(data.three_year_return)}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6 }}>5-Year Avg</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color:
                  data.five_year_return > 0
                    ? "#22c55e"
                    : data.five_year_return < 0
                    ? "#ef4444"
                    : "#fff",
              }}
            >
              {formatPercent(data.five_year_return)}
            </div>
          </div>
        </div>
      </div>

      {/* Beta */}
      {data.beta && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          Beta: <span style={{ color: "#fff", fontWeight: 500 }}>{data.beta.toFixed(2)}</span>
          {data.beta < 1 ? " (Less volatile than market)" : " (More volatile than market)"}
        </div>
      )}
    </div>
  );
}