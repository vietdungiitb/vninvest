import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

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

export function OrderFlowRadarPanel({ symbol, loading, orderFlowData, latestRealtimeAlert, window: selectedWindow, onWindowChange }) {
  const { t, formatDateTime } = useI18n();
  const cvdSeries = orderFlowData?.cvd_series || [];
  const darkFlow = orderFlowData?.dark_flow || {};
  const latestSignal = orderFlowData?.latest_signal || null;
  const signals = orderFlowData?.signals || [];
  const tickRate = orderFlowData?.tick_rate || {};
  const sizeDistribution = orderFlowData?.size_distribution || {};

  const chartData = cvdSeries.map((item) => ({
    ...item,
    label: item.bucket_ts ? new Date(item.bucket_ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—',
    cumulative_cvd: Number(item.cumulative_cvd || 0),
  }));

  const liveSignal = latestRealtimeAlert || latestSignal;
  const liveStrength = Number(liveSignal?.strength || darkFlow?.strength || 0);
  const smallOrderRatio = Number(
    liveSignal?.small_order_ratio ?? tickRate?.small_order_ratio ?? sizeDistribution?.small_ratio ?? 0
  );

  if (loading) {
    return <section className="card-section p-4"><div className="h-80 animate-pulse rounded-2xl bg-slate-900" /></section>;
  }

  return (
    <section className="card-section p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.orderFlowRadar')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('whaleAlertsDashboard.darkMoneyTitle', { symbol })}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
            {['5m', '15m', '30m', '1h'].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onWindowChange?.(w)}
                className={`px-2.5 py-1 transition-colors ${
                  selectedWindow === w
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest">
              {String(darkFlow?.confidence || liveSignal?.confidence || t('whaleAlertsDashboard.confidenceLow'))}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
              {String(darkFlow?.signal_type || liveSignal?.signal_type || t('whaleAlertsDashboard.signalNone'))}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.strength')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{liveStrength.toFixed(1)}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
              style={{ width: `${Math.max(4, Math.min(100, liveStrength))}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.tickRatePerMin')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{Number(tickRate?.tick_rate_per_min || 0).toFixed(1)}</p>
          <p className="mt-2 text-xs text-slate-400">{t('whaleAlertsDashboard.smallOrders')}: {(smallOrderRatio * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.realtimeEvent')}</p>
          <p className="mt-2 text-sm font-medium text-slate-100">{liveSignal?.description || darkFlow?.components?.absorption?.description || t('whaleAlertsDashboard.noRealtimeEvent')}</p>
          <p className="mt-2 text-[11px] text-slate-500">{liveSignal?.ts ? new Date(liveSignal.ts).toLocaleString(undefined) : '—'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{t('whaleAlertsDashboard.cvd30m')}</p>
            <span className="text-[11px] text-slate-500">{t('whaleAlertsDashboard.bucketsCount', { count: chartData.length })}</span>
          </div>
          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                {t('whaleAlertsDashboard.noIntradayCvd')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="whaleOrderFlowCvd" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [fmtCompact(value), t('whaleAlertsDashboard.cvdLabel')]}
                    labelStyle={{ color: '#cbd5e1' }}
                    contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="cumulative_cvd" stroke="#22d3ee" fill="url(#whaleOrderFlowCvd)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm font-semibold text-slate-200">{t('whaleAlertsDashboard.recentSignals')}</p>
          <div className="panel-scrollbar mt-3 max-h-[280px] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {signals.length === 0 ? (
              <p className="text-sm text-slate-500">{t('whaleAlertsDashboard.noSignalsSaved')}</p>
            ) : signals.map((item) => (
              <div key={item.id || `${item.symbol}-${item.created_at}`} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{item.signal_type}</p>
                  <p className="text-[11px] text-slate-500">{item.created_at ? formatDateTime(item.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</p>
                </div>
                <p className="mt-1 text-sm text-slate-200">{t('whaleAlertsDashboard.strength')} {Number(item.strength || 0).toFixed(1)} • {item.confidence || t('whaleAlertsDashboard.confidenceLow')}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t('whaleAlertsDashboard.tickRate')} {Number(item.tick_rate || 0).toFixed(1)} • {t('whaleAlertsDashboard.small')} {formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
