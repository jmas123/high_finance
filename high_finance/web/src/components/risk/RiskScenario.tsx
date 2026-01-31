import { fmtPrice, fmtPctSigned } from "../Functions";
export function ScenarioCard({
  label,
  returnPct,
  priceTarget,
  color,
}: {
  label: string;
  returnPct: number;
  priceTarget: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${color}33`,
        background: `${color}11`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.6,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: returnPct >= 0 ? "#22c55e" : "#ef4444",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {fmtPctSigned(returnPct)}
      </div>
      <div
        style={{
          fontSize: 12,
          opacity: 0.6,
          marginTop: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {fmtPrice(priceTarget)}
      </div>
    </div>
  );
}