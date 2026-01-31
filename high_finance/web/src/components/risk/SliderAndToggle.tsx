import { useEffect, useState } from "react";

export function SliderControl({
  label,
  value,
  setValue,
  min,
  max,
  step,
  format = "pct",
  suffix = "",
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format?: "pct" | "days" | "number" | "multiplier";
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value);

  // keep draft in sync if parent updates value externally
  useEffect(() => setDraft(value), [value]);

  const displayValue = (v: number) => {
    switch (format) {
      case "pct":
        return `${(v * 100).toFixed(0)}%`;
      case "days":
        return `${v}d`;
      case "multiplier":
        return `${v.toFixed(1)}×`;
      default:
        return `${v}${suffix}`;
    }
  };

  return (
    <div style={{ padding: 12, borderRadius: 10, border: "1px solid #2a2a2a", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#3b82f6", minWidth: 50, textAlign: "right" }}>
          {displayValue(draft)}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        // commit once on release (covers mouse + touch + pen)
        onPointerUp={() => setValue(draft)}
        onKeyUp={() => setValue(draft)} // for keyboard arrows
        style={{
          width: "100%",
          marginTop: 10,
          accentColor: "#3b82f6",
          cursor: "pointer",
          touchAction: "pan-y", // allow vertical scroll; still lets slider work
        }}
      />
    </div>
  );
}


export function ToggleControl({
  label,
  value,
  setValue,
  hint,
}: {
  label: string;
  value: boolean;
  setValue: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <button
        onClick={() => setValue(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          background: value ? "#3b82f6" : "#333",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: "#fff",
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            transition: "left 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}