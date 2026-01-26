export type Company = {
  id: number;
  name: string;
  ticker: string;
  sector?: string | null;
  industry?: string | null;
};

export type Fundamentals = any;
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
