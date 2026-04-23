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
import ReactECharts from 'echarts-for-react';
import { useI18n } from '../context/LangContext';
import { getWhaleOrdersBySymbol } from '../api/client';
import { useOrderBubbleCoordinates } from '../hooks/useOrderBubbleCoordinates';
import { useCallback } from 'react';

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '1h', label: '1 giờ' },
  { value: 'morning', label: 'Phiên sáng' },
  { value: 'afternoon', label: 'Phiên chiều' },
  { value: 'session', label: 'Cả phiên' },
];

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
  const [internalError, setInternalError] = useState(null);

  const symbol = isControlled ? externalSymbol : internalSymbol;
  const timeframe = isControlled ? externalTimeframe : internalTimeframe;
  const loading = isControlled ? externalLoading : internalLoading;
  const orderData = isControlled ? externalData : internalOrderData;
  const error = isControlled ? externalError : internalError;
  const flowData = isControlled ? externalFlowData : null;

  const setSymbol = isControlled ? onSymbolChange : setInternalSymbol;
  const setTimeframe = isControlled ? onTimeframeChange : setInternalTimeframe;

  const [showUnit, setShowUnit] = useState('value'); // 'value' (VND) or 'volume' (Shares)

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
      const response = await getWhaleOrdersBySymbol(symbol, { timeframe });
      const data = response?.data || {};
      if (data.ok) {
        setInternalOrderData(data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
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
    orderData ? [...(orderData.orders.buy || []), ...(orderData.orders.sell || []), ...(orderData.orders.internal || [])] : [],
    orderData?.ref_price,
    orderData?.session_start
  );

  const totalOrders = orderData?.summary?.total_orders || 0;
  const isDegradedMode = Boolean(orderData?.degraded_mode || orderData?.quality_flags?.missing_reference_price);
  const echartsRef = useRef(null);
  const timeframeWindow = orderData?.timeframe_window || flowData?.timeframe_window || null;
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
  const flowStrengthSeries = useMemo(() => (flowData?.strength_series || []).map((item) => ({
    value: [Number(item.ts) * 1000, Number(item.strength || 0)],
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

  const syncPoints = useMemo(() => {
    const buildSeriesPoints = (items, seriesIndex) => items.map((item, dataIndex) => ({
      ts: item.x,
      seriesIndex,
      dataIndex,
    }));

    return [
      ...buildSeriesPoints(bubbles.buy, 0),
      ...buildSeriesPoints(bubbles.sell, 1),
      ...buildSeriesPoints(bubbles.internal, 2),
      ...flowCvdSeries.map((item, dataIndex) => ({ ts: Math.floor(item.value[0] / 1000), seriesIndex: 3, dataIndex })),
    ].sort((left, right) => left.ts - right.ts);
  }, [bubbles.buy, bubbles.internal, bubbles.sell, flowCvdSeries, flowStrengthSeries]);

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
    const bottomGrid = { left: 72, right: 64, top: '57%', bottom: 8 };
    const bubbleSeries = [
      {
        name: t('whaleChart.buyFlow') || 'Mua chủ động',
        data: bubbles.buy.map((b) => ({
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
        xAxisIndex: 0,
        yAxisIndex: 0,
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
        xAxisIndex: 0,
        yAxisIndex: 0,
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
    ];

    const flowSeries = [
      // CVD positive area (above zero = aggressive buying)
      {
        name: 'Dòng tiền mua tích cực',
        type: 'line',
        data: flowCvdPosSeries,
        xAxisIndex: 1,
        yAxisIndex: 1,
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
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#f43f5e', width: 1.5, opacity: 0.8 },
        areaStyle: { color: 'rgba(244, 63, 94, 0.25)', origin: 0 },
        z: 2,
      },
      // Buy Strength line (when CVD is positive)
      {
        name: 'Sức mạnh mua',
        type: 'line',
        data: flowBuyStrengthSeries,
        xAxisIndex: 1,
        yAxisIndex: 2,
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
        yAxisIndex: 2,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: '#fbbf24', width: 2 },
        z: 4,
      },
	];

	return {
	  color: [COLORS.buy, COLORS.sell, COLORS.internal],
	  grid: [topGrid, bottomGrid],
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
          gridIndex: 1,
          name: t('whaleAnalytics.cvdLabel') || 'CVD',
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
          name: 'Institutional Strength',
          nameLocation: 'middle',
          nameGap: 46,
          min: 0,
          max: 100,
          position: 'right',
          axisLabel: {
            formatter: (val) => `${val}`,
            fontSize: 10,
            color: '#86efac',
          },
          axisLine: { lineStyle: { color: '#16a34a' } },
          splitLine: { show: false },
        },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        confine: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#64748b',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params) => {
          if (!Array.isArray(params) || !params.length) return '';

          const axisValue = params[0]?.axisValue;
          const timeLabel = axisValue ? formatAxisTime(axisValue) : '--';
          const bubbleEntries = params
            .filter((item) => item?.data?.metadata)
            .map((item) => item.data.metadata);
          const cvdPosEntry = params.find((item) => item.seriesName === 'Dòng tiền mua tích cực');
          const cvdNegEntry = params.find((item) => item.seriesName === 'Dòng tiền bán tích cực');
          const strengthEntry = params.find((item) => item.seriesName === 'Sức mạnh tổ chức');
          const rawCvdPos = cvdPosEntry?.value?.[1] ?? 0;
          const rawCvdNeg = cvdNegEntry?.value?.[1] ?? 0;
          const cvdVal = rawCvdPos !== 0 ? rawCvdPos : rawCvdNeg;
          const strengthVal = strengthEntry?.value?.[1] ?? 0;

          const flowBlock = `
            <div style="display:flex; gap:12px; margin: 6px 0 8px;">
              <div><span style="color:#64748b;">CVD:</span> <span style="color:${cvdVal >= 0 ? '#22c55e' : '#f43f5e'}; font-weight:700;">${formatCompactSignedValue(cvdVal)}</span></div>
              <div><span style="color:#64748b;">Strength:</span> <span style="color:#fbbf24; font-weight:700;">${Number(strengthVal).toFixed(1)}</span></div>
            </div>
          `;

          const bubbleBlock = bubbleEntries.length
            ? bubbleEntries.slice(0, 3).map((meta) => {
              const sideColor = meta.side === 'BUY' ? COLORS.buy : meta.side === 'SELL' ? COLORS.sell : COLORS.internal;
              const sideLabel = meta.side === 'BUY'
                ? (t('whaleChart.buyFlow') || 'MUA CHỦ ĐỘNG')
                : meta.side === 'SELL'
                  ? (t('whaleChart.sellFlow') || 'BÁN CHỦ ĐỘNG')
                  : (t('whaleChart.internal') || 'NỘI BỘ / KHÔNG RÕ');
              return `
                <div style="margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:${sideColor}; font-weight:800; font-size:11px;">${sideLabel}</span>
                    <span style="color:#94a3b8; font-size:10px;">${meta.timestamp}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span style="color:#64748b;">Giá khớp:</span>
                    <span style="color:#f1f5f9; font-weight:700;">${meta.price.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span style="color:#64748b;">Khối lượng:</span>
                    <span style="color:#f1f5f9; font-weight:700;">${meta.volume.toLocaleString('vi-VN')}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span style="color:#64748b;">Giá trị:</span>
                    <span style="color:#10b981; font-weight:700;">${formatTooltipMoney(meta.matchedValue)}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:#64748b;">Biến động:</span>
                    <span style="color:${meta.y >= 0 ? '#10b981' : '#ef4444'}; font-weight:700;">${formatTooltipPriceDelta(meta.y)} (${meta.yPct.toFixed(2)}%)</span>
                  </div>
                </div>
              `;
            }).join('')
            : `<div style="margin-top:6px; color:#94a3b8;">Không có lệnh lớn tại phút này.</div>`;

          return `
            <div style="min-width: 240px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px;">
                <span style="color:#e2e8f0; font-weight:800; font-size:12px;">${t('whaleAnalytics.darkMoneyDynamics') || 'Whale Analytics'}</span>
                <span style="color:#94a3b8; font-size:10px;">${timeLabel}</span>
              </div>
              ${flowBlock}
              ${bubbleBlock}
            </div>
          `;
        },
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
            text: t('whaleAnalytics.bubblePane') || 'Lệnh cá mập',
            fill: '#cbd5e1',
            font: '700 11px sans-serif',
          },
        },
        {
          type: 'text',
          left: 86,
          top: '59%',
          style: {
            text: t('whaleAnalytics.flowPane') || 'Dòng tiền thông minh',
            fill: '#cbd5e1',
            font: '700 11px sans-serif',
          },
        },
      ],
    };
  }, [orderData, bubbles, showUnit, t, timeframeWindow, flowCvdPosSeries, flowCvdNegSeries, flowStrengthSeries]);

  // Handle sync events from chart to parent
  const onEvents = useMemo(() => ({
    'updateAxisPointer': (params) => {
      if (!onSyncHover || !params.axesInfo) return;
      const axisInfo = params.axesInfo[0];
      if (axisInfo && axisInfo.value) {
        const epochSec = Math.floor(axisInfo.value / 1000);
        onSyncHover(epochSec);
      }
    }
  }), [onSyncHover]);

  // External sync effect (parent to chart)
  useEffect(() => {
    if (!syncTimestamp || !isControlled || !echartsRef.current || !syncPoints.length) return;
    const chartInstance = echartsRef.current.getEchartsInstance();
    const targetPoint = syncPoints.find((item) => item.ts === syncTimestamp)
      || syncPoints.reduce((closest, candidate) => {
        if (!closest) {
          return candidate;
        }

        return Math.abs(candidate.ts - syncTimestamp) < Math.abs(closest.ts - syncTimestamp)
          ? candidate
          : closest;
      }, null);

    if (!targetPoint) {
      return;
    }
    
    chartInstance.dispatchAction({
      type: 'showTip',
      seriesIndex: targetPoint.seriesIndex,
      dataIndex: targetPoint.dataIndex,
    });
  }, [isControlled, syncPoints, syncTimestamp]);

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
            <div className="text-4xl opacity-30">📭</div>
            <p className="text-sm font-semibold text-slate-300">{t('whaleChart.noOrdersInTimeframe') || 'Không có dữ liệu trong khoảng thời gian này'}</p>
            <p className="text-xs">{t('whaleChart.tryDifferentTimeframe') || 'Thử khoảng thời gian khác'}</p>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col">
            {isDegradedMode && (
              <div className="mx-3 mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <div className="font-semibold">{t('whaleChart.degradedModeTitle') || 'Dữ liệu đang ở chế độ degraded'}</div>
                <div className="mt-0.5 text-amber-100/80">{t('whaleChart.degradedModeDescription') || 'Thiếu giá tham chiếu, biểu đồ vẫn hiển thị lệnh lớn từ nguồn SSOT.'}</div>
              </div>
            )}
            <div className="px-4 pt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />{t('whaleChart.buyFlow') || 'Mua chủ động'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />{t('whaleChart.sellFlow') || 'Bán chủ động'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />{t('whaleAnalytics.cvdLabel') || 'CVD'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />{t('whaleAnalytics.instStrengthShort') || 'Strength'}</span>
              </div>
              <span>{t('whaleAnalytics.combinedRealtime') || 'Đồng bộ thời gian thực'}</span>
            </div>
            <div className="h-[520px]">
              <ReactECharts 
                ref={echartsRef}
                option={chartOption} 
                onEvents={onEvents}
                style={{ width: '100%', height: '520px' }} 
                opts={{ renderer: 'canvas' }}
              />
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
