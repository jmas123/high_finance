import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import type { EarningsHistoryEntry } from "../../lib/types";

type EarningsHistory = EarningsHistoryEntry;

type EarningsData = {
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

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatEPS(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface EarningsCardProps {
  ticker: string;
  initialData?: EarningsData | null;
}

export function EarningsCard({ ticker, initialData }: EarningsCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EarningsData | null>(initialData ?? null);
  const [history, setHistory] = useState<EarningsHistory[]>([]);
  const fetchingRef = useRef<string | null>(null); // Prevents StrictMode double-fetch

  useEffect(() => {
    if (!ticker) return;

    // Prevent StrictMode double-fetch
    if (fetchingRef.current === ticker) return;
    fetchingRef.current = ticker;

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // If we have initial data from bundle (even if null), only fetch history
        if (initialData !== undefined) {
          setData(initialData);
          const historyData = await api.earningsHistory(ticker);
          if (mounted) setHistory(historyData);
        } else {
          // Fetch both if no initial data
          const [earningsData, historyData] = await Promise.all([
            api.earnings(ticker),
            api.earningsHistory(ticker),
          ]);
          if (mounted) {
            setData(earningsData);
            setHistory(historyData);
          }
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load earnings");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; fetchingRef.current = null; };
  }, [ticker, initialData]);

  // Calculate historical stats
  const beatRate = history.length > 0 
    ? Math.round((history.filter(h => h.beat).length / history.filter(h => h.beat !== null).length) * 100)
    : null;
  
  const avgSurprise = history.length > 0
    ? history.filter(h => h.surprise_pct !== null).reduce((sum, h) => sum + (h.surprise_pct || 0), 0) / history.filter(h => h.surprise_pct !== null).length
    : null;

  const avgMove = history.length > 0
    ? history.filter(h => h.one_day_move !== null).reduce((sum, h) => sum + Math.abs(h.one_day_move || 0), 0) / history.filter(h => h.one_day_move !== null).length
    : null;

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Earnings</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            Estimates, surprises & post-earnings moves
          </div>
        </div>
        
        {/* Next Earnings Badge */}
        {data?.next_earnings && (
          <div style={{
            background: daysUntil(data.next_earnings.date) <= 7 ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
            border: `1px solid ${daysUntil(data.next_earnings.date) <= 7 ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
            borderRadius: 8,
            padding: "8px 12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>NEXT EARNINGS</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {new Date(data.next_earnings.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {daysUntil(data.next_earnings.date)} days • Est: {formatEPS(data.next_earnings.eps_estimate)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: 10,
          background: "#3b1818",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
        }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, opacity: 0.7 }}>Loading earnings data…</div>
      ) : (
        <>
          {/* Summary Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: "rgba(34, 197, 94, 0.05)",
            borderRadius: 8,
            border: "1px solid rgba(34, 197, 94, 0.1)",
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Beat Rate</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: beatRate && beatRate >= 75 ? "#22c55e" : "inherit" }}>
                {beatRate !== null ? `${beatRate}%` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Avg Surprise</div>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 600,
                color: avgSurprise && avgSurprise > 0 ? "#22c55e" : avgSurprise && avgSurprise < 0 ? "#ef4444" : "inherit"
              }}>
                {avgSurprise !== null ? formatPercent(avgSurprise) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Avg Move (1D)</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {avgMove !== null ? `±${avgMove.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>EPS Growth</div>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 600,
                color: data?.estimates?.earnings_growth && data.estimates.earnings_growth > 0 ? "#22c55e" : "#ef4444"
              }}>
                {data?.estimates?.earnings_growth !== null 
                  ? formatPercent((data?.estimates?.earnings_growth || 0) * 100) 
                  : "—"}
              </div>
            </div>
          </div>

          {/* Earnings History Table */}
          {history.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #333" }}>
                    <th style={{ padding: "10px 8px", textAlign: "left", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Quarter</th>
                    <th style={{ padding: "10px 8px", textAlign: "right", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Est</th>
                    <th style={{ padding: "10px 8px", textAlign: "right", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Actual</th>
                    <th style={{ padding: "10px 8px", textAlign: "right", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Surprise</th>
                    <th style={{ padding: "10px 8px", textAlign: "right", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>1D Move</th>
                    <th style={{ padding: "10px 8px", textAlign: "right", opacity: 0.6, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>5D Move</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 500 }}>{h.quarter}</div>
                        <div style={{ fontSize: 11, opacity: 0.5 }}>{h.date}</div>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>
                        {formatEPS(h.eps_estimate)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 500 }}>
                        {formatEPS(h.eps_actual)}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: h.beat === true ? "#14532d" : h.beat === false ? "#7f1d1d" : "#374151",
                        }}>
                          {h.surprise_pct !== null ? formatPercent(h.surprise_pct) : "—"}
                        </span>
                      </td>
                      <td style={{ 
                        padding: "10px 8px", 
                        textAlign: "right", 
                        fontFamily: "monospace",
                        color: h.one_day_move && h.one_day_move > 0 ? "#22c55e" : h.one_day_move && h.one_day_move < 0 ? "#ef4444" : "inherit"
                      }}>
                        {h.one_day_move !== null ? formatPercent(h.one_day_move) : "—"}
                      </td>
                      <td style={{ 
                        padding: "10px 8px", 
                        textAlign: "right", 
                        fontFamily: "monospace",
                        color: h.five_day_move && h.five_day_move > 0 ? "#22c55e" : h.five_day_move && h.five_day_move < 0 ? "#ef4444" : "inherit"
                      }}>
                        {h.five_day_move !== null ? formatPercent(h.five_day_move) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.length === 0 && !loading && (
            <div style={{ padding: 24, opacity: 0.7, textAlign: "center" }}>
              No earnings history available.
            </div>
          )}
        </>
      )}
    </div>
  );
}