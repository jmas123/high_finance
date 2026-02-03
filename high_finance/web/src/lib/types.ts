// Re-export project types for backwards compatibility
export type { ProjectSummary } from "../components/project/types";

export type Company = {
  id: number;
  name: string;
  ticker: string;
  sector?: string | null;
  industry?: string | null;
};

export type Ownership = any;
export type Leadership = any;
export type Politician = {
  id: number;
  name: string;
  chamber?: string | null;
  state?: string | null;
  district?: string | null;
  party?: string | null;
  hit_rate?: number | null;  // Win rate as decimal (0-1), e.g. 0.65 = 65%
  avg_return_pct?: number | null;  // Average return percentage
};

export type PoliticianTrade = {
  id: number;
  politician_id: number;
  politician?: Politician | null;
  company_id: number | null;
  issuer_raw: string | null;
  ticker_raw: string | null;
  transaction_date: string | null;
  disclosure_date: string;
  transaction_type: string | null;
  amount_min: number | null;
  amount_max: number | null;
  source_url: string | null;
};

// Keep this only if/when backend returns wrapped shape later
export type PoliticianTradeWithPolitician = {
  trade: PoliticianTrade;
  politician?: {
    id: number;
    name: string;
    chamber?: string | null;
    state?: string | null;
    district?: string | null;
    party?: string | null;
    bioguide_id?: string | null;
    hit_rate?: number | null;  // Win rate as decimal (0-1)
    avg_return_pct?: number | null;  // Average return percentage
  } | null;
};

export type CompTemplate = {
  label: string;
  metrics: string[];
};


export type CompsResponse = {
  target: Fundamentals;
  peers: Fundamentals[];

  template: CompTemplate;
  averages: Record<string, number | null>;

  // legacy fields (can stay optional)
  average_pe?: number | null;
  average_ev_ebitda?: number | null;
};

export type StatementTable = Record<string, Record<string, number>>;

export type FinancialStatementsPeriod = {
  income_statement: StatementTable;
  balance_sheet: StatementTable;
  cash_flow: StatementTable;
};

export type FinancialStatementsResponse = {
  annual: FinancialStatementsPeriod;
  quarterly: FinancialStatementsPeriod;
};

export type NewsHeadline = {
  title: string;
  url: string | null;
  published: string | null;
  source: string | null;
  sentiment: { compound: number; pos: number; neu: number; neg: number };
};

export type NewsBundle = {
  ticker: string;
  avg_headline_sentiment: number | null;
  headlines: NewsHeadline[];
  filings: any[];
  x_posts: any[];
};





export const thBase: React.CSSProperties = {
  padding: "10px 8px",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  color: "#888",
  borderBottom: "1px solid #333",
  whiteSpace: "nowrap",
};

export const tdBase: React.CSSProperties = {
  padding: "10px 8px",
  fontFamily: "monospace",
  whiteSpace: "nowrap",
};

export const left = { textAlign: "left" as const };
export const right = { textAlign: "right" as const };


// Enhanced Risk Types
// Add these to your existing types.ts file

export type RiskMetrics = {
  daily_mean_return: number;
  daily_volatility: number;
  daily_volatility_adjusted: number;
  annualized_volatility: number;
  annualized_volatility_adjusted: number;
  max_drawdown: number;
  var_95_1d: number;
  var_99_1d: number;
};

export type FanPoint = {
  day: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
};

export type EarningsParams = {
  avg_earnings_move: number;
  max_earnings_move: number;
  direction_bias: number;
  n_observations: number;
  implied_vol_multiplier: number;
};

export type MonteCarlo = {
  horizon_days: number;
  n_sims: number;
  vol_multiplier: number;
  include_earnings_shock: boolean;
  earnings_params: EarningsParams | null;
  fan: FanPoint[];
};

export type Probabilities = {
  prob_positive_return: number;
  prob_above_5pct: number;
  prob_above_10pct: number;
  prob_above_20pct: number;
  prob_below_minus_5pct: number;
  prob_below_minus_10pct: number;
  prob_below_minus_20pct: number;
  prob_touches_ath_plus_10pct: number;
  prob_drawdown_exceeds_threshold: number;
  prob_above_target: number;
  target_price_used: number;
  drawdown_threshold_used: number;
};

// In risk_types.ts - keep this as-is
export type Scenarios = {
  stress_p5: number;    // 5th percentile return
  stress_p10: number;   // 10th percentile return
  base_p50: number;     // median return
  bull_p90: number;     // 90th percentile return
  bull_p95: number;     // 95th percentile return
  mean: number;
  std: number;
};

export type DistributionBin = {
  return_min: number;
  return_max: number;
  count: number;
  probability: number;
};

export type ExpectedPrices = {
  mean: number;
  median: number;
  std: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
};

// Replace your existing RiskBundle with this enhanced version
export type RiskBundle = {
  ticker: string;
  as_of_close: number;
  period_used: string;
  metrics: RiskMetrics;
  monte_carlo: MonteCarlo;
  probabilities: Probabilities;
  scenarios: Scenarios;
  distribution: DistributionBin[];
  expected_prices: ExpectedPrices;
  error?: string;
};

// Enhanced Valuation Types
// Merge into your existing types.ts








export type ScenarioResult = {
  inputs: {
    growth: number;
    margin: number;
    tax: number;
    wacc: number;
    terminal_g: number;
  };
  enterprise_value: number;
  equity_value: number;
  fair_value_per_share: number;
};





// In valuation_types.ts - add this separately
export type ValuationScenario = {
  inputs: {
    growth: number;
    margin: number;
    tax: number;
    wacc: number;
    terminal_g: number;
  };
  enterprise_value: number;
  equity_value: number;
  fair_value_per_share: number;
};





// check 
// Enhanced Valuation Types
// Replace your existing valuation types in types.ts

export type DCFResult = {
  years: number;
  fcff_projection: number[];
  pv_explicit: number;
  pv_terminal: number;
  enterprise_value: number;
  terminal_value: number;
  terminal_pct_of_ev: number;
};

export type SensitivityItem = {
  param: string;
  label: string;
  base_value: number;
  low_value: number;
  high_value: number;
  fv_at_low: number;
  fv_at_high: number;
  fv_base: number;
  impact_low: number;
  impact_high: number;
  impact_range: number;
};

export type SensitivityAnalysis = {
  base_fair_value: number;
  sensitivities: SensitivityItem[];
  error?: string;
};

export type MultiplesMethodValue = {
  method: string;
  multiple: number;
  fair_value: number;
};

export type MultiplesValuation = {
  ev_revenue: {
    multiple_used: number;
    implied_ev: number;
    implied_equity: number;
    implied_fv_per_share: number;
  } | null;
  ev_ebitda: {
    multiple_used: number;
    implied_ev: number;
    implied_equity: number;
    implied_fv_per_share: number;
  } | null;
  pe_based: {
    multiple_used: number;
    eps: number;
    implied_fv_per_share: number;
  } | null;
  implied_values: MultiplesMethodValue[];
  multiples_summary?: {
    min: number;
    max: number;
    avg: number;
    sector: string;
    industry: string;
  };
};

export type ValuationScenarioInputs = {
  growth: number;
  margin: number;
  tax: number;
  wacc: number;
  terminal_g: number;
};

export type ValuationScenarioResult = {
  inputs: ValuationScenarioInputs;
  enterprise_value: number;
  equity_value: number;
  fair_value_per_share: number;
};

export type ValuationScenarios = {
  bear: ValuationScenarioResult;
  base: ValuationScenarioResult;
  bull: ValuationScenarioResult;
  error?: string;
};

export type FairValueRange = {
  low: number;
  mid: number;
  high: number;
  dcf_base: number | null;
};

export type UpsideDownside = {
  current_price: number;
  fair_value: number;
  upside_pct: number;
  absolute_diff: number;
};

// Smart defaults with source info
export type SmartDefaultsGrowth = {
  suggested: number;
  historical_3y: number | null;
  historical_1y: number | null;
  analyst_estimate: number | null;
  sector_median: number;
  sector_p25: number;
  sector_p75: number;
  source: string;
};

export type SmartDefaultsMargin = {
  suggested: number;
  current: number | null;
  historical_avg: number | null;
  sector_median: number;
  sector_p25: number;
  sector_p75: number;
  source: string;
};

export type SmartDefaultsWACC = {
  suggested: number;
  beta_implied: number | null;
  beta: number | null;
  source: string;
};

export type SmartDefaultsTax = {
  suggested: number;
  effective_rate: number | null;
  source: string;
};

export type SmartDefaultsTerminalG = {
  suggested: number;
  source: string;
};

export type SmartDefaults = {
  growth: SmartDefaultsGrowth;
  margin: SmartDefaultsMargin;
  wacc: SmartDefaultsWACC;
  tax: SmartDefaultsTax;
  terminal_g: SmartDefaultsTerminalG;
};

// Assumption warnings
export type ValuationWarning = {
  param: string;
  level: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion: string | null;
};

// Sector benchmarks
export type SectorBenchmarks = {
  sector: string;
  industry: string | null;
  growth: {
    p25: number;
    median: number;
    p75: number;
    p90: number;
  };
  margin: {
    p25: number;
    median: number;
    p75: number;
    p90: number;
  };
};

// Analyst consensus
export type AnalystConsensus = {
  target_mean: number | null;
  target_low: number | null;
  target_high: number | null;
  target_median: number | null;
  num_analysts: number | null;
  recommendation: string | null;
  recommendation_mean: number | null;
};

// Implied assumptions (what market is pricing in)
export type ImpliedAssumptions = {
  implied_growth: number | null;
  implied_margin: number | null;
  implied_wacc: number | null;
  primary_driver: "growth" | "margin" | "wacc" | null;
  solver_converged: boolean;
  error?: string;
};

// Divergence analysis (trust transparency)
export type DivergenceAnalysis = {
  divergence_pct: number;
  divergence_tier: "normal" | "notable" | "extreme";
  explanation: string | null;
  implied_assumptions: ImpliedAssumptions;
};

// Complete enhanced ValuationBundle
export type ValuationBundle = {
  ticker: string;
  inputs: ValuationScenarioInputs;
  smart_defaults: SmartDefaults;
  warnings: ValuationWarning[];
  benchmarks: SectorBenchmarks;
  facts: {
    revenue0: number;
    ebitda: number | null;
    net_income: number | null;
    net_debt_est: number;
    shares_outstanding: number | null;
    current_price: number | null;
    sector: string | null;
    industry: string | null;
  };
  dcf: DCFResult;
  equity_value_est: number;
  fair_value_per_share_est: number | null;
  upside_downside: UpsideDownside | null;
  sensitivity: SensitivityAnalysis;
  multiples: MultiplesValuation;
  scenarios: ValuationScenarios;
  fair_value_range: FairValueRange | null;
  analyst_consensus: AnalystConsensus;
  divergence_analysis: DivergenceAnalysis | null;
  error?: string;
};

// src/styles/tooltip.ts
export const TOOLTIP_STYLE = {
  background: "#0a0a0a",
  border: "2px solid #3b82f6",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#ffffff",
  boxShadow: "0 8px 32px rgba(0,0,0,0.9)",
};

export type SliderReference = {
  value: number;
  label: string;
  color: string;
};
export type Warning = {
  param: string;
  level: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion: string | null;
};

export type TradeContextReason = { type: string; title: string; detail: string };
export type TradeContext = { relevance_score: number; relevance_label: string; reasons: TradeContextReason[] };



export type PoliticianTradeWithContext = {
  trade: PoliticianTrade;
  politician: Politician;
  context: TradeContext;
};

export type PoliticianPerformance = {
  window_days: number;
  n: number;
  num_used: number;
  avg_return_pct: number | null;
  hit_rate: number | null;
};

/**
 * OPTION DECAY SIMULATOR TYPES
 * Add these to lib/types.ts
 */




// hello
/**
 * OPTION DECAY SIMULATOR TYPES - V2 with IV Context
 * Add these to lib/types.ts
 */

// ===== IV CONTEXT TYPES =====

export type IVByExpiry = {
  expiry: string;
  days: number;
  atm_iv: number;
  atm_iv_pct: number;
  atm_strike: number;
};

export type IVContext = {
  atm_iv: number | null;
  iv_percentile: number | null;
  iv_high_52w: number | null;
  iv_low_52w: number | null;
  hv_20: number | null;
  hv_60: number | null;
  suggested_iv: number;
  iv_by_expiry: IVByExpiry[];
};

export type ContractIVResponse = {
  strike: number;
  iv: number | null;
  iv_pct: number | null;
  bid: number;
  ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  error?: string;
};

// ===== DECAY SIMULATION TYPES =====

export type DecayCurvePoint = {
  day: number;
  days_remaining: number;
  price: number;
  theta: number;
  delta: number;
  decay_from_start: number;
  decay_pct: number;
  extrinsic_remaining: number;
};

export type OptionGreeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

export type DecaySimulationInputs = {
  stock_price: number;
  strike: number;
  days_to_expiry: number;
  implied_volatility_pct: number;
  option_type: "call" | "put";
  risk_free_rate_pct: number;
};

export type CurrentOptionValues = {
  option_price: number;
  intrinsic_value: number;
  extrinsic_value: number;
  moneyness: "ITM" | "ATM" | "OTM";
};

export type DecaySummary = {
  initial_price: number;
  final_price: number;
  total_decay_dollars: number;
  total_decay_pct: number;
  extrinsic_decay_pct: number;
  avg_daily_decay: number;
  current_daily_theta: number;
};

export type DecayMilestone = {
  days_remaining: number;
  price: number;
  decay_pct: number;
};

export type DecayInterpretation = {
  favors: "buyers" | "sellers" | "neutral";
  favors_explanation: string;
  strategy_hint: string;
  time_decay_intensity: "very_short" | "short" | "medium" | "long";
  time_description: string;
  iv_environment: "very_high" | "high" | "normal" | "low";
  iv_description: string;
  total_decay_pct: number;
  key_insight: string;
};

export type OptionDecaySimulation = {
  ticker: string;
  inputs: DecaySimulationInputs;
  current_values: CurrentOptionValues;
  greeks: OptionGreeks;
  decay_summary: DecaySummary;
  milestones: {
    at_25pct_time_elapsed: DecayMilestone;
    at_50pct_time_elapsed: DecayMilestone;
    at_75pct_time_elapsed: DecayMilestone;
  };
  decay_curve: DecayCurvePoint[];
  interpretation: DecayInterpretation;
};

export type DecaySimulationParams = {
  stock_price: number;
  strike: number;
  days_to_expiry: number;
  implied_volatility: number;
  option_type: "call" | "put";
  risk_free_rate?: number;
};
/**
 * ETF & Asset Type Detection - Add to lib/types.ts
 */

// Update your existing Fundamentals type to include these fields:
export type Fundamentals = {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  current_price?: number | null;
   price_change?: number | null;
  price_change_pct?: number | null; // percent, e.g. 1.23 means 1.23%

  // Asset type detection
  quote_type?: string | null;  // "ETF" | "EQUITY" | "MUTUALFUND" | "INDEX"
  is_etf?: boolean;
  is_mutual_fund?: boolean;
  is_index?: boolean;

  // Stock metrics
  market_cap?: number | null;
  pe_ratio?: number | null;
  forward_pe?: number | null;
  ev_to_ebitda?: number | null;
  ev_to_sales?: number | null;
  pb_ratio?: number | null;
  roe?: number | null;
  revenue_growth?: number | null;
  gross_margins?: number | null;
  dividend_yield?: number | null;
  eps?: number | null;
  profit_margin?: number | null;
  beta?: number | null;
  revenue?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  fifty_day_avg?: number | null;
  two_hundred_day_avg?: number | null;
  comp_template?: CompTemplate | null;

  // ETF-specific metrics
  total_assets?: number | null;      // AUM
  nav_price?: number | null;
  expense_ratio?: number | null;     // e.g., 0.0003 = 0.03%
  yield?: number | null;             // Distribution yield
  ytd_return?: number | null;
  three_year_return?: number | null;
  five_year_return?: number | null;
  category?: string | null;          // e.g., "Large Blend"
  fund_family?: string | null;       // e.g., "Vanguard"
  holdings_count?: number | null;
};


// Market Context Types

export interface MacroIndicator {
  name: string;
  value: number;
  previous_value: number;
  change: number;
  change_pct: number;
  unit: string;
  last_updated: string;
  trend: 'up' | 'down' | 'stable';
  impact_description: string;
}

export interface MacroSummary {
  rate_environment: 'restrictive' | 'accommodative' | 'neutral';
  inflation_trend: 'cooling' | 'heating' | 'stable';
  yield_curve: 'inverted' | 'normal' | 'flat';
  market_volatility: 'low' | 'elevated' | 'high';
}

export interface MacroResponse {
  indicators: MacroIndicator[];
  summary: MacroSummary;
}

export interface TopMover {
  symbol: string;
  change: number;
}

export interface SectorPerformance {
  sector: string;
  ticker: string;
  performance_1d: number;
  performance_1w: number;
  performance_1m: number;
  performance_ytd: number;
  volume_vs_avg: number;
  market_cap_billions: number;
  top_movers: TopMover[];
}

export interface SectorBreadth {
  positive: number;
  negative: number;
  unchanged: number;
}

export interface SectorResponse {
  sectors: SectorPerformance[];
  market_leader: string | null;
  market_laggard: string | null;
  breadth: SectorBreadth;
}

export interface RateImpactAnalysis {
  sector: string;
  sensitivity: 'high' | 'medium' | 'low';
  correlation_to_rates: number;
  impact_direction: 'positive' | 'negative' | 'neutral';
  explanation: string;
  historical_performance_rising_rates: number;
  historical_performance_falling_rates: number;
}

export interface RateImpactBySensitivity {
  high: string[];
  medium: string[];
  low: string[];
}

export interface RateImpactResponse {
  analyses: RateImpactAnalysis[];
  by_sensitivity: RateImpactBySensitivity;
  rate_beneficiaries: string[];
  rate_sensitive: string[];
}

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  new_highs: number;
  new_lows: number;
  above_200dma_pct: number;
  above_50dma_pct: number;
  mcclellan_oscillator: number;
  fear_greed_index: number;
  breadth_score: number;
  breadth_signal: 'bullish' | 'bearish' | 'neutral';
  advance_decline_ratio: number;
}

export interface StockMarketContext {
  ticker: string;
  sector: string | null;
  sector_performance: SectorPerformance | null;
  rate_sensitivity: RateImpactAnalysis | null;
  market_breadth: {
    advance_decline_ratio: number;
    above_200dma_pct: number;
    fear_greed_index: number;
  };
  key_macro_indicators: Record<
    string,
    {
      value: number;
      trend: string;
      impact: string;
    }
  >;
  contextual_insight: string;
}

// API Functions
const API_BASE = '/api/v1/market';

export async function fetchMacroIndicators(): Promise<MacroResponse> {
  const response = await fetch(`${API_BASE}/macro-indicators`);
  if (!response.ok) throw new Error('Failed to fetch macro indicators');
  return response.json();
}

export async function fetchSectorPerformance(): Promise<SectorResponse> {
  const response = await fetch(`${API_BASE}/sectors`);
  if (!response.ok) throw new Error('Failed to fetch sector performance');
  return response.json();
}

export async function fetchRateImpact(sector?: string): Promise<RateImpactResponse> {
  const url = sector
    ? `${API_BASE}/rate-impact?sector=${encodeURIComponent(sector)}`
    : `${API_BASE}/rate-impact`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch rate impact');
  return response.json();
}

export async function fetchStockRateImpact(ticker: string): Promise<RateImpactAnalysis> {
  const response = await fetch(`${API_BASE}/rate-impact/${ticker}`);
  if (!response.ok) throw new Error(`Failed to fetch rate impact for ${ticker}`);
  return response.json();
}

export async function fetchMarketBreadth(): Promise<MarketBreadth> {
  const response = await fetch(`${API_BASE}/breadth`);
  if (!response.ok) throw new Error('Failed to fetch market breadth');
  return response.json();
}

export async function fetchStockMarketContext(ticker: string): Promise<StockMarketContext> {
  const response = await fetch(`${API_BASE}/context/${ticker}`);
  if (!response.ok) throw new Error(`Failed to fetch market context for ${ticker}`);
  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK SCREENER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ScreenerFilters = {
  market_cap_min?: number;
  market_cap_max?: number;
  pe_ratio_min?: number;
  pe_ratio_max?: number;
  forward_pe_min?: number;
  forward_pe_max?: number;
  pb_ratio_min?: number;
  pb_ratio_max?: number;
  ev_to_ebitda_min?: number;
  ev_to_ebitda_max?: number;
  revenue_growth_min?: number;
  revenue_growth_max?: number;
  dividend_yield_min?: number;
  dividend_yield_max?: number;
  price_vs_200ma_min?: number;
  price_vs_200ma_max?: number;
  price_vs_52w_high_min?: number;
  price_vs_52w_high_max?: number;
  sectors?: string;
  has_insider_buys_90d?: boolean;
  insider_net_shares_90d_min?: number;
  congress_net_value_90d_min?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type ScreenerResult = {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  current_price: number | null;
  price_change_1d: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  pb_ratio: number | null;
  ev_to_ebitda: number | null;
  revenue_growth: number | null;
  dividend_yield: number | null;
  price_vs_200ma: number | null;
  price_vs_52w_high: number | null;
  insider_net_shares_90d: number | null;
  insider_buys_90d: number | null;
  insider_sells_90d: number | null;
  congress_net_value_90d: number | null;
  congress_buys_90d: number | null;
  congress_sells_90d: number | null;
};

export type ScreenerResponse = {
  results: ScreenerResult[];
  total: number;
  filters_applied: ScreenerFilters;
  cached_at: string | null;
};

export type SavedScreen = {
  id: number;
  owner_id: string;
  name: string;
  filters: ScreenerFilters;
  created_at: string;
  last_run_at: string | null;
  last_result_count: number | null;
};

export type SavedScreenCreate = {
  name: string;
  filters: ScreenerFilters;
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ExportInputs = {
  growth?: number;
  margin?: number;
  wacc?: number;
  tax?: number;
  terminal_g?: number;
};