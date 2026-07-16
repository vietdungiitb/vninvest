import React, { createElement, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toCanonicalMinute } from '../utils/whaleTimeAdapter.js';
import { mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries } from '../utils/VNInvestSignalAdapter.js';
import { VNInvestCharts, MockAdapter, OverlayCanvas, widgetMessagesVi } from './vninvestcharts/index.js';
import { useViewportWhaleMarkers } from '../features/stock-detail/hooks/useViewportWhaleMarkers.js';
import { createCoreApiAdapter } from '../adapters/coreApiAdapter.js';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext.js';
import { useEChartsResize } from '../hooks/useChartResize.js';

const e = createElement;

class CoreApiChartAdapter {
  constructor(symbol, timeframe, coreAdapter) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.coreAdapter = coreAdapter;
    this.label = "core-api-adapter";
  }

  getSourceSemantics() {
    return {
      sourceId: "core-api-adapter",
      sourceContractVersion: "vnstocks-window-v1",
      instrumentClass: "equity",
      coverageMode: "window-hint",
      sessionModel: "exchange-calendar",
      timezone: "Asia/Ho_Chi_Minh",
      sessionCalendarId: "vn-exchange-calendar",
      supportsExactRangeFetch: false,
      supportsBackwardAnchor: true,
      supportsForwardAnchor: false,
      supportsLiveBars: true,
      maxBarsPerRequest: 3650,
      finalityMode: "historically-correctable",
      expectedGapReasons: ["not-fetched", "market-closed", "source-no-data", "rate-limited", "boundary-exhausted"],
    };
  }

  mapPointToBar(point, index) {
    return {
      date: new Date(point.timestamp ?? point.time ?? point.date),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
      index,
      dataIndex: index,
    };
  }

  resolveDays(params) {
    const rawTf = String(params.interval || "");
    const tf = rawTf.toLowerCase();
    let intervalMs = 60 * 60 * 1000; // default 1H
    if (rawTf.includes("M")) {
      intervalMs = 30 * 24 * 60 * 60 * 1000;
    } else if (rawTf.includes("m")) {
      const mins = parseInt(tf) || 15;
      intervalMs = mins * 60 * 1000;
    } else if (tf.includes("d")) {
      intervalMs = 24 * 60 * 60 * 1000;
    } else if (tf.includes("w")) {
      intervalMs = 7 * 24 * 60 * 60 * 1000;
    } else if (tf.includes("h")) {
      const hrs = parseInt(tf) || 1;
      intervalMs = hrs * 60 * 60 * 1000;
    }

    const requestedWindowMs = Math.max(1, params.limit) * intervalMs;
    if (params.type === "backward" && params.timestamp !== null) {
      const anchorWindowMs = Math.max(0, Date.now() - params.timestamp);
      return Math.max(1, Math.min(3650, Math.ceil((anchorWindowMs + requestedWindowMs) / (24 * 60 * 60 * 1000))));
    }
    return Math.max(1, Math.min(3650, Math.ceil(requestedWindowMs / (24 * 60 * 60 * 1000))));
  }

  async getBars(params) {
    const days = this.resolveDays(params);
    const intervalLower = String(params.interval || "").toLowerCase();
    const safeInterval = intervalLower === "1d" || intervalLower === "d" ? "D" : intervalLower === "1h" ? "1H" : params.interval;
    
    const payload = await this.coreAdapter.getStockChartHistory(params.symbol, {
      timeframe: safeInterval,
      days: days,
    });

    const points = payload.points
      ?? payload.results
      ?? payload.bars
      ?? payload.candles
      ?? payload.data?.points
      ?? payload;

    const allBars = (Array.isArray(points) ? points : [])
      .map((p, idx) => this.mapPointToBar(p, idx))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const backwardAnchor = params.type === "backward" ? params.timestamp : null;
    const bars = backwardAnchor !== null
      ? allBars.filter((bar) => bar.date.getTime() < backwardAnchor).slice(-params.limit)
      : allBars.slice(-params.limit);

    return {
      bars,
      hasMore: bars.length > 0,
    };
  }

  getBarsCanonical(params) {
    return this.getBars(params).then((result) => {
      const coverage = this.buildCoverage(result, params);
      return { ...result, coverage };
    });
  }

  buildCoverage(result, params) {
    const { bars, hasMore } = result;
    if (bars.length === 0) {
      if (params.type === "backward" && params.timestamp !== null) {
        return [
          { fromTs: 0, toTs: params.timestamp, status: "unresolved", reason: "boundary-exhausted" },
        ];
      }
      return [{ fromTs: 0, toTs: Date.now(), status: "unresolved", reason: "source-no-data" }];
    }
    const oldestTs = bars[0].date.getTime();
    const newestTs = bars[bars.length - 1].date.getTime();
    const covered = { fromTs: oldestTs, toTs: newestTs, status: "covered" };
    if (!hasMore) {
      return [
        { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
        covered,
      ];
    }
    return [covered];
  }

  async fetchBarsInRange(symbol, timeframe, from, to) {
    const days = Math.max(1, Math.min(3650, Math.ceil((Date.now() - from.getTime()) / (24 * 60 * 60 * 1000))));
    const intervalLower = String(timeframe || "").toLowerCase();
    const safeInterval = intervalLower === "1d" || intervalLower === "d" ? "D" : intervalLower === "1h" ? "1H" : timeframe;
    
    const payload = await this.coreAdapter.getStockChartHistory(symbol, {
      timeframe: safeInterval,
      days: days,
    });

    const points = payload.points
      ?? payload.results
      ?? payload.bars
      ?? payload.candles
      ?? payload.data?.points
      ?? payload;

    const fromTs = from.getTime();
    const toTs = to.getTime();

    return (Array.isArray(points) ? points : [])
      .map((p, idx) => this.mapPointToBar(p, idx))
      .filter((bar) => bar.date.getTime() >= fromTs && bar.date.getTime() <= toTs)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async fetchBarsBefore(symbol, timeframe, before, limit = 300) {
    const intervalLower = String(timeframe || "").toLowerCase();
    let intervalMs = 60 * 60 * 1000;
    if (intervalLower.includes("m")) {
      const mins = parseInt(intervalLower) || 15;
      intervalMs = mins * 60 * 1000;
    } else if (intervalLower.includes("d")) {
      intervalMs = 24 * 60 * 60 * 1000;
    } else if (intervalLower.includes("h")) {
      const hrs = parseInt(intervalLower) || 1;
      intervalMs = hrs * 60 * 60 * 1000;
    }

    const requestedWindowMs = Math.max(1, limit) * intervalMs;
    const anchorWindowMs = Math.max(0, Date.now() - before.getTime());
    const days = Math.max(1, Math.min(3650, Math.ceil((anchorWindowMs + requestedWindowMs) / (24 * 60 * 60 * 1000))));
    
    const safeInterval = intervalLower === "1d" || intervalLower === "d" ? "D" : intervalLower === "1h" ? "1H" : timeframe;

    const payload = await this.coreAdapter.getStockChartHistory(symbol, {
      timeframe: safeInterval,
      days: days,
    });

    const points = payload.points
      ?? payload.results
      ?? payload.bars
      ?? payload.candles
      ?? payload.data?.points
      ?? payload;

    const beforeTs = before.getTime();

    return (Array.isArray(points) ? points : [])
      .map((p, idx) => this.mapPointToBar(p, idx))
      .filter((bar) => bar.date.getTime() < beforeTs)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-limit);
  }

  subscribeToBar(symbol, timeframe, onBar) {
    this.onBarCallback = onBar;
    return () => {
      this.onBarCallback = null;
    };
  }
  subscribeToTrades(symbol, onTrade) {
    return () => {};
  }
  subscribeToOrderbook(symbol, onUpdate) {
    return () => {};
  }
  async searchSymbols() {
    return [{ symbol: this.symbol, name: this.symbol, exchange: "VNINVEST" }];
  }
}



// Custom canvas overlay to draw top 10% shark viewport markers (🟢🦈/🔴🦈)
function ViewportSharkMarkersOverlay({ visibleRange, whaleTimes }) {
  const draw = useCallback((context) => {
    const { ctx, xScale, yScale, plotData, devicePixelRatio: dpr } = context;
    if (!visibleRange || plotData.length === 0 || !whaleTimes || whaleTimes.size === 0) return;

    const startIndex = Math.max(0, visibleRange.startIndex);
    const endIndex = Math.min(plotData.length - 1, visibleRange.endIndex);
    const visibleBars = plotData.slice(startIndex, endIndex + 1);
    if (visibleBars.length === 0) return;

    ctx.save();
    ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    visibleBars.forEach((bar) => {
      const barTime = bar.time ?? bar.timestamp ?? (bar.date instanceof Date ? bar.date.getTime() : new Date(bar.date).getTime()) ?? (bar.dataIndex ?? bar.index);
      if (!whaleTimes.has(barTime)) return;

      const idx = bar.dataIndex ?? bar.index;
      let x = xScale(idx);
      if (isNaN(x)) {
        x = xScale(new Date(bar.date));
      }
      if (isNaN(x)) return;

      const isBuy = (bar.close || 0) >= (bar.open || 0);
      const emoji = isBuy ? '🟢🦈' : '🔴🦈';

      const price = isBuy ? (bar.low ?? bar.close) : (bar.high ?? bar.close);
      const y = yScale(price);

      const offset = 14 * dpr;
      const drawY = isBuy ? y + offset : y - offset;

      ctx.fillText(emoji, x, drawY);
    });

    ctx.restore();
  }, [visibleRange, whaleTimes]);

  return e(OverlayCanvas, { draw, zIndex: 10 });
}



function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'stockDetail.chartPrice': 'Giá',
        'stockDetail.chartVolume': 'Khối lượng',
        'stockDetail.chartRsiMacd': 'RSI + MACD',
        'whaleAlertsDashboard.flowCvdPaneTitle': 'CVD Chuẩn Hóa',
        'whaleAlertsDashboard.flowStrengthPaneTitle': 'Sức Mạnh Dòng Tiền',
        'vninvest.loading': 'Đang tải dữ liệu biểu đồ...',
      };
      return map[key] || options?.defaultValue || key;
    },
    language: 'vi',
  };
}

export default function VNStockChartPanel({
  symbol,
  env,
  onBarsChange,
  loading = false,
  activePeriod,
  activeTimeframe,
  onPeriodChange,
  onTimeframeChange,
  onVisibleRangeChange,
  onSessionChange,
  flowData = null,
  whaleSignals = [],
  orderFlowData = null,
  enableCVD = false,
  enableInstitutionalStrength = false,
}) {
  const { t } = useI18n();
  const [internalBars, setInternalBars] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);
  const [xExtents, setXExtents] = useState(undefined);

  // Reset viewport state when symbol, timeframe, or period changes
  useEffect(() => {
    setVisibleRange(null);
    setXExtents(undefined);
  }, [symbol, activeTimeframe, activePeriod]);

  const coreAdapter = useMemo(() => createCoreApiAdapter({
    env,
    getToken: env?.getToken,
    getRefreshToken: env?.getRefreshToken,
    setTokens: env?.setTokens,
    clearTokens: env?.clearTokens,
  }), [env]);
  const chartAdapter = useMemo(() => new CoreApiChartAdapter(symbol, activeTimeframe, coreAdapter), [symbol, activeTimeframe, coreAdapter]);

  // --- Real-time WebSocket Feed to Chart Adapter ---
  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: symbol ? [symbol] : [],
    pollInterval: 5000,
  });

  const quote = realtimeFeed?.quotesBySymbol?.[symbol] ?? null;
  const pendingQuoteRef = useRef(null);

  // Build a bar object from the WebSocket quote
  const buildBarFromQuote = useCallback((q) => {
    if (!q || !q.current_price) return null;
    // For daily timeframe, use today's date at midnight; for intraday, use last_date
    const tf = (activeTimeframe || '').toLowerCase();
    const isDaily = tf === 'd' || tf === '1d';
    let barDate;
    if (isDaily) {
      // Use today's date so daily candle shows on today's slot
      const now = new Date();
      barDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      barDate = new Date(q.last_date || Date.now());
    }
    return {
      date: barDate,
      open: Number(q.open_price ?? q.current_price),
      high: Number(q.high_price ?? q.current_price),
      low: Number(q.low_price ?? q.current_price),
      close: Number(q.current_price),
      volume: Number(q.volume ?? 0),
    };
  }, [activeTimeframe]);

  // Push bar to chart when both quote and callback are ready
  useEffect(() => {
    const nextBar = buildBarFromQuote(quote);
    if (!nextBar) return;

    // If callback is already registered, push immediately
    if (chartAdapter.onBarCallback) {
      chartAdapter.onBarCallback(nextBar);
      pendingQuoteRef.current = null;
      return;
    }

    // Otherwise, store as pending and retry via interval
    pendingQuoteRef.current = nextBar;
  }, [quote, chartAdapter, buildBarFromQuote]);

  // Retry interval: push pending bar when subscribeToBar callback becomes available
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (pendingQuoteRef.current && chartAdapter.onBarCallback) {
        chartAdapter.onBarCallback(pendingQuoteRef.current);
        pendingQuoteRef.current = null;
      }
    }, 500);
    return () => clearInterval(intervalId);
  }, [chartAdapter]);
  // -------------------------------------------------

  // Enriched bars mapped from local internalBars state
  const enrichedBars = useMemo(() => mapToOHLCVBars(internalBars), [internalBars]);

  // Enforce explicit time/timestamp for useViewportWhaleMarkers compliance
  const candlesForHook = useMemo(() => {
    return enrichedBars.map((bar) => ({
      ...bar,
      time: bar.time ?? bar.timestamp ?? (bar.date instanceof Date ? bar.date.getTime() : new Date(bar.date).getTime()) ?? bar.index,
    }));
  }, [enrichedBars]);

  const startIndex = visibleRange ? visibleRange.startIndex : 0;
  const endIndex = visibleRange ? visibleRange.endIndex : 0;
  const whaleTimes = useViewportWhaleMarkers(candlesForHook, startIndex, endIndex);

  // Enriched whale orders and CVD mapped from inputs
  const mappedWhaleOrders = useMemo(() => {
    const signalsOrders = whaleSignals.map(s => ({
      ts: s.ts ?? s.timestamp,
      price: s.price ?? s.close ?? 0,
      volume: s.volume ?? 0,
      side: s.side || 'buy',
      size_class: 'shark',
    }));
    return mapToWhaleOrders([...signalsOrders, ...(orderFlowData?.whale_orders || [])]);
  }, [whaleSignals, orderFlowData]);

  const mappedCvdSeries = useMemo(() => mapToCvdSeries(orderFlowData?.cvd_series || []), [orderFlowData]);



  // Define 3 explicit panes for the high-end chart (Price, Volume, and RSI+MACD)
  const customPanes = useMemo(() => [
    {
      id: "price",
      label: t('stockDetail.chartPrice', { defaultValue: "Giá" }),
      pinned: true,
      visible: true,
      heightRatio: 0.55,
      splitScale: false,
      tooltip: "ohlc",
      series: [
        { type: "Candlestick", yAxis: "right" },
        { type: "EMA", params: { period: 20 }, yAxis: "right", color: "#3b82f6" },
        { type: "EMA", params: { period: 50 }, yAxis: "right", color: "#f59e0b" },
        { type: "BollingerBand", params: { period: 20, stdDev: 2, fillStyle: 'fade' }, yAxis: "right" }
      ]
    },
    {
      id: "volume",
      label: t('stockDetail.chartVolume', { defaultValue: "Khối lượng" }),
      pinned: false,
      visible: true,
      heightRatio: 0.22,
      splitScale: false,
      tooltip: "value",
      series: [
        { type: "Volume", yAxis: "right" }
      ]
    },
    {
      id: "rsi_macd",
      label: t('stockDetail.chartRsiMacd', { defaultValue: "RSI + MACD" }),
      pinned: false,
      visible: true,
      heightRatio: 0.23,
      splitScale: true,
      tooltip: "value",
      series: [
        { type: "RSI", yAxis: "left", color: "#38bdf8", scaleSlotId: "rsi-left" },
        { type: "MACD", yAxis: "right", color: "#34d399", scaleSlotId: "macd-right" }
      ]
    }
  ], [t]);

  // Handle visible range updates to sync viewport indicators
  const handleVisibleRangeChange = useCallback((range) => {
    setVisibleRange(range);
    onVisibleRangeChange?.(range);
  }, [onVisibleRangeChange]);

  // Synchronize click event to session handler (facts-first binding)
  const handleClick = useCallback((moreProps) => {
    if (moreProps?.currentItem) {
      const item = moreProps.currentItem;
      const parsedDate = item.date instanceof Date ? item.date : new Date(item.date);
      const pad = (v) => String(v).padStart(2, '0');
      const dateStr = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
      onSessionChange?.({
        tradeDate: dateStr,
        timestamp: parsedDate.getTime(),
      });
    }
  }, [onSessionChange]);

  const handleBarsChange = useCallback((bars) => {
    setInternalBars(bars);
    onBarsChange?.(bars);
  }, [onBarsChange]);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  // Use ResizeObserver to handle sidebar collapse/expand
  useEChartsResize(chartRef, chartContainerRef, [activeTimeframe, activePeriod]);

  const chartBody = loading
    ? e(
        'div',
        { className: 'absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm text-slate-500' },
        e(
          'div',
          { className: 'flex flex-col items-center gap-2' },
          e('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500' }),
          e('span', null, t('vninvest.loading', { defaultValue: 'Đang tải dữ liệu biểu đồ...' })),
        ),
      )
    : e(
        VNInvestCharts,
        {
          adapter: chartAdapter,
          data: undefined,
          symbol: symbol,
          timeframe: activeTimeframe.toLowerCase() === 'd' ? '1d' : activeTimeframe.toLowerCase() === '1h' ? '1h' : activeTimeframe.toLowerCase(),
          supportedTimeframes: ['1m', '5m', '15m', '1h', '1D'],
          range: activePeriod,
          onRangeChange: onPeriodChange,
          panes: customPanes,
          xExtents: xExtents,
          engineRuntime: 'fork',
          drawingUiEnabled: true,
          showToolbar: true,
          showHeader: true,
          showFooter: true,
          locale: 'vi',
          messages: widgetMessagesVi,
          theme: 'dark',
          enableWhale: true,
          whaleOrders: mappedWhaleOrders,
          enableCVD: enableCVD,
          externalCvdSeries: undefined,
          darkFlowStrength: null,
          darkFlowSignalType: undefined,
          enableInstitutionalStrength: enableInstitutionalStrength,
          onClick: handleClick,
          onVisibleRangeChange: handleVisibleRangeChange,
          onBarsChange: handleBarsChange,
          onTimeframeChange: (tf) => {
            const mapped = tf === '1d' ? 'D' : tf === '1h' ? '1H' : tf;
            onTimeframeChange?.(mapped);
          },
          onSymbolChange: (sym) => {
            window.location.href = '/stocks/' + sym;
          },
          className: 'w-full h-full',
          ref: chartRef,
        },
        e(ViewportSharkMarkersOverlay, { visibleRange, whaleTimes }),
      );

  return e(
    'div',
    { ref: chartContainerRef, className: 'flex flex-col h-full bg-[#0a0f1d] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative' },
    e('div', { className: 'flex-1 h-full relative' }, chartBody),
  );
}
