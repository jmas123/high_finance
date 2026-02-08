/**
 * useIndicatorState
 * =================
 * Hook for managing technical indicator configurations and state.
 * Handles toggling, parameter updates, and localStorage persistence.
 */

import { useState, useCallback, useEffect } from "react";
import type {
  IndicatorConfig,
  IndicatorType,
  SMAConfig,
  EMAConfig,
  BollingerConfig,
  VolumeConfig,
  RSIConfig,
  MACDConfig,
} from "../types/indicators";
import {
  DEFAULT_INDICATOR_CONFIGS,
} from "../types/indicators";

const STORAGE_KEY = "chart-indicators";

export interface UseIndicatorStateReturn {
  configs: IndicatorConfig[];
  isEnabled: (type: IndicatorType) => boolean;
  toggleIndicator: (type: IndicatorType) => void;
  updateParams: (type: IndicatorType, params: Record<string, number>) => void;
  updateStyle: (type: IndicatorType, style: Partial<IndicatorConfig["style"]>) => void;
  getConfig: <T extends IndicatorConfig>(type: T["type"]) => T | undefined;
  resetToDefaults: () => void;
  enabledOverlays: IndicatorConfig[];
  enabledSubPanes: IndicatorConfig[];
}

/**
 * Load saved configs from localStorage, merging with defaults
 */
function loadConfigs(ticker: string): IndicatorConfig[] {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${ticker}`);
    if (saved) {
      const parsed = JSON.parse(saved) as IndicatorConfig[];
      // Merge with defaults to handle new indicators added after user saved
      return DEFAULT_INDICATOR_CONFIGS.map((defaultConfig) => {
        const savedConfig = parsed.find((c) => c.type === defaultConfig.type);
        return savedConfig ?? defaultConfig;
      });
    }
  } catch {
    // Ignore parse errors
  }
  return [...DEFAULT_INDICATOR_CONFIGS];
}

/**
 * Save configs to localStorage
 */
function saveConfigs(ticker: string, configs: IndicatorConfig[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${ticker}`, JSON.stringify(configs));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export function useIndicatorState(ticker: string): UseIndicatorStateReturn {
  const [configs, setConfigs] = useState<IndicatorConfig[]>(() =>
    loadConfigs(ticker)
  );

  // Update configs when ticker changes
  useEffect(() => {
    setConfigs(loadConfigs(ticker));
  }, [ticker]);

  // Save configs when they change
  useEffect(() => {
    saveConfigs(ticker, configs);
  }, [ticker, configs]);

  const isEnabled = useCallback(
    (type: IndicatorType): boolean => {
      const config = configs.find((c) => c.type === type);
      return config?.enabled ?? false;
    },
    [configs]
  );

  const toggleIndicator = useCallback((type: IndicatorType) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.type === type ? { ...config, enabled: !config.enabled } : config
      )
    );
  }, []);

  const updateParams = useCallback(
    (type: IndicatorType, params: Record<string, number>) => {
      setConfigs((prev) =>
        prev.map((config) => {
          if (config.type !== type) return config;

          // Type-safe param update
          switch (config.type) {
            case "sma":
              return {
                ...config,
                params: { ...config.params, ...params },
              } as SMAConfig;
            case "ema":
              return {
                ...config,
                params: { ...config.params, ...params },
              } as EMAConfig;
            case "bollinger":
              return {
                ...config,
                params: { ...config.params, ...params },
              } as BollingerConfig;
            case "volume":
              return config as VolumeConfig;
            case "rsi":
              return {
                ...config,
                params: { ...config.params, ...params },
              } as RSIConfig;
            case "macd":
              return {
                ...config,
                params: { ...config.params, ...params },
              } as MACDConfig;
            default:
              return config;
          }
        })
      );
    },
    []
  );

  const updateStyle = useCallback(
    (type: IndicatorType, style: Partial<IndicatorConfig["style"]>) => {
      setConfigs((prev) =>
        prev.map((config) =>
          config.type === type
            ? ({ ...config, style: { ...config.style, ...style } } as IndicatorConfig)
            : config
        )
      );
    },
    []
  );

  const getConfig = useCallback(
    <T extends IndicatorConfig>(type: T["type"]): T | undefined => {
      return configs.find((c) => c.type === type) as T | undefined;
    },
    [configs]
  );

  const resetToDefaults = useCallback(() => {
    setConfigs([...DEFAULT_INDICATOR_CONFIGS]);
  }, []);

  // Derived state: enabled overlays and sub-panes
  const enabledOverlays = configs.filter(
    (c) =>
      c.enabled && (c.type === "sma" || c.type === "ema" || c.type === "bollinger")
  );

  const enabledSubPanes = configs.filter(
    (c) =>
      c.enabled && (c.type === "volume" || c.type === "rsi" || c.type === "macd")
  );

  return {
    configs,
    isEnabled,
    toggleIndicator,
    updateParams,
    updateStyle,
    getConfig,
    resetToDefaults,
    enabledOverlays,
    enabledSubPanes,
  };
}
