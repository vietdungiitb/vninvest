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

export default function WhaleBubbleChart({ selectedSymbol, holdings = [], quotesBySymbol = {}, symbolOptions = [] }) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState('session');
  const [showUnit, setShowUnit] = useState('vnd'); // 'vnd' or 'pct'
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
    if (!symbol) return;

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

  // Build ECharts option
  const chartOption = useMemo(() => {
    if (!orderData || !bubbles) {
      return {};
    }

    const isVND = showUnit === 'vnd';
    const yAxisLabel = isVND ? 'Δ Giá (VNĐ)' : 'Δ Giá (%)';
    const yDataKey = isVND ? 'y' : 'yPct';

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
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: {
          formatter: (val) => (isVND ? formatVND(val) : val.toFixed(2) + '%'),
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
          if (!params || !params.data || !params.data.metadata) return '';
          const meta = params.data.metadata;
          const priceStr = `${meta.price.toFixed(2)} VNĐ`;
          const deltaVnd = meta.y.toFixed(0);
          const deltaPct = meta.yPct.toFixed(2);
          const volumeStr = (meta.volume || 0).toLocaleString('vi-VN');
          const valueStr = formatVND(meta.matchedValue);
          return `
            <div>
              <div style="color: #e2e8f0; font-weight: bold; margin-bottom: 4px;">${t('whaleChart.order') || 'Lệnh'}</div>
              <div>Giá: <span style="color: #cbd5e1;">${priceStr}</span></div>
              <div>Δ VNĐ: <span style="color: ${meta.y >= 0 ? '#10b981' : '#ef4444'}">${meta.y >= 0 ? '+' : ''}${deltaVnd}</span></div>
              <div>Δ %: <span style="color: ${meta.yPct >= 0 ? '#10b981' : '#ef4444'}">${meta.yPct >= 0 ? '+' : ''}${deltaPct}%</span></div>
              <div style="border-top: 1px solid #475569; margin: 4px 0; padding-top: 4px;">
                <div>Khối lượng: <span style="color: #cbd5e1;">${volumeStr}</span></div>
                <div>Giá trị: <span style="color: #cbd5e1;">${valueStr}đ</span></div>
              </div>
              <div style="color: #94a3b8; font-size: 10px; margin-top: 4px;">${meta.timestamp}</div>
            </div>
          `;
        },
      },
      series,
      animation: true,
      animationDuration: 500,
    };
  }, [orderData, bubbles, showUnit, t]);

  // Reference line at Y=0 (ref price)
  if (chartOption.yAxis) {
    chartOption.yAxis.axisLine = { show: true, lineStyle: { color: '#0f766e', width: 2 } };
    chartOption.markLine = {
      data: [{ yAxis: 0, lineStyle: { color: '#0f766e', type: 'solid', width: 2 }, label: { show: false } }],
    };
  }

  // Render UI
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        {/* Symbol Selector */}
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
              onClick={() => setShowUnit('vnd')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                showUnit === 'vnd'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              VNĐ
            </button>
            <button
              onClick={() => setShowUnit('pct')}
              className={`px-2 py-1 text-xs font-bold rounded transition-all ${
                showUnit === 'pct'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              %
            </button>
          </div>
        </div>
      </div>

      {/* Chart or Empty State */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
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
        ) : orderData?.summary?.total_orders === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
            <div className="text-4xl opacity-30">📭</div>
            <p className="text-sm font-semibold text-slate-300">{t('whaleChart.noOrdersInTimeframe') || 'Không có lệnh trong khoảng thời gian này'}</p>
            <p className="text-xs">{t('whaleChart.tryDifferentTimeframe') || 'Thử khoảng thời gian khác'}</p>
          </div>
        ) : (
          <ReactECharts option={chartOption} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* Summary Stats */}
      {orderData && !error && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
            <div className="text-slate-400 mb-1">{t('whaleChart.totalOrders') || 'Tổng lệnh'}</div>
            <div className="text-lg font-bold text-slate-200">{orderData.summary?.total_orders || 0}</div>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded p-2">
            <div className="text-emerald-400 mb-1">{t('whaleChart.buyOrders') || 'Lệnh mua'}</div>
            <div className="text-lg font-bold text-emerald-400">{orderData.summary?.buy_orders || 0}</div>
          </div>
          <div className="bg-rose-900/20 border border-rose-500/30 rounded p-2">
            <div className="text-rose-400 mb-1">{t('whaleChart.sellOrders') || 'Lệnh bán'}</div>
            <div className="text-lg font-bold text-rose-400">{orderData.summary?.sell_orders || 0}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
            <div className="text-slate-400 mb-1">{t('whaleChart.refPrice') || 'Giá tham chiếu'}</div>
            <div className="text-lg font-bold text-slate-200">{orderData.ref_price?.toLocaleString('vi-VN')} đ</div>
          </div>
        </div>
      )}
    </div>
  );
}
