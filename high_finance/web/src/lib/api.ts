// 1. Update your imports to include CompsResponse
import type {
  Company,
  Fundamentals,
  OwnershipEntry,
  LeadershipMember,
  CompsResponse,
  FinancialStatementsResponse,
  NewsBundle,
  RiskBundle,
  ValuationBundle,
  PoliticianTradeWithContext,
  PoliticianPerformance,
  OptionDecaySimulation,
  IVContext,
  ContractIVResponse,
  ScreenerFilters,
  ScreenerResponse,
  SavedScreen,
  SavedScreenCreate,
  ExportInputs,
  PortfolioPerformanceResponse,
  PrivateCompanySummary,
  PrivateCompanyProfile,
  MemoSummary,
  MemoDetail,
  AIHistoryItem,
  AIHistoryDetail,
  AIHistoryStats,
  PriceEntry,
  InstitutionalFlow,
  Holder,
  InsiderTrade,
  InsiderSummary,
  OptionsOverview,
  EarningsData,
  EarningsHistoryEntry,
  PredictionResponse,
  BacktestResponse,
  LeaderboardResponse,
  AISuggestion,
  AIRiskAssessment,
  EarningsAnalysisResponse,
  ForwardReturnsResponse,
  EventStatsResponse,
  EventSummaryResponse,
  SignalRankingResponse,
} from "./types";
import type {
  CalendarEventsRequest,
  CalendarEventsResponse,
} from "../components/calendar/types";
// import type { OptionDecaySimulation, IVContext, ContractIVResponse } from "./types";

const BASE = (import.meta.env.VITE_API_URL || "") + "/api/v1";
const TOKEN_KEY = "hf_access_token";

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

const DEFAULT_TIMEOUT_MS = 30_000;

export function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

function handleResponseError(res: Response): void {
  if (res.status === 401 && localStorage.getItem(TOKEN_KEY)) {
    // Token expired or invalid — notify auth layer
    window.dispatchEvent(new CustomEvent("hf:session-expired"));
  }
}

async function getJSON<T>(path: string, timeoutMs?: number): Promise<T> {
  const res = await fetchWithTimeout(path, { headers: getAuthHeaders() }, timeoutMs);
  if (!res.ok) {
    handleResponseError(res);
    let message: string;
    try {
      const body = await res.json();
      message = body.detail || body.message || `Error ${res.status}`;
    } catch {
      message = await res.text();
    }
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

async function postJSON<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(path, { method: "POST", headers: getAuthHeaders() });
  if (!res.ok) {
    handleResponseError(res);
    let message: string;
    try {
      const body = await res.json();
      message = body.detail || body.message || `Error ${res.status}`;
    } catch {
      message = await res.text();
    }
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART DRAWINGS API
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ChartDrawing,
  ChartDrawingCreate,
  ChartDrawingUpdate,
  ChartDrawingList,
  BatchDrawingCreate,
  BatchDrawingResponse,
} from "../components/chart/types/drawing";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Bundle response type for single-request ticker data
// This mega-bundle fetches ALL ticker page data in one request to avoid browser connection limits
export interface TickerBundleResponse {
  // Core data
  company: Company | null;
  fundamentals: Fundamentals | null;
  prices: PriceEntry[];
  leadership: LeadershipMember[];
  financials: FinancialStatementsResponse | null;
  comps: CompsResponse | null;

  // Component data (previously fetched individually by each card)
  risk: RiskBundle | null;
  valuation: ValuationBundle | null;
  institutional_flow: InstitutionalFlow | null;
  insider_trades: InsiderTrade[];
  insider_summary: InsiderSummary | null;
  politician_trades: PoliticianTradeWithContext[];
  options_overview: OptionsOverview | null;
  iv_context: IVContext | null;
  earnings: EarningsData | null;
  news: NewsBundle | null;
  prediction: PredictionResponse | null;

  // Error tracking for partial failures
  errors: Record<string, string>;
}

export const api = {
  /**
   * Fetch all core ticker data in a single request.
   * This avoids the browser's 6-connection limit by letting the backend
   * fetch everything in parallel.
   */
  tickerBundle: (ticker: string, period: string = "1y") =>
    getJSON<TickerBundleResponse>(
      `${BASE}/ticker/${encodeURIComponent(ticker)}?period=${period}`
    ),

  company: (ticker: string) =>
    getJSON<Company>(`${BASE}/companies/${encodeURIComponent(ticker)}`),

  // You can now type this correctly instead of <any>
  fundamentals: (ticker: string) =>
    getJSON<Fundamentals>(`${BASE}/fundamentals/${encodeURIComponent(ticker)}`),

  // === COMPS METHOD ===
  // Supports custom peer groups and ad-hoc peer lists
  // Sends auth headers when using peer_group_id (required by backend)
  comps: async (
    ticker: string,
    options?: {
      peer_group_id?: number;
      peers?: string[];
    }
  ): Promise<CompsResponse> => {
    const params = new URLSearchParams();
    if (options?.peer_group_id != null) {
      params.set("peer_group_id", String(options.peer_group_id));
    }
    if (options?.peers && options.peers.length > 0) {
      params.set("peers", options.peers.join(","));
    }
    const qs = params.toString();
    const url = `${BASE}/companies/${encodeURIComponent(ticker)}/comps${qs ? `?${qs}` : ""}`;

    // Include auth headers (required when using peer_group_id)
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  // ====================

  ownership: (ticker: string) =>
    getJSON<OwnershipEntry[]>(`${BASE}/ownership/${encodeURIComponent(ticker)}`),

  leadership: (ticker: string) =>
    getJSON<LeadershipMember[]>(`${BASE}/leadership/${encodeURIComponent(ticker)}`),

  prices: (ticker: string, period: string = "1y") =>
    getJSON<PriceEntry[]>(`${BASE}/prices/${encodeURIComponent(ticker)}?period=${period}`),

  /**
   * Fetch price history for a specific date range.
   * Used for infinite scroll / loading more historical data.
   */
  pricesByDateRange: (ticker: string, start: string, end: string) =>
    getJSON<PriceEntry[]>(
      `${BASE}/prices/${encodeURIComponent(ticker)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),

  financials: (ticker: string) =>
  getJSON<FinancialStatementsResponse>(
    `${BASE}/financials/${encodeURIComponent(ticker)}`
  ),

  analyzeFinancials: (ticker: string) =>
    postJSON<{ analysis: string; id: number | null }>(`${BASE}/financials/${encodeURIComponent(ticker)}/analyze`),

  prediction: (ticker: string) =>
    getJSON<PredictionResponse>(`${BASE}/predictions/${encodeURIComponent(ticker)}`),

  search: (query: string) =>
    getJSON<Array<{ symbol: string; name: string; exchange: string; type: string }>>(
      `${BASE}/search?q=${encodeURIComponent(query)}`
    ),

  insiderTrades: (ticker: string, limit: number = 50) =>
    getJSON<InsiderTrade[]>(`${BASE}/insider/${encodeURIComponent(ticker)}?limit=${limit}`),

  insiderSummary: (ticker: string) =>
    getJSON<InsiderSummary>(`${BASE}/insider/${encodeURIComponent(ticker)}/summary`),

  institutionalHolders: (ticker: string) =>
    getJSON<Holder[]>(`${BASE}/institutional/${encodeURIComponent(ticker)}`),

  institutionalFlow: (ticker: string) =>
    getJSON<InstitutionalFlow>(`${BASE}/institutional/${encodeURIComponent(ticker)}/flow`),
  // Add to the api object
    earnings: (ticker: string) =>
    getJSON<EarningsData>(`${BASE}/earnings/${encodeURIComponent(ticker)}`),

    earningsHistory: (ticker: string) =>
    getJSON<EarningsHistoryEntry[]>(`${BASE}/earnings/${encodeURIComponent(ticker)}/history`),

    upcomingEarnings: (tickers: string[], daysAhead: number = 14) =>
    fetch(`${BASE}/earnings/upcoming?days_ahead=${daysAhead}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tickers),
    }).then(res => res.json()),

    analyzeEarnings: (ticker: string) =>
      postJSON<EarningsAnalysisResponse>(
        `${BASE}/earnings-analysis/${encodeURIComponent(ticker)}/analyze`
      ),

    earningsAnalysisLatest: (ticker: string) =>
      getJSON<EarningsAnalysisResponse>(
        `${BASE}/earnings-analysis/${encodeURIComponent(ticker)}/latest`
      ),

    // Add to the api object
    optionsOverview: (ticker: string) =>
    getJSON<OptionsOverview>(`${BASE}/options/${encodeURIComponent(ticker)}`),

    optionsChain: (ticker: string, expiry: string) =>
    getJSON<Record<string, unknown>>(`${BASE}/options/${encodeURIComponent(ticker)}/chain/${encodeURIComponent(expiry)}`),

    news: (ticker: string) =>
        getJSON<NewsBundle>(`${BASE}/news/${encodeURIComponent(ticker)}`),
    risk: (ticker: string, period = "1y") =>
  getJSON<RiskBundle>(`${BASE}/risk/${encodeURIComponent(ticker)}?period=${period}`),

  riskAIAssessment: (ticker: string) =>
    getJSON<AIRiskAssessment>(`${BASE}/risk/${encodeURIComponent(ticker)}/ai-assessment`),

valuation: (ticker: string, params?: Partial<{growth:number;margin:number;tax:number;wacc:number;terminal_g:number;}>) => {
  const q = new URLSearchParams();
  if (params?.growth != null) q.set("growth", String(params.growth));
  if (params?.margin != null) q.set("margin", String(params.margin));
  if (params?.tax != null) q.set("tax", String(params.tax));
  if (params?.wacc != null) q.set("wacc", String(params.wacc));
  if (params?.terminal_g != null) q.set("terminal_g", String(params.terminal_g));
  const qs = q.toString();
  return getJSON<ValuationBundle>(`${BASE}/valuation/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ""}`);
},

valuationAISuggest: (ticker: string) =>
  postJSON<AISuggestion>(`${BASE}/valuation/${encodeURIComponent(ticker)}/ai-suggest`),


  congressTradeNotifications: (minAmount: number = 50000, days: number = 7, limit: number = 100) => {
    const q = new URLSearchParams();
    q.set("min_amount", String(minAmount));
    q.set("days", String(days));
    q.set("limit", String(limit));
    return getJSON<PoliticianTradeWithContext[]>(`${BASE}/notifications/congress-trades?${q.toString()}`);
  },

  politicianTrades: (ticker: string, limit: number = 50) =>
  getJSON<PoliticianTradeWithContext[]>(
    `${BASE}/politicians/${encodeURIComponent(ticker)}/politician-trades?limit=${limit}`
  ),

  politicianPerformance: (politicianId: number, windowDays: number = 30, n: number = 10) => {
  const q = new URLSearchParams();
  q.set("window_days", String(windowDays));
  q.set("n", String(n));
  return getJSON<PoliticianPerformance>(
    `${BASE}/politicians/${encodeURIComponent(String(politicianId))}/performance?${q.toString()}`
  );
},



    // jj
    /**
 * OPTION DECAY SIMULATOR API METHODS - V2 with IV Context
 * Add these to lib/api.ts
 */

// Add to imports at top of api.ts:

  /**
   * Get IV context for a ticker - helps users understand what IV to use
   * Returns ATM IV, IV percentile, HV, and suggested IV
   */
  ivContext: (ticker: string) =>
    getJSON<IVContext>(`${BASE}/options/${encodeURIComponent(ticker)}/iv-context`),

  /**
   * Get IV for a specific option contract
   * Auto-populates when user selects a strike
   */
  contractIV: (
    ticker: string,
    expiry: string,
    strike: number,
    optionType: "call" | "put" = "call"
  ) =>
    getJSON<ContractIVResponse>(
      `${BASE}/options/${encodeURIComponent(ticker)}/contract-iv/${encodeURIComponent(expiry)}/${strike}?option_type=${optionType}`
    ),

  /**
   * Run flat-price option decay simulation
   * Shows how theta erodes option value over time when stock doesn't move
   */
  optionDecaySimulation: (
    ticker: string,
    params: {
      stock_price: number;
      strike: number;
      days_to_expiry: number;
      implied_volatility: number; // decimal, e.g., 0.30 for 30%
      option_type: "call" | "put";
      risk_free_rate?: number;
    }
  ) => {
    const q = new URLSearchParams();
    q.set("stock_price", String(params.stock_price));
    q.set("strike", String(params.strike));
    q.set("days_to_expiry", String(params.days_to_expiry));
    q.set("implied_volatility", String(params.implied_volatility));
    q.set("option_type", params.option_type);
    if (params.risk_free_rate != null) {
      q.set("risk_free_rate", String(params.risk_free_rate));
    }
    
    return fetch(
      `${BASE}/options/${encodeURIComponent(ticker)}/decay-simulation?${q.toString()}`,
      { method: "POST" }
    ).then(res => {
      if (!res.ok) throw new Error("Simulation failed");
      return res.json() as Promise<OptionDecaySimulation>;
    });
  },

  /**
   * Get decay simulation for a specific contract (auto-fetches price/IV)
   */
  optionDecayForContract: (
    ticker: string,
    expiry: string,
    strike: number,
    optionType: "call" | "put" = "call"
  ) =>
    getJSON<OptionDecaySimulation>(
      `${BASE}/options/${encodeURIComponent(ticker)}/decay-simulation/${encodeURIComponent(expiry)}/${strike}?option_type=${optionType}`
    ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK SCREENER API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Run stock screener with filters
   */
  screener: (filters: ScreenerFilters = {}) => {
    const q = new URLSearchParams();
    if (filters.market_cap_min != null) q.set("market_cap_min", String(filters.market_cap_min));
    if (filters.market_cap_max != null) q.set("market_cap_max", String(filters.market_cap_max));
    if (filters.pe_ratio_min != null) q.set("pe_ratio_min", String(filters.pe_ratio_min));
    if (filters.pe_ratio_max != null) q.set("pe_ratio_max", String(filters.pe_ratio_max));
    if (filters.forward_pe_min != null) q.set("forward_pe_min", String(filters.forward_pe_min));
    if (filters.forward_pe_max != null) q.set("forward_pe_max", String(filters.forward_pe_max));
    if (filters.pb_ratio_min != null) q.set("pb_ratio_min", String(filters.pb_ratio_min));
    if (filters.pb_ratio_max != null) q.set("pb_ratio_max", String(filters.pb_ratio_max));
    if (filters.ev_to_ebitda_min != null) q.set("ev_to_ebitda_min", String(filters.ev_to_ebitda_min));
    if (filters.ev_to_ebitda_max != null) q.set("ev_to_ebitda_max", String(filters.ev_to_ebitda_max));
    if (filters.roe_min != null) q.set("roe_min", String(filters.roe_min));
    if (filters.roe_max != null) q.set("roe_max", String(filters.roe_max));
    if (filters.profit_margin_min != null) q.set("profit_margin_min", String(filters.profit_margin_min));
    if (filters.profit_margin_max != null) q.set("profit_margin_max", String(filters.profit_margin_max));
    if (filters.debt_to_equity_min != null) q.set("debt_to_equity_min", String(filters.debt_to_equity_min));
    if (filters.debt_to_equity_max != null) q.set("debt_to_equity_max", String(filters.debt_to_equity_max));
    if (filters.fcf_yield_min != null) q.set("fcf_yield_min", String(filters.fcf_yield_min));
    if (filters.fcf_yield_max != null) q.set("fcf_yield_max", String(filters.fcf_yield_max));
    if (filters.beta_min != null) q.set("beta_min", String(filters.beta_min));
    if (filters.beta_max != null) q.set("beta_max", String(filters.beta_max));
    if (filters.revenue_growth_min != null) q.set("revenue_growth_min", String(filters.revenue_growth_min));
    if (filters.revenue_growth_max != null) q.set("revenue_growth_max", String(filters.revenue_growth_max));
    if (filters.dividend_yield_min != null) q.set("dividend_yield_min", String(filters.dividend_yield_min));
    if (filters.dividend_yield_max != null) q.set("dividend_yield_max", String(filters.dividend_yield_max));
    if (filters.price_vs_200ma_min != null) q.set("price_vs_200ma_min", String(filters.price_vs_200ma_min));
    if (filters.price_vs_200ma_max != null) q.set("price_vs_200ma_max", String(filters.price_vs_200ma_max));
    if (filters.price_vs_52w_high_min != null) q.set("price_vs_52w_high_min", String(filters.price_vs_52w_high_min));
    if (filters.price_vs_52w_high_max != null) q.set("price_vs_52w_high_max", String(filters.price_vs_52w_high_max));
    if (filters.sectors) q.set("sectors", filters.sectors);
    if (filters.has_insider_buys_90d != null) q.set("has_insider_buys_90d", String(filters.has_insider_buys_90d));
    if (filters.insider_net_shares_90d_min != null) q.set("insider_net_shares_90d_min", String(filters.insider_net_shares_90d_min));
    if (filters.congress_net_value_90d_min != null) q.set("congress_net_value_90d_min", String(filters.congress_net_value_90d_min));
    if (filters.sort_by) q.set("sort_by", filters.sort_by);
    if (filters.sort_order) q.set("sort_order", filters.sort_order);
    if (filters.limit != null) q.set("limit", String(filters.limit));
    if (filters.offset != null) q.set("offset", String(filters.offset));
    const qs = q.toString();
    return getJSON<ScreenerResponse>(`${BASE}/screener${qs ? `?${qs}` : ""}`);
  },

  /**
   * Get live count of matching stocks (no results, just count)
   */
  screenerCount: (filters: ScreenerFilters = {}) => {
    const q = new URLSearchParams();
    if (filters.market_cap_min != null) q.set("market_cap_min", String(filters.market_cap_min));
    if (filters.market_cap_max != null) q.set("market_cap_max", String(filters.market_cap_max));
    if (filters.pe_ratio_min != null) q.set("pe_ratio_min", String(filters.pe_ratio_min));
    if (filters.pe_ratio_max != null) q.set("pe_ratio_max", String(filters.pe_ratio_max));
    if (filters.forward_pe_min != null) q.set("forward_pe_min", String(filters.forward_pe_min));
    if (filters.forward_pe_max != null) q.set("forward_pe_max", String(filters.forward_pe_max));
    if (filters.pb_ratio_min != null) q.set("pb_ratio_min", String(filters.pb_ratio_min));
    if (filters.pb_ratio_max != null) q.set("pb_ratio_max", String(filters.pb_ratio_max));
    if (filters.ev_to_ebitda_min != null) q.set("ev_to_ebitda_min", String(filters.ev_to_ebitda_min));
    if (filters.ev_to_ebitda_max != null) q.set("ev_to_ebitda_max", String(filters.ev_to_ebitda_max));
    if (filters.roe_min != null) q.set("roe_min", String(filters.roe_min));
    if (filters.roe_max != null) q.set("roe_max", String(filters.roe_max));
    if (filters.profit_margin_min != null) q.set("profit_margin_min", String(filters.profit_margin_min));
    if (filters.profit_margin_max != null) q.set("profit_margin_max", String(filters.profit_margin_max));
    if (filters.debt_to_equity_min != null) q.set("debt_to_equity_min", String(filters.debt_to_equity_min));
    if (filters.debt_to_equity_max != null) q.set("debt_to_equity_max", String(filters.debt_to_equity_max));
    if (filters.fcf_yield_min != null) q.set("fcf_yield_min", String(filters.fcf_yield_min));
    if (filters.fcf_yield_max != null) q.set("fcf_yield_max", String(filters.fcf_yield_max));
    if (filters.beta_min != null) q.set("beta_min", String(filters.beta_min));
    if (filters.beta_max != null) q.set("beta_max", String(filters.beta_max));
    if (filters.revenue_growth_min != null) q.set("revenue_growth_min", String(filters.revenue_growth_min));
    if (filters.revenue_growth_max != null) q.set("revenue_growth_max", String(filters.revenue_growth_max));
    if (filters.dividend_yield_min != null) q.set("dividend_yield_min", String(filters.dividend_yield_min));
    if (filters.dividend_yield_max != null) q.set("dividend_yield_max", String(filters.dividend_yield_max));
    if (filters.price_vs_200ma_min != null) q.set("price_vs_200ma_min", String(filters.price_vs_200ma_min));
    if (filters.price_vs_200ma_max != null) q.set("price_vs_200ma_max", String(filters.price_vs_200ma_max));
    if (filters.price_vs_52w_high_min != null) q.set("price_vs_52w_high_min", String(filters.price_vs_52w_high_min));
    if (filters.price_vs_52w_high_max != null) q.set("price_vs_52w_high_max", String(filters.price_vs_52w_high_max));
    if (filters.sectors) q.set("sectors", filters.sectors);
    if (filters.has_insider_buys_90d != null) q.set("has_insider_buys_90d", String(filters.has_insider_buys_90d));
    if (filters.insider_net_shares_90d_min != null) q.set("insider_net_shares_90d_min", String(filters.insider_net_shares_90d_min));
    if (filters.congress_net_value_90d_min != null) q.set("congress_net_value_90d_min", String(filters.congress_net_value_90d_min));
    const qs = q.toString();
    return getJSON<{ count: number; universe_total: number }>(`${BASE}/screener/count${qs ? `?${qs}` : ""}`);
  },

  /**
   * Get sector counts for filter UI
   */
  screenerSectors: () =>
    getJSON<Record<string, number>>(`${BASE}/screener/sectors`),

  /**
   * List saved screens for current user
   */
  listSavedScreens: (_ownerId: string) =>
    fetch(`${BASE}/screener/saved`, {
      headers: { ...getAuthHeaders() },
    }).then(res => {
      if (!res.ok) throw new Error("Failed to fetch saved screens");
      return res.json() as Promise<SavedScreen[]>;
    }),

  /**
   * Create a saved screen
   */
  createSavedScreen: (_ownerId: string, data: SavedScreenCreate) =>
    fetch(`${BASE}/screener/saved`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    }).then(res => {
      if (!res.ok) throw new Error("Failed to create saved screen");
      return res.json() as Promise<SavedScreen>;
    }),

  /**
   * Delete a saved screen
   */
  deleteSavedScreen: (_ownerId: string, screenId: number) =>
    fetch(`${BASE}/screener/saved/${screenId}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
    }).then(res => {
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete saved screen");
      return true;
    }),

  /**
   * Export screener results as Excel file
   * Returns a Blob that can be downloaded
   */
  screenerExportExcel: async (filters: ScreenerFilters = {}): Promise<Blob> => {
    const q = new URLSearchParams();
    if (filters.market_cap_min != null) q.set("market_cap_min", String(filters.market_cap_min));
    if (filters.market_cap_max != null) q.set("market_cap_max", String(filters.market_cap_max));
    if (filters.pe_ratio_min != null) q.set("pe_ratio_min", String(filters.pe_ratio_min));
    if (filters.pe_ratio_max != null) q.set("pe_ratio_max", String(filters.pe_ratio_max));
    if (filters.forward_pe_min != null) q.set("forward_pe_min", String(filters.forward_pe_min));
    if (filters.forward_pe_max != null) q.set("forward_pe_max", String(filters.forward_pe_max));
    if (filters.pb_ratio_min != null) q.set("pb_ratio_min", String(filters.pb_ratio_min));
    if (filters.pb_ratio_max != null) q.set("pb_ratio_max", String(filters.pb_ratio_max));
    if (filters.ev_to_ebitda_min != null) q.set("ev_to_ebitda_min", String(filters.ev_to_ebitda_min));
    if (filters.ev_to_ebitda_max != null) q.set("ev_to_ebitda_max", String(filters.ev_to_ebitda_max));
    if (filters.roe_min != null) q.set("roe_min", String(filters.roe_min));
    if (filters.roe_max != null) q.set("roe_max", String(filters.roe_max));
    if (filters.profit_margin_min != null) q.set("profit_margin_min", String(filters.profit_margin_min));
    if (filters.profit_margin_max != null) q.set("profit_margin_max", String(filters.profit_margin_max));
    if (filters.debt_to_equity_min != null) q.set("debt_to_equity_min", String(filters.debt_to_equity_min));
    if (filters.debt_to_equity_max != null) q.set("debt_to_equity_max", String(filters.debt_to_equity_max));
    if (filters.fcf_yield_min != null) q.set("fcf_yield_min", String(filters.fcf_yield_min));
    if (filters.fcf_yield_max != null) q.set("fcf_yield_max", String(filters.fcf_yield_max));
    if (filters.beta_min != null) q.set("beta_min", String(filters.beta_min));
    if (filters.beta_max != null) q.set("beta_max", String(filters.beta_max));
    if (filters.revenue_growth_min != null) q.set("revenue_growth_min", String(filters.revenue_growth_min));
    if (filters.revenue_growth_max != null) q.set("revenue_growth_max", String(filters.revenue_growth_max));
    if (filters.dividend_yield_min != null) q.set("dividend_yield_min", String(filters.dividend_yield_min));
    if (filters.dividend_yield_max != null) q.set("dividend_yield_max", String(filters.dividend_yield_max));
    if (filters.price_vs_200ma_min != null) q.set("price_vs_200ma_min", String(filters.price_vs_200ma_min));
    if (filters.price_vs_200ma_max != null) q.set("price_vs_200ma_max", String(filters.price_vs_200ma_max));
    if (filters.price_vs_52w_high_min != null) q.set("price_vs_52w_high_min", String(filters.price_vs_52w_high_min));
    if (filters.price_vs_52w_high_max != null) q.set("price_vs_52w_high_max", String(filters.price_vs_52w_high_max));
    if (filters.sectors) q.set("sectors", filters.sectors);
    if (filters.has_insider_buys_90d != null) q.set("has_insider_buys_90d", String(filters.has_insider_buys_90d));
    if (filters.insider_net_shares_90d_min != null) q.set("insider_net_shares_90d_min", String(filters.insider_net_shares_90d_min));
    if (filters.congress_net_value_90d_min != null) q.set("congress_net_value_90d_min", String(filters.congress_net_value_90d_min));
    if (filters.sort_by) q.set("sort_by", filters.sort_by);
    if (filters.sort_order) q.set("sort_order", filters.sort_order);
    const qs = q.toString();
    const url = `${BASE}/screener/export/excel${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(err.detail || "Export failed");
    }

    return res.blob();
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXCEL EXPORT API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Export ticker valuation as Excel file
   * Returns a Blob that can be downloaded
   */
  exportTickerToExcel: async (ticker: string, inputs: ExportInputs): Promise<Blob> => {
    const params = new URLSearchParams();
    if (inputs.growth != null) params.set("growth", String(inputs.growth));
    if (inputs.margin != null) params.set("margin", String(inputs.margin));
    if (inputs.wacc != null) params.set("wacc", String(inputs.wacc));
    if (inputs.tax != null) params.set("tax", String(inputs.tax));
    if (inputs.terminal_g != null) params.set("terminal_g", String(inputs.terminal_g));

    const queryString = params.toString();
    const url = `${BASE}/export/${encodeURIComponent(ticker)}/excel${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(err.detail || "Export failed");
    }

    return res.blob();
  },

  /**
   * Export financials as Excel file
   * Returns a Blob that can be downloaded
   */
  exportFinancialsToExcel: async (ticker: string): Promise<Blob> => {
    const url = `${BASE}/export/financials/${encodeURIComponent(ticker.toUpperCase())}/excel`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Export failed" }));
      throw new Error(err.detail || "Export failed");
    }

    return res.blob();
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CALENDAR API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get calendar events for specified tickers within date range
   */
  calendarEvents: (request: CalendarEventsRequest): Promise<CalendarEventsResponse> =>
    fetch(`${BASE}/calendar/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(request),
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      return res.json();
    }),

  // ═══════════════════════════════════════════════════════════════════════════════
  // PORTFOLIO PERFORMANCE API
  // ═══════════════════════════════════════════════════════════════════════════════

  portfolio: {
    /**
     * Get portfolio performance compared to benchmarks
     * Returns returns and sparklines for each period
     */
    getPerformance: async (
      positions: Array<{ ticker: string; shares: number; avg_cost: number }>,
      benchmarks?: string[]
    ): Promise<PortfolioPerformanceResponse> => {
      const res = await fetch(`${BASE}/portfolio/performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          positions,
          benchmarks: benchmarks || ["SPY", "QQQ", "GLD", "BTC-USD"],
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch portfolio performance");
      }
      return res.json();
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHART DRAWINGS API
  // ═══════════════════════════════════════════════════════════════════════════════

  drawings: {
    /**
     * List all drawings for a ticker
     */
    list: async (ticker: string, includeHidden = false): Promise<ChartDrawingList> => {
      const params = new URLSearchParams();
      if (includeHidden) params.set("include_hidden", "true");
      const qs = params.toString();
      const res = await fetch(
        `${BASE}/drawings/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ""}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) {
        throw new ApiError(await res.text(), res.status);
      }
      return res.json();
    },

    /**
     * Create a new drawing
     */
    create: async (data: ChartDrawingCreate): Promise<ChartDrawing> => {
      const res = await fetch(`${BASE}/drawings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new ApiError(await res.text(), res.status);
      }
      return res.json();
    },

    /**
     * Update a drawing (with optimistic concurrency)
     */
    update: async (id: number, data: ChartDrawingUpdate): Promise<ChartDrawing> => {
      const res = await fetch(`${BASE}/drawings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new ApiError(await res.text(), res.status);
      }
      return res.json();
    },

    /**
     * Delete a single drawing (soft delete)
     */
    delete: async (id: number): Promise<void> => {
      const res = await fetch(`${BASE}/drawings/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        throw new ApiError(await res.text(), res.status);
      }
    },

    /**
     * Delete all drawings for a ticker (soft delete)
     */
    deleteAll: async (ticker: string): Promise<{ deleted: number }> => {
      const res = await fetch(`${BASE}/drawings/${encodeURIComponent(ticker)}/all`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new ApiError(await res.text(), res.status);
      }
      return res.json();
    },

    /**
     * Batch create multiple drawings
     */
    batchCreate: async (data: BatchDrawingCreate): Promise<BatchDrawingResponse> => {
      const res = await fetch(`${BASE}/drawings/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new ApiError(await res.text(), res.status);
      }
      return res.json();
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE COMPANIES API (IPO Exposure Tracker)
  // ═══════════════════════════════════════════════════════════════════════════════

  privateCompanies: (filters?: { status?: string; sector?: string }) => {
    const q = new URLSearchParams();
    if (filters?.status) q.set("status", filters.status);
    if (filters?.sector) q.set("sector", filters.sector);
    const qs = q.toString();
    return getJSON<PrivateCompanySummary[]>(`${BASE}/private-companies${qs ? `?${qs}` : ""}`);
  },

  privateCompany: (slug: string) =>
    getJSON<PrivateCompanyProfile>(`${BASE}/private-companies/${encodeURIComponent(slug)}`),

  createPrivateCompany: async (data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/private-companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<PrivateCompanyProfile>;
  },

  addPrivateCompanyInvestor: async (slug: string, data: Record<string, unknown>) => {
    const res = await fetch(`${BASE}/private-companies/${encodeURIComponent(slug)}/investors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVESTMENT MEMO API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate an investment memo via SSE streaming.
   * Uses fetch() + ReadableStream (not EventSource, because POST + auth headers).
   * Returns an AbortController for cancellation.
   */
  generateMemo: (
    ticker: string,
    onChunk: (text: string) => void,
    onDone: (savedId: number | null) => void,
    onError: (error: string) => void,
  ): AbortController => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${BASE}/memo/${encodeURIComponent(ticker)}`, {
          method: "POST",
          headers: getAuthHeaders(),
          signal: controller.signal,
        });

        if (!res.ok) {
          handleResponseError(res);
          const body = await res.json().catch(() => ({ detail: "Memo generation failed" }));
          onError(body.detail || body.message || `Error ${res.status}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onError("No response stream");
          return;
        }

        const decoder = new TextDecoder();
        let savedId: number | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Buffer partial reads — ReadableStream chunks don't align with SSE boundaries
          buffer += decoder.decode(value, { stream: true });

          // SSE events are terminated by "\n\n" — only process complete ones
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // last element may be incomplete

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);

              if (payload === "[DONE]") {
                onDone(savedId);
                return;
              }
              if (payload.startsWith("[SAVED:")) {
                const idStr = payload.slice(7, -1);
                savedId = parseInt(idStr, 10) || null;
                continue;
              }
              if (payload.startsWith("[ERROR]")) {
                onError(payload.slice(8));
                return;
              }
              // Chunks are JSON-encoded to preserve newlines
              try {
                onChunk(JSON.parse(payload));
              } catch {
                onChunk(payload);
              }
            }
          }
        }

        onDone(savedId);
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          onError(e.message || "Connection lost");
        } else if (!(e instanceof Error)) {
          onError("Connection lost");
        }
      }
    })();

    return controller;
  },

  memoHistory: (ticker: string, limit: number = 20) =>
    getJSON<MemoSummary[]>(
      `${BASE}/memo/${encodeURIComponent(ticker)}/history?limit=${limit}`
    ),

  memoDetail: (memoId: number) =>
    getJSON<MemoDetail>(`${BASE}/memo/detail/${memoId}`),

  // ═══════════════════════════════════════════════════════════════════════════════
  // AI HISTORY API
  // ═══════════════════════════════════════════════════════════════════════════════

  aiHistory: {
    list: (type?: string, limit = 50, offset = 0) => {
      const q = new URLSearchParams();
      if (type) q.set("type", type);
      q.set("limit", String(limit));
      q.set("offset", String(offset));
      return getJSON<AIHistoryItem[]>(`${BASE}/ai-history?${q.toString()}`);
    },

    detail: (id: number) =>
      getJSON<AIHistoryDetail>(`${BASE}/ai-history/${id}`),

    stats: () =>
      getJSON<AIHistoryStats>(`${BASE}/ai-history/stats`),
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // AI RESEARCH ASSISTANT API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if the AI assistant is available (has API key configured).
   */
  assistantStatus: () =>
    getJSON<{ available: boolean }>(`${BASE}/assistant/status`),

  /**
   * Send a query to the AI assistant via SSE streaming.
   * Matches the generateMemo pattern: fetch + ReadableStream + SSE parsing.
   * Returns an AbortController for cancellation.
   */
  /**
   * Log a session event (fire-and-forget, never blocks UI).
   */
  sessionEvent: (sessionId: string, eventType: string, eventData: Record<string, unknown> = {}) => {
    fetch(`${BASE}/session/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: eventType,
        event_data: eventData,
      }),
    }).catch(() => {}); // fire-and-forget
  },

  assistantQuery: (
    query: string,
    currentTicker: string | null,
    conversationHistory: Array<{ role: string; content: string }>,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
    sessionId?: string,
  ): AbortController => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${BASE}/assistant/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            query,
            current_ticker: currentTicker,
            conversation_history: conversationHistory,
            session_id: sessionId || null,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          handleResponseError(res);
          const body = await res.json().catch(() => ({ detail: "Assistant query failed" }));
          onError(body.detail || body.message || `Error ${res.status}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onError("No response stream");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);

              if (payload === "[DONE]") {
                onDone();
                return;
              }
              if (payload.startsWith("[ERROR]")) {
                onError(payload.slice(8));
                return;
              }
              try {
                onChunk(JSON.parse(payload));
              } catch {
                onChunk(payload);
              }
            }
          }
        }

        onDone();
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          onError(e.message || "Connection lost");
        } else if (!(e instanceof Error)) {
          onError("Connection lost");
        }
      }
    })();

    return controller;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONGRESS BACKTEST API
  // ═══════════════════════════════════════════════════════════════════════════════

  politicianLeaderboard: (
    delayDays = 3,
    holdDays = 30,
    opts?: { minTrades?: number; chamber?: string; party?: string; sinceYear?: number }
  ) => {
    const q = new URLSearchParams();
    q.set("delay_days", String(delayDays));
    q.set("hold_days", String(holdDays));
    if (opts?.minTrades != null) q.set("min_trades", String(opts.minTrades));
    if (opts?.chamber) q.set("chamber", opts.chamber);
    if (opts?.party) q.set("party", opts.party);
    if (opts?.sinceYear != null) q.set("since_year", String(opts.sinceYear));
    return getJSON<LeaderboardResponse>(`${BASE}/politicians/leaderboard?${q.toString()}`, 120_000);
  },

  politicianBacktest: (politicianId: number, delayDays = 3, holdDays = 30, sinceYear?: number) => {
    const q = new URLSearchParams();
    q.set("delay_days", String(delayDays));
    q.set("hold_days", String(holdDays));
    if (sinceYear != null) q.set("since_year", String(sinceYear));
    return getJSON<BacktestResponse>(`${BASE}/politicians/${politicianId}/backtest?${q.toString()}`);
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FORWARD RETURNS API
  // ═══════════════════════════════════════════════════════════════════════════════

  forwardReturns: (params: {
    ticker?: string;
    direction?: string;
    actor_name?: string;
    date_from?: string;
    date_to?: string;
    has_returns?: boolean;
    sort_by?: string;
    sort_dir?: string;
    page?: number;
    page_size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.ticker) q.set("ticker", params.ticker);
    if (params.direction) q.set("direction", params.direction);
    if (params.actor_name) q.set("actor_name", params.actor_name);
    if (params.date_from) q.set("date_from", params.date_from);
    if (params.date_to) q.set("date_to", params.date_to);
    if (params.has_returns != null) q.set("has_returns", String(params.has_returns));
    if (params.sort_by) q.set("sort_by", params.sort_by);
    if (params.sort_dir) q.set("sort_dir", params.sort_dir);
    if (params.page != null) q.set("page", String(params.page));
    if (params.page_size != null) q.set("page_size", String(params.page_size));
    const qs = q.toString();
    return getJSON<ForwardReturnsResponse>(`${BASE}/events/forward-returns${qs ? `?${qs}` : ""}`);
  },

  eventStats: (params: { ticker?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.ticker) q.set("ticker", params.ticker);
    const qs = q.toString();
    return getJSON<EventStatsResponse>(`${BASE}/events/stats${qs ? `?${qs}` : ""}`);
  },

  eventSummary: (params?: { window?: number; direction?: string; actor_id?: number; ticker?: string }) => {
    const q = new URLSearchParams();
    if (params?.window != null) q.set("window", String(params.window));
    if (params?.direction) q.set("direction", params.direction);
    if (params?.actor_id != null) q.set("actor_id", String(params.actor_id));
    if (params?.ticker) q.set("ticker", params.ticker);
    const qs = q.toString();
    return getJSON<EventSummaryResponse>(`${BASE}/events/summary${qs ? `?${qs}` : ""}`);
  },

  signalRanking: (params?: { window?: number; since?: string }) => {
    const q = new URLSearchParams();
    if (params?.window != null) q.set("window", String(params.window));
    if (params?.since) q.set("since", params.since);
    const qs = q.toString();
    return getJSON<SignalRankingResponse>(`${BASE}/signals/ranked${qs ? `?${qs}` : ""}`);
  },
};

