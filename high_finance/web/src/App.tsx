import { useState } from "react";
import { api } from "./lib/api";
import { PriceChart } from "./components/PriceChart";
import { CompanyHeader } from "./components/CompanyHeader";
import { FundamentalsCard } from "./components/FundamentalsCard";
import { EarningsCard } from "./components/earnings/EarningsCard";
import { NewsCard } from "./components/NewsCard";
import { RiskCard } from "./components/risk/RiskCard";
import { OptionsFlowCard } from "./components/options/OptionsFlowCard";
import { OptionDecaySimulator } from "./components/options/OptionsDecaySimulator";
import { DCFCard } from "./components/valuation/DCFCard";
import { NotificationsCard } from "./components/politicians/NotificationsCard";
import { CompsTable } from "./components/CompsTableCard";
import type { CompsResponse, FinancialStatementsResponse } from "./lib/types";
import { LeadershipTable } from "./components/LeadershipTable";
import { FinancialStatements } from "./components/FinancialStatements";
import { PredictionCard } from "./components/PredictionCard";
import { SearchBar } from "./components/SearchBar";
import { PoliticianTradesCard } from "./components/politicians/PoliticianTradesCard";
import { InsiderTradingCard } from "./components/InsiderTradingCard";
import { InstitutionalFlowCard } from "./components/InstitutionalFlowCard";
import BroaderMarketContext from "./components/market_context/BroaderMarketContextCard";

export default function App() {
  const [searchedTicker, setSearchedTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<any>(null);
  const [fundamentals, setFundamentals] = useState<any>(null);
  const [ownership, setOwnership] = useState<any[]>([]);
  const [comps, setComps] = useState<CompsResponse | null>(null);
  const [leadership, setLeadership] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [financials, setFinancials] = useState<FinancialStatementsResponse | null>(null);
  const [view, setView] = useState<"ticker" | "notifications">("ticker");

  // Determine if current ticker is an ETF
   const isETF = fundamentals?.is_etf === true;
   const sector = fundamentals?.sector
  const isMutualFund = fundamentals?.is_mutual_fund === true;
  const isStock = fundamentals && !isETF && !isMutualFund;
 console.log("fundamentals", fundamentals);
console.log("flags", {
  ticker: fundamentals?.ticker,
  is_etf: fundamentals?.is_etf,
  is_mutual_fund: fundamentals?.is_mutual_fund,
  quote_type: fundamentals?.quote_type,
});
 

  async function loadTicker(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;

    setLoading(true);
    setError(null);
    
    setCompany(null);
    setFundamentals(null);
    setOwnership([]);
    setLeadership([]);
    setPrices([]);
    setFinancials(null);
    setComps(null);

    try {
      // Always load these (work for both stocks and ETFs)
      const [c, f, p] = await Promise.all([
        api.company(t),
        api.fundamentals(t),
        api.prices(t, "1y"),
      ]);

      setCompany(c);
      setFundamentals(f);
      setPrices(p);
      setSearchedTicker(t);

      // Only load stock-specific data if NOT an ETF
      const isEtfOrFund = f?.is_etf || f?.is_mutual_fund;
      
      if (!isEtfOrFund) {
        // Load stock-specific data
        const [o, l, fin, cmp] = await Promise.all([
          api.ownership(t).catch(() => []),
          api.leadership(t).catch(() => []),
          api.financials(t).catch(() => null),
          api.comps(t).catch(() => null),
        ]);

        setOwnership(o);
        setLeadership(l);
        setFinancials(fin);
        setComps(cmp);
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrices(period: string) {
    if (!searchedTicker) return;
    try {
      const p = await api.prices(searchedTicker, period);
      setPrices(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load prices");
    }
  }

  return (
    <div style={{ 
      width: "100%",
      minHeight: "100vh", 
      background: "#111", 
      color: "#fff",
      fontFamily: "system-ui, -apple-system, sans-serif", 
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
      }}>
        {/* Search Bar */}
        <div style={{ marginBottom: 24 }}>
          <SearchBar onSelect={loadTicker} loading={loading} />
        </div>

        {error && (
          <div style={{ 
            marginBottom: 20, 
            padding: 12, 
            background: "#3b1818", 
            border: "1px solid #7f1d1d", 
            borderRadius: 8 
          }}>
            <b>Error:</b> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setView("ticker")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: view === "ticker" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Ticker
          </button>

          <button
            onClick={() => setView("notifications")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: view === "notifications" ? "#222" : "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Notifications
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ 
            textAlign: "center", 
            padding: 80, 
            opacity: 0.6 
          }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
            <div style={{ fontSize: 18 }}>Loading data...</div>
          </div>
        )}

        {view === "notifications" && !loading && (
          <div style={{ marginBottom: 20 }}>
            <NotificationsCard />
          </div>
        )}

        {/* Show data only when loaded */}
        {view === "ticker" && company && fundamentals && !loading && (
          <>
            {/* ETF Badge */}
            {isETF && (
              <div style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "#3b82f6",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}>
                📊 ETF
              </div>
            )}

            <CompanyHeader 
              company={company} 
              fundamentals={fundamentals} 
              prices={prices} 
            />

            {/* Price Chart - Always show */}
            {prices.length > 0 && (
              <div style={{ 
                marginBottom: 20,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 10,
                padding: 16
              }}>
                <PriceChart 
                  data={prices} 
                  ticker={searchedTicker} 
                  onPeriodChange={loadPrices} 
                />
              </div>
            )}

            {/* ==================== */}
            {/* STOCK-ONLY SECTIONS */}
            {/* ==================== */}
            {isStock && (
              <>
                {/* ML Prediction */}
                <div style={{ marginBottom: 20 }}>
                  <PredictionCard key={`pred-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* DCF + Risk (side by side) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <DCFCard key={`dcf-${searchedTicker}`} ticker={searchedTicker} />
                  <RiskCard key={`risk-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* Fundamentals + Institutional Flow */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <FundamentalsCard data={fundamentals} />
                  <InstitutionalFlowCard key={`inst-${searchedTicker}`} ticker={searchedTicker} />
                </div>

                {/* Comps Table */}
                {comps && (
                  <div style={{ marginBottom: 16 }}>
                    <CompsTable data={comps} />
                  </div>
                )}
                <div style={{ 
                    marginBottom: 20,
                    background: "#1a1a1a", // Matches your PriceChart/Cards
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: 20 
                    }}>
                    <BroaderMarketContext
                        ticker={searchedTicker}
                        sector={sector}
                        showMacro={true}
                        showSectors={true}
                        showRateImpact={true}
                    />
                    </div>

                {/* Insider + Politicians */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <InsiderTradingCard key={`insider-${searchedTicker}`} ticker={searchedTicker} />
                  <PoliticianTradesCard key={`pol-${searchedTicker}`} ticker={searchedTicker} />
                </div>



                {/* Leadership */}
                {leadership.length > 0 && (
                  <LeadershipTable data={leadership} />
                )}

                {/* Earnings */}
                <div style={{ marginBottom: 20 }}>
                  <EarningsCard key={`earnings-${searchedTicker}`} ticker={searchedTicker} />
                </div>
              </>
            )}

            {/* ==================== */}
            {/* ETF-ONLY SECTIONS */}
            {/* ==================== */}
            {isETF && (
              <>
                {/* ETF Fundamentals Card */}
                <div style={{ marginBottom: 20 }}>
                  <ETFFundamentalsCard data={fundamentals} />
                  
                </div>

                {/* Risk Card - Works for ETFs too */}
                <div style={{ marginBottom: 20 }}>
                  <RiskCard key={`risk-${searchedTicker}`} ticker={searchedTicker} />
                </div>
              </>
            )}

            {/* ==================== */}
            {/* SHARED SECTIONS */}
            {/* ==================== */}
            
            {/* News - Works for both */}
            <NewsCard ticker={searchedTicker} />

            {/* Options - Works for both (most ETFs have options) */}
            <div style={{ marginBottom: 20 }}>
              <OptionsFlowCard key={`options-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Option Decay Simulator - Works for both */}
            <div style={{ marginBottom: 20 }}>
              <OptionDecaySimulator key={`decay-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Financial Statements - Stock only */}
            {isStock && financials && (
              <div style={{ marginTop: 16 }}>
                <FinancialStatements key={`fin-${searchedTicker}`} data={financials} ticker={searchedTicker} />
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {view === "ticker" && !company && !loading && (
          <div style={{ 
            textAlign: "center", 
            padding: 80, 
            opacity: 0.6 
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📈</div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>Enter a ticker symbol to get started</div>
            <div style={{ fontSize: 14 }}>Try AAPL, MSFT, GOOGL, VOO, SPY...</div>
          </div>
        )}
      </div>
    </div>
  );
}


// ==========================================
// ETF FUNDAMENTALS CARD COMPONENT
// ==========================================
function ETFFundamentalsCard({ data }: { data: any }) {
  if (!data) return null;

  const formatPercent = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatMoney = (val: number | null) => {
    if (val === null || val === undefined) return "—";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div style={{
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
        📊 ETF Overview
      </div>

      {/* Fund Info */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr", 
        gap: 12,
        marginBottom: 16 
      }}>
        {data.fund_family && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Fund Family</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{data.fund_family}</div>
          </div>
        )}
        {data.category && (
          <div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Category</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{data.category}</div>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 12,
        padding: 12,
        background: "rgba(59, 130, 246, 0.05)",
        borderRadius: 8,
        border: "1px solid rgba(59, 130, 246, 0.1)",
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Total Assets (AUM)</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatMoney(data.total_assets)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Expense Ratio</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: data.expense_ratio && data.expense_ratio < 0.002 ? "#22c55e" : "#fff" }}>
            {data.expense_ratio !== null ? `${(data.expense_ratio * 100).toFixed(2)}%` : "—"}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Dividend Yield</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatPercent(data.yield)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Holdings</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {data.holdings_count ?? "—"}
          </div>
        </div>
      </div>

      {/* Performance */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, textTransform: "uppercase" }}>
          Performance
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}>
          <div style={{
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>YTD Return</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 600,
              color: data.ytd_return > 0 ? "#22c55e" : data.ytd_return < 0 ? "#ef4444" : "#fff"
            }}>
              {formatPercent(data.ytd_return)}
            </div>
          </div>

          <div style={{
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>3-Year Avg</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 600,
              color: data.three_year_return > 0 ? "#22c55e" : data.three_year_return < 0 ? "#ef4444" : "#fff"
            }}>
              {formatPercent(data.three_year_return)}
            </div>
          </div>

          <div style={{
            padding: 12,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>5-Year Avg</div>
            <div style={{ 
              fontSize: 16, 
              fontWeight: 600,
              color: data.five_year_return > 0 ? "#22c55e" : data.five_year_return < 0 ? "#ef4444" : "#fff"
            }}>
              {formatPercent(data.five_year_return)}
            </div>
          </div>
        </div>
      </div>

      {/* Beta */}
      {data.beta && (
        <div style={{ 
          marginTop: 12, 
          fontSize: 12, 
          opacity: 0.6,
          textAlign: "center" 
        }}>
          Beta: <span style={{ color: "#fff", fontWeight: 500 }}>{data.beta.toFixed(2)}</span>
          {data.beta < 1 ? " (Less volatile than market)" : " (More volatile than market)"}
        </div>
      )}
    </div>
  );
}