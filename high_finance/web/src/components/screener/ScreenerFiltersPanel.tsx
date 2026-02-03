import { useState } from "react";
import type { ScreenerFilters } from "../../lib/types";

// GICS Sector names (as used by S&P 500)
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

type Props = {
  filters: ScreenerFilters;
  onChange: (filters: ScreenerFilters) => void;
  onApply: () => void;
  onClear: () => void;
  sectorCounts: Record<string, number>;
};

type FilterSection = "valuation" | "momentum" | "signals" | "sectors";

export function ScreenerFiltersPanel({ filters, onChange, onApply, onClear, sectorCounts }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<FilterSection>>(
    new Set(["valuation", "sectors"])
  );

  const toggleSection = (section: FilterSection) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const updateFilter = (key: keyof ScreenerFilters, value: any) => {
    onChange({ ...filters, [key]: value === "" ? undefined : value });
  };

  const selectedSectors = filters.sectors?.split(",").filter(Boolean) ?? [];

  const toggleSector = (sector: string) => {
    const current = new Set(selectedSectors);
    if (current.has(sector)) {
      current.delete(sector);
    } else {
      current.add(sector);
    }
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

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    cursor: "pointer",
    borderBottom: "1px solid #333",
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([k, v]) => v !== undefined && !["sort_by", "sort_order", "limit", "offset"].includes(k)
  ).length;

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Filters {activeFiltersCount > 0 && (
            <span style={{
              background: "#3b82f6",
              padding: "2px 6px",
              borderRadius: 10,
              fontSize: 10,
              marginLeft: 6,
            }}>
              {activeFiltersCount}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
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
          <button
            onClick={onApply}
            style={{
              padding: "6px 12px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Valuation Section */}
      <div>
        <div style={sectionHeaderStyle} onClick={() => toggleSection("valuation")}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Valuation</span>
          <span style={{ color: "#666" }}>{expandedSections.has("valuation") ? "−" : "+"}</span>
        </div>
        {expandedSections.has("valuation") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Market Cap (M$)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.market_cap_min ?? ""}
                  onChange={e => updateFilter("market_cap_min", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.market_cap_max ?? ""}
                  onChange={e => updateFilter("market_cap_max", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>P/E Ratio</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.pe_ratio_min ?? ""}
                  onChange={e => updateFilter("pe_ratio_min", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.pe_ratio_max ?? ""}
                  onChange={e => updateFilter("pe_ratio_max", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Forward P/E</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.forward_pe_min ?? ""}
                  onChange={e => updateFilter("forward_pe_min", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.forward_pe_max ?? ""}
                  onChange={e => updateFilter("forward_pe_max", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>P/B Ratio</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.pb_ratio_min ?? ""}
                  onChange={e => updateFilter("pb_ratio_min", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.pb_ratio_max ?? ""}
                  onChange={e => updateFilter("pb_ratio_max", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>EV/EBITDA</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.ev_to_ebitda_min ?? ""}
                  onChange={e => updateFilter("ev_to_ebitda_min", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.ev_to_ebitda_max ?? ""}
                  onChange={e => updateFilter("ev_to_ebitda_max", e.target.value ? Number(e.target.value) : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Dividend Yield (%)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={filters.dividend_yield_min != null ? filters.dividend_yield_min * 100 : ""}
                  onChange={e => updateFilter("dividend_yield_min", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={filters.dividend_yield_max != null ? filters.dividend_yield_max * 100 : ""}
                  onChange={e => updateFilter("dividend_yield_max", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Momentum Section */}
      <div>
        <div style={sectionHeaderStyle} onClick={() => toggleSection("momentum")}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Momentum & Growth</span>
          <span style={{ color: "#666" }}>{expandedSections.has("momentum") ? "−" : "+"}</span>
        </div>
        {expandedSections.has("momentum") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Revenue Growth (%)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={filters.revenue_growth_min != null ? filters.revenue_growth_min * 100 : ""}
                  onChange={e => updateFilter("revenue_growth_min", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={filters.revenue_growth_max != null ? filters.revenue_growth_max * 100 : ""}
                  onChange={e => updateFilter("revenue_growth_max", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Price vs 200MA (%)</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={filters.price_vs_200ma_min != null ? filters.price_vs_200ma_min * 100 : ""}
                  onChange={e => updateFilter("price_vs_200ma_min", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={filters.price_vs_200ma_max != null ? filters.price_vs_200ma_max * 100 : ""}
                  onChange={e => updateFilter("price_vs_200ma_max", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>% from 52W High</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={filters.price_vs_52w_high_min != null ? filters.price_vs_52w_high_min * 100 : ""}
                  onChange={e => updateFilter("price_vs_52w_high_min", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={filters.price_vs_52w_high_max != null ? filters.price_vs_52w_high_max * 100 : ""}
                  onChange={e => updateFilter("price_vs_52w_high_max", e.target.value ? Number(e.target.value) / 100 : undefined)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smart Money Signals */}
      <div>
        <div style={sectionHeaderStyle} onClick={() => toggleSection("signals")}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Smart Money Signals</span>
          <span style={{ color: "#666" }}>{expandedSections.has("signals") ? "−" : "+"}</span>
        </div>
        {expandedSections.has("signals") && (
          <div style={{ padding: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
        <div style={sectionHeaderStyle} onClick={() => toggleSection("sectors")}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>
            Sectors {selectedSectors.length > 0 && (
              <span style={{ color: "#3b82f6" }}>({selectedSectors.length})</span>
            )}
          </span>
          <span style={{ color: "#666" }}>{expandedSections.has("sectors") ? "−" : "+"}</span>
        </div>
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
