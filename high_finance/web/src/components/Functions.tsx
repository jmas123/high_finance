export function fmtMoney(x: number | null | undefined) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (Math.abs(x) >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function fmtPx(x: number | null | undefined) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}

export function fmtPct(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtPctSigned(x: number | null | undefined, digits = 1) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const val = x * 100;
  return val >= 0 ? `+${val.toFixed(digits)}%` : `${val.toFixed(digits)}%`;
}


export function fmtPrice(x: number | null | undefined) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}