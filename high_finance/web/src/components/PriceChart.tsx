import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

interface PriceData {
  date: string;       // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss"
  timestamp: number;  // unix seconds (your backend returns seconds ✅)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  data: PriceData[];
  ticker: string;
  onPeriodChange: (period: string) => void;
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

export function PriceChart({ data, ticker, onPeriodChange }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [activePeriod, setActivePeriod] = useState("1y");

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
        timeVisible: true, // will be overridden based on period
      },
      rightPriceScale: { borderColor: "#3d3d3d" },
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

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data || data.length === 0) {
      seriesRef.current.setData([]);
      return;
    }

    const intraday = activePeriod === "1d" || activePeriod === "5d";

    // IMPORTANT: daily uses BusinessDay string to avoid weekend/time gaps
    const chartData = data
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({
        time: intraday
          ? (d.timestamp as UTCTimestamp)
          : d.date.slice(0, 10), // "YYYY-MM-DD"
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

    // Toggle time formatting on x-axis
    chartRef.current.applyOptions({
      timeScale: {
        timeVisible: intraday,
        secondsVisible: false,
      },
    });

    seriesRef.current.setData(chartData);
    chartRef.current.timeScale().fitContent();
  }, [data, activePeriod]);

  const handlePeriodClick = (period: string) => {
    setActivePeriod(period);
    onPeriodChange(period);
  };

  return (
    <div>
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
      <div ref={chartContainerRef} style={{ borderRadius: 8, overflow: "hidden" }} />
    </div>
  );
}
