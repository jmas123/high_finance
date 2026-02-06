/**
 * IndicatorToolbar
 * ================
 * Toolbar for toggling technical indicators and adjusting parameters.
 */

import { useState, useCallback } from "react";
import type {
  IndicatorType,
  IndicatorConfig,
  SMAConfig,
  EMAConfig,
  BollingerConfig,
  RSIConfig,
  MACDConfig,
} from "./types/indicators";
import { INDICATOR_INFO, INDICATOR_COLORS } from "./types/indicators";

interface IndicatorToolbarProps {
  configs: IndicatorConfig[];
  isEnabled: (type: IndicatorType) => boolean;
  toggleIndicator: (type: IndicatorType) => void;
  updateParams: (type: IndicatorType, params: Record<string, number>) => void;
  updateStyle: (type: IndicatorType, style: Partial<IndicatorConfig["style"]>) => void;
}

export function IndicatorToolbar({
  configs,
  isEnabled,
  toggleIndicator,
  updateParams,
  updateStyle,
}: IndicatorToolbarProps) {
  const [expandedIndicator, setExpandedIndicator] = useState<IndicatorType | null>(null);

  const handleToggle = useCallback(
    (type: IndicatorType) => {
      toggleIndicator(type);
    },
    [toggleIndicator]
  );

  const handleSettingsClick = useCallback(
    (type: IndicatorType, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedIndicator((prev) => (prev === type ? null : type));
    },
    []
  );

  const getConfig = <T extends IndicatorConfig>(type: T["type"]): T | undefined => {
    return configs.find((c) => c.type === type) as T | undefined;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>Indicators</span>
      </div>

      <div style={styles.indicatorList}>
        {INDICATOR_INFO.map((info) => {
          const enabled = isEnabled(info.type);
          const config = getConfig(info.type);

          return (
            <div key={info.type} style={styles.indicatorItem}>
              <div style={styles.indicatorRow}>
                <button
                  style={{
                    ...styles.indicatorButton,
                    ...(enabled ? styles.indicatorButtonActive : {}),
                  }}
                  onClick={() => handleToggle(info.type)}
                  title={info.description}
                >
                  <span
                    style={{
                      ...styles.indicatorDot,
                      backgroundColor: enabled
                        ? config?.style.color ?? "#3b82f6"
                        : "#444",
                    }}
                  />
                  <span style={styles.indicatorLabel}>{info.shortLabel}</span>
                </button>

                {enabled && info.type !== "volume" && (
                  <button
                    style={styles.settingsButton}
                    onClick={(e) => handleSettingsClick(info.type, e)}
                    title="Settings"
                  >
                    ⚙
                  </button>
                )}
              </div>

              {/* Expanded Settings Panel */}
              {expandedIndicator === info.type && config && (
                <IndicatorSettings
                  type={info.type}
                  config={config}
                  onParamsChange={(params) => updateParams(info.type, params)}
                  onStyleChange={(style) => updateStyle(info.type, style)}
                  onClose={() => setExpandedIndicator(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

interface IndicatorSettingsProps {
  type: IndicatorType;
  config: IndicatorConfig;
  onParamsChange: (params: Record<string, number>) => void;
  onStyleChange: (style: Partial<IndicatorConfig["style"]>) => void;
  onClose: () => void;
}

function IndicatorSettings({
  type,
  config,
  onParamsChange,
  onStyleChange,
}: IndicatorSettingsProps) {
  return (
    <div style={styles.settingsPanel}>
      {/* Color Picker */}
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Color</span>
        <div style={styles.colorPicker}>
          {INDICATOR_COLORS.map((color) => (
            <button
              key={color}
              style={{
                ...styles.colorButton,
                backgroundColor: color,
                ...(config.style.color === color ? styles.colorButtonActive : {}),
              }}
              onClick={() => onStyleChange({ color })}
            />
          ))}
        </div>
      </div>

      {/* Parameter inputs based on type */}
      {type === "sma" && (
        <SMASettings
          config={config as SMAConfig}
          onParamsChange={onParamsChange}
        />
      )}
      {type === "ema" && (
        <EMASettings
          config={config as EMAConfig}
          onParamsChange={onParamsChange}
        />
      )}
      {type === "bollinger" && (
        <BollingerSettings
          config={config as BollingerConfig}
          onParamsChange={onParamsChange}
        />
      )}
      {type === "rsi" && (
        <RSISettings
          config={config as RSIConfig}
          onParamsChange={onParamsChange}
        />
      )}
      {type === "macd" && (
        <MACDSettings
          config={config as MACDConfig}
          onParamsChange={onParamsChange}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL INDICATOR SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

function SMASettings({
  config,
  onParamsChange,
}: {
  config: SMAConfig;
  onParamsChange: (params: Record<string, number>) => void;
}) {
  return (
    <div style={styles.settingsRow}>
      <span style={styles.settingsLabel}>Period</span>
      <input
        type="number"
        min={2}
        max={200}
        value={config.params.period}
        onChange={(e) => onParamsChange({ period: parseInt(e.target.value) || 20 })}
        style={styles.numberInput}
      />
    </div>
  );
}

function EMASettings({
  config,
  onParamsChange,
}: {
  config: EMAConfig;
  onParamsChange: (params: Record<string, number>) => void;
}) {
  return (
    <div style={styles.settingsRow}>
      <span style={styles.settingsLabel}>Period</span>
      <input
        type="number"
        min={2}
        max={200}
        value={config.params.period}
        onChange={(e) => onParamsChange({ period: parseInt(e.target.value) || 12 })}
        style={styles.numberInput}
      />
    </div>
  );
}

function BollingerSettings({
  config,
  onParamsChange,
}: {
  config: BollingerConfig;
  onParamsChange: (params: Record<string, number>) => void;
}) {
  return (
    <>
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Period</span>
        <input
          type="number"
          min={2}
          max={200}
          value={config.params.period}
          onChange={(e) => onParamsChange({ period: parseInt(e.target.value) || 20 })}
          style={styles.numberInput}
        />
      </div>
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Std Dev</span>
        <input
          type="number"
          min={0.5}
          max={4}
          step={0.5}
          value={config.params.stdDev}
          onChange={(e) => onParamsChange({ stdDev: parseFloat(e.target.value) || 2 })}
          style={styles.numberInput}
        />
      </div>
    </>
  );
}

function RSISettings({
  config,
  onParamsChange,
}: {
  config: RSIConfig;
  onParamsChange: (params: Record<string, number>) => void;
}) {
  return (
    <div style={styles.settingsRow}>
      <span style={styles.settingsLabel}>Period</span>
      <input
        type="number"
        min={2}
        max={50}
        value={config.params.period}
        onChange={(e) => onParamsChange({ period: parseInt(e.target.value) || 14 })}
        style={styles.numberInput}
      />
    </div>
  );
}

function MACDSettings({
  config,
  onParamsChange,
}: {
  config: MACDConfig;
  onParamsChange: (params: Record<string, number>) => void;
}) {
  return (
    <>
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Fast</span>
        <input
          type="number"
          min={2}
          max={50}
          value={config.params.fastPeriod}
          onChange={(e) =>
            onParamsChange({ fastPeriod: parseInt(e.target.value) || 12 })
          }
          style={styles.numberInput}
        />
      </div>
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Slow</span>
        <input
          type="number"
          min={2}
          max={100}
          value={config.params.slowPeriod}
          onChange={(e) =>
            onParamsChange({ slowPeriod: parseInt(e.target.value) || 26 })
          }
          style={styles.numberInput}
        />
      </div>
      <div style={styles.settingsRow}>
        <span style={styles.settingsLabel}>Signal</span>
        <input
          type="number"
          min={2}
          max={50}
          value={config.params.signalPeriod}
          onChange={(e) =>
            onParamsChange({ signalPeriod: parseInt(e.target.value) || 9 })
          }
          style={styles.numberInput}
        />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    right: 8,
    top: 50,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 10,
    minWidth: 120,
  },
  header: {
    borderBottom: "1px solid #333",
    paddingBottom: 6,
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: 10,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  indicatorList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  indicatorItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  indicatorRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  indicatorButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 0.15s",
    color: "#888",
  },
  indicatorButtonActive: {
    background: "rgba(59, 130, 246, 0.15)",
    borderColor: "#3b82f6",
    color: "#fff",
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  indicatorLabel: {
    fontSize: 11,
    fontWeight: 500,
  },
  settingsButton: {
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 10,
    color: "#666",
  },
  settingsPanel: {
    background: "#252525",
    borderRadius: 4,
    padding: 8,
    marginLeft: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  settingsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  settingsLabel: {
    fontSize: 10,
    color: "#888",
  },
  colorPicker: {
    display: "flex",
    gap: 2,
  },
  colorButton: {
    width: 14,
    height: 14,
    border: "1px solid #444",
    borderRadius: 2,
    cursor: "pointer",
    padding: 0,
  },
  colorButtonActive: {
    border: "2px solid #fff",
  },
  numberInput: {
    width: 50,
    padding: "2px 4px",
    background: "#1a1a1a",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#fff",
    fontSize: 11,
    textAlign: "right",
  },
};
