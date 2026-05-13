import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import KLineChartPanel from '../components/KLineChartPanel';
import {
  addTrackedSymbol,
  addWatchlistItem,
  createPriceAlert,
  deleteTrackedSymbol,
  deleteWatchlistItem,
  getDepthChart,
  getAIConfig,
  getIntradayMatched,
  getRealtimeTickers,
  getSectorBreadth,
  getStockFinancials,
  getStockAIAdvisorySession,
  getStockAIAdvisoryObservability,
  postStockAIAdvisoryObservabilityEvent,
  refreshStockAIAdvisorySession,
  generateStockAIAdvisoryComponents,
  getStockOrderFlow,
  getStockPriceChart,
  getStockWorkspaceOverview,
  getWatchlistGroups,
  getWhaleFeed,
  deleteStockAIAdvisoryComponent,
  clearDeletedStockAIAdvisoryComponents,
  regenerateStockAIExecutiveSummary,
  deleteStockAIExecutiveSummary,
  restoreStockAIAdvisoryComponent,
  refreshStockAIAdvisoryComponent,
  toggleStockAIAdvisoryComponentInclude,
  getStockNews,
  updateAIConfig,
} from '../api/client';
import { isRequestCanceled } from '../utils/requestCancellation';
import StockNewsPanel from '../components/StockNewsPanel';
import { WhaleFeedPanel } from '../components/WhaleFeedPanel';
import { BubbleOrderChart } from '../components/BubbleOrderChart';
import { MoneyFlowDonut } from '../components/MoneyFlowDonut';
import { OrderFlowRadarPanel } from '../components/OrderFlowRadarPanel';
import AIAdvisoryPromptConfigDrawer from '../components/AIAdvisoryPromptConfigDrawer';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useAbility } from '../context/AbilityContext';
import {
  getAdvisoryConflictRetryDelayMs,
  resolveAdvisoryConflictState,
  shouldAutoRetryAdvisoryConflict,
} from './stockDetailAdvisoryUtils';

const ADVISORY_INVALIDATION_EVENT = 'vninvest:advisory_updated';

function shouldSuppressTransportError(errorLike) {
  const status = errorLike?.response?.status ?? errorLike?.status ?? null;
  if ([404, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(errorLike?.message || '').toLowerCase();
  return message.includes('network error')
    || message.includes('err_empty_response')
    || message.includes('err_connection_reset')
    || message.includes('timeout');
}

// Giá hiển thị theo chuẩn bảng giá: en-US, 2 chữ số thập phân, không kèm đơn vị trong từng ô.

function formatChartAxis(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  if (numericValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(1)}M`;
  }
  if (numericValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(0)}K`;
  }
  return numericValue.toFixed(0);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString(undefined);
}

function fmtVol(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function finiteNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRealtimeQuoteScaleCompatible(candidateQuote, overview) {
  const baselinePrice = finiteNumberOrNull(
    overview?.current_price ?? overview?.close_price ?? overview?.reference_price,
  );
  const candidatePrice = finiteNumberOrNull(
    candidateQuote?.current_price ?? candidateQuote?.reference_price ?? candidateQuote?.prev_price,
  );

  if (candidatePrice === null || baselinePrice === null || baselinePrice <= 0) {
    return true;
  }

  const ratio = Math.max(candidatePrice, baselinePrice) / Math.min(candidatePrice, baselinePrice);
  return ratio <= 20;
}

function pickRealtimeQuoteCandidate(preferredQuote, fallbackQuote, overview) {
  if (preferredQuote?.current_price != null && isRealtimeQuoteScaleCompatible(preferredQuote, overview)) {
    return preferredQuote;
  }
  if (fallbackQuote?.current_price != null && isRealtimeQuoteScaleCompatible(fallbackQuote, overview)) {
    return fallbackQuote;
  }
  return {};
}

function advisoryStatusLabel(status, t) {
  const map = {
    overbought: t('stockDetail.statusOverbought'),
    oversold: t('stockDetail.statusOversold'),
    accumulation: t('stockDetail.statusAccumulation'),
    breakout: t('stockDetail.statusBreakout'),
    neutral: t('stockDetail.statusNeutral'),
  };
  return map[String(status || '').toLowerCase()] || t('stockDetail.statusNeutral');
}

function advisoryActionLabel(action, t) {
  const map = {
    watch: t('stockDetail.actionWatch'),
    buy: t('stockDetail.actionBuy'),
    sell: t('stockDetail.actionSell'),
    hold_off: t('stockDetail.actionHoldOff'),
  };
  return map[String(action || '').toLowerCase()] || t('stockDetail.actionWatch');
}

function advisoryRiskLabel(riskLevel, t) {
  const map = {
    low: t('stockDetail.riskLow'),
    medium: t('stockDetail.riskMedium'),
    high: t('stockDetail.riskHigh'),
  };
  return map[String(riskLevel || '').toLowerCase()] || t('stockDetail.riskMedium');
}

function advisorySynthesisPreferenceLabel(preference, t) {
  const map = {
    short_term_action: t('stockDetail.preferenceShortTerm'),
    risk_management: t('stockDetail.preferenceRisk'),
    balanced: t('stockDetail.preferenceBalanced'),
  };
  return map[String(preference || '').toLowerCase()] || map.balanced;
}

function advisoryPromptSourceLabel(sourceId, t) {
  const map = {
    whale: t('stockDetail.promptSourceWhale'),
    dark_flow: t('stockDetail.promptSourceDarkFlow'),
    technical: t('stockDetail.promptSourceTechnical'),
    news: t('stockDetail.promptSourceNews'),
    market: t('stockDetail.promptSourceMarket'),
    fundamental: t('stockDetail.promptSourceFundamental'),
    ownership: t('stockDetail.promptSourceOwnership'),
    sector: t('stockDetail.promptSourceSector'),
  };
  return map[String(sourceId || '').toLowerCase()] || String(sourceId || '').replace(/_/g, ' ');
}

function advisoryRetryOutcomeLabel(outcome, t) {
  const map = {
    idle: t('stockDetail.retryOutcomeIdle'),
    scheduled: t('stockDetail.retryOutcomeScheduled'),
    recovered: t('stockDetail.retryOutcomeRecovered'),
    exhausted: t('stockDetail.retryOutcomeExhausted'),
    skipped_config: t('stockDetail.retryOutcomeSkippedConfig'),
    request_error: t('stockDetail.retryOutcomeRequestError'),
  };
  return map[String(outcome || '').toLowerCase()] || t('stockDetail.retryOutcomeIdle');
}

function emitAdvisoryInvalidation(symbol, advisory) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) return;
  window.dispatchEvent(new CustomEvent(ADVISORY_INVALIDATION_EVENT, {
    detail: {
      symbol: normalizedSymbol,
      advisoryId: advisory?.id || null,
      createdAt: advisory?.created_at || null,
    },
  }));
}

function advisoryRetryOutcomeBadgeClass(outcome) {
  const key = String(outcome || '').toLowerCase();
  if (key === 'recovered') {
    return 'border-emerald-700/60 bg-emerald-500/10 text-emerald-300';
  }
  if (key === 'scheduled') {
    return 'border-cyan-700/60 bg-cyan-500/10 text-cyan-300';
  }
  if (key === 'exhausted' || key === 'request_error') {
    return 'border-rose-700/60 bg-rose-500/10 text-rose-300';
  }
  if (key === 'skipped_config') {
    return 'border-amber-700/60 bg-amber-500/10 text-amber-300';
  }
  return 'border-slate-700 bg-slate-900/60 text-slate-300';
}

function advisoryGovernanceEndpointLabel(endpoint, t) {
  const map = {
    stock_ai_advisory_session_api: t('stockDetail.governanceEndpointSessionApi'),
    stock_ai_advisory_observability_api: t('stockDetail.governanceEndpointObservabilityApi'),
  };
  return map[String(endpoint || '').toLowerCase()] || endpoint || t('common.notAvailable');
}

function advisoryGovernanceReasonLabel(reason, t) {
  const map = {
    global_disabled: t('stockDetail.governanceReasonGlobalDisabled'),
    allowlist_blocked: t('stockDetail.governanceReasonAllowlistBlocked'),
    staff_only: t('stockDetail.governanceReasonStaffOnly'),
    all: t('stockDetail.governanceReasonAllAllowed'),
  };
  return map[String(reason || '').toLowerCase()] || reason || t('common.notAvailable');
}

function governanceDeltaSeverity(delta, thresholds = {}) {
  const warning = Math.max(0, Number(thresholds.warning ?? 2));
  const critical = Math.max(warning, Number(thresholds.critical ?? 4));
  const cooldown = Math.max(0, Number(thresholds.cooldown ?? 2));
  if (delta >= critical) return 'critical';
  if (delta >= warning) return 'warning';
  if (delta <= -cooldown) return 'cooldown';
  return 'normal';
}

function governanceDeltaSeverityLabel(level, t) {
  const map = {
    critical: t('stockDetail.governanceSeverityCritical'),
    warning: t('stockDetail.governanceSeverityWarning'),
    cooldown: t('stockDetail.governanceSeverityCooldown'),
    normal: t('stockDetail.governanceSeverityNormal'),
  };
  return map[level] || map.normal;
}

function governanceDeltaSeverityClass(level) {
  if (level === 'critical') return 'border-rose-700/70 bg-rose-500/10 text-rose-300';
  if (level === 'warning') return 'border-amber-700/70 bg-amber-500/10 text-amber-300';
  if (level === 'cooldown') return 'border-emerald-700/70 bg-emerald-500/10 text-emerald-300';
  return 'border-slate-700 bg-slate-900/60 text-slate-300';
}

function KLineChartComponent({ data, activePeriod, activeTimeframe: activeTimeframeProp, onPeriodChange, onTimeframeChange, onVisibleRangeChange, onActiveIndicatorsChange, onSessionChange, flowData = null, whaleSignals = [] }) {
  return (
    <KLineChartPanel
      data={data}
      activePeriod={activePeriod}
      activeTimeframe={activeTimeframeProp}
      onPeriodChange={onPeriodChange}
      onTimeframeChange={onTimeframeChange}
      onVisibleRangeChange={onVisibleRangeChange}
      onActiveIndicatorsChange={onActiveIndicatorsChange}
      onSessionChange={onSessionChange}
      flowData={flowData}
      whaleSignals={whaleSignals}
    />
  );
}

function IntradayMatchedPanel({ symbol, liveVolume }) {
  const STALE_RESYNC_RETRY_MS = 3000;
  const { t, formatQuotePrice, formatDateTime } = useI18n();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meta, setMeta] = useState(null);
  const debounceRef = useRef(null);
  const prevVolumeRef = useRef(null);
  const tradesCountRef = useRef(0);

  useEffect(() => {
    tradesCountRef.current = trades.length;
  }, [trades]);

  const fetchTrades = useCallback(async () => {
    if (!symbol) return;
    setRefreshing(true);
    setError('');
    try {
      const resp = await getIntradayMatched(symbol, 50);
      const payload = resp?.data || {};
      const incomingTrades = Array.isArray(payload.trades) ? payload.trades : [];
      const source = String(payload.source || '').toLowerCase();
      const isTransientEmpty = incomingTrades.length === 0 && (
        source.includes('backoff') ||
        source.includes('timeout') ||
        source.includes('error') ||
        source.includes('unavailable')
      );

      setMeta({
        source: payload.source || null,
        stale: Boolean(payload.stale),
        rateLimited: Boolean(payload.rate_limited),
        staleOverThreshold: Boolean(payload.stale_over_threshold),
        staleThresholdSeconds: Number.isFinite(Number(payload.stale_threshold_seconds))
          ? Number(payload.stale_threshold_seconds)
          : null,
        ageSeconds: Number.isFinite(Number(payload.age_seconds))
          ? Number(payload.age_seconds)
          : null,
        sourceEventAt: payload.source_event_at || null,
        servedAt: payload.served_at || null,
      });

      if (!(isTransientEmpty && tradesCountRef.current > 0)) {
        setTrades(incomingTrades);
      }
      // Prefer served_at so the UI reflects current response time even when data is stale-cache.
      setFetchedAt(payload.served_at || payload.fetched_at || null);
    } catch (err) {
      setError(err.response?.data?.detail || t('stockDetail.intradayFetchFailed'));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [symbol, t]);

  // Reset khi đổi mã
  useEffect(() => {
    setTrades([]);
    setFetchedAt(null);
    setMeta(null);
    setLoading(true);
    prevVolumeRef.current = null;
    fetchTrades();
  }, [fetchTrades]);

  // Fallback polling mỗi 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrades]);

  // Khi stale qua ngưỡng, ưu tiên resync realtime mỗi 3s.
  useEffect(() => {
    if (!autoRefresh || !meta?.staleOverThreshold) return;
    const timer = setTimeout(() => {
      fetchTrades();
    }, STALE_RESYNC_RETRY_MS);
    return () => clearTimeout(timer);
  }, [autoRefresh, fetchTrades, meta?.staleOverThreshold]);

  // Trigger khi WebSocket phát hiện volume thay đổi (có giao dịch mới)
  // Dùng debounce 3s để tránh gọi API quá nhiều
  useEffect(() => {
    if (!autoRefresh) return;
    const vol = Number(liveVolume);
    if (!Number.isFinite(vol) || vol <= 0) return;
    if (prevVolumeRef.current !== null && vol === prevVolumeRef.current) return;
    if (prevVolumeRef.current !== null && vol > prevVolumeRef.current) {
      // Volume tăng = có lệnh khớp mới → refresh sau 3s debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchTrades();
      }, 3_000);
    }
    prevVolumeRef.current = vol;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [liveVolume, autoRefresh, fetchTrades]);

  const buyCount = trades.filter((t) => t.side === 'buy').length;
  const sellCount = trades.filter((t) => t.side === 'sell').length;
  const totalVol = trades.reduce((sum, t) => sum + (t.volume || 0), 0);
  const sortedTrades = useMemo(
    () => [...trades].sort((left, right) => String(right?.time || '').localeCompare(String(left?.time || ''))),
    [trades],
  );

  return (
    <section className="card-section p-4">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('stockDetail.intradayLabel')}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{t('stockDetail.intradayTitle')}</h3>
          {fetchedAt && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {refreshing && <span className="mr-1 inline-block animate-spin">⟳</span>}
              {t('stockDetail.updatedAt')}: {formatDateTime(fetchedAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              autoRefresh
                ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                : 'border-slate-700 bg-slate-900/50 text-slate-400'
            }`}
          >
            {autoRefresh ? t('stockDetail.autoRefreshOn') : t('stockDetail.autoRefreshOff')}
          </button>
          <button
            onClick={fetchTrades}
            disabled={refreshing}
            className="rounded-full border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            {loading && !refreshing ? '...' : refreshing ? <span className="inline-block animate-spin">⟳</span> : '↻'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {trades.length > 0 && (
        <div className="mt-3 flex gap-3 text-[11px]">
          <span className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-2.5 py-1 text-emerald-300">
            ▲ {t('whaleHub.buy')}: {buyCount}
          </span>
          <span className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-2.5 py-1 text-rose-300">
            ▼ {t('whaleHub.sell')}: {sellCount}
          </span>
          <span className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-slate-300">
            {t('stockDetail.volumeShort')}: {fmtVol(totalVol)}
          </span>
        </div>
      )}

      {meta?.stale && (
        meta?.staleOverThreshold ? (
          <div className="mt-3 rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-300">
            Dữ liệu cache đã quá ngưỡng đồng bộ ({meta?.staleThresholdSeconds ?? '—'}s).
            Đang ưu tiên đồng bộ realtime tự động mỗi 3 giây.
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-300">
            {meta?.rateLimited
              ? 'Đang dùng dữ liệu cache gần nhất do nguồn realtime tạm thời bị giới hạn tần suất.'
              : 'Đang dùng dữ liệu cache gần nhất để giữ hiển thị liên tục theo phiên giao dịch.'}
            {meta?.ageSeconds != null ? ` (Tuổi dữ liệu: ${meta.ageSeconds}s)` : ''}
          </div>
        )
      )}

      <div className="mt-3">
        {loading && trades.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-900" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-2.5 text-[12px] text-rose-300">
            {error}
          </div>
        ) : sortedTrades.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-slate-500">
            {t('stockDetail.noIntradayData')}
          </p>
        ) : (
          <div className="max-h-[340px] overflow-y-auto overflow-x-hidden pr-1">
            {/* Header row */}
            <div className="sticky top-0 z-10 mb-1 grid grid-cols-[56px_1fr_82px_44px] gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-slate-500 backdrop-blur">
              <span>{t('stockDetail.timeHeader')}</span>
              <span>{t('stockDetail.price')}</span>
              <span className="text-right">{t('stockDetail.volumeShort')}</span>
              <span className="text-right">M/B</span>
            </div>
            {sortedTrades.map((row, idx) => (
              <div
                key={`${row.time}-${idx}`}
                className={`mb-1 grid grid-cols-[56px_1fr_82px_44px] items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] ${
                  row.side === 'buy'
                    ? 'border-emerald-900/30 bg-emerald-950/10'
                    : row.side === 'sell'
                      ? 'border-rose-900/30 bg-rose-950/10'
                      : 'border-slate-800/50 bg-slate-950/30'
                }`}
              >
                <span className="text-slate-500 tabular-nums">{row.time}</span>
                <span className={`font-semibold tabular-nums ${row.side === 'buy' ? 'text-emerald-300' : row.side === 'sell' ? 'text-rose-300' : 'text-slate-200'}`}>
                  {row.price != null ? formatQuotePrice(finiteNumberOrNull(row.price)) : '—'}
                </span>
                <span className="text-right text-slate-300 tabular-nums">{fmtVol(row.volume)}</span>
                <span className={`text-right text-[11px] font-semibold ${row.side === 'buy' ? 'text-emerald-500' : row.side === 'sell' ? 'text-rose-500' : 'text-slate-500'}`}>
                  {row.side === 'buy' ? 'M' : row.side === 'sell' ? 'B' : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </section>
  );
}

function BreadthMiniPanel({ symbol }) {
  const { t } = useI18n();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const run = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const resp = await getSectorBreadth(symbol);
        if (!cancelled) {
          setGroups(resp.data?.groups || []);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || t('stockDetail.breadthFetchFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run(false);
    const timer = setInterval(() => run(true), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, t]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-32 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  if (error || !groups.length) {
    return (
      <section className="card-section p-4">
        <div className="text-label pb-3 border-b border-slate-800">{t('stockDetail.sectorIndex')}</div>
        <div className="mt-3 text-slate-500 text-sm">
          {error || t('stockDetail.noSectorData')}
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="text-label pb-3 border-b border-slate-800">{t('stockDetail.breadthLabel')}</div>
      <div className="mt-4 space-y-3">
        {groups.map((group) => {
          const peers = Array.isArray(group.peers) ? group.peers : [];
          const upCount = peers.filter((p) => p.status === 'up').length;
          const downCount = peers.filter((p) => p.status === 'down').length;
          const flatCount = peers.filter((p) => p.status === 'flat').length;
          const total = peers.length;
          return (
            <div key={group.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300">{group.name}</span>
                <span className="text-[10px] text-slate-500">{upCount}↑ {downCount}↓ {flatCount}→</span>
              </div>
              <div className="flex h-5 gap-0.5 rounded-md overflow-hidden border border-slate-800 bg-slate-950">
                {upCount > 0 && (
                  <div className="bg-emerald-700/70" style={{ width: `${(upCount / total) * 100}%` }} title={`${upCount} ${t('stockDetail.breadthUpTitle')}`} />
                )}
                {flatCount > 0 && (
                  <div className="bg-slate-700/50" style={{ width: `${(flatCount / total) * 100}%` }} title={`${flatCount} ${t('stockDetail.breadthFlatTitle')}`} />
                )}
                {downCount > 0 && (
                  <div className="bg-rose-700/70" style={{ width: `${(downCount / total) * 100}%` }} title={`${downCount} ${t('stockDetail.breadthDownTitle')}`} />
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {peers.slice(0, 6).map((peer) => (
                  <div
                    key={peer.symbol}
                    className={`text-[10px] px-2 py-1 rounded border breadth-${peer.status}${peer.is_self ? ' ring-1 ring-cyan-500' : ''}`}
                  >
                    <span>{peer.symbol}</span>
                    {peer.change_pct != null && (
                      <span className="ml-1 font-semibold">
                        {peer.change_pct > 0 ? '+' : ''}{peer.change_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
                {peers.length > 6 && (
                  <span className="text-[10px] px-2 py-1 text-slate-500">+{peers.length - 6}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function biasMeta(bias, t) {
  if (bias === 'BULLISH') {
    return {
      label: t('stockDetail.biasBullishLabel'),
      className: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
      description: t('stockDetail.biasBullishDescription'),
    };
  }
  if (bias === 'WEAK') {
    return {
      label: t('stockDetail.biasWeakLabel'),
      className: 'border-rose-700 bg-rose-950/40 text-rose-300',
      description: t('stockDetail.biasWeakDescription'),
    };
  }
  return {
    label: t('stockDetail.biasNeutralLabel'),
    className: 'border-slate-700 bg-slate-900/70 text-slate-300',
    description: t('stockDetail.biasNeutralDescription'),
  };
}

function PriceDepthPanel({ symbol, liveVolume }) {
  const { t, formatQuotePrice, formatDateTime } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const prevVolumeRef = useRef(null);
  const debounceRef = useRef(null);
  const inFlightRef = useRef(false);
  const backoffUntilRef = useRef(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    const now = Date.now();
    if (inFlightRef.current) {
      return;
    }
    if (now < backoffUntilRef.current) {
      return;
    }

    inFlightRef.current = true;
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await getDepthChart(symbol);
      setData(resp.data);
      setError('');
    } catch (err) {
      if (err?.response?.status === 429) {
        // Apply local cool-down to avoid hammering endpoint when server throttles.
        backoffUntilRef.current = Date.now() + 15000;
        setError(t('stockDetail.depthRateLimited'));
      } else {
        setError(err.response?.data?.detail || t('stockDetail.orderbookFetchFailed'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trigger khi volume thay đổi (debounce 3s)
  useEffect(() => {
    if (liveVolume && liveVolume !== prevVolumeRef.current) {
      prevVolumeRef.current = liveVolume;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(true), 3000);
    }
  }, [liveVolume, fetchData]);

  // 30s polling
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const bids = data?.bids || [];
  const asks = data?.asks || [];
  const depth = [0, 1, 2].map((index) => ({
    level: index + 1,
    bid_volume: bids[index]?.volume ?? null,
    bid_price: bids[index]?.price ?? null,
    ask_price: asks[index]?.price ?? null,
    ask_volume: asks[index]?.volume ?? null,
  })).filter((row) => (
    row.bid_volume != null || row.bid_price != null || row.ask_price != null || row.ask_volume != null
  ));
  const ref = data?.reference_price;

  return (
    <section className="card-section p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('stockDetail.marketDepth')}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{t('stockDetail.orderbook3Levels')}</h3>
          <p className="mt-1 text-[11px] text-slate-500">{t('stockDetail.orderbook3LevelsDesc')}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          {refreshing ? '⟳' : t('stockDetail.refresh')}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      ) : depth.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('stockDetail.noDepthData')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <span>{t('stockDetail.bidVolume')}</span>
            <span>{t('stockDetail.bidPrice')}</span>
            <span>{t('stockDetail.askPrice')}</span>
            <span className="text-right">{t('stockDetail.askVolume')}</span>
          </div>
          <div className="mt-2 space-y-2">
            {depth.map((row) => (
              <div key={row.level} className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">{fmtVol(row.bid_volume)}</span>
                <span className="font-semibold text-emerald-300">{formatQuotePrice(finiteNumberOrNull(row.bid_price))}</span>
                <span className="font-semibold text-rose-300">{formatQuotePrice(finiteNumberOrNull(row.ask_price))}</span>
                <span className="text-right text-slate-300">{fmtVol(row.ask_volume)}</span>
              </div>
            ))}
          </div>

          {/* Nước ngoài */}
          {(data?.foreign_buy_volume != null || data?.foreign_sell_volume != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-[12px]">
              <div>
                <span className="text-slate-500">{t('stockDetail.foreignBuy')} </span>
                <span className="font-semibold text-cyan-300">{fmtVol(data.foreign_buy_volume)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{t('stockDetail.foreignSell')} </span>
                <span className="font-semibold text-orange-300">{fmtVol(data.foreign_sell_volume)}</span>
              </div>
            </div>
          )}
          {ref && (
            <p className="mt-2 text-right text-[10px] text-slate-600">
              {t('stockDetail.reference')} {formatQuotePrice(finiteNumberOrNull(ref))} · {data.fetched_at ? formatDateTime(data.fetched_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ─── FinancialMetricsPanel ─────────────────────────────────────────────────

function MetricRow({ label, value, unit = '', highlight = false }) {
  const display = value !== null && value !== undefined
    ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`
    : '—';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums ${highlight && value ? 'text-emerald-400' : 'text-slate-200'}`}>
        {display}
      </span>
    </div>
  );
}

function FinancialMetricsPanel({ financials, loading, selectedYear, onYearChange }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <section className="card-section p-4 xl:col-span-3">
        <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.financialMetricsYearly')}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-900" />
          ))}
        </div>
      </section>
    );
  }

  const years = financials?.years || [];
  if (!years.length) {
    const isUpstreamUnavailable = financials?.source === 'vnbroker_unavailable';
    return (
      <section className="card-section p-4 xl:col-span-3">
        <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.financialMetricsYearly')}</p>
        <p className="mt-4 text-sm text-slate-500">
          {isUpstreamUnavailable
            ? t('stockDetail.financialDataTemporarilyUnavailable')
            : t('stockDetail.noFinancialData')}
        </p>
      </section>
    );
  }

  const row = years.find((y) => y.year === selectedYear) || years[0];

  return (
    <section className="card-section p-4 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <p className="text-label">{t('stockDetail.financialMetricsYearly')}</p>
        <div className="flex gap-1.5">
          {years.map((y) => (
            <button
              key={y.year}
              onClick={() => onYearChange(y.year)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                y.year === selectedYear
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {y.year}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Định giá */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-400">{t('stockDetail.valuation')}</p>
          <MetricRow label={t('stockDetail.metricEps')} value={row.eps} />
          <MetricRow label={t('stockDetail.metricPe')} value={row.pe} />
          <MetricRow label={t('stockDetail.metricPb')} value={row.pb} />
          <MetricRow label={t('stockDetail.metricPs')} value={row.ps} />
          <MetricRow label={t('stockDetail.metricBvps')} value={row.bvps} />
          <MetricRow label={t('stockDetail.metricMarketCapBn')} value={row.market_cap_bn} />
        </div>

        {/* Khả năng sinh lời */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">{t('stockDetail.profitability')}</p>
          <MetricRow label={t('stockDetail.metricRoe')} value={row.roe} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricRoa')} value={row.roa} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricNetMargin')} value={row.net_margin} unit="%" highlight />
          <MetricRow label={t('stockDetail.metricDividendYield')} value={row.dividend_yield} unit="%" />
        </div>

        {/* Sức mạnh tài chính */}
        <div className="card-compact">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400">{t('stockDetail.financialStrength')}</p>
          <MetricRow label={t('stockDetail.metricLeverage')} value={row.leverage} />
          <MetricRow label={t('stockDetail.metricDebtEquity')} value={row.debt_equity} />
          <MetricRow label={t('stockDetail.metricCurrentRatio')} value={row.current_ratio} />
          <MetricRow label={t('stockDetail.metricQuickRatio')} value={row.quick_ratio} />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// AI Advisory prompt_config helpers (backend SSOT)
// ============================================================================

function _getDefaultPromptConfig() {
  return {
    version: 2,
    sources: {
      whale:       { enabled: true,  lookback: 180 },
      dark_flow:   { enabled: true,  lookback: 90 },
      technical:   { enabled: true,  lookback: 30, indicators: ['rsi', 'bollinger', 'vols'] },
      news:        { enabled: true,  lookback: 14 },
      market:      { enabled: true,  lookback: 7 },
      fundamental: { enabled: false, lookback: 90 },
      ownership:   { enabled: false, lookback: 365 },
      sector:      { enabled: false, lookback: 60 },
    },
  };
}

function _normalizeAdvisoryPromptConfig(promptConfig) {
  const fallback = _getDefaultPromptConfig();
  if (!promptConfig || typeof promptConfig !== 'object') {
    return fallback;
  }

  const normalizedSources = { ...fallback.sources };
  Object.entries(promptConfig.sources || {}).forEach(([sourceId, sourceConfig]) => {
    normalizedSources[sourceId] = {
      ...(fallback.sources[sourceId] || {}),
      ...(sourceConfig || {}),
    };
  });

  return {
    ...fallback,
    ...promptConfig,
    sources: normalizedSources,
  };
}

export default function StockDetail() {
  const { t, formatQuotePrice, formatDateTime } = useI18n();
  const { isAuthenticated } = usePortfolio();
  const ability = useAbility();
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();
  const canViewAdvancedTab = ability.can('read', 'StockDetailAdvancedTab');
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [technical, setTechnical] = useState(null);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [selectedWatchlistGroupId, setSelectedWatchlistGroupId] = useState('');
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activePeriod, setActivePeriod] = useState(180);
  const [activeTimeframe, setActiveTimeframe] = useState('1D');
  const [error, setError] = useState('');
  const [whaleFeedData, setWhaleFeedData] = useState(null);
  const [whaleFeedLoading, setWhaleFeedLoading] = useState(true);
  const [financials, setFinancials] = useState(null);
  const [financialsLoading, setFinancialsLoading] = useState(true);
  const [tickerSnapshot, setTickerSnapshot] = useState(null);
  const [financialsYear, setFinancialsYear] = useState(null);
  const [advisorySession, setAdvisorySession] = useState(null);
  const [activeInsightTab, setActiveInsightTab] = useState('advisory');
  const [advisoryUserProvider, setAdvisoryUserProvider] = useState(null);
  const [advisoryComponents, setAdvisoryComponents] = useState([]);
  const [advisoryDeletedComponents, setAdvisoryDeletedComponents] = useState([]);
  const [advisoryExecutiveSummary, setAdvisoryExecutiveSummary] = useState(null);
  const [advisoryExecutiveSummaries, setAdvisoryExecutiveSummaries] = useState([]);
  const [activeAdvisoryComponentId, setActiveAdvisoryComponentId] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);
  const [advisoryComponentBusyId, setAdvisoryComponentBusyId] = useState(null);
  const [advisoryGeneratingComponents, setAdvisoryGeneratingComponents] = useState(false);
  const [advisoryClearingDeleted, setAdvisoryClearingDeleted] = useState(false);
  const [advisoryRegeneratingSummary, setAdvisoryRegeneratingSummary] = useState(false);
  const [advisoryDeletingSummary, setAdvisoryDeletingSummary] = useState(false);
  const [advisorySynthesisPreference, setAdvisorySynthesisPreference] = useState('balanced');
  const [advisoryMessage, setAdvisoryMessage] = useState('');
  const [advisorySessionConflict, setAdvisorySessionConflict] = useState(false);
  const [advisoryPollingPaused, setAdvisoryPollingPaused] = useState(false);
  const [advisoryRetryTelemetry, setAdvisoryRetryTelemetry] = useState({
    scheduledCount: 0,
    recoveredCount: 0,
    failedCount: 0,
    lastReason: '',
    lastOutcome: 'idle',
    lastEventAt: null,
  });
  const [advisoryAggregate, setAdvisoryAggregate] = useState(null);
  const [advisoryObservability, setAdvisoryObservability] = useState(null);
  const [advisoryObservabilityLoading, setAdvisoryObservabilityLoading] = useState(false);
  const [advisoryObservabilityWindowHours, setAdvisoryObservabilityWindowHours] = useState(48);
  const [advisoryGovernanceBucket, setAdvisoryGovernanceBucket] = useState('hour');
  const [advisoryGovernanceEndpointFilter, setAdvisoryGovernanceEndpointFilter] = useState('all');
  const [advisoryGovernanceReasonFilter, setAdvisoryGovernanceReasonFilter] = useState('all');
  const [retryEventOutcomeFilter, setRetryEventOutcomeFilter] = useState('all');
  const [retryEventReasonFilter, setRetryEventReasonFilter] = useState('all');
  const [retryEventSortMode, setRetryEventSortMode] = useState('newest');
  const [advisoryPromptConfig, setAdvisoryPromptConfig] = useState(null);
  const [advisoryPromptConfigShowSettings, setAdvisoryPromptConfigShowSettings] = useState(false);
  const [advisoryChartContextState, setAdvisoryChartContextState] = useState({ used: null, warnings: [] });
  const [chartVisibleRange, setChartVisibleRange] = useState({ from_ts: null, to_ts: null });
  const [selectedKlineSession, setSelectedKlineSession] = useState(null);
  const [chartActiveIndicators, setChartActiveIndicators] = useState({ MA: true, VOL: true, MACD: true });
  const [orderFlowData, setOrderFlowData] = useState(null);
  const [orderFlowLoading, setOrderFlowLoading] = useState(true);
  const [orderFlowWindow, setOrderFlowWindow] = useState('30m');
  const advisoryConflictRetryTimeoutRef = useRef(null);
  const advisoryConflictRetryCountRef = useRef(0);
  const advisoryRetryTelemetrySyncKeyRef = useRef('');
  const advisoryInvalidationKeyRef = useRef('');
  const advisoryPromptConfigLoadedRef = useRef(false);
  const advisoryPromptConfigLastSavedRef = useRef('');
  const selectedTradeDate = selectedKlineSession?.symbol === normalizedSymbol ? selectedKlineSession.tradeDate ?? null : null;

  const { quotesBySymbol, realtimeStatus, lastEventAt, alerts, darkFlowAlerts, latestWhaleAlert, latestDarkFlowAlert } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  // Lọc alerts và whale signals theo symbol hiện tại
  const symbolAlerts = alerts ? alerts.filter((a) => a.symbol === normalizedSymbol) : [];
  const symbolWhaleAlert = latestWhaleAlert && latestWhaleAlert.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert && latestDarkFlowAlert.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

  const { data: whaleAnalyticsData } = useWhaleAnalyticsData(normalizedSymbol, activeTimeframe, selectedTradeDate, { includeBaseline: false });
  const selectedSessionMaterialization = whaleAnalyticsData?.materialization || null;
  const selectedSessionReadPath = selectedSessionMaterialization?.read_path || null;

  const whaleSignalsForChart = useMemo(() => {
    const snapshotOrders = whaleAnalyticsData?.bubbles?.orders;
    const flattenedSnapshotOrders = snapshotOrders
      ? [
        ...(Array.isArray(snapshotOrders.buy) ? snapshotOrders.buy : []),
        ...(Array.isArray(snapshotOrders.sell) ? snapshotOrders.sell : []),
        ...(Array.isArray(snapshotOrders.internal) ? snapshotOrders.internal : []),
      ]
      : [];

    if (flattenedSnapshotOrders.length > 0) {
      return flattenedSnapshotOrders;
    }

    if (Array.isArray(whaleFeedData?.whale_orders) && whaleFeedData.whale_orders.length > 0) {
      return whaleFeedData.whale_orders;
    }

    return symbolAlerts;
  }, [symbolAlerts, whaleAnalyticsData, whaleFeedData]);

  useEffect(() => {
    setSelectedKlineSession(null);
  }, [normalizedSymbol]);

  const filteredPersistedRetryEvents = useMemo(() => {
    return Array.isArray(advisoryObservability?.retry_events) ? advisoryObservability.retry_events : [];
  }, [advisoryObservability?.retry_events]);

  const retryEventReasonOptions = useMemo(() => {
    const events = Array.isArray(advisoryObservability?.retry_events) ? advisoryObservability.retry_events : [];
    const unique = Array.from(new Set(events.map((event) => String(event?.reason || '').toLowerCase()).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.retry_events]);

  const governanceTrendRows = useMemo(() => {
    const rows = Array.isArray(advisoryObservability?.governance?.rollout_gate_deny_trend)
      ? advisoryObservability.governance.rollout_gate_deny_trend
      : [];
    if (rows.length === 0) {
      return [];
    }
    const maxDeny = Math.max(1, ...rows.map((row) => Number(row?.deny_total || 0)));
    return rows.slice(-8).map((row) => {
      const denyTotal = Number(row?.deny_total || 0);
      const topEndpoint = Object.entries(row?.deny_by_endpoint || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      const topReason = Object.entries(row?.deny_by_reason || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      const topCohort = Object.entries(row?.deny_by_cohort_mode || {}).sort((a, b) => Number(b?.[1] || 0) - Number(a?.[1] || 0))[0]?.[0] || 'n/a';
      return {
        bucket: row?.bucket || '',
        denyTotal,
        widthPercent: Math.max(8, Math.round((denyTotal / maxDeny) * 100)),
        topEndpoint,
        topReason,
        topCohort,
        tooltipText: [
          `${t('stockDetail.governanceDenyCount')}: ${denyTotal}`,
          `${t('stockDetail.governanceTopEndpoint')}: ${advisoryGovernanceEndpointLabel(topEndpoint, t)}`,
          `${t('stockDetail.governanceTopReason')}: ${advisoryGovernanceReasonLabel(topReason, t)}`,
          `${t('stockDetail.governanceTopCohort')}: ${topCohort}`,
        ].join(' | '),
      };
    });
  }, [advisoryObservability?.governance?.rollout_gate_deny_trend, t]);

  const governanceEndpointOptions = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_endpoint || {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_endpoint]);

  const governanceReasonOptions = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_reason || {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_reason]);

  const governanceEndpointBreakdown = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_endpoint || {};
    return Object.entries(map)
      .map(([key, count]) => ({ key, count: Number(count || 0) }))
      .sort((a, b) => b.count - a.count);
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_endpoint]);

  const governanceReasonBreakdown = useMemo(() => {
    const map = advisoryObservability?.governance?.rollout_gate_deny_by_reason || {};
    return Object.entries(map)
      .map(([key, count]) => ({ key, count: Number(count || 0) }))
      .sort((a, b) => b.count - a.count);
  }, [advisoryObservability?.governance?.rollout_gate_deny_by_reason]);

  const governanceSparkline = useMemo(() => {
    if (!governanceTrendRows.length) {
      return null;
    }
    const values = governanceTrendRows.map((row) => Number(row.denyTotal || 0));
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const width = 220;
    const height = 44;
    const pointItems = values.map((value, idx) => {
      const x = values.length === 1 ? 0 : Math.round((idx / (values.length - 1)) * width);
      const y = Math.round(height - ((value / max) * height));
      return {
        x,
        y,
        value,
        bucket: governanceTrendRows[idx]?.bucket || '',
      };
    });
    const polylinePoints = pointItems.map((point) => `${point.x},${point.y}`).join(' ');
    const maxValue = Math.max(...values);
    const maxPoint = pointItems.find((point) => point.value === maxValue) || null;
    const baseline = values.reduce((sum, value) => sum + value, 0) / values.length;
    const baselineY = Math.round(height - ((baseline / max) * height));
    const latest = values[values.length - 1] || 0;
    const previous = values.length > 1 ? values[values.length - 2] : latest;
    const latestDeltaVsBaseline = latest - baseline;
    const thresholds = {
      warning: Number(advisoryObservability?.governance?.delta_thresholds?.warning ?? 2),
      critical: Number(advisoryObservability?.governance?.delta_thresholds?.critical ?? 4),
      cooldown: Number(advisoryObservability?.governance?.delta_thresholds?.cooldown ?? 2),
    };
    const deltaSeverity = governanceDeltaSeverity(latestDeltaVsBaseline, thresholds);
    return {
      pointItems,
      polylinePoints,
      width,
      height,
      min,
      max,
      baseline,
      baselineY,
      latest,
      previous,
      latestDeltaVsBaseline,
      thresholds,
      deltaSeverity,
      maxPoint,
    };
  }, [advisoryObservability?.governance?.delta_thresholds, governanceTrendRows]);

  const refreshWhaleFeed = useCallback(async () => {
    setWhaleFeedLoading(true);
    try {
      const response = await getWhaleFeed(normalizedSymbol);
      setWhaleFeedData(response.data);
    } catch (_) {
    } finally {
      setWhaleFeedLoading(false);
    }
  }, [normalizedSymbol]);

  const fetchAdvisorySession = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) {
      setAdvisoryLoading(true);
    }
    try {
      const retryAttemptsUsed = advisoryConflictRetryCountRef.current;
      const advisoryParams = { contract: 'v2', include_benchmarks: 1 };
      if (selectedTradeDate) {
        advisoryParams.trade_date = selectedTradeDate;
      }
      const response = await getStockAIAdvisorySession(normalizedSymbol, advisoryParams);
      const payload = response?.data || {};
      if (payload && payload.ok === false) {
        const conflictState = resolveAdvisoryConflictState(payload, t);
        setAdvisorySession(conflictState.advisory);
        setAdvisoryAggregate(conflictState.aggregate);
        setAdvisoryUserProvider(conflictState.userAiProvider);
        setAdvisoryComponents(conflictState.components);
        setAdvisoryDeletedComponents(conflictState.deletedComponents);
        setAdvisoryExecutiveSummaries(conflictState.executiveSummaries);
        setAdvisoryExecutiveSummary(conflictState.executiveSummary || conflictState.executiveSummaries[0] || null);
        setActiveAdvisoryComponentId((prev) => {
          if (prev && conflictState.components.some((item) => item.id === prev)) {
            return prev;
          }
          return conflictState.components[0]?.id || null;
        });
        setAdvisoryPollingPaused(true);
        setAdvisorySessionConflict(true);
        setAdvisoryMessage(conflictState.message);
        setAdvisoryRetryTelemetry((prev) => ({
          ...prev,
          lastReason: conflictState.reason || 'ai_not_configured',
          lastOutcome: 'skipped_config',
          lastEventAt: new Date().toISOString(),
        }));
        return;
      }
      if (advisoryConflictRetryTimeoutRef.current) {
        clearTimeout(advisoryConflictRetryTimeoutRef.current);
        advisoryConflictRetryTimeoutRef.current = null;
      }
      advisoryConflictRetryCountRef.current = 0;
      setAdvisoryPollingPaused(false);
      if (retryAttemptsUsed > 0) {
        setAdvisoryRetryTelemetry((prev) => ({
          ...prev,
          recoveredCount: prev.recoveredCount + 1,
          lastReason: '',
          lastOutcome: 'recovered',
          lastEventAt: new Date().toISOString(),
        }));
      }
      setAdvisorySessionConflict(false);
      setAdvisorySession(payload.advisory || null);
      setAdvisoryAggregate(payload.aggregate || null);
      setAdvisoryUserProvider(payload.user_ai_provider || null);
      const nextComponents = Array.isArray(payload.components) ? payload.components : [];
      const nextDeletedComponents = Array.isArray(payload.deleted_components) ? payload.deleted_components : [];
      setAdvisoryComponents(nextComponents);
      setAdvisoryDeletedComponents(nextDeletedComponents);
      const nextSummaries = Array.isArray(payload.executive_summaries) ? payload.executive_summaries : [];
      setAdvisoryExecutiveSummaries(nextSummaries);
      setAdvisoryExecutiveSummary(payload.executive_summary || nextSummaries[0] || null);
      setActiveAdvisoryComponentId((prev) => {
        if (prev && nextComponents.some((item) => item.id === prev)) {
          return prev;
        }
        return nextComponents[0]?.id || null;
      });
      if (payload.message) {
        setAdvisoryMessage(payload.message);
      }

      const advisory = payload?.advisory || null;
      const advisoryKey = [
        normalizedSymbol,
        advisory?.id || 'none',
        advisory?.created_at || 'none',
      ].join(':');
      if (advisoryKey !== advisoryInvalidationKeyRef.current) {
        advisoryInvalidationKeyRef.current = advisoryKey;
        emitAdvisoryInvalidation(normalizedSymbol, advisory);
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        const conflictState = resolveAdvisoryConflictState(err?.response?.data, t);
        setAdvisorySession(conflictState.advisory);
        setAdvisoryAggregate(conflictState.aggregate);
        setAdvisoryUserProvider(conflictState.userAiProvider);
        setAdvisoryComponents(conflictState.components);
        setAdvisoryDeletedComponents(conflictState.deletedComponents);
        setAdvisoryExecutiveSummaries(conflictState.executiveSummaries);
        setAdvisoryExecutiveSummary(conflictState.executiveSummary || conflictState.executiveSummaries[0] || null);
        setActiveAdvisoryComponentId((prev) => {
          if (prev && conflictState.components.some((item) => item.id === prev)) {
            return prev;
          }
          return conflictState.components[0]?.id || null;
        });
        const canAutoRetry = shouldAutoRetryAdvisoryConflict(conflictState);
        const attempt = advisoryConflictRetryCountRef.current + 1;
        const maxRetryAttempts = 3;

        if (canAutoRetry && attempt <= maxRetryAttempts) {
          const retryDelayMs = getAdvisoryConflictRetryDelayMs(attempt);
          setAdvisoryPollingPaused(false);
          advisoryConflictRetryCountRef.current = attempt;
          setAdvisoryRetryTelemetry((prev) => ({
            ...prev,
            scheduledCount: prev.scheduledCount + 1,
            lastReason: conflictState.reason || 'conflict',
            lastOutcome: 'scheduled',
            lastEventAt: new Date().toISOString(),
          }));

          if (advisoryConflictRetryTimeoutRef.current) {
            clearTimeout(advisoryConflictRetryTimeoutRef.current);
          }

          advisoryConflictRetryTimeoutRef.current = setTimeout(() => {
            advisoryConflictRetryTimeoutRef.current = null;
            fetchAdvisorySession({ silent: true });
          }, retryDelayMs);

          const retrySeconds = Math.max(1, Math.ceil(retryDelayMs / 1000));
          setAdvisoryMessage(`${conflictState.message} ${t('stockDetail.aiAdvisoryAutoRetryInSeconds', { seconds: retrySeconds })}`);
        } else {
          if (canAutoRetry && attempt > maxRetryAttempts) {
            setAdvisoryRetryTelemetry((prev) => ({
              ...prev,
              failedCount: prev.failedCount + 1,
              lastReason: conflictState.reason || 'conflict',
              lastOutcome: 'exhausted',
              lastEventAt: new Date().toISOString(),
            }));
          } else {
            setAdvisoryRetryTelemetry((prev) => ({
              ...prev,
              lastReason: conflictState.reason || 'ai_not_configured',
              lastOutcome: 'skipped_config',
              lastEventAt: new Date().toISOString(),
            }));
          }
          setAdvisoryPollingPaused(true);
          setAdvisoryMessage(conflictState.message);
        }
        setAdvisorySessionConflict(true);
        return;
      }
      if (advisoryConflictRetryTimeoutRef.current) {
        clearTimeout(advisoryConflictRetryTimeoutRef.current);
        advisoryConflictRetryTimeoutRef.current = null;
      }
      if (advisoryConflictRetryCountRef.current > 0) {
        setAdvisoryRetryTelemetry((prev) => ({
          ...prev,
          failedCount: prev.failedCount + 1,
          lastReason: 'request_error',
          lastOutcome: 'request_error',
          lastEventAt: new Date().toISOString(),
        }));
      }
      advisoryConflictRetryCountRef.current = 0;
      setAdvisorySessionConflict(false);
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.loadAiAdvisoryFailed'));
    } finally {
      if (!silent) {
        setAdvisoryLoading(false);
      }
    }
  }, [normalizedSymbol, selectedTradeDate, t]);

  useEffect(() => () => {
    if (advisoryConflictRetryTimeoutRef.current) {
      clearTimeout(advisoryConflictRetryTimeoutRef.current);
      advisoryConflictRetryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    advisoryConflictRetryCountRef.current = 0;
    if (advisoryConflictRetryTimeoutRef.current) {
      clearTimeout(advisoryConflictRetryTimeoutRef.current);
      advisoryConflictRetryTimeoutRef.current = null;
    }
    setAdvisoryPollingPaused(false);
    advisoryRetryTelemetrySyncKeyRef.current = '';
    setRetryEventOutcomeFilter('all');
    setRetryEventReasonFilter('all');
    setRetryEventSortMode('newest');
    setAdvisoryObservabilityWindowHours(48);
    setAdvisoryGovernanceBucket('hour');
    setAdvisoryGovernanceEndpointFilter('all');
    setAdvisoryGovernanceReasonFilter('all');
    setAdvisoryRetryTelemetry({
      scheduledCount: 0,
      recoveredCount: 0,
      failedCount: 0,
      lastReason: '',
      lastOutcome: 'idle',
      lastEventAt: null,
    });

    advisoryPromptConfigLoadedRef.current = false;
    advisoryPromptConfigLastSavedRef.current = '';

    let cancelled = false;

    async function loadPromptConfig() {
      try {
        const cfgResp = await getAIConfig();
        if (cancelled) return;
        const cfg = cfgResp?.data || {};
        const promptConfig = _normalizeAdvisoryPromptConfig(cfg.ai_prompt_config || cfg.prompt_config || {});
        setAdvisoryPromptConfig(promptConfig);
        advisoryPromptConfigLastSavedRef.current = JSON.stringify(promptConfig);
      } catch (err) {
        if (cancelled) return;
        const fallback = _normalizeAdvisoryPromptConfig(_getDefaultPromptConfig());
        setAdvisoryPromptConfig(fallback);
        advisoryPromptConfigLastSavedRef.current = JSON.stringify(fallback);
        console.warn('Failed to load AI prompt config from backend:', err);
      } finally {
        if (!cancelled) {
          advisoryPromptConfigLoadedRef.current = true;
        }
      }
    }

    loadPromptConfig();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol || !advisoryPromptConfig || !advisoryPromptConfigLoadedRef.current) return;

    const serializedConfig = JSON.stringify(advisoryPromptConfig);
    if (serializedConfig === advisoryPromptConfigLastSavedRef.current) return;

    let cancelled = false;

    async function persistPromptConfig() {
      try {
        const response = await updateAIConfig({ ai_prompt_config: advisoryPromptConfig });
        if (cancelled) return;
        const responseConfig = response?.data?.ai_prompt_config || response?.data?.prompt_config || advisoryPromptConfig;
        const normalizedConfig = _normalizeAdvisoryPromptConfig(responseConfig);
        advisoryPromptConfigLastSavedRef.current = JSON.stringify(normalizedConfig);
        if (JSON.stringify(normalizedConfig) !== serializedConfig) {
          setAdvisoryPromptConfig(normalizedConfig);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to save AI prompt config to backend:', err);
        }
      }
    }

    persistPromptConfig();

    return () => {
      cancelled = true;
    };
  }, [advisoryPromptConfig, normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    if (!advisoryRetryTelemetry.lastEventAt) return;
    if (advisoryRetryTelemetry.lastOutcome === 'idle') return;

    const syncKey = [
      normalizedSymbol,
      advisoryRetryTelemetry.lastEventAt,
      advisoryRetryTelemetry.lastOutcome,
      advisoryRetryTelemetry.lastReason,
      advisoryRetryTelemetry.scheduledCount,
      advisoryRetryTelemetry.recoveredCount,
      advisoryRetryTelemetry.failedCount,
    ].join('|');

    if (advisoryRetryTelemetrySyncKeyRef.current === syncKey) {
      return;
    }
    advisoryRetryTelemetrySyncKeyRef.current = syncKey;

    postStockAIAdvisoryObservabilityEvent(normalizedSymbol, {
      event_type: 'frontend_retry_telemetry',
      outcome: advisoryRetryTelemetry.lastOutcome,
      client_ts: new Date().toISOString(),
      telemetry: {
        scheduled_count: advisoryRetryTelemetry.scheduledCount,
        recovered_count: advisoryRetryTelemetry.recoveredCount,
        failed_count: advisoryRetryTelemetry.failedCount,
        last_reason: advisoryRetryTelemetry.lastReason,
        last_event_at: advisoryRetryTelemetry.lastEventAt,
      },
    }).catch(() => {
      // Keep telemetry sync best-effort; UX must not fail if logging endpoint is unavailable.
    });
  }, [
    advisoryRetryTelemetry.failedCount,
    advisoryRetryTelemetry.lastEventAt,
    advisoryRetryTelemetry.lastOutcome,
    advisoryRetryTelemetry.lastReason,
    advisoryRetryTelemetry.recoveredCount,
    advisoryRetryTelemetry.scheduledCount,
    normalizedSymbol,
  ]);

  const fetchAdvisoryObservability = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) {
      setAdvisoryObservabilityLoading(true);
    }
    try {
      const params = {
        window_hours: advisoryObservabilityWindowHours,
        limit: 12,
        retry_sort: retryEventSortMode,
        governance_bucket: advisoryGovernanceBucket,
      };
      if (advisoryGovernanceEndpointFilter !== 'all') {
        params.governance_endpoint = advisoryGovernanceEndpointFilter;
      }
      if (advisoryGovernanceReasonFilter !== 'all') {
        params.governance_reason = advisoryGovernanceReasonFilter;
      }
      if (retryEventOutcomeFilter !== 'all') {
        params.retry_outcome = retryEventOutcomeFilter;
      }
      if (retryEventReasonFilter !== 'all') {
        params.retry_reason = retryEventReasonFilter;
      }
      const response = await getStockAIAdvisoryObservability(normalizedSymbol, {
        ...params,
      });
      setAdvisoryObservability(response?.data || null);
    } catch (_) {
      if (!silent) {
        setAdvisoryObservability(null);
      }
    } finally {
      if (!silent) {
        setAdvisoryObservabilityLoading(false);
      }
    }
  }, [advisoryGovernanceBucket, advisoryGovernanceEndpointFilter, advisoryGovernanceReasonFilter, advisoryObservabilityWindowHours, normalizedSymbol, retryEventOutcomeFilter, retryEventReasonFilter, retryEventSortMode]);

  const fetchOrderFlow = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) setOrderFlowLoading(true);
    try {
      const response = await getStockOrderFlow(normalizedSymbol, orderFlowWindow);
      setOrderFlowData(response?.data || null);
    } catch (err) {
      if (isRequestCanceled(err)) {
        return;
      }
      if (!shouldSuppressTransportError(err)) {
        console.error('getStockOrderFlow:', err);
      }
      setOrderFlowData(null);
    } finally {
      if (!silent) setOrderFlowLoading(false);
    }
  }, [normalizedSymbol, orderFlowWindow]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlistGroups([]);
      return () => {};
    }

    let cancelled = false;

    const fetchWatchlistGroups = async () => {
      try {
        const response = await getWatchlistGroups();
        if (!cancelled) {
          setWatchlistGroups(response.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('getWatchlistGroups:', err);
        }
      }
    };

    fetchWatchlistGroups();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchOverview = async () => {
      setLoadingOverview(true);
      setError('');
      try {
        const response = await getStockWorkspaceOverview(normalizedSymbol);
        if (!cancelled) {
          setOverview(response.data);
          if (!selectedWatchlistGroupId && response.data?.watchlist_memberships?.length > 0) {
            setSelectedWatchlistGroupId(String(response.data.watchlist_memberships[0].group_id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || t('stockDetail.loadSymbolDataFailed', { symbol: normalizedSymbol }));
        }
      } finally {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      }
    };

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, selectedWatchlistGroupId]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }

    let cancelled = false;

    const fetchChart = async () => {
      setLoadingChart(true);
      try {
        const response = await getStockPriceChart(normalizedSymbol, activePeriod, activeTimeframe);
        if (!cancelled) {
          setChartData(response.data.results || []);
          setTechnical(response.data.technical || null);
        }
      } catch (err) {
        if (!cancelled) {
          if (!shouldSuppressTransportError(err)) {
            console.error('getStockPriceChart:', err);
          }
          setChartData([]);
          setTechnical(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingChart(false);
        }
      }
    };

    fetchChart();

    return () => {
      cancelled = true;
    };
  }, [normalizedSymbol, activePeriod, activeTimeframe]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;
    const runRefresh = async () => {
      setWhaleFeedLoading(true);
      try {
        const response = await getWhaleFeed(normalizedSymbol);
        if (!cancelled) {
          setWhaleFeedData(response.data);
        }
      } catch (_) {
      } finally {
        if (!cancelled) {
          setWhaleFeedLoading(false);
        }
      }
    };
    runRefresh();
    const interval = setInterval(runRefresh, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      if (silent && advisoryPollingPaused) return;
      await fetchAdvisorySession({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [advisoryPollingPaused, fetchAdvisorySession, normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      return;
    }
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchAdvisoryObservability({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAdvisoryObservability, normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchOrderFlow({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchOrderFlow, normalizedSymbol]);

  const prevWhaleRef = useRef(null);
  useEffect(() => {
    if (symbolWhaleAlert && symbolWhaleAlert?.ts !== prevWhaleRef.current) {
      prevWhaleRef.current = symbolWhaleAlert.ts;
      refreshWhaleFeed();
    }
  }, [symbolWhaleAlert, refreshWhaleFeed]);

  const prevDarkFlowRef = useRef(null);
  useEffect(() => {
    if (symbolDarkFlowAlert && symbolDarkFlowAlert?.ts !== prevDarkFlowRef.current) {
      prevDarkFlowRef.current = symbolDarkFlowAlert.ts;
      fetchOrderFlow({ silent: true });
    }
  }, [symbolDarkFlowAlert, fetchOrderFlow]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;
    setFinancialsLoading(true);
    getStockFinancials(normalizedSymbol)
      .then((r) => {
        if (!cancelled) {
          setFinancials(r.data);
          if (r.data?.years?.length) setFinancialsYear(r.data.years[0].year);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFinancialsLoading(false); });
    return () => { cancelled = true; };
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      setTickerSnapshot(null);
      return undefined;
    }

    let cancelled = false;

    const fetchTickerSnapshot = async () => {
      try {
        const response = await getRealtimeTickers([normalizedSymbol]);
        if (!cancelled) {
          const tickerData = response?.data?.[normalizedSymbol] || null;
          setTickerSnapshot(tickerData);
        }
      } catch {
        if (!cancelled) {
          setTickerSnapshot((prev) => prev || null);
        }
      }
    };

    fetchTickerSnapshot();
    const intervalId = window.setInterval(fetchTickerSnapshot, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [normalizedSymbol]);

  const liveQuote = quotesBySymbol[normalizedSymbol] || {};
  const resolvedRealtimeQuote = pickRealtimeQuoteCandidate(
    tickerSnapshot,
    liveQuote,
    overview,
  );

  const overviewCurrentPrice = finiteNumberOrNull(overview?.current_price);
  const overviewClosePrice = finiteNumberOrNull(overview?.close_price);
  const liveCurrentPrice = finiteNumberOrNull(resolvedRealtimeQuote.current_price);
  const currentPrice = liveCurrentPrice ?? overviewCurrentPrice ?? overviewClosePrice ?? null;
  const liveReferencePrice = finiteNumberOrNull(
    resolvedRealtimeQuote.reference_price ?? resolvedRealtimeQuote.prev_price,
  );
  const referencePrice = liveReferencePrice ?? finiteNumberOrNull(overview?.reference_price) ?? null;
  const liveCeilingPrice = finiteNumberOrNull(resolvedRealtimeQuote.ceiling);
  const ceilingPrice = liveCeilingPrice ?? finiteNumberOrNull(overview?.ceiling) ?? null;
  const liveFloorPrice = finiteNumberOrNull(resolvedRealtimeQuote.floor);
  const floorPrice = liveFloorPrice ?? finiteNumberOrNull(overview?.floor) ?? null;
  const liveAveragePrice = finiteNumberOrNull(resolvedRealtimeQuote.average_price);
  const averagePrice = liveAveragePrice ?? finiteNumberOrNull(overview?.average_price) ?? null;

  const overviewChangeValue = finiteNumberOrNull(overview?.change_value);
  const liveChangeValue = finiteNumberOrNull(resolvedRealtimeQuote.change_value);
  const changeValue = liveChangeValue ?? overviewChangeValue ?? null;
  const changePct = Number.isFinite(Number(resolvedRealtimeQuote.change_pct))
    ? Number(resolvedRealtimeQuote.change_pct)
    : (Number.isFinite(Number(overview?.change_pct)) ? Number(overview.change_pct) : null);

  const liveHighPrice = finiteNumberOrNull(resolvedRealtimeQuote.high_price) ?? finiteNumberOrNull(overview?.high_price);
  const liveLowPrice = finiteNumberOrNull(resolvedRealtimeQuote.low_price) ?? finiteNumberOrNull(overview?.low_price);
  const liveVolume = resolvedRealtimeQuote.volume ?? overview?.volume ?? null;

  const changeClass = useMemo(() => {
    if (changeValue > 0) {
      return 'text-emerald-400';
    }
    if (changeValue < 0) {
      return 'text-rose-400';
    }
    return 'text-slate-300';
  }, [changeValue]);

  const visibleChartPoints = useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }

    const points = chartData
      .map((item) => {
        const ts = item?.date ? new Date(item.date).getTime() : null;
        const close = finiteNumberOrNull(item?.close);
        if (!Number.isFinite(ts) || !Number.isFinite(close)) {
          return null;
        }
        return { ts, close };
      })
      .filter(Boolean);

    if (!points.length) {
      return [];
    }

    const fromTs = Number.isFinite(Number(chartVisibleRange?.from_ts)) ? Number(chartVisibleRange.from_ts) : null;
    const toTs = Number.isFinite(Number(chartVisibleRange?.to_ts)) ? Number(chartVisibleRange.to_ts) : null;
    if (!fromTs || !toTs) {
      return points;
    }

    const withinRange = points.filter((point) => point.ts >= fromTs && point.ts <= toTs);
    return withinRange.length >= 2 ? withinRange : points;
  }, [chartData, chartVisibleRange?.from_ts, chartVisibleRange?.to_ts]);

  const chartPerformance = useMemo(() => {
    if (!visibleChartPoints.length) {
      return null;
    }
    const firstClose = Number(visibleChartPoints[0]?.close || 0);
    const lastClose = Number(visibleChartPoints[visibleChartPoints.length - 1]?.close || 0);
    if (firstClose <= 0) {
      return null;
    }
    return ((lastClose - firstClose) / firstClose) * 100;
  }, [visibleChartPoints]);

  const chartWindowHint = useMemo(() => {
    if (visibleChartPoints.length >= 2) {
      return t('stockDetail.thisWindowHint', { timeframe: activeTimeframe });
    }
    return t('stockDetail.thisWindowHintFallback', { timeframe: activeTimeframe });
  }, [activeTimeframe, t, visibleChartPoints.length]);

  const technicalBiasFallback = biasMeta(technical?.bias, t);
  const technicalBias = {
    ...technicalBiasFallback,
    label: technical?.bias_label || technicalBiasFallback.label,
    description: technical?.bias_description || technicalBiasFallback.description,
  };

  const availableWatchlistGroups = useMemo(
    () => watchlistGroups.filter((group) => !overview?.watchlist_memberships?.some((item) => item.group_id === group.id)),
    [overview?.watchlist_memberships, watchlistGroups],
  );

  useEffect(() => {
    if (!selectedWatchlistGroupId && availableWatchlistGroups.length > 0) {
      setSelectedWatchlistGroupId(String(availableWatchlistGroups[0].id));
    }
  }, [availableWatchlistGroups, selectedWatchlistGroupId]);

  const refreshWorkspace = async () => {
    setSelectedKlineSession(null);
    const [overviewResponse, chartResponse] = await Promise.all([
      getStockWorkspaceOverview(normalizedSymbol),
      getStockPriceChart(normalizedSymbol, activePeriod, activeTimeframe),
    ]);
    setOverview(overviewResponse.data);
    setChartData(chartResponse.data.results || []);
    setTechnical(chartResponse.data.technical || null);
  };

  const showWorkspaceMessage = (message) => {
    setWorkspaceMessage(message);
    setTimeout(() => setWorkspaceMessage(''), 4000);
  };

  const handleToggleTracked = async () => {
    setWorkspaceError('');
    setActionLoading('tracked');
    try {
      if (overview.is_tracked && overview.tracked_symbol_id) {
        await deleteTrackedSymbol(overview.tracked_symbol_id);
        showWorkspaceMessage(t('stockDetail.removedFromShortlist', { symbol: normalizedSymbol }));
      } else {
        const sourceGroupId = overview.market_group_refs?.[0]?.id || null;
        await addTrackedSymbol(normalizedSymbol, sourceGroupId);
        showWorkspaceMessage(t('stockDetail.addedToShortlist', { symbol: normalizedSymbol }));
      }
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.updateShortlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistGroupId) {
      setWorkspaceError(t('stockDetail.noPersonalWatchlist'));
      return;
    }

    setWorkspaceError('');
    setActionLoading('watchlist-add');
    try {
      await addWatchlistItem(Number(selectedWatchlistGroupId), normalizedSymbol);
      showWorkspaceMessage(t('stockDetail.addedToPersonalWatchlist', { symbol: normalizedSymbol }));
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.addToPersonalWatchlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRemoveFromWatchlist = async (itemId, groupName) => {
    setWorkspaceError('');
    setActionLoading(`watchlist-remove-${itemId}`);
    try {
      await deleteWatchlistItem(itemId);
      showWorkspaceMessage(t('stockDetail.removedFromGroup', { symbol: normalizedSymbol, group: groupName }));
      await refreshWorkspace();
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.removeFromPersonalWatchlistFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateAlert = async () => {
    const targetPrice = Number(alertTargetPrice);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setWorkspaceError(t('stockDetail.alertPriceMustBePositive'));
      return;
    }

    setWorkspaceError('');
    setActionLoading('alert');
    try {
      await createPriceAlert({
        symbol: normalizedSymbol,
        condition: targetPrice >= Number(currentPrice || 0) ? 'ABOVE' : 'BELOW',
        target_price: targetPrice,
        cooldown_seconds: 300,
        is_active: true,
      });
      setAlertTargetPrice('');
      showWorkspaceMessage(t('stockDetail.priceAlertCreated', { symbol: normalizedSymbol }));
    } catch (err) {
      setWorkspaceError(err.response?.data?.detail || t('stockDetail.createPriceAlertFailed'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRefreshActiveAdvisoryComponent = async (componentId) => {
    if (!componentId) return;
    try {
      const cfgResp = await getAIConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await refreshStockAIAdvisoryComponent(componentId);
      const payload = response?.data || {};
      const refreshed = payload.component;
      if (refreshed?.id) {
        setAdvisoryComponents((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
        setActiveAdvisoryComponentId(refreshed.id);
      }
      setAdvisoryMessage(payload.message || t('stockDetail.refreshAiTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.refreshAiTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const buildChartContextPayload = useCallback(() => {
    const normalizedPoints = (Array.isArray(chartData) ? chartData : [])
      .map((item) => {
        const ts = item?.date ? new Date(item.date).getTime() : null;
        if (!Number.isFinite(ts)) return null;
        return {
          ts,
          o: Number(item?.open ?? item?.close ?? 0),
          h: Number(item?.high ?? item?.close ?? 0),
          l: Number(item?.low ?? item?.close ?? 0),
          c: Number(item?.close ?? 0),
          v: Number(item?.volume ?? 0),
        };
      })
      .filter(Boolean)
      .slice(-300);

    const fallbackFromTs = normalizedPoints[0]?.ts ?? null;
    const fallbackToTs = normalizedPoints[normalizedPoints.length - 1]?.ts ?? null;
    const fromTs = Number.isFinite(Number(chartVisibleRange?.from_ts)) ? Number(chartVisibleRange.from_ts) : fallbackFromTs;
    const toTs = Number.isFinite(Number(chartVisibleRange?.to_ts)) ? Number(chartVisibleRange.to_ts) : fallbackToTs;

    const avgVol = normalizedPoints.length
      ? normalizedPoints.reduce((sum, row) => sum + Number(row.v || 0), 0) / normalizedPoints.length
      : 0;
    const latestVol = normalizedPoints.length ? Number(normalizedPoints[normalizedPoints.length - 1].v || 0) : 0;

    return {
      symbol: normalizedSymbol,
      chart_timeframe: orderFlowWindow || '30m',
      selected_session: selectedKlineSession ? {
        trade_date: selectedTradeDate,
        timestamp: selectedKlineSession.timestamp ?? null,
        data_index: selectedKlineSession.dataIndex ?? null,
        read_path: selectedSessionMaterialization?.read_path || null,
        session_summary_state: selectedSessionMaterialization?.session_summary_state || null,
        freshness_state: selectedSessionMaterialization?.freshness_state || null,
        raw_fallback_used: Boolean(selectedSessionMaterialization?.raw_fallback_used),
        facts_first_primary_path: Boolean(whaleAnalyticsData?.quality_flags?.facts_first_primary_path),
        has_materialized_facts: Boolean(whaleAnalyticsData?.quality_flags?.has_materialized_facts),
        has_session_summary: Boolean(whaleAnalyticsData?.quality_flags?.has_session_summary),
      } : null,
      selected_trade_date: selectedTradeDate,
      visible_range: {
        from_ts: fromTs,
        to_ts: toTs,
      },
      ohlcv: normalizedPoints,
      active_indicators: chartActiveIndicators,
      computed_metrics: {
        change_visible_pct: Number(chartPerformance ?? 0),
        volatility_visible: Number(technical?.volatility_20 ?? 0),
        volume_ratio_vs_20: avgVol > 0 ? Number((latestVol / avgVol).toFixed(4)) : 0,
        atr_estimate: Number(technical?.atr ?? 0),
      },
      client_generated_at: new Date().toISOString(),
    };
  }, [chartActiveIndicators, chartData, chartPerformance, chartVisibleRange?.from_ts, chartVisibleRange?.to_ts, normalizedSymbol, orderFlowWindow, selectedKlineSession, selectedTradeDate, selectedSessionMaterialization?.read_path, selectedSessionMaterialization?.session_summary_state, selectedSessionMaterialization?.freshness_state, selectedSessionMaterialization?.raw_fallback_used, technical?.atr, technical?.volatility_20, whaleAnalyticsData?.quality_flags?.facts_first_primary_path, whaleAnalyticsData?.quality_flags?.has_materialized_facts, whaleAnalyticsData?.quality_flags?.has_session_summary]);

  const handleGenerateAdvisoryComponents = async () => {
    if (!normalizedSymbol) return;
    try {
      const cfgResp = await getAIConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryGeneratingComponents(true);

    // Nếu chưa có advisory gốc, tạo mới trước khi generate components
    let currentSession = advisorySession;
    if (!currentSession) {
      try {
        setAdvisoryMessage('Đang tạo advisory AI gốc, vui lòng đợi...');
        const sessionResp = await refreshStockAIAdvisorySession(normalizedSymbol);
        const sessionPayload = sessionResp?.data || {};
        if (sessionPayload.advisory) {
          // Sync fallback: có advisory ngay
          currentSession = sessionPayload.advisory;
          setAdvisorySession(currentSession);
          emitAdvisoryInvalidation(normalizedSymbol, currentSession);
          if (Array.isArray(sessionPayload.components)) setAdvisoryComponents(sessionPayload.components);
          if (Array.isArray(sessionPayload.executive_summaries)) setAdvisoryExecutiveSummaries(sessionPayload.executive_summaries);
        } else {
          // Async: đã queue, cần đợi
          setAdvisoryMessage(sessionPayload.message || 'Đã gửi yêu cầu tạo advisory AI. Vui lòng đợi vài giây rồi bấm lại.');
          setAdvisoryGeneratingComponents(false);
          // Tự động thử lại sau 5 giây
          setTimeout(() => fetchAdvisorySession({ silent: true }), 5000);
          return;
        }
      } catch (err) {
        setAdvisoryMessage(err?.response?.data?.message || 'Không thể tạo advisory gốc. Vui lòng thử lại.');
        setAdvisoryGeneratingComponents(false);
        return;
      }
    }

    try {
      const response = await generateStockAIAdvisoryComponents(normalizedSymbol, {
        timeframe: orderFlowWindow || '30m',
        chart_context: buildChartContextPayload(),
      });
      const payload = response?.data || {};
      const nextComponents = Array.isArray(payload.components) ? payload.components : [];
      const nextWarnings = Array.isArray(payload.chart_context_warnings) ? payload.chart_context_warnings : [];
      setAdvisoryChartContextState({
        used: typeof payload.chart_context_used === 'boolean' ? payload.chart_context_used : null,
        warnings: nextWarnings,
      });
      setAdvisoryComponents(nextComponents);
      setAdvisoryDeletedComponents([]);
      setActiveAdvisoryComponentId(nextComponents[0]?.id || null);
      const generationSource = payload.generated_by_ai ? 'AI schema' : 'template fallback';
      const contextUsage = payload.chart_context_used
        ? 'Chart context: used'
        : 'Chart context: fallback';
      const warningSuffix = Array.isArray(payload.chart_context_warnings) && payload.chart_context_warnings.length
        ? ` (${payload.chart_context_warnings.join(', ')})`
        : '';
      setAdvisoryMessage(
        payload.message
          || `${t('stockDetail.generateTabsSuccess', { count: payload.created_count || nextComponents.length || 0, source: generationSource })} | ${contextUsage}${warningSuffix}`
      );
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.generateTabsFailed'));
    } finally {
      setAdvisoryGeneratingComponents(false);
    }
  };

  const handleToggleComponentInclude = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await toggleStockAIAdvisoryComponentInclude(componentId);
      const updated = response?.data?.component;
      if (updated) {
        setAdvisoryComponents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.updateIncludeFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleDeleteAdvisoryComponent = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      await deleteStockAIAdvisoryComponent(componentId);
      setAdvisoryComponents((prev) => {
        const deletedComponent = prev.find((item) => item.id === componentId);
        if (deletedComponent) {
          setAdvisoryDeletedComponents((deletedPrev) => [
            { ...deletedComponent, is_deleted: true, include_in_summary: false },
            ...deletedPrev.filter((item) => item.id !== componentId),
          ].slice(0, 20));
        }
        const next = prev.filter((item) => item.id !== componentId);
        if (activeAdvisoryComponentId === componentId) {
          setActiveAdvisoryComponentId(next[0]?.id || null);
        }
        return next;
      });
      setAdvisoryMessage(t('stockDetail.deleteTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.deleteTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleRestoreAdvisoryComponent = async (componentId) => {
    setAdvisoryComponentBusyId(componentId);
    try {
      const response = await restoreStockAIAdvisoryComponent(componentId);
      const restored = response?.data?.component;
      if (restored) {
        setAdvisoryDeletedComponents((prev) => prev.filter((item) => item.id !== restored.id));
        setAdvisoryComponents((prev) => [restored, ...prev.filter((item) => item.id !== restored.id)]);
        setActiveAdvisoryComponentId(restored.id);
      }
      setAdvisoryMessage(t('stockDetail.restoreTabSuccess'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.restoreTabFailed'));
    } finally {
      setAdvisoryComponentBusyId(null);
    }
  };

  const handleClearDeletedAdvisoryComponents = async () => {
    if (!normalizedSymbol || advisoryClearingDeleted) return;
    setAdvisoryClearingDeleted(true);
    try {
      const response = await clearDeletedStockAIAdvisoryComponents(normalizedSymbol);
      const deletedCount = Number(response?.data?.deleted_count || advisoryDeletedComponents.length || 0);
      setAdvisoryDeletedComponents([]);
      setAdvisoryMessage(`Deleted tabs cleaned: ${deletedCount}`);
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Khong the xoa Deleted tabs luc nay.');
    } finally {
      setAdvisoryClearingDeleted(false);
    }
  };

  const handleRegenerateExecutiveSummary = async () => {
    if (!normalizedSymbol) return;
    try {
      const cfgResp = await getAIConfig();
      const cfg = cfgResp?.data || {};
      if (!cfg.ai_ready) {
        setAdvisoryMessage(cfg.ai_config_message || 'Vui lòng cấu hình AI model và API key trước khi dùng AI advisory.');
        return;
      }
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Không kiểm tra được cấu hình AI hiện tại.');
      return;
    }
    setAdvisoryRegeneratingSummary(true);
    try {
      let sessionAdvisory = advisorySession;
      if (!sessionAdvisory) {
        setAdvisoryMessage('Đang tạo AI advisory gốc trước khi tổng hợp...');
        const sessionResp = await refreshStockAIAdvisorySession(normalizedSymbol);
        const sessionPayload = sessionResp?.data || {};
        if (!sessionPayload?.advisory) {
          setAdvisoryMessage(
            sessionPayload?.message || 'Đã gửi yêu cầu tạo AI advisory. Vui lòng đợi vài giây rồi bấm Tổng hợp lại.'
          );
          return;
        }
        sessionAdvisory = sessionPayload.advisory;
        setAdvisorySession(sessionAdvisory);
        if (Array.isArray(sessionPayload.components)) {
          setAdvisoryComponents(sessionPayload.components);
        }
      }

      let currentComponents = advisoryComponents;
      let activeIds = currentComponents.filter((item) => item.include_in_summary).map((item) => item.id);

      if (!activeIds.length) {
        setAdvisoryMessage('Đang tạo AI tabs từ advisory mới nhất trước khi tổng hợp...');
        const generatedResp = await generateStockAIAdvisoryComponents(normalizedSymbol, {
          timeframe: orderFlowWindow || '30m',
          chart_context: buildChartContextPayload(),
        });
        const generatedPayload = generatedResp?.data || {};
        const nextComponents = Array.isArray(generatedPayload.components) ? generatedPayload.components : [];
        currentComponents = nextComponents;
        setAdvisoryComponents(nextComponents);
        setAdvisoryDeletedComponents([]);
        setActiveAdvisoryComponentId(nextComponents[0]?.id || null);
        activeIds = nextComponents.filter((item) => item.include_in_summary).map((item) => item.id);
      }

      if (!activeIds.length) {
        setAdvisoryMessage('Không có component active để tổng hợp. Vui lòng tạo hoặc bật AI tab trước.');
        return;
      }

      const response = await regenerateStockAIExecutiveSummary(normalizedSymbol, {
        component_ids: activeIds,
        synthesis_preference: advisorySynthesisPreference,
        prompt_config: advisoryPromptConfig,  // Include canonical prompt_config for source/indicator selection
      });
      const summary = response?.data?.executive_summary || null;
      setAdvisoryExecutiveSummary(summary);
      if (summary) {
        setAdvisoryExecutiveSummaries((prev) => [summary, ...prev.filter((item) => item.id !== summary.id)].slice(0, 8));
      }
      setAdvisoryMessage(summary ? t('stockDetail.summaryRebuiltVersion', { version: summary.summary_version }) : t('stockDetail.summaryRebuilt'));
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || t('stockDetail.summaryRebuildFailed'));
    } finally {
      setAdvisoryRegeneratingSummary(false);
    }
  };

  const handleDeleteExecutiveSummary = async () => {
    if (!normalizedSymbol || !advisoryExecutiveSummary?.id) return;
    setAdvisoryDeletingSummary(true);
    try {
      await deleteStockAIExecutiveSummary(normalizedSymbol, advisoryExecutiveSummary.id);
      setAdvisoryExecutiveSummaries((prev) => {
        const next = prev.filter((item) => item.id !== advisoryExecutiveSummary.id);
        setAdvisoryExecutiveSummary(next[0] || null);
        return next;
      });
      setAdvisoryMessage('Da xoa thong tin tong hop.');
    } catch (err) {
      setAdvisoryMessage(err?.response?.data?.message || 'Khong the xoa thong tin tong hop.');
    } finally {
      setAdvisoryDeletingSummary(false);
    }
  };

  const activeAdvisoryComponent = advisoryComponents.find((item) => item.id === activeAdvisoryComponentId) || advisoryComponents[0] || null;


  if (loadingOverview) {
    return (
      <div className="app-page-shell space-y-4">
        <div className="h-44 animate-pulse rounded-[24px] bg-slate-900" />
        <div className="page-body-grid page-body-grid--auto-height">
          <div className="page-body-grid__main h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
          <div className="page-body-grid__side h-[560px] animate-pulse rounded-[24px] bg-slate-900" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-8 text-center shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
          <p className="text-sm font-semibold text-slate-100">
            {t('stockDetail.workspaceOpenFailed', { defaultValue: 'Chưa có dữ liệu workspace cho mã này.' })}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {error
              ? t('stockDetail.workspaceUnavailable', { defaultValue: 'Dữ liệu chưa sẵn sàng hoặc bị gián đoạn tạm thời. Hãy thử lại sau.' })
              : t('stockDetail.workspaceNotFound', { symbol: normalizedSymbol })}
          </p>
          <Link to="/watchlist" className="mt-4 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500 hover:text-white">
            {t('stockDetail.backToRadar')}
          </Link>
        </div>
      </div>
    );
  }

  const marketGroups = Array.isArray(overview.market_groups) ? overview.market_groups.slice(0, 2) : [];
  const watchlistMemberships = Array.isArray(overview.watchlist_memberships) ? overview.watchlist_memberships : [];

  return (
    <div className="app-page-shell space-y-4">
      {/* Header Quote Section */}
      <section className="card-section overflow-hidden shadow-[0_18px_60px_rgba(2,6,23,0.45)] border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))]">
        {/* Top bar: breadcrumb + feed status */}
        <div className="border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-label">
              <Link to="/watchlist" className="transition-colors hover:text-slate-300">
                {t('layout.nav.watchlist')}
              </Link>
              <span>/</span>
              <span>{t('stockDetail.stockWorkspace')}</span>
              <span>/</span>
              <span>{overview.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
                {t('stockDetail.feed')} {realtimeStatus === 'live' ? t('stockDetail.statusRealtime') : realtimeStatus === 'polling' ? t('stockDetail.statusFallback') : t('stockDetail.statusConnecting')}
                {lastEventAt ? ` · ${formatDateTime(lastEventAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
              </div>
              <Link
                to={`/whale-alerts/${normalizedSymbol}`}
                className="flex items-center gap-1.5 rounded-full border border-cyan-700/60 bg-cyan-950/30 px-3 py-1.5 text-[11px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/30"
              >
                🦈 {t('stockDetail.whaleDashboard')}
              </Link>
            </div>
          </div>
        </div>

        {/* Quote + key metrics grid */}
        <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(460px,0.95fr)]">
          <div className="space-y-4">
            {/* Symbol + name + exchange */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-2xl font-bold text-cyan-300">
                {overview.symbol}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{overview.company_name || overview.symbol}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                  <span>{overview.exchange || t('stockDetail.unknownExchange')}</span>
                  <span className="text-slate-700">•</span>
                  <span>{overview.industry || t('stockDetail.unknownIndustry')}</span>
                  {overview.listed_date ? (
                    <>
                      <span className="text-slate-700">•</span>
                      <span>{t('stockDetail.listedDate', { date: overview.listed_date })}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Current price + change */}
            <div>
              <p className="text-label">{t('stockDetail.currentPrice')}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t('stockDetail.priceUnitHint')}</p>
              <div className="mt-1 flex flex-wrap items-end gap-4">
                <span className="text-5xl font-semibold leading-none text-white">{formatQuotePrice(currentPrice)}</span>
                <span className={`pb-1 text-lg font-semibold ${changeClass}`}>
                  {changeValue > 0 ? '+' : ''}
                  {changeValue !== null && changeValue !== undefined ? formatQuotePrice(Math.abs(changeValue)) : '—'}
                  {' · '}
                  {formatPercent(changePct)}
                </span>
              </div>
            </div>

            {/* Quick tags: shortlist, groups */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${overview.is_tracked ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-900/70 text-slate-400'}`}>
                {overview.is_tracked ? t('stockDetail.trackingRealtime') : t('stockDetail.notTrackingRealtime')}
              </span>
              {marketGroups.map((groupName) => (
                <span key={groupName} className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">
                  {groupName}
                </span>
              ))}
            </div>
          </div>

          {/* Key metrics grid on the right */}
          <div className="rounded-[20px] border border-slate-800 bg-black/30 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.refCeilFloor')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(referencePrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{formatQuotePrice(ceilingPrice)} / {formatQuotePrice(floorPrice)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.dayRange')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(liveLowPrice)} → {formatQuotePrice(liveHighPrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{t('stockDetail.quantityShort')}: {fmtVol(liveVolume)}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.range52w')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(finiteNumberOrNull(overview.week52_low))}</p>
                <p className="mt-1 text-[10px] text-slate-500">→ {formatQuotePrice(finiteNumberOrNull(overview.week52_high))}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.average')}</p>
                <p className="mt-1 text-sm font-medium text-slate-100">{formatQuotePrice(averagePrice)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{t('stockDetail.averageHint')}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.bias')}</p>
                <p className={`mt-1 text-sm font-medium ${technicalBias.className.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{technicalBias.label}</p>
              </div>
              <div className="card-compact">
                <p className="text-label">{t('stockDetail.thisWindow')}</p>
                <p className={`mt-1 text-sm font-medium ${chartPerformance !== null && chartPerformance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {chartPerformance !== null ? `${chartPerformance >= 0 ? '+' : ''}${chartPerformance.toFixed(2)}%` : '—'}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">{chartWindowHint}</p>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-slate-400">{technicalBias.description}</p>
          </div>
        </div>

        {/* Action bar: shortlist / watchlist / alert */}
        <div className="border-t border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap items-stretch gap-1.5">
            <button
              onClick={handleToggleTracked}
              disabled={!!actionLoading}
              className={`btn-${overview.is_tracked ? 'secondary' : 'primary'} shrink-0 whitespace-nowrap px-4 py-2 ${!!actionLoading ? 'opacity-50' : ''}`}
            >
              {actionLoading === 'tracked' ? t('stockDetail.updating') : overview.is_tracked ? t('stockDetail.untrack') : t('stockDetail.trackRealtime')}
            </button>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5 lg:w-auto lg:min-w-[250px]">
              <select
                value={selectedWatchlistGroupId}
                onChange={(event) => setSelectedWatchlistGroupId(event.target.value)}
                className="min-w-[100px] flex-1 bg-transparent px-2 py-1 text-sm text-slate-200 outline-none"
              >
                {availableWatchlistGroups.length === 0 ? (
                  <option value="">{t('stockDetail.noMoreWatchlist')}</option>
                ) : availableWatchlistGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddToWatchlist}
                disabled={!!actionLoading || availableWatchlistGroups.length === 0}
                className={`btn-accent shrink-0 whitespace-nowrap px-4 py-2 ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'watchlist-add' ? t('stockDetail.saving') : t('stockDetail.saveToGroup')}
              </button>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/75 px-2 py-1.5 lg:w-auto lg:min-w-[250px]">
              <input
                value={alertTargetPrice}
                onChange={(event) => setAlertTargetPrice(event.target.value)}
                placeholder={t('stockDetail.alertPriceLevel')}
                className="w-[104px] min-w-[104px] bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <button
                onClick={handleCreateAlert}
                disabled={!!actionLoading}
                className={`btn-success shrink-0 whitespace-nowrap px-4 py-2 ${!!actionLoading ? 'opacity-50' : ''}`}
              >
                {actionLoading === 'alert' ? t('stockDetail.creating') : t('stockDetail.createAlert')}
              </button>
            </div>

            <div className="ml-auto w-full lg:w-auto lg:min-w-[300px] grid grid-cols-2 gap-1.5 rounded-xl border border-slate-700 bg-slate-950/75 px-2.5 py-1.5 text-[11px]">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1">
                <p className="text-label">{t('stockDetail.shortlist')}</p>
                <p className={`mt-0.5 font-medium ${overview.is_tracked ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {overview.is_tracked ? t('stockDetail.tracked') : t('stockDetail.notTracked')}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1">
                <p className="text-label">{t('stockDetail.groupList', { count: watchlistMemberships.length })}</p>
                {watchlistMemberships.length > 0 ? (
                  <p className="mt-0.5 text-amber-300 truncate" title={watchlistMemberships.map((item) => item.group_name).join(', ')}>
                    {watchlistMemberships.map((item) => item.group_name).join(', ')}
                  </p>
                ) : (
                  <p className="mt-0.5 text-slate-500">{t('stockDetail.noneYet')}</p>
                )}
              </div>
            </div>
          </div>

          {workspaceMessage ? <p className="mt-2 text-sm text-emerald-300">{workspaceMessage}</p> : null}
          {workspaceError ? <p className="mt-2 text-sm text-rose-300">{workspaceError}</p> : null}
        </div>
      </section>

      {/* Main content: chart + panels — 3-column weighted grid like Whale Dashboard */}
      <div className="page-body-grid page-body-grid--auto-height">
        {/* 2 cột trái: Kline chart + order flow radar + insights */}
        <div className="page-body-grid__main flex flex-col gap-4">
          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">{t('stockDetail.klineWorkspace')}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('stockDetail.candlestickFor', { symbol: normalizedSymbol })}</h2>
                {selectedSessionMaterialization ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em] ${selectedSessionReadPath === 'facts_first'
                        ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                        : 'border-amber-500/40 bg-amber-950/40 text-amber-200'}`}
                    >
                      {selectedSessionReadPath === 'facts_first'
                        ? t('stockDetail.selectedSessionFactsFirst', { defaultValue: 'Phiên facts-first' })
                        : t('stockDetail.selectedSessionRawFallback', { defaultValue: 'Phiên raw fallback' })}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">
                      {t('stockDetail.selectedSessionSummaryState', { defaultValue: 'Trạng thái phiên' })}: {selectedSessionMaterialization.session_summary_state || '—'}
                    </span>
                  </div>
                ) : null}
              </div>
              <div />
            </div>

            <div className="mt-3 h-[520px]">
              {loadingChart ? (
                <div className="h-full animate-pulse rounded-2xl bg-slate-900" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
                  {t('stockDetail.noChartData')}
                </div>
              ) : (
                <KLineChartComponent
                  data={chartData}
                  activePeriod={activePeriod}
                  activeTimeframe={activeTimeframe}
                  onPeriodChange={setActivePeriod}
                  onTimeframeChange={({ timeframe, days }) => {
                    setSelectedKlineSession(null);
                    setActiveTimeframe(timeframe);
                    if (Number.isFinite(days)) {
                      setActivePeriod(days);
                    }
                  }}
                  onVisibleRangeChange={setChartVisibleRange}
                  onActiveIndicatorsChange={setChartActiveIndicators}
                  onSessionChange={(session) => {
                    setSelectedKlineSession(session ? { ...session, symbol: normalizedSymbol } : null);
                  }}
                  flowData={whaleAnalyticsData?.flow || null}
                  whaleSignals={whaleSignalsForChart}
                />
              )}
            </div>
          </section>

          <OrderFlowRadarPanel
            symbol={normalizedSymbol}
            loading={orderFlowLoading}
            orderFlowData={orderFlowData}
            latestRealtimeAlert={symbolDarkFlowAlert}
            window={orderFlowWindow}
            onWindowChange={setOrderFlowWindow}
          />

          <section className="card-section p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-label">
                  {activeInsightTab === 'advisory'
                    ? t('stockDetail.advisorySession')
                    : activeInsightTab === 'advanced'
                      ? t('stockDetail.advancedTab')
                      : t('stockNews.sectionLabel')}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {activeInsightTab === 'advisory'
                    ? t('stockDetail.aiAdvisoryFor', { symbol: normalizedSymbol })
                    : activeInsightTab === 'advanced'
                      ? `${t('stockDetail.advancedTab')} ${normalizedSymbol}`
                      : `${t('stockNews.sectionLabel')} ${normalizedSymbol}`}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInsightTab('advisory')}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    activeInsightTab === 'advisory'
                      ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {t('stockDetail.advisorySession')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInsightTab('news')}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    activeInsightTab === 'news'
                      ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {t('stockNews.sectionLabel')}
                </button>
                {canViewAdvancedTab ? (
                  <button
                    type="button"
                    onClick={() => setActiveInsightTab('advanced')}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      activeInsightTab === 'advanced'
                        ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t('stockDetail.advancedTab')}
                  </button>
                ) : null}
                {activeInsightTab === 'advisory' ? (
                  <button
                    type="button"
                    onClick={() => setAdvisoryPromptConfigShowSettings(true)}
                    className="rounded-full border border-blue-700/60 bg-blue-500/10 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/20"
                    title="AI Advisory Settings"
                  >
                    ⚙️ {t('stockDetail.settings')}
                  </button>
                ) : null}
                {activeInsightTab === 'advisory' && advisoryChartContextState.used !== null ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      advisoryChartContextState.used
                        ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                        : 'border-amber-700 bg-amber-950/40 text-amber-300'
                    }`}
                  >
                    {advisoryChartContextState.used ? 'Chart context: used' : 'Chart context: fallback'}
                  </span>
                ) : null}
              </div>
            </div>

            {activeInsightTab === 'advisory' ? (
              <div className="mt-3 space-y-3">
              {advisoryLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-900" />
              ) : advisorySession ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest">
                      {advisoryUserProvider || advisorySession.ai_provider || 'openclaw'}
                    </span>
                    {advisorySession.severity && advisorySession.severity !== 'info' ? (
                      <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ${
                        advisorySession.severity === 'urgent'
                          ? 'border border-rose-700/70 bg-rose-500/10 text-rose-300'
                          : 'border border-amber-700/70 bg-amber-500/10 text-amber-300'
                      }`}>
                        {advisorySession.severity === 'urgent'
                          ? t('stockDetail.severityUrgent')
                          : t('stockDetail.severityWarning')}
                      </span>
                    ) : null}
                    {advisorySession.advisory_type === 'reversal' ? (
                      <span className="rounded-full border border-fuchsia-700/70 bg-fuchsia-500/10 px-2 py-0.5 font-semibold uppercase text-fuchsia-300">
                        {t('stockDetail.advisoryTypeReversal')}
                      </span>
                    ) : null}
                    <span>
                      {advisorySession.created_at ? new Date(advisorySession.created_at).toLocaleString(undefined) : '—'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{t('stockDetail.summaryInfo')}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {t('stockDetail.currentMode')}: {advisorySynthesisPreferenceLabel(advisorySynthesisPreference, t)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={advisorySynthesisPreference}
                          onChange={(e) => setAdvisorySynthesisPreference(e.target.value)}
                          disabled={advisoryRegeneratingSummary}
                          className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 outline-none hover:border-slate-500"
                        >
                          <option value="short_term_action">{t('stockDetail.preferenceShortTerm')}</option>
                          <option value="risk_management">{t('stockDetail.preferenceRisk')}</option>
                          <option value="balanced">{t('stockDetail.preferenceBalanced')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleRegenerateExecutiveSummary}
                          disabled={advisoryRegeneratingSummary}
                          className="btn-secondary"
                        >
                          {advisoryRegeneratingSummary ? t('stockDetail.summarizing') : t('stockDetail.regenerateSummary')}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteExecutiveSummary}
                          disabled={advisoryDeletingSummary || !advisoryExecutiveSummary}
                          className="rounded-full border border-rose-700/60 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                        >
                          {advisoryDeletingSummary ? 'Đang xóa...' : t('stockDetail.deleteExecutiveSummary')}
                        </button>
                      </div>
                    </div>
                    {advisoryExecutiveSummary ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-cyan-700/70 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                            {advisoryExecutiveSummary.strategy_action}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-slate-300">
                            {t('stockDetail.riskLevel')}: {advisoryRiskLabel(advisoryExecutiveSummary.risk_level, t)}
                          </span>
                          <span className="rounded-full border border-amber-700/70 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                            {t('stockDetail.confidence')}: {advisoryExecutiveSummary.overall_confidence}/10
                          </span>
                          <span className="text-slate-500">v{advisoryExecutiveSummary.summary_version}</span>
                        </div>
                        {/* Display enabled sources for this summary */}
                        {advisoryPromptConfig && (
                          <div className="mt-2">
                            <p className="mb-1 text-[11px] text-slate-500">
                              {t('stockDetail.enabledSourcesForSummary')}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(advisoryPromptConfig.sources)
                              .filter(([_, cfg]) => cfg.enabled)
                              .map(([sourceId]) => (
                                <span
                                  key={sourceId}
                                  className="rounded-full border border-emerald-700/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300"
                                >
                                  ✓ {advisoryPromptSourceLabel(sourceId, t)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {advisoryExecutiveSummaries.length > 1 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {advisoryExecutiveSummaries.map((summaryItem) => (
                              <button
                                key={summaryItem.id}
                                type="button"
                                onClick={() => setAdvisoryExecutiveSummary(summaryItem)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                  advisoryExecutiveSummary?.id === summaryItem.id
                                    ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                v{summaryItem.summary_version}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 max-h-56 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
                          <p className="text-sm leading-6 whitespace-pre-line text-slate-200">
                            {advisoryExecutiveSummary.synthesis_text || t('stockDetail.noSummaryContent')}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">
                            {t('stockDetail.summaryUsesTabs', { count: Array.isArray(advisoryExecutiveSummary.used_component_ids) ? advisoryExecutiveSummary.used_component_ids.length : 0 })}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">{t('stockDetail.noExecutiveSummary')}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  {t('stockDetail.aiGeneratingWait')}
                </p>
              )}

              {advisoryMessage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-cyan-300">{advisoryMessage}</p>
                  {advisorySessionConflict ? (
                    <button
                      type="button"
                      onClick={() => fetchAdvisorySession({ silent: false })}
                      className="rounded-full border border-cyan-700/60 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                    >
                      {t('stockDetail.retryAiAdvisory')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {advisoryChartContextState.warnings.length > 0 ? (
                <p className="text-xs text-amber-300">Chart context warnings: {advisoryChartContextState.warnings.join(', ')}</p>
              ) : null}
              </div>
            ) : activeInsightTab === 'advanced' && canViewAdvancedTab ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">H3 observability</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{t('stockDetail.retryWindowHours')}</span>
                      <select
                        value={advisoryObservabilityWindowHours}
                        onChange={(e) => setAdvisoryObservabilityWindowHours(Number(e.target.value) || 48)}
                        className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 outline-none hover:border-slate-500"
                      >
                        <option value={24}>24h</option>
                        <option value={48}>48h</option>
                        <option value={72}>72h</option>
                        <option value={168}>7d</option>
                      </select>
                      {advisoryObservabilityLoading ? (
                        <span className="text-[11px] text-slate-500">Refreshing...</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Severity drift</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {advisoryAggregate?.observability?.severity_drift_24h?.label || advisoryObservability?.summary?.severity_drift_label || 'stable'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Delta: {advisoryAggregate?.observability?.severity_drift_24h?.delta ?? advisoryObservability?.summary?.severity_delta ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Aggregate quality</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-300">
                        {advisoryAggregate?.observability?.aggregate_quality?.score ?? advisoryObservability?.summary?.avg_aggregate_quality_score ?? '—'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {advisoryAggregate?.observability?.aggregate_quality?.label || 'n/a'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Decision score</p>
                      <p className="mt-1 text-sm font-semibold text-amber-300">{advisoryAggregate?.decision?.score ?? '—'}</p>
                      <p className="text-[11px] text-slate-500">{advisoryAggregate?.decision?.score_band || 'n/a'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{t('stockDetail.advisoryRetryTelemetry')}</p>
                      <p className="mt-1 text-sm font-semibold text-violet-300">
                        {t('stockDetail.retryScheduledCount')}: {advisoryObservability?.summary?.retry_scheduled_total ?? advisoryRetryTelemetry.scheduledCount}
                      </p>
                      <p className="text-[11px] text-emerald-300">
                        {t('stockDetail.retryRecoveredCount')}: {advisoryObservability?.summary?.retry_recovered_total ?? advisoryRetryTelemetry.recoveredCount}
                      </p>
                      <p className="text-[11px] text-rose-300">
                        {t('stockDetail.retryFailedCount')}: {advisoryObservability?.summary?.retry_failed_total ?? advisoryRetryTelemetry.failedCount}
                      </p>
                    </div>
                  </div>

                  {Array.isArray(advisoryObservability?.timeline) && advisoryObservability.timeline.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/30 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Timeline (latest)</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {advisoryObservability.timeline.slice(0, 5).map((row) => (
                          <span key={row.advisory_id} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300">
                            #{row.advisory_id} {row.severity} q={row.aggregate_quality?.score}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <StockNewsPanel symbol={normalizedSymbol} />
              </div>
            )}
          </section>

        </div>
        {/* Right side-bar — same column ratio as Whale Alerts Dashboard */}
        <div className="page-body-grid__side flex flex-col gap-4">
          <IntradayMatchedPanel symbol={normalizedSymbol} liveVolume={liveVolume} />
          <PriceDepthPanel symbol={normalizedSymbol} liveVolume={liveVolume} />
          <MoneyFlowDonut summary={whaleFeedData?.summary} loading={whaleFeedLoading} compact />
          <BubbleOrderChart orders={whaleFeedData?.whale_orders} loading={whaleFeedLoading} />
        </div>
        {/* Cảnh báo giá - toàn chiều rộng */}
        {symbolAlerts.length > 0 && (
          <div className="xl:col-span-3">
            <section className="card-section p-4">
              <p className="text-label pb-2.5 border-b border-slate-800">{t('stockDetail.priceAlertsCount', { count: symbolAlerts.length })}</p>
              <div className="mt-3 space-y-2.5">
                {symbolAlerts.map((alert, idx) => (
                  <div key={`${alert.symbol}-${alert.ts}-${idx}`} className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-rose-400 mb-1">🔔 {t('stockDetail.priceAlert')}</p>
                    <p className="text-sm font-semibold text-rose-200">
                      {alert.condition === 'ABOVE' ? `▲ ${t('stockDetail.above')}` : `▼ ${t('stockDetail.below')}`}{' '}
                      {alert.target_price
                        ? formatQuotePrice(alert.target_price)
                        : formatQuotePrice(alert.price)}
                    </p>
                    {alert.ts && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatDateTime(alert.ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
      {/* Panel tài chính */}
      <FinancialMetricsPanel
        financials={financials}
        loading={financialsLoading}
        selectedYear={financialsYear}
        onYearChange={setFinancialsYear}
      />
      {/* AI Advisory Prompt Config Settings Drawer */}
      <AIAdvisoryPromptConfigDrawer
        isOpen={advisoryPromptConfigShowSettings}
        onClose={() => setAdvisoryPromptConfigShowSettings(false)}
        config={advisoryPromptConfig}
        onConfigChange={setAdvisoryPromptConfig}
      />
    </div>
  );
}
