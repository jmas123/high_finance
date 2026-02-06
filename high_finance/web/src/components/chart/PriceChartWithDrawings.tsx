/**
 * PriceChartWithDrawings
 * ======================
 * Main chart component with integrated drawing tools and technical indicators.
 * Wraps the price chart with an overlay canvas for drawing.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  SeriesType,
  LineWidth,
} from "lightweight-charts";

// Helper to convert lineWidth number to valid LineWidth type (1-4)
function toLineWidth(width: number): LineWidth {
  const clamped = Math.max(1, Math.min(4, Math.round(width)));
  return clamped as LineWidth;
}

import { IndicatorToolbar } from "./IndicatorToolbar";
import { SubPane } from "./SubPane";
import { useDrawingState } from "./hooks/useDrawingState";
import { useDrawingPersistence } from "./hooks/useDrawingPersistence";
import { useChartCoordinates, isIntradayPeriod } from "./hooks/useChartCoordinates";
import { useIndicatorState } from "./hooks/useIndicatorState";
import { useIndicators } from "./hooks/useIndicators";
import { renderTrendline, renderTrendlinePreview, hitTestTrendline } from "./primitives/TrendlinePrimitive";
import { renderHorizontalLine, renderHorizontalLinePreview, hitTestHorizontalLine } from "./primitives/HorizontalLinePrimitive";
import { renderVerticalLine, renderVerticalLinePreview, hitTestVerticalLine } from "./primitives/VerticalLinePrimitive";
import { renderFibRetracement, renderFibRetracementPreview, hitTestFibRetracement } from "./primitives/FibRetracementPrimitive";
import { renderRectangle, renderRectanglePreview, hitTestRectangle } from "./primitives/RectanglePrimitive";
import { renderChannel, renderChannelPreview, hitTestChannel } from "./primitives/ChannelPrimitive";
import { renderTextAnnotation, renderTextAnnotationPreview, hitTestTextAnnotation } from "./primitives/TextAnnotationPrimitive";
import { renderMeasure, renderMeasurePreview, hitTestMeasure } from "./primitives/MeasurePrimitive";
import type { ChartDrawing, DrawingType } from "./types/drawing";
import type { RenderContext } from "./primitives/BasePrimitive";
import type {
  SMAConfig,
  EMAConfig,
  BollingerConfig,
  VolumeConfig,
  RSIConfig,
  MACDConfig,
} from "./types/indicators";

interface PriceData {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartWithDrawingsProps {
  data: PriceData[];
  ticker: string;
  onPeriodChange: (period: string) => void;
  isAuthenticated: boolean;
  /**
   * Called when user scrolls to the left edge of loaded data.
   * Parent should fetch more historical data and prepend it.
   * @param earliestDate - The earliest date in current data (YYYY-MM-DD)
   * @returns Promise that resolves when loading is complete
   */
  onLoadMore?: (earliestDate: string) => Promise<void>;
  /** Whether more historical data is currently being loaded */
  isLoadingMore?: boolean;
}

const PERIODS = [
  { label: "24H", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
  { label: "MAX", value: "max" },
];

const requiredPoints: Record<DrawingType, number> = {
  trendline: 2,
  horizontal: 1,
  vertical: 1,
  fib_retracement: 2,
  rectangle: 2,
  channel: 2,
  text: 1,
  measure: 2,
};

// Sub-pane heights
const VOLUME_HEIGHT = 80;
const RSI_HEIGHT = 100;
const MACD_HEIGHT = 120;

export function PriceChartWithDrawings({
  data,
  ticker,
  onPeriodChange,
  isAuthenticated,
  onLoadMore,
  isLoadingMore = false,
}: PriceChartWithDrawingsProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastMoveTimeRef = useRef(0);

  // Indicator series refs
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbAreaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [activePeriod, setActivePeriod] = useState("1y");
  const [hoveredDrawingId, setHoveredDrawingId] = useState<number | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartWidth, setChartWidth] = useState(800);

  // Drawing state
  const drawingState = useDrawingState();
  const {
    mode,
    setMode,
    selectedDrawing,
    selectDrawing,
    clearSelection,
    pendingDrawing,
    startDrawing,
    addPoint,
    updateLastPoint,
    cancelDrawing,
    clearPendingDrawing,
    currentStyle,
    setCurrentStyle,
    textInput,
  } = drawingState;

  // Drawing persistence
  const persistence = useDrawingPersistence(ticker, isAuthenticated);
  const {
    drawings,
    loading,
    error,
    clearError,
    createDrawing,
    deleteDrawing,
    deleteAllDrawings,
  } = persistence;

  // Indicator state
  const indicatorState = useIndicatorState(ticker);
  const {
    configs: indicatorConfigs,
    isEnabled,
    toggleIndicator,
    updateParams,
    updateStyle,
    getConfig,
  } = indicatorState;

  // Coordinate conversion - only valid after chart is ready
  const isIntraday = isIntradayPeriod(activePeriod);
  const { pixelToCoords } = useChartCoordinates(
    chartReady ? chartRef.current : null,
    chartReady ? seriesRef.current : null,
    data,
    isIntraday
  );

  // Calculate indicator data
  const { data: indicatorData } = useIndicators(
    data,
    indicatorConfigs,
    isIntraday
  );

  // Get individual configs
  const smaConfig = getConfig<SMAConfig>("sma");
  const emaConfig = getConfig<EMAConfig>("ema");
  const bollingerConfig = getConfig<BollingerConfig>("bollinger");
  const volumeConfig = getConfig<VolumeConfig>("volume");
  const rsiConfig = getConfig<RSIConfig>("rsi");
  const macdConfig = getConfig<MACDConfig>("macd");

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
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
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "#3d3d3d",
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      autoSize: true,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Mark chart as ready and size the overlay canvas
    setChartReady(true);
    setChartWidth(chartContainerRef.current.clientWidth);
    setTimeout(() => {
      resizeOverlayCanvas();
    }, 0);

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        chart.applyOptions({ width });
        setChartWidth(width);
        resizeOverlayCanvas();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      setChartReady(false);
    };
  }, []);

  // Resize overlay canvas
  const resizeOverlayCanvas = useCallback(() => {
    if (!overlayCanvasRef.current || !chartContainerRef.current) return;

    const canvas = overlayCanvasRef.current;
    const container = chartContainerRef.current;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = `${container.clientWidth}px`;
    canvas.style.height = `${container.clientHeight}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data || data.length === 0) {
      seriesRef.current.setData([]);
      return;
    }

    const intraday = isIntradayPeriod(activePeriod);

    // Sort by timestamp first
    const sortedData = data.slice().sort((a, b) => a.timestamp - b.timestamp);

    // Deduplicate by time value - lightweight-charts requires strictly unique, ascending times
    // When switching timeframes, API may return duplicates or multiple intraday candles
    // collapse to the same date string. Keep the last entry for each time (most recent data).
    const seen = new Map<string | number, typeof sortedData[0]>();
    for (const d of sortedData) {
      const timeKey = intraday ? d.timestamp : d.date.slice(0, 10);
      seen.set(timeKey, d); // Last one wins (overwrites earlier duplicates)
    }

    const chartData = Array.from(seen.values()).map((d) => ({
      time: intraday ? (d.timestamp as UTCTimestamp) : d.date.slice(0, 10),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    chartRef.current.applyOptions({
      timeScale: {
        timeVisible: intraday,
        secondsVisible: false,
      },
    });

    seriesRef.current.setData(chartData);
    chartRef.current.timeScale().fitContent();

    // Resize overlay canvas after chart update
    setTimeout(resizeOverlayCanvas, 0);
  }, [data, activePeriod, resizeOverlayCanvas]);

  // Infinite scroll - load more historical data when scrolling to the left edge
  const loadMoreTriggeredRef = useRef(false);
  const lastDataTimestampRef = useRef<number | null>(null);

  // Reset ONLY when period changes (user explicitly selects new timeframe)
  // Do NOT reset on data.length change - that causes infinite loops
  useEffect(() => {
    loadMoreTriggeredRef.current = false;
    lastDataTimestampRef.current = null;
  }, [activePeriod, ticker]);

  useEffect(() => {
    if (!chartRef.current || !onLoadMore) return;
    // Don't enable infinite scroll for intraday periods
    if (isIntradayPeriod(activePeriod)) return;
    if (data.length === 0) return;

    const chart = chartRef.current;

    // Find the earliest date in the data
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const earliestTimestamp = sortedData[0]?.timestamp;
    const earliestDate = sortedData[0]?.date.slice(0, 10);
    if (!earliestDate || !earliestTimestamp) return;

    // Track if this is genuinely new/different data (for reset logic)
    // Only allow new triggers if we loaded MORE historical data (earlier timestamp)
    if (lastDataTimestampRef.current === null) {
      // First load for this period - record the earliest timestamp
      lastDataTimestampRef.current = earliestTimestamp;
    } else if (earliestTimestamp < lastDataTimestampRef.current) {
      // We loaded older data - update the ref and allow new triggers
      lastDataTimestampRef.current = earliestTimestamp;
      loadMoreTriggeredRef.current = false;
    }

    const handleVisibleRangeChange = (range: { from: number; to: number } | null) => {
      if (!range || loadMoreTriggeredRef.current || isLoadingMore) return;

      const totalBars = data.length;
      const visibleBars = range.to - range.from;

      // KEY FIX: Only trigger if user has zoomed in or scrolled
      // (visible range is smaller than total data)
      // This prevents triggering when fitContent() shows all data
      const hasScrolledOrZoomed = visibleBars < totalBars - 10;
      if (!hasScrolledOrZoomed) return;

      // Trigger when within 5 bars of the start AND user has scrolled left
      const THRESHOLD = 5;
      if (range.from <= THRESHOLD) {
        loadMoreTriggeredRef.current = true;
        onLoadMore(earliestDate);
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [data, activePeriod, onLoadMore, isLoadingMore, ticker]);

  // Update overlay indicators (SMA, EMA, Bollinger Bands)
  useEffect(() => {
    if (!chartRef.current || !chartReady) return;
    const chart = chartRef.current;

    // Helper to remove a series safely
    const removeSeries = (ref: React.MutableRefObject<ISeriesApi<SeriesType> | null>) => {
      if (ref.current) {
        try {
          chart.removeSeries(ref.current);
        } catch {
          // Series may already be removed
        }
        ref.current = null;
      }
    };

    // SMA
    removeSeries(smaSeriesRef);
    if (smaConfig?.enabled && indicatorData.sma.length > 0) {
      const series = chart.addSeries(LineSeries, {
        color: smaConfig.style.color,
        lineWidth: toLineWidth(smaConfig.style.lineWidth),
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const smaData = indicatorData.sma.map((d) => ({
        time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
        value: d.value,
      }));
      series.setData(smaData);
      smaSeriesRef.current = series;
    }

    // EMA
    removeSeries(emaSeriesRef);
    if (emaConfig?.enabled && indicatorData.ema.length > 0) {
      const series = chart.addSeries(LineSeries, {
        color: emaConfig.style.color,
        lineWidth: toLineWidth(emaConfig.style.lineWidth),
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const emaData = indicatorData.ema.map((d) => ({
        time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
        value: d.value,
      }));
      series.setData(emaData);
      emaSeriesRef.current = series;
    }

    // Bollinger Bands
    removeSeries(bbUpperSeriesRef);
    removeSeries(bbMiddleSeriesRef);
    removeSeries(bbLowerSeriesRef);
    removeSeries(bbAreaSeriesRef);

    if (bollingerConfig?.enabled && indicatorData.bollinger.length > 0) {
      const bbData = indicatorData.bollinger.map((d) => ({
        time: (isIntraday ? d.time : (d.time as string).slice(0, 10)) as UTCTimestamp,
        upper: d.upper,
        middle: d.middle,
        lower: d.lower,
      }));

      // Upper band
      const upperSeries = chart.addSeries(LineSeries, {
        color: bollingerConfig.style.color,
        lineWidth: toLineWidth(bollingerConfig.style.lineWidth),
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      upperSeries.setData(bbData.map((d) => ({ time: d.time, value: d.upper })));
      bbUpperSeriesRef.current = upperSeries;

      // Middle band (SMA)
      const middleSeries = chart.addSeries(LineSeries, {
        color: bollingerConfig.style.color,
        lineWidth: toLineWidth(bollingerConfig.style.lineWidth),
        lineStyle: 2, // Dashed
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      middleSeries.setData(bbData.map((d) => ({ time: d.time, value: d.middle })));
      bbMiddleSeriesRef.current = middleSeries;

      // Lower band
      const lowerSeries = chart.addSeries(LineSeries, {
        color: bollingerConfig.style.color,
        lineWidth: toLineWidth(bollingerConfig.style.lineWidth),
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      lowerSeries.setData(bbData.map((d) => ({ time: d.time, value: d.lower })));
      bbLowerSeriesRef.current = lowerSeries;

      // Fill area between bands
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: `${bollingerConfig.style.fillColor}${Math.round(bollingerConfig.style.fillOpacity * 255).toString(16).padStart(2, '0')}`,
        bottomColor: "transparent",
        lineColor: "transparent",
        lineWidth: 1 as LineWidth, // Minimum valid line width (line is transparent anyway)
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      areaSeries.setData(bbData.map((d) => ({ time: d.time, value: d.upper })));
      bbAreaSeriesRef.current = areaSeries;
    }
  }, [
    chartReady,
    isIntraday,
    smaConfig?.enabled,
    smaConfig?.style.color,
    smaConfig?.style.lineWidth,
    emaConfig?.enabled,
    emaConfig?.style.color,
    emaConfig?.style.lineWidth,
    bollingerConfig?.enabled,
    bollingerConfig?.style.color,
    bollingerConfig?.style.lineWidth,
    bollingerConfig?.style.fillColor,
    bollingerConfig?.style.fillOpacity,
    indicatorData.sma,
    indicatorData.ema,
    indicatorData.bollinger,
  ]);

  // Re-render drawings on chart/data changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleVisibleRangeChange = () => {
      renderDrawings();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [drawings, pendingDrawing, selectedDrawing, hoveredDrawingId]);

  // Render all drawings
  const renderDrawings = useCallback(() => {
    if (!overlayCanvasRef.current || !chartRef.current || !seriesRef.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const renderCtx: RenderContext = {
      chart: chartRef.current,
      series: seriesRef.current,
      canvas: ctx,
      isIntraday: isIntradayPeriod(activePeriod),
      chartWidth: canvas.width / dpr,
      chartHeight: canvas.height / dpr,
    };

    // Render saved drawings
    for (const drawing of drawings) {
      if (!drawing.is_visible) continue;

      const isSelected = selectedDrawing?.drawingId === drawing.id;
      const isHovered = hoveredDrawingId === drawing.id;

      renderDrawingByType(drawing, renderCtx, isSelected, isHovered);
    }

    // Render pending drawing preview
    if (pendingDrawing && pendingDrawing.points.length > 0) {
      renderPreviewByType(pendingDrawing, renderCtx);
    }
  }, [drawings, pendingDrawing, selectedDrawing, hoveredDrawingId, activePeriod]);

  // Trigger render on state changes
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(renderDrawings);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderDrawings]);

  // Render a drawing by its type
  function renderDrawingByType(
    drawing: ChartDrawing,
    ctx: RenderContext,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    switch (drawing.drawing_type) {
      case "trendline":
        renderTrendline(drawing, ctx, isSelected, isHovered);
        break;
      case "horizontal":
        renderHorizontalLine(drawing, ctx, isSelected, isHovered);
        break;
      case "vertical":
        renderVerticalLine(drawing, ctx, isSelected, isHovered);
        break;
      case "fib_retracement":
        renderFibRetracement(drawing, ctx, isSelected, isHovered);
        break;
      case "rectangle":
        renderRectangle(drawing, ctx, isSelected, isHovered);
        break;
      case "channel":
        renderChannel(drawing, ctx, isSelected, isHovered);
        break;
      case "text":
        renderTextAnnotation(drawing, ctx, isSelected, isHovered);
        break;
      case "measure":
        renderMeasure(drawing, ctx, isSelected, isHovered);
        break;
    }
  }

  // Render a preview by type
  function renderPreviewByType(
    pending: typeof pendingDrawing,
    ctx: RenderContext
  ): void {
    if (!pending) return;

    switch (pending.type) {
      case "trendline":
        renderTrendlinePreview(pending.points, pending.style, ctx);
        break;
      case "horizontal":
        renderHorizontalLinePreview(pending.points, pending.style, ctx);
        break;
      case "vertical":
        renderVerticalLinePreview(pending.points, pending.style, ctx);
        break;
      case "fib_retracement":
        renderFibRetracementPreview(pending.points, pending.style, ctx);
        break;
      case "rectangle":
        renderRectanglePreview(pending.points, pending.style, ctx);
        break;
      case "channel":
        renderChannelPreview(pending.points, pending.style, ctx);
        break;
      case "text":
        renderTextAnnotationPreview(pending.points, pending.style, ctx, pending.text_content);
        break;
      case "measure":
        renderMeasurePreview(pending.points, pending.style, ctx);
        break;
    }
  }

  // Hit test all drawings
  function hitTestDrawings(x: number, y: number): ChartDrawing | null {
    if (!chartRef.current || !seriesRef.current || !overlayCanvasRef.current) return null;

    const ctx: RenderContext = {
      chart: chartRef.current,
      series: seriesRef.current,
      canvas: overlayCanvasRef.current.getContext("2d")!,
      isIntraday: isIntradayPeriod(activePeriod),
      chartWidth: overlayCanvasRef.current.clientWidth,
      chartHeight: overlayCanvasRef.current.clientHeight,
    };

    // Test in reverse order (top-most first)
    for (let i = drawings.length - 1; i >= 0; i--) {
      const drawing = drawings[i];
      if (!drawing.is_visible) continue;

      let result;
      switch (drawing.drawing_type) {
        case "trendline":
          result = hitTestTrendline(drawing, x, y, ctx);
          break;
        case "horizontal":
          result = hitTestHorizontalLine(drawing, x, y, ctx);
          break;
        case "vertical":
          result = hitTestVerticalLine(drawing, x, y, ctx);
          break;
        case "fib_retracement":
          result = hitTestFibRetracement(drawing, x, y, ctx);
          break;
        case "rectangle":
          result = hitTestRectangle(drawing, x, y, ctx);
          break;
        case "channel":
          result = hitTestChannel(drawing, x, y, ctx);
          break;
        case "text":
          result = hitTestTextAnnotation(drawing, x, y, ctx);
          break;
        case "measure":
          result = hitTestMeasure(drawing, x, y, ctx);
          break;
      }

      if (result?.hit) {
        return drawing;
      }
    }

    return null;
  }

  /**
   * Check if coordinates are within the chart's drawable area.
   * Excludes the price scale (right) and time scale (bottom).
   */
  const isWithinChartBounds = useCallback(
    (x: number, y: number): boolean => {
      if (!chartRef.current) return false;

      const chart = chartRef.current;
      const timeScaleHeight = 30;
      const priceScaleWidth = chart.priceScale("right").width();
      const chartWidthValue = chartContainerRef.current?.clientWidth ?? 0;
      const chartHeight = chartContainerRef.current?.clientHeight ?? 0;

      const withinX = x >= 0 && x <= chartWidthValue - priceScaleWidth;
      const withinY = y >= 0 && y <= chartHeight - timeScaleHeight;

      return withinX && withinY;
    },
    []
  );

  // Mouse event handlers
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.stopPropagation();
      e.preventDefault();

      if (!chartReady) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!isWithinChartBounds(x, y)) return;

      const point = pixelToCoords(x, y);
      if (!point) return;

      if (mode === "select") {
        const hitDrawing = hitTestDrawings(x, y);
        if (hitDrawing) {
          selectDrawing(hitDrawing.id);
        } else {
          clearSelection();
        }
      } else {
        const drawingType = mode as DrawingType;
        const needed = requiredPoints[drawingType];

        if (!pendingDrawing) {
          if (needed === 1) {
            createDrawing({
              ticker,
              drawing_type: drawingType,
              points: [point],
              style: currentStyle,
              text_content: drawingType === "text" ? textInput : undefined,
            });
          } else {
            startDrawing(drawingType, point, currentStyle);
          }
        } else {
          const finalPoints = addPoint(point);

          if (finalPoints) {
            createDrawing({
              ticker,
              drawing_type: pendingDrawing.type,
              points: finalPoints,
              style: pendingDrawing.style,
              text_content: pendingDrawing.text_content,
            });
            clearPendingDrawing();
          }
        }
      }
    },
    [
      mode,
      pendingDrawing,
      pixelToCoords,
      isWithinChartBounds,
      startDrawing,
      addPoint,
      clearPendingDrawing,
      createDrawing,
      selectDrawing,
      clearSelection,
      currentStyle,
      textInput,
      ticker,
      chartReady,
    ]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!chartReady) return;

      // Throttle to 60fps — mousemove fires hundreds of times/sec, but the
      // browser can only render at 60fps. Most events produce no visible change.
      const now = performance.now();
      if (now - lastMoveTimeRef.current < 16) return;
      lastMoveTimeRef.current = now;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const withinBounds = isWithinChartBounds(x, y);

      if (mode === "select") {
        if (withinBounds) {
          const hitDrawing = hitTestDrawings(x, y);
          setHoveredDrawingId(hitDrawing?.id ?? null);
        } else {
          setHoveredDrawingId(null);
        }
      } else if (pendingDrawing && withinBounds) {
        const point = pixelToCoords(x, y);
        if (point) {
          updateLastPoint(point);
        }
      }
    },
    [mode, pendingDrawing, pixelToCoords, updateLastPoint, chartReady, isWithinChartBounds]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingDrawing) {
          cancelDrawing();
        } else if (selectedDrawing) {
          clearSelection();
        }
        setMode("select");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedDrawing) {
          deleteDrawing(selectedDrawing.drawingId);
          clearSelection();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingDrawing, selectedDrawing, cancelDrawing, clearSelection, deleteDrawing, setMode]);

  const handlePeriodClick = (period: string) => {
    setActivePeriod(period);
    onPeriodChange(period);
  };

  // Determine which sub-panes to show
  const showVolume = volumeConfig?.enabled && indicatorData.volume.length > 0;
  const showRSI = rsiConfig?.enabled && indicatorData.rsi.length > 0;
  const showMACD = macdConfig?.enabled && indicatorData.macd.length > 0;

  return (
    <div style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{ticker} Price Chart</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodClick(p.value)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                background: activePeriod === p.value ? "#3b82f6" : "#2d2d2d",
                color: "#fff",
                border: "none",
                borderRadius: 4,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ position: "relative" }}>
        <div ref={chartContainerRef} style={{ borderRadius: 8, overflow: "hidden" }} />

        {/* Overlay Canvas for Drawings */}
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 5,
            pointerEvents: mode !== "select" || hoveredDrawingId ? "auto" : "none",
            cursor: mode === "select" ? (hoveredDrawingId ? "pointer" : "default") : "crosshair",
          }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
        />

        {/* Indicator Toolbar (Right) */}
        <IndicatorToolbar
          configs={indicatorConfigs}
          isEnabled={isEnabled}
          toggleIndicator={toggleIndicator}
          updateParams={updateParams}
          updateStyle={updateStyle}
        />

        {/* Error Toast */}
        {error && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 12,
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: 8,
              zIndex: 20,
            }}
          >
            {error}
            <button
              onClick={clearError}
              style={{
                background: "transparent",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                padding: 0,
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#333",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
              color: "#888",
              zIndex: 20,
            }}
          >
            Loading drawings...
          </div>
        )}

        {/* Loading More Historical Data Indicator */}
        {isLoadingMore && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(59, 130, 246, 0.9)",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 11,
              color: "#fff",
              zIndex: 20,
            }}
          >
            Loading history...
          </div>
        )}
      </div>

      {/* Sub-Panes for Volume, RSI, MACD */}
      {showVolume && volumeConfig && (
        <SubPane
          type="volume"
          data={indicatorData.volume}
          config={volumeConfig}
          width={chartWidth}
          height={VOLUME_HEIGHT}
          mainChart={chartRef.current}
          isIntraday={isIntraday}
        />
      )}

      {showRSI && rsiConfig && (
        <SubPane
          type="rsi"
          data={indicatorData.rsi}
          config={rsiConfig}
          width={chartWidth}
          height={RSI_HEIGHT}
          mainChart={chartRef.current}
          isIntraday={isIntraday}
        />
      )}

      {showMACD && macdConfig && (
        <SubPane
          type="macd"
          data={indicatorData.macd}
          config={macdConfig}
          width={chartWidth}
          height={MACD_HEIGHT}
          mainChart={chartRef.current}
          isIntraday={isIntraday}
        />
      )}
    </div>
  );
}
