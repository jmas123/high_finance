// src/components/CompanyHeader.tsx

import { useState, useEffect } from "react";

interface CompanyHeaderProps {
  company: {
    name?: string;
    ticker?: string;
    sector?: string | null;
    industry?: string | null;
    market_cap?: number | null;
  };
  fundamentals: {
    fifty_two_week_high?: number | null;
    fifty_two_week_low?: number | null;

    // ✅ Add these (preferred) so "Today" matches Yahoo more closely
    regular_market_price?: number;
    regular_market_previous_close?: number;
  };
  prices: Array<{ close: number; open: number; date?: string }>;
}

// ── Market hours detection (US Eastern Time) ─────────────────────────────────
function getMarketStatus(): { isOpen: boolean; status: string; nextEvent: string } {
  const now = new Date();

  // Convert to ET (handles DST automatically)
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 30;  // 9:30 AM ET
  const marketClose = 16 * 60;      // 4:00 PM ET

  // Weekend
  if (day === 0 || day === 6) {
    return { isOpen: false, status: "Closed", nextEvent: "Opens Monday 9:30 AM ET" };
  }

  // Before market open
  if (timeInMinutes < marketOpen) {
    const minsUntilOpen = marketOpen - timeInMinutes;
    const h = Math.floor(minsUntilOpen / 60);
    const m = minsUntilOpen % 60;
    return {
      isOpen: false,
      status: "Pre-Market",
      nextEvent: h > 0 ? `Opens in ${h}h ${m}m` : `Opens in ${m}m`
    };
  }

  // After market close
  if (timeInMinutes >= marketClose) {
    return { isOpen: false, status: "After Hours", nextEvent: "Opens tomorrow 9:30 AM ET" };
  }

  // Market is open
  const minsUntilClose = marketClose - timeInMinutes;
  const h = Math.floor(minsUntilClose / 60);
  const m = minsUntilClose % 60;
  return {
    isOpen: true,
    status: "Market Open",
    nextEvent: h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`
  };
}


function formatMarketCap(value: number | null | undefined): string {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function PriceChange({
  change,
  percentChange,
  label,
}: {
  change: number;
  percentChange: number;
  label?: string;
}) {
  const isPositive = change >= 0;
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {label && <span style={{ fontSize: 12, opacity: 0.6 }}>{label}</span>}
      <span style={{ color, fontWeight: 500 }}>
        {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}
        {change.toFixed(2)} ({isPositive ? "+" : ""}
        {percentChange.toFixed(2)}%)
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

export function CompanyHeader({ company, fundamentals, prices }: CompanyHeaderProps) {
  // Market status - updates every minute
  const [marketStatus, setMarketStatus] = useState(getMarketStatus);
  useEffect(() => {
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Candle-derived values (fallbacks)
  const lastCandleClose = prices.length > 0 ? prices[prices.length - 1].close : null;
  const prevCandleClose = prices.length > 1 ? prices[prices.length - 2].close : null;
  const periodStartClose = prices.length > 0 ? prices[0].close : null;

  // ✅ Prefer quote fields for "Today"
  const livePrice =
    fundamentals.regular_market_price ?? lastCandleClose;

  const previousClose =
    fundamentals.regular_market_previous_close ?? prevCandleClose;

  // Today change (quote-based)
  let dailyChange = 0;
  let dailyChangePercent = 0;
  if (livePrice != null && previousClose != null && previousClose !== 0) {
    dailyChange = livePrice - previousClose;
    dailyChangePercent = (dailyChange / previousClose) * 100;
  }

  // Period change (chart-based)
  let periodChange = 0;
  let periodChangePercent = 0;
  if (livePrice != null && periodStartClose != null && periodStartClose !== 0) {
    periodChange = livePrice - periodStartClose;
    periodChangePercent = (periodChange / periodStartClose) * 100;
  }

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>{company.name || "—"}</h1>
            <span
              style={{
                background: "#3b82f6",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {company.ticker ?? "—"}
            </span>
          </div>
          <p style={{ margin: "8px 0 0", opacity: 0.7, fontSize: 14 }}>
            {company.sector ?? "—"} • {company.industry ?? "—"}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          {livePrice != null ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 600 }}>${livePrice.toFixed(2)}</div>

              {/* Market Status & Data Disclaimer Badges */}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: marketStatus.isOpen ? "rgba(34, 197, 94, 0.15)" : "rgba(136, 136, 136, 0.15)",
                    color: marketStatus.isOpen ? "#22c55e" : "#888",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title={marketStatus.nextEvent}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: marketStatus.isOpen ? "#22c55e" : "#666",
                  }} />
                  {marketStatus.status}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(136, 136, 136, 0.15)",
                    color: "#888",
                  }}
                  title="Price data may be delayed up to 15 minutes"
                >
                  Delayed 15m
                </span>
              </div>

              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}
              >
                <PriceChange change={dailyChange} percentChange={dailyChangePercent} label="Today" />
                <PriceChange change={periodChange} percentChange={periodChangePercent} label="Period" />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 18, opacity: 0.7 }}>—</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 32,
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid #333",
          flexWrap: "wrap",
        }}
      >
        <Stat label="Market Cap" value={formatMarketCap(company.market_cap)} />
        <Stat
          label="52W High"
          value={fundamentals.fifty_two_week_high != null ? `$${fundamentals.fifty_two_week_high.toFixed(2)}` : "—"}
        />
        <Stat
          label="52W Low"
          value={fundamentals.fifty_two_week_low != null ? `$${fundamentals.fifty_two_week_low.toFixed(2)}` : "—"}
        />
      </div>
    </div>
  );
}
