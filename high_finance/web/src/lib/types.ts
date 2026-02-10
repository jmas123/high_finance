// Re-export project types for backwards compatibility
export type { ProjectSummary } from "../components/project/types";

export type Company = {
  id: number;
  name: string;
  short_name?: string;
  ticker: string;
  sector?: string | null;
  industry?: string | null;
};

// -- Prices --
export type PriceEntry = {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// -- Leadership --
export type LeadershipMember = {
  name?: string;
  title?: string;
  age?: number;
  total_pay?: number;
  year_born?: number;
};

export type Leadership = LeadershipMember[];

// -- Ownership --
export type OwnershipEntry = {
  holder: string;
  shares: number;
  date_reported: string;
  percent_out: number | null;
  value: number | null;
};

export type Ownership = OwnershipEntry[];

// -- Insider Trades --
export type InsiderTrade = {
  insider: string;
  position: string;
  transaction_type: string;
  shares: number;
  value: number | null;
  date: string | null;
  url: string | null;
};

export type InsiderSummary = {
  total_trades: number;
  buys: number;
  sells: number;
  buy_shares: number;
  sell_shares: number;
  net_shares: number;
  buy_value: number;
  sell_value: number;
  net_value: number;
  recent_trades: InsiderTrade[];
};

// -- Institutional Flow --
export type Holder = {
  holder: string;
  shares: number;
  value: number | null;
  pct_held: number | null;
  pct_change: number | null;
  date_reported: string | null;
};

export type InstitutionalFlow = {
  summary: {
    institutional_ownership_pct: number;
    insider_ownership_pct: number;
    shares_outstanding: number;
    float_shares: number;
    total_institutional_holders: number;
    total_mutual_fund_holders: number;
    total_institutional_value: number;
    total_institutional_shares: number;
  };
  top_institutional_holders: Holder[];
  top_mutual_fund_holders: Holder[];
  increasing_positions: Holder[];
  decreasing_positions: Holder[];
};

// -- Options Overview --
export type UnusualActivityEntry = {
  type: "CALL" | "PUT";
  strike: number;
  volume: number;
  open_interest: number;
  volume_oi_ratio: number;
  last_price: number;
  implied_volatility: number;
  moneyness: number;
  premium_value: number;
  signal: string;
};

export type StrikeVolume = {
  strike: number;
  call_volume: number;
  put_volume: number;
};

export type OptionsOverview = {
  ticker: string;
  current_price: number | null;
  expirations: string[];
  put_call_ratio: number | null;
  total_call_volume: number;
  total_put_volume: number;
  total_call_oi: number;
  total_put_oi: number;
  max_pain: number | null;
  unusual_activity: UnusualActivityEntry[];
  iv_percentile: number | null;
  nearest_expiry_analysis: {
    expiry: string;
    days_to_expiry: number;
    atm_strike: number | null;
    atm_iv: number | null;
    expected_move: number | null;
    expected_move_pct: number | null;
    strike_volume: StrikeVolume[];
  } | null;
};

// -- Earnings --
export type EarningsData = {
  ticker: string;
  next_earnings: {
    date: string;
    time: string;
    eps_estimate: number | null;
  } | null;
  estimates: {
    current_eps_estimate: number | null;
    current_pe: number | null;
    peg_ratio: number | null;
    earnings_growth: number | null;
    revenue_growth: number | null;
  } | null;
};

export type EarningsHistoryEntry = {
  date: string;
  quarter: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  surprise_pct: number | null;
  beat: boolean | null;
  one_day_move: number | null;
  five_day_move: number | null;
};
// ── Earnings Press Release Analysis (8-K Item 2.02) ────────────────────────

export type EarningsMetric = {
  value: number | string | null;
  unit: "$" | "%" | "#" | "x" | "" | null;
  yoy_change_pct: number | null;
  vs_estimate: "beat" | "miss" | "inline" | null;
  surprise_pct: number | null;
  note: string | null;
};

export type EarningsGuidance = {
  has_guidance: boolean;
  next_quarter_revenue: { low: number | null; high: number | null } | null;
  next_quarter_eps: { low: number | null; high: number | null } | null;
  full_year_revenue: { low: number | null; high: number | null } | null;
  full_year_eps: { low: number | null; high: number | null } | null;
  capex: string | null;
  other_forward_items: string[] | null;
  guidance_tone: "optimistic" | "cautious" | "neutral" | "pessimistic" | null;
  guidance_summary: string | null;
};

export type EarningsSentiment = {
  overall: "positive" | "negative" | "neutral" | "mixed";
  confidence: number | null;
  confidence_basis: string | null;
  tone_vs_prior: "more_optimistic" | "more_cautious" | "unchanged" | null;
  key_positive_signals: string[];
  key_concerns: string[];
};

export type EarningsKeyQuote = {
  speaker: string;
  quote: string;
  context: string | null;
};

export type EarningsAnalysisResult = {
  quarter: string;
  filing_date: string;
  filing_url: string | null;
  reported_results: Record<string, EarningsMetric>;
  other_metrics: Array<{ name: string; value: string; unit?: string | null; yoy_change_pct?: number | null; note: string | null }>;
  guidance: EarningsGuidance | null;
  sentiment: EarningsSentiment;
  key_quotes: EarningsKeyQuote[];
  summary: string;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
};

export type EarningsAnalysisResponse = {
  analysis: EarningsAnalysisResult | null;
  id: number | null;
  source?: string;
};

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

export type MetricStats = {
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
  n?: number;
};

export type CompsResponse = {
  target: Fundamentals;
  peers: Fundamentals[];

  template: CompTemplate;
  averages: Record<string, number | null>;  // legacy

  // NEW: Full statistics per metric
  statistics: Record<string, MetricStats>;

  // NEW: Implied price at peer median for each valuation metric
  implied_prices: Record<string, number | null>;

  // Explains why specific implied prices are None
  implied_price_notes?: Record<string, string>;

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
  quarterly_excluded?: string[];  // dates dropped because yfinance returned only estimates
};

export type NewsHeadline = {
  title: string;
  url: string | null;
  published: string | null;
  source: string | null;
  sentiment: { compound: number; pos: number; neu: number; neg: number };
};

export type SECFiling = {
  form: string;
  date: string;
  url?: string | null;
};

export type NewsBundle = {
  ticker: string;
  avg_headline_sentiment: number | null;
  headlines: NewsHeadline[];
  filings: SECFiling[];
  x_posts: Record<string, unknown>[];
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

// AI DCF Suggestion types
export type AISuggestionParam = {
  value: number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

export type AISuggestion = {
  growth: AISuggestionParam;
  margin: AISuggestionParam;
  wacc: AISuggestionParam;
  tax: AISuggestionParam;
  terminal_g: AISuggestionParam;
  summary: string;
  valuation_gap_note: string | null;
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
  net_debt_est?: number | null;
  fetched_at?: string | null;
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
  roe_min?: number;
  roe_max?: number;
  profit_margin_min?: number;
  profit_margin_max?: number;
  debt_to_equity_min?: number;
  debt_to_equity_max?: number;
  fcf_yield_min?: number;
  fcf_yield_max?: number;
  beta_min?: number;
  beta_max?: number;
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
  roe: number | null;
  profit_margin: number | null;
  debt_to_equity: number | null;
  fcf_yield: number | null;
  beta: number | null;
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
  total_count: number;
  universe_total: number;
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

// ═══════════════════════════════════════════════════════════════════════════════
// PEER GROUP TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PeerGroup = {
  id: number;
  user_id: string;
  ticker: string | null;  // null = user-level group
  name: string;
  peer_tickers: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
};

export type PeerGroupList = {
  items: PeerGroup[];
  total: number;
  limit: number;
  offset: number;
};

export type PeerGroupCreate = {
  ticker?: string | null;
  name: string;
  peer_tickers: string[];
  is_default?: boolean;
};

export type PeerGroupUpdate = {
  name?: string;
  peer_tickers?: string[];
  is_default?: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO PERFORMANCE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BenchmarkPerformance {
  name: string;
  returns: Record<string, number | null>;
  sparkline: number[];
}

export interface PortfolioRiskMetrics {
  beta: number | null;  // Beta vs SPY
  sharpe: number | null;  // Sharpe ratio (annualized)
}

export interface PortfolioPerformanceResponse {
  portfolio: {
    returns: Record<string, number | null>;
    sparkline: number[];
  };
  benchmarks: Record<string, BenchmarkPerformance>;
  periods: string[];
  outperformance: Record<string, number>;
  risk_metrics?: PortfolioRiskMetrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE COMPANIES (IPO Exposure Tracker)
// ═══════════════════════════════════════════════════════════════════════════════

export type PrivateCompanyInvestor = {
  id: number;
  investor_name: string;
  investor_type: "corporate" | "vc" | "pe" | "sovereign" | "individual";
  public_ticker: string | null;
  round_or_context: string | null;
  investment_amount: number | null;
  investment_date: string | null;
  notes: string | null;
};

export type PrivateCompanyProfile = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sector: string | null;
  founded_year: number | null;
  hq_location: string | null;
  website: string | null;
  latest_valuation: number | null;
  valuation_date: string | null;
  status: "private" | "pre_ipo" | "filed_s1";
  investors: PrivateCompanyInvestor[];
};

export type PrivateCompanySummary = {
  slug: string;
  name: string;
  sector: string | null;
  status: string;
  latest_valuation: number | null;
  investor_count: number;
  public_investor_count: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTMENT MEMO TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MemoSummary = {
  id: number;
  ticker: string;
  created_at: string;
  content_preview: string;
};

export type MemoDetail = {
  id: number;
  ticker: string;
  content: string;
  model_used: string | null;
  created_at: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI HISTORY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AIHistoryItem = {
  id: number;
  ticker: string;
  analysis_type: string;
  content_preview: string;
  created_at: string;
};

export type AIHistoryDetail = {
  id: number;
  ticker: string;
  analysis_type: string;
  content: string;
  model_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export type AIHistoryTypeCount = {
  analysis_type: string;
  count: number;
};

export type AIHistoryStats = {
  total_count: number;
  by_type: AIHistoryTypeCount[];
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  budget_usd: number;
  budget_remaining_usd: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ML PREDICTION TYPES (v2 — GBM Classifier with Confidence Gating)
// ═══════════════════════════════════════════════════════════════════════════════

export type PredictionSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

export type PredictionResult = {
  signal: PredictionSignal;
  probability_up: number;       // 0-100
  probability_down: number;     // 0-100
  predicted_return: number;     // percentage
  current_price: number;
  predicted_price: number;
  horizon_days: number;
  confidence_thresholds: {
    bullish_above: number;
    bearish_below: number;
  };
  // Backwards-compatible
  direction: "UP" | "DOWN";
  confidence: string;
};

export type PredictionModelMetrics = {
  direction_accuracy: number;
  baseline_accuracy: number;
  accuracy_vs_baseline: number;
  gated_accuracy: number | null;
  gated_trades: number;
  gated_total: number;
  information_coefficient: number;
  train_r2: number;
  test_r2: number;
  training_samples: number;
  test_samples: number;
  model_type: string;
  horizon_days: number;
};

export type PredictionBootstrapCI = {
  n_bootstrap: number;
  mean: number;
  std: number;
  ci_95_low: number;
  ci_95_high: number;
  ci_note: string;
};

export type PredictionModelHealth = {
  horizon: string;
  training_period: string;
  training_days: number;
  vol_regime: string;
  vol_regime_value: number;
  n_features: number;
  disclaimer: string;
};

export type PredictionWalkForwardFold = {
  fold: number;
  train_size: number;
  test_size: number;
  purge_days: number;
  test_start: string;
  test_end: string;
  direction_accuracy: number;
  baseline_accuracy: number;
  accuracy_vs_baseline: number;
  sharpe: number;
  total_return: number;
};

export type PredictionWalkForwardSummary = {
  n_folds: number;
  purge_window: number;
  sharpe_mean: number;
  sharpe_std: number;
  sharpe_min: number;
  sharpe_max: number;
  direction_accuracy_mean: number;
  direction_accuracy_std: number;
  baseline_accuracy_mean: number;
  accuracy_vs_baseline_mean: number;
  positive_sharpe_pct: number;
};

export type PredictionBacktest = {
  sharpe_ratio: number;
  annual_return: number;
  annual_volatility: number;
  total_return: number;
  max_drawdown: number;
  calmar_ratio: number;
  win_rate: number;
  num_trades: number;
  trades_taken: number;
  trades_total: number;
  selectivity_pct: number;
  buy_hold_sharpe: number;
  buy_hold_return: number;
  buy_hold_calmar: number;
  strategy_vs_buyhold: number;
  cumulative_returns: Array<{ date: string; strategy: number; buyHold: number }>;
};

export type PredictionModelQuality = {
  grade: "no_signal" | "weak" | "marginal" | "acceptable";
  suppressed: boolean;
  redeemed: boolean;
  message: string | null;
  failures: string[];
  redemption_reasons: string[];
  overfit_gap: number;
};

export type PredictionResponse = {
  ticker: string;
  prediction: PredictionResult;
  model_metrics: PredictionModelMetrics;
  backtest: PredictionBacktest;
  walk_forward: {
    folds: PredictionWalkForwardFold[];
    summary: PredictionWalkForwardSummary | null;
  };
  bootstrap_ci: PredictionBootstrapCI;
  factor_attribution: {
    alpha_annualized: number | null;
    beta: number | null;
    r_squared: number | null;
    interpretation?: string;
    error?: string;
  };
  top_features: Array<{ feature: string; importance: number }>;
  model_quality: PredictionModelQuality;
  model_health: PredictionModelHealth;
  technical_indicators: {
    rsi_14: number;
    macd: number;
    macd_signal: number;
    trend: string;
    volatility_20d: number;
    volume_ratio: number;
    ma_10_ratio: number;
    ma_20_ratio: number;
    bb_position: number;
    vol_regime: number;
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONGRESS BACKTEST TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type BacktestTradeResult = {
  ticker: string;
  transaction_type: string;
  disclosure_date: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  hold_days_actual: number;
  cohort_return_pct?: number | null;
};

export type EquityCurvePoint = {
  date: string;
  portfolio_value: number;
  spy_value: number;
};

export type BacktestSummary = {
  politician_id: number;
  politician_name: string;
  party: string | null;
  chamber: string | null;
  state: string | null;
  delay_days: number;
  hold_days: number;
  num_trades: number;
  num_positions?: number;
  num_cohorts?: number;
  num_trades_priced: number;
  total_return_pct: number;
  annualized_return_pct: number | null;
  win_rate: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  spy_total_return_pct: number;
  spy_annualized_return_pct: number | null;
  alpha_pct: number;
  best_trade: BacktestTradeResult | null;
  worst_trade: BacktestTradeResult | null;
  first_trade_date: string | null;
  last_trade_date: string | null;
  grade: string | null;
  skip_reasons?: {
    no_entry_price: number;
    no_exit_price: number;
    invalid_return: number;
  } | null;
};

export type BacktestResponse = {
  summary: BacktestSummary;
  equity_curve: EquityCurvePoint[];
  trades: BacktestTradeResult[];
};

export type LeaderboardEntry = {
  politician_id: number;
  politician_name: string;
  party: string | null;
  chamber: string | null;
  state: string | null;
  num_trades_priced: number;
  num_cohorts?: number;
  total_return_pct: number;
  avg_return_per_trade_pct?: number;
  annualized_return_pct: number | null;
  win_rate: number;
  max_drawdown_pct: number;
  alpha_pct: number;
  grade: string | null;
  first_trade_date?: string | null;
  last_trade_date?: string | null;
};

export type LeaderboardResponse = {
  delay_days: number;
  hold_days: number;
  entries: LeaderboardEntry[];
  computed_at: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI RISK ASSESSMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type RiskFactor = {
  category: string;
  title: string;
  severity: "low" | "medium" | "high";
  detail: string;
  monte_carlo_impact: string;
};

export type TailoredScenario = {
  name: string;
  narrative: string;
  parameters: {
    vol_multiplier: number;
    horizon_days: number;
    include_earnings_shock: boolean;
  };
  estimated_likelihood: "low" | "medium" | "plausible";
};

export type AIRiskAssessment = {
  overall_risk_tier: "low" | "moderate" | "elevated" | "high";
  summary: string;
  risk_factors: RiskFactor[];
  tailored_scenarios: TailoredScenario[];
  suggested_base_parameters: {
    vol_multiplier: number;
    horizon_days: number;
    rationale: string;
  };
  model: string;
  input_tokens: number;
  output_tokens: number;
};