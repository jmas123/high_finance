/**
 * DrawingToolbar
 * ==============
 * Toolbar for selecting drawing tools and managing drawings.
 */

import { useCallback } from "react";
import type { DrawingMode, DrawingType, DrawingStyle } from "./types/drawing";
import { DRAWING_TOOLS, DRAWING_COLORS } from "./types/drawing";

interface DrawingToolbarProps {
  mode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  currentStyle: DrawingStyle;
  onStyleChange: (style: DrawingStyle) => void;
  onDeleteAll: () => void;
  drawingCount: number;
  isAuthenticated: boolean;
}

export function DrawingToolbar({
  mode,
  onModeChange,
  currentStyle,
  onStyleChange,
  onDeleteAll,
  drawingCount,
  isAuthenticated,
}: DrawingToolbarProps) {
  const handleToolClick = useCallback(
    (type: DrawingType | "select") => {
      if (mode === type) {
        // Click again to deselect
        onModeChange("select");
      } else {
        onModeChange(type);
      }
    },
    [mode, onModeChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      onStyleChange({ ...currentStyle, color });
    },
    [currentStyle, onStyleChange]
  );

  const handleLineWidthChange = useCallback(
    (lineWidth: number) => {
      onStyleChange({ ...currentStyle, lineWidth });
    },
    [currentStyle, onStyleChange]
  );

  return (
    <div style={styles.container}>
      {/* Tool Selection */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Tools</div>
        <div style={styles.toolGrid}>
          {/* Select/Pointer Tool */}
          <button
            style={{
              ...styles.toolButton,
              ...(mode === "select" ? styles.toolButtonActive : {}),
            }}
            onClick={() => handleToolClick("select")}
            title="Select (Esc)"
          >
            <span style={styles.toolIcon}>↖</span>
          </button>

          {/* Drawing Tools */}
          {DRAWING_TOOLS.map((tool) => (
            <button
              key={tool.type}
              style={{
                ...styles.toolButton,
                ...(mode === tool.type ? styles.toolButtonActive : {}),
                ...(!isAuthenticated ? styles.toolButtonDisabled : {}),
              }}
              onClick={() => isAuthenticated && handleToolClick(tool.type)}
              title={`${tool.label}: ${tool.description}${!isAuthenticated ? " (Sign in required)" : ""}`}
              disabled={!isAuthenticated}
            >
              <span style={styles.toolIcon}>{tool.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Picker */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Color</div>
        <div style={styles.colorGrid}>
          {DRAWING_COLORS.map((color) => (
            <button
              key={color}
              style={{
                ...styles.colorButton,
                backgroundColor: color,
                ...(currentStyle.color === color ? styles.colorButtonActive : {}),
              }}
              onClick={() => handleColorChange(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Line Width */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Width</div>
        <div style={styles.widthRow}>
          {[1, 2, 3, 4].map((width) => (
            <button
              key={width}
              style={{
                ...styles.widthButton,
                ...(currentStyle.lineWidth === width ? styles.widthButtonActive : {}),
              }}
              onClick={() => handleLineWidthChange(width)}
              title={`Line width ${width}px`}
            >
              <div
                style={{
                  width: "100%",
                  height: width * 2,
                  backgroundColor: currentStyle.color,
                  borderRadius: 1,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Actions</div>
        <div style={styles.actionsRow}>
          {drawingCount > 0 && (
            <button
              style={styles.actionButton}
              onClick={onDeleteAll}
              title="Delete all drawings"
            >
              Clear All ({drawingCount})
            </button>
          )}
        </div>
      </div>

      {/* Auth Warning */}
      {!isAuthenticated && (
        <div style={styles.authWarning}>
          Sign in to save drawings
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    left: 8,
    top: 50,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    zIndex: 10,
    minWidth: 48,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sectionLabel: {
    fontSize: 9,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  toolGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  toolButton: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  toolButtonActive: {
    background: "#3b82f6",
    borderColor: "#3b82f6",
  },
  toolButtonDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  toolIcon: {
    fontSize: 16,
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(36px, 1fr))",
    gap: 2,
  },
  colorButton: {
    width: 16,
    height: 16,
    border: "1px solid #444",
    borderRadius: 2,
    cursor: "pointer",
    padding: 0,
  },
  colorButtonActive: {
    border: "2px solid #fff",
  },
  widthRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  widthButton: {
    width: 32,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 2,
    cursor: "pointer",
    padding: 2,
  },
  widthButtonActive: {
    background: "#333",
    borderColor: "#666",
  },
  actionsRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  actionButton: {
    fontSize: 10,
    padding: "4px 8px",
    background: "#2d2d2d",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#ccc",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  authWarning: {
    fontSize: 9,
    color: "#f59e0b",
    textAlign: "center",
    padding: 4,
    background: "rgba(245, 158, 11, 0.1)",
    borderRadius: 4,
  },
};
