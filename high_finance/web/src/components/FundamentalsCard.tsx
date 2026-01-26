interface FundamentalsProps {
  data: {
    pe_ratio?: number;
    forward_pe?: number;
    eps?: number;
    dividend_yield?: number;
    revenue?: number;
    profit_margin?: number;
    beta?: number;
    fifty_day_avg?: number;
    two_hundred_day_avg?: number;
  };
}

function formatValue(value: number | undefined | null, type: "currency" | "percent" | "number" | "large"): string {
  if (value === undefined || value === null) return "—";
  
  switch (type) {
    case "currency":
      return `$${value.toFixed(2)}`;
    case "percent":
      return `${(value * 100).toFixed(2)}%`;
    case "large":
      if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      return `$${value.toLocaleString()}`;
    default:
      return value.toFixed(2);
  }
}

export function FundamentalsCard({ data }: FundamentalsProps) {
  const metrics = [
    { label: "P/E Ratio", value: formatValue(data.pe_ratio, "number"), hint: "Price to Earnings" },
    { label: "Forward P/E", value: formatValue(data.forward_pe, "number"), hint: "Expected P/E" },
    { label: "EPS", value: formatValue(data.eps, "currency"), hint: "Earnings Per Share" },
    { label: "Dividend Yield", value: data.dividend_yield ? formatValue(data.dividend_yield, "percent") : "No Dividend", hint: "Annual dividend %" },
    { label: "Revenue", value: formatValue(data.revenue, "large"), hint: "Total revenue" },
    { label: "Profit Margin", value: data.profit_margin ? formatValue(data.profit_margin, "percent") : "—", hint: "Net profit %" },
    { label: "Beta", value: formatValue(data.beta, "number"), hint: "Volatility vs market" },
    { label: "50D Avg", value: formatValue(data.fifty_day_avg, "currency"), hint: "50-day moving avg" },
    { label: "200D Avg", value: formatValue(data.two_hundred_day_avg, "currency"), hint: "200-day moving avg" },
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