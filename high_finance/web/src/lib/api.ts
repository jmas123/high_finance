// 1. Update your imports to include CompsResponse
import type {
  Company,
  Fundamentals,
  Ownership,
  Leadership,
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
} from "./types";
// import type { OptionDecaySimulation, IVContext, ContractIVResponse } from "./types";

const BASE = "/api/v1";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  company: (ticker: string) =>
    getJSON<Company>(`${BASE}/companies/${encodeURIComponent(ticker)}`),

  // You can now type this correctly instead of <any>
  fundamentals: (ticker: string) =>
    getJSON<Fundamentals>(`${BASE}/fundamentals/${encodeURIComponent(ticker)}`),

  // === NEW COMPS METHOD ===
  // This assumes you added the route GET /api/v1/companies/{ticker}/comps in your backend
  comps: (ticker: string) =>
    getJSON<CompsResponse>(`${BASE}/companies/${encodeURIComponent(ticker)}/comps`),
  // ========================

  ownership: (ticker: string) =>
    getJSON<any>(`${BASE}/ownership/${encodeURIComponent(ticker)}`),

  leadership: (ticker: string) =>
    getJSON<any>(`${BASE}/leadership/${encodeURIComponent(ticker)}`),

  prices: (ticker: string, period: string = "1y") =>
    getJSON<any[]>(`${BASE}/prices/${encodeURIComponent(ticker)}?period=${period}`),

  financials: (ticker: string) =>
  getJSON<FinancialStatementsResponse>(
    `${BASE}/financials/${encodeURIComponent(ticker)}`
  ),

  analyzeFinancials: (ticker: string) =>
    postJSON<{ analysis: string }>(`${BASE}/financials/${encodeURIComponent(ticker)}/analyze`),

  prediction: (ticker: string) =>
    getJSON<any>(`${BASE}/predictions/${encodeURIComponent(ticker)}`),

  search: (query: string) =>
    getJSON<Array<{ symbol: string; name: string; exchange: string; type: string }>>(
      `${BASE}/search?q=${encodeURIComponent(query)}`
    ),

  insiderTrades: (ticker: string, limit: number = 50) =>
    getJSON<any[]>(`${BASE}/insider/${encodeURIComponent(ticker)}?limit=${limit}`),

  insiderSummary: (ticker: string) =>
    getJSON<any>(`${BASE}/insider/${encodeURIComponent(ticker)}/summary`),

  institutionalHolders: (ticker: string) =>
    getJSON<any[]>(`${BASE}/institutional/${encodeURIComponent(ticker)}`),

  institutionalFlow: (ticker: string) =>
    getJSON<any>(`${BASE}/institutional/${encodeURIComponent(ticker)}/flow`),
  // Add to the api object
    earnings: (ticker: string) =>
    getJSON<any>(`${BASE}/earnings/${encodeURIComponent(ticker)}`),

    earningsHistory: (ticker: string) =>
    getJSON<any[]>(`${BASE}/earnings/${encodeURIComponent(ticker)}/history`),

    upcomingEarnings: (tickers: string[], daysAhead: number = 14) =>
    fetch(`${BASE}/earnings/upcoming?days_ahead=${daysAhead}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tickers),
    }).then(res => res.json()),

    // Add to the api object
    optionsOverview: (ticker: string) =>
    getJSON<any>(`${BASE}/options/${encodeURIComponent(ticker)}`),

    optionsChain: (ticker: string, expiry: string) =>
    getJSON<any>(`${BASE}/options/${encodeURIComponent(ticker)}/chain/${encodeURIComponent(expiry)}`),

    news: (ticker: string) =>
        getJSON<NewsBundle>(`${BASE}/news/${encodeURIComponent(ticker)}`),
    risk: (ticker: string, period = "1y") =>
  getJSON<RiskBundle>(`${BASE}/risk/${encodeURIComponent(ticker)}?period=${period}`),

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


  congressTradeNotifications: (minAmount: number = 50000, days: number = 7, limit: number = 100) => {
    const q = new URLSearchParams();
    q.set("min_amount", String(minAmount));
    q.set("days", String(days));
    q.set("limit", String(limit));
    return getJSON<any[]>(`${BASE}/notifications/congress-trades?${q.toString()}`);
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
   * Get sector counts for filter UI
   */
  screenerSectors: () =>
    getJSON<Record<string, number>>(`${BASE}/screener/sectors`),

  /**
   * List saved screens for current user
   */
  listSavedScreens: (ownerId: string) =>
    fetch(`${BASE}/screener/saved`, {
      headers: { "X-Owner-Id": ownerId },
    }).then(res => {
      if (!res.ok) throw new Error("Failed to fetch saved screens");
      return res.json() as Promise<SavedScreen[]>;
    }),

  /**
   * Create a saved screen
   */
  createSavedScreen: (ownerId: string, data: SavedScreenCreate) =>
    fetch(`${BASE}/screener/saved`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Owner-Id": ownerId,
      },
      body: JSON.stringify(data),
    }).then(res => {
      if (!res.ok) throw new Error("Failed to create saved screen");
      return res.json() as Promise<SavedScreen>;
    }),

  /**
   * Delete a saved screen
   */
  deleteSavedScreen: (ownerId: string, screenId: number) =>
    fetch(`${BASE}/screener/saved/${screenId}`, {
      method: "DELETE",
      headers: { "X-Owner-Id": ownerId },
    }).then(res => {
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete saved screen");
      return true;
    }),
};

