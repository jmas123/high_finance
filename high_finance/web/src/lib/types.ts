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


export type Fundamentals = {
  // Core Identifiers
  ticker: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  
  // Valuation Metrics
  market_cap?: number | null;
  pe_ratio?: number | null;       // Trailing P/E
  forward_pe?: number | null;     // Forward P/E
  ev_to_ebitda?: number | null;   // Critical for Comps (New)
  
  // Performance & Growth
  revenue_growth?: number | null; // YoY Growth (New)
  eps?: number | null;
  dividend_yield?: number | null;
  beta?: number | null;
  
  // Financials
  revenue?: number | null;
  profit_margin?: number | null;
  
  // Technical Levels
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  fifty_day_avg?: number | null;
  two_hundred_day_avg?: number | null;
};

// Add this type for the new feature response
export type CompsResponse = {
  target: Fundamentals;
  peers: Fundamentals[];
  average_pe?: number | null;
  average_ev_ebitda?: number | null;
};