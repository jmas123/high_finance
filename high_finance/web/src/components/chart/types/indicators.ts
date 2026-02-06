/**
 * Technical Indicator Types
 * =========================
 * TypeScript types for technical indicators on the price chart.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR DATA POINTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndicatorPoint {
  time: number | string; // Matches chart time format (timestamp or date string)
  value: number;
}

export interface BollingerPoint {
  time: number | string;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: number | string;
  macd: number;
  signal: number;
  histogram: number;
}

export interface VolumePoint {
  time: number | string;
  value: number;
  color: string; // Green for up days, red for down days
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type OverlayIndicatorType = "sma" | "ema" | "bollinger";
export type SubPaneIndicatorType = "volume" | "rsi" | "macd";
export type IndicatorType = OverlayIndicatorType | SubPaneIndicatorType;

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface BaseIndicatorConfig {
  id: string;
  type: IndicatorType;
  enabled: boolean;
  style: {
    color: string;
    lineWidth: number;
  };
}

export interface SMAConfig extends BaseIndicatorConfig {
  type: "sma";
  params: {
    period: number;
  };
}

export interface EMAConfig extends BaseIndicatorConfig {
  type: "ema";
  params: {
    period: number;
  };
}

export interface BollingerConfig extends BaseIndicatorConfig {
  type: "bollinger";
  params: {
    period: number;
    stdDev: number;
  };
  style: {
    color: string;
    lineWidth: number;
    fillColor: string;
    fillOpacity: number;
  };
}

export interface VolumeConfig extends BaseIndicatorConfig {
  type: "volume";
  params: Record<string, never>; // No params
  style: {
    color: string; // Not used - colors are per-bar
    lineWidth: number;
    upColor: string;
    downColor: string;
  };
}

export interface RSIConfig extends BaseIndicatorConfig {
  type: "rsi";
  params: {
    period: number;
  };
  style: {
    color: string;
    lineWidth: number;
    overboughtLevel: number;
    oversoldLevel: number;
    overboughtColor: string;
    oversoldColor: string;
  };
}

export interface MACDConfig extends BaseIndicatorConfig {
  type: "macd";
  params: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  style: {
    color: string; // MACD line color
    lineWidth: number;
    signalColor: string;
    histogramUpColor: string;
    histogramDownColor: string;
  };
}

export type IndicatorConfig =
  | SMAConfig
  | EMAConfig
  | BollingerConfig
  | VolumeConfig
  | RSIConfig
  | MACDConfig;

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_SMA_CONFIG: SMAConfig = {
  id: "sma-20",
  type: "sma",
  enabled: false,
  params: { period: 20 },
  style: { color: "#3b82f6", lineWidth: 2 },
};

export const DEFAULT_EMA_CONFIG: EMAConfig = {
  id: "ema-12",
  type: "ema",
  enabled: false,
  params: { period: 12 },
  style: { color: "#f59e0b", lineWidth: 2 },
};

export const DEFAULT_BOLLINGER_CONFIG: BollingerConfig = {
  id: "bollinger",
  type: "bollinger",
  enabled: false,
  params: { period: 20, stdDev: 2 },
  style: {
    color: "#8b5cf6",
    lineWidth: 1,
    fillColor: "#8b5cf6",
    fillOpacity: 0.1,
  },
};

export const DEFAULT_VOLUME_CONFIG: VolumeConfig = {
  id: "volume",
  type: "volume",
  enabled: false,
  params: {},
  style: {
    color: "#888",
    lineWidth: 1,
    upColor: "#22c55e",
    downColor: "#ef4444",
  },
};

export const DEFAULT_RSI_CONFIG: RSIConfig = {
  id: "rsi",
  type: "rsi",
  enabled: false,
  params: { period: 14 },
  style: {
    color: "#06b6d4",
    lineWidth: 2,
    overboughtLevel: 70,
    oversoldLevel: 30,
    overboughtColor: "#ef4444",
    oversoldColor: "#22c55e",
  },
};

export const DEFAULT_MACD_CONFIG: MACDConfig = {
  id: "macd",
  type: "macd",
  enabled: false,
  params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  style: {
    color: "#3b82f6",
    lineWidth: 2,
    signalColor: "#f59e0b",
    histogramUpColor: "#22c55e",
    histogramDownColor: "#ef4444",
  },
};

export const DEFAULT_INDICATOR_CONFIGS: IndicatorConfig[] = [
  DEFAULT_SMA_CONFIG,
  DEFAULT_EMA_CONFIG,
  DEFAULT_BOLLINGER_CONFIG,
  DEFAULT_VOLUME_CONFIG,
  DEFAULT_RSI_CONFIG,
  DEFAULT_MACD_CONFIG,
];

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface IndicatorInfo {
  type: IndicatorType;
  label: string;
  shortLabel: string;
  category: "overlay" | "subpane";
  description: string;
  defaultParams: Record<string, number>;
}

export const INDICATOR_INFO: IndicatorInfo[] = [
  {
    type: "sma",
    label: "Simple Moving Average",
    shortLabel: "SMA",
    category: "overlay",
    description: "Average price over N periods",
    defaultParams: { period: 20 },
  },
  {
    type: "ema",
    label: "Exponential Moving Average",
    shortLabel: "EMA",
    category: "overlay",
    description: "Weighted average giving more weight to recent prices",
    defaultParams: { period: 12 },
  },
  {
    type: "bollinger",
    label: "Bollinger Bands",
    shortLabel: "BB",
    category: "overlay",
    description: "Volatility bands around a moving average",
    defaultParams: { period: 20, stdDev: 2 },
  },
  {
    type: "volume",
    label: "Volume",
    shortLabel: "Vol",
    category: "subpane",
    description: "Trading volume histogram",
    defaultParams: {},
  },
  {
    type: "rsi",
    label: "Relative Strength Index",
    shortLabel: "RSI",
    category: "subpane",
    description: "Momentum oscillator (0-100)",
    defaultParams: { period: 14 },
  },
  {
    type: "macd",
    label: "MACD",
    shortLabel: "MACD",
    category: "subpane",
    description: "Moving Average Convergence Divergence",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  },
];

export function getIndicatorInfo(type: IndicatorType): IndicatorInfo | undefined {
  return INDICATOR_INFO.find((i) => i.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR COLORS
// ═══════════════════════════════════════════════════════════════════════════════

export const INDICATOR_COLORS = [
  "#3b82f6", // Blue
  "#f59e0b", // Orange
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#22c55e", // Green
  "#ef4444", // Red
  "#ec4899", // Pink
  "#ffffff", // White
];
