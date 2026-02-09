import { useState } from "react";
import type { ScreenerFilters } from "../../lib/types";
import { useIsMobile } from "../../lib/useIsMobile";

const SECTORS = [
  "Information Technology",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Energy",
  "Materials",
  "Real Estate",
  "Utilities",
  "Communication Services",
];

// Preset screens — teach users what the screener can do
const PRESETS: { label: string; filters: Partial<ScreenerFilters> }[] = [
  {
    label: "Large Cap Value",
    filters: { market_cap_min: 10000, pe_ratio_max: 20, dividend_yield_min: 0.02 },
  },
  {
    label: "GARP",
    filters: { revenue_growth_min: 0.15, forward_pe_max: 30 },
  },
  {
    label: "Insider Conviction",
    filters: { has_insider_buys_90d: true, insider_net_shares_90d_min: 10000 },
  },
  {
    label: "Congress Favorites",
    filters: { congress_net_value_90d_min: 50000 },
  },
  {
    label: "Beaten Down",
    filters: { price_vs_52w_high_max: -0.30 },
  },
];

type Props = {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onClear: () => void;
  onPreset: (preset: ScreenerFilters) => void;
  sectorCounts: Record<string, number>;
  liveCount: number | null;
  universeTotal: number;
};

type FilterSection = "valuation" | "quality" | "momentum" | "signals" | "sectors";

// Count active filters per section
function countSectionFilters(filters: ScreenerFilters, section: FilterSection): number {
  const keys: Record<FilterSection, (keyof ScreenerFilters)[]> = {
    valuation: [
      "market_cap_min", "market_cap_max", "pe_ratio_min", "pe_ratio_max",
      "forward_pe_min", "forward_pe_max", "pb_ratio_min", "pb_ratio_max",
      "ev_to_ebitda_min", "ev_to_ebitda_max", "dividend_yield_min", "dividend_yield_max",
    ],
    quality: [
      "roe_min", "roe_max", "profit_margin_min", "profit_margin_max",
      "debt_to_equity_min", "debt_to_equity_max", "fcf_yield_min", "fcf_yield_max",
      "beta_min", "beta_max",
    ],
    momentum: [
      "revenue_growth_min", "revenue_growth_max",
      "price_vs_200ma_min", "price_vs_200ma_max",
      "price_vs_52w_high_min", "price_vs_52w_high_max",
    ],
    signals: [
      "has_insider_buys_90d", "insider_net_shares_90d_min", "congress_net_value_90d_min",
    ],
    sectors: ["sectors"],
  };
  return (keys[section] || []).filter(k => filters[k] !== undefined).length;
}

export function ScreenerFiltersPanel({
  filters, onChange, onClear, onPreset, sectorCounts, liveCount, universeTotal,
}: Props) {
  const isMobile = useIsMobile();
  const [expandedSections, setExpandedSections] = useState<Set<FilterSection>>(
    new Set(["valuation", "sectors"])
  );

  const toggleSection = (section: FilterSection) => {
    const s = new Set(expandedSections);
    if (s.has(section)) s.delete(section); else s.add(section);
    setExpandedSections(s);
  };

  const updateFilter = (key: keyof ScreenerFilters, value: any) => {
    onChange({ ...filters, [key]: value === "" ? undefined : value });
  };

  const selectedSectors = filters.sectors?.split(",").filter(Boolean) ?? [];

  const toggleSector = (sector: string) => {
    const current = new Set(selectedSectors);
    if (current.has(sector)) current.delete(sector); else current.add(sector);
    updateFilter("sectors", Array.from(current).join(",") || undefined);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    background: "#222",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#fff",
    fontSize: 12,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#888",
    marginBottom: 4,
    display: "block",
  };

  const totalActiveFilters = Object.entries(filters).filter(
    ([k, v]) => v !== undefined && !["sort_by", "sort_order", "limit", "offset"].includes(k)
  ).length;

  const sectionHeader = (section: FilterSection, label: string) => {
    const count = countSectionFilters(filters, section);
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 0",
          cursor: "pointer",
          borderBottom: "1px solid #333",
        }}
        onClick={() => toggleSection(section)}
      >
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          {label}
          {count > 0 && (
            <span style={{
              background: "#3b82f6",
              padding: "1px 5px",
              borderRadius: 10,
              fontSize: 9,
              marginLeft: 6,
              color: "#fff",
            }}>
              {count}
            </span>
          )}
        </span>
        <span style={{ color: "#666" }}>{expandedSections.has(section) ? "−" : "+"}</span>
      </div>
    );
  };

  // Helper for min/max range input pair
  const rangeInput = (
    label: string,
    minKey: keyof ScreenerFilters,
    maxKey: keyof ScreenerFilters,
    opts?: { step?: string; pct?: boolean },
  ) => {
    const pct = opts?.pct;
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="number"
            step={opts?.step}
            placeholder="Min"
            value={pct && filters[minKey] != null ? Number(filters[minKey]) * 100 : (filters[minKey] as number ?? "")}
            onChange={e => {
              const raw = e.target.value ? Number(e.target.value) : undefined;
              updateFilter(minKey, raw != null && pct ? raw / 100 : raw);
            }}
            style={inputStyle}
          />
          <input
            type="number"
            step={opts?.step}
            placeholder="Max"
            value={pct && filters[maxKey] != null ? Number(filters[maxKey]) * 100 : (filters[maxKey] as number ?? "")}
            onChange={e => {
              const raw = e.target.value ? Number(e.target.value) : undefined;
              updateFilter(maxKey, raw != null && pct ? raw / 100 : raw);
            }}
            style={inputStyle}
          />
        </div>
        
      </div>
    );
  };

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      {/* Header with live count */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Filters
          {totalActiveFilters > 0 && (
            <span style={{
              background: "#3b82f6",
              padding: "2px 6px",
              borderRadius: 10,
              fontSize: 10,
              marginLeft: 6,
            }}>
              {totalActiveFilters}
            </span>
          )}
          {liveCount != null && (
            <span style={{ fontSize: 12, color: "#888", fontWeight: 400, marginLeft: 12 }}>
              {liveCount.toLocaleString()} {universeTotal > 0 ? `of ${universeTotal.toLocaleString()} stocks` : "matches"}
            </span>
          )}
        </span>
        <button
          onClick={onClear}
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid #444",
            borderRadius: 4,
            color: "#888",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Clear All
        </button>
      </div>

      {/* Presets */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: "1px solid #333",
      }}>
        <span style={{ fontSize: 11, color: "#666", alignSelf: "center", marginRight: 4 }}>Quick:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onPreset(p.filters)}
            style={{
              padding: "4px 10px",
              background: "#262626",
              border: "1px solid #444",
              borderRadius: 999,
              color: "#ccc",
              fontSize: 11,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={isMobile ? undefined : e => {
              (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={isMobile ? undefined : e => {
              (e.currentTarget as HTMLElement).style.borderColor = "#444";
              (e.currentTarget as HTMLElement).style.color = "#ccc";
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Valuation Section */}
      <div>
        {sectionHeader("valuation", "Valuation")}
        {expandedSections.has("valuation") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {rangeInput("Market Cap (M$)", "market_cap_min", "market_cap_max")}
            {rangeInput("P/E Ratio", "pe_ratio_min", "pe_ratio_max")}
            {rangeInput("Forward P/E", "forward_pe_min", "forward_pe_max")}
            {rangeInput("P/B Ratio", "pb_ratio_min", "pb_ratio_max")}
            {rangeInput("EV/EBITDA", "ev_to_ebitda_min", "ev_to_ebitda_max")}
            {rangeInput("Dividend Yield (%)", "dividend_yield_min", "dividend_yield_max", { step: "0.01", pct: true })}
          </div>
        )}
      </div>

      {/* Quality & Profitability Section */}
      <div>
        {sectionHeader("quality", "Quality & Profitability")}
        {expandedSections.has("quality") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {rangeInput("ROE (%)", "roe_min", "roe_max", { step: "0.01", pct: true })}
            {rangeInput("Profit Margin (%)", "profit_margin_min", "profit_margin_max", { step: "0.01", pct: true })}
            {rangeInput("Debt/Equity", "debt_to_equity_min", "debt_to_equity_max", { step: "0.1" })}
            {rangeInput("FCF Yield (%)", "fcf_yield_min", "fcf_yield_max", { step: "0.01", pct: true })}
            {rangeInput("Beta", "beta_min", "beta_max", { step: "0.1" })}
          </div>
        )}
      </div>

      {/* Momentum Section */}
      <div>
        {sectionHeader("momentum", "Momentum & Growth")}
        {expandedSections.has("momentum") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {rangeInput("Revenue Growth (%)", "revenue_growth_min", "revenue_growth_max", { step: "0.01", pct: true })}
            {rangeInput("Price vs 200MA (%)", "price_vs_200ma_min", "price_vs_200ma_max", { step: "0.01", pct: true })}
            {rangeInput("% from 52W High", "price_vs_52w_high_min", "price_vs_52w_high_max", { step: "0.01", pct: true })}
          </div>
        )}
      </div>

      {/* Smart Money Signals */}
      <div>
        {sectionHeader("signals", "Smart Money Signals")}
        {expandedSections.has("signals") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={filters.has_insider_buys_90d === true}
                  onChange={e => updateFilter("has_insider_buys_90d", e.target.checked ? true : undefined)}
                  style={{ accentColor: "#3b82f6" }}
                />
                Has Insider Buys (90d)
              </label>
            </div>
            <div>
              <label style={labelStyle}>Min Insider Net Shares (90d)</label>
              <input
                type="number"
                placeholder="e.g., 1000"
                value={filters.insider_net_shares_90d_min ?? ""}
                onChange={e => updateFilter("insider_net_shares_90d_min", e.target.value ? Number(e.target.value) : undefined)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Min Congress Net Value ($)</label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={filters.congress_net_value_90d_min ?? ""}
                onChange={e => updateFilter("congress_net_value_90d_min", e.target.value ? Number(e.target.value) : undefined)}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sectors */}
      <div>
        {sectionHeader("sectors", "Sectors")}
        {expandedSections.has("sectors") && (
          <div style={{ padding: "12px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SECTORS.map(sector => {
              const isSelected = selectedSectors.includes(sector);
              const count = sectorCounts[sector] ?? 0;
              return (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector)}
                  style={{
                    padding: "4px 10px",
                    background: isSelected ? "#3b82f6" : "#333",
                    border: isSelected ? "1px solid #3b82f6" : "1px solid #444",
                    borderRadius: 999,
                    color: isSelected ? "#fff" : "#aaa",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {sector} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
