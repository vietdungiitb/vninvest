import React, { createElement, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const e = createElement;

function fmtCompact(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined);
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

// Convert date to ICT (Asia/Ho_Chi_Minh) timezone and get minutes from midnight
const getICTTime = (date) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    const minutePart = parts.find(p => p.type === 'minute');
    const hours = hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours() + 7;
    const minutes = minutePart ? parseInt(minutePart.value, 10) : date.getUTCMinutes();
    return {
      hours,
      minutes,
      timeInMinutes: hours * 60 + minutes
    };
  } catch (e) {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const ictDate = new Date(utc + (3600000 * 7));
    return {
      hours: ictDate.getHours(),
      minutes: ictDate.getMinutes(),
      timeInMinutes: ictDate.getHours() * 60 + ictDate.getMinutes()
    };
  }
};

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'whaleAlertsDashboard.orderFlowRadar': 'Radar Dòng Tiền',
        'whaleAlertsDashboard.darkMoneyTitle': `Dòng tiền ẩn danh: ${options?.symbol || ''}`,
        'whaleAlertsDashboard.confidenceLow': 'THẤP',
        'whaleAlertsDashboard.signalNone': 'KHÔNG CÓ',
        'whaleAlertsDashboard.strength': 'Sức mạnh',
        'whaleAlertsDashboard.tickRatePerMin': 'Tick rate / Phút',
        'whaleAlertsDashboard.smallOrders': 'Lệnh nhỏ',
        'whaleAlertsDashboard.realtimeEvent': 'Sự kiện Realtime',
        'whaleAlertsDashboard.noRealtimeEvent': 'Không có sự kiện realtime',
        'whaleAlertsDashboard.bucketsCount': `${options?.count || 0} buckets`,
        'whaleAlertsDashboard.noIntradayCvd': 'Không có dữ liệu CVD trong phiên',
        'whaleAlertsDashboard.cvdLabel': 'CVD Tích Lũy',
        'whaleAlertsDashboard.recentSignals': 'Tín hiệu gần đây',
        'whaleAlertsDashboard.noSignalsSaved': 'Không có tín hiệu nào lưu trữ',
        'whaleAlertsDashboard.tickRate': 'Tick rate',
        'whaleAlertsDashboard.small': 'Lệnh nhỏ',
      };
      return map[key] || options?.defaultValue || key;
    },
    formatDateTime: (val) => new Date(val).toLocaleString('vi-VN'),
  };
}

export function OrderFlowRadarPanel({ symbol, loading, orderFlowData, latestRealtimeAlert }) {
  // NOTE: OrderFlowRadarPanel intentionally shows today's intraday CVD;
  // session-date cross-day sync is deferred to SD-06/backend lane.
  // This is a deliberate design tradeoff to always showcase live active money-flow delta.
  const { t, formatDateTime } = useI18n();
  const cvdSeries = orderFlowData?.cvd_series || [];
  const darkFlow = orderFlowData?.dark_flow || {};
  const latestSignal = orderFlowData?.latest_signal || null;
  const signals = orderFlowData?.signals || [];
  const tickRate = orderFlowData?.tick_rate || {};
  const sizeDistribution = orderFlowData?.size_distribution || {};

  // Local state for client-side ICT slicing
  const [timeFilter, setTimeFilter] = useState('cả phiên');

  // Filter cvdSeries client-side
  const filteredCvdSeries = useMemo(() => {
    if (!cvdSeries || cvdSeries.length === 0) return [];
    if (timeFilter === 'cả phiên') return cvdSeries;

    if (timeFilter === '1h') {
      const maxTs = Math.max(...cvdSeries.map(item => new Date(item.bucket_ts || item.ts).getTime()), Date.now());
      return cvdSeries.filter(item => {
        const itemTs = new Date(item.bucket_ts || item.ts).getTime();
        return itemTs >= maxTs - 3600000;
      });
    }

    return cvdSeries.filter(item => {
      const d = new Date(item.bucket_ts || item.ts);
      const ict = getICTTime(d);
      if (timeFilter === 'sáng') {
        return ict.timeInMinutes >= 540 && ict.timeInMinutes <= 690; // 9:00 - 11:30
      }
      if (timeFilter === 'chiều') {
        return ict.timeInMinutes >= 780 && ict.timeInMinutes <= 900; // 13:00 - 15:00
      }
      return true;
    });
  }, [cvdSeries, timeFilter]);

  // Filter signals list client-side
  const filteredSignals = useMemo(() => {
    if (!signals || signals.length === 0) return [];
    if (timeFilter === 'cả phiên') return signals;

    if (timeFilter === '1h') {
      const maxTs = Math.max(...signals.map(item => new Date(item.created_at || item.ts || item.timestamp).getTime()), Date.now());
      return signals.filter(item => {
        const itemTs = new Date(item.created_at || item.ts || item.timestamp).getTime();
        return itemTs >= maxTs - 3600000;
      });
    }

    return signals.filter(item => {
      const d = new Date(item.created_at || item.ts || item.timestamp);
      const ict = getICTTime(d);
      if (timeFilter === 'sáng') {
        return ict.timeInMinutes >= 540 && ict.timeInMinutes <= 690; // 9:00 - 11:30
      }
      if (timeFilter === 'chiều') {
        return ict.timeInMinutes >= 780 && ict.timeInMinutes <= 900; // 13:00 - 15:00
      }
      return true;
    });
  }, [signals, timeFilter]);

  const chartData = useMemo(() => {
    return filteredCvdSeries.map((item) => ({
      ...item,
      label: item.bucket_ts ? new Date(item.bucket_ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—',
      cumulative_cvd: Number(item.cumulative_cvd || 0),
    }));
  }, [filteredCvdSeries]);

  const liveSignal = latestRealtimeAlert || latestSignal;
  const liveStrength = Number(liveSignal?.strength || darkFlow?.strength || 0);
  const smallOrderRatio = Number(
    liveSignal?.small_order_ratio ?? tickRate?.small_order_ratio ?? sizeDistribution?.small_ratio ?? 0
  );

  if (loading) {
    return e(
      'section',
      { className: 'card-section p-4' },
      e('div', { className: 'h-80 animate-pulse rounded-2xl bg-slate-900' }),
    );
  }

  const timeFilterButtons = [
    { id: '1h', label: '1h' },
    { id: 'sáng', label: 'Sáng' },
    { id: 'chiều', label: 'Chiều' },
    { id: 'cả phiên', label: 'Cả phiên' },
  ].map((filter) => e(
    'button',
    {
      key: filter.id,
      type: 'button',
      onClick: () => setTimeFilter(filter.id),
      className: `px-3 py-1 font-semibold rounded transition-all uppercase ${
        timeFilter === filter.id
          ? 'bg-cyan-600 text-white shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`,
    },
    filter.label,
  ));

  const recentSignalNodes = filteredSignals.length === 0
    ? e(
        'p',
        { className: 'text-xs text-slate-500 py-4 text-center' },
        t('whaleAlertsDashboard.noSignalsSaved', { defaultValue: 'Không có tín hiệu nào lưu trữ' }),
      )
    : filteredSignals.map((item) => e(
        'div',
        {
          key: item.id || `${item.symbol}-${item.created_at}`,
          className: 'rounded-xl border border-slate-800/80 bg-[#0f172a]/60 px-3 py-2 hover:border-slate-700 transition-all',
        },
        e(
          'div',
          { className: 'flex items-center justify-between gap-2' },
          e('p', { className: 'text-[10px] font-bold uppercase tracking-wider text-cyan-400' }, item.signal_type),
          e(
            'p',
            { className: 'text-[10px] text-slate-500 font-medium' },
            item.created_at ? formatDateTime(item.created_at) : '—',
          ),
        ),
        e(
          'p',
          { className: 'mt-1 text-xs font-medium text-slate-300' },
          `${t('whaleAlertsDashboard.strength')}: ${Number(item.strength || 0).toFixed(1)} • ${item.confidence || t('whaleAlertsDashboard.confidenceLow')}`,
        ),
        e(
          'p',
          { className: 'mt-0.5 text-[10px] text-slate-500' },
          `${t('whaleAlertsDashboard.tickRate')}: ${Number(item.tick_rate || 0).toFixed(1)} • ${t('whaleAlertsDashboard.small')}: ${formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}`,
        ),
      ));

  return e(
    'section',
    { className: 'card-section p-4 bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-xl' },
    e(
      'div',
      { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3' },
      e(
        'div',
        null,
        e(
          'p',
          { className: 'text-xs font-semibold text-cyan-400 tracking-wider uppercase' },
          t('whaleAlertsDashboard.orderFlowRadar', { defaultValue: 'Order Flow Radar' }),
        ),
        e(
          'h2',
          { className: 'mt-1 text-lg font-semibold text-slate-100' },
          t('whaleAlertsDashboard.darkMoneyTitle', { symbol, defaultValue: `Dòng tiền ẩn danh: ${symbol}` }),
        ),
      ),
      e(
        'div',
        { className: 'flex items-center gap-3' },
        e(
          'div',
          { className: 'flex rounded-lg border border-slate-700 bg-slate-950/60 p-0.5 text-[10px]' },
          timeFilterButtons,
        ),
        e(
          'div',
          { className: 'flex items-center gap-2 text-[11px] text-slate-400' },
          e(
            'span',
            { className: 'rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest text-[9px] font-semibold' },
            String(darkFlow?.confidence || liveSignal?.confidence || t('whaleAlertsDashboard.confidenceLow')),
          ),
          e(
            'span',
            { className: 'rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300 text-[9px] font-semibold uppercase' },
            String(darkFlow?.signal_type || liveSignal?.signal_type || t('whaleAlertsDashboard.signalNone')),
          ),
        ),
      ),
    ),
    e(
      'div',
      { className: 'mt-4 grid grid-cols-1 gap-3 md:grid-cols-3' },
      e(
        'div',
        { className: 'rounded-2xl border border-slate-800 bg-slate-950/40 p-3 flex flex-col justify-between' },
        e(
          'div',
          null,
          e(
            'p',
            { className: 'text-[11px] text-slate-400 font-medium uppercase tracking-wider' },
            t('whaleAlertsDashboard.strength', { defaultValue: 'Sức mạnh' }),
          ),
          e('p', { className: 'mt-1 text-2xl font-bold text-slate-100' }, liveStrength.toFixed(1)),
        ),
        e(
          'div',
          { className: 'mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden' },
          e('div', {
            className: 'h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400',
            style: { width: `${Math.max(4, Math.min(100, liveStrength))}%` },
          }),
        ),
      ),
      e(
        'div',
        { className: 'rounded-2xl border border-slate-800 bg-slate-950/40 p-3' },
        e(
          'p',
          { className: 'text-[11px] text-slate-400 font-medium uppercase tracking-wider' },
          t('whaleAlertsDashboard.tickRatePerMin', { defaultValue: 'Tick rate / Phút' }),
        ),
        e('p', { className: 'mt-1 text-2xl font-bold text-slate-100' }, Number(tickRate?.tick_rate_per_min || 0).toFixed(1)),
        e(
          'p',
          { className: 'mt-1 text-[11px] text-slate-500' },
          `${t('whaleAlertsDashboard.smallOrders', { defaultValue: 'Lệnh nhỏ' })}: ${(smallOrderRatio * 100).toFixed(1)}%`,
        ),
      ),
      e(
        'div',
        { className: 'rounded-2xl border border-slate-800 bg-slate-950/40 p-3' },
        e(
          'p',
          { className: 'text-[11px] text-slate-400 font-medium uppercase tracking-wider' },
          t('whaleAlertsDashboard.realtimeEvent', { defaultValue: 'Sự kiện Realtime' }),
        ),
        e(
          'p',
          { className: 'mt-1 text-xs font-semibold text-slate-200 line-clamp-2' },
          liveSignal?.description || darkFlow?.components?.absorption?.description || t('whaleAlertsDashboard.noRealtimeEvent'),
        ),
        e(
          'p',
          { className: 'mt-1 text-[10px] text-slate-500' },
          liveSignal?.ts ? new Date(liveSignal.ts).toLocaleString(undefined) : '—',
        ),
      ),
    ),
    e(
      'div',
      { className: 'mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]' },
      e(
        'div',
        { className: 'rounded-2xl border border-slate-800 bg-slate-950/40 p-3' },
        e(
          'div',
          { className: 'mb-2 flex items-center justify-between' },
          e('p', { className: 'text-xs font-semibold text-slate-300 uppercase tracking-wider' }, 'CVD (Cumulative Volume Delta)'),
          e(
            'div',
            { className: 'flex items-center gap-2' },
            orderFlowData?._cvd_source === 'whale-ssot'
              ? e(
                  'span',
                  { className: 'rounded border border-cyan-700/40 bg-cyan-950/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400' },
                  'Whale SSOT',
                )
              : null,
            e('span', { className: 'text-[10px] text-slate-500' }, t('whaleAlertsDashboard.bucketsCount', { count: chartData.length })),
          ),
        ),
        e(
          'div',
          { className: 'h-56' },
          chartData.length === 0
            ? e(
                'div',
                { className: 'flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500' },
                t('whaleAlertsDashboard.noIntradayCvd', { defaultValue: 'Không có dữ liệu CVD trong phiên' }),
              )
            : e(
                ResponsiveContainer,
                { width: '100%', height: '100%' },
                e(
                  AreaChart,
                  { data: chartData, margin: { top: 8, right: 8, left: -10, bottom: 0 } },
                  e(
                    'defs',
                    null,
                    e(
                      'linearGradient',
                      { id: 'whaleOrderFlowCvd', x1: '0', x2: '0', y1: '0', y2: '1' },
                      e('stop', { offset: '0%', stopColor: '#22d3ee', stopOpacity: 0.35 }),
                      e('stop', { offset: '100%', stopColor: '#22d3ee', stopOpacity: 0.02 }),
                    ),
                  ),
                  e(CartesianGrid, { stroke: '#1e293b', strokeDasharray: '3 3', vertical: false }),
                  e(XAxis, { dataKey: 'label', tick: { fill: '#64748b', fontSize: 10 }, axisLine: false, tickLine: false }),
                  e(YAxis, { tick: { fill: '#64748b', fontSize: 10 }, tickFormatter: fmtCompact, axisLine: false, tickLine: false }),
                  e(Tooltip, {
                    formatter: (value) => [fmtCompact(value), t('whaleAlertsDashboard.cvdLabel', { defaultValue: 'CVD Tích Lũy' })],
                    labelStyle: { color: '#cbd5e1', fontSize: 11 },
                    contentStyle: { background: '#090f1d', border: '1px solid #334155', borderRadius: 12 },
                  }),
                  e(Area, { type: 'monotone', dataKey: 'cumulative_cvd', stroke: '#22d3ee', fill: 'url(#whaleOrderFlowCvd)', strokeWidth: 2 }),
                ),
              ),
        ),
      ),
      e(
        'div',
        { className: 'rounded-2xl border border-slate-800 bg-slate-950/40 p-3' },
        e(
          'p',
          { className: 'text-xs font-semibold text-slate-300 uppercase tracking-wider' },
          t('whaleAlertsDashboard.recentSignals', { defaultValue: 'Tín hiệu gần đây' }),
        ),
        e(
          'div',
          { className: 'panel-scrollbar mt-3 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain pr-1' },
          recentSignalNodes,
        ),
      ),
    ),
  );
}
