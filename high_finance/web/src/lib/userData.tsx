/**
 * User Data Context
 * =================
 * Manages watchlist and portfolio with backend sync when authenticated.
 * Falls back to localStorage when not authenticated.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";

const BASE = "/api/v1/me";
const TOKEN_KEY = "hf_access_token";

// Local storage keys (fallback when not authenticated)
const KEYS = {
  WATCHLIST: "hf_watchlist",
  PORTFOLIO: "hf_portfolio",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WatchlistItem {
  id?: number;
  ticker: string;
  name: string | null;
  added_at: string;
}

export interface PortfolioPosition {
  id?: number;
  ticker: string;
  name: string | null;
  shares: number;
  avg_cost: number;
  added_at: string;
  updated_at?: string | null;
}

interface UserDataContextType {
  // Watchlist
  watchlist: WatchlistItem[];
  addToWatchlist: (ticker: string, name: string) => Promise<void>;
  removeFromWatchlist: (ticker: string) => Promise<void>;
  isInWatchlist: (ticker: string) => boolean;

  // Portfolio
  portfolio: PortfolioPosition[];
  addPosition: (ticker: string, name: string, shares: number, avgCost: number) => Promise<void>;
  updatePosition: (ticker: string, shares: number, avgCost: number) => Promise<void>;
  removePosition: (ticker: string) => Promise<void>;
  hasPosition: (ticker: string) => boolean;

  // State
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | null>(null);

export function useUserData(): UserDataContextType {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within a UserDataProvider");
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPut<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getLocalWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(KEYS.WATCHLIST);
    if (!raw) return [];
    // Convert old format (addedAt) to new format (added_at)
    const items = JSON.parse(raw);
    return items.map((item: any) => ({
      ticker: item.ticker,
      name: item.name,
      added_at: item.added_at || item.addedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function setLocalWatchlist(items: WatchlistItem[]): void {
  localStorage.setItem(KEYS.WATCHLIST, JSON.stringify(items));
}

function getLocalPortfolio(): PortfolioPosition[] {
  try {
    const raw = localStorage.getItem(KEYS.PORTFOLIO);
    if (!raw) return [];
    // Convert old format (avgCost, addedAt) to new format
    const items = JSON.parse(raw);
    return items.map((item: any) => ({
      ticker: item.ticker,
      name: item.name,
      shares: item.shares,
      avg_cost: item.avg_cost ?? item.avgCost,
      added_at: item.added_at || item.addedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function setLocalPortfolio(items: PortfolioPosition[]): void {
  localStorage.setItem(KEYS.PORTFOLIO, JSON.stringify(items));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

interface UserDataProviderProps {
  children: ReactNode;
}

export function UserDataProvider({ children }: UserDataProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount and when auth state changes.
  // When authenticated, migrates any localStorage-only items to the DB
  // so positions persist across browsers.
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        // 1. Fetch from API (DB data) — use allSettled so one failure
        //    doesn't prevent the other from loading
        const [wlResult, pfResult] = await Promise.allSettled([
          apiGet<WatchlistItem[]>("/watchlist"),
          apiGet<PortfolioPosition[]>("/portfolio"),
        ]);

        const dbWatchlist =
          wlResult.status === "fulfilled" ? wlResult.value : [];
        const dbPortfolio =
          pfResult.status === "fulfilled" ? pfResult.value : [];

        // 2. Read localStorage (may have items not yet in DB)
        const localWl = getLocalWatchlist();
        const localPf = getLocalPortfolio();

        // 3. Find items in localStorage that are NOT in the DB (by ticker)
        const dbWlTickers = new Set(dbWatchlist.map((w) => w.ticker));
        const dbPfTickers = new Set(dbPortfolio.map((p) => p.ticker));

        const wlToMigrate = localWl.filter(
          (w) => !dbWlTickers.has(w.ticker)
        );
        const pfToMigrate = localPf.filter(
          (p) => !dbPfTickers.has(p.ticker)
        );

        // 4. Upload missing items to DB (each with its own catch so one
        //    failure doesn't block the rest — they'll retry next login)
        const wlMigrations = wlToMigrate.map((w) =>
          apiPost<WatchlistItem>("/watchlist", {
            ticker: w.ticker,
            name: w.name,
          }).catch(() => null)
        );
        const pfMigrations = pfToMigrate.map((p) =>
          apiPost<PortfolioPosition>("/portfolio", {
            ticker: p.ticker,
            name: p.name,
            shares: p.shares,
            avg_cost: p.avg_cost,
          }).catch(() => null)
        );

        const [migratedWl, migratedPf] = await Promise.all([
          Promise.all(wlMigrations),
          Promise.all(pfMigrations),
        ]);

        // 5. Merge: DB data + successfully migrated items
        const finalWl = [
          ...dbWatchlist,
          ...(migratedWl.filter(Boolean) as WatchlistItem[]),
        ];
        const finalPf = [
          ...dbPortfolio,
          ...(migratedPf.filter(Boolean) as PortfolioPosition[]),
        ];

        // 6. Set state and sync localStorage for offline access
        setWatchlist(finalWl);
        setPortfolio(finalPf);
        setLocalWatchlist(finalWl);
        setLocalPortfolio(finalPf);
      } else {
        // Not authenticated — load from localStorage
        setWatchlist(getLocalWatchlist());
        setPortfolio(getLocalPortfolio());
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
      // Only fall back to localStorage if it actually has data.
      // On a fresh browser localStorage is empty, so falling back would
      // overwrite state with [] and hide any data that might load on retry.
      const localWl = getLocalWatchlist();
      const localPf = getLocalPortfolio();
      if (localWl.length > 0) setWatchlist(localWl);
      if (localPf.length > 0) setPortfolio(localPf);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  // ─── Watchlist Methods ─────────────────────────────────────────────────────

  const addToWatchlist = useCallback(
    async (ticker: string, name: string) => {
      const upper = ticker.toUpperCase();
      const newItem: WatchlistItem = {
        ticker: upper,
        name,
        added_at: new Date().toISOString(),
      };

      // Optimistic update
      setWatchlist((prev) => {
        if (prev.some((w) => w.ticker === upper)) return prev;
        return [...prev, newItem];
      });

      if (isAuthenticated) {
        try {
          const created = await apiPost<WatchlistItem>("/watchlist", {
            ticker: upper,
            name,
          });
          setWatchlist((prev) =>
            prev.map((w) => (w.ticker === upper ? created : w))
          );
          // Sync to localStorage
          setLocalWatchlist(
            watchlist.some((w) => w.ticker === upper)
              ? watchlist
              : [...watchlist, created]
          );
        } catch (err) {
          console.error("Failed to add to watchlist:", err);
          // Revert on error
          setWatchlist((prev) => prev.filter((w) => w.ticker !== upper));
        }
      } else {
        // Just update localStorage
        const updated = [...watchlist, newItem];
        setLocalWatchlist(updated);
      }
    },
    [isAuthenticated, watchlist]
  );

  const removeFromWatchlist = useCallback(
    async (ticker: string) => {
      const upper = ticker.toUpperCase();

      // Optimistic update
      const previous = [...watchlist];
      setWatchlist((prev) => prev.filter((w) => w.ticker !== upper));

      if (isAuthenticated) {
        try {
          await apiDelete(`/watchlist/${upper}`);
          setLocalWatchlist(watchlist.filter((w) => w.ticker !== upper));
        } catch (err) {
          console.error("Failed to remove from watchlist:", err);
          setWatchlist(previous);
        }
      } else {
        setLocalWatchlist(watchlist.filter((w) => w.ticker !== upper));
      }
    },
    [isAuthenticated, watchlist]
  );

  const isInWatchlist = useCallback(
    (ticker: string) => watchlist.some((w) => w.ticker === ticker.toUpperCase()),
    [watchlist]
  );

  // ─── Portfolio Methods ─────────────────────────────────────────────────────

  const addPosition = useCallback(
    async (ticker: string, name: string, shares: number, avgCost: number) => {
      const upper = ticker.toUpperCase();

      if (isAuthenticated) {
        try {
          const result = await apiPost<PortfolioPosition>("/portfolio", {
            ticker: upper,
            name,
            shares,
            avg_cost: avgCost,
          });
          setPortfolio((prev) => {
            const exists = prev.find((p) => p.ticker === upper);
            if (exists) {
              return prev.map((p) => (p.ticker === upper ? result : p));
            }
            return [...prev, result];
          });
          // Sync to localStorage
          const updated = portfolio.find((p) => p.ticker === upper)
            ? portfolio.map((p) => (p.ticker === upper ? result : p))
            : [...portfolio, result];
          setLocalPortfolio(updated);
        } catch (err) {
          console.error("Failed to add position:", err);
        }
      } else {
        // Local only - average in if exists
        const existing = portfolio.find((p) => p.ticker === upper);
        let updated: PortfolioPosition[];

        if (existing) {
          const oldTotal = existing.shares * existing.avg_cost;
          const newTotal = shares * avgCost;
          const totalShares = existing.shares + shares;
          updated = portfolio.map((p) =>
            p.ticker === upper
              ? {
                  ...p,
                  shares: totalShares,
                  avg_cost: (oldTotal + newTotal) / totalShares,
                }
              : p
          );
        } else {
          updated = [
            ...portfolio,
            {
              ticker: upper,
              name,
              shares,
              avg_cost: avgCost,
              added_at: new Date().toISOString(),
            },
          ];
        }

        setPortfolio(updated);
        setLocalPortfolio(updated);
      }
    },
    [isAuthenticated, portfolio]
  );

  const updatePosition = useCallback(
    async (ticker: string, shares: number, avgCost: number) => {
      const upper = ticker.toUpperCase();

      if (isAuthenticated) {
        try {
          const result = await apiPut<PortfolioPosition>(`/portfolio/${upper}`, {
            shares,
            avg_cost: avgCost,
          });
          setPortfolio((prev) =>
            prev.map((p) => (p.ticker === upper ? result : p))
          );
          setLocalPortfolio(
            portfolio.map((p) => (p.ticker === upper ? result : p))
          );
        } catch (err) {
          console.error("Failed to update position:", err);
        }
      } else {
        const updated = portfolio.map((p) =>
          p.ticker === upper ? { ...p, shares, avg_cost: avgCost } : p
        );
        setPortfolio(updated);
        setLocalPortfolio(updated);
      }
    },
    [isAuthenticated, portfolio]
  );

  const removePosition = useCallback(
    async (ticker: string) => {
      const upper = ticker.toUpperCase();
      const previous = [...portfolio];

      setPortfolio((prev) => prev.filter((p) => p.ticker !== upper));

      if (isAuthenticated) {
        try {
          await apiDelete(`/portfolio/${upper}`);
          setLocalPortfolio(portfolio.filter((p) => p.ticker !== upper));
        } catch (err) {
          console.error("Failed to remove position:", err);
          setPortfolio(previous);
        }
      } else {
        setLocalPortfolio(portfolio.filter((p) => p.ticker !== upper));
      }
    },
    [isAuthenticated, portfolio]
  );

  const hasPosition = useCallback(
    (ticker: string) => portfolio.some((p) => p.ticker === ticker.toUpperCase()),
    [portfolio]
  );

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<UserDataContextType>(
    () => ({
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      isInWatchlist,
      portfolio,
      addPosition,
      updatePosition,
      removePosition,
      hasPosition,
      isLoading,
      refresh: loadData,
    }),
    [
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      isInWatchlist,
      portfolio,
      addPosition,
      updatePosition,
      removePosition,
      hasPosition,
      isLoading,
      loadData,
    ]
  );

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}
