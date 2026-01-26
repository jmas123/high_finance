// 1. Update your imports to include CompsResponse
import type { 
  Company, 
  Fundamentals, 
  Ownership, 
  Leadership,
  CompsResponse 
} from "./types";

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
    getJSON<any>(`${BASE}/financials/${encodeURIComponent(ticker)}`),

  analyzeFinancials: (ticker: string) =>
    postJSON<{ analysis: string }>(`${BASE}/financials/${encodeURIComponent(ticker)}/analyze`),

  prediction: (ticker: string) =>
    getJSON<any>(`${BASE}/predictions/${encodeURIComponent(ticker)}`),

  search: (query: string) =>
    getJSON<Array<{ symbol: string; name: string; exchange: string; type: string }>>(
      `${BASE}/search?q=${encodeURIComponent(query)}`
    ),

  politicianTrades: (ticker: string, limit: number = 50) =>
    getJSON<any[]>(`${BASE}/companies/${encodeURIComponent(ticker)}/politician-trades?limit=${limit}`),

  insiderTrades: (ticker: string, limit: number = 50) =>
    getJSON<any[]>(`${BASE}/insider/${encodeURIComponent(ticker)}?limit=${limit}`),

  insiderSummary: (ticker: string) =>
    getJSON<any>(`${BASE}/insider/${encodeURIComponent(ticker)}/summary`),

  institutionalHolders: (ticker: string) =>
    getJSON<any[]>(`${BASE}/institutional/${encodeURIComponent(ticker)}`),

  institutionalFlow: (ticker: string) =>
    getJSON<any>(`${BASE}/institutional/${encodeURIComponent(ticker)}/flow`),
};