import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { api } from "./lib/api";
import { projectsApi } from "./components/project/api";
import { PriceChartWithDrawings } from "./components/chart";
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

// ── Auth ─────────────────────────────────────────────────────────────────────
import { useAuth } from "./lib/auth";
import { AuthModal } from "./components/auth/AuthModal";

// ── Personalization ──────────────────────────────────────────────────────────
import { HomeDashboard } from "./components/personalization/HomeDashBoard";
import { useUserData } from "./lib/userData";
import { addRecentTicker } from "./components/personalization/storage";

// ── Research Projects ────────────────────────────────────────────────────────
import { ProjectListCard } from "./components/project/ProjectListCard";
import { ProjectWorkspace } from "./components/project/ProjectWorkSpace";
import { SaveToProjectButton } from "./components/project/SaveToProjectButton";

// ── Stock Screener ──────────────────────────────────────────────────────────
import { ScreenerCard } from "./components/screener";

// ── Calendar ────────────────────────────────────────────────────────────────
import { CalendarPopupButton } from "./components/calendar";

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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT (Layout + Routes)
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from current route
  const getActiveTab = () => {
    if (location.pathname.startsWith("/quote/")) return "ticker";
    if (location.pathname === "/screener") return "screener";
    if (location.pathname.startsWith("/projects")) return "projects";
    if (location.pathname === "/signals") return "signals";
    return "dashboard";
  };

  const activeTab = getActiveTab();

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
        {/* Header with Search + Calendar + Auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <SearchBar
              onSelect={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
              loading={false}
            />
          </div>
          {/* Calendar Button */}
          <CalendarPopupButton
            onTickerClick={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
          />
          {/* Auth Button */}
          {authLoading ? (
            <div style={{ fontSize: 13, color: "#666" }}>...</div>
          ) : isAuthenticated && user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#888" }}>{user.email}</span>
              <button
                onClick={logout}
                style={{
                  padding: "8px 14px",
                  background: "#222",
                  border: "1px solid #444",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              style={{
                padding: "8px 14px",
                background: "#3b82f6",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          )}
        </div>

        {/* ── Navigation Tabs ───────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Link
            to="/"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: activeTab === "dashboard" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Dashboard
          </Link>

          <Link
            to="/screener"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: activeTab === "screener" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Screener
          </Link>

          <Link
            to="/projects"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: activeTab === "projects" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Projects
          </Link>

          <Link
            to="/signals"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: activeTab === "signals" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Signals
          </Link>
        </div>

        {/* ── Routes ─────────────────────────────────────────────────────── */}
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/quote/:ticker" element={<TickerView />} />
          <Route path="/screener" element={<ScreenerView />} />
          <Route path="/projects" element={<ProjectsListView />} />
          <Route path="/projects/:projectId" element={<ProjectView />} />
          <Route path="/signals" element={<SignalsView />} />
        </Routes>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW (/)
// ══════════════════════════════════════════════════════════════════════════════
function DashboardView() {
  const navigate = useNavigate();

  return (
    <HomeDashboard
      onSelect={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
      onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREENER VIEW (/screener)
// ══════════════════════════════════════════════════════════════════════════════
function ScreenerView() {
  const navigate = useNavigate();

  return (
    <ScreenerCard
      onSelectTicker={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNALS VIEW (/signals) - formerly "Notifications"
// ══════════════════════════════════════════════════════════════════════════════
function SignalsView() {
  return (
    <div style={{ marginBottom: 20 }}>
      <NotificationsCard />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS LIST VIEW (/projects)
// ══════════════════════════════════════════════════════════════════════════════
function ProjectsListView() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
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
      <ProjectListCard
        onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
        onCreateProject={(ticker?: string) => {
          const t = ticker || prompt("Ticker for new project:");
          if (!t) return;
          const title = prompt("Project title:", `${t.toUpperCase()} – Research Project`);
          if (!title) return;
          projectsApi
            .createProject({ ticker: t.toUpperCase(), title })
            .then((p) => {
              setRefreshKey((n) => n + 1);
              navigate(`/projects/${p.id}`);
            })
            .catch((e: any) => setError(e?.message ?? "Failed to create project"));
        }}
        refreshKey={refreshKey}
      />
    </>
  );
}

// ── SessionStorage keys for cross-route DCF state ────────────────────────────
const DCF_SESSION_KEY = "hf_dcf_import_state";

function saveDCFToSession(state: DCFState) {
  if (state) {
    sessionStorage.setItem(DCF_SESSION_KEY, JSON.stringify(state));
  }
}

function loadDCFFromSession(): DCFState {
  try {
    const stored = sessionStorage.getItem(DCF_SESSION_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function clearDCFSession() {
  sessionStorage.removeItem(DCF_SESSION_KEY);
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE PROJECT VIEW (/projects/:projectId)
// ══════════════════════════════════════════════════════════════════════════════
function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Load DCF state from sessionStorage (persists across route changes)
  const [currentDCFState, setCurrentDCFState] = useState<DCFState>(() => loadDCFFromSession());

  const id = projectId ? parseInt(projectId, 10) : null;

  if (!id || isNaN(id)) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Invalid project ID
      </div>
    );
  }

  return (
    <ProjectWorkspace
      projectId={id}
      onBack={() => navigate("/projects")}
      onOpenTicker={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
      onOpenDCF={(ticker) => {
        // Store project ID in sessionStorage so we can return
        sessionStorage.setItem("hf_return_project", String(id));
        navigate(`/quote/${ticker.toUpperCase()}`);
      }}
      currentDCF={currentDCFState}
      onDCFImported={() => {
        setCurrentDCFState(null);
        clearDCFSession();
      }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TICKER VIEW (/quote/:ticker)
// ══════════════════════════════════════════════════════════════════════════════
function TickerView() {
  const { ticker: urlTicker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    addPosition,
  } = useUserData();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<any>(null);
  const [fundamentals, setFundamentals] = useState<any>(null);
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [leadership, setLeadership] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [financials, setFinancials] = useState<FinancialStatementsResponse | null>(null);

  const [showAddPosition, setShowAddPosition] = useState(false);

  // Check if we came from a project (for return button)
  const returnProjectId = sessionStorage.getItem("hf_return_project");

  // DCF state for project import flow - save to sessionStorage for cross-route persistence
  const handleDCFStateChange = useCallback((state: DCFState) => {
    if (state && returnProjectId) {
      // Only save to session if we came from a project
      saveDCFToSession(state);
    }
  }, [returnProjectId]);

  const ticker = urlTicker?.toUpperCase() || "";

  // Determine if current ticker is an ETF
  const isETF = fundamentals?.is_etf === true;
  const sector = fundamentals?.sector;
  const isMutualFund = fundamentals?.is_mutual_fund === true;
  const isStock = fundamentals && !isETF && !isMutualFund;

  // Load ticker data when URL param changes
  const loadTicker = useCallback(async (t: string) => {
    if (!t) return;

    setLoading(true);
    setError(null);
    setShowAddPosition(false);

    setCompany(null);
    setFundamentals(null);
    setLeadership([]);
    setPrices([]);
    setFinancials(null);
    setComps(null);

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

      // ── Personalization tracking ───────────────────────────────────────────
      addRecentTicker(t);

      // Only load stock-specific data if NOT an ETF
      const isEtfOrFund = f?.is_etf || f?.is_mutual_fund;

      if (!isEtfOrFund) {
        // Load stock-specific data
        const [l, fin, cmp] = await Promise.all([
          api.leadership(t).catch(() => []),
          api.financials(t).catch(() => null),
          api.comps(t).catch(() => null),
        ]);

        setLeadership(l);
        setFinancials(fin);
        setComps(cmp);
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when ticker URL param changes
  useEffect(() => {
    if (ticker) {
      loadTicker(ticker);
      // Scroll to top when loading new ticker
      window.scrollTo(0, 0);
    }
  }, [ticker, loadTicker]);

  async function loadPrices(period: string) {
    if (!ticker) return;
    try {
      const p = await api.prices(ticker, period);
      setPrices(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load prices");
    }
  }

  // State for infinite scroll loading
  const [isLoadingMorePrices, setIsLoadingMorePrices] = useState(false);

  /**
   * Load more historical price data (infinite scroll).
   * Fetches ~6 months of data ending at the earliestDate and prepends it.
   */
  async function loadMorePrices(earliestDate: string): Promise<void> {
    if (!ticker || isLoadingMorePrices) return;

    setIsLoadingMorePrices(true);
    try {
      // Parse the earliest date and calculate a range ~6 months before it
      const endDate = new Date(earliestDate);
      endDate.setDate(endDate.getDate() - 1); // End one day before current data starts

      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 6); // Fetch ~6 months of additional data

      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = endDate.toISOString().slice(0, 10);

      const olderPrices = await api.pricesByDateRange(ticker, startStr, endStr);

      if (olderPrices && olderPrices.length > 0) {
        // Prepend older data to existing prices
        // Use a Map to deduplicate by date (in case of overlap)
        const merged = new Map<string, any>();

        // Add older data first
        for (const p of olderPrices) {
          const key = p.date?.slice(0, 10) ?? p.timestamp;
          merged.set(key, p);
        }

        // Add existing data (will overwrite any duplicates)
        for (const p of prices) {
          const key = p.date?.slice(0, 10) ?? p.timestamp;
          merged.set(key, p);
        }

        // Convert back to array and sort by timestamp
        const mergedArray = Array.from(merged.values()).sort(
          (a, b) => a.timestamp - b.timestamp
        );

        setPrices(mergedArray);
      }
    } catch (e: any) {
      console.error("Failed to load more prices:", e);
      // Don't show error to user - infinite scroll failures are non-critical
    } finally {
      setIsLoadingMorePrices(false);
    }
  }

  // ── Personalization handlers ─────────────────────────────────────────────
  const inWatchlist = ticker ? isInWatchlist(ticker) : false;

  function toggleWatchlist() {
    if (!ticker || !company) return;
    if (inWatchlist) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker, company.name || company.short_name || ticker);
    }
  }

  function handleAddPosition(shares: number, avgCost: number) {
    if (!ticker || !company) return;
    addPosition(ticker, company.name || company.short_name || ticker, shares, avgCost);
    setShowAddPosition(false);
  }

  function goToDashboard() {
    sessionStorage.removeItem("hf_return_project");
    navigate("/");
  }

  // ── Research Projects handlers ───────────────────────────────────────────
  async function createProjectFromTicker() {
    if (!ticker || !company) return;
    const title = prompt("Project title:", `${ticker} – Research Project`);
    if (!title) return;
    try {
      const p = await projectsApi.createProject({
        ticker: ticker,
        title,
      });
      navigate(`/projects/${p.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project");
    }
  }

  function returnToProject() {
    if (!returnProjectId) return;
    sessionStorage.removeItem("hf_return_project");
    navigate(`/projects/${returnProjectId}`);
  }

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 80,
          opacity: 0.6,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
        <div style={{ fontSize: 18 }}>Loading {ticker}...</div>
      </div>
    );
  }

  if (!company || !fundamentals) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        {error ? (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: "#3b1818",
              border: "1px solid #7f1d1d",
              borderRadius: 8,
              textAlign: "left",
            }}
          >
            <b>Error:</b> {error}
          </div>
        ) : (
          `Loading ${ticker}...`
        )}
      </div>
    );
  }

  return (
    <>
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

        {/* ── Save to Project dropdown ──────────────────────────── */}
        {isStock && (
          <SaveToProjectButton
            ticker={ticker}
            onCreateNew={createProjectFromTicker}
            onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
          />
        )}

        {/* ── Return to Project button (shown when came from project DCF flow) ── */}
        {returnProjectId && (
          <button
            onClick={returnToProject}
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
            marginLeft: returnProjectId ? undefined : "auto",
          }}
        >
          ← Dashboard
        </button>
      </div>

      {/* ── Inline Add Position Form ────────────────────────────── */}
      {showAddPosition && (
        <AddPositionInline
          ticker={ticker}
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
          <PriceChartWithDrawings
              data={prices}
              ticker={ticker}
              onPeriodChange={loadPrices}
              isAuthenticated={isAuthenticated}
              onLoadMore={loadMorePrices}
              isLoadingMore={isLoadingMorePrices}
            />
        </div>
      )}

      {/* ==================== */}
      {/* STOCK-ONLY SECTIONS */}
      {/* ==================== */}
      {isStock && (
        <>
          {/* ML Prediction */}
          <div style={{ marginBottom: 20 }}>
            <PredictionCard key={`pred-${ticker}`} ticker={ticker} />
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
              key={`dcf-${ticker}`}
              ticker={ticker}
              onStateChange={handleDCFStateChange}
            />
            <RiskCard key={`risk-${ticker}`} ticker={ticker} />
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
            <InstitutionalFlowCard key={`inst-${ticker}`} ticker={ticker} />
          </div>

          {/* Comps Table */}
          {comps && ticker && (
            <div style={{ marginBottom: 16 }}>
              <CompsTable
                data={comps}
                ticker={ticker}
                isAuthenticated={isAuthenticated}
                onRefetch={async (peerGroupId, peerTickers) => {
                  try {
                    const newComps = await api.comps(ticker, {
                      peer_group_id: peerGroupId ?? undefined,
                      peers: peerTickers ?? undefined,
                    });
                    if (newComps) setComps(newComps);
                  } catch (e) {
                    console.error("Failed to refetch comps:", e);
                  }
                }}
                onTickerClick={(t) => navigate(`/quote/${t.toUpperCase()}`)}
              />
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
              ticker={ticker}
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
            <InsiderTradingCard key={`insider-${ticker}`} ticker={ticker} />
            <PoliticianTradesCard key={`pol-${ticker}`} ticker={ticker} />
          </div>

          {/* Leadership */}
          {leadership.length > 0 && <LeadershipTable data={leadership} />}

          {/* Earnings */}
          <div style={{ marginBottom: 20 }}>
            <EarningsCard key={`earnings-${ticker}`} ticker={ticker} />
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
            <RiskCard key={`risk-${ticker}`} ticker={ticker} />
          </div>
        </>
      )}

      {/* ==================== */}
      {/* SHARED SECTIONS */}
      {/* ==================== */}

      {/* News - Works for both */}
      <NewsCard ticker={ticker} />

      {/* Options - Works for both (most ETFs have options) */}
      <div style={{ marginBottom: 20 }}>
        <OptionsFlowCard key={`options-${ticker}`} ticker={ticker} />
      </div>

      {/* Option Decay Simulator - Works for both */}
      <div style={{ marginBottom: 20 }}>
        <OptionDecaySimulator key={`decay-${ticker}`} ticker={ticker} />
      </div>

      {/* Financial Statements - Stock only */}
      {isStock && financials && (
        <div style={{ marginTop: 16 }}>
          <FinancialStatements
            key={`fin-${ticker}`}
            data={financials}
            ticker={ticker}
          />
        </div>
      )}
    </>
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
