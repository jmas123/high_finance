


interface FundamentalsProps {
  data: {
    pe_ratio?: number | null;
    forward_pe?: number | null;
    eps?: number | null;
    dividend_yield?: number | null;
    revenue?: number | null;
    profit_margin?: number | null;
    beta?: number | null;
    fifty_day_avg?: number | null;
    two_hundred_day_avg?: number | null;
    ev_to_ebitda?: number | null;
    revenue_growth?: number | null;
  };
}

function formatValue(value: number | undefined | null, type: "currency" | "percent" | "number" | "large"): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  switch (type) {
    case "currency":
      return `${sign}$${absValue.toFixed(2)}`;
    case "percent":
      return `${sign}${(absValue * 100).toFixed(2)}%`;
    case "large":
      if (absValue >= 1e12) return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
      if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
      if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
      return `${sign}$${absValue.toLocaleString()}`;
    default:
      return value.toFixed(2);
  }
}

export function FundamentalsCard({ data }: FundamentalsProps) {
  // This array controls what actually appears on the screen.
  // I added the new fields here:
  const metrics = [
    { label: "P/E Ratio", value: formatValue(data.pe_ratio, "number"), hint: "Price to Earnings" },
    { label: "Forward P/E", value: formatValue(data.forward_pe, "number"), hint: "Expected P/E" },
    
    // --- NEW METRICS ADDED HERE ---
    { label: "EV / EBITDA", value: formatValue(data.ev_to_ebitda, "number"), hint: "Enterprise Val / EBITDA" },
    { label: "Rev Growth", value: data.revenue_growth ? formatValue(data.revenue_growth, "percent") : "—", hint: "Year over Year" },
    // ------------------------------

    { label: "EPS", value: formatValue(data.eps, "currency"), hint: "Earnings Per Share" },
    { label: "Dividend Yield", value: data.dividend_yield ? formatValue(data.dividend_yield, "percent") : "No Dividend", hint: "Annual dividend %" },
    { label: "Revenue", value: formatValue(data.revenue, "large"), hint: "Total revenue" },
    { label: "Profit Margin", value: data.profit_margin ? formatValue(data.profit_margin, "percent") : "—", hint: "Net profit %" },
    { label: "Beta", value: formatValue(data.beta, "number"), hint: "Volatility vs market" },
  ];

  return (
    <div style={{ 
      background: "#1a1a1a", 
      border: "1px solid #333", 
      borderRadius: 10, 
      padding: 16 
    }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Fundamentals</h3>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr 1fr", 
        gap: 4
      }}>
        {metrics.map((m, i) => (
          <div 
            key={m.label}
            style={{ 
              padding: "12px",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              borderRadius: 6
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "monospace" }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}