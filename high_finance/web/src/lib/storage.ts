// ============================================================================
// localStorage Persistence Layer
// ============================================================================
// All personalization data lives in the browser. No backend needed.
// Keys are namespaced under "hf_" to avoid collisions.

const KEYS = {
  WATCHLIST: "hf_watchlist",
  PORTFOLIO: "hf_portfolio",
  RECENT: "hf_recent_tickers",
} as const;

// ── Watchlist ────────────────────────────────────────────────────────────────

export type WatchlistItem = {
  ticker: string;
  name: string;
  addedAt: string; // ISO date
};

export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KEYS.WATCHLIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToWatchlist(ticker: string, name: string): WatchlistItem[] {
  const list = getWatchlist();
  const upper = ticker.toUpperCase();
  if (list.some((w) => w.ticker === upper)) return list; // already exists
  const updated = [...list, { ticker: upper, name, addedAt: new Date().toISOString() }];
  localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(updated));
  return updated;
}

export function removeFromWatchlist(ticker: string): WatchlistItem[] {
  const list = getWatchlist().filter((w) => w.ticker !== ticker.toUpperCase());
  localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(list));
  return list;
}

export function isInWatchlist(ticker: string): boolean {
  return getWatchlist().some((w) => w.ticker === ticker.toUpperCase());
}

export function reorderWatchlist(tickers: string[]): WatchlistItem[] {
  const list = getWatchlist();
  const map = new Map(list.map((w) => [w.ticker, w]));
  const reordered = tickers.map((t) => map.get(t)).filter(Boolean) as WatchlistItem[];
  localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(reordered));
  return reordered;
}

// ── Portfolio ────────────────────────────────────────────────────────────────

export type PortfolioPosition = {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number; // cost basis per share
  addedAt: string;
};

export function getPortfolio(): PortfolioPosition[] {
  try {
    const raw = localStorage.getItem(KEYS.PORTFOLIO);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPosition(
  ticker: string,
  name: string,
  shares: number,
  avgCost: number
): PortfolioPosition[] {
  const list = getPortfolio();
  const upper = ticker.toUpperCase();
  const existing = list.find((p) => p.ticker === upper);

  if (existing) {
    // Average in: new cost basis = (old_total + new_total) / (old_shares + new_shares)
    const oldTotal = existing.shares * existing.avgCost;
    const newTotal = shares * avgCost;
    existing.shares += shares;
    existing.avgCost = (oldTotal + newTotal) / existing.shares;
  } else {
    list.push({ ticker: upper, name, shares, avgCost, addedAt: new Date().toISOString() });
  }

  localStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(list));
  return list;
}

export function updatePosition(
  ticker: string,
  shares: number,
  avgCost: number
): PortfolioPosition[] {
  const list = getPortfolio();
  const pos = list.find((p) => p.ticker === ticker.toUpperCase());
  if (pos) {
    pos.shares = shares;
    pos.avgCost = avgCost;
    localStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(list));
  }
  return list;
}

export function removePosition(ticker: string): PortfolioPosition[] {
  const list = getPortfolio().filter((p) => p.ticker !== ticker.toUpperCase());
  localStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(list));
  return list;
}

export function hasPosition(ticker: string): boolean {
  return getPortfolio().some((p) => p.ticker === ticker.toUpperCase());
}

// ── Recent Tickers ───────────────────────────────────────────────────────────

const MAX_RECENT = 10;

export function getRecentTickers(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.RECENT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentTicker(ticker: string): string[] {
  const upper = ticker.toUpperCase();
  let list = getRecentTickers().filter((t) => t !== upper);
  list.unshift(upper);
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
  localStorage.setItem(KEYS.RECENT, JSON.stringify(list));
  return list;
}

// ── Export / Import (for backup or migration to accounts later) ──────────────

export function exportAllData(): string {
  return JSON.stringify({
    watchlist: getWatchlist(),
    portfolio: getPortfolio(),
    recentTickers: getRecentTickers(),
    exportedAt: new Date().toISOString(),
  });
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.watchlist) localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(data.watchlist));
    if (data.portfolio) localStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(data.portfolio));
    if (data.recentTickers) localStorage.setItem(KEYS.RECENT, JSON.stringify(data.recentTickers));
    return true;
  } catch {
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(KEYS.WATCHLIST);
  localStorage.removeItem(KEYS.PORTFOLIO);
  localStorage.removeItem(KEYS.RECENT);
}