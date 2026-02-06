/**
 * useIndicators
 * =============
 * Hook for calculating technical indicator data from price data.
 * All calculations are memoized and only recalculated when dependencies change.
 */

import { useMemo } from "react";
import type {
  IndicatorConfig,
  SMAConfig,
  EMAConfig,
  BollingerConfig,
  VolumeConfig,
  RSIConfig,
  MACDConfig,
  IndicatorPoint,
  BollingerPoint,
  MACDPoint,
  VolumePoint,
} from "../types/indicators";
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  formatVolume,
  type PriceData,
} from "../../../lib/indicators";

export interface IndicatorData {
  sma: IndicatorPoint[];
  ema: IndicatorPoint[];
  bollinger: BollingerPoint[];
  volume: VolumePoint[];
  rsi: IndicatorPoint[];
  macd: MACDPoint[];
}

export interface UseIndicatorsReturn {
  data: IndicatorData;
  hasOverlays: boolean;
  hasSubPanes: boolean;
}

export function useIndicators(
  priceData: PriceData[],
  configs: IndicatorConfig[],
  isIntraday: boolean
): UseIndicatorsReturn {
  // Sort and deduplicate data for calculations
  // lightweight-charts requires strictly unique, ascending time values
  const sortedData = useMemo(() => {
    if (!priceData || priceData.length === 0) return [];
    const sorted = [...priceData].sort((a, b) => a.timestamp - b.timestamp);

    // Deduplicate by time value that will be used in chart
    // - Intraday: use timestamp directly
    // - Daily: use date string (YYYY-MM-DD) since multiple intraday points collapse to same day
    const seen = new Map<string | number, typeof sorted[0]>();
    for (const d of sorted) {
      const key = isIntraday ? d.timestamp : d.date.slice(0, 10);
      seen.set(key, d); // Last one wins
    }
    return Array.from(seen.values());
  }, [priceData, isIntraday]);

  // Get individual configs with proper typing
  const smaConfig = useMemo(
    () => configs.find((c) => c.type === "sma") as SMAConfig | undefined,
    [configs]
  );
  const emaConfig = useMemo(
    () => configs.find((c) => c.type === "ema") as EMAConfig | undefined,
    [configs]
  );
  const bollingerConfig = useMemo(
    () => configs.find((c) => c.type === "bollinger") as BollingerConfig | undefined,
    [configs]
  );
  const volumeConfig = useMemo(
    () => configs.find((c) => c.type === "volume") as VolumeConfig | undefined,
    [configs]
  );
  const rsiConfig = useMemo(
    () => configs.find((c) => c.type === "rsi") as RSIConfig | undefined,
    [configs]
  );
  const macdConfig = useMemo(
    () => configs.find((c) => c.type === "macd") as MACDConfig | undefined,
    [configs]
  );

  // Calculate SMA
  const smaData = useMemo((): IndicatorPoint[] => {
    if (!smaConfig?.enabled || sortedData.length === 0) return [];
    return calculateSMA(sortedData, smaConfig.params.period, isIntraday);
  }, [sortedData, smaConfig?.enabled, smaConfig?.params.period, isIntraday]);

  // Calculate EMA
  const emaData = useMemo((): IndicatorPoint[] => {
    if (!emaConfig?.enabled || sortedData.length === 0) return [];
    return calculateEMA(sortedData, emaConfig.params.period, isIntraday);
  }, [sortedData, emaConfig?.enabled, emaConfig?.params.period, isIntraday]);

  // Calculate Bollinger Bands
  const bollingerData = useMemo((): BollingerPoint[] => {
    if (!bollingerConfig?.enabled || sortedData.length === 0) return [];
    return calculateBollingerBands(
      sortedData,
      bollingerConfig.params.period,
      bollingerConfig.params.stdDev,
      isIntraday
    );
  }, [
    sortedData,
    bollingerConfig?.enabled,
    bollingerConfig?.params.period,
    bollingerConfig?.params.stdDev,
    isIntraday,
  ]);

  // Calculate Volume
  const volumeData = useMemo((): VolumePoint[] => {
    if (!volumeConfig?.enabled || sortedData.length === 0) return [];
    return formatVolume(
      sortedData,
      isIntraday,
      volumeConfig.style.upColor,
      volumeConfig.style.downColor
    );
  }, [
    sortedData,
    volumeConfig?.enabled,
    volumeConfig?.style.upColor,
    volumeConfig?.style.downColor,
    isIntraday,
  ]);

  // Calculate RSI
  const rsiData = useMemo((): IndicatorPoint[] => {
    if (!rsiConfig?.enabled || sortedData.length === 0) return [];
    return calculateRSI(sortedData, rsiConfig.params.period, isIntraday);
  }, [sortedData, rsiConfig?.enabled, rsiConfig?.params.period, isIntraday]);

  // Calculate MACD
  const macdData = useMemo((): MACDPoint[] => {
    if (!macdConfig?.enabled || sortedData.length === 0) return [];
    return calculateMACD(
      sortedData,
      macdConfig.params.fastPeriod,
      macdConfig.params.slowPeriod,
      macdConfig.params.signalPeriod,
      isIntraday
    );
  }, [
    sortedData,
    macdConfig?.enabled,
    macdConfig?.params.fastPeriod,
    macdConfig?.params.slowPeriod,
    macdConfig?.params.signalPeriod,
    isIntraday,
  ]);

  const data: IndicatorData = useMemo(
    () => ({
      sma: smaData,
      ema: emaData,
      bollinger: bollingerData,
      volume: volumeData,
      rsi: rsiData,
      macd: macdData,
    }),
    [smaData, emaData, bollingerData, volumeData, rsiData, macdData]
  );

  const hasOverlays = smaData.length > 0 || emaData.length > 0 || bollingerData.length > 0;
  const hasSubPanes = volumeData.length > 0 || rsiData.length > 0 || macdData.length > 0;

  return {
    data,
    hasOverlays,
    hasSubPanes,
  };
}
