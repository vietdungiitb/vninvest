import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAggregateWhaleFeed, getRealtimeHealth } from '../api/client';
import RealtimeDebugPanel from './RealtimeDebugPanel';
import { useI18n } from '../context/LangContext';

function formatNumberSafe(value, formatNumberFn) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return formatNumberFn(Number(value));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtBil(value, formatNumberFn) {
  const v = Number(value) || 0;
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}N`;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}Tr`;
  return formatNumberSafe(v, formatNumberFn);
}

function sizeClassEmoji(cls) {
  if (cls === 'shark') return '🦈';
  return '🐋';
}

function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white';
  if (severity === 'high') return 'bg-amber-400 text-slate-950';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950';
  return 'bg-slate-800 text-slate-200';
}

export default function DashboardRealtimePanel({
  holdings,
  quotesBySymbol = {},
  realtimeStatus = 'idle',
  lastEventAt = null,
  alerts = [],
  metrics = null,
  monitoredSymbols = [],
  onSyncRequest = null,
}) {
  const { t, formatNumber, formatTime, formatQuotePrice } = useI18n();
  const [realtimeHealth, setRealtimeHealth] = useState(null);
  const [snapshotAlerts, setSnapshotAlerts] = useState([]);
  const [compact, setCompact] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const realtimeLabels = useMemo(() => ({
    idle: t('dashboardRealtime.statusIdle'),
    connecting: t('dashboardRealtime.statusConnecting'),
    live: t('dashboardRealtime.statusLive'),
    polling: t('dashboardRealtime.statusPolling'),
  }), [t]);

  const monitoredKey = useMemo(
    () => monitoredSymbols.slice().sort().join('|'),
    [monitoredSymbols],
  );

  // Tick every 15s so event-age badges stay current
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const eventAgeSeconds = lastEventAt
    ? Math.max(0, Math.floor((now - new Date(lastEventAt).getTime()) / 1000))
    : null;

  const isEventStale = eventAgeSeconds !== null && eventAgeSeconds > 120;

  useEffect(() => {
    getRealtimeHealth()
      .then((res) => setRealtimeHealth(res.data))
      .catch(() => setRealtimeHealth(null));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshotAlerts = async () => {
      if (!monitoredSymbols.length) {
        if (!cancelled) {
          setSnapshotAlerts([]);
        }
        return;
      }

      try {
        const response = await getAggregateWhaleFeed({
          symbols: monitoredSymbols,
          sort: 'ts',
          limit: 8,
        });
        if (!cancelled) {
          setSnapshotAlerts(response.data?.results || []);
        }
      } catch (_err) {
        if (!cancelled) {
          setSnapshotAlerts([]);
        }
      }
    };

    loadSnapshotAlerts();
    const intervalId = window.setInterval(loadSnapshotAlerts, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [monitoredKey, monitoredSymbols]);

  const mergedAlerts = useMemo(() => {
    const combined = [];
    const seen = new Set();

    [...alerts, ...snapshotAlerts].forEach((item, index) => {
      const key = item.event_id || `${item.symbol || 'NA'}-${item.ts || 'NA'}-${item.side || 'NA'}-${index}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      combined.push(item);
    });

    combined.sort((left, right) => {
      const leftTs = new Date(left.ts || left.created_at || 0).getTime();
      const rightTs = new Date(right.ts || right.created_at || 0).getTime();
      return rightTs - leftTs;
    });

    return combined.slice(0, 8);
  }, [alerts, snapshotAlerts]);

  const quoteList = useMemo(
    () => monitoredSymbols.map((symbol) => quotesBySymbol[symbol] || { symbol }),
    [monitoredSymbols, quotesBySymbol],
  );

  const realtimePortfolioStats = useMemo(() => {
    const stats = (holdings || []).reduce((acc, holding) => {
      const quantity = toNumber(holding.quantity);
      const costBasis = toNumber(holding.cost_basis);
      const snapshotMarketValue = toNumber(holding.market_value);
      const liveQuote = quotesBySymbol[holding.symbol] || {};
      const livePrice = liveQuote.current_price ?? holding.current_price;
      const liveMarketValue = livePrice !== null && livePrice !== undefined
        ? toNumber(livePrice) * quantity
        : snapshotMarketValue;
      const unrealizedPL = liveMarketValue - costBasis;

      acc.totalMarketValue += liveMarketValue;
      acc.totalUnrealizedPL += unrealizedPL;
      acc.snapshotMarketValue += snapshotMarketValue;

      if (liveQuote.stale) {
        acc.stalePositions += 1;
      }

      return acc;
    }, {
      totalMarketValue: 0,
      totalUnrealizedPL: 0,
      snapshotMarketValue: 0,
      stalePositions: 0,
    });

    const impliedCostBasis = stats.totalMarketValue - stats.totalUnrealizedPL;
    return {
      ...stats,
      totalUnrealizedPLPct: impliedCostBasis > 0
        ? (stats.totalUnrealizedPL / impliedCostBasis) * 100
        : 0,
    };
  }, [holdings, quotesBySymbol]);

  const liveVsSnapshotDelta = realtimePortfolioStats.totalMarketValue - realtimePortfolioStats.snapshotMarketValue;

  const marketStats = useMemo(() => {
    return quoteList.reduce((acc, item) => {
      if (item.stale) {
        acc.stale += 1;
      }
      if ((item.change_pct ?? 0) > 0) {
        acc.up += 1;
      } else if ((item.change_pct ?? 0) < 0) {
        acc.down += 1;
      } else {
        acc.flat += 1;
      }
      return acc;
    }, { up: 0, down: 0, flat: 0, stale: 0 });
  }, [quoteList]);

  const statusClasses = realtimeStatus === 'live'
    ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
    : realtimeStatus === 'connecting'
      ? 'border-amber-700 bg-amber-950/30 text-amber-300'
      : 'border-gray-700 bg-gray-950 text-gray-400';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {t('dashboardRealtime.title')}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {t('dashboardRealtime.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full border ${statusClasses}`}>
            {realtimeLabels[realtimeStatus]}
          </span>
          <span className="px-2.5 py-1 rounded-full border border-gray-800 bg-gray-950 text-gray-400">
            {t('dashboardRealtime.lastEvent', { time: formatTime(lastEventAt) })}
          </span>
          {isEventStale && (
            <span className="px-2.5 py-1 rounded-full border border-amber-700 bg-amber-950/30 text-amber-300 font-semibold animate-pulse">
              ⚠ {t('dashboardRealtime.eventStaleWarning', { seconds: eventAgeSeconds })}
            </span>
          )}
          <button
            onClick={() => setCompact((v) => !v)}
            className="px-2.5 py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            title={compact ? t('dashboardRealtime.expandPanel') : t('dashboardRealtime.collapsePanel')}
          >
            {compact ? '▼ ' : '▲ '}{compact ? t('dashboardRealtime.expandPanel') : t('dashboardRealtime.collapsePanel')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs mt-2 w-full">
          <span className="text-gray-600 mr-0.5">{t('dashboardRealtime.observability')}</span>
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            📈 {t('dashboardRealtime.eventTickers', { count: formatNumber(metrics?.eventCounts?.ticker_update ?? 0) })}
          </span>
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            🐋 {t('dashboardRealtime.eventWhale', { count: formatNumber(metrics?.eventCounts?.whale_alert ?? 0) })}
          </span>
          {(metrics?.eventCounts?.dark_flow_alert ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded border border-violet-800 bg-violet-950/20 text-violet-400">
              🌊 {t('dashboardRealtime.eventDarkFlow', { count: formatNumber(metrics.eventCounts.dark_flow_alert) })}
            </span>
          )}
          <span className="px-2 py-0.5 rounded border border-gray-800 bg-gray-950 text-gray-500">
            💓 {t('dashboardRealtime.eventHeartbeat', { count: formatNumber(metrics?.eventCounts?.heartbeat ?? 0) })}
          </span>
          {(metrics?.eventCounts?.reconnect_attempts ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded border border-amber-800 bg-amber-950/20 text-amber-400">
              ↺ {t('dashboardRealtime.eventReconnect', { count: formatNumber(metrics.eventCounts.reconnect_attempts) })}
            </span>
          )}
          {metrics?.lastLatencyMs !== null && metrics?.lastLatencyMs !== undefined && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${metrics.lastLatencyMs > 1500 ? 'border-red-800 text-red-400' : 'border-gray-800 text-gray-500'}`}>
              ⚡ {metrics.lastLatencyMs}ms
            </span>
          )}
          {metrics?.uiRefreshP95Ms !== null && metrics?.uiRefreshP95Ms !== undefined && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${metrics.uiRefreshP95Ms > 1500 ? 'border-red-800 text-red-400' : metrics.uiRefreshP95Ms > 800 ? 'border-amber-800 text-amber-400' : 'border-emerald-900 text-emerald-500'}`}>
              p95 {Number(metrics.uiRefreshP95Ms).toFixed(0)}ms
            </span>
          )}
          {metrics?.staleRatioPct !== null && metrics?.staleRatioPct !== undefined && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${metrics.staleRatioPct > 20 ? 'border-red-800 text-red-400' : metrics.staleRatioPct > 5 ? 'border-amber-800 text-amber-400' : 'border-gray-800 text-gray-500'}`}>
              stale {Number(metrics.staleRatioPct).toFixed(2)}%
            </span>
          )}
          {metrics?.fallbackRatioPct !== null && metrics?.fallbackRatioPct !== undefined && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${metrics.fallbackRatioPct > 20 ? 'border-red-800 text-red-400' : metrics.fallbackRatioPct > 5 ? 'border-amber-800 text-amber-400' : 'border-gray-800 text-gray-500'}`}>
              fallback {Number(metrics.fallbackRatioPct).toFixed(2)}%
            </span>
          )}
          {realtimeHealth && (
            <span className={`px-2 py-0.5 rounded border bg-gray-950 ${realtimeHealth.channel_layer_type === 'inmemory'
                ? 'border-yellow-800 text-yellow-500'
                : realtimeHealth.redis_ok === false
                  ? 'border-red-800 text-red-400'
                  : 'border-emerald-900 text-emerald-500'
              }`}>
              {realtimeHealth.channel_layer_type === 'inmemory'
                ? t('dashboardRealtime.channelInmemory')
                : realtimeHealth.redis_ok === false
                  ? t('dashboardRealtime.channelRedisDown')
                  : t('dashboardRealtime.channelRedisUp')}
            </span>
          )}
        </div>
      </div>

      {compact && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 py-1">
          <span>
            <span className="text-blue-300 font-semibold">{formatQuotePrice(realtimePortfolioStats.totalMarketValue)}</span>
            <span className="ml-1 text-gray-600">{t('dashboardRealtime.liveValue')}</span>
          </span>
          <span className={realtimePortfolioStats.totalUnrealizedPL > 0 ? 'text-emerald-300 font-semibold' : realtimePortfolioStats.totalUnrealizedPL < 0 ? 'text-red-300 font-semibold' : 'text-gray-300 font-semibold'}>
            {realtimePortfolioStats.totalUnrealizedPL > 0 ? '+' : ''}{formatQuotePrice(realtimePortfolioStats.totalUnrealizedPL)}
            {' '}({realtimePortfolioStats.totalUnrealizedPL > 0 ? '+' : ''}{realtimePortfolioStats.totalUnrealizedPLPct.toFixed(2)}%)
          </span>
          <span>{formatNumber(monitoredSymbols.length)} {t('dashboardRealtime.monitoredSymbols')}</span>
          {realtimePortfolioStats.stalePositions > 0 && (
            <span className="text-amber-300">{formatNumber(realtimePortfolioStats.stalePositions)} stale</span>
          )}
          {mergedAlerts.length > 0 && (
            <span className="text-violet-300">🐋 {mergedAlerts.length} alerts</span>
          )}
        </div>
      )}

      {!compact && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-blue-300">{t('dashboardRealtime.liveValue')}</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatQuotePrice(realtimePortfolioStats.totalMarketValue)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboardRealtime.liveValueHint')}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.liveUnrealized')}</p>
            <p className={`text-2xl font-bold mt-1 ${realtimePortfolioStats.totalUnrealizedPL > 0 ? 'text-emerald-300' : realtimePortfolioStats.totalUnrealizedPL < 0 ? 'text-red-300' : 'text-gray-100'}`}>
              {formatQuotePrice(realtimePortfolioStats.totalUnrealizedPL)}
            </p>
            <p className={`text-xs mt-1 ${realtimePortfolioStats.totalUnrealizedPL > 0 ? 'text-emerald-300' : realtimePortfolioStats.totalUnrealizedPL < 0 ? 'text-red-300' : 'text-gray-500'}`}>
              {realtimePortfolioStats.totalUnrealizedPL > 0 ? '+' : ''}{realtimePortfolioStats.totalUnrealizedPLPct.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.monitoredSymbols')}</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatNumber(monitoredSymbols.length)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.deltaVsSnapshot')}</p>
            <p className={`text-2xl font-bold mt-1 ${liveVsSnapshotDelta > 0 ? 'text-emerald-300' : liveVsSnapshotDelta < 0 ? 'text-red-300' : 'text-gray-100'}`}>
              {formatQuotePrice(liveVsSnapshotDelta)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboardRealtime.deltaVsSnapshotHint')}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.stale')}</p>
            <p className={`text-2xl font-bold mt-1 ${realtimePortfolioStats.stalePositions > 0 ? 'text-amber-300' : 'text-gray-100'}`}>
              {formatNumber(realtimePortfolioStats.stalePositions)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{t('dashboardRealtime.staleHint')}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.upDownFlat')}</p>
            <p className="text-2xl font-bold text-gray-100 mt-1">{formatNumber(marketStats.up)} / {formatNumber(marketStats.down)} / {formatNumber(marketStats.flat)}</p>
          </div>
        </div>
      )}

      {/* Context-aware sync CTA: hiện khi có stale positions */}
      {realtimePortfolioStats.stalePositions > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-4 py-2.5">
          <p className="text-xs text-amber-300">
            ⚠ {t('dashboardRealtime.stalePositionsCTA', { count: realtimePortfolioStats.stalePositions })}
          </p>
          {onSyncRequest && (
            <button
              onClick={onSyncRequest}
              className="shrink-0 text-xs font-semibold px-3 py-1 rounded border border-amber-700 bg-amber-900/40 text-amber-200 hover:bg-amber-800/60 transition-colors"
            >
              {t('dashboardRealtime.syncNow')}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70">
            <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.marketStatusBySymbol')}</h3>
            <p className="mt-1 text-[11px] text-gray-500">{t('dashboardRealtime.priceUnitHint')}</p>
          </div>
          {quoteList.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              {t('dashboardRealtime.noSymbols')}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableSymbol')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePrice')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tablePctChange')}</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-medium">{t('dashboardRealtime.tableFreshness')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {quoteList.map((item) => {
                    const isUp = (item.change_pct ?? 0) > 0;
                    const isDown = (item.change_pct ?? 0) < 0;
                    return (
                      <tr key={item.symbol} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-brand-300">
                          <Link
                            to={`/stocks/${item.symbol}`}
                            className="inline-flex items-center hover:text-cyan-300 transition-colors"
                          >
                            {item.symbol}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-200 tabular-nums">{formatQuotePrice(item.current_price)}</td>
                        <td className={`px-4 py-3 font-semibold ${isUp ? 'text-emerald-300' : isDown ? 'text-red-300' : 'text-gray-400'}`}>
                          {item.change_pct === null || item.change_pct === undefined
                            ? '—'
                            : `${isUp ? '+' : ''}${Number(item.change_pct).toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.stale ? (
                            <span className="text-amber-300">{t('dashboardRealtime.stale')}</span>
                          ) : (
                            <span className="text-gray-500">{t('dashboardRealtime.secondsShort', { value: formatNumber(item.freshness_seconds ?? 0) })}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/70 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.recentWhaleAlerts')}</h3>
            <Link
              to="/whale-alerts"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              {t('dashboardRealtime.viewAll')}
            </Link>
          </div>
          {mergedAlerts.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 text-center">
              {t('dashboardRealtime.noAlerts')}
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto px-3 py-3 flex flex-col gap-2">
              {mergedAlerts.map((alert, index) => {
                const side = alert.side?.toLowerCase();
                const isBuy = side === 'buy';
                const sizeClass = alert.size_class ?? null;
                const severity = typeof alert.severity === 'string' ? alert.severity.toLowerCase() : null;
                const isBig = sizeClass === 'shark';
                return (
                  <Link
                    key={alert.event_id || `${alert.symbol}-${alert.ts}-${index}`}
                    to={`/whale-alerts/${alert.symbol}`}
                    className="block"
                  >
                    <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-[12px] transition-colors hover:brightness-110 ${isBuy
                        ? 'border-emerald-700/60 bg-emerald-950/30'
                        : side === 'sell'
                          ? 'border-rose-700/60 bg-rose-950/30'
                          : 'border-slate-700/60 bg-slate-900/30'
                      } ${index === 0 ? 'animate-pulse-once' : ''}`}>
                      {isBig && (
                        <span className="absolute right-2 top-1.5 text-[18px] opacity-50">
                          {sizeClassEmoji(sizeClass)}
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-[13px]">{alert.symbol}</span>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isBuy
                              ? 'bg-emerald-900/60 text-emerald-300'
                              : side === 'sell'
                                ? 'bg-rose-900/60 text-rose-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                            {isBuy ? t('dashboardRealtime.bigBuy') : side === 'sell' ? t('dashboardRealtime.bigSell') : t('dashboardRealtime.neutral')}
                          </span>
                          {severity && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityTone(severity)}`}>
                              {severity}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-white">{fmtBil(alert.matched_value, formatNumber)}</span>
                        <span className="text-[11px] text-slate-500">{formatTime(alert.ts)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {t('dashboardRealtime.threshold')}: {fmtBil(alert.threshold, formatNumber)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {t('dashboardRealtime.source')}: {alert.source || 'realtime'}
                      </div>
                      {(alert.display_score != null || alert.event_score != null) && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {t('dashboardRealtime.score')}: {alert.display_score ?? '—'} / {t('dashboardRealtime.event')}: {alert.event_score ?? '—'}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <RealtimeDebugPanel />
      </div>
    </div>
  );
}
