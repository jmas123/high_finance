/**
 * Technical Indicator Calculations
 * =================================
 * Pure functions for calculating technical indicators from price data.
 * All calculations are performed in the frontend for instant updates.
 */

import type {
  IndicatorPoint,
  BollingerPoint,
  MACDPoint,
  VolumePoint,
} from "../components/chart/types/indicators";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceData {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TimeValue = number | string;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the time value for the chart based on whether it's intraday or daily data
 */
function getTime(d: PriceData, isIntraday: boolean): TimeValue {
  return isIntraday ? d.timestamp : d.date.slice(0, 10);
}

/**
 * Calculate standard deviation of an array of numbers
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOVING AVERAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Simple Moving Average (SMA)
 * The SMA is the unweighted mean of the previous N data points.
 */
export function calculateSMA(
  data: PriceData[],
  period: number,
  isIntraday: boolean
): IndicatorPoint[] {
  if (data.length < period || period <= 0) return [];

  const result: IndicatorPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: getTime(data[i], isIntraday),
      value: sum / period,
    });
  }

  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * The EMA gives more weight to recent prices using a smoothing factor.
 * Multiplier = 2 / (period + 1)
 */
export function calculateEMA(
  data: PriceData[],
  period: number,
  isIntraday: boolean
): IndicatorPoint[] {
  if (data.length < period || period <= 0) return [];

  const result: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;

  result.push({
    time: getTime(data[period - 1], isIntraday),
    value: ema,
  });

  // Calculate EMA for remaining data points
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: getTime(data[i], isIntraday),
      value: ema,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOLLINGER BANDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Bollinger Bands
 * Middle band = SMA(period)
 * Upper band = SMA + (stdDev * standard deviation)
 * Lower band = SMA - (stdDev * standard deviation)
 */
export function calculateBollingerBands(
  data: PriceData[],
  period: number,
  stdDevMultiplier: number,
  isIntraday: boolean
): BollingerPoint[] {
  if (data.length < period || period <= 0) return [];

  const result: BollingerPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const closes: number[] = [];
    for (let j = 0; j < period; j++) {
      closes.push(data[i - j].close);
    }

    const sma = closes.reduce((a, b) => a + b, 0) / period;
    const stdDev = standardDeviation(closes);

    result.push({
      time: getTime(data[i], isIntraday),
      upper: sma + stdDev * stdDevMultiplier,
      middle: sma,
      lower: sma - stdDev * stdDevMultiplier,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSI (Relative Strength Index)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Relative Strength Index (RSI)
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 */
export function calculateRSI(
  data: PriceData[],
  period: number,
  isIntraday: boolean
): IndicatorPoint[] {
  if (data.length < period + 1 || period <= 0) return [];

  const result: IndicatorPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate initial gains and losses
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // First RSI value using simple average
  let avgGain = gains.reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  // Prevent division by zero
  const epsilon = 1e-10;
  let rs = avgGain / Math.max(avgLoss, epsilon);
  let rsi = 100 - 100 / (1 + rs);

  result.push({
    time: getTime(data[period], isIntraday),
    value: rsi,
  });

  // Calculate remaining RSI values using smoothed averages
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    // Smoothed averages (Wilder's smoothing)
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgGain / Math.max(avgLoss, epsilon);
    rsi = 100 - 100 / (1 + rs);

    result.push({
      time: getTime(data[i], isIntraday),
      value: rsi,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MACD (Moving Average Convergence Divergence)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate MACD
 * MACD Line = EMA(fast) - EMA(slow)
 * Signal Line = EMA(MACD Line, signal period)
 * Histogram = MACD Line - Signal Line
 */
export function calculateMACD(
  data: PriceData[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
  isIntraday: boolean
): MACDPoint[] {
  if (data.length < slowPeriod + signalPeriod || slowPeriod <= fastPeriod) {
    return [];
  }

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(data, fastPeriod, isIntraday);
  const slowEMA = calculateEMA(data, slowPeriod, isIntraday);

  // MACD line = Fast EMA - Slow EMA
  // Align the EMAs (slow EMA starts later)
  const offset = slowPeriod - fastPeriod;
  const macdLine: { time: TimeValue; value: number }[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push({
      time: slowEMA[i].time,
      value: fastEMA[i + offset].value - slowEMA[i].value,
    });
  }

  if (macdLine.length < signalPeriod) return [];

  // Calculate signal line (EMA of MACD line)
  const result: MACDPoint[] = [];
  const multiplier = 2 / (signalPeriod + 1);

  // Start with SMA for first signal value
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[i].value;
  }
  let signal = sum / signalPeriod;

  result.push({
    time: macdLine[signalPeriod - 1].time,
    macd: macdLine[signalPeriod - 1].value,
    signal: signal,
    histogram: macdLine[signalPeriod - 1].value - signal,
  });

  // Calculate remaining signal values
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * multiplier + signal;
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: signal,
      histogram: macdLine[i].value - signal,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format volume data with up/down colors
 * Green for days where close >= open, red otherwise
 */
export function formatVolume(
  data: PriceData[],
  isIntraday: boolean,
  upColor: string = "#22c55e",
  downColor: string = "#ef4444"
): VolumePoint[] {
  return data.map((d) => ({
    time: getTime(d, isIntraday),
    value: d.volume,
    color: d.close >= d.open ? upColor : downColor,
  }));
}
