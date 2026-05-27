import React, { createElement, useState, useCallback, useMemo } from 'react';
import { toCanonicalMinute } from '../utils/whaleTimeAdapter.js';
import { mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries } from '../utils/VNInvestSignalAdapter.js';
import { VNStockChart, MockAdapter, OverlayCanvas } from './vnstockcharts/index.js';

const e = createElement;

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, Number(value)));
}

function resolveHeatmapMetric(bucket, mode = 'net') {
  const normalizedMode = String(mode || 'net').trim().toLowerCase();
  if (normalizedMode === 'off') {
    return null;
  }

  if (normalizedMode === 'buy') {
    const buyHeat = Number(bucket?.buyHeat);
    if (!Number.isFinite(buyHeat) || buyHeat <= 0) {
      return null;
    }
    return {
      kind: 'buy',
      intensity: buyHeat,
      signedValue: buyHeat,
    };
  }

  if (normalizedMode === 'sell') {
    const sellHeat = Number(bucket?.sellHeat);
    if (!Number.isFinite(sellHeat) || sellHeat <= 0) {
      return null;
    }
    return {
      kind: 'sell',
      intensity: sellHeat,
      signedValue: -sellHeat,
    };
  }

  const netHeat = Number(bucket?.netHeat);
  const whaleScore = Number(bucket?.whaleScore);
  const intensity = Math.max(
    Number.isFinite(netHeat) ? Math.abs(netHeat) : 0,
    Number.isFinite(whaleScore) ? whaleScore : 0,
  );
  if (intensity <= 0) {
    return null;
  }

  return {
    kind: Math.abs(netHeat) < 12 && whaleScore >= 45 ? 'whale' : netHeat >= 0 ? 'buy' : 'sell',
    intensity,
    signedValue: Number.isFinite(netHeat) ? netHeat : 0,
  };
}

function buildHeatmapBandColor(bucket, mode = 'net') {
  const metric = resolveHeatmapMetric(bucket, mode);
  if (!metric) {
    return null;
  }

  const magnitude = clamp(metric.intensity, 0, 100) / 100;
  const alpha = (0.08 + magnitude * 0.26).toFixed(3);

  if (metric.kind === 'whale') {
    return `rgba(245, 158, 11, ${alpha})`;
  }
  if (metric.kind === 'buy') {
    return `rgba(34, 197, 94, ${alpha})`;
  }
  return `rgba(244, 63, 94, ${alpha})`;
}

function buildFlowBucketLookup(viewModel, flowTimeframe) {
  const lookup = new Map();
  if (!viewModel || !Array.isArray(viewModel.buckets)) return lookup;

  viewModel.buckets.forEach((bucket) => {
    const minuteKey = toCanonicalMinute(bucket?.ts ?? bucket?.bucket_ts ?? bucket?.timestamp ?? bucket?.time ?? bucket?.date);
    if (minuteKey == null) return;
    lookup.set(String(minuteKey), bucket);
  });

  return lookup;
}

// Custom canvas overlay to draw top 10% shark viewport markers (🟢🦈/🔴🦈)
function ViewportSharkMarkersOverlay({ visibleRange }) {
  const draw = useCallback((context) => {
    const { ctx, xScale, yScale, plotData, devicePixelRatio: dpr } = context;
    if (!visibleRange || plotData.length === 0) return;

    const startIndex = Math.max(0, visibleRange.startIndex);
    const endIndex = Math.min(plotData.length - 1, visibleRange.endIndex);
    const visibleBars = plotData.slice(startIndex, endIndex + 1);
    if (visibleBars.length === 0) return;

    // Calculate trade values
    const values = visibleBars
      .map((bar) => ({
        index: bar.dataIndex ?? bar.index,
        val: Number(bar.volume || 0) * Number(bar.close || 0),
      }))
      .sort((a, b) => b.val - a.val);

    // Limit to top 10% of visible count
    const topCount = Math.max(1, Math.ceil(visibleBars.length * 0.1));
    const threshold = values[topCount - 1]?.val ?? 0;

    if (threshold <= 0) return;

    ctx.save();
    ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    visibleBars.forEach((bar) => {
      const val = Number(bar.volume || 0) * Number(bar.close || 0);
      if (val < threshold || val <= 0) return;

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
  }, [visibleRange]);

  return e(OverlayCanvas, { draw, zIndex: 10 });
}

// Custom canvas overlay to draw flow heatmap background bands
function HeatmapBandOverlay({ flowBucketLookup, heatmapMode }) {
  const draw = useCallback((context) => {
    const { ctx, xScale, plotData, width, height } = context;
    if (!flowBucketLookup || flowBucketLookup.size === 0 || !heatmapMode || heatmapMode === 'off') {
      return;
    }

    ctx.save();

    // Determine spacing width
    const dx = plotData.length > 1 ? xScale(plotData[1].dataIndex ?? plotData[1].index) - xScale(plotData[0].dataIndex ?? plotData[0].index) : 8;
    const barWidth = Math.max(1.5, Math.abs(dx) * 0.85);

    plotData.forEach((bar) => {
      const timestamp = bar.timestamp || new Date(bar.date).getTime();
      const minuteKey = toCanonicalMinute(timestamp);
      const bucket = minuteKey ? flowBucketLookup.get(String(minuteKey)) : null;
      if (!bucket) return;

      const color = buildHeatmapBandColor(bucket, heatmapMode);
      if (!color) return;

      const idx = bar.dataIndex ?? bar.index;
      let x = xScale(idx);
      if (isNaN(x)) {
        x = xScale(new Date(bar.date));
      }
      if (isNaN(x)) return;

      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, 0, barWidth, height);
    });

    ctx.restore();
  }, [flowBucketLookup, heatmapMode]);

  return e(OverlayCanvas, { draw, zIndex: 1 });
}

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'stockDetail.chartPrice': 'Giá',
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
  data,
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
}) {
  const { t, language } = useI18n();
  const [visibleRange, setVisibleRange] = useState(null);
  const [heatmapMode, setHeatmapMode] = useState('net');

  // Enriched bars mapped from input data
  const enrichedBars = useMemo(() => mapToOHLCVBars(data), [data]);

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

  const flowViewModel = flowData?.view_model || null;
  const flowTimeframe = flowData?.timeframe_window?.timeframe || flowData?.timeframe || '15m';
  const flowBucketLookup = useMemo(() => buildFlowBucketLookup(flowViewModel, flowTimeframe), [flowTimeframe, flowViewModel]);

  // Define 3 explicit panes for the high-end chart
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
        { type: "BollingerBand", params: { period: 20, stdDev: 2 }, yAxis: "right" }
      ]
    },
    {
      id: "cvd",
      label: t('whaleAlertsDashboard.flowCvdPaneTitle', { defaultValue: "CVD Chuẩn Hóa" }),
      pinned: false,
      visible: true,
      heightRatio: 0.22,
      splitScale: false,
      tooltip: "value",
      series: [
        { type: "CVDApprox", yAxis: "right", color: "#22d3ee" }
      ]
    },
    {
      id: "strength",
      label: t('whaleAlertsDashboard.flowStrengthPaneTitle', { defaultValue: "Sức Mạnh Dòng Tiền" }),
      pinned: false,
      visible: true,
      heightRatio: 0.23,
      splitScale: true,
      tooltip: "value",
      series: [
        { type: "StrengthElder", yAxis: "left", color: "#34d399", scaleSlotId: "strength-left" },
        { type: "StrengthRelative", yAxis: "right", color: "#38bdf8", scaleSlotId: "strength-right" }
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

  const TIMEFRAMES = [
    { id: '1m', label: '1M' },
    { id: '5m', label: '5M' },
    { id: '15m', label: '15M' },
    { id: '1H', label: '1H' },
    { id: 'D', label: 'D' },
  ];

  const timeframeButtons = TIMEFRAMES.map((timeframe) => e(
    'button',
    {
      key: timeframe.id,
      type: 'button',
      onClick: () => onTimeframeChange?.(timeframe.id),
      className: `px-3 py-1 text-xs font-medium rounded-md transition-all ${
        activeTimeframe === timeframe.id
          ? 'bg-cyan-600 text-white shadow-md'
          : 'text-slate-400 hover:text-slate-200'
      }`,
    },
    timeframe.label,
  ));

  const heatmapButtons = [
    { id: 'off', label: 'Tắt' },
    { id: 'net', label: 'Net' },
    { id: 'buy', label: 'Mua' },
    { id: 'sell', label: 'Bán' },
  ].map((mode) => e(
    'button',
    {
      key: mode.id,
      type: 'button',
      onClick: () => setHeatmapMode(mode.id),
      className: `px-2.5 py-0.5 rounded transition-all ${
        heatmapMode === mode.id
          ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
          : 'text-slate-400 hover:text-slate-200 border border-transparent'
      }`,
    },
    mode.label,
  ));

  const chartBody = enrichedBars.length === 0 && loading
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
    : enrichedBars.length === 0
      ? e(
          'div',
          { className: 'absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm text-slate-500' },
          e('span', null, 'Không có dữ liệu biểu đồ cho khung thời gian đã chọn.'),
        )
    : e(
        VNStockChart,
        {
          adapter: new MockAdapter({ bars: [] }),
          data: enrichedBars,
          panes: customPanes,
          engineRuntime: 'legacy',
          locale: language === 'vi' ? 'vi' : 'en',
          theme: 'dark',
          enableWhale: true,
          whaleOrders: mappedWhaleOrders,
          enableCVD: true,
          externalCvdSeries: mappedCvdSeries,
          darkFlowStrength: orderFlowData?.dark_flow?.strength ?? null,
          darkFlowSignalType: orderFlowData?.dark_flow?.signal_type ?? undefined,
          onClick: handleClick,
          onVisibleRangeChange: handleVisibleRangeChange,
          className: 'w-full h-full',
        },
        e(ViewportSharkMarkersOverlay, { visibleRange }),
        e(HeatmapBandOverlay, { flowBucketLookup, heatmapMode }),
      );

  return e(
    'div',
    { className: 'flex flex-col h-full bg-[#0a0f1d] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative' },
    e(
      'div',
      { className: 'flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 bg-[#0f172a]/95 flex-shrink-0 z-10' },
      e(
        'div',
        { className: 'flex items-center gap-3' },
        e(
          'span',
          { className: 'text-xs font-semibold text-cyan-400 tracking-wider uppercase bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded' },
          'VNStockChart D3',
        ),
        e(
          'div',
          { className: 'flex rounded-lg border border-slate-700 bg-slate-900/50 p-0.5' },
          timeframeButtons,
        ),
      ),
      e(
        'div',
        { className: 'flex items-center gap-2' },
        e('span', { className: 'text-[11px] font-medium text-slate-400' }, 'Heatmap:'),
        e(
          'div',
          { className: 'flex rounded-lg border border-slate-700 bg-slate-900/50 p-0.5 text-[11px]' },
          heatmapButtons,
        ),
      ),
    ),
    e('div', { className: 'flex-1 min-h-[460px] relative' }, chartBody),
  );
}
