import type { ValuationBundle } from "../../lib/types";
import { fmtPx, fmtPctSigned } from "../Functions";
import { useIsMobile } from "../../lib/useIsMobile";
import { MobileCardRow, MobileCardField } from "../common/MobileCard";

export function MultiplesTable({ multiples, currentPrice }: { multiples: ValuationBundle["multiples"]; currentPrice: number | null }) {
  const isMobile = useIsMobile();

  if (!multiples?.implied_values?.length) {
    return <div style={{ opacity: 0.5, fontSize: 12 }}>No multiples data available</div>;
  }

  if (isMobile) {
    return (
      <div>
        {multiples.implied_values.map((item, i) => {
          const upside = currentPrice != null && currentPrice !== 0 ? (item.fair_value - currentPrice) / currentPrice : null;
          return (
            <MobileCardRow key={`${item.method}-${i}`}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                {item.method}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: currentPrice != null && currentPrice !== 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
                <MobileCardField label="Multiple" value={`${item.multiple.toFixed(1)}x`} />
                <MobileCardField label="Fair Value" value={fmtPx(item.fair_value)} />
                {currentPrice != null && currentPrice !== 0 && upside !== null && (
                  <MobileCardField label="vs Current" value={
                    <span style={{ color: upside >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                      {fmtPctSigned(upside)}
                    </span>
                  } />
                )}
              </div>
            </MobileCardRow>
          );
        })}
        {multiples.multiples_summary && (
          <div style={{ marginTop: 8, fontSize: 10, opacity: 0.5 }}>
            Sector multiples: {multiples.multiples_summary.sector} / {multiples.multiples_summary.industry}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Method</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Multiple</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Fair Value</th>
            {currentPrice != null && currentPrice !== 0 && <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>vs Current</th>}
          </tr>
        </thead>
        <tbody>
          {multiples.implied_values.map((item, i) => {
            const upside = currentPrice != null && currentPrice !== 0 ? (item.fair_value - currentPrice) / currentPrice : null;
            return (
              <tr key={`${item.method}-${i}`} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "10px 0", fontWeight: 500 }}>{item.method}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{item.multiple.toFixed(1)}×</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>{fmtPx(item.fair_value)}</td>
                {currentPrice != null && currentPrice !== 0 && upside !== null && (
                  <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600, color: upside >= 0 ? "#22c55e" : "#ef4444" }}>
                    {fmtPctSigned(upside)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {multiples.multiples_summary && (
        <div style={{ marginTop: 8, fontSize: 10, opacity: 0.5 }}>
          Sector multiples: {multiples.multiples_summary.sector} / {multiples.multiples_summary.industry}
        </div>
      )}
    </div>
  );
}
