import { useIsMobile } from "../lib/useIsMobile";
import { MobileCardRow, MobileCardField } from "./common/MobileCard";

interface Leader {
  name?: string;
  title?: string;
  age?: number;
  total_pay?: number;
}

interface LeadershipTableProps {
  data: Leader[];
}

function formatPay(value: number | undefined): string {
  if (!value) return "—";
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

export function LeadershipTable({ data }: LeadershipTableProps) {
  const isMobile = useIsMobile();

  if (!data || data.length === 0) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Leadership</h3>
        <div style={{ opacity: 0.6 }}>No leadership data available</div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Leadership</h3>
        {data.slice(0, 10).map((leader, i) => (
          <MobileCardRow key={`${leader.name ?? "unknown"}-${i}`}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{leader.name || "—"}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{leader.title || "—"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <MobileCardField label="Age" value={leader.age || "—"} />
              <MobileCardField label="Total Pay" value={
                <span style={{ color: leader.total_pay ? "#22c55e" : "inherit" }}>
                  {formatPay(leader.total_pay)}
                </span>
              } />
            </div>
          </MobileCardRow>
        ))}
      </div>
    );
  }

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Leadership</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #444" }}>
            <th style={{ textAlign: "left", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Name</th>
            <th style={{ textAlign: "left", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Title</th>
            <th style={{ textAlign: "right", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Age</th>
            <th style={{ textAlign: "right", padding: "10px 8px", opacity: 0.6, fontWeight: 500, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Pay</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((leader, i) => (
            <tr
              key={`${leader.name ?? 'unknown'}-${i}`}
              style={{ 
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={isMobile ? undefined : (e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={isMobile ? undefined : (e) => e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"}
            >
              <td style={{ padding: "12px 8px", fontWeight: 500 }}>{leader.name || "—"}</td>
              <td style={{ padding: "12px 8px", opacity: 0.8 }}>{leader.title || "—"}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace" }}>{leader.age || "—"}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontFamily: "monospace", color: leader.total_pay ? "#22c55e" : "inherit" }}>
                {formatPay(leader.total_pay)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}