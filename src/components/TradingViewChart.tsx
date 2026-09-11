import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  createChart, 
  LineStyle, 
  CandlestickSeries, 
  LineSeries, 
  AreaSeries, 
  HistogramSeries,
  CrosshairMode
} from 'lightweight-charts';
import { 
  Camera, 
  Maximize2,
  ExternalLink
} from 'lucide-react';
import { Candle } from '../types';
import { formatCompressedPrice } from '../utils/formatters';

interface TradingViewChartProps {
  tokenAddress: string;
  tokenPrice: number;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  tokenChain?: string;
  lastTrade?: { price: number; volume: number; timestamp: number } | null;
  wsConnected?: boolean;
}

const TIMEFRAME_STEPS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400
};

// Canonical DexScreener Colors & Styling with App-Blending Background
const DEX_THEME = {
  bg: 'transparent',                   // Transparent canvas allows smooth blending with app background/surface
  toolbarBg: 'transparent',
  grid: 'rgba(255, 255, 255, 0.035)',  // Ultra-subtle, clean grid lines
  text: '#787b86',                     // Canonical DexScreener text color
  border: 'rgba(255, 255, 255, 0.08)', // Blended scale border
  upColor: '#089981',                  // Canonical DexScreener emerald green
  downColor: '#f23645',                // Canonical DexScreener crimson red
  upVolume: 'rgba(8, 153, 129, 0.45)', // DexScreener green volume
  downVolume: 'rgba(242, 54, 69, 0.45)',// DexScreener red volume
  ema7: '#f1b90c',                     // DexScreener Gold
  ema25: '#e040fb',                    // DexScreener Magenta / Pink
  ema99: '#00e5ff',                    // DexScreener Cyan
  bollinger: '#7e57c2',                // Bollinger Purple
  rsi: '#7e57c2',                      // RSI Violet
  crosshair: 'rgba(255, 255, 255, 0.25)',
  crosshairLabel: '#2a2e39',
};

/**
 * Validates, deduplicates, and sanitizes candle data.
 */
function validateAndCleanCandles(rawCandles: any[]): Candle[] {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];

  const valid: Candle[] = [];
  const seenTimestamps = new Set<number>();

  const sorted = [...rawCandles].sort((a, b) => {
    const tA = typeof a.time === 'string' ? Math.floor(new Date(a.time).getTime() / 1000) : Number(a.time);
    const tB = typeof b.time === 'string' ? Math.floor(new Date(b.time).getTime() / 1000) : Number(b.time);
    return tA - tB;
  });

  for (const raw of sorted) {
    const time = typeof raw.time === 'string' ? Math.floor(new Date(raw.time).getTime() / 1000) : Number(raw.time);
    if (!time || isNaN(time) || time <= 0) continue;
    if (seenTimestamps.has(time)) continue;

    const open = Number(raw.open);
    const high = Number(raw.high);
    const low = Number(raw.low);
    const close = Number(raw.close);
    const volume = Number(raw.volume || 0);

    if (
      isNaN(open) || !isFinite(open) || open <= 0 ||
      isNaN(high) || !isFinite(high) || high <= 0 ||
      isNaN(low) || !isFinite(low) || low <= 0 ||
      isNaN(close) || !isFinite(close) || close <= 0
    ) {
      continue;
    }

    const trueHigh = Math.max(high, open, close);
    const trueLow = Math.min(low, open, close);

    seenTimestamps.add(time);
    valid.push({
      time,
      open,
      high: trueHigh,
      low: trueLow,
      close,
      volume: isNaN(volume) || volume < 0 ? 0 : volume,
    });
  }

  return valid;
}

const getChainSlug = (chain?: string): string => {
  if (!chain) return 'ethereum';
  const c = chain.toLowerCase();
  if (c.includes('solana') || c.includes('sol')) return 'solana';
  if (c.includes('base')) return 'base';
  if (c.includes('arbitrum') || c.includes('arb')) return 'arbitrum';
  if (c.includes('bsc') || c.includes('binance')) return 'bsc';
  if (c.includes('polygon') || c.includes('matic')) return 'polygon';
  if (c.includes('avalanche') || c.includes('avax')) return 'avalanche';
  if (c.includes('optimism') || c.includes('op')) return 'optimism';
  return 'ethereum';
};

export default function TradingViewChart({
  tokenAddress,
  tokenPrice,
  tokenSymbol,
  tokenChain,
  lastTrade,
  wsConnected = false
}: TradingViewChartProps) {
  // Config States
  const [timeframe, setTimeframe] = useState<string>('15m');
  const [candleStyle, setCandleStyle] = useState<'standard' | 'line' | 'area'>('standard');
  const [chartMode, setChartMode] = useState<'pro' | 'embed'>('pro');
  const [loading, setLoading] = useState<boolean>(true);

  // Technical Indicators States
  const [showEMA, setShowEMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showRSIPane, setShowRSIPane] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Chart Data State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<any>(null);
  const [candleCountdown, setCandleCountdown] = useState<string>('');

  // DOM Refs
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);

  // Lightweight Chart & Series Refs
  const chartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const mainSeriesRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const ema7SeriesRef = useRef<any>(null);
  const ema25SeriesRef = useRef<any>(null);
  const ema99SeriesRef = useRef<any>(null);
  const bbUpperSeriesRef = useRef<any>(null);
  const bbMiddleSeriesRef = useRef<any>(null);
  const bbLowerSeriesRef = useRef<any>(null);

  const candlesRef = useRef<Candle[]>([]);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Sync timeframe selection on address change
  useEffect(() => {
    setTimeframe('15m');
  }, [tokenAddress]);

  // Real-time Candle Countdown Timer (Exact DexScreener feature)
  useEffect(() => {
    const step = TIMEFRAME_STEPS[timeframe] || 900;
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const nextCandleTime = (Math.floor(nowSec / step) + 1) * step;
      const diff = Math.max(0, nextCandleTime - nowSec);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      if (hours > 0) {
        setCandleCountdown(`${hours}h ${String(minutes).padStart(2, '0')}m`);
      } else {
        setCandleCountdown(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  // Fetch candles
  const fetchCandles = async (isBackground = false) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch(`/api/tokens/${tokenAddress}/candles?timeframe=${timeframe}`, {
        signal: controller.signal
      });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const cleaned = validateAndCleanCandles(data);
          setCandles(cleaned.slice(-120));
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[SURCHI Chart] Candle fetch notice:', err?.message || err);
      }
    } finally {
      clearTimeout(id);
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    setCandles([]);
    setHoveredCandle(null);
    fetchCandles(false);
  }, [tokenAddress, timeframe]);

  // Helper formats
  const formatPriceRaw = (p: number) => {
    if (p === undefined || p === null || isNaN(p)) return '';
    return formatCompressedPrice(p);
  };

  const formatPrice = (p: number) => {
    const raw = formatPriceRaw(p);
    if (!raw) return '';
    return (p < 0 ? '-' : '') + '$' + raw.replace(/^-/, '');
  };

  const formatVolume = (v: number) => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  };

  // Build / Rebuild Main Lightweight Chart
  useEffect(() => {
    if (chartMode !== 'pro' || !chartContainerRef.current) return;

    // Clean previous chart instance if present
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const wrapper = chartWrapperRef.current;
    const initialWidth = wrapper?.clientWidth || 600;
    const initialHeight = wrapper?.clientHeight || 500;
    const mainHeight = showRSIPane ? Math.max(220, initialHeight - 105) : initialHeight;

    const chart = createChart(chartContainerRef.current, {
      width: initialWidth,
      height: mainHeight,
      layout: {
        background: { color: DEX_THEME.bg },
        textColor: DEX_THEME.text,
        fontFamily: 'JetBrains Mono, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: DEX_THEME.grid, style: LineStyle.Dotted },
        horzLines: { color: DEX_THEME.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: DEX_THEME.border,
        autoScale: true,
        scaleMargins: {
          top: 0.12,
          bottom: 0.20,
        },
        alignLabels: true,
        entireTextOnly: false,
      },
      timeScale: {
        borderColor: DEX_THEME.border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 10,
        minBarSpacing: 4,
        rightOffset: 8,
        tickMarkFormatter: (time: any) => {
          const unix = typeof time === 'number' ? time : Math.floor(new Date(time).getTime() / 1000);
          const date = new Date(unix * 1000);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[date.getUTCMonth()];
          const day = date.getUTCDate();
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          
          if (timeframe === '1d') {
            return `${month} ${day}`;
          }
          return `${hours}:${minutes}`;
        }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: DEX_THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: DEX_THEME.crosshairLabel,
        },
        horzLine: {
          color: DEX_THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: DEX_THEME.crosshairLabel,
        }
      },
      watermark: {
        visible: true,
        fontSize: 32,
        fontFamily: 'JetBrains Mono, monospace',
        color: 'rgba(255, 255, 255, 0.03)',
        text: `${tokenSymbol.toUpperCase()} / USD`,
        horzAlign: 'center',
        vertAlign: 'center',
      }
    } as any);

    // Main Series Setup
    let mainSeries: any = null;
    if (candleStyle === 'standard') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: DEX_THEME.upColor,
        downColor: DEX_THEME.downColor,
        borderUpColor: DEX_THEME.upColor,
        borderDownColor: DEX_THEME.downColor,
        wickUpColor: DEX_THEME.upColor,
        wickDownColor: DEX_THEME.downColor,
        borderVisible: true,
        wickVisible: true,
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineStyle: LineStyle.Dotted,
        priceLineColor: DEX_THEME.upColor,
        lastValueVisible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => formatPriceRaw(price),
        },
      });
    } else if (candleStyle === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#00e5ff',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: '#00e5ff',
        lastValueVisible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => formatPriceRaw(price),
        },
      });
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: 'rgba(0, 229, 255, 0.35)',
        bottomColor: 'rgba(0, 229, 255, 0.01)',
        lineColor: '#00e5ff',
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => formatPriceRaw(price),
        },
      });
    }

    // Volume Overlay (Bottom 18%, Green/Red matched bars)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Overlay series inside main canvas
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    // Technical Indicators
    const ema7Series = chart.addSeries(LineSeries, {
      color: DEX_THEME.ema7,
      lineWidth: 1,
      priceScaleId: 'right',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ema25Series = chart.addSeries(LineSeries, {
      color: DEX_THEME.ema25,
      lineWidth: 1,
      priceScaleId: 'right',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ema99Series = chart.addSeries(LineSeries, {
      color: DEX_THEME.ema99,
      lineWidth: 1,
      priceScaleId: 'right',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: DEX_THEME.bollinger,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: 'rgba(126, 87, 194, 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: DEX_THEME.bollinger,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Set initial visibility
    ema7Series.applyOptions({ visible: showEMA });
    ema25Series.applyOptions({ visible: showEMA });
    ema99Series.applyOptions({ visible: showEMA });
    bbUpperSeries.applyOptions({ visible: showBollinger });
    bbMiddleSeries.applyOptions({ visible: showBollinger });
    bbLowerSeries.applyOptions({ visible: showBollinger });
    volumeSeries.applyOptions({ visible: showVolume });

    // Store refs
    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    volumeSeriesRef.current = volumeSeries;
    ema7SeriesRef.current = ema7Series;
    ema25SeriesRef.current = ema25Series;
    ema99SeriesRef.current = ema99Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;

    // Crosshair hover listener
    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time) {
        setHoveredCandle(null);
        return;
      }
      let dataPoint: any = null;
      if (param.seriesData && mainSeries) {
        dataPoint = param.seriesData.get(mainSeries);
      }
      const t = typeof param.time === 'number' ? param.time : Math.floor(new Date(param.time).getTime() / 1000);
      const candleItem = candlesRef.current.find((c: any) => c.time === t);

      if (dataPoint || candleItem) {
        setHoveredCandle({
          open: dataPoint?.open ?? candleItem?.open ?? 0,
          high: dataPoint?.high ?? candleItem?.high ?? 0,
          low: dataPoint?.low ?? candleItem?.low ?? 0,
          close: dataPoint?.close ?? dataPoint?.value ?? candleItem?.close ?? 0,
          volume: candleItem?.volume ?? 0,
          time: t
        });
      } else {
        setHoveredCandle(null);
      }
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema7SeriesRef.current = null;
      ema25SeriesRef.current = null;
      ema99SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
    };
  }, [chartMode, candleStyle, showRSIPane, tokenAddress, timeframe]);

  // Secondary RSI Sub-Pane
  useEffect(() => {
    if (chartMode !== 'pro' || !showRSIPane || !rsiContainerRef.current) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
      return;
    }

    const wrapper = chartWrapperRef.current;
    const initialWidth = wrapper?.clientWidth || 600;

    const rsiChart = createChart(rsiContainerRef.current, {
      width: initialWidth,
      height: 95,
      layout: {
        background: { color: DEX_THEME.bg },
        textColor: DEX_THEME.text,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: DEX_THEME.grid, style: LineStyle.Dotted },
        horzLines: { color: DEX_THEME.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: DEX_THEME.border,
        autoScale: false,
        visible: true,
      },
      timeScale: {
        visible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: DEX_THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: DEX_THEME.crosshair,
          width: 1,
          style: LineStyle.Dashed,
        }
      },
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: DEX_THEME.rsi,
      lineWidth: 1,
      priceFormat: {
        type: 'custom',
        formatter: (val: number) => val.toFixed(0),
      },
    });

    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(242, 54, 69, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: '70',
    });

    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(8, 153, 129, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: '30',
    });

    rsiSeries.priceScale().applyOptions({
      autoScale: false,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });

    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiSeries;

    // Synchronize scales between main chart and RSI pane
    if (chartRef.current) {
      const mainTimeScale = chartRef.current.timeScale();
      const subTimeScale = rsiChart.timeScale();

      mainTimeScale.subscribeVisibleLogicalRangeChange((range: any) => {
        if (range) subTimeScale.setVisibleLogicalRange(range);
      });
      subTimeScale.subscribeVisibleLogicalRangeChange((range: any) => {
        if (range) mainTimeScale.setVisibleLogicalRange(range);
      });
    }

    return () => {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
      }
    };
  }, [showRSIPane, chartMode]);

  // Robust ResizeObserver: Prevents any canvas overflow and eliminates jitter
  useEffect(() => {
    if (!chartWrapperRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;

      if (width > 50 && height > 50) {
        const floorWidth = Math.floor(width);
        const mainHeight = showRSIPane ? Math.max(220, Math.floor(height) - 105) : Math.floor(height);

        if (chartRef.current) {
          chartRef.current.resize(floorWidth, mainHeight);
        }
        if (rsiChartRef.current && showRSIPane) {
          rsiChartRef.current.resize(floorWidth, 95);
        }
      }
    });

    resizeObserver.observe(chartWrapperRef.current);
    return () => resizeObserver.disconnect();
  }, [showRSIPane, chartMode]);

  // Toggle Series Visibility dynamically
  useEffect(() => {
    if (ema7SeriesRef.current) ema7SeriesRef.current.applyOptions({ visible: showEMA });
    if (ema25SeriesRef.current) ema25SeriesRef.current.applyOptions({ visible: showEMA });
    if (ema99SeriesRef.current) ema99SeriesRef.current.applyOptions({ visible: showEMA });
  }, [showEMA]);

  useEffect(() => {
    if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      bbUpperSeriesRef.current.applyOptions({ visible: showBollinger });
      bbMiddleSeriesRef.current.applyOptions({ visible: showBollinger });
      bbLowerSeriesRef.current.applyOptions({ visible: showBollinger });
    }
  }, [showBollinger]);

  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }
  }, [showVolume]);

  // Set Data to Series
  useEffect(() => {
    if (candles.length === 0 || !mainSeriesRef.current) return;

    if (candleStyle === 'line' || candleStyle === 'area') {
      mainSeriesRef.current.setData(candles.map(c => ({
        time: c.time as any,
        value: c.close
      })));
    } else {
      mainSeriesRef.current.setData(candles.map(c => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
    }

    // Set Volume series with distinct green / red candles
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(candles.map(c => ({
        time: c.time as any,
        value: c.volume || 0,
        color: c.close >= c.open ? DEX_THEME.upVolume : DEX_THEME.downVolume,
      })));
    }

    // Set EMAs
    if (ema7SeriesRef.current && candles.length >= 7) {
      ema7SeriesRef.current.setData(calculateEMA(candles, 7));
    }
    if (ema25SeriesRef.current && candles.length >= 25) {
      ema25SeriesRef.current.setData(calculateEMA(candles, 25));
    }
    if (ema99SeriesRef.current && candles.length >= 99) {
      ema99SeriesRef.current.setData(calculateEMA(candles, 99));
    }

    // Set Bollinger Bands
    if (bbUpperSeriesRef.current && candles.length >= 20) {
      const bb = calculateBollingerBands(candles, 20, 2);
      bbUpperSeriesRef.current.setData(bb.upper);
      bbMiddleSeriesRef.current.setData(bb.middle);
      bbLowerSeriesRef.current.setData(bb.lower);
    }

    // Set RSI
    if (showRSIPane && rsiSeriesRef.current && candles.length >= 14) {
      rsiSeriesRef.current.setData(calculateRSI(candles, 14));
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
    if (rsiChartRef.current) {
      rsiChartRef.current.timeScale().fitContent();
    }
  }, [candles, candleStyle, showRSIPane]);

  // Real-time Trade / Socket Tick Updater
  useEffect(() => {
    const activeCandles = candlesRef.current;
    if (activeCandles.length === 0 || !mainSeriesRef.current) return;

    const tickPrice = (lastTrade && lastTrade.price > 0) ? lastTrade.price : tokenPrice;
    if (!tickPrice || tickPrice <= 0) return;

    const lastCandle = activeCandles[activeCandles.length - 1];
    if (!lastCandle) return;

    const step = TIMEFRAME_STEPS[timeframe] || 900;
    const nowSec = (lastTrade && lastTrade.timestamp) ? Math.floor(lastTrade.timestamp) : Math.floor(Date.now() / 1000);
    const currentBucketTime = Math.floor(nowSec / step) * step;

    let next = [...activeCandles];
    let updatedCandle: Candle;

    if (currentBucketTime > lastCandle.time) {
      updatedCandle = {
        time: currentBucketTime,
        open: lastCandle.close,
        high: Math.max(lastCandle.close, tickPrice),
        low: Math.min(lastCandle.close, tickPrice),
        close: tickPrice,
        volume: lastTrade ? lastTrade.volume : 0,
      };
      next.push(updatedCandle);
    } else {
      const targetIndex = next.findIndex(c => c.time === currentBucketTime);
      if (targetIndex !== -1) {
        const matched = next[targetIndex];
        updatedCandle = {
          ...matched,
          high: Math.max(matched.high, tickPrice),
          low: Math.min(matched.low, tickPrice),
          close: tickPrice,
          volume: matched.volume + (lastTrade ? lastTrade.volume : 0),
        };
        next[targetIndex] = updatedCandle;
      } else {
        updatedCandle = {
          ...lastCandle,
          high: Math.max(lastCandle.high, tickPrice),
          low: Math.min(lastCandle.low, tickPrice),
          close: tickPrice,
          volume: lastCandle.volume + (lastTrade ? lastTrade.volume : 0),
        };
        next[next.length - 1] = updatedCandle;
      }
    }

    const slicedNext = next.slice(-120);
    candlesRef.current = slicedNext;
    setCandles(slicedNext);

    const newest = slicedNext[slicedNext.length - 1];
    if (newest && mainSeriesRef.current) {
      if (candleStyle === 'line' || candleStyle === 'area') {
        mainSeriesRef.current.update({
          time: newest.time,
          value: newest.close
        });
      } else {
        mainSeriesRef.current.update({
          time: newest.time,
          open: newest.open,
          high: newest.high,
          low: newest.low,
          close: newest.close,
        });
      }
    }

    if (newest && volumeSeriesRef.current) {
      volumeSeriesRef.current.update({
        time: newest.time,
        value: newest.volume || 0,
        color: newest.close >= newest.open ? DEX_THEME.upVolume : DEX_THEME.downVolume,
      });
    }

    // Update real-time EMAs
    if (showEMA && ema7SeriesRef.current && slicedNext.length >= 7) {
      const ema7 = calculateEMA(slicedNext, 7);
      if (ema7.length > 0) ema7SeriesRef.current.update(ema7[ema7.length - 1]);
    }
    if (showEMA && ema25SeriesRef.current && slicedNext.length >= 25) {
      const ema25 = calculateEMA(slicedNext, 25);
      if (ema25.length > 0) ema25SeriesRef.current.update(ema25[ema25.length - 1]);
    }
    if (showEMA && ema99SeriesRef.current && slicedNext.length >= 99) {
      const ema99 = calculateEMA(slicedNext, 99);
      if (ema99.length > 0) ema99SeriesRef.current.update(ema99[ema99.length - 1]);
    }
  }, [tokenPrice, lastTrade, timeframe, candleStyle, showEMA]);

  // Indicator Calculations
  const calculateEMA = (data: Candle[], period: number) => {
    if (data.length < period) return [];
    const ema: { time: any; value: number }[] = [];
    const k = 2 / (period + 1);
    
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    let currentEma = sum / period;
    ema.push({ time: data[period - 1].time, value: currentEma });

    for (let i = period; i < data.length; i++) {
      currentEma = data[i].close * k + currentEma * (1 - k);
      ema.push({ time: data[i].time, value: currentEma });
    }
    return ema;
  };

  const calculateBollingerBands = (data: Candle[], period: number = 20, multiplier: number = 2) => {
    if (data.length < period) return { upper: [], middle: [], lower: [] };
    const upper: { time: any; value: number }[] = [];
    const middle: { time: any; value: number }[] = [];
    const lower: { time: any; value: number }[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const sma = slice.reduce((sum, c) => sum + c.close, 0) / period;
      const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - sma, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      const time = data[i].time;
      middle.push({ time, value: sma });
      upper.push({ time, value: sma + multiplier * stdDev });
      lower.push({ time, value: sma - multiplier * stdDev });
    }
    return { upper, middle, lower };
  };

  const calculateRSI = (data: Candle[], period: number = 14) => {
    if (data.length < period + 1) return [];
    const rsi: { time: any; value: number }[] = [];
    
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push({ time: data[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS) });

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + rs) });
    }
    return rsi;
  };

  // Screenshot Capture
  const takeScreenshot = () => {
    if (!chartContainerRef.current) return;
    const canvas = chartContainerRef.current.querySelector('canvas');
    if (!canvas) return;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        const dataUrl = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `DexScreener_${tokenSymbol}_${timeframe}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('[Chart] Screenshot failed:', err);
    }
  };

  const handleFitView = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
    if (rsiChartRef.current) {
      rsiChartRef.current.timeScale().fitContent();
    }
  };

  // Active or Hovered Candle for the Legend
  const activeCandle = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  let priceChange = 0;
  let priceChangePct = 0;
  if (activeCandle) {
    priceChange = activeCandle.close - activeCandle.open;
    priceChangePct = activeCandle.open !== 0 ? (priceChange / activeCandle.open) * 100 : 0;
  }
  const isUp = priceChange >= 0;
  const priceColor = isUp ? 'text-[#089981]' : 'text-[#f23645]';

  // Dynamic Indicator values for the active candle
  const ema7Data = useMemo(() => candles.length >= 7 ? calculateEMA(candles, 7) : [], [candles]);
  const ema25Data = useMemo(() => candles.length >= 25 ? calculateEMA(candles, 25) : [], [candles]);
  const ema99Data = useMemo(() => candles.length >= 99 ? calculateEMA(candles, 99) : [], [candles]);

  const activeEma7 = activeCandle ? ema7Data.find(d => d.time === activeCandle.time)?.value : null;
  const activeEma25 = activeCandle ? ema25Data.find(d => d.time === activeCandle.time)?.value : null;
  const activeEma99 = activeCandle ? ema99Data.find(d => d.time === activeCandle.time)?.value : null;

  const isSolana = !tokenAddress.startsWith('0x');
  const chainSlug = getChainSlug(tokenChain || (isSolana ? 'solana' : 'ethereum'));
  const dexName = isSolana ? 'Raydium' : 'Uniswap v3';
  const displaySymbol = tokenSymbol.toUpperCase().includes('/') ? tokenSymbol.toUpperCase() : `${tokenSymbol.toUpperCase()}/USD`;

  return (
    <div 
      className="w-full bg-elegant-surface border border-elegant-border rounded-xl overflow-hidden flex flex-col font-mono shadow-xl transition-all select-none"
    >
      {/* 1. DexScreener Single-Row Fixed Toolbar - Blends seamlessly with app theme */}
      <div className="w-full h-10 px-3 bg-elegant-surface border-b border-elegant-border flex items-center justify-between gap-3 overflow-x-auto scrollbar-none whitespace-nowrap shrink-0 text-xs">
        {/* Left Side: Timeframe Selector & Candle Style */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timeframe Quick Pills */}
          <div className="flex items-center gap-0.5 bg-elegant-bg p-0.5 rounded border border-elegant-border">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => {
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#2a2e39] text-[#089981] shadow-xs'
                      : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-elegant-surface-hover'
                  }`}
                  title={`Switch to ${tf} timeframe`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-elegant-border mx-0.5" />

          {/* Style Selector */}
          <div className="flex items-center bg-elegant-bg p-0.5 rounded border border-elegant-border">
            {(['standard', 'line', 'area'] as const).map(style => {
              const isActive = candleStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCandleStyle(style)}
                  className={`px-2 py-0.5 text-[11px] capitalize rounded transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#2a2e39] text-white font-semibold'
                      : 'text-[#787b86] hover:text-[#d1d4dc]'
                  }`}
                  title={`Chart style: ${style}`}
                >
                  {style === 'standard' ? 'Candles' : style}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-elegant-border mx-0.5" />

          {/* Quick Technical Indicators Badges */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEMA(v => !v)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                showEMA
                  ? 'bg-[#f1b90c]/15 text-[#f1b90c] border-[#f1b90c]/40'
                  : 'bg-elegant-bg text-[#787b86] border-elegant-border hover:text-[#d1d4dc]'
              }`}
              title="Toggle EMAs (7, 25, 99)"
            >
              EMA
            </button>
            <button
              type="button"
              onClick={() => setShowBollinger(v => !v)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                showBollinger
                  ? 'bg-[#7e57c2]/15 text-[#b388ff] border-[#7e57c2]/40'
                  : 'bg-elegant-bg text-[#787b86] border-elegant-border hover:text-[#d1d4dc]'
              }`}
              title="Toggle Bollinger Bands"
            >
              BB
            </button>
            <button
              type="button"
              onClick={() => setShowRSIPane(v => !v)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                showRSIPane
                  ? 'bg-[#7e57c2]/20 text-[#b388ff] border-[#7e57c2]/40'
                  : 'bg-elegant-bg text-[#787b86] border-elegant-border hover:text-[#d1d4dc]'
              }`}
              title="Toggle RSI Oscillator"
            >
              RSI
            </button>
            <button
              type="button"
              onClick={() => setShowVolume(v => !v)}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                showVolume
                  ? 'bg-[#00e5ff]/15 text-[#00e5ff] border-[#00e5ff]/40'
                  : 'bg-elegant-bg text-[#787b86] border-elegant-border hover:text-[#d1d4dc]'
              }`}
              title="Toggle Volume Bars"
            >
              VOL
            </button>
          </div>
        </div>

        {/* Right Side: Tools & Mode Switch */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Status indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-elegant-bg border border-elegant-border text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-[#089981]' : 'bg-[#f23645]'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-[#089981]' : 'bg-[#f23645]'}`}></span>
            </span>
            <span className={`font-bold ${wsConnected ? 'text-[#089981]' : 'text-[#f23645]'}`}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFitView}
            className="p-1.5 rounded bg-elegant-bg border border-elegant-border text-[#787b86] hover:text-white hover:border-elegant-border-light transition-colors cursor-pointer"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={takeScreenshot}
            className="p-1.5 rounded bg-elegant-bg border border-elegant-border text-[#787b86] hover:text-white hover:border-elegant-border-light transition-colors cursor-pointer"
            title="Download PNG Screenshot"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-elegant-border mx-0.5" />

          {/* DexScreener Mode Switch Pill */}
          <div className="flex items-center bg-elegant-bg p-0.5 rounded border border-elegant-border">
            <button
              type="button"
              onClick={() => setChartMode('pro')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                chartMode === 'pro'
                  ? 'bg-[#2a2e39] text-[#089981]'
                  : 'text-[#787b86] hover:text-[#d1d4dc]'
              }`}
            >
              Pro Chart
            </button>
            <button
              type="button"
              onClick={() => setChartMode('embed')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer flex items-center gap-1 ${
                chartMode === 'embed'
                  ? 'bg-[#2a2e39] text-[#00e5ff]'
                  : 'text-[#787b86] hover:text-[#d1d4dc]'
              }`}
            >
              <span>DexScreener Embed</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Chart Body */}
      {chartMode === 'embed' ? (
        <div className="relative w-full h-[520px] sm:h-[560px] bg-elegant-surface overflow-hidden">
          <iframe
            src={`https://dexscreener.com/${chainSlug}/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`}
            title={`${tokenSymbol} DexScreener Embed Chart`}
            className="w-full h-full border-0"
            allow="clipboard-write"
          />
        </div>
      ) : (
        <div 
          className="relative w-full h-[480px] sm:h-[520px] md:h-[560px] bg-transparent overflow-hidden flex flex-col"
          ref={chartWrapperRef}
        >
          {/* Floating DexScreener Legend - Pinned top-left over the canvas, zero DOM layout shift */}
          <div className="absolute top-2.5 left-3.5 z-10 pointer-events-none select-none flex flex-col gap-1 max-w-[calc(100%-110px)]">
            {/* Pair & Ticker Line */}
            <div className="flex items-center gap-2 text-xs flex-wrap font-mono">
              <span className="font-extrabold text-white text-sm tracking-tight">{displaySymbol}</span>
              <span className="text-[10px] text-[#089981] bg-[#089981]/15 border border-[#089981]/30 px-1.5 py-0.5 rounded font-bold uppercase">
                {dexName}
              </span>
              <span className="text-[10px] text-[#787b86] bg-elegant-bg border border-elegant-border px-1.5 py-0.5 rounded uppercase">
                {timeframe.toUpperCase()}
              </span>
              {candleCountdown && (
                <span className="text-[10px] text-zinc-300 font-mono bg-elegant-surface/90 border border-elegant-border px-1.5 py-0.5 rounded shadow-xs">
                  ⏳ {candleCountdown}
                </span>
              )}
            </div>

            {/* OHLCV Dynamic Legend Line */}
            {activeCandle && (
              <div className="flex items-center gap-x-3 gap-y-0.5 text-[11px] font-mono flex-wrap tabular-nums text-[#787b86]">
                <span>O <span className={priceColor}>{formatPrice(activeCandle.open)}</span></span>
                <span>H <span className={priceColor}>{formatPrice(activeCandle.high)}</span></span>
                <span>L <span className={priceColor}>{formatPrice(activeCandle.low)}</span></span>
                <span>C <span className={priceColor}>{formatPrice(activeCandle.close)}</span></span>
                <span className={priceColor}>
                  {priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                </span>
                {showVolume && activeCandle.volume !== undefined && (
                  <span>
                    Vol <span className="text-zinc-200 font-semibold">{formatVolume(activeCandle.volume)}</span>
                  </span>
                )}
              </div>
            )}

            {/* Active EMA values */}
            {showEMA && (activeEma7 || activeEma25 || activeEma99) && (
              <div className="flex items-center gap-2.5 text-[10px] font-mono flex-wrap tabular-nums">
                {activeEma7 && <span className="text-[#f1b90c] font-medium">EMA(7): {formatPrice(activeEma7)}</span>}
                {activeEma25 && <span className="text-[#e040fb] font-medium">EMA(25): {formatPrice(activeEma25)}</span>}
                {activeEma99 && <span className="text-[#00e5ff] font-medium">EMA(99): {formatPrice(activeEma99)}</span>}
              </div>
            )}
          </div>

          {/* Loading Overlay */}
          {loading && candles.length === 0 && (
            <div className="absolute inset-0 z-20 bg-elegant-surface/85 flex items-center justify-center backdrop-blur-xs">
              <div className="flex items-center space-x-2 text-xs text-[#089981] font-mono">
                <div className="w-2 h-2 rounded-full bg-[#089981] animate-ping" />
                <span>Loading DexScreener Chart...</span>
              </div>
            </div>
          )}

          {/* Main Chart Canvas */}
          <div className="flex-1 w-full h-full overflow-hidden">
            <div ref={chartContainerRef} className="w-full h-full" />
          </div>

          {/* Secondary RSI Pane */}
          {showRSIPane && (
            <div className="border-t border-elegant-border bg-elegant-surface/90 shrink-0">
              <div className="flex items-center justify-between px-3 py-0.5 text-[10px] font-mono text-[#b388ff]">
                <span>RSI Osc. (14)</span>
                {candles.length > 14 && (
                  <span className="font-bold text-white bg-[#7e57c2]/20 px-1.5 py-0.5 rounded border border-[#7e57c2]/30">
                    {calculateRSI(candles, 14).slice(-1)[0]?.value.toFixed(2) || 'N/A'}
                  </span>
                )}
              </div>
              <div ref={rsiContainerRef} className="w-full h-[95px]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
