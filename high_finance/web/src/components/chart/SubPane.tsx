/**
 * SubPane
 * =======
 * Reusable sub-chart component for indicators that need separate panes
 * (Volume, RSI, MACD).
 *
 * Each sub-pane is a separate lightweight-charts instance that syncs
 * its time scale with the main chart.
 */

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
  type LogicalRange,
  type LineWidth,
} from "lightweight-charts";
import type {
  IndicatorPoint,
  MACDPoint,
  VolumePoint,
  RSIConfig,
  MACDConfig,
  VolumeConfig,
} from "./types/indicators";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BaseSubPaneProps {
  width: number;
  height: number;
  mainChart: IChartApi | null;
  isIntraday: boolean;
}

interface VolumeSubPaneProps extends BaseSubPaneProps {
  type: "volume";
  data: VolumePoint[];
  config: VolumeConfig;
}

interface RSISubPaneProps extends BaseSubPaneProps {
  type: "rsi";
  data: IndicatorPoint[];
  config: RSIConfig;
}

interface MACDSubPaneProps extends BaseSubPaneProps {
  type: "macd";
  data: MACDPoint[];
  config: MACDConfig;
}

type SubPaneProps = VolumeSubPaneProps | RSISubPaneProps | MACDSubPaneProps;

// Helper to clamp lineWidth to valid values
function toLineWidth(width: number): LineWidth {
  const clamped = Math.max(1, Math.min(4, Math.round(width)));
  return clamped as LineWidth;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SubPane(props: SubPaneProps) {
  const { type, width, height, mainChart, isIntraday } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const isSyncingRef = useRef(false);

  // Create chart - recreate when type/data changes to handle series cleanup
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width,
      height,
      layout: {
        background: { color: "#1a1a1a" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "#2d2d2d" },
        horzLines: { color: "#2d2d2d" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        borderColor: "#3d3d3d",
        timeVisible: isIntraday,
        visible: false, // Hide time scale on sub-panes (shown on main chart)
      },
      rightPriceScale: {
        borderColor: "#3d3d3d",
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    chartRef.current = chart;

    // Render the appropriate indicator
    switch (type) {
      case "volume":
        renderVolume(chart, props.data, isIntraday);
        break;
      case "rsi":
        renderRSI(chart, props.data, props.config, isIntraday);
        break;
      case "macd":
        renderMACD(chart, props.data, props.config, isIntraday);
        break;
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [type, props, height, isIntraday]);

  // Handle resize
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width });
    }
  }, [width]);

  // Sync time scale with main chart
  useEffect(() => {
    if (!mainChart || !chartRef.current) return;

    const subChart = chartRef.current;

    // Sync from main to sub
    const handleMainRangeChange = (range: LogicalRange | null) => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      subChart.timeScale().setVisibleLogicalRange(range);
      isSyncingRef.current = false;
    };

    // Sync from sub to main (for scrolling in sub-pane)
    const handleSubRangeChange = (range: LogicalRange | null) => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      mainChart.timeScale().setVisibleLogicalRange(range);
      isSyncingRef.current = false;
    };

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(handleMainRangeChange);
    subChart.timeScale().subscribeVisibleLogicalRangeChange(handleSubRangeChange);

    // Initial sync
    const currentRange = mainChart.timeScale().getVisibleLogicalRange();
    if (currentRange) {
      subChart.timeScale().setVisibleLogicalRange(currentRange);
    }

    return () => {
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(handleMainRangeChange);
      subChart.timeScale().unsubscribeVisibleLogicalRangeChange(handleSubRangeChange);
    };
  }, [mainChart]);

  const label = type === "volume" ? "Vol" : type === "rsi" ? "RSI" : "MACD";

  return (
    <div style={styles.container}>
      <div style={styles.label}>{label}</div>
      <div ref={containerRef} style={{ borderRadius: 4, overflow: "hidden" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function renderVolume(
  chart: IChartApi,
  data: VolumePoint[],
  isIntraday: boolean
) {
  if (data.length === 0) return;

  const series = chart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "right",
  });

  const chartData = data.map((d) => ({
    time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
    value: d.value,
    color: d.color,
  }));

  series.setData(chartData);
}

function renderRSI(
  chart: IChartApi,
  data: IndicatorPoint[],
  config: RSIConfig,
  isIntraday: boolean
) {
  if (data.length === 0) return;

  // Set fixed scale for RSI (0-100)
  chart.applyOptions({
    rightPriceScale: {
      autoScale: false,
      scaleMargins: { top: 0.05, bottom: 0.05 },
    },
  });

  // RSI Line
  const rsiSeries = chart.addSeries(LineSeries, {
    color: config.style.color,
    lineWidth: toLineWidth(config.style.lineWidth),
    priceScaleId: "right",
  });

  const chartData = data.map((d) => ({
    time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
    value: d.value,
  }));

  rsiSeries.setData(chartData);

  // Add overbought/oversold reference lines using price lines
  rsiSeries.createPriceLine({
    price: config.style.overboughtLevel,
    color: config.style.overboughtColor,
    lineWidth: 1 as LineWidth,
    lineStyle: 2, // Dashed
    axisLabelVisible: true,
    title: "OB",
  });

  rsiSeries.createPriceLine({
    price: config.style.oversoldLevel,
    color: config.style.oversoldColor,
    lineWidth: 1 as LineWidth,
    lineStyle: 2, // Dashed
    axisLabelVisible: true,
    title: "OS",
  });

  // Add middle line at 50
  rsiSeries.createPriceLine({
    price: 50,
    color: "#444",
    lineWidth: 1 as LineWidth,
    lineStyle: 2,
    axisLabelVisible: false,
  });
}

function renderMACD(
  chart: IChartApi,
  data: MACDPoint[],
  config: MACDConfig,
  isIntraday: boolean
) {
  if (data.length === 0) return;

  // MACD Line
  const macdSeries = chart.addSeries(LineSeries, {
    color: config.style.color,
    lineWidth: toLineWidth(config.style.lineWidth),
    priceScaleId: "right",
  });

  const macdData = data.map((d) => ({
    time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
    value: d.macd,
  }));

  macdSeries.setData(macdData);

  // Signal Line
  const signalSeries = chart.addSeries(LineSeries, {
    color: config.style.signalColor,
    lineWidth: toLineWidth(config.style.lineWidth),
    priceScaleId: "right",
  });

  const signalData = data.map((d) => ({
    time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
    value: d.signal,
  }));

  signalSeries.setData(signalData);

  // Histogram
  const histogramSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: "right",
  });

  const histogramData = data.map((d) => ({
    time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
    value: d.histogram,
    color:
      d.histogram >= 0
        ? config.style.histogramUpColor
        : config.style.histogramDownColor,
  }));

  histogramSeries.setData(histogramData);

  // Add zero line
  macdSeries.createPriceLine({
    price: 0,
    color: "#444",
    lineWidth: 1 as LineWidth,
    lineStyle: 2,
    axisLabelVisible: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    marginTop: 4,
    borderTop: "1px solid #333",
    paddingTop: 4,
  },
  label: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 10,
    color: "#666",
    zIndex: 5,
    background: "#1a1a1a",
    padding: "2px 4px",
    borderRadius: 2,
  },
};
