import type { ReactNode, CSSProperties } from "react";

interface MobileCardRowProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}

export function MobileCardRow({ children, style, onClick }: MobileCardRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface MobileCardFieldProps {
  label: string;
  value: ReactNode;
  style?: CSSProperties;
}

export function MobileCardField({ label, value, style }: MobileCardFieldProps) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#666",
          letterSpacing: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontFamily: "monospace", color: "#fff" }}>
        {value}
      </div>
    </div>
  );
}
