const WHALE_BUBBLE_UPGRADE_ENABLED = true;

/**
 * WhaleBubbleChart Component
 * Single-symbol intraday order flow visualization for whale activity
 * 
 * Features:
 * - Bubble chart centered at reference price (Y=0)
 * - VND/% toggle for price delta scaling
 * - Timeframe filter (15m, 30m, 1h, Session)
 * - Stock symbol selector
 * - Color-coded Buy/Sell/Internal flows
 * - Vietnamese i18n with full diacritics
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useI18n } from '../context/LangContext';
import { getWhaleAnalyticsSnapshot, getStockOrderFlow } from '../api/client';
import { useOrderBubbleCoordinates } from '../hooks/useOrderBubbleCoordinates';
import { useCallback } from 'react';
import { normalizeWhaleAnalyticsSnapshot } from '../utils/whaleAnalyticsSnapshotAdapter';
import { createWhaleTooltipFormatter } from '../utils/whaleTooltipFormatter';
import { Link } from 'react-router-dom';

echarts.use([
  LineChart,
  ScatterChart,
  AxisPointerComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '1h', label: '1 giờ' },
  { value: 'morning', label: 'Phiên sáng' },
  { value: 'afternoon', label: 'Phiên chiều' },
  { value: 'session', label: 'Cả phiên' },
];

const BUBBLE_FILTER_PRESETS = [
  { key: 'all', value: 0, labelKey: 'whaleAnalytics.filterAll', defaultLabel: 'Tất cả' },
  { key: '500m', value: 500_000_000, labelKey: 'whaleAnalytics.filterPreset500m', defaultLabel: '> 500 triệu' },
  { key: '1b', value: 1_000_000_000, labelKey: 'whaleAnalytics.filterPreset1b', defaultLabel: '> 1 tỷ' },
  { key: '3b', value: 3_000_000_000, labelKey: 'whaleAnalytics.filterPreset3b', defaultLabel: '> 3 tỷ' },
  { key: '5b', value: 5_000_000_000, labelKey: 'whaleAnalytics.filterPreset5b', defaultLabel: '> 5 tỷ' },
  { key: '10b', value: 10_000_000_000, labelKey: 'whaleAnalytics.filterPreset10b', defaultLabel: '> 10 tỷ' },
];

const MIN_BUBBLE_FILTER_THRESHOLD = 100_000_000;
const MAX_BUBBLE_FILTER_THRESHOLD = 10_000_000_000;

const COLORS = {
  buy: '#10b981',
  sell: '#ef4444',
  internal: '#64748b',
};

function formatTooltipMoney(value) {
  const numericValue = Number(value || 0);
  const absValue = Math.abs(numericValue);

  if (absValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} tỷ đồng`;
  }

  if (absValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} triệu đồng`;
  }

  return `${numericValue.toLocaleString('vi-VN')} đồng`;
}

function formatTooltipPriceDelta(value) {
  const numericValue = Number(value || 0);
  const sign = numericValue > 0 ? '+' : '';
  return `${sign}${numericValue.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} đ`;
}

function formatAxisTime(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatPercentDelta(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const val = Number(value);
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function formatSignalTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const date = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${hh}:${mm}:${ss} ${date}/${month}/${year}`;
  } catch (e) {
    return '—';
  }
}

function getSignalTypeLabelAndClass(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'WHALE') return { label: 'WHALE', badgeClass: 'text-cyan-400 font-bold' };
  if (t === 'DARK_FLOW') return { label: 'DARK FLOW', badgeClass: 'text-violet-400 font-bold' };
  if (t === 'PRICE_SHOCK') return { label: 'BIẾN ĐỘNG GIÁ', badgeClass: 'text-amber-400 font-bold' };
  if (t === 'STALE_QUOTE') return { label: 'BẢNG GIÁ CHẬM', badgeClass: 'text-rose-400 font-bold' };
  return { label: t, badgeClass: 'text-slate-400 font-bold' };
}

function formatCompactSignedValue(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return '--';
  const sign = numericValue > 0 ? '+' : '';
  if (Math.abs(numericValue) >= 1_000_000_000) {
    return `${sign}${(numericValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  }
  if (Math.abs(numericValue) >= 1_000_000) {
    return `${sign}${(numericValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu`;
  }
  return `${sign}${numericValue.toLocaleString('vi-VN')}`;
}

function getSeriesPointTimestampMs(seriesPoint) {
  const rawValue = Array.isArray(seriesPoint?.value) ? seriesPoint.value[0] : null;
  return Number.isFinite(rawValue) ? rawValue : null;
}

function getDegradedModeCopy(staleReason, t) {
  if (staleReason === 'missing_intraday_ticks') {
    return {
      title: t('whaleChart.degradedModeTitle', { defaultValue: 'Dữ liệu đang ở chế độ degraded' }),
      description: t('whaleChart.degradedMissingIntraday', { defaultValue: 'Phiên gần nhất chưa có đủ tick intraday hợp lệ, biểu đồ đang trả snapshot an toàn từ nguồn SSOT.' }),
    };
  }

  return {
    title: t('whaleChart.degradedModeTitle', { defaultValue: 'Dữ liệu đang ở chế độ degraded' }),
    description: staleReason === 'missing_session_levels'
      ? t('whaleChart.degradedMissingSessionLevels', { defaultValue: 'Thiếu một phần price context của phiên, biểu đồ vẫn giữ bubble và flow nhưng sẽ giảm overlay giá.' })
      : t('whaleChart.degradedModeDescription', { defaultValue: 'Thiếu giá tham chiếu, biểu đồ vẫn hiển thị lệnh lớn từ nguồn SSOT.' }),
  };
}

function formatOverlayPrice(value) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return '--';
  return `${numericValue.toLocaleString('vi-VN')} đ`;
}

function formatPanelTimestamp(epochMs, fallbackLabel) {
  if (Number.isFinite(epochMs)) {
    return new Date(epochMs).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return fallbackLabel || '--';
}

function formatPanelSeriesValue(seriesName, value) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return '--';

  if (String(seriesName || '').includes('Giá') || String(seriesName || '').includes('price')) {
    return `${numericValue.toLocaleString('vi-VN')} đ`;
  }

  if (String(seriesName || '').includes('Strength') || String(seriesName || '').includes('Sức mạnh')) {
    return numericValue.toFixed(1);
  }

  return formatCompactSignedValue(numericValue);
}

function thresholdToSliderValue(threshold) {
  const numericThreshold = Number(threshold || 0);
  if (!Number.isFinite(numericThreshold) || numericThreshold <= 0) {
    return 0;
  }

  const clampedThreshold = Math.min(MAX_BUBBLE_FILTER_THRESHOLD, Math.max(MIN_BUBBLE_FILTER_THRESHOLD, numericThreshold));
  const logMin = Math.log10(MIN_BUBBLE_FILTER_THRESHOLD);
  const logMax = Math.log10(MAX_BUBBLE_FILTER_THRESHOLD);
  return Math.round(((Math.log10(clampedThreshold) - logMin) / (logMax - logMin)) * 100);
}

function sliderValueToThreshold(sliderValue) {
  const numericSlider = Number(sliderValue || 0);
  if (!Number.isFinite(numericSlider) || numericSlider <= 0) {
    return 0;
  }

  const logMin = Math.log10(MIN_BUBBLE_FILTER_THRESHOLD);
  const logMax = Math.log10(MAX_BUBBLE_FILTER_THRESHOLD);
  const exponent = logMin + (numericSlider / 100) * (logMax - logMin);
  const rawThreshold = 10 ** exponent;
  return Math.max(50_000_000, Math.round(rawThreshold / 50_000_000) * 50_000_000);
}

function formatBubbleThresholdLabel(threshold, t) {
  if (!Number.isFinite(Number(threshold)) || Number(threshold) <= 0) {
    return t('whaleAnalytics.filterAll', { defaultValue: 'Tất cả' });
  }
  return `>= ${formatTooltipMoney(threshold)}`;
}

function formatSpeedValue(value) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return '--';
  return `${numericValue.toFixed(4)} evt/s`;
}

function formatCurrentQuotePrice(value) {
  const numericValue = Number(value ?? null);
  if (!Number.isFinite(numericValue)) return '--';
  return `${numericValue.toLocaleString('vi-VN')} đ`;
}

function resolveCurrentQuotePrice(quote) {
  const candidates = [
    quote?.current_price,
    quote?.price,
    quote?.last_price,
    quote?.close_price,
    quote?.reference_price,
  ];
  for (const candidate of candidates) {
    const numericValue = Number(candidate ?? null);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }
  return null;
}

function buildEndLabel(text, color, formatter) {
  return {
    show: true,
    distance: 10,
    color,
    fontSize: 10,
    fontWeight: 700,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 6,
    padding: [3, 6],
    formatter,
  };
}

function getPanelLineItems({
  t,
  sessionLevels,
  currentPrice,
  latestCvdValue,
  latestBuyStrengthValue,
  latestInstitutionalStrengthValue,
  latestSpeedValue,
}) {
  return [
    {
      key: 'reference',
      label: t('whaleAnalytics.referenceLineShort', { defaultValue: 'Tham chiếu' }),
      value: sessionLevels?.reference_price,
      formatter: formatOverlayPrice,
      valueClass: 'text-slate-100',
      dotClass: 'bg-slate-100',
    },
    {
      key: 'high',
      label: t('whaleAnalytics.highLineShort', { defaultValue: 'Đỉnh phiên' }),
      value: sessionLevels?.high_price,
      formatter: formatOverlayPrice,
      valueClass: 'text-emerald-300',
      dotClass: 'bg-emerald-500',
    },
    {
      key: 'low',
      label: t('whaleAnalytics.lowLineShort', { defaultValue: 'Đáy phiên' }),
      value: sessionLevels?.low_price,
      formatter: formatOverlayPrice,
      valueClass: 'text-rose-300',
      dotClass: 'bg-rose-500',
    },
    {
      key: 'ceiling',
      label: t('whaleAnalytics.ceilingLineShort', { defaultValue: 'Trần' }),
      value: sessionLevels?.ceiling_price,
      formatter: formatOverlayPrice,
      valueClass: 'text-fuchsia-300',
      dotClass: 'bg-fuchsia-500',
    },
    {
      key: 'floor',
      label: t('whaleAnalytics.floorLineShort', { defaultValue: 'Sàn' }),
      value: sessionLevels?.floor_price,
      formatter: formatOverlayPrice,
      valueClass: 'text-sky-300',
      dotClass: 'bg-sky-500',
    },
    {
      key: 'price',
      label: t('whaleAnalytics.currentPriceLineLabel', { defaultValue: 'Đường giá hiện tại' }),
      value: currentPrice,
      formatter: formatOverlayPrice,
      valueClass: 'text-amber-300',
      dotClass: 'bg-amber-400',
    },
    {
      key: 'cvd',
      label: t('whaleAnalytics.cvdLabel', { defaultValue: 'CVD' }),
      value: latestCvdValue,
      formatter: formatCompactSignedValue,
      valueClass: 'text-cyan-300',
      dotClass: 'bg-cyan-400',
    },
    {
      key: 'buy_strength',
      label: t('whaleAnalytics.buyStrengthShort', { defaultValue: 'Sức mạnh mua' }),
      value: latestBuyStrengthValue,
      formatter: (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '--',
      valueClass: 'text-lime-300',
      dotClass: 'bg-lime-400',
    },
    {
      key: 'institutional_strength',
      label: t('whaleAnalytics.instStrengthShort', { defaultValue: 'Sức mạnh tổ chức' }),
      value: latestInstitutionalStrengthValue,
      formatter: (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '--',
      valueClass: 'text-sky-300',
      dotClass: 'bg-sky-400',
    },
    {
      key: 'speed',
      label: t('whaleAnalytics.speedLabel', { defaultValue: 'Tốc độ sự kiện' }),
      value: latestSpeedValue,
      formatter: formatSpeedValue,
      valueClass: 'text-violet-300',
      dotClass: 'bg-violet-400',
    },
  ];
}

function buildPriceContextSeries({ points, levels, t }) {
  const overlayConfigs = [
    {
      key: 'reference_price',
      label: t('whaleAnalytics.referenceLineShort', { defaultValue: 'Tham chiếu' }),
      color: '#f8fafc',
      type: 'solid',
      width: 1.2,
      opacity: 0.65,
    },
    {
      key: 'high_price',
      label: t('whaleAnalytics.highLineShort', { defaultValue: 'Đỉnh phiên' }),
      color: '#22c55e',
      type: 'dashed',
      width: 1.1,
      opacity: 0.72,
    },
    {
      key: 'low_price',
      label: t('whaleAnalytics.lowLineShort', { defaultValue: 'Đáy phiên' }),
      color: '#ef4444',
      type: 'dashed',
      width: 1.1,
      opacity: 0.72,
    },
    {
      key: 'ceiling_price',
      label: t('whaleAnalytics.ceilingLineShort', { defaultValue: 'Trần' }),
      color: '#a855f7',
      type: 'dotted',
      width: 1,
      opacity: 0.62,
    },
    {
      key: 'floor_price',
      label: t('whaleAnalytics.floorLineShort', { defaultValue: 'Sàn' }),
      color: '#0ea5e9',
      type: 'dotted',
      width: 1,
      opacity: 0.62,
    },
  ];

  return overlayConfigs
    .map((config) => {
      const levelValue = Number(levels?.[config.key] ?? 0);
      if (!Number.isFinite(levelValue) || levelValue <= 0 || !points.length) {
        return null;
      }

      return {
        name: config.label,
        type: 'line',
        data: points.map((timestampMs) => [timestampMs, levelValue]),
        xAxisIndex: 0,
        yAxisIndex: 1,
        showSymbol: false,
        smooth: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { color: config.color, width: config.width, type: config.type, opacity: config.opacity },
        z: 3,
      };
    })
    .filter(Boolean);
}

function renderPercentileBar({ label, value, sampleSize, accentClass, trackClass, valueClass, unavailableLabel }) {
  if (value == null || sampleSize == null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">{label}</span>
          <span className="font-semibold text-slate-400">{unavailableLabel}</span>
        </div>
      </div>
    );
  }

  const clampedValue = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className={`font-semibold ${valueClass}`}>{clampedValue.toFixed(1)}%</span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${clampedValue}%` }} />
      </div>
      <div className="text-[10px] text-slate-500">n = {sampleSize}</div>
    </div>
  );
}

function buildHoverPanelData(params, {
  t,
  buyStrengthByTimestamp,
  institutionalStrengthByTimestamp,
  priceByTimestamp,
        speedByTimestamp,
        priceContextSeries,
}) {
  if (params?.componentType !== 'series') {
    return null;
  }

  const timestampMs = getSeriesPointTimestampMs(params);
  const timestampSec = Number.isFinite(timestampMs) ? Math.floor(timestampMs / 1000) : null;
  const buyStrengthAtBucket = timestampSec == null ? null : buyStrengthByTimestamp.get(timestampSec);
  const institutionalStrengthAtBucket = timestampSec == null ? null : institutionalStrengthByTimestamp.get(timestampSec);
  const priceAtBucket = timestampSec == null ? null : priceByTimestamp.get(timestampSec);
  const speedAtBucket = timestampSec == null ? null : speedByTimestamp.get(timestampSec);
  const meta = params?.data?.metadata || null;

  if (meta) {
    const sideLabel = meta.side === 'BUY'
      ? t('whaleChart.buyFlow', { defaultValue: 'Mua chủ động' })
      : meta.side === 'SELL'
        ? t('whaleChart.sellFlow', { defaultValue: 'Bán chủ động' })
        : t('whaleChart.internal', { defaultValue: 'Giao dịch nội bộ' });

    return {
      kind: 'bubble',
      title: sideLabel,
      accentColor: meta.side === 'BUY' ? COLORS.buy : meta.side === 'SELL' ? COLORS.sell : COLORS.internal,
      timestampLabel: meta.fullTimestamp || formatPanelTimestamp(timestampMs, meta.timestamp),
      price: meta.price,
      volume: meta.volume,
      matchedValue: meta.matchedValue,
      referencePrice: meta.referencePrice,
      deltaValue: meta.y,
      deltaPct: meta.yPct,
      buyStrength: buyStrengthAtBucket,
      institutionalStrength: institutionalStrengthAtBucket,
      isLarge: meta.isLarge,
      isExtreme: meta.isExtreme,
      unitAdjusted: meta.unitAdjusted,
      eventScore: meta.eventScore ?? meta.score ?? null,
      whaleThreshold: meta.whaleThreshold ?? meta.threshold ?? null,
      speed: speedAtBucket,
      matchedValuePercentile10d: meta.matchedValuePercentile10d ?? null,
      eventScorePercentile10d: meta.eventScorePercentile10d ?? null,
      baselineSampleSize: meta.baselineSampleSize ?? null,
    };
  }

  const pointValue = Array.isArray(params?.value) ? params.value[1] : params?.value;
  return {
    kind: 'line',
    title: params?.seriesName || 'Whale Analytics',
    accentColor: params?.color || '#cbd5e1',
    timestampLabel: formatPanelTimestamp(timestampMs, null),
    lineValue: formatPanelSeriesValue(params?.seriesName, pointValue),
    priceAtBucket,
    buyStrength: buyStrengthAtBucket,
    institutionalStrength: institutionalStrengthAtBucket,
    speed: speedAtBucket,
  };
}

export default function WhaleBubbleChart({ 
  selectedSymbol, 
  holdings = [], 
  quotesBySymbol = {}, 
  symbolOptions = [],
  isEmbedded = false,
  // Controlled props for synchronization
  isControlled = false,
  externalSymbol,
  externalTimeframe,
  externalData,
  externalFlowData,
  externalLoading,
  externalError,
  onTimeframeChange,
  onSymbolChange,
  syncTimestamp,
  onSyncHover,
}) {
  const { t } = useI18n();
  
  // Use controlled or internal state
  const [internalTimeframe, setInternalTimeframe] = useState('session');
  const [internalSymbol, setInternalSymbol] = useState(selectedSymbol || '');
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalOrderData, setInternalOrderData] = useState(null);
  const [internalFlowData, setInternalFlowData] = useState(null);
  const [internalError, setInternalError] = useState(null);

  const symbol = isControlled ? externalSymbol : internalSymbol;
  const timeframe = isControlled ? externalTimeframe : internalTimeframe;
  const loading = isControlled ? externalLoading : internalLoading;
  const orderData = isControlled ? externalData : internalOrderData;
  const error = isControlled ? externalError : internalError;
  const flowData = isControlled ? externalFlowData : internalFlowData;

  const setSymbol = isControlled ? onSymbolChange : setInternalSymbol;
  const setTimeframe = isControlled ? onTimeframeChange : setInternalTimeframe;

  const [showUnit, setShowUnit] = useState('value'); // 'value' (VND) or 'volume' (Shares)
  const [hoveredPanel, setHoveredPanel] = useState(null);
  const [bubbleThreshold, setBubbleThreshold] = useState(0);
  const [isInfoPanelVisible, setIsInfoPanelVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'signals'
  const [orderFlowSignals, setOrderFlowSignals] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(false);

  const fetchSignals = useCallback(async (targetSymbol) => {
    if (!targetSymbol) return;
    setLoadingSignals(true);
    try {
      const response = await getStockOrderFlow(targetSymbol, '30m');
      setOrderFlowSignals(response?.data?.signals || []);
    } catch (err) {
      console.error('[WhaleBubbleChart] Failed to fetch signals:', err);
    } finally {
      setLoadingSignals(false);
    }
  }, []);

  useEffect(() => {
    if (symbol) {
      fetchSignals(symbol);
    }
  }, [symbol, fetchSignals]);

  // Available symbols
  const availableSymbols = useMemo(() => {
    const sourceSymbols = Array.isArray(symbolOptions) && symbolOptions.length > 0
      ? symbolOptions
      : holdings.map((h) => String(h?.symbol || '').trim().toUpperCase()).filter(Boolean);
    const symbols = new Set(sourceSymbols);
    return Array.from(symbols).sort();
  }, [holdings, symbolOptions]);

  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol && availableSymbols.includes(selectedSymbol)) {
      setSymbol(selectedSymbol);
    }
  }, [availableSymbols, selectedSymbol, symbol]);

  // Auto-select first symbol if not already selected
  useEffect(() => {
    if ((!symbol || !availableSymbols.includes(symbol)) && availableSymbols.length > 0) {
      setSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, symbol]);

  // Fetch whale orders function - only if not controlled
  const fetchOrders = useCallback(async () => {
    if (isControlled || !symbol || !WHALE_BUBBLE_UPGRADE_ENABLED) return;
    
    setInternalLoading(true);
    setInternalError(null);

    try {
      const response = await getWhaleAnalyticsSnapshot(symbol, {
        timeframe,
        compact: 1,
        includeBaseline: false,
      });
      const snapshot = response?.data || {};
      const normalized = normalizeWhaleAnalyticsSnapshot(snapshot, timeframe);
      setInternalOrderData(normalized.bubbles);
      setInternalFlowData(normalized.flow);
    } catch (err) {
      console.error('[WhaleBubbleChart] Fetch error:', err);
      const message = err?.response?.data?.error || err?.message || 'Unknown error';
      setInternalError(message);
    } finally {
      setInternalLoading(false);
    }
  }, [symbol, timeframe, isControlled]);

  useEffect(() => {
    if (!isControlled) {
      fetchOrders();
    }
  }, [fetchOrders, isControlled]);

  // Convert order data to bubble coordinates
  const bubbles = useOrderBubbleCoordinates(
    orderData ? [...(orderData.orders?.buy || []), ...(orderData.orders?.sell || []), ...(orderData.orders?.internal || [])] : [],
    orderData?.ref_price,
    orderData?.session_start
  ) || { buy: [], sell: [], internal: [] };

  const totalOrders = orderData?.summary?.total_orders || 0;
  const visibleBubbleGroups = useMemo(() => {
    if (!bubbleThreshold) {
      return bubbles;
    }

    const applyThreshold = (items) => items.filter((item) => Number(item?.matchedValue || 0) >= bubbleThreshold);
    return {
      buy: applyThreshold(bubbles.buy || []),
      sell: applyThreshold(bubbles.sell || []),
      internal: applyThreshold(bubbles.internal || []),
    };
  }, [bubbles, bubbleThreshold]);
  const visibleBubbleCount = (visibleBubbleGroups.buy?.length || 0) + (visibleBubbleGroups.sell?.length || 0) + (visibleBubbleGroups.internal?.length || 0);
  const isDegradedMode = Boolean(orderData?.degraded_mode || orderData?.quality_flags?.missing_reference_price || orderData?.quality_flags?.missing_session_levels);
  const staleReason = orderData?.stale_reason || orderData?.meta?.stale_reason || null;
  const degradedModeCopy = useMemo(() => getDegradedModeCopy(staleReason, t), [staleReason, t]);
  const echartsRef = useRef(null);
  const timeframeWindow = orderData?.timeframe_window || flowData?.timeframe_window || null;
  const sessionLevels = orderData?.session_levels || null;
  const priceLineSeries = useMemo(() => (orderData?.price_series || []).map((item) => ({
    value: [Number(item.ts) * 1000, Number(item.price ?? 0)],
  })), [orderData]);
  const priceContextTimeline = useMemo(() => {
    const timestamps = priceLineSeries
      .map((item) => Number(Array.isArray(item?.value) ? item.value[0] : null))
      .filter((value) => Number.isFinite(value));
    if (timestamps.length > 0) {
      return timestamps;
    }
    const fallback = [Number(timeframeWindow?.startMs), Number(timeframeWindow?.endMs)].filter((value) => Number.isFinite(value));
    return Array.from(new Set(fallback));
  }, [priceLineSeries, timeframeWindow]);
  const priceContextSeries = useMemo(() => buildPriceContextSeries({
    points: priceContextTimeline,
    levels: sessionLevels,
    t,
  }), [priceContextTimeline, sessionLevels, t]);
  const flowCvdSeries = useMemo(() => (flowData?.cvd_series || []).map((item) => ({
    value: [Number(item.ts) * 1000, Number(item.cvd ?? item.cumulative_cvd ?? 0)],
  })), [flowData]);
  // Split CVD into positive (>=0) and negative (<0) for separate area rendering
  const flowCvdPosSeries = useMemo(() => flowCvdSeries.map((item) => ({
    value: [item.value[0], Math.max(0, item.value[1])],
  })), [flowCvdSeries]);
  const flowCvdNegSeries = useMemo(() => flowCvdSeries.map((item) => ({
    value: [item.value[0], Math.min(0, item.value[1])],
  })), [flowCvdSeries]);
  // Split Strength into Buy (when CVD >= 0) and Sell (when CVD < 0)
  const flowStrengthSeries = useMemo(() => (flowData?.institutional_strength_series || flowData?.strength_series || []).map((item) => ({
    value: [Number(item.ts) * 1000, Number(item.strength || 0)],
  })), [flowData]);
  const flowSpeedSeries = useMemo(() => (flowData?.speed_series || []).map((item) => ({
    value: [Number(item.ts) * 1000, Number(item.speed ?? 0)],
  })), [flowData]);
  const flowBuyStrengthSeries = useMemo(() => {
    const cvdMap = {};
    (flowData?.cvd_series || []).forEach((c) => { cvdMap[c.ts] = Number(c.cvd ?? 0); });
    return (flowData?.strength_series || []).map((item) => {
      const cvdVal = cvdMap[item.ts] ?? 0;
      return { value: [Number(item.ts) * 1000, cvdVal >= 0 ? Number(item.strength || 0) : null] };
    }).filter((d) => d.value[1] !== null);
  }, [flowData]);
  const flowSellStrengthSeries = useMemo(() => {
    const cvdMap = {};
    (flowData?.cvd_series || []).forEach((c) => { cvdMap[c.ts] = Number(c.cvd ?? 0); });
    return (flowData?.strength_series || []).map((item) => {
      const cvdVal = cvdMap[item.ts] ?? 0;
      return { value: [Number(item.ts) * 1000, cvdVal < 0 ? Number(item.strength || 0) : null] };
    }).filter((d) => d.value[1] !== null);
  }, [flowData]);
  const hasAnyFlowData = flowCvdSeries.length > 0 || flowStrengthSeries.length > 0;
  const hasAnyChartData = totalOrders > 0 || hasAnyFlowData;
  const priceByTimestamp = useMemo(() => new Map(
    priceLineSeries
      .map((item) => {
        const timestampMs = getSeriesPointTimestampMs(item);
        return timestampMs == null ? null : [Math.floor(timestampMs / 1000), Number(item.value[1] ?? 0)];
      })
      .filter(Boolean)
  ), [priceLineSeries]);
  const buyStrengthByTimestamp = useMemo(() => new Map(
    flowBuyStrengthSeries
      .map((item) => {
        const timestampMs = getSeriesPointTimestampMs(item);
        return timestampMs == null ? null : [Math.floor(timestampMs / 1000), Number(item.value[1] ?? 0)];
      })
      .filter(Boolean)
  ), [flowBuyStrengthSeries]);
  const institutionalStrengthByTimestamp = useMemo(() => new Map(
    flowStrengthSeries
      .map((item) => {
        const timestampMs = getSeriesPointTimestampMs(item);
        return timestampMs == null ? null : [Math.floor(timestampMs / 1000), Number(item.value[1] ?? 0)];
      })
      .filter(Boolean)
  ), [flowStrengthSeries]);
  const speedByTimestamp = useMemo(() => new Map(
    flowSpeedSeries
      .map((item) => {
        const timestampMs = getSeriesPointTimestampMs(item);
        return timestampMs == null ? null : [Math.floor(timestampMs / 1000), Number(item.value[1] ?? 0)];
      })
      .filter(Boolean)
  ), [flowSpeedSeries]);
  const tooltipFormatter = useMemo(() => createWhaleTooltipFormatter({
    t,
    buyStrengthByTimestamp,
    institutionalStrengthByTimestamp,
    priceByTimestamp,
    speedByTimestamp,
  }), [t, buyStrengthByTimestamp, institutionalStrengthByTimestamp, priceByTimestamp, speedByTimestamp]);
  const latestSpeedPoint = flowData?.speed_series?.[flowData.speed_series.length - 1] || null;
  const currentQuotePrice = useMemo(() => resolveCurrentQuotePrice(quotesBySymbol?.[symbol]), [quotesBySymbol, symbol]);
  const latestPricePoint = priceLineSeries[priceLineSeries.length - 1] || null;
  const latestCvdPoint = flowCvdSeries[flowCvdSeries.length - 1] || null;
  const latestBuyStrengthPoint = flowBuyStrengthSeries[flowBuyStrengthSeries.length - 1] || null;
  const latestInstitutionalStrengthPoint = flowStrengthSeries[flowStrengthSeries.length - 1] || null;
  const latestBubbleWithBaseline = useMemo(
    () => [...(orderData?.orders?.buy || []), ...(orderData?.orders?.sell || []), ...(orderData?.orders?.internal || [])]
      .find((item) => item?.baseline_sample_size != null) || null,
    [orderData]
  );

  useEffect(() => {
    setHoveredPanel(null);
  }, [symbol, timeframe, orderData?.session_start, totalOrders]);

  const infoPanelLineItems = useMemo(() => getPanelLineItems({
    t,
    sessionLevels,
    currentPrice: latestPricePoint?.value?.[1] ?? currentQuotePrice,
    latestCvdValue: latestCvdPoint?.value?.[1] ?? null,
    latestBuyStrengthValue: latestBuyStrengthPoint?.value?.[1] ?? null,
    latestInstitutionalStrengthValue: latestInstitutionalStrengthPoint?.value?.[1] ?? null,
    latestSpeedValue: latestSpeedPoint?.speed ?? latestSpeedPoint?.value ?? null,
  }), [t, sessionLevels, latestPricePoint, currentQuotePrice, latestCvdPoint, latestBuyStrengthPoint, latestInstitutionalStrengthPoint, latestSpeedPoint]);

  // Build ECharts option
  const chartOption = useMemo(() => {
    if (!orderData || !bubbles) {
      return {};
    }

    const isValue = showUnit === 'value';
    const yAxisLabel = isValue ? 'Giá trị khớp (Tỷ đồng)' : 'Khối lượng (CP)';
    const yDataKey = isValue ? 'yValue' : 'volume';

    // Calculate Volume Moving Average (MA20)
    const allBubbles = [...bubbles.buy, ...bubbles.sell, ...bubbles.internal].sort((a, b) => a.x - b.x);
    const maData = [];
    const windowSize = 10;
    for (let i = 0; i < allBubbles.length; i++) {
      const window = allBubbles.slice(Math.max(0, i - windowSize + 1), i + 1);
      const avg = window.reduce((sum, b) => sum + b[yDataKey], 0) / window.length;
      maData.push([allBubbles[i].x, avg]);
    }

    const layeredBubblePoints = [...(visibleBubbleGroups.buy || []), ...(visibleBubbleGroups.sell || []), ...(visibleBubbleGroups.internal || [])]
      .sort((left, right) => {
        const leftSize = Number(left?.value?.[2] ?? 0);
        const rightSize = Number(right?.value?.[2] ?? 0);
        if (leftSize === rightSize) {
          return Number(left?.x ?? 0) - Number(right?.x ?? 0);
        }
        return leftSize - rightSize;
      })
      .map((bubble) => ({
        value: [bubble.x * 1000, bubble[yDataKey], bubble.value[2]],
        itemStyle: {
          color: bubble.color,
          borderColor: bubble.strokeColor,
          borderWidth: bubble.side === 'INTERNAL' ? 1.1 : 1.2,
          opacity: 1,
        },
        emphasis: {
          itemStyle: {
            color: bubble.hoverColor,
            borderColor: bubble.strokeColor,
            borderWidth: bubble.side === 'INTERNAL' ? 1.6 : 1.8,
            shadowBlur: bubble.side === 'INTERNAL' ? 8 : 10,
            shadowColor: bubble.hoverColor,
          },
        },
        metadata: bubble,
      }));

    // Prepare series data
    const series = [
      {
        name: t('whaleChart.buyFlow') || 'Mua chủ động',
        data: bubbles.buy.map((b) => ({
          value: [b.x * 1000, b[yDataKey], b.value[2]], // Convert epoch seconds to ms for ECharts 'time' axis
          itemStyle: {
            color: b.color,
            borderColor: b.strokeColor,
            borderWidth: 1.2,
          },
          emphasis: {
            itemStyle: {
              color: b.hoverColor,
              borderColor: b.strokeColor,
              borderWidth: 1.8,
              shadowBlur: 10,
              shadowColor: b.hoverColor,
            },
          },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { opacity: 1 },
        emphasis: { scale: true, focus: 'self' },
        tooltip: { show: true },
        type: 'scatter',
        animationDuration: 120,
        animationDurationUpdate: 80,
      },
      {
        name: t('whaleChart.sellFlow') || 'Bán chủ động',
        data: bubbles.sell.map((b) => ({
          value: [b.x * 1000, b[yDataKey], b.value[2]],
          itemStyle: {
            color: b.color,
            borderColor: b.strokeColor,
            borderWidth: 1.2,
          },
          emphasis: {
            itemStyle: {
              color: b.hoverColor,
              borderColor: b.strokeColor,
              borderWidth: 1.8,
              shadowBlur: 10,
              shadowColor: b.hoverColor,
            },
          },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { opacity: 1 },
        emphasis: { scale: true, focus: 'self' },
        tooltip: { show: true },
        type: 'scatter',
        animationDuration: 120,
        animationDurationUpdate: 80,
      },
      {
        name: t('whaleChart.internal') || 'Giao dịch nội bộ',
        data: bubbles.internal.map((b) => ({
          value: [b.x * 1000, b[yDataKey], b.value[2]],
          itemStyle: {
            color: b.color,
            borderColor: b.strokeColor,
            borderWidth: 1.1,
          },
          emphasis: {
            itemStyle: {
              color: b.hoverColor,
              borderColor: b.strokeColor,
              borderWidth: 1.6,
              shadowBlur: 8,
              shadowColor: b.hoverColor,
            },
          },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { opacity: 1 },
        emphasis: { scale: true, focus: 'self' },
        tooltip: { show: true },
        type: 'scatter',
        animationDuration: 120,
        animationDurationUpdate: 80,
      },
      {
        name: `Xu hướng dòng tiền (MA${windowSize})`,
        type: 'line',
        data: maData.map(d => [d[0] * 1000, d[1]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#fbbf24', width: 2, type: 'dashed', opacity: 0.5 },
        z: 1,
      },
    ];

    const topGrid = { left: 72, right: 64, top: 40, bottom: '47%' };
    const bottomGrid = { left: 72, right: 64, top: '57%', bottom: 62 };
    const bubbleSeries = [
      {
        name: t('whaleAnalytics.bubblePane', { defaultValue: 'Lệnh cá mập' }),
        data: layeredBubblePoints,
        symbolSize: (val) => val[2],
        itemStyle: { opacity: 1 },
        emphasis: { scale: true, focus: 'self' },
        tooltip: { show: true },
        type: 'scatter',
        animationDuration: 120,
        animationDurationUpdate: 80,
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        name: `Xu hướng dòng tiền (MA${windowSize})`,
        type: 'line',
        data: maData.map((d) => [d[0] * 1000, d[1]]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#fbbf24', width: 2, type: 'dashed', opacity: 0.5 },
        z: 1,
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        name: 'Đường giá intraday',
        type: 'line',
        data: priceLineSeries,
        xAxisIndex: 0,
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2, opacity: 0.95 },
        z: 5,
      },
      ...priceContextSeries,
    ];

    const flowSeries = [
      // CVD positive area (above zero = aggressive buying)
      {
        name: 'Dòng tiền mua tích cực',
        type: 'line',
        data: flowCvdPosSeries,
        xAxisIndex: 1,
        yAxisIndex: 2,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#22c55e', width: 1.5, opacity: 0.8 },
        areaStyle: { color: 'rgba(34, 197, 94, 0.28)', origin: 0 },
        z: 2,
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: 0, name: 'Zero' }],
          lineStyle: { color: 'rgba(203, 213, 225, 0.35)', type: 'solid', width: 1 },
          label: { show: true, formatter: 'Zero Line', color: '#94a3b8', fontSize: 10, position: 'insideEndTop' },
        },
      },
      // CVD negative area (below zero = aggressive selling)
      {
        name: 'Dòng tiền bán tích cực',
        type: 'line',
        data: flowCvdNegSeries,
        xAxisIndex: 1,
        yAxisIndex: 2,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#f43f5e', width: 1.5, opacity: 0.8 },
        areaStyle: { color: 'rgba(244, 63, 94, 0.25)', origin: 0 },
        z: 2,
      },
      {
        name: t('whaleAnalytics.cvdLabel', { defaultValue: 'CVD' }),
        type: 'line',
        data: flowCvdSeries,
        xAxisIndex: 1,
        yAxisIndex: 2,
        showSymbol: false,
        smooth: true,
        lineStyle: { opacity: 0, width: 0 },
        tooltip: { show: false },
        silent: true,
        z: 5,
      },
      // Buy Strength line (when CVD is positive)
      {
        name: 'Sức mạnh mua',
        type: 'line',
        data: flowBuyStrengthSeries,
        xAxisIndex: 1,
        yAxisIndex: 3,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#4ade80', width: 2 },
        z: 4,
      },
      // Institutional Strength line
      {
        name: 'Sức mạnh tổ chức',
        type: 'line',
        data: flowStrengthSeries,
        xAxisIndex: 1,
        yAxisIndex: 3,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#38bdf8', width: 2 },
        z: 4,
      },
	];

	return {
	  color: [COLORS.buy, COLORS.sell, COLORS.internal],
	  grid: [topGrid, bottomGrid],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        filterMode: 'none',
        minSpan: 5,
        zoomLock: false,
        moveOnMouseMove: 'shift',
        zoomOnMouseWheel: 'shift',
        moveOnMouseWheel: true,
      },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        filterMode: 'none',
        height: 16,
        bottom: 6,
        borderColor: '#1e293b',
        backgroundColor: 'rgba(2, 6, 23, 0.92)',
        fillerColor: 'rgba(148, 163, 184, 0.16)',
        dataBackground: {
          lineStyle: {
            color: 'rgba(100, 116, 139, 0.75)',
            width: 1,
          },
          areaStyle: {
            color: 'rgba(51, 65, 85, 0.35)',
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.9)',
            width: 1.2,
          },
          areaStyle: {
            color: 'rgba(71, 85, 105, 0.32)',
          },
        },
        handleStyle: {
          color: '#cbd5e1',
          borderColor: '#0f172a',
        },
        textStyle: {
          color: '#94a3b8',
          fontSize: 10,
        },
        brushSelect: false,
      },
    ],
	  axisPointer: {
	    link: [{ xAxisIndex: [0, 1] }],
	    label: {
	      backgroundColor: '#0f172a',
	    },
	  },
	  xAxis: [
	    {
          type: 'time',
          gridIndex: 0,
          min: timeframeWindow?.startMs,
          max: timeframeWindow?.endMs,
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#475569' } },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
	    },
	    {
          type: 'time',
          gridIndex: 1,
          min: timeframeWindow?.startMs,
          max: timeframeWindow?.endMs,
          axisLabel: {
            formatter: (val) => formatAxisTime(val),
            fontSize: 10,
            color: '#cbd5e1',
          },
          axisLine: { lineStyle: { color: '#475569' } },
          splitLine: { show: false },
	    },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          name: yAxisLabel,
          nameLocation: 'middle',
          nameGap: 54,
          axisLabel: {
            formatter: (val) => {
              if (!isValue) {
                return (val / 1000).toFixed(0) + 'k';
              }
              const billionValue = Number(val || 0) / 1_000_000_000;
              return `${billionValue.toLocaleString('vi-VN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })} tỷ`;
            },
            fontSize: 10,
            color: '#cbd5e1',
          },
          axisLine: { lineStyle: { color: '#475569' } },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          splitNumber: 5,
        },
        {
          type: 'value',
          gridIndex: 0,
          name: 'Giá',
          nameLocation: 'middle',
          nameGap: 42,
          position: 'right',
          axisLabel: {
            formatter: (val) => Number(val || 0).toLocaleString('vi-VN'),
            fontSize: 10,
            color: '#fbbf24',
          },
          axisLine: { lineStyle: { color: '#b45309' } },
          splitLine: { show: false },
          scale: true,
        },
        {
          type: 'value',
          gridIndex: 1,
          name: t('whaleAnalytics.cvdLabel', { defaultValue: 'CVD' }),
          nameLocation: 'middle',
          nameGap: 54,
          axisLabel: {
            formatter: (val) => formatCompactSignedValue(val),
            fontSize: 10,
            color: '#67e8f9',
          },
          axisLine: { lineStyle: { color: '#155e75' } },
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
          splitNumber: 4,
          min: (value) => { const mn = isFinite(value.min) ? value.min : 0; const mx = isFinite(value.max) ? value.max : 0; const a = Math.max(Math.abs(mn), Math.abs(mx), 1); return -a * 1.2; },
          max: (value) => { const mn = isFinite(value.min) ? value.min : 0; const mx = isFinite(value.max) ? value.max : 0; const a = Math.max(Math.abs(mn), Math.abs(mx), 1); return a * 1.2; },
        },
        {
          type: 'value',
          gridIndex: 1,
          name: t('whaleAnalytics.instStrength', { defaultValue: 'Sức mạnh tổ chức' }),
          nameLocation: 'middle',
          nameGap: 46,
          min: 0,
          max: 100,
          position: 'right',
          axisLabel: {
            formatter: (val) => `${val}`,
            fontSize: 10,
            color: '#38bdf8',
          },
          axisLine: { lineStyle: { color: '#0369a1' } },
          splitLine: { show: false },
        },
      ],
      tooltip: {
        trigger: 'item',
        showContent: false,
        axisPointer: {
          type: 'cross',
        },
        confine: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#64748b',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: tooltipFormatter,
      },
      series: [...bubbleSeries, ...flowSeries],
      animation: true,
      animationThreshold: 80,
      animationDuration: 140,
      animationDurationUpdate: 90,
      animationEasing: 'linear',
      animationEasingUpdate: 'linear',
      graphic: [
        {
          type: 'text',
          left: 86,
          top: 14,
          style: {
            text: t('whaleAnalytics.bubblePane', { defaultValue: 'Lệnh cá mập' }),
            fill: '#cbd5e1',
            font: '700 11px sans-serif',
          },
        },
        {
          type: 'text',
          left: 86,
          top: '59%',
          style: {
            text: t('whaleAnalytics.flowPane', { defaultValue: 'Dòng tiền thông minh' }),
            fill: '#cbd5e1',
            font: '700 11px sans-serif',
          },
        },
      ],
    };
  }, [orderData, bubbles, visibleBubbleGroups, showUnit, t, timeframeWindow, flowCvdPosSeries, flowCvdNegSeries, flowStrengthSeries, buyStrengthByTimestamp, institutionalStrengthByTimestamp, priceByTimestamp, priceLineSeries, flowBuyStrengthSeries, tooltipFormatter]);

  // Handle sync events from chart to parent
  const onEvents = useMemo(() => ({
    mouseover: (params) => {
      if (params?.componentType !== 'series') return;
      setHoveredPanel(buildHoverPanelData(params, {
        t,
        buyStrengthByTimestamp,
        institutionalStrengthByTimestamp,
        priceByTimestamp,
        speedByTimestamp,
      }));
      if (!onSyncHover) return;
      const timestampMs = getSeriesPointTimestampMs(params);
      if (timestampMs != null) {
        const epochSec = Math.floor(timestampMs / 1000);
        onSyncHover(epochSec);
      }
    },
    globalout: () => {
      setHoveredPanel(null);
      if (onSyncHover) {
        onSyncHover(null);
      }
    },
  }), [onSyncHover, t, buyStrengthByTimestamp, institutionalStrengthByTimestamp, priceByTimestamp, speedByTimestamp]);

  // External sync effect (parent to chart)
  useEffect(() => {
    if (!isControlled || !echartsRef.current) return;
    const chartInstance = echartsRef.current.getEchartsInstance();
    if (!Number.isFinite(syncTimestamp)) {
      chartInstance.dispatchAction({
        type: 'hideTip',
      });
      chartInstance.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'leave',
      });
      return;
    }

    const syncValueMs = Number(syncTimestamp) * 1000;
    chartInstance.dispatchAction({
      type: 'updateAxisPointer',
      xAxisIndex: 0,
      value: syncValueMs,
    });
    chartInstance.dispatchAction({
      type: 'updateAxisPointer',
      xAxisIndex: 1,
      value: syncValueMs,
    });
  }, [isControlled, syncTimestamp]);

  const handleExportCSV = () => {
    if (!orderData || !orderData.orders) return;
    const all = [
      ...(orderData.orders.buy || []),
      ...(orderData.orders.sell || []),
      ...(orderData.orders.internal || [])
    ].sort((a, b) => new Date(a.ts) - new Date(b.ts));

    const csvHeaders = 'Timestamp,Side,Price,Volume,Value,IsExtreme\n';
    const csvRows = all.map(o => `${o.ts},${o.side},${o.price},${o.volume},${o.matched_value},${o.is_extreme || false}`).join('\n');
    const blob = new Blob([csvHeaders + csvRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whale_flow_${symbol}_${timeframe}.csv`;
    a.click();
  };

  // Render UI
  return (
    <div className={`flex flex-col gap-4 ${isEmbedded ? 'h-auto p-0' : 'h-full p-4'}`}>
      {/* Controls */}
      {!isControlled && (
        <div className={`flex items-center gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 ${isEmbedded && !selectedSymbol ? 'hidden' : ''}`}>
          {/* Symbol Selector - Hidden when embedded with a specific symbol */}
          {(!isEmbedded || !selectedSymbol) && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">{t('whaleChart.symbol') || 'Mã CK'}</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Chọn mã --</option>
                {availableSymbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timeframe Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">{t('whaleChart.timeframe') || 'Khoảng thời gian'}</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Toggle */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">{t('whaleChart.unit') || 'Đơn vị'}</label>
            <div className="flex gap-1 bg-slate-800 p-1 rounded">
              <button
                onClick={() => setShowUnit('value')}
                className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                  showUnit === 'value'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                VNĐ
              </button>
              <button
                onClick={() => setShowUnit('volume')}
                className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                  showUnit === 'volume'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CP
              </button>
            </div>
            <button 
              onClick={handleExportCSV}
              className="ml-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
              title="Xuất CSV"
            >
              📥
            </button>
          </div>
        </div>
      )}

      {/* Chart or Empty State */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
        {!WHALE_BUBBLE_UPGRADE_ENABLED ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <p className="text-sm italic">{t('whaleChart.upgradeDisabled') || 'Chế độ nâng cấp Whale đang tắt'}</p>
          </div>
        ) : loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
            <p className="text-sm">{t('common.loading') || 'Đang tải...'}</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="text-3xl text-rose-500">⚠️</div>
            <p className="text-sm font-semibold text-slate-300">{t('whaleChart.errorLoadingData') || 'Không thể tải dữ liệu'}</p>
            <p className="max-w-xs text-xs text-slate-500">{error}</p>
          </div>
        ) : !symbol ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <div className="text-4xl opacity-30">🐋</div>
            <p className="text-sm italic">{t('whaleChart.selectSymbolToStart') || 'Chọn mã để bắt đầu'}</p>
          </div>
        ) : !hasAnyChartData ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            {isDegradedMode && (
              <div className="mx-6 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
                <div className="font-semibold">{degradedModeCopy.title}</div>
                <div className="mt-0.5 text-amber-100/80">{degradedModeCopy.description}</div>
              </div>
            )}
            <div className="text-4xl opacity-30">📭</div>
            <p className="text-sm font-semibold text-slate-300">{t('whaleChart.noOrdersInTimeframe', { defaultValue: 'Không có dữ liệu' })}</p>
            <p className="text-xs">{isDegradedMode ? t('whaleChart.awaitingValidIntradayData', { defaultValue: 'Dữ liệu chi tiết của phiên này chưa đủ ổn định để hiển thị đầy đủ.' }) : t('whaleChart.tryDifferentTimeframe', { defaultValue: 'Thử khoảng thời gian khác' })}</p>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col">
            {isDegradedMode && (
              <div className="mx-3 mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <div className="font-semibold">{degradedModeCopy.title}</div>
                <div className="mt-0.5 text-amber-100/80">{degradedModeCopy.description}</div>
              </div>
            )}
            <div className="flex flex-1 flex-col lg:flex-row lg:items-stretch">
              <div className="min-w-0 flex-1">
                <div className="px-4 pt-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.symbolFocusLabel', { defaultValue: 'Mã đang phân tích' })}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Link to={`/stocks/${symbol}`} className="text-lg font-semibold text-emerald-300 transition-colors hover:text-emerald-200">
                            {symbol || '--'}
                          </Link>
                          <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                            {formatCurrentQuotePrice(currentQuotePrice)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{t('whaleAnalytics.filterVisibleCount', { count: visibleBubbleCount, defaultValue: `${visibleBubbleCount} bubble đang hiển thị` })}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <select
                          value={bubbleThreshold}
                          onChange={(event) => setBubbleThreshold(Number(event.target.value))}
                          className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-slate-100 outline-none transition-colors hover:border-slate-500"
                          aria-label={t('whaleAnalytics.filterSelectLabel', { defaultValue: 'Chọn ngưỡng bubble' })}
                        >
                          {BUBBLE_FILTER_PRESETS.map((preset) => (
                            <option key={preset.key} value={preset.value}>
                              {t(preset.labelKey, { defaultValue: preset.defaultLabel })}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsInfoPanelVisible((current) => !current)}
                          className="group flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 transition-all duration-300 hover:border-slate-500 hover:bg-slate-800"
                          aria-pressed={isInfoPanelVisible}
                          aria-label={isInfoPanelVisible ? t('whaleAnalytics.hideInfoPanel', { defaultValue: 'Ẩn panel' }) : t('whaleAnalytics.showInfoPanel', { defaultValue: 'Hiện panel' })}
                          title={isInfoPanelVisible ? t('whaleAnalytics.hideInfoPanel', { defaultValue: 'Ẩn panel' }) : t('whaleAnalytics.showInfoPanel', { defaultValue: 'Hiện panel' })}
                        >
                          <svg
                            className={`h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:text-slate-200 ${isInfoPanelVisible ? '' : 'rotate-180'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('whaleAnalytics.filterSliderLabel', { defaultValue: 'Tinh chỉnh log-scale' })}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={thresholdToSliderValue(bubbleThreshold)}
                        onChange={(event) => setBubbleThreshold(sliderValueToThreshold(event.target.value))}
                        className="w-full accent-emerald-500 lg:flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-4 pt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  <div className="flex items-center gap-5">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t('whaleChart.buyFlow', { defaultValue: 'Mua chủ động' })}</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />{t('whaleChart.sellFlow', { defaultValue: 'Bán chủ động' })}</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />{t('whaleChart.internal', { defaultValue: 'Giao dịch nội bộ' })}</span>
                  </div>
                  <span>{t('whaleAnalytics.combinedRealtime', { defaultValue: 'Đồng bộ thời gian thực' })}</span>
                </div>
                <div className="h-[520px]">
                  <ReactEChartsCore 
                    echarts={echarts}
                    ref={echartsRef}
                    option={chartOption} 
                    onEvents={onEvents}
                    style={{ width: '100%', height: '520px' }} 
                    opts={{ renderer: 'canvas' }}
                  />
                </div>
              </div>
              {isInfoPanelVisible ? (
              <aside className="border-t border-slate-800 bg-slate-950/70 p-3 lg:w-[300px] lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  {hoveredPanel ? (
                    <>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{t('whaleAnalytics.infoPanelTitle', { defaultValue: 'Bảng thông tin' })}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">{symbol || '--'} · {timeframe}</div>
                      </div>
                      <div className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        {t('whaleAnalytics.infoPanelHoverActive', { defaultValue: 'Đang hover' })}
                      </div>
                    </>
                  ) : (
                    <div className="flex w-full rounded-lg border border-slate-700 bg-slate-950/60 p-0.5 text-[11px] font-medium uppercase tracking-wider">
                      <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 rounded py-1.5 px-3 transition-all text-center ${
                          activeTab === 'overview'
                            ? 'bg-slate-800 text-slate-100 shadow-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('whaleAnalytics.infoPanelSnapshot', { defaultValue: 'Tổng quan' })}
                      </button>
                      <button
                        onClick={() => setActiveTab('signals')}
                        className={`flex-1 rounded py-1.5 px-3 transition-all text-center ${
                          activeTab === 'signals'
                            ? 'bg-slate-800 text-slate-100 shadow-sm font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Tín hiệu
                      </button>
                    </div>
                  )}
                </div>

                {hoveredPanel ? (
                  <div className="mt-4 space-y-4 text-xs text-slate-300">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hoveredPanel.accentColor }} />
                        <div className="text-sm font-semibold text-slate-100">{hoveredPanel.title}</div>
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{hoveredPanel.timestampLabel}</div>
                    </div>

                    {hoveredPanel.kind === 'bubble' ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.matchedPrice', { defaultValue: 'Giá khớp' })}</span><span className="font-semibold text-slate-100">{Number(hoveredPanel.price || 0).toLocaleString('vi-VN')} đ</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.matchedVolume', { defaultValue: 'Khối lượng' })}</span><span className="font-semibold text-slate-100">{Number(hoveredPanel.volume || 0).toLocaleString('vi-VN')}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.matchedValue', { defaultValue: 'Giá trị khớp' })}</span><span className="font-semibold text-emerald-300">{formatTooltipMoney(hoveredPanel.matchedValue)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Giá tham chiếu</span><span className="font-semibold text-slate-100">{hoveredPanel.referencePrice != null ? `${Number(hoveredPanel.referencePrice).toLocaleString('vi-VN')} đ` : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.deltaLabel', { defaultValue: 'Delta' })}</span><span className={`font-semibold ${Number(hoveredPanel.deltaValue || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatTooltipPriceDelta(hoveredPanel.deltaValue)} ({Number(hoveredPanel.deltaPct || 0).toFixed(2)}%)</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.whaleExtreme', { defaultValue: 'Whale / Extreme' })}</span><span className="font-semibold text-slate-100">{hoveredPanel.isLarge ? 'Có' : 'Không'} / {hoveredPanel.isExtreme ? 'Có' : 'Không'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Sức mạnh mua cùng bucket</span><span className="font-semibold text-slate-100">{hoveredPanel.buyStrength != null ? Number(hoveredPanel.buyStrength).toFixed(1) : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Sức mạnh tổ chức</span><span className="font-semibold text-slate-100">{hoveredPanel.institutionalStrength != null ? Number(hoveredPanel.institutionalStrength).toFixed(1) : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.speedLabel', { defaultValue: 'Tốc độ sự kiện' })}</span><span className="font-semibold text-slate-100">{formatSpeedValue(hoveredPanel.speed)}</span></div>
                        {hoveredPanel.eventScore != null && (
                          <div className="flex items-center justify-between"><span className="text-slate-500">Event score</span><span className="font-semibold text-slate-100">{Number(hoveredPanel.eventScore).toFixed(2)}</span></div>
                        )}
                        {hoveredPanel.whaleThreshold != null && (
                          <div className="flex items-center justify-between"><span className="text-slate-500">Ngưỡng whale</span><span className="font-semibold text-slate-100">{formatTooltipMoney(hoveredPanel.whaleThreshold)}</span></div>
                        )}
                        <div className="space-y-2 rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
                          {renderPercentileBar({
                            label: t('whaleAnalytics.matchedValuePercentileLabel', { defaultValue: 'Phân vị GT khớp 10 phiên' }),
                            value: hoveredPanel.matchedValuePercentile10d,
                            sampleSize: hoveredPanel.baselineSampleSize,
                            accentClass: 'bg-emerald-500/90',
                            trackClass: 'bg-emerald-950/60',
                            valueClass: 'text-emerald-300',
                            unavailableLabel: t('whaleAnalytics.percentileUnavailable', { defaultValue: 'Chưa đủ baseline' }),
                          })}
                          {renderPercentileBar({
                            label: t('whaleAnalytics.eventScorePercentileLabel', { defaultValue: 'Phân vị event score 10 phiên' }),
                            value: hoveredPanel.eventScorePercentile10d,
                            sampleSize: hoveredPanel.baselineSampleSize,
                            accentClass: 'bg-sky-500/90',
                            trackClass: 'bg-sky-950/60',
                            valueClass: 'text-sky-300',
                            unavailableLabel: t('whaleAnalytics.percentileUnavailable', { defaultValue: 'Chưa đủ baseline' }),
                          })}
                        </div>
                        {hoveredPanel.unitAdjusted && (
                          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                            {t('whaleAnalytics.unitAdjustedHint', { defaultValue: 'Dữ liệu giá đã được chuẩn hóa đơn vị trước khi hiển thị trong panel.' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.lineValue', { defaultValue: 'Giá trị line' })}</span><span className="font-semibold text-slate-100">{hoveredPanel.lineValue}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.bucketPrice', { defaultValue: 'Giá tại bucket' })}</span><span className="font-semibold text-slate-100">{hoveredPanel.priceAtBucket != null ? `${Number(hoveredPanel.priceAtBucket).toLocaleString('vi-VN')} đ` : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Sức mạnh mua cùng bucket</span><span className="font-semibold text-slate-100">{hoveredPanel.buyStrength != null ? Number(hoveredPanel.buyStrength).toFixed(1) : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">Sức mạnh tổ chức</span><span className="font-semibold text-slate-100">{hoveredPanel.institutionalStrength != null ? Number(hoveredPanel.institutionalStrength).toFixed(1) : '--'}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.speedLabel', { defaultValue: 'Tốc độ sự kiện' })}</span><span className="font-semibold text-slate-100">{formatSpeedValue(hoveredPanel.speed)}</span></div>
                        <div className="space-y-2 rounded border border-slate-800 bg-slate-900/70 px-3 py-3">
                          {infoPanelLineItems.map((item) => (
                            <div key={item.key} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-slate-400"><span className={`h-2 w-2 rounded-full ${item.dotClass}`} />{item.label}</span>
                              <span className={`font-semibold ${item.valueClass}`}>{item.formatter(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeTab === 'overview' ? (
                  <div className="mt-4 space-y-4 text-xs text-slate-300">
                    <div className="space-y-2 rounded border border-slate-800 bg-slate-900/70 px-3 py-3">
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.totalLargeOrders', { defaultValue: 'Tổng lệnh lớn' })}</span><span className="font-semibold text-slate-100">{orderData.summary?.total_orders || 0}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">Lệnh mua</span><span className="font-semibold text-emerald-300">{orderData.summary?.buy_orders || 0}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">Lệnh bán</span><span className="font-semibold text-rose-300">{orderData.summary?.sell_orders || 0}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t('whaleAnalytics.baselineSampleSizeLabel', { defaultValue: 'Cỡ mẫu baseline 10 phiên' })}</span><span className="font-semibold text-slate-100">{latestBubbleWithBaseline?.baseline_sample_size ?? '--'}</span></div>
                    </div>
                    <div className="space-y-2 rounded border border-slate-800 bg-slate-900/70 px-3 py-3">
                      {infoPanelLineItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-slate-400"><span className={`h-2 w-2 rounded-full ${item.dotClass}`} />{item.label}</span>
                          <span className={`font-semibold ${item.valueClass}`}>{item.formatter(item.value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 rounded border border-slate-800 bg-slate-900/70 px-3 py-3">
                      {renderPercentileBar({
                        label: t('whaleAnalytics.matchedValuePercentileLabel', { defaultValue: 'Phân vị GT khớp 10 phiên' }),
                        value: latestBubbleWithBaseline?.matched_value_percentile_10d ?? null,
                        sampleSize: latestBubbleWithBaseline?.baseline_sample_size ?? null,
                        accentClass: 'bg-emerald-500/90',
                        trackClass: 'bg-emerald-950/60',
                        valueClass: 'text-emerald-300',
                        unavailableLabel: t('whaleAnalytics.percentileUnavailable', { defaultValue: 'Chưa đủ baseline' }),
                      })}
                      {renderPercentileBar({
                        label: t('whaleAnalytics.eventScorePercentileLabel', { defaultValue: 'Phân vị event score 10 phiên' }),
                        value: latestBubbleWithBaseline?.event_score_percentile_10d ?? null,
                        sampleSize: latestBubbleWithBaseline?.baseline_sample_size ?? null,
                        accentClass: 'bg-sky-500/90',
                        trackClass: 'bg-sky-950/60',
                        valueClass: 'text-sky-300',
                        unavailableLabel: t('whaleAnalytics.percentileUnavailable', { defaultValue: 'Chưa đủ baseline' }),
                      })}
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900/70 px-3 py-3 text-slate-400">
                      {t('whaleAnalytics.infoPanelHoverHint', { defaultValue: 'Cách đọc nhanh: bubble càng lớn thì quy mô lệnh càng đáng chú ý; cụm xanh hoặc đỏ cho biết bên mua hoặc bán đang chủ động. Ưu tiên các điểm mà bubble lớn đi cùng giá bứt phá, CVD cải thiện và sức mạnh tổ chức tăng để nhận diện dòng tiền xác nhận; nếu bubble lớn xuất hiện nhưng giá suy yếu và CVD đi xuống thì nên cảnh giác nhịp phân phối.' })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 overflow-y-auto text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 pr-1" style={{ maxHeight: '510px' }}>
                    {loadingSignals ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                        <svg className="animate-spin h-5 w-5 mb-2 text-slate-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Đang tải tín hiệu...</span>
                      </div>
                    ) : orderFlowSignals.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                        Không có tín hiệu cảnh báo nào trong phiên
                      </div>
                    ) : (
                      orderFlowSignals.map((item) => {
                        const { label, badgeClass } = getSignalTypeLabelAndClass(item.signal_type);
                        return (
                          <div
                            key={item.id || `${item.symbol}-${item.created_at}`}
                            className="rounded-xl border border-slate-800/80 bg-[#0f172a]/60 p-3 hover:border-slate-700 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] uppercase tracking-wider ${badgeClass}`}>
                                {label}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {formatSignalTime(item.created_at)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between text-slate-300 font-medium pt-1">
                              <span>Sức mạnh:</span>
                              <span className="text-slate-100 font-semibold">
                                {Number(item.strength || 0).toFixed(1)} • {Number(item.confidence || 0).toFixed(2)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <span>Tick rate:</span>
                              <span>
                                {Number(item.tick_rate || 0).toFixed(1)} • Lệnh nhỏ: {formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}
                              </span>
                            </div>

                            {item.description && (
                              <p className="text-[11px] text-slate-400 border-t border-slate-800/40 pt-1.5 mt-1.5 leading-normal">
                                {item.description}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </aside>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {WHALE_BUBBLE_UPGRADE_ENABLED && orderData && !error && !isEmbedded && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
              <div className="text-slate-400 mb-1">{t('whaleChart.totalOrders') || 'Tổng lệnh'}</div>
              <div className="text-lg font-bold text-slate-200">{orderData.summary?.total_orders || 0}</div>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded p-2 flex justify-between items-end">
              <div>
                <div className="text-emerald-400 mb-1">{t('whaleChart.buyOrders') || 'Mua chủ động'}</div>
                <div className="text-lg font-bold text-emerald-400">{orderData.summary?.buy_orders || 0}</div>
              </div>
              <div className="text-[10px] text-emerald-500 font-mono mb-1">
                {(((orderData.summary?.buy_orders || 0) / (orderData.summary?.total_orders || 1)) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-rose-900/20 border border-rose-500/30 rounded p-2 flex justify-between items-end">
              <div>
                <div className="text-rose-400 mb-1">{t('whaleChart.sellOrders') || 'Bán chủ động'}</div>
                <div className="text-lg font-bold text-rose-400">{orderData.summary?.sell_orders || 0}</div>
              </div>
              <div className="text-[10px] text-rose-500 font-mono mb-1">
                {(((orderData.summary?.sell_orders || 0) / (orderData.summary?.total_orders || 1)) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
              <div className="text-slate-400 mb-1">{t('whaleChart.refPrice') || 'Giá tham chiếu'}</div>
              <div className="text-lg font-bold text-slate-200">
                {orderData.ref_price != null ? `${orderData.ref_price?.toLocaleString('vi-VN')} đ` : (t('whaleChart.missingRefPrice') || 'Không có')}
              </div>
            </div>
          </div>
          
          {/* Ratio Bar */}
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${((orderData.summary?.buy_orders || 0) / (orderData.summary?.total_orders || 1)) * 100}%` }} 
              className="h-full bg-emerald-500" 
            />
            <div 
              style={{ width: `${((orderData.summary?.sell_orders || 0) / (orderData.summary?.total_orders || 1)) * 100}%` }} 
              className="h-full bg-rose-500" 
            />
            <div 
              style={{ width: `${((orderData.summary?.internal_orders || 0) / (orderData.summary?.total_orders || 1)) * 100}%` }} 
              className="h-full bg-slate-500" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
