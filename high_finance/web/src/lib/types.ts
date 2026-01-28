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
};

export type PoliticianTrade = {
  id: number;
  politician_id: number;
  company_id: number | null;
  issuer_raw: string | null;
  ticker_raw: string | null;
  transaction_date: string | null;
  disclosure_date: string | null;
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
  } | null;
};

export type CompTemplate = {
  label: string;
  metrics: string[];
};

export type Fundamentals = {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;

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

  comp_template?: CompTemplate | null;
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
