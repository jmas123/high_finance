// src/components/CompanyHeader.tsx

import React from "react";

interface CompanyHeaderProps {
  company: {
    name?: string;
    ticker?: string;
    sector?: string;
    industry?: string;
    market_cap?: number;
  };
  fundamentals: {
    fifty_two_week_high?: number;
    fifty_two_week_low?: number;

    // ✅ Add these (preferred) so "Today" matches Yahoo more closely
    regular_market_price?: number;
    regular_market_previous_close?: number;
  };
  prices: Array<{ close: number; open: number }>;
}

function formatMarketCap(value: number | undefined): string {
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
  if (livePrice != null && previousClose != null) {
    dailyChange = livePrice - previousClose;
    dailyChangePercent = (dailyChange / previousClose) * 100;
  }

  // Period change (chart-based)
  let periodChange = 0;
  let periodChangePercent = 0;
  if (livePrice != null && periodStartClose != null) {
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

              {/* Optional debug line (remove anytime) */}
              {/* <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
                prevClose: {previousClose?.toFixed?.(2) ?? "—"} | lastCandle: {lastCandleClose?.toFixed?.(2) ?? "—"}
              </div> */}
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
