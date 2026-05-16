import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRealtimeHealth } from '../api/client';
import AllocationPieChart from './AllocationPieChart';
import { RealtimeQuoteTable, COLUMN_PRESETS } from './RealtimeQuoteTable';
import { useI18n } from '../context/LangContext';
import useAlertCenterFeed, { normalizeAlertText, normalizeSeverity } from '../hooks/useAlertCenterFeed';
import usePersistentAlertState from '../hooks/usePersistentAlertState';
import {
  alertCardTone,
  alertTypeBadgeTone,
  alertSourceBadgeTone,
  alertSeveritySummaryTone,
  alertTypeLabel,
} from '../utils/alertTaxonomy';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceLabel(source, t) {
  if (source === 'dark_flow') return t('dashboardRealtime.sourceDarkFlow');
  if (source === 'price_shock') return t('dashboardRealtime.sourcePriceShock');
  if (source === 'stale_quote') return t('dashboardRealtime.sourceStaleQuote');
  return t('dashboardRealtime.sourceWhale');
}

export default function DashboardRealtimePanel({
  holdings,
  trackedSymbolNames = [],
  quotesBySymbol = {},
  realtimeStatus = 'idle',
  lastEventAt = null,
  alerts = [],
  darkFlowAlerts = [],
  metrics = null,
  monitoredSymbols = [],
  enableSnapshot = true,
  onSyncRequest = null,
  showSummaryMetrics = true,
  portfolioId = null,
}) {
  const { t, formatNumber, formatTime, formatDateTime, formatQuoteInteger } = useI18n();
  const [realtimeHealth, setRealtimeHealth] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('alerts');
  const [compact, setCompact] = useState(false);
  const [showObservabilityPopover, setShowObservabilityPopover] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [criticalToasts, setCriticalToasts] = useState([]);
  const criticalToastCooldownRef = useRef({});

  const {
    readAlertIds,
    criticalSoundEnabled,
    markAlertAsRead,
    isMutedSymbol,
    muteSymbolFor30m,
    toggleCriticalSound,
  } = usePersistentAlertState();

  const {
    quoteList,
    filteredUnifiedAlerts,
    alertSummary,
    hotSymbols,
    backendUnifiedHasMore,
    loadingMoreUnified,
    loadMoreUnifiedSnapshot,
  } = useAlertCenterFeed({
    alerts,
    darkFlowAlerts,
    monitoredSymbols,
    quotesBySymbol,
    holdings,
    trackedSymbolNames,
    enableSnapshot,
    lastEventAt,
    sourceFilter,
    severityFilter,
    audienceFilter,
    isMutedSymbol,
    formatNumber,
    t,
  });

  const holdingSymbolSet = useMemo(
    () => new Set((holdings || []).map((h) => String(h.symbol || '').toUpperCase()).filter(Boolean)),
    [holdings],
  );

  const playCriticalTone = () => {
    if (!criticalSoundEnabled) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new window.AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.18);
      oscillator.onended = () => {
        ctx.close();
      };
    } catch (_err) {
      // fail-soft
    }
  };

  const realtimeLabels = useMemo(() => ({
    idle: t('dashboardRealtime.statusIdle'),
    connecting: t('dashboardRealtime.statusConnecting'),
    live: t('dashboardRealtime.statusLive'),
    polling: t('dashboardRealtime.statusPolling'),
  }), [t]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const eventAgeSeconds = lastEventAt
    ? Math.max(0, Math.floor((now - new Date(lastEventAt).getTime()) / 1000))
    : null;
  const isEventStale = eventAgeSeconds !== null && eventAgeSeconds > 120;

  useEffect(() => {
    let isActive = true;
    getRealtimeHealth()
      .then((res) => {
        if (isActive) {
          setRealtimeHealth(res.data);
        }
      })
      .catch(() => {
        if (isActive) {
          setRealtimeHealth(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const unreadCount = useMemo(
    () => filteredUnifiedAlerts.filter((item) => !readAlertIds.has(item.id)).length,
    [filteredUnifiedAlerts, readAlertIds],
  );

  useEffect(() => {
    const criticalAlerts = filteredUnifiedAlerts.filter((item) => normalizeSeverity(item.severity, 'medium') === 'critical');
    if (!criticalAlerts.length) return;

    const prioritized = [...criticalAlerts].sort((a, b) => {
      const aHolding = holdingSymbolSet.has(String(a.symbol || '').toUpperCase()) ? 1 : 0;
      const bHolding = holdingSymbolSet.has(String(b.symbol || '').toUpperCase()) ? 1 : 0;
      if (aHolding !== bHolding) return bHolding - aHolding;
      return new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime();
    });

    const nowTs = Date.now();
    const toastTtlMs = 6000;
    const cooldownMs = 120000;
    const candidate = prioritized.find((item) => nowTs >= (criticalToastCooldownRef.current[item.id] || 0));
    if (!candidate) return;

    criticalToastCooldownRef.current[candidate.id] = nowTs + cooldownMs;
    const toastId = `${candidate.id}-${nowTs}`;

    setCriticalToasts((prev) => {
      if (prev.some((item) => item.alert?.id === candidate.id)) {
        return prev;
      }
      return [{ id: toastId, alert: candidate }, ...prev].slice(0, 2);
    });

    playCriticalTone();

    const timeoutId = window.setTimeout(() => {
      setCriticalToasts((prev) => prev.filter((item) => item.id !== toastId));
    }, toastTtlMs);
    return () => window.clearTimeout(timeoutId);
  }, [filteredUnifiedAlerts, criticalSoundEnabled, holdingSymbolSet]);

  const toggleSeverityFilterFromSummary = (targetFilter) => {
    setSeverityFilter((prev) => (prev === targetFilter ? 'all' : targetFilter));
  };

  const realtimePortfolioStats = useMemo(() => {
    const stats = (holdings || []).reduce((acc, holding) => {
      const quantity = toNumber(holding.quantity);
      const avgCost = toNumber(holding.avg_cost);
      const costBasis = toNumber(holding.cost_basis) || (avgCost * quantity);
      const snapshotMarketValue = toNumber(holding.market_value);
      const liveQuote = quotesBySymbol[holding.symbol] || {};
      const livePrice = liveQuote.current_price ?? holding.current_price;
      const computedLiveMarketValue = livePrice !== null && livePrice !== undefined
        ? toNumber(livePrice) * quantity
        : snapshotMarketValue;
      const liveMarketValue = toNumber(holding.live_market_value ?? computedLiveMarketValue);
      const fallbackUnrealizedPL = liveMarketValue - costBasis;
      const unrealizedPL = toNumber(
        holding.live_unrealized_pl
        ?? (holding.unrealized_pl !== null && holding.unrealized_pl !== undefined ? toNumber(holding.unrealized_pl) : fallbackUnrealizedPL),
      );

      acc.totalMarketValue += liveMarketValue;
      acc.totalUnrealizedPL += unrealizedPL;
      acc.snapshotMarketValue += snapshotMarketValue;
      if (holding.live_is_stale || liveQuote.stale) {
        acc.stalePositions += 1;
      }
      return acc;
    }, {
      totalMarketValue: 0,
      totalUnrealizedPL: 0,
      snapshotMarketValue: 0,
      stalePositions: 0,
    });

    return stats;
  }, [holdings, quotesBySymbol]);

  const liveVsSnapshotDelta = realtimePortfolioStats.totalMarketValue - realtimePortfolioStats.snapshotMarketValue;

  const marketStats = useMemo(() => {
    return quoteList.reduce((acc, item) => {
      if ((item.change_pct ?? 0) > 0) acc.up += 1;
      else if ((item.change_pct ?? 0) < 0) acc.down += 1;
      else acc.flat += 1;
      return acc;
    }, { up: 0, down: 0, flat: 0 });
  }, [quoteList]);

  const statusClasses = realtimeStatus === 'live'
    ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300'
    : realtimeStatus === 'connecting'
      ? 'border-amber-700 bg-amber-950/30 text-amber-300'
      : 'border-gray-700 bg-gray-950 text-gray-400';

  const observabilityMetricChips = [
    {
      key: 'ticker_update',
      label: t('dashboardRealtime.eventTickers', { count: formatNumber(metrics?.eventCounts?.ticker_update ?? 0) }),
    },
    {
      key: 'whale_alert',
      label: t('dashboardRealtime.eventWhale', { count: formatNumber(metrics?.eventCounts?.whale_alert ?? 0) }),
    },
  ];

  return (
    <div className="space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-5">
      {criticalToasts.length > 0 && (
        <div className="space-y-2">
          {criticalToasts.map((toast) => (
            <div key={toast.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-700/70 bg-rose-950/40 px-4 py-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-200">{t('dashboardRealtime.criticalToastTitle')}</p>
                <p className="mt-0.5 text-xs text-rose-100">{toast.alert.symbol}: {normalizeAlertText(toast.alert.headline)}</p>
              </div>
              <button
                onClick={() => setCriticalToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="rounded border border-rose-700/70 bg-rose-900/30 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-900/50"
              >
                {t('dashboardRealtime.dismiss')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">{t('dashboardRealtime.title')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('dashboardRealtime.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 ${statusClasses}`}>{realtimeLabels[realtimeStatus]}</span>
          <span className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-gray-400">
            {t('dashboardRealtime.lastEvent', { time: formatTime(lastEventAt) })}
          </span>
          {isEventStale && (
            <span className="rounded-full border border-amber-700 bg-amber-950/30 px-2.5 py-1 font-semibold text-amber-300 animate-pulse">
              {t('dashboardRealtime.eventStaleWarning', { seconds: eventAgeSeconds })}
            </span>
          )}
          <button
            onClick={() => setCompact((v) => !v)}
            className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
          >
            {compact ? t('dashboardRealtime.expandPanel') : t('dashboardRealtime.collapsePanel')}
          </button>
        </div>
      </div>

      {!compact && showSummaryMetrics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.monitoredSymbols')}</p>
            <p className="mt-1 text-2xl font-bold text-gray-100">{formatNumber(monitoredSymbols.length)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.deltaVsSnapshot')}</p>
            <p className={`mt-1 text-2xl font-bold ${liveVsSnapshotDelta > 0 ? 'text-emerald-300' : liveVsSnapshotDelta < 0 ? 'text-red-300' : 'text-gray-100'}`}>
              {formatQuoteInteger(liveVsSnapshotDelta)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.stale')}</p>
            <p className={`mt-1 text-2xl font-bold ${realtimePortfolioStats.stalePositions > 0 ? 'text-amber-300' : 'text-gray-100'}`}>
              {formatNumber(realtimePortfolioStats.stalePositions)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.upDownFlat')}</p>
            <p className="mt-1 text-2xl font-bold text-gray-100">{formatNumber(marketStats.up)} / {formatNumber(marketStats.down)} / {formatNumber(marketStats.flat)}</p>
          </div>
        </div>
      )}

      {realtimePortfolioStats.stalePositions > 0 && onSyncRequest && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-4 py-2.5">
          <p className="text-xs text-amber-300">{t('dashboardRealtime.stalePositionsCTA', { count: realtimePortfolioStats.stalePositions })}</p>
          <button onClick={onSyncRequest} className="rounded border border-amber-700 bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-800/60">
            {t('dashboardRealtime.syncNow')}
          </button>
        </div>
      )}

      {activeWorkspaceTab === 'alerts' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            <div className="flex h-[460px] flex-col space-y-4 overflow-hidden rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">{t('dashboardRealtime.unifiedAlertStripTitle')}</h3>
                  <p className="mt-1 text-xs text-gray-500">{t('dashboardRealtime.unifiedAlertStripHint')}</p>
                </div>
                <span className="rounded-full border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs text-gray-300">
                  {t('dashboardRealtime.unifiedTotal', { count: filteredUnifiedAlerts.length })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => toggleSeverityFilterFromSummary('critical_only')} className={`rounded-lg border px-3 py-2 text-left ${alertSeveritySummaryTone('critical')} ${severityFilter === 'critical_only' ? 'ring-1 ring-white/30' : ''}`}>
                  <p className="text-[11px] uppercase tracking-wider text-rose-300">{t('dashboardRealtime.severityCritical')}</p>
                  <p className="mt-1 text-lg font-bold text-rose-100">{formatNumber(alertSummary.critical)}</p>
                </button>
                <button type="button" onClick={() => toggleSeverityFilterFromSummary('high_only')} className={`rounded-lg border px-3 py-2 text-left ${alertSeveritySummaryTone('high')} ${severityFilter === 'high_only' ? 'ring-1 ring-white/30' : ''}`}>
                  <p className="text-[11px] uppercase tracking-wider text-amber-300">{t('dashboardRealtime.severityHigh')}</p>
                  <p className="mt-1 text-lg font-bold text-amber-100">{formatNumber(alertSummary.high)}</p>
                </button>
                <button type="button" onClick={() => toggleSeverityFilterFromSummary('medium_only')} className={`rounded-lg border px-3 py-2 text-left ${alertSeveritySummaryTone('medium')} ${severityFilter === 'medium_only' ? 'ring-1 ring-white/30' : ''}`}>
                  <p className="text-[11px] uppercase tracking-wider text-yellow-300">{t('dashboardRealtime.severityMedium')}</p>
                  <p className="mt-1 text-lg font-bold text-yellow-100">{formatNumber(alertSummary.medium)}</p>
                </button>
                <button type="button" onClick={() => toggleSeverityFilterFromSummary('low_only')} className={`rounded-lg border px-3 py-2 text-left ${alertSeveritySummaryTone('low')} ${severityFilter === 'low_only' ? 'ring-1 ring-white/30' : ''}`}>
                  <p className="text-[11px] uppercase tracking-wider text-slate-300">{t('dashboardRealtime.severityLow')}</p>
                  <p className="mt-1 text-lg font-bold text-slate-100">{formatNumber(alertSummary.low)}</p>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-amber-700/30 bg-gradient-to-br from-amber-950/45 via-rose-950/20 to-gray-950/90 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">{t('dashboardRealtime.hotSymbols')}</span>
                  <span className="text-xs text-amber-300">{t('dashboardRealtime.unreadAlerts', { count: unreadCount })}</span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {hotSymbols.map((item) => (
                    <Link key={item.symbol} to={`/stocks/${item.symbol}`} className="rounded-2xl border border-cyan-700/40 bg-gradient-to-br from-cyan-950/40 to-gray-950 px-4 py-3 text-cyan-50 transition-all hover:-translate-y-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-black tracking-wide">{item.symbol}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/60">{t('dashboardRealtime.hotSymbolsTotalAlerts', { count: item.total })}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex h-[460px] flex-col overflow-hidden rounded-xl border border-gray-800">
              <div className="flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/70 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.unifiedCenterTitle')}</h3>
                  <p className="mt-1 text-[11px] text-gray-500">{t('dashboardRealtime.unifiedCenterHint')}</p>
                </div>
                <Link to="/whale-alerts" className="text-xs text-brand-400 transition-colors hover:text-brand-300">{t('dashboardRealtime.viewAll')}</Link>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                {filteredUnifiedAlerts.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">{t('dashboardRealtime.noUnifiedAlerts')}</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredUnifiedAlerts.map((alert, index) => {
                      const severity = normalizeSeverity(alert.severity, 'medium');
                      const isUnread = !readAlertIds.has(alert.id);
                      const cardTone = alertCardTone(alert.type, severity);
                      const typeTone = alertTypeBadgeTone(alert.type);
                      const sourceTone = alertSourceBadgeTone(alert.source);
                      return (
                        <Link key={alert.id || `${alert.symbol}-${alert.ts}-${index}`} to={alert.to || `/stocks/${alert.symbol}`} className="block">
                          <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-[12px] transition-colors hover:brightness-110 ${cardTone}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-bold text-white">{alert.symbol || 'N/A'}</span>
                              <div className="flex items-center gap-2">
                                {isUnread && <span className="rounded-full border border-cyan-700/70 bg-cyan-950/35 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">{t('dashboardRealtime.badgeNew')}</span>}
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${typeTone}`}>{alertTypeLabel(alert.type, t)}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${sourceTone}`}>{sourceLabel(alert.source, t)}</span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="text-sm font-bold text-white">{normalizeAlertText(alert.headline)}</span>
                              <span className="text-[11px] text-slate-500">{formatDateTime(alert.ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">{normalizeAlertText(alert.detail)}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button onClick={(event) => { event.preventDefault(); event.stopPropagation(); markAlertAsRead(alert.id); }} className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100">
                                {t('dashboardRealtime.markRead')}
                              </button>
                              <button onClick={(event) => { event.preventDefault(); event.stopPropagation(); muteSymbolFor30m(alert.symbol); }} className="rounded border border-amber-700/70 bg-amber-950/25 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-900/35">
                                {t('dashboardRealtime.mute30m')}
                              </button>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                    {backendUnifiedHasMore && (
                      <button onClick={loadMoreUnifiedSnapshot} disabled={loadingMoreUnified} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 disabled:opacity-60">
                        {loadingMoreUnified ? t('dashboardRealtime.loadingMore') : t('dashboardRealtime.loadMore')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40">
              <div className="border-b border-gray-800 bg-gray-950/70 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-200">{t('dashboardRealtime.marketStatusBySymbol')}</h3>
              </div>
              <RealtimeQuoteTable
                quotes={quoteList}
                columns={COLUMN_PRESETS.DASHBOARD_MARKET_STATUS}
                maxHeight="280px"
                showHint={true}
                emptyMessage={t('dashboardRealtime.noSymbols')}
                sortConfig={{ key: 'symbol', direction: 'asc' }}
              />
            </div>
            <AllocationPieChart portfolioId={portfolioId} />
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-100">{t('dashboardRealtime.settingsPanelTitle')}</h3>
              <p className="mt-1 text-xs text-gray-500">{t('dashboardRealtime.settingsPanelHint')}</p>
            </div>
            <span className="text-xs text-amber-300">{t('dashboardRealtime.unreadAlerts', { count: unreadCount })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterBySource')}</span>
            {['all', 'whale', 'dark_flow', 'price_shock', 'stale_quote'].map((source) => (
              <button key={source} onClick={() => setSourceFilter(source)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sourceFilter === source ? 'border-brand-600 bg-brand-900/30 text-brand-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}>
                {source === 'all' ? t('dashboardRealtime.filterAll') : sourceLabel(source, t)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterByAudience')}</span>
            {[{ value: 'all', label: t('dashboardRealtime.filterAll') }, { value: 'holdings', label: t('dashboardRealtime.filterHoldingsOnly') }, { value: 'watchlist', label: t('dashboardRealtime.filterWatchlistOnly') }].map((item) => (
              <button key={item.value} onClick={() => setAudienceFilter(item.value)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${audienceFilter === item.value ? 'border-brand-600 bg-brand-900/30 text-brand-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.filterBySeverity')}</span>
            {[{ value: 'all', label: t('dashboardRealtime.filterAll') }, { value: 'critical_only', label: t('dashboardRealtime.severityCritical') }, { value: 'high_only', label: t('dashboardRealtime.severityHigh') }, { value: 'medium_only', label: t('dashboardRealtime.severityMedium') }, { value: 'low_only', label: t('dashboardRealtime.severityLow') }, { value: 'critical', label: t('dashboardRealtime.filterCriticalOnly') }, { value: 'high_plus', label: t('dashboardRealtime.filterHighPlus') }, { value: 'medium_plus', label: t('dashboardRealtime.filterMediumPlus') }].map((item) => (
              <button key={item.value} onClick={() => setSeverityFilter(item.value)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityFilter === item.value ? 'border-brand-600 bg-brand-900/30 text-brand-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboardRealtime.criticalToastPolicy')}</span>
            <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300">{t('dashboardRealtime.toastQueuePolicy')}</span>
            <button onClick={toggleCriticalSound} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${criticalSoundEnabled ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}>
              {criticalSoundEnabled ? t('dashboardRealtime.soundOn') : t('dashboardRealtime.soundOff')}
            </button>
          </div>
        </div>
      )}

      <div className="relative mt-2 flex items-center gap-1.5 whitespace-nowrap text-xs">
        <button
          type="button"
          onClick={() => setShowObservabilityPopover((value) => !value)}
          aria-label={t('dashboardRealtime.observability')}
          aria-expanded={showObservabilityPopover}
          aria-controls="dashboard-realtime-observability-popover"
          className={`v2-chip-focus flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${showObservabilityPopover ? 'border-cyan-600 bg-cyan-950/45 text-cyan-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}
        >
          i
        </button>

        {showObservabilityPopover && (
          <div
            id="dashboard-realtime-observability-popover"
            className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border border-gray-700 bg-gray-950/95 p-3 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{t('dashboardRealtime.observability')}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {t('dashboardRealtime.observabilityPopoverHint', { defaultValue: 'Cảnh báo nghiêm trọng vẫn được ghim lên đầu danh sách.' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowObservabilityPopover(false)}
                className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100"
              >
                {t('dashboardRealtime.collapsePanel')}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {observabilityMetricChips.map((chip) => (
                <span key={chip.key} className="shrink-0 rounded border border-gray-800 bg-gray-950 px-2 py-0.5 text-gray-500">
                  {chip.label}
                </span>
              ))}
              {realtimeHealth && (
                <span className={`shrink-0 rounded border bg-gray-950 px-2 py-0.5 ${realtimeHealth.channel_layer_type === 'inmemory' ? 'border-yellow-800 text-yellow-500' : realtimeHealth.redis_ok === false ? 'border-red-800 text-red-400' : 'border-emerald-900 text-emerald-500'}`}>
                  {realtimeHealth.channel_layer_type === 'inmemory' ? t('dashboardRealtime.channelInmemory') : realtimeHealth.redis_ok === false ? t('dashboardRealtime.channelRedisDown') : t('dashboardRealtime.channelRedisUp')}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 pl-2">
          <button onClick={() => setActiveWorkspaceTab('alerts')} className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${activeWorkspaceTab === 'alerts' ? 'border-brand-600 bg-brand-900/30 text-brand-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            {t('dashboardRealtime.workspaceTabAlerts')}
          </button>
          <button onClick={() => setActiveWorkspaceTab('settings')} className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${activeWorkspaceTab === 'settings' ? 'border-brand-600 bg-brand-900/30 text-brand-200' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            {t('dashboardRealtime.workspaceTabSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
