import type React from "react";

export const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 10,
  padding: 16,
};

export const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
};

export const inputStyle: React.CSSProperties = {
  background: "#222",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#fff",
  padding: "5px 8px",
  fontSize: 12,
  outline: "none",
};

export const smallBtnStyle: React.CSSProperties = {
  background: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#ccc",
  fontSize: 12,
  padding: "5px 10px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function badgeSelect(color: string): React.CSSProperties {
  return {
    backgroundColor: `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    color: color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    padding: "3px 8px",
    cursor: "pointer",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    paddingRight: 18,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 6px center",
  };
}
