import { useState } from "react";
import { api } from "./lib/api";
import { PriceChart } from "./components/PriceChart";
import { CompanyHeader } from "./components/CompanyHeader";
import { FundamentalsCard } from "./components/FundamentalsCard";
import { OwnershipTable } from "./components/OwnershipTable";
import { EarningsCard } from "./components/EarningsCard";
import { OptionsFlowCard } from "./components/OptionsFlowCard";
import { NewsCard } from "./components/NewsCard";
import { RiskCard } from "./components/RiskCard";
import { DCFCard } from "./components/DCFCard";



import { CompsTable } from "./components/CompsTableCard";
// Fix the types import
import type { CompsResponse, FinancialStatementsResponse } from "./lib/types";
import { LeadershipTable } from "./components/LeadershipTable";
import { FinancialStatements } from "./components/FinancialStatements";
import { PredictionCard } from "./components/PredictionCard";
import { SearchBar } from "./components/SearchBar";
import { PoliticianTradesCard } from "./components/PoliticianTradesCard";
import { InsiderTradingCard } from "./components/InsiderTradingCard";
import { InstitutionalFlowCard } from "./components/InstitutionalFlowCard";

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
      const [c, f, o, l, p, fin, cmp] = await Promise.all([
        api.company(t),
        api.fundamentals(t),
        api.ownership(t),
        api.leadership(t),
        api.prices(t, "1y"),
        api.financials(t),
        api.comps(t).catch(() => null),
      ]);

      setCompany(c);
      setFundamentals(f);
      setOwnership(o);
      setLeadership(l);
      setPrices(p);
      setFinancials(fin);
      setSearchedTicker(t);
      setComps(cmp);
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

        {/* Show data only when loaded */}
        {company && fundamentals && !loading && (
          <>
            <CompanyHeader 
              company={company} 
              fundamentals={fundamentals} 
              prices={prices} 
            />

            {/* Price Chart */}
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

            {/* ML Prediction */}
            <div style={{ marginBottom: 20 }}>
              <PredictionCard key={`pred-${searchedTicker}`} ticker={searchedTicker} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <DCFCard key={`dcf-${searchedTicker}`} ticker={searchedTicker} />
            <RiskCard key={`risk-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Two Column Layout: Fundamentals + Institutional Flow */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <FundamentalsCard data={fundamentals} />
              <InstitutionalFlowCard key={`inst-${searchedTicker}`} ticker={searchedTicker} />
            </div>
            {comps && (
                <div style={{ marginBottom: 16 }}>
                <CompsTable data={comps} />
                </div>
            )}

            {/* Two Column Layout: Insider + Politicians */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <InsiderTradingCard key={`insider-${searchedTicker}`} ticker={searchedTicker} />
              <PoliticianTradesCard key={`pol-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            <LeadershipTable data={leadership} />
             <div style={{ marginBottom: 20 }}>
                <EarningsCard key={`earnings-${searchedTicker}`} ticker={searchedTicker} />
            </div>
            <NewsCard ticker={searchedTicker} />

            <div style={{ marginBottom: 20 }}>
                <OptionsFlowCard key={`options-${searchedTicker}`} ticker={searchedTicker} />
            </div>

            {/* Financial Statements */}
            {financials && (
              <div style={{ marginTop: 16 }}>
                <FinancialStatements key={`fin-${searchedTicker}`} data={financials} ticker={searchedTicker} />
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!company && !loading && (
          <div style={{ 
            textAlign: "center", 
            padding: 80, 
            opacity: 0.6 
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>📈</div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>Enter a ticker symbol to get started</div>
            <div style={{ fontSize: 14 }}>Try AAPL, MSFT, GOOGL, or search "Microsoft", "Apple"...</div>
          </div>
        )}
      </div>
    </div>
  );
}