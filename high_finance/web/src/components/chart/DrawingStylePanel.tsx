/**
 * DrawingStylePanel
 * =================
 * A floating panel for customizing drawing styles (color, line width, etc.).
 */

import { useCallback } from "react";
import type { DrawingStyle, LineStyle } from "./types/drawing";
import { DRAWING_COLORS } from "./types/drawing";

interface DrawingStylePanelProps {
  style: DrawingStyle;
  onStyleChange: (style: DrawingStyle) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

export function DrawingStylePanel({
  style,
  onStyleChange,
  onClose,
  position,
}: DrawingStylePanelProps) {
  const handleColorChange = useCallback(
    (color: string) => {
      onStyleChange({ ...style, color });
    },
    [style, onStyleChange]
  );

  const handleLineWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange({ ...style, lineWidth: parseInt(e.target.value, 10) });
    },
    [style, onStyleChange]
  );

  const handleLineStyleChange = useCallback(
    (lineStyle: LineStyle) => {
      onStyleChange({ ...style, lineStyle });
    },
    [style, onStyleChange]
  );

  const handleShowLabelsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange({ ...style, showLabels: e.target.checked });
    },
    [style, onStyleChange]
  );

  const handleExtendLeftChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange({ ...style, extendLeft: e.target.checked });
    },
    [style, onStyleChange]
  );

  const handleExtendRightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange({ ...style, extendRight: e.target.checked });
    },
    [style, onStyleChange]
  );

  const handleFillOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange({ ...style, fillOpacity: parseFloat(e.target.value) });
    },
    [style, onStyleChange]
  );

  return (
    <div
      style={{
        ...styles.container,
        ...(position ? { left: position.x, top: position.y } : {}),
      }}
    >
      <div style={styles.header}>
        <span style={styles.title}>Style</span>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {/* Color */}
      <div style={styles.section}>
        <label style={styles.label}>Color</label>
        <div style={styles.colorGrid}>
          {DRAWING_COLORS.map((color) => (
            <button
              key={color}
              style={{
                ...styles.colorButton,
                backgroundColor: color,
                ...(style.color === color ? styles.colorButtonActive : {}),
              }}
              onClick={() => handleColorChange(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Line Width */}
      <div style={styles.section}>
        <label style={styles.label}>Line Width: {style.lineWidth}px</label>
        <input
          type="range"
          min="1"
          max="6"
          value={style.lineWidth}
          onChange={handleLineWidthChange}
          style={styles.slider}
        />
      </div>

      {/* Line Style */}
      <div style={styles.section}>
        <label style={styles.label}>Line Style</label>
        <div style={styles.lineStyleRow}>
          {(["solid", "dashed", "dotted"] as LineStyle[]).map((ls) => (
            <button
              key={ls}
              style={{
                ...styles.lineStyleButton,
                ...(style.lineStyle === ls ? styles.lineStyleButtonActive : {}),
              }}
              onClick={() => handleLineStyleChange(ls)}
            >
              <svg width="24" height="4" viewBox="0 0 24 4">
                {ls === "solid" && <line x1="0" y1="2" x2="24" y2="2" stroke={style.color} strokeWidth="2" />}
                {ls === "dashed" && (
                  <line
                    x1="0"
                    y1="2"
                    x2="24"
                    y2="2"
                    stroke={style.color}
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                )}
                {ls === "dotted" && (
                  <line
                    x1="0"
                    y1="2"
                    x2="24"
                    y2="2"
                    stroke={style.color}
                    strokeWidth="2"
                    strokeDasharray="2 3"
                  />
                )}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Fill Opacity */}
      <div style={styles.section}>
        <label style={styles.label}>Fill: {Math.round(style.fillOpacity * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={style.fillOpacity}
          onChange={handleFillOpacityChange}
          style={styles.slider}
        />
      </div>

      {/* Checkboxes */}
      <div style={styles.section}>
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={style.showLabels}
            onChange={handleShowLabelsChange}
          />
          <span>Show Labels</span>
        </label>
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={style.extendLeft}
            onChange={handleExtendLeftChange}
          />
          <span>Extend Left</span>
        </label>
        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={style.extendRight}
            onChange={handleExtendRightChange}
          />
          <span>Extend Right</span>
        </label>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    padding: 12,
    width: 200,
    zIndex: 30,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #333",
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    display: "block",
    fontSize: 11,
    color: "#888",
    marginBottom: 6,
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 4,
  },
  colorButton: {
    width: 24,
    height: 24,
    border: "2px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    padding: 0,
  },
  colorButtonActive: {
    borderColor: "#fff",
  },
  slider: {
    width: "100%",
    cursor: "pointer",
  },
  lineStyleRow: {
    display: "flex",
    gap: 4,
  },
  lineStyleButton: {
    flex: 1,
    padding: "6px 8px",
    background: "#2d2d2d",
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
  },
  lineStyleButtonActive: {
    borderColor: "#3b82f6",
    background: "#333",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    color: "#ccc",
    cursor: "pointer",
    marginBottom: 4,
  },
};
