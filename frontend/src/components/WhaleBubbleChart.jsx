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

import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '../context/LangContext';
import { getWhaleOrdersBySymbol } from '../api/client';
import { useOrderBubbleCoordinates, formatVND, formatTimeFromMinutes } from '../hooks/useOrderBubbleCoordinates';

const TIMEFRAME_OPTIONS = [
  { value: '5m', label: '5 phút' },
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '1h', label: '1 giờ' },
  { value: 'session', label: 'Cả phiên' },
];

const COLORS = {
  buy: '#10b981',
  sell: '#ef4444',
  internal: '#64748b',
};

export default function WhaleBubbleChart({ 
  selectedSymbol, 
  holdings = [], 
  quotesBySymbol = {}, 
  symbolOptions = [],
  isEmbedded = false 
}) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState('session');
  const [showUnit, setShowUnit] = useState('value'); // 'value' (VND) or 'volume' (Shares)
  const [symbol, setSymbol] = useState(selectedSymbol || '');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [error, setError] = useState(null);

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

  // Fetch whale orders when symbol or timeframe changes
  useEffect(() => {
    if (!symbol || !WHALE_BUBBLE_UPGRADE_ENABLED) return;

    const fetchOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getWhaleOrdersBySymbol(symbol, { timeframe });
        const data = response?.data || {};
        if (data.ok) {
          setOrderData(data);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('[WhaleBubbleChart] Fetch error:', err);
        const message = err?.response?.data?.error || err?.message || 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [symbol, timeframe]);

  // Convert order data to bubble coordinates
  const bubbles = useOrderBubbleCoordinates(
    orderData ? [...(orderData.orders.buy || []), ...(orderData.orders.sell || []), ...(orderData.orders.internal || [])] : [],
    orderData?.ref_price,
    orderData?.session_start
  );

  const totalOrders = orderData?.summary?.total_orders || 0;
  const isDegradedMode = Boolean(orderData?.degraded_mode || orderData?.quality_flags?.missing_reference_price);

  // Build ECharts option
  const chartOption = useMemo(() => {
    if (!orderData || !bubbles) {
      return {};
    }

    const isValue = showUnit === 'value';
    const yAxisLabel = isValue ? 'Giá trị khớp (VNĐ)' : 'Khối lượng (CP)';
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
          value: [b.x, b[yDataKey], b.value[2]],
          itemStyle: { color: COLORS.buy },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { color: COLORS.buy, opacity: 0.7 },
        tooltip: { show: true },
        type: 'scatter',
      },
      {
        name: t('whaleChart.sellFlow') || 'Bán chủ động',
        data: bubbles.sell.map((b) => ({
          value: [b.x, b[yDataKey], b.value[2]],
          itemStyle: { color: COLORS.sell },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { color: COLORS.sell, opacity: 0.7 },
        tooltip: { show: true },
        type: 'scatter',
      },
      {
        name: t('whaleChart.internal') || 'Giao dịch nội bộ',
        data: bubbles.internal.map((b) => ({
          value: [b.x, b[yDataKey], b.value[2]],
          itemStyle: { color: COLORS.internal },
          metadata: b,
        })),
        symbolSize: (val) => val[2],
        itemStyle: { color: COLORS.internal, opacity: 0.6 },
        tooltip: { show: true },
        type: 'scatter',
      },
      {
        name: `Xu hướng dòng tiền (MA${windowSize})`,
        type: 'line',
        data: maData,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#fbbf24', width: 2, type: 'dashed', opacity: 0.5 },
        z: 1,
      },
    ];

    return {
      color: [COLORS.buy, COLORS.sell, COLORS.internal],
      grid: {
        left: 60,
        right: 20,
        top: 40,
        bottom: 50,
        backgroundColor: 'transparent',
      },
      xAxis: {
        type: 'value',
        name: t('whaleChart.timeFromSessionStart') || 'Phút kể từ 9:00',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: (val) => formatTimeFromMinutes(val),
          fontSize: 10,
          color: '#cbd5e1',
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, bottom: 0, height: 20, borderColor: 'transparent', backgroundColor: 'rgba(30, 41, 59, 0.5)', fillerColor: 'rgba(16, 185, 129, 0.1)', handleStyle: { color: '#10b981' }, textStyle: { color: 'transparent' } },
      ],
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: {
          formatter: (val) => isValue ? formatVND(val) : (val / 1000).toFixed(0) + 'k',
          fontSize: 10,
          color: '#cbd5e1',
        },
        axisLine: { lineStyle: { color: '#475569' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        splitNumber: 5,
      },
      tooltip: {
        confine: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#64748b',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params) => {
          if (!params || !params.data) return '';
          if (params.seriesType === 'line') return '';
          const meta = params.data.metadata;
          if (!meta) return '';
          
          const sideColor = meta.side === 'BUY' ? COLORS.buy : meta.side === 'SELL' ? COLORS.sell : COLORS.internal;
          const sideLabel = meta.side === 'BUY' ? 'MUA CHỦ ĐỘNG' : meta.side === 'SELL' ? 'BÁN CHỦ ĐỘNG' : 'NỘI BỘ / KHÔNG RÕ';
          
          return `
            <div style="min-width: 160px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                <span style="color: ${sideColor}; font-weight: 800; font-size: 12px;">${sideLabel}</span>
                <span style="color: #94a3b8; font-size: 10px;">${meta.timestamp}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Giá khớp:</span>
                <span style="color: #f1f5f9; font-weight: bold;">${meta.price.toLocaleString('vi-VN')} đ</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #64748b;">Khối lượng:</span>
                <span style="color: #f1f5f9; font-weight: bold;">${meta.volume.toLocaleString('vi-VN')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #64748b;">Giá trị:</span>
                <span style="color: #10b981; font-weight: bold;">${formatVND(meta.matchedValue)}đ</span>
              </div>
              <div style="border-top: 1px dashed #334155; padding-top: 4px; display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Biến động:</span>
                <span style="color: ${meta.y >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">${meta.y >= 0 ? '+' : ''}${meta.y.toLocaleString('vi-VN')} (${meta.yPct.toFixed(2)}%)</span>
              </div>
              ${meta.isExtreme ? `
                <div style="margin-top: 6px; padding: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 11px; font-weight: 900; text-align: center; border-radius: 4px; letter-spacing: 0.5px;">
                  🧨 LỆNH CỰC LỚN (EXTREME)
                </div>
              ` : ''}
              ${meta.isLarge && !meta.isExtreme ? `
                <div style="margin-top: 6px; padding: 2px 4px; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24; font-size: 10px; font-weight: bold; text-align: center; border-radius: 4px;">
                  🐋 LỆNH CÁ MẬP
                </div>
              ` : ''}
            </div>
          `;
        },
      },
      series,
      animation: true,
      animationDuration: 500,
      // Reference line at Y=0 (ref price)
      markArea: {
        silent: true,
        data: [
          [
            { yAxis: 0, itemStyle: { color: 'rgba(16, 185, 129, 0.02)' } },
            { yAxis: orderData.summary?.avg_matched_value || 0, itemStyle: { color: 'rgba(16, 185, 129, 0.05)' } }
          ]
        ]
      }
    };
  }, [orderData, bubbles, showUnit, t]);

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
    <div className={`flex flex-col gap-4 h-full ${isEmbedded ? 'p-0' : 'p-4'}`}>
      {/* Controls */}
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

      {/* Chart or Empty State */}
      <div className="flex-1 min-h-[450px] bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
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
        ) : totalOrders === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <div className="text-4xl opacity-30">📭</div>
            <p className="text-sm font-semibold text-slate-300">{t('whaleChart.noOrdersInTimeframe') || 'Không có lệnh trong khoảng thời gian này'}</p>
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
            <div className="flex-1 min-h-[450px]">
              <ReactECharts 
                option={chartOption} 
                style={{ width: '100%', height: '100%', minHeight: '450px' }} 
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
