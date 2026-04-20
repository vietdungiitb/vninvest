/**
 * pages/Dashboard.jsx
 * Trang chính: StatCards + HoldingsTable + (Charts ở Bước 5).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import {
  getSummary,
  getHoldings,
  syncPrices,
  getTrackedSymbols,
  getIntradayMatched,
} from '../api/client';
import StatCard from '../components/StatCard';
import HoldingsTable from '../components/HoldingsTable';
import AllocationPieChart from '../components/AllocationPieChart';
import PortfolioAnalyticsPanel from '../components/PortfolioAnalyticsPanel';
import EquityVsBenchmarkChart from '../components/EquityVsBenchmarkChart';
import PortfolioDigestPanel from '../components/PortfolioDigestPanel';
import UnifiedAlertBar from '../components/UnifiedAlertBar';
import UnifiedAlertCenter from '../components/UnifiedAlertCenter';
import PortfolioHeatmap from '../components/PortfolioHeatmap';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import useUnifiedAlerts from '../hooks/useUnifiedAlerts';
import usePersistentAlertState from '../hooks/usePersistentAlertState';
import {
  buildLiveHoldingsOverlay,
  buildLiveSummaryFromHoldings,
} from '../utils/dashboardRealtimeSelectors';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export default function Dashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t, formatDateTime } = useI18n();

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [holdingsReady, setHoldingsReady] = useState(false);
  const [trackedSymbolsReady, setTrackedSymbolsReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [unifiedPageSize, setUnifiedPageSize] = useState(5);
  const [heatmapSparklineBySymbol, setHeatmapSparklineBySymbol] = useState({});

  const holdingSymbols = useMemo(
    () => holdings.map((item) => normalizeSymbol(item.symbol)).filter(Boolean),
    [holdings],
  );
  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((item) => normalizeSymbol(item.symbol)).filter(Boolean),
    [trackedSymbols],
  );
  const monitoredSymbols = useMemo(
    () => [...new Set([...holdingSymbols, ...trackedSymbolNames].map((symbol) => normalizeSymbol(symbol)).filter(Boolean))],
    [holdingSymbols, trackedSymbolNames],
  );

  const {
    quotesBySymbol,
    realtimeStatus,
    lastEventAt,
    alerts,
    darkFlowAlerts,
    metrics,
  } = useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 20 });

  const {
    readAlertIds,
    criticalSoundEnabled,
    markAlertAsRead,
    isMutedSymbol,
    muteSymbolFor30m,
    toggleCriticalSound,
  } = usePersistentAlertState();

  const {
    filteredUnifiedAlerts,
    alertSummary,
    currentUnifiedPage,
    hasPreviousUnifiedPage,
    backendUnifiedHasMore,
    loadingMoreUnified,
    goToFirstUnifiedPage,
    goToPreviousUnifiedPage,
    goToNextUnifiedPage,
  } = useUnifiedAlerts({
    alerts,
    darkFlowAlerts,
    monitoredSymbols,
    quotesBySymbol,
    holdings,
    trackedSymbolNames,
    enableSnapshot: isAuthenticated && Boolean(activePortfolioId),
    lastEventAt,
    sourceFilter,
    severityFilter,
    audienceFilter,
    pageSize: unifiedPageSize,
    isMutedSymbol,
    formatNumber: (value) => Number(value || 0).toLocaleString('vi-VN'),
    t,
  });

  const unreadUnifiedCount = useMemo(
    () => filteredUnifiedAlerts.filter((item) => !readAlertIds.has(item.id)).length,
    [filteredUnifiedAlerts, readAlertIds],
  );

  const monitoredQuotes = useMemo(
    () => monitoredSymbols.map((symbol) => quotesBySymbol[symbol] || { symbol }),
    [monitoredSymbols, quotesBySymbol],
  );

  const liveHoldings = buildLiveHoldingsOverlay(holdings, quotesBySymbol);
  const liveSummary = buildLiveSummaryFromHoldings(liveHoldings);
  const snapshotMarketValue = useMemo(
    () => holdings.reduce((total, item) => total + Number(item?.market_value || 0), 0),
    [holdings],
  );
  const realtimeStalePositions = useMemo(
    () => liveHoldings.reduce((total, item) => {
      const quote = quotesBySymbol[item.symbol] || {};
      return total + ((item.live_is_stale || quote.stale) ? 1 : 0);
    }, 0),
    [liveHoldings, quotesBySymbol],
  );
  const realtimeDeltaVsSnapshot = useMemo(
    () => Number(liveSummary.totalMarketValue || 0) - snapshotMarketValue,
    [liveSummary.totalMarketValue, snapshotMarketValue],
  );
  const heatmapData = useMemo(() => {
    if (!monitoredSymbols.length) {
      return [];
    }

    const holdingsMap = new Map();
    liveHoldings.forEach((h) => holdingsMap.set(normalizeSymbol(h.symbol), h));

    const trackedSymbolMap = new Map();
    trackedSymbols.forEach((item) => trackedSymbolMap.set(normalizeSymbol(item.symbol), item));

    const totalHeldValue = liveHoldings.reduce(
      (sum, h) => sum + Number(h.live_market_value || h.market_value || 0),
      0,
    );
    const avgPositionSize = liveHoldings.length > 0 ? totalHeldValue / liveHoldings.length : 10000;
    const nominalSize = Math.max(avgPositionSize * 0.4, 2000);

    const buildFallbackSparkline = (quote, held) => {
      const current = Number(quote?.current_price || held?.live_current_price || held?.current_price || 0);
      const prev = Number(quote?.prev_price || held?.prev_close || current || 0);
      if (!(current > 0) || !(prev > 0)) {
        return [];
      }
      const delta = current - prev;
      const base = prev;
      return [
        base,
        base + (delta * 0.12),
        base + (delta * 0.28),
        base + (delta * 0.22),
        base + (delta * 0.41),
        base + (delta * 0.58),
        base + (delta * 0.76),
        current,
      ].map((value) => Number(value.toFixed(2)));
    };

    return monitoredSymbols.map((symbol) => {
      const held = holdingsMap.get(symbol);
      const quote = quotesBySymbol[symbol] || {};
      const changePct = quote.change_pct ?? held?.live_change_pct ?? 0;
      const sparkline24 = heatmapSparklineBySymbol[symbol] || buildFallbackSparkline(quote, held);

      const trackedInfo = trackedSymbolMap.get(symbol);
      const industryRaw = String(held?.industry || trackedInfo?.industry || 'Khác').trim();
      const industry = industryRaw || 'Khác';

      if (held) {
        return {
          ...held,
          symbol,
          industry,
          company_name: held.company_name || held.name || symbol,
          market_cap_bn: held.market_cap_bn ?? trackedInfo?.market_cap_bn ?? null,
          live_current_price: Number(quote.current_price || held.live_current_price || held.current_price || 0),
          live_market_cap: Number(quote.market_cap || held.live_market_cap || held.market_cap || 0),
          live_volume: Number(quote.volume || held.live_volume || held.volume || 0),
          live_market_value: Number(held.live_market_value || held.market_value || 0),
          live_change_pct: changePct,
          sparkline24,
          is_holding: true,
        };
      }
      // Dùng market_cap từ live quote làm proxy hiển thị kích thước trong treemap;
      // fallback về nominalSize nếu chưa có dữ liệu realtime.
      const trackedDisplaySize = Number(quote.market_cap || 0) || nominalSize;
      return {
        symbol,
        industry,
        company_name: trackedInfo?.name || trackedInfo?.company_name || symbol,
        market_cap_bn: trackedInfo?.market_cap_bn ?? null,
        live_current_price: Number(quote.current_price || 0),
        live_market_cap: Number(quote.market_cap || 0),
        live_volume: Number(quote.volume || 0),
        live_market_value: trackedDisplaySize,
        live_change_pct: changePct,
        sparkline24,
        is_holding: false,
      };
    });
  }, [heatmapSparklineBySymbol, liveHoldings, monitoredSymbols, quotesBySymbol, trackedSymbols]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateHeatmapSparkline() {
      if (!isAuthenticated || !activePortfolioId || monitoredSymbols.length === 0) {
        if (!cancelled) {
          setHeatmapSparklineBySymbol({});
        }
        return;
      }

      const tasks = monitoredSymbols.map(async (symbol) => {
        try {
          const resp = await getIntradayMatched(symbol, 24);
          const payload = resp?.data || {};
          const trades = Array.isArray(payload?.trades) ? payload.trades : [];
          const points = trades
            .map((trade) => Number(trade?.price ?? trade?.matched_price ?? trade?.current_price ?? 0))
            .filter((value) => Number.isFinite(value) && value > 0)
            .slice(-24);
          return [symbol, points];
        } catch {
          return [symbol, []];
        }
      });

      const settled = await Promise.allSettled(tasks);
      if (cancelled) return;

      const next = {};
      settled.forEach((result) => {
        if (result.status !== 'fulfilled') return;
        const [symbol, points] = result.value;
        if (Array.isArray(points) && points.length > 1) {
          next[symbol] = points;
        }
      });
      setHeatmapSparklineBySymbol(next);
    }

    hydrateHeatmapSparkline();
    return () => {
      cancelled = true;
    };
  }, [activePortfolioId, isAuthenticated, monitoredSymbols]);

  const realtimeMarketBreadth = useMemo(() => {
    return monitoredQuotes.reduce((acc, item) => {
      const changePct = item.change_pct ?? 0;
      if (changePct > 0) {
        acc.up += 1;
      } else if (changePct < 0) {
        acc.down += 1;
      } else {
        acc.flat += 1;
      }
      return acc;
    }, { up: 0, down: 0, flat: 0 });
  }, [monitoredQuotes]);

  const handleSeverityBarFilter = useCallback((targetFilter) => {
    setSeverityFilter((prev) => (prev === targetFilter ? 'all' : targetFilter));
  }, []);

  const marketValue = liveHoldings.length > 0
    ? liveSummary.totalMarketValue
    : summary?.total_market_value;
  const unrealizedPLValue = liveHoldings.length > 0
    ? liveSummary.totalUnrealizedPL
    : summary?.total_unrealized_pl;
  const unrealizedPLPctValue = liveHoldings.length > 0
    ? liveSummary.totalUnrealizedPLPct
    : parseFloat(summary?.total_unrealized_pl_pct ?? 0);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !activePortfolioId) return;
    setLoadingSummary(true);
    setLoadingHoldings(true);

    try {
      const [sumRes, holdRes] = await Promise.all([
        getSummary(activePortfolioId),
        getHoldings(activePortfolioId),
      ]);
      setSummary(sumRes.data);
      setHoldings(holdRes.data);
      setHoldingsReady(true);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoadingSummary(false);
      setLoadingHoldings(false);
    }
  }, [isAuthenticated, activePortfolioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !activePortfolioId) {
      setTrackedSymbols([]);
      return () => { cancelled = true; };
    }
    getTrackedSymbols()
      .then((res) => { if (!cancelled) { setTrackedSymbols(res.data || []); setTrackedSymbolsReady(true); } })
      .catch(() => { if (!cancelled) setTrackedSymbolsReady(true); });
    return () => { cancelled = true; };
  }, [isAuthenticated, activePortfolioId]);

  const handleSync = async () => {
    if (!activePortfolioId || syncing) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await syncPrices(activePortfolioId, 30);
      const total = res.data.total_symbols || 0;
      setSyncMsg(t('dashboard.syncSuccess', { total }));
      await fetchData(); // reload sau sync
    } catch {
      setSyncMsg(t('dashboard.syncError'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const syncButtonLabel = syncing
    ? t('dashboard.syncingPrices')
    : realtimeStatus === 'live'
      ? t('dashboard.syncPricesLive', { defaultValue: t('dashboard.syncPrices') })
      : realtimeStatus === 'idle'
        ? t('dashboard.syncPricesIdle', { defaultValue: t('dashboard.syncPrices') })
        : t('dashboard.syncPrices');

  const unrealizedPL = parseFloat(unrealizedPLValue ?? 0);
  const realizedPL = parseFloat(summary?.total_realized_pl ?? 0);

  if (!activePortfolioId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
        <div className="text-5xl">📁</div>
        <div>
          <h2 className="text-xl font-bold text-gray-100 mb-2">{t('dashboard.emptyTitle')}</h2>
          <p className="text-sm text-gray-400 max-w-md">{t('dashboard.noPortfolio')}</p>
        </div>
        <Link
          to="/portfolios"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('dashboard.createPortfolioCta')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 xl:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">
            {summary?.portfolio_name ?? t('common.loading')}
          </h1>
          {summary?.last_updated && (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('dashboard.lastUpdated', { value: formatDateTime(summary.last_updated) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && (
            <span className="text-xs text-brand-500">{syncMsg}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`btn-pill flex items-center gap-1.5 disabled:opacity-50
                       ${realtimeStatus === 'live'
                         ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-700 text-emerald-300'
                         : realtimeStatus === 'idle'
                           ? 'bg-slate-800 hover:bg-slate-700 border-amber-700 text-amber-300'
                           : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                       }`}
          >
            {syncing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-brand-500
                                 rounded-full animate-spin inline-block" />
                {t('dashboard.syncingPrices')}
              </>
            ) : (
              <>
                {realtimeStatus === 'live' && <span className="live-dot-pulse w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
                {realtimeStatus === 'idle' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                {syncButtonLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.marketValue')}
          iconKey="marketValue"
          unit={t('dashboard.thousandVndUnitShort')}
          value={marketValue}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.unrealizedPL')}
          iconKey="unrealizedPL"
          unit={t('dashboard.thousandVndUnitShort')}
          value={unrealizedPLValue}
          sub={summary ? `${parseFloat(unrealizedPLPctValue || 0).toFixed(2)}%` : null}
          isPositive={unrealizedPL > 0}
          isNegative={unrealizedPL < 0}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.realizedPL')}
          iconKey="realizedPL"
          unit={t('dashboard.thousandVndUnitShort')}
          value={summary?.total_realized_pl}
          isPositive={realizedPL > 0}
          isNegative={realizedPL < 0}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.dividends')}
          iconKey="dividends"
          unit={t('dashboard.thousandVndUnitShort')}
          value={summary?.total_dividends}
          loading={loadingSummary}
          showInteger={true}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <PortfolioHeatmap
          holdings={(holdingsReady && trackedSymbolsReady) ? heatmapData : []}
          title={t('dashboardRealtime.watchlistHeatmapTitle', { defaultValue: 'Biến động Watchlist & Danh mục' })}
        />
      </div>

      <UnifiedAlertBar
        alertSummary={alertSummary}
        severityFilter={severityFilter}
        onSeverityFilterChange={handleSeverityBarFilter}
        unreadCount={unreadUnifiedCount}
      />

      {/* Unified Dashboard Grid: Main Content (Left 2/3) + Side Panels (Right 1/3) */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        
        {/* Main Column (2/3 width) */}
        <div className="space-y-6 xl:col-span-2">
          <UnifiedAlertCenter
            alerts={filteredUnifiedAlerts}
            readAlertIds={readAlertIds}
            markAlertAsRead={markAlertAsRead}
            muteSymbolFor30m={muteSymbolFor30m}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            criticalSoundEnabled={criticalSoundEnabled}
            toggleCriticalSound={toggleCriticalSound}
            currentUnifiedPage={currentUnifiedPage}
            hasPreviousUnifiedPage={hasPreviousUnifiedPage}
            backendUnifiedHasMore={backendUnifiedHasMore}
            loadingMoreUnified={loadingMoreUnified}
            goToFirstUnifiedPage={goToFirstUnifiedPage}
            goToPreviousUnifiedPage={goToPreviousUnifiedPage}
            goToNextUnifiedPage={goToNextUnifiedPage}
            pageSize={unifiedPageSize}
            setPageSize={setUnifiedPageSize}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            audienceFilter={audienceFilter}
            setAudienceFilter={setAudienceFilter}
            className="w-full"
          />
          
          <PortfolioAnalyticsPanel portfolioId={activePortfolioId} />
        </div>

        {/* Side Column (1/3 width) */}
        <div className="flex flex-col gap-6 xl:col-span-1">
          <AllocationPieChart portfolioId={activePortfolioId} />
          
          <PortfolioDigestPanel />

          <div className="v2-panel-strong rounded-xl p-5 shadow-lg border border-slate-800/50 bg-slate-900/40 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 border-b border-slate-800/60 pb-3 mb-4">
              {t('dashboardRealtime.portfolioStatusTitle')}
            </h3>
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium">{t('dashboardRealtime.monitoredSymbols')}</p>
                <p className="text-lg font-black text-slate-100">{monitoredSymbols.length}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium">{t('dashboardRealtime.upDownFlat')}</p>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-emerald-400">{realtimeMarketBreadth.up}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-rose-400">{realtimeMarketBreadth.down}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-400">{realtimeMarketBreadth.flat}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium">{t('dashboardRealtime.deltaVsSnapshot')}</p>
                <p className={`text-base font-bold ${realtimeDeltaVsSnapshot > 0 ? 'text-emerald-400' : realtimeDeltaVsSnapshot < 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                  {realtimeDeltaVsSnapshot > 0 ? '+' : ''}{Math.round(realtimeDeltaVsSnapshot).toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-slate-500 font-medium">{t('dashboardRealtime.stale')}</p>
                <p className={`text-base font-bold ${realtimeStalePositions > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                  {realtimeStalePositions}
                </p>
              </div>
              <div className="mt-2 pt-3 border-t border-slate-800/60">
                <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  {t('dashboardRealtime.lastEvent', {
                    time: lastEventAt
                      ? formatDateTime(lastEventAt, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                      : '—',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div>
          <EquityVsBenchmarkChart portfolioId={activePortfolioId} />
        </div>
      </div>

      {/* Holdings Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">
          {t('dashboard.holdings')}
        </h2>
        <HoldingsTable holdings={liveHoldings} loading={loadingHoldings} />
      </div>

    </div>
  );
}
