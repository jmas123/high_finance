import { useState, useEffect, useCallback, useReducer, lazy, Suspense, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { api } from "./lib/api";
import { projectsApi } from "./components/project/api";
import { InfoTip } from "./components/common/InfoTip";
import { NAV_TIPS } from "./lib/tooltips";
import { CompanyHeader } from "./components/CompanyHeader";
import { FundamentalsCard } from "./components/FundamentalsCard";
import { EarningsCard } from "./components/earnings/EarningsCard";
import { NewsCard } from "./components/NewsCard";

// Lazy load heavy components for better initial load time
const PriceChartWithDrawings = lazy(() =>
  import("./components/chart").then(m => ({ default: m.PriceChartWithDrawings }))
);
const RiskCard = lazy(() =>
  import("./components/risk/RiskCard").then(m => ({ default: m.RiskCard }))
);
const OptionsFlowCard = lazy(() =>
  import("./components/options/OptionsFlowCard").then(m => ({ default: m.OptionsFlowCard }))
);
const OptionDecaySimulator = lazy(() =>
  import("./components/options/OptionsDecaySimulator").then(m => ({ default: m.OptionDecaySimulator }))
);
const DCFCard = lazy(() =>
  import("./components/valuation/DCFCard").then(m => ({ default: m.DCFCard }))
);
const NotificationsCard = lazy(() =>
  import("./components/notifications/NotificationsCard").then(m => ({ default: m.NotificationsCard }))
);
const CompsTable = lazy(() =>
  import("./components/CompsTableCard").then(m => ({ default: m.CompsTable }))
);
const PredictionCard = lazy(() =>
  import("./components/PredictionCard").then(m => ({ default: m.PredictionCard }))
);
const FinancialStatements = lazy(() =>
  import("./components/FinancialStatements").then(m => ({ default: m.FinancialStatements }))
);
const InsiderTradingCard = lazy(() =>
  import("./components/InsiderTradingCard").then(m => ({ default: m.InsiderTradingCard }))
);
const InstitutionalFlowCard = lazy(() =>
  import("./components/InstitutionalFlowCard").then(m => ({ default: m.InstitutionalFlowCard }))
);
const PoliticianTradesCard = lazy(() =>
  import("./components/politicians/PoliticianTradesCard").then(m => ({ default: m.PoliticianTradesCard }))
);
import type {
  CompsResponse, FinancialStatementsResponse, RiskBundle, ValuationBundle, NewsBundle,
  IVContext, PoliticianTradeWithContext, Company, Fundamentals, PriceEntry, LeadershipMember,
  InstitutionalFlow, InsiderTrade, InsiderSummary, OptionsOverview, EarningsData,
  PredictionResponse, MacroResponse, SectorResponse, RateImpactResponse,
} from "./lib/types";
import type { TickerBundleResponse } from "./lib/api";
import { LeadershipTable } from "./components/LeadershipTable";
import { SearchBar } from "./components/SearchBar";
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

// ── Stock Screener (lazy loaded) ────────────────────────────────────────────
const ScreenerCard = lazy(() =>
  import("./components/screener").then(m => ({ default: m.ScreenerCard }))
);
const MemoModal = lazy(() =>
  import("./components/memo/MemoModal").then(m => ({ default: m.MemoModal }))
);
const AIHistoryView = lazy(() =>
  import("./components/ai/AIHistoryView").then(m => ({ default: m.AIHistoryView }))
);
const CongressLeaderboard = lazy(() =>
  import("./components/politicians/CongressLeaderboard").then(m => ({ default: m.CongressLeaderboard }))
);
const BacktestDetailCard = lazy(() =>
  import("./components/politicians/BacktestDetailCard").then(m => ({ default: m.BacktestDetailCard }))
);
const EarningsAnalysisCard = lazy(() =>
  import("./components/earnings/EarningsAnalysisCard").then(m => ({ default: m.EarningsAnalysisCard }))
);
const ResetPasswordPage = lazy(() =>
  import("./components/auth/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage }))
);
const OnboardingView = lazy(() => import("./components/onboarding/OnboardingView"));

// ── Calendar ────────────────────────────────────────────────────────────────
import { CalendarPopupButton } from "./components/calendar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TickerPageSkeleton, CardSkeleton, ChartSkeleton } from "./components/Skeleton";
import { LandingPage } from "./components/LandingPage";

// ── Private Companies ─────────────────────────────────────────────────────
import { PrivateCompanyList } from "./components/private/PrivateCompanyList";
import { PrivateCompanyProfileView } from "./components/private/PrivateCompanyProfile";

// ── Mobile ────────────────────────────────────────────────────────────────
import { useIsMobile, useIsLargeScreen } from "./lib/useIsMobile";
import { MobileTabBar } from "./components/navigation/MobileTabBar";

// ── Loading fallback for lazy components ─────────────────────────────────────
const LoadingSpinner = () => (
  <div style={styles.loadingSpinner}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
    <div style={{ fontSize: 14 }}>Loading...</div>
  </div>
);

// ── Static styles extracted outside components to prevent recreation ─────────
const styles = {
  // Layout
  appContainer: {
    width: "100%",
    minHeight: "100vh",
    background: "#111",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as const,
  contentWrapper: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 24,
  } as const,
  loadingSpinner: {
    textAlign: "center" as const,
    padding: 60,
    opacity: 0.6,
  },
  // Header
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  } as const,
  searchContainer: { flex: 1 } as const,
  authLoading: { fontSize: 13, color: "#666" } as const,
  authRow: { display: "flex", alignItems: "center", gap: 10 } as const,
  authEmail: { fontSize: 13, color: "#888" } as const,
  signOutBtn: {
    padding: "8px 14px",
    background: "#222",
    border: "1px solid #444",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
  } as const,
  signInBtn: {
    padding: "8px 14px",
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  } as const,
  // Navigation tabs
  navRow: { display: "flex", gap: 10, marginBottom: 16 } as const,
  // Cards & sections
  cardContainer: {
    marginBottom: 20,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 10,
    padding: 16,
  } as const,
  gridTwoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  } as const,
  // Error
  errorBanner: {
    marginBottom: 20,
    padding: 12,
    background: "#3b1818",
    border: "1px solid #7f1d1d",
    borderRadius: 8,
  } as const,
  // Loading state
  tickerLoading: {
    textAlign: "center" as const,
    padding: 80,
    opacity: 0.6,
  },
  // ETF badge
  etfBadge: {
    display: "inline-block",
    padding: "4px 12px",
    background: "#3b82f6",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
  } as const,
  // Lazy loading fallback
  lazyFallback: {
    marginBottom: 20,
    padding: 40,
    background: "#1a1a1a",
    borderRadius: 10,
    textAlign: "center" as const,
    opacity: 0.5,
  },
};

// Nav link styles (function because active state varies)
const getNavLinkStyle = (isActive: boolean) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #444",
  background: isActive ? "#222" : "#111",
  color: "#fff",
  cursor: "pointer",
  textDecoration: "none",
});

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
  const { user, isAuthenticated, isLoading: authLoading, logout, sessionExpired, clearSessionExpired } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto-open auth modal when session expires
  useEffect(() => {
    if (sessionExpired) {
      setShowAuthModal(true);
    }
  }, [sessionExpired]);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isLargeScreen = useIsLargeScreen();

  // Determine active tab from current route
  const getActiveTab = () => {
    if (location.pathname.startsWith("/quote/")) return "ticker";
    if (location.pathname === "/screener") return "screener";
    if (location.pathname.startsWith("/projects")) return "projects";
    if (location.pathname === "/signals") return "signals";
    if (location.pathname.startsWith("/congress")) return "congress";
    if (location.pathname.startsWith("/private")) return "private";
    if (location.pathname === "/ai-history") return "ai-history";
    if (location.pathname === "/onboarding") return "onboarding";
    if (location.pathname === "/dashboard") return "dashboard";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  // ── Landing page: render outside the app shell for unauthenticated visitors at / ──
  if (location.pathname === "/") {
    // While checking auth, render nothing (dark bg prevents flash of landing before redirect)
    if (authLoading) return <div style={{ minHeight: "100vh", background: "#111" }} />;
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;
    return (
      <>
        <LandingPage onOpenAuth={() => setShowAuthModal(true)} />
        <AuthModal isOpen={showAuthModal} onClose={() => { setShowAuthModal(false); clearSessionExpired(); }} />
      </>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={{
        ...styles.contentWrapper,
        ...(isLargeScreen ? { maxWidth: 1400 } : {}),
        ...(isMobile ? { padding: "12px 14px", paddingBottom: 80 } : {}),
      }}>
        {/* Header with Search + Calendar + Auth */}
        <div style={{
          ...styles.headerRow,
          ...(isMobile ? { flexWrap: "wrap" } : {}),
        }}>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : undefined }}>
            <SearchBar
              onSelect={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
              loading={false}
              isMobile={isMobile}
            />
          </div>
          {/* Calendar Button */}
          <CalendarPopupButton
            onTickerClick={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
          />
          {/* Auth Button */}
          {authLoading ? (
            <div style={styles.authLoading}>...</div>
          ) : isAuthenticated && user ? (
            <div style={styles.authRow}>
              {!isMobile && <span style={styles.authEmail}>{user.email}</span>}
              <button onClick={logout} style={styles.signOutBtn}>
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={styles.signInBtn}>
              Sign In
            </button>
          )}
        </div>

        {/* ── Navigation Tabs (desktop only) ───────────────────────────── */}
        {!isMobile && (
          <div style={styles.navRow}>
            <Link to="/dashboard" style={getNavLinkStyle(activeTab === "dashboard")}>
              Dashboard
            </Link>
            <Link to="/screener" style={getNavLinkStyle(activeTab === "screener")}>
              Screener<InfoTip text={NAV_TIPS.screener} />
            </Link>
            <Link to="/projects" style={getNavLinkStyle(activeTab === "projects")}>
              Projects
            </Link>
            <Link to="/signals" style={getNavLinkStyle(activeTab === "signals")}>
              Signals<InfoTip text={NAV_TIPS.signals} />
            </Link>
            <Link to="/congress" style={getNavLinkStyle(activeTab === "congress")}>
              Congress<InfoTip text={NAV_TIPS.congress} />
            </Link>
            <Link to="/private" style={getNavLinkStyle(activeTab === "private")}>
              Private Companies
            </Link>
            <Link to="/ai-history" style={getNavLinkStyle(activeTab === "ai-history")}>
              AI History
            </Link>
            <Link to="/onboarding" style={getNavLinkStyle(activeTab === "onboarding")}>
              Onboarding
            </Link>
          </div>
        )}

        {/* ── Routes (wrapped in ErrorBoundary + Suspense) ─────────────── */}
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/quote/:ticker" element={<TickerView />} />
              <Route path="/screener" element={<ScreenerView />} />
              <Route path="/projects" element={<ProjectsListView />} />
              <Route path="/projects/:projectId" element={<ProjectView />} />
              <Route path="/signals" element={<SignalsView />} />
              <Route path="/congress" element={<CongressView />} />
              <Route path="/congress/:politicianId" element={<CongressDetailView />} />
              <Route path="/ai-history" element={<AIHistoryView />} />
              <Route path="/private" element={<PrivateCompanyList />} />
              <Route path="/private/:slug" element={<PrivateCompanyProfileView />} />
              <Route path="/onboarding" element={<OnboardingView />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<NotFoundView />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && <MobileTabBar />}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => { setShowAuthModal(false); clearSessionExpired(); }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 404 NOT FOUND
// ══════════════════════════════════════════════════════════════════════════════
function NotFoundView() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center", padding: "80px 20px", color: "#888" }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", marginBottom: 8 }}>404</div>
      <div style={{ fontSize: 16, marginBottom: 24 }}>Page not found</div>
      <button
        onClick={() => navigate("/dashboard")}
        style={{
          padding: "10px 24px",
          background: "#222",
          color: "#fff",
          border: "1px solid #444",
          borderRadius: 8,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW (/)
// ══════════════════════════════════════════════════════════════════════════════
function DashboardView() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <HomeDashboard
      onSelect={(ticker) => navigate(`/quote/${ticker.toUpperCase()}`)}
      onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
      isAuthenticated={isAuthenticated}
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
    <Suspense fallback={<CardSkeleton />}>
      <div style={{ marginBottom: 20 }}>
        <NotificationsCard />
      </div>
    </Suspense>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONGRESS VIEW (/congress)
// ══════════════════════════════════════════════════════════════════════════════
function CongressView() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CongressLeaderboard />
    </Suspense>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONGRESS DETAIL VIEW (/congress/:politicianId)
// ══════════════════════════════════════════════════════════════════════════════
function CongressDetailView() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <BacktestDetailCard />
    </Suspense>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS LIST VIEW (/projects)
// ══════════════════════════════════════════════════════════════════════════════
function ProjectsListView() {
  const navigate = useNavigate();
  const [error ] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        onCreateProject={() => setShowCreateModal(true)}
        refreshKey={refreshKey}
      />
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(p) => {
          setRefreshKey((n) => n + 1);
          navigate(`/projects/${p.id}`);
        }}
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

// ── Ticker state reducer ─────────────────────────────────────────────────────
// Replaces 19 individual useState hooks with a single dispatch.
// One dispatch({ type: 'LOAD_SUCCESS', bundle }) → single reconciliation pass.
type TickerState = {
  company: Company | null;
  fundamentals: Fundamentals | null;
  prices: PriceEntry[];
  leadership: LeadershipMember[];
  financials: FinancialStatementsResponse | null;
  comps: CompsResponse | null;
  riskData: RiskBundle | null;
  valuationData: ValuationBundle | null;
  institutionalFlow: InstitutionalFlow | null;
  insiderTrades: InsiderTrade[];
  insiderSummary: InsiderSummary | null;
  politicianTrades: PoliticianTradeWithContext[];
  optionsOverview: OptionsOverview | null;
  ivContext: IVContext | null;
  earningsData: EarningsData | null;
  newsData: NewsBundle | null;
  predictionData: PredictionResponse | null;
  macroIndicators: MacroResponse | null;
  sectorsData: SectorResponse | null;
  rateImpact: RateImpactResponse | null;
  loading: boolean;
  error: string | null;
  dataWarnings: string[];
};

type TickerAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; bundle: TickerBundleResponse }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'UPDATE_PRICES'; prices: PriceEntry[] }
  | { type: 'UPDATE_COMPS'; comps: CompsResponse }
  | { type: 'DISMISS_WARNINGS' }
  | { type: 'RETRY_START' }
  | { type: 'RETRY_SUCCESS'; updates: Partial<TickerState>; clearedWarnings: string[] };

const initialTickerState: TickerState = {
  company: null,
  fundamentals: null,
  prices: [],
  leadership: [],
  financials: null,
  comps: null,
  riskData: null,
  valuationData: null,
  institutionalFlow: null,
  insiderTrades: [],
  insiderSummary: null,
  politicianTrades: [],
  optionsOverview: null,
  ivContext: null,
  earningsData: null,
  newsData: null,
  predictionData: null,
  macroIndicators: null,
  sectorsData: null,
  rateImpact: null,
  loading: false,
  error: null,
  dataWarnings: [],
};

function tickerReducer(state: TickerState, action: TickerAction): TickerState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...initialTickerState, loading: true };
    case 'LOAD_SUCCESS': {
      const b = action.bundle;
      const isEtfOrFund = b.fundamentals?.is_etf || b.fundamentals?.is_mutual_fund;
      return {
        company: b.company,
        fundamentals: b.fundamentals,
        prices: b.prices || [],
        leadership: isEtfOrFund ? [] : (b.leadership || []),
        financials: isEtfOrFund ? null : b.financials,
        comps: isEtfOrFund ? null : b.comps,
        riskData: b.risk,
        valuationData: b.valuation,
        institutionalFlow: b.institutional_flow,
        insiderTrades: b.insider_trades || [],
        insiderSummary: b.insider_summary,
        politicianTrades: b.politician_trades || [],
        optionsOverview: b.options_overview,
        ivContext: b.iv_context,
        earningsData: b.earnings,
        newsData: b.news,
        predictionData: b.prediction,
        macroIndicators: b.macro_indicators,
        sectorsData: b.sectors,
        rateImpact: b.rate_impact,
        loading: false,
        error: null,
        dataWarnings: Object.keys(b.errors).length > 0
          ? Object.entries(b.errors).map(([k, v]) => `${k}: ${v}`)
          : [],
      };
    }
    case 'LOAD_ERROR':
      return { ...initialTickerState, error: action.error };
    case 'UPDATE_PRICES':
      return { ...state, prices: action.prices };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'UPDATE_COMPS':
      return { ...state, comps: action.comps };
    case 'DISMISS_WARNINGS':
      return { ...state, dataWarnings: [] };
    case 'RETRY_START':
      return state; // No-op for state — retrying flag is local useState
    case 'RETRY_SUCCESS': {
      const remaining = state.dataWarnings.filter(
        w => !action.clearedWarnings.includes(w)
      );
      return { ...state, ...action.updates, dataWarnings: remaining };
    }
    default:
      return state;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TICKER VIEW (/quote/:ticker)
// ══════════════════════════════════════════════════════════════════════════════
// Ticker format: 1-10 chars, alphanumeric + dot + hyphen (e.g. AAPL, BRK.B, BF-B)
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

function TickerView() {
  const { ticker: urlTicker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Validate ticker from URL — redirect to home if invalid
  const normalizedTicker = urlTicker?.toUpperCase() ?? "";
  if (!TICKER_RE.test(normalizedTicker)) {
    return <Navigate to="/dashboard" replace />;
  }

  const { isAuthenticated } = useAuth();
  const {
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    addPosition,
  } = useUserData();

  const [state, dispatch] = useReducer(tickerReducer, initialTickerState);
  const {
    company, fundamentals, prices, leadership, financials, comps,
    riskData, valuationData, institutionalFlow, insiderSummary,
    politicianTrades, optionsOverview, ivContext, earningsData, newsData,
    predictionData, macroIndicators, sectorsData, rateImpact, loading, error, dataWarnings,
  } = state;

  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [warningExpanded, setWarningExpanded] = useState(false);

  // Check if we came from a project (for return button)
  const returnProjectId = sessionStorage.getItem("hf_return_project");

  // DCF state for project import flow - save to sessionStorage for cross-route persistence
  const handleDCFStateChange = useCallback((dcfState: DCFState) => {
    if (dcfState && returnProjectId) {
      // Only save to session if we came from a project
      saveDCFToSession(dcfState);
    }
  }, [returnProjectId]);

  const ticker = urlTicker?.toUpperCase() || "";

  // Track in-flight request to prevent double fetches in StrictMode
  const fetchingRef = useRef<string | null>(null);

  // Determine if current ticker is an ETF
  const isETF = fundamentals?.is_etf === true;
  const sector = fundamentals?.sector;
  const isMutualFund = fundamentals?.is_mutual_fund === true;
  const isStock = fundamentals && !isETF && !isMutualFund;

  // Load ticker data when URL param changes
  // Uses bundled API endpoint to fetch ALL data in ONE request (avoids browser connection limit)
  const loadTicker = useCallback(async (t: string) => {
    if (!t) return;

    // Prevent duplicate fetches (React StrictMode double-invokes effects)
    if (fetchingRef.current === t) return;
    fetchingRef.current = t;

    dispatch({ type: 'LOAD_START' });
    setShowAddPosition(false);

    try {
      // Single request fetches ALL data - backend runs parallel fetches internally
      const bundle = await api.tickerBundle(t, "1y");

      // Check for critical failures
      if (!bundle.company && !bundle.fundamentals) {
        throw new Error("Ticker not found");
      }

      // Single dispatch replaces 19 individual setState calls → one reconciliation pass
      dispatch({ type: 'LOAD_SUCCESS', bundle });

      // ── Personalization tracking ───────────────────────────────────────────
      addRecentTicker(t);

      // Log any partial failures for debugging
      if (Object.keys(bundle.errors).length > 0) {
        console.warn("Partial load failures:", bundle.errors);
      }
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR', error: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      fetchingRef.current = null;
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

  const loadPrices = useCallback(async (period: string) => {
    if (!ticker) return;
    try {
      const p = await api.prices(ticker, period);
      dispatch({ type: 'UPDATE_PRICES', prices: p });
    } catch (e) {
      console.error("Failed to load prices:", e);
    }
  }, [ticker]);

  // State for infinite scroll loading
  const [isLoadingMorePrices, setIsLoadingMorePrices] = useState(false);

  /**
   * Load more historical price data (infinite scroll).
   * Fetches ~6 months of data ending at the earliestDate and prepends it.
   */
  const loadMorePrices = useCallback(async (earliestDate: string): Promise<void> => {
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
        const merged = new Map<string, PriceEntry>();

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

        dispatch({ type: 'UPDATE_PRICES', prices: mergedArray });
      }
    } catch (e) {
      console.error("Failed to load more prices:", e);
      // Don't show error to user - infinite scroll failures are non-critical
    } finally {
      setIsLoadingMorePrices(false);
    }
  }, [ticker, isLoadingMorePrices, prices]);

  // ── Retry failed sections ───────────────────────────────────────────────
  const SECTION_LABELS: Record<string, string> = {
    risk: "Risk Analysis", valuation: "Valuation (DCF)", prediction: "ML Prediction",
    earnings: "Earnings", news: "News", financials: "Financial Statements",
    institutional_flow: "Institutional Flow", insider_trades: "Insider Trades",
    insider_summary: "Insider Summary", options_overview: "Options Overview",
    iv_context: "IV Context", politician_trades: "Politician Trades",
    leadership: "Leadership", prices: "Price History", comps: "Comparables",
  };

  const retryFailedSections = useCallback(async () => {
    if (!ticker || retrying || dataWarnings.length === 0) return;
    setRetrying(true);

    // Parse warning strings → error keys (e.g. "risk: Timed out" → "risk")
    const failedKeys = dataWarnings.map(w => w.split(":")[0].trim());

    // Map error key → { apiCall, stateField }
    const retryMap: Record<string, { call: () => Promise<unknown>; field: keyof TickerState }> = {
      risk:               { call: () => api.risk(ticker),               field: "riskData" },
      valuation:          { call: () => api.valuation(ticker),          field: "valuationData" },
      prediction:         { call: () => api.prediction(ticker),         field: "predictionData" },
      earnings:           { call: () => api.earnings(ticker),           field: "earningsData" },
      news:               { call: () => api.news(ticker),               field: "newsData" },
      financials:         { call: () => api.financials(ticker),         field: "financials" },
      institutional_flow: { call: () => api.institutionalFlow(ticker),  field: "institutionalFlow" },
      insider_trades:     { call: () => api.insiderTrades(ticker),      field: "insiderTrades" as keyof TickerState },
      insider_summary:    { call: () => api.insiderSummary(ticker),     field: "insiderSummary" },
      options_overview:   { call: () => api.optionsOverview(ticker),    field: "optionsOverview" },
      iv_context:         { call: () => api.ivContext(ticker),          field: "ivContext" },
      politician_trades:  { call: () => api.politicianTrades(ticker),   field: "politicianTrades" },
      leadership:         { call: () => api.leadership(ticker),         field: "leadership" },
      prices:             { call: () => api.prices(ticker),             field: "prices" },
      comps:              { call: () => api.comps(ticker, {}),          field: "comps" },
    };

    const keysToRetry = failedKeys.filter(k => k in retryMap);
    const promises = keysToRetry.map(async (key) => {
      try {
        const data = await retryMap[key].call();
        return { key, field: retryMap[key].field, data, ok: true as const };
      } catch {
        return { key, ok: false as const };
      }
    });

    const results = await Promise.allSettled(promises);

    const updates: Partial<TickerState> = {};
    const clearedWarnings: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        const { key, field, data } = result.value;
        (updates as Record<string, unknown>)[field] = data;
        // Find the original warning string for this key
        const warning = dataWarnings.find(w => w.startsWith(key + ":"));
        if (warning) clearedWarnings.push(warning);
      }
    }

    dispatch({ type: "RETRY_SUCCESS", updates, clearedWarnings });
    setRetrying(false);
  }, [ticker, retrying, dataWarnings]);

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
    navigate("/dashboard");
  }

  function returnToProject() {
    if (!returnProjectId) return;
    sessionStorage.removeItem("hf_return_project");
    navigate(`/projects/${returnProjectId}`);
  }

  // Responsive grid: side-by-side on desktop, stacked on mobile
  const responsiveGrid = isMobile
    ? { ...styles.gridTwoCol, gridTemplateColumns: "1fr" }
    : styles.gridTwoCol;

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return <TickerPageSkeleton />;
  }

  if (!company || !fundamentals) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        {error ? (
          <div style={{ ...styles.errorBanner, textAlign: "left" }}>
            <b>Error:</b> {error}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => ticker && loadTicker(ticker)}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
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
        <div style={styles.errorBanner}>
          <b>Error:</b> {error}
        </div>
      )}

      {/* ETF Badge */}
      {isETF && <div style={styles.etfBadge}>📊 ETF</div>}

      <CompanyHeader company={company} fundamentals={fundamentals} prices={prices} />

      {/* ── Action Buttons (Watch / Portfolio / Project / Back) ──── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 12, flexWrap: "wrap" }}>
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
            onCreateNew={() => setShowCreateProjectModal(true)}
            onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
          />
        )}

        {/* ── Generate AI Memo (stocks only, auth required) ── */}
        {isStock && (
          <button
            onClick={() => {
              if (!isAuthenticated) {
                alert("Sign in to generate AI investment memos.");
                return;
              }
              setShowMemoModal(true);
            }}
            style={{
              background: "#f59e0b20",
              border: "1px solid #f59e0b40",
              borderRadius: 8,
              color: "#f59e0b",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {"\uD83D\uDCDD"} Generate Memo
          </button>
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

      {/* ── Failed Sections Warning Banner ──────────────────────── */}
      {dataWarnings.length > 0 && (
        <div style={{
          background: "#451a0320", border: "1px solid #78350f",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#f59e0b", fontSize: 14, flex: 1 }}>
              {dataWarnings.length} section{dataWarnings.length > 1 ? "s" : ""} failed to load
              <button
                onClick={() => setWarningExpanded(!warningExpanded)}
                style={{
                  background: "none", border: "none", color: "#f59e0b",
                  cursor: "pointer", fontSize: 12, marginLeft: 6, textDecoration: "underline",
                }}
              >
                {warningExpanded ? "hide" : "show"}
              </button>
            </span>
            <button
              onClick={retryFailedSections}
              disabled={retrying}
              style={{
                background: "#78350f", border: "1px solid #92400e",
                borderRadius: 6, color: "#fbbf24", fontSize: 12, fontWeight: 600,
                padding: "4px 12px", cursor: retrying ? "wait" : "pointer",
                opacity: retrying ? 0.7 : 1,
              }}
            >
              {retrying ? "Retrying..." : "Retry Failed"}
            </button>
            <button
              onClick={() => dispatch({ type: "DISMISS_WARNINGS" })}
              style={{
                background: "none", border: "none", color: "#78350f",
                cursor: "pointer", fontSize: 16, padding: "0 4px",
              }}
              title="Dismiss"
            >
              x
            </button>
          </div>
          {warningExpanded && (
            <ul style={{ margin: 0, paddingLeft: 20, color: "#d97706", fontSize: 12 }}>
              {dataWarnings.map(w => {
                const key = w.split(":")[0].trim();
                const reason = w.slice(w.indexOf(":") + 1).trim();
                return (
                  <li key={key} style={{ marginBottom: 2 }}>
                    <strong>{SECTION_LABELS[key] || key}</strong>: {reason}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
        <Suspense fallback={<ChartSkeleton />}>
          <div style={styles.cardContainer}>
            <PriceChartWithDrawings
              data={prices}
              ticker={ticker}
              onPeriodChange={loadPrices}
              isAuthenticated={isAuthenticated}
              onLoadMore={loadMorePrices}
              isLoadingMore={isLoadingMorePrices}
            />
          </div>
        </Suspense>
      )}

      {/* ==================== */}
      {/* STOCK-ONLY SECTIONS */}
      {/* ==================== */}
      {isStock && (
        <>
          {/* ML Prediction */}
          <Suspense fallback={<CardSkeleton />}>
            <div style={{ marginBottom: 20 }}>
              <PredictionCard key={`pred-${ticker}`} ticker={ticker} initialData={predictionData} />
            </div>
          </Suspense>

          {/* DCF + Risk (side by side) */}
          <Suspense fallback={<div style={responsiveGrid}><CardSkeleton /><CardSkeleton /></div>}>
            <div style={responsiveGrid}>
              <DCFCard
                key={`dcf-${ticker}`}
                ticker={ticker}
                onStateChange={handleDCFStateChange}
                initialData={valuationData}
              />
              <RiskCard key={`risk-${ticker}`} ticker={ticker} initialData={riskData} />
            </div>
          </Suspense>

          {/* Fundamentals + Institutional Flow */}
          <Suspense fallback={<div style={responsiveGrid}><CardSkeleton height={160} /><CardSkeleton height={160} /></div>}>
            <div style={responsiveGrid}>
              <FundamentalsCard data={fundamentals} />
              <InstitutionalFlowCard key={`inst-${ticker}`} ticker={ticker} initialData={institutionalFlow} />
            </div>
          </Suspense>

          {/* Comps Table */}
          {comps && ticker && (
            <Suspense fallback={<CardSkeleton height={200} />}>
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
                      if (newComps) dispatch({ type: 'UPDATE_COMPS', comps: newComps });
                    } catch (e) {
                      console.error("Failed to refetch comps:", e);
                    }
                  }}
                  onTickerClick={(t) => navigate(`/quote/${t.toUpperCase()}`)}
                />
              </div>
            </Suspense>
          )}

          <div style={{ ...styles.cardContainer, padding: 20 }}>
            <BroaderMarketContext
              ticker={ticker}
              sector={sector ?? undefined}
              showMacro={true}
              showSectors={true}
              showRateImpact={true}
              initialMacroData={macroIndicators}
              initialSectorsData={sectorsData}
              initialRateImpactData={rateImpact}
            />
          </div>

          {/* Insider + Politicians */}
          <Suspense fallback={<div style={responsiveGrid}><CardSkeleton height={160} /><CardSkeleton height={160} /></div>}>
            <div style={responsiveGrid}>
              <InsiderTradingCard key={`insider-${ticker}`} ticker={ticker} initialData={insiderSummary} />
              <PoliticianTradesCard key={`pol-${ticker}`} ticker={ticker} initialData={politicianTrades} />
            </div>
          </Suspense>

          {/* Leadership */}
          {leadership.length > 0 && <LeadershipTable data={leadership} />}

          {/* Earnings */}
          <div style={{ marginBottom: 20 }}>
            <EarningsCard key={`earnings-${ticker}`} ticker={ticker} initialData={earningsData} />
          </div>

          {/* Earnings Press Release AI Analysis */}
          <Suspense fallback={<CardSkeleton />}>
            <div style={{ marginBottom: 20 }}>
              <EarningsAnalysisCard ticker={ticker} isAuthenticated={isAuthenticated} />
            </div>
          </Suspense>
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
          <Suspense fallback={<CardSkeleton />}>
            <div style={{ marginBottom: 20 }}>
              <RiskCard key={`risk-${ticker}`} ticker={ticker} initialData={riskData} />
            </div>
          </Suspense>
        </>
      )}

      {/* ==================== */}
      {/* SHARED SECTIONS */}
      {/* ==================== */}

      {/* News - Works for both */}
      <NewsCard ticker={ticker} initialData={newsData} />

      {/* Options - Works for both (most ETFs have options) */}
      <Suspense fallback={<CardSkeleton />}>
        <div style={{ marginBottom: 20 }}>
          <OptionsFlowCard key={`options-${ticker}`} ticker={ticker} initialData={optionsOverview} />
        </div>
      </Suspense>

      {/* Option Decay Simulator - Works for both (lazy loaded) */}
      <Suspense fallback={<CardSkeleton />}>
        <div style={{ marginBottom: 20 }}>
          <OptionDecaySimulator
            key={`decay-${ticker}`}
            ticker={ticker}
            initialOptionsData={optionsOverview}
            initialIVContext={ivContext}
          />
        </div>
      </Suspense>

      {/* Financial Statements - Stock only */}
      {isStock && financials && (
        <Suspense fallback={<CardSkeleton height={240} />}>
          <div style={{ marginTop: 16 }}>
            <FinancialStatements
              key={`fin-${ticker}`}
              data={financials}
              ticker={ticker}
            />
          </div>
        </Suspense>
      )}

      {/* ── AI Investment Memo Modal ── */}
      {showMemoModal && (
        <Suspense fallback={null}>
          <MemoModal
            ticker={ticker}
            isOpen={showMemoModal}
            onClose={() => setShowMemoModal(false)}
          />
        </Suspense>
      )}

      {/* ── Create Project Modal ── */}
      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onCreated={(p) => navigate(`/projects/${p.id}`)}
        initialTicker={ticker}
      />
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
  const isMobile = useIsMobile();

  const inputStyle = {
    background: "#222",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#fff",
    padding: "5px 8px",
    fontSize: 12,
    outline: "none",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
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
        style={{ ...inputStyle, width: isMobile ? "100%" : 80 }}
      />
      <input
        placeholder="Avg Cost ($)"
        type="number"
        step="any"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        style={{ ...inputStyle, width: isMobile ? "100%" : 100 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
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
            flex: isMobile ? 1 : undefined,
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
    </div>
  );
}

// ==========================================
// CREATE PROJECT MODAL
// ==========================================
// Matches backend: api/v1/deps.py validate_ticker()
const PROJECT_TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;
const PROJECT_TITLE_MAX = 200;

function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  initialTicker,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: { id: number }) => void;
  initialTicker?: string;
}) {
  // ── Form state ───────────────────────────────────────────────────────────
  const [ticker, setTicker] = useState("");
  const [tickerName, setTickerName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Search state (only when no initialTicker) ────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { symbol: string; name: string; exchange: string; type: string }[]
  >([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);

  const tickerRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset on open/close ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTicker(initialTicker || "");
      setTickerName(null);
      setSearchQuery(initialTicker || "");
      setTitle("");
      setCreating(false);
      setError(null);
      setSearchResults([]);
      setShowResults(false);
      setSelectedIndex(-1);
      setTimeout(() => {
        if (initialTicker) titleRef.current?.focus();
        else tickerRef.current?.focus();
      }, 50);
    } else {
      // Clean up debounce on close
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [isOpen, initialTicker]);

  // ── Debounced ticker search ──────────────────────────────────────────────
  useEffect(() => {
    if (initialTicker) return; // Skip search when ticker is locked
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = searchQuery.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // If user already selected a result and hasn't changed the input, skip
    if (ticker && q.toUpperCase() === ticker) return;

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.search(q);
        setSearchResults(results);
        setShowResults(results.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, initialTicker, ticker]);

  if (!isOpen) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSelectResult(symbol: string, name: string) {
    setTicker(symbol);
    setTickerName(name);
    setSearchQuery(symbol);
    setSearchResults([]);
    setShowResults(false);
    titleRef.current?.focus();
  }

  function handleTickerInputChange(value: string) {
    // Strip anything that isn't alphanumeric, dot, or hyphen — prevents injection
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 10);
    setSearchQuery(sanitized);
    // Clear locked selection so search resumes
    if (sanitized !== ticker) {
      setTicker("");
      setTickerName(null);
    }
  }

  function handleTickerKeyDown(e: React.KeyboardEvent) {
    if (showResults && searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const r = searchResults[selectedIndex];
        handleSelectResult(r.symbol, r.name);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Accept raw typed ticker if no dropdown selection
      const raw = searchQuery.trim().toUpperCase();
      if (raw && !ticker) {
        setTicker(raw);
        setShowResults(false);
        titleRef.current?.focus();
      } else {
        handleCreate();
      }
      return;
    }
    if (e.key === "Escape") {
      if (showResults) {
        setShowResults(false);
      } else {
        onClose();
      }
    }
    if (e.key === "Tab" && showResults) {
      setShowResults(false);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !creating) handleCreate();
    if (e.key === "Escape") onClose();
  }

  async function handleCreate() {
    const t = (ticker || searchQuery.trim()).toUpperCase();
    const ti = title.trim().slice(0, PROJECT_TITLE_MAX);

    if (!t) { setError("Ticker is required"); return; }
    if (!PROJECT_TICKER_RE.test(t)) {
      setError("Invalid ticker format — use 1-10 characters (letters, numbers, dots, hyphens)");
      return;
    }
    if (!ti) { setError("Title is required"); return; }

    setCreating(true);
    setError(null);
    try {
      const p = await projectsApi.createProject({ ticker: t, title: ti });
      onCreated(p);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setCreating(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    background: "#222",
    border: "1px solid #444",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxWidth: "min(90vw, 480px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
          New Research Project
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "#3b1818",
              border: "1px solid #7f1d1d",
              borderRadius: 6,
              color: "#ef4444",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Ticker Search */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>
            Ticker
          </label>
          {initialTicker ? (
            /* Locked ticker from ticker page */
            <div
              style={{
                ...inputStyle,
                background: "#151515",
                opacity: 0.7,
                fontFamily: "monospace",
                letterSpacing: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 600 }}>{initialTicker}</span>
            </div>
          ) : (
            /* Searchable ticker input */
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <div style={{ position: "relative" }}>
                <input
                  ref={tickerRef}
                  value={searchQuery}
                  onChange={(e) => handleTickerInputChange(e.target.value)}
                  onKeyDown={handleTickerKeyDown}
                  onFocus={() => searchResults.length > 0 && !ticker && setShowResults(true)}
                  placeholder="Search by ticker or company name..."
                  autoComplete="off"
                  maxLength={50}
                  style={{
                    ...inputStyle,
                    fontFamily: ticker ? "monospace" : "inherit",
                    letterSpacing: ticker ? 1 : 0,
                    paddingRight: searching ? 36 : 12,
                  }}
                />
                {searching && (
                  <span style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    opacity: 0.5,
                  }}>
                    ...
                  </span>
                )}
              </div>

              {/* Selected ticker confirmation */}
              {ticker && tickerName && (
                <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>{ticker}</span>
                  <span style={{ color: "#888" }}>{tickerName}</span>
                </div>
              )}

              {/* Search results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#222",
                    border: "1px solid #444",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    maxHeight: 200,
                    overflowY: "auto",
                    zIndex: 10,
                  }}
                >
                  {searchResults.slice(0, 8).map((r, i) => (
                    <div
                      key={r.symbol}
                      onClick={() => handleSelectResult(r.symbol, r.name)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        background: i === selectedIndex ? "#333" : "transparent",
                        borderBottom: i < Math.min(searchResults.length, 8) - 1 ? "1px solid #2a2a2a" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>{r.symbol}</span>
                          <span style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            background: r.type === "ETF" ? "#8b5cf630" : "#3b82f630",
                            color: r.type === "ETF" ? "#8b5cf6" : "#3b82f6",
                            borderRadius: 3,
                          }}>
                            {r.type}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: "#888",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {r.name}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#555", flexShrink: 0, marginLeft: 8 }}>
                        {r.exchange}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>
            Project Title
          </label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, PROJECT_TITLE_MAX))}
            onKeyDown={handleTitleKeyDown}
            placeholder="e.g. Value Play Q1, Semiconductor Thesis, Deep Dive..."
            autoComplete="off"
            maxLength={PROJECT_TITLE_MAX}
            style={inputStyle}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#555" }}>
              Name it anything — doesn't have to match the ticker.
            </span>
            {title.length > 150 && (
              <span style={{ fontSize: 11, color: title.length >= PROJECT_TITLE_MAX ? "#ef4444" : "#555" }}>
                {title.length}/{PROJECT_TITLE_MAX}
              </span>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              background: "#222",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#aaa",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: "9px 18px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "wait" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ETF FUNDAMENTALS CARD COMPONENT
// ==========================================
function ETFFundamentalsCard({ data }: { data: Fundamentals }) {
  if (!data) return null;

  const formatPercent = (val: number | null | undefined) => {
    if (val == null) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatMoney = (val: number | null | undefined) => {
    if (val == null) return "—";
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
              color: data.expense_ratio != null && data.expense_ratio < 0.002 ? "#22c55e" : "#fff",
            }}
          >
            {data.expense_ratio != null ? `${(data.expense_ratio * 100).toFixed(2)}%` : "—"}
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
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
                  data.ytd_return != null && data.ytd_return > 0 ? "#22c55e" : data.ytd_return != null && data.ytd_return < 0 ? "#ef4444" : "#fff",
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
                  data.three_year_return != null && data.three_year_return > 0
                    ? "#22c55e"
                    : data.three_year_return != null && data.three_year_return < 0
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
                  data.five_year_return != null && data.five_year_return > 0
                    ? "#22c55e"
                    : data.five_year_return != null && data.five_year_return < 0
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
