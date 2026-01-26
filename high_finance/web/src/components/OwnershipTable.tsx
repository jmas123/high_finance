interface Holder {
  holder?: string;
  shares?: number;
  value?: number;
  percent_out?: number;
  date_reported?: string;
}

interface OwnershipTableProps {
  data: Holder[];
}

function formatShares(value: number | undefined): string {
  if (!value) return "—";
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatValue(value: number | undefined): string {
  if (!value) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

export function OwnershipTable({ data }: OwnershipTableProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Institutional Ownership</h3>
        <div style={{ opacity: 0.6 }}>No ownership data available</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Institutional Ownership</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #444" }}>
            <th style={{ textAlign: "left", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Holder</th>
            <th style={{ textAlign: "right", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Shares</th>
            <th style={{ textAlign: "right", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Value</th>
            <th style={{ textAlign: "right", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>% Held</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((holder, i) => (
            <tr 
              key={i} 
              style={{ 
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"}
            >
              <td style={{ padding: "12px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {holder.holder || "—"}
              </td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatShares(holder.shares)}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatValue(holder.value)}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace" }}>
                {holder.percent_out ? `${(holder.percent_out * 100).toFixed(2)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}