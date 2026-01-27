import { useState } from "react";
import { api } from "../lib/api";
import type { FinancialStatementsResponse } from "../lib/types";

interface FinancialStatementsProps {
  data: FinancialStatementsResponse;
  ticker: string;
}

const TABS = [
  { key: "income_statement", label: "Income Statement" },
  { key: "balance_sheet", label: "Balance Sheet" },
  { key: "cash_flow", label: "Cash Flow" },
];

const KEY_METRICS: Record<string, string[]> = {
  income_statement: [
    "Total Revenue",
    "Gross Profit",
    "Operating Income",
    "Net Income",
    "EBITDA",
    "Basic EPS",
    "Diluted EPS",
  ],
  balance_sheet: [
    "Total Assets",
    "Total Liabilities Net Minority Interest",
    "Total Equity Gross Minority Interest",
    "Total Debt",
    "Cash And Cash Equivalents",
    "Working Capital",
  ],
  cash_flow: [
    "Operating Cash Flow",
    "Investing Cash Flow",
    "Financing Cash Flow",
    "Free Cash Flow",
    "Capital Expenditure",
  ],
};

function formatValue(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  
  if (absValue >= 1e12) return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
  if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
  return `${sign}$${absValue.toFixed(2)}`;
}

function formatDate(dateStr: string, period: "quarterly" | "annual"): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11

  if (period === "annual") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }

  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year}`;
}


export function FinancialStatements({ data, ticker }: FinancialStatementsProps) {
  const [activeTab, setActiveTab] = useState("income_statement");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"quarterly" | "annual">("quarterly");

  

const statementData =
  data?.[period]?.[activeTab as keyof typeof data.annual] ?? {};
  const dates = Object.keys(statementData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  const allKeys = new Set<string>();
  dates.forEach(date => {
    Object.keys(statementData[date] || {}).forEach(key => allKeys.add(key));
  });

  const keyMetrics = KEY_METRICS[activeTab] || [];
  const displayKeys = keyMetrics.filter(k => allKeys.has(k));
  const otherKeys = Array.from(allKeys).filter(k => !keyMetrics.includes(k)).sort();

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await api.analyzeFinancials(ticker);
      setAnalysis(result.analysis);
    } catch (e: any) {
      setAnalysisError(e?.message ?? "Failed to generate analysis");
    } finally {
      setAnalyzing(false);
    }
  }

  if (dates.length === 0) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Financial Statements</h3>
        <div style={{ opacity: 0.6 }}>No financial data available</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Financial Statements</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  background: activeTab === tab.key ? "#3b82f6" : "#2d2d2d",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
                onClick={() => setPeriod("quarterly")}
                style={{
                padding: "6px 10px",
                fontSize: 13,
                cursor: "pointer",
                background: period === "quarterly" ? "#3b82f6" : "#2d2d2d",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                }}
            >
                Quarterly
            </button>

            <button
                onClick={() => setPeriod("annual")}
                style={{
                padding: "6px 10px",
                fontSize: 13,
                cursor: "pointer",
                background: period === "annual" ? "#3b82f6" : "#2d2d2d",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                }}
            >
                Yearly
            </button>
            </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              cursor: analyzing ? "wait" : "pointer",
              background: analysis ? "#22c55e" : "#8b5cf6",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: analyzing ? 0.7 : 1,
            }}
          >
            <span>✨</span>
            {analyzing ? "Analyzing..." : analysis ? "Re-analyze" : "AI Analysis"}
          </button>
        </div>
      </div>

      {/* AI Analysis Section */}
      {analysisError && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 14,
          color: "#ef4444"
        }}>
          {analysisError}
        </div>
      )}
      
      {analysis && (
        <div style={{
          background: "rgba(139, 92, 246, 0.1)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8, 
            marginBottom: 12,
            fontSize: 14,
            fontWeight: 600,
            color: "#8b5cf6"
          }}>
            <span>✨</span> AI Analysis
          </div>
          <div style={{ 
            fontSize: 14, 
            lineHeight: 1.7, 
            whiteSpace: "pre-wrap",
            opacity: 0.9 
          }}>
            {analysis}
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #444" }}>
              <th style={{ 
                textAlign: "left", 
                padding: "10px 8px", 
                opacity: 0.6, 
                fontWeight: 500, 
                fontSize: 11, 
                textTransform: "uppercase",
                position: "sticky",
                left: 0,
                background: "#1a1a1a",
                minWidth: 200
              }}>
                Metric
              </th>
              {dates.slice(0, 4).map((date) => (
                <th 
                  key={date} 
                  style={{ 
                    textAlign: "right", 
                    padding: "10px 8px", 
                    opacity: 0.6, 
                    fontWeight: 500, 
                    fontSize: 11, 
                    textTransform: "uppercase",
                    minWidth: 100
                  }}
                >
                  {formatDate(date, period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayKeys.map((key, i) => (
              <tr 
                key={key}
                style={{ 
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  borderBottom: "1px solid #222"
                }}
              >
                <td style={{ 
                  padding: "10px 8px", 
                  fontWeight: 500,
                  position: "sticky",
                  left: 0,
                  background: i % 2 === 0 ? "#1a1a1a" : "#1d1d1d",
                }}>
                  {key}
                </td>
                {dates.slice(0, 4).map((date) => (
                  <td 
                    key={date} 
                    style={{ 
                      padding: "10px 8px", 
                      textAlign: "right", 
                      fontFamily: "monospace",
                      color: statementData[date]?.[key] < 0 ? "#ef4444" : "inherit"
                    }}
                  >
                    {formatValue(statementData[date]?.[key])}
                  </td>
                ))}
              </tr>
            ))}
            
            {displayKeys.length > 0 && otherKeys.length > 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "8px", opacity: 0.4, fontSize: 11, textTransform: "uppercase" }}>
                  Other Metrics
                </td>
              </tr>
            )}
            
            {otherKeys.map((key, i) => (
              <tr 
                key={key}
                style={{ 
                  background: (displayKeys.length + i) % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  borderBottom: "1px solid #222"
                }}
              >
                <td style={{ 
                  padding: "10px 8px",
                  position: "sticky",
                  left: 0,
                  background: (displayKeys.length + i) % 2 === 0 ? "#1a1a1a" : "#1d1d1d",
                  opacity: 0.8
                }}>
                  {key}
                </td>
                {dates.slice(0, 4).map((date) => (
                  <td 
                    key={date} 
                    style={{ 
                      padding: "10px 8px", 
                      textAlign: "right", 
                      fontFamily: "monospace",
                      color: statementData[date]?.[key] < 0 ? "#ef4444" : "inherit"
                    }}
                  >
                    {formatValue(statementData[date]?.[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}