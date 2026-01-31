import type { ValuationBundle, SensitivityItem } from "../../lib/types";
import { fmtPx, fmtPctSigned } from "../Functions";

export function MultiplesTable({ multiples, currentPrice }: { multiples: ValuationBundle["multiples"]; currentPrice: number | null }) {
  if (!multiples?.implied_values?.length) {
    return <div style={{ opacity: 0.5, fontSize: 12 }}>No multiples data available</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Method</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Multiple</th>
            <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>Fair Value</th>
            {currentPrice && <th style={{ textAlign: "right", padding: "8px 0", opacity: 0.6, fontWeight: 500 }}>vs Current</th>}
          </tr>
        </thead>
        <tbody>
          {multiples.implied_values.map((item, i) => {
            const upside = currentPrice ? (item.fair_value - currentPrice) / currentPrice : null;
            return (
              <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "10px 0", fontWeight: 500 }}>{item.method}</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{item.multiple.toFixed(1)}×</td>
                <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 }}>{fmtPx(item.fair_value)}</td>
                {currentPrice && upside !== null && (
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
