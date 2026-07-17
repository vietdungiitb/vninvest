import 'vninvestcharts-widget/dist/index.css';
import React, { createElement, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { VNInvestCharts, widgetMessagesVi } from 'vninvestcharts-widget';
import { createChartStockDataAdapter } from '../adapters/chartAdapter.js';
import { mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries } from '../utils/VNInvestSignalAdapter.js';
import { useViewportWhaleMarkers } from '../features/stock-detail/hooks/useViewportWhaleMarkers.js';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext.js';

const e = createElement;

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'stockDetail.chartPrice': 'Giá',
        'stockDetail.chartVolume': 'Khối lượng',
        'stockDetail.chartRsiMacd': 'RSI + MACD',
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

  const adapter = useMemo(() => createChartStockDataAdapter({ env }), [env]);

  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: symbol ? [symbol] : [],
    pollInterval: 5000,
  });

  const quote = realtimeFeed?.quotesBySymbol?.[symbol] ?? null;

  const buildBarFromQuote = useCallback((q) => {
    if (!q || !q.current_price) return null;
    const tf = (activeTimeframe || '').toLowerCase();
    const isDaily = tf === 'd' || tf === '1d';
    let barDate;
    if (isDaily) {
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

  const nextBar = useMemo(() => buildBarFromQuote(quote), [quote, buildBarFromQuote]);
  if (nextBar) {
    adapter.pushRealtimeBar(nextBar);
  }

  const [internalBars, setInternalBars] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);

  useEffect(() => {
    setVisibleRange(null);
  }, [symbol, activeTimeframe, activePeriod]);

  const enrichedBars = useMemo(() => mapToOHLCVBars(internalBars), [internalBars]);

  const candlesForHook = useMemo(() => {
    return enrichedBars.map((bar) => ({
      ...bar,
      time: bar.time ?? bar.timestamp ?? (bar.date instanceof Date ? bar.date.getTime() : new Date(bar.date).getTime()) ?? bar.index,
    }));
  }, [enrichedBars]);

  const startIndex = visibleRange ? visibleRange.startIndex : 0;
  const endIndex = visibleRange ? visibleRange.endIndex : 0;
  const whaleTimes = useViewportWhaleMarkers(candlesForHook, startIndex, endIndex);

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

  const customPanes = useMemo(() => [
    {
      id: 'price',
      label: t('stockDetail.chartPrice', { defaultValue: 'Giá' }),
      pinned: true,
      visible: true,
      heightRatio: 0.55,
      splitScale: false,
      tooltip: 'ohlc',
      series: [
        { type: 'Candlestick', yAxis: 'right' },
        { type: 'EMA', params: { period: 20 }, yAxis: 'right', color: '#3b82f6' },
        { type: 'EMA', params: { period: 50 }, yAxis: 'right', color: '#f59e0b' },
        { type: 'BollingerBand', params: { period: 20, stdDev: 2, fillStyle: 'fade' }, yAxis: 'right' },
      ],
    },
    {
      id: 'volume',
      label: t('stockDetail.chartVolume', { defaultValue: 'Khối lượng' }),
      pinned: false,
      visible: true,
      heightRatio: 0.22,
      splitScale: false,
      tooltip: 'value',
      series: [{ type: 'Volume', yAxis: 'right' }],
    },
    {
      id: 'rsi_macd',
      label: t('stockDetail.chartRsiMacd', { defaultValue: 'RSI + MACD' }),
      pinned: false,
      visible: true,
      heightRatio: 0.23,
      splitScale: true,
      tooltip: 'value',
      series: [
        { type: 'RSI', yAxis: 'left', color: '#38bdf8', scaleSlotId: 'rsi-left' },
        { type: 'MACD', yAxis: 'right', color: '#34d399', scaleSlotId: 'macd-right' },
      ],
    },
  ], [t]);

  const handleVisibleRangeChange = useCallback((range) => {
    setVisibleRange(range);
    onVisibleRangeChange?.(range);
  }, [onVisibleRangeChange]);

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
          adapter,
          symbol,
          timeframe: activeTimeframe?.toLowerCase() === 'd' ? '1d' : activeTimeframe?.toLowerCase() === '1h' ? '1h' : activeTimeframe?.toLowerCase(),
          range: activePeriod,
          onRangeChange: onPeriodChange,
          panes: customPanes,
          drawingUiEnabled: true,
          showToolbar: true,
          showHeader: true,
          showFooter: true,
          locale: 'vi',
          messages: widgetMessagesVi,
          theme: 'dark',
          enableWhale: true,
          whaleOrders: mappedWhaleOrders,
          enableCVD,
          externalCvdSeries: mappedCvdSeries?.length ? mappedCvdSeries : undefined,
          darkFlowStrength: orderFlowData?.darkFlowStrength ?? null,
          darkFlowSignalType: undefined,
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
          ref: chartRef,
        },
      );

  return e(
    'div',
    { ref: chartContainerRef, className: 'flex flex-col h-full bg-[#0a0f1d] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative' },
    e('div', { className: 'flex-1 h-full relative' }, chartBody),
  );
}
