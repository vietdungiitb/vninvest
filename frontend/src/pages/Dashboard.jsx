/**
 * pages/Dashboard.jsx
 * Trang chính: StatCards + HoldingsTable + (Charts ở Bước 5).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { getSummary, getHoldings, syncPrices, getTrackedSymbols } from '../api/client';
import StatCard from '../components/StatCard';
import HoldingsTable from '../components/HoldingsTable';
import PortfolioLineChart from '../components/PortfolioLineChart';
import AllocationPieChart from '../components/AllocationPieChart';
import DashboardRealtimePanel from '../components/DashboardRealtimePanel';
import PortfolioAnalyticsPanel from '../components/PortfolioAnalyticsPanel';
import EquityVsBenchmarkChart from '../components/EquityVsBenchmarkChart';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import {
  buildLiveHoldingsOverlay,
  buildLiveSummaryFromHoldings,
} from '../utils/dashboardRealtimeSelectors';

export default function Dashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t, formatDateTime } = useI18n();

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const holdingSymbols = useMemo(
    () => holdings.map((item) => item.symbol).filter(Boolean),
    [holdings],
  );
  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((item) => item.symbol).filter(Boolean),
    [trackedSymbols],
  );
  const monitoredSymbols = useMemo(
    () => [...new Set([...holdingSymbols, ...trackedSymbolNames])],
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
  const realtimeMarketBreadth = useMemo(() => {
    return monitoredQuotes.reduce((acc, item) => {
      if ((item.change_pct ?? 0) > 0) {
        acc.up += 1;
      } else if ((item.change_pct ?? 0) < 0) {
        acc.down += 1;
      } else {
        acc.flat += 1;
      }
      return acc;
    }, { up: 0, down: 0, flat: 0 });
  }, [monitoredQuotes]);

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
    if (!activePortfolioId) return;
    setLoadingSummary(true);
    setLoadingHoldings(true);

    try {
      const [sumRes, holdRes] = await Promise.all([
        getSummary(activePortfolioId),
        getHoldings(activePortfolioId),
      ]);
      setSummary(sumRes.data);
      setHoldings(holdRes.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoadingSummary(false);
      setLoadingHoldings(false);
    }
  }, [activePortfolioId]);

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
      .then((res) => { if (!cancelled) setTrackedSymbols(res.data || []); })
      .catch(() => {});
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">
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
            className={`flex items-center gap-1.5 disabled:opacity-50
                       border text-sm px-4 py-2 rounded-lg transition-colors
                       ${realtimeStatus === 'live'
                         ? 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-800 text-emerald-300'
                         : realtimeStatus === 'idle'
                           ? 'bg-gray-800 hover:bg-gray-700 border-amber-700 text-amber-300'
                           : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
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
                {realtimeStatus === 'live' && <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
                {realtimeStatus === 'idle' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                {syncButtonLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.marketValue')}
          value={marketValue}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.unrealizedPL')}
          value={unrealizedPLValue}
          sub={summary ? `${parseFloat(unrealizedPLPctValue || 0).toFixed(2)}%` : null}
          isPositive={unrealizedPL > 0}
          isNegative={unrealizedPL < 0}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.realizedPL')}
          value={summary?.total_realized_pl}
          isPositive={realizedPL > 0}
          isNegative={realizedPL < 0}
          loading={loadingSummary}
          showInteger={true}
        />
        <StatCard
          label={t('dashboard.dividends')}
          value={summary?.total_dividends}
          loading={loadingSummary}
          showInteger={true}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr_0.8fr_1fr_0.8fr_1fr] gap-3">
        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-blue-300">{t('dashboardRealtime.liveValue')}</p>
          <p className="text-xl font-bold text-gray-100 mt-1">{Math.round(Number(liveSummary.totalMarketValue || 0)).toLocaleString('vi-VN')}</p>
          <p className="text-[11px] text-gray-500 mt-1">{t('dashboardRealtime.liveValueHint')}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.liveUnrealized')}</p>
          <p className={`text-xl font-bold mt-1 ${Number(liveSummary.totalUnrealizedPL || 0) > 0 ? 'text-emerald-300' : Number(liveSummary.totalUnrealizedPL || 0) < 0 ? 'text-red-300' : 'text-gray-100'}`}>
            {Math.round(Number(liveSummary.totalUnrealizedPL || 0)).toLocaleString('vi-VN')}
          </p>
          <p className={`text-[11px] mt-1 ${Number(liveSummary.totalUnrealizedPL || 0) > 0 ? 'text-emerald-300' : Number(liveSummary.totalUnrealizedPL || 0) < 0 ? 'text-red-300' : 'text-gray-500'}`}>
            {Number(liveSummary.totalUnrealizedPLPct || 0) > 0 ? '+' : ''}{Number(liveSummary.totalUnrealizedPLPct || 0).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.monitoredSymbols')}</p>
          <p className="text-xl font-bold text-gray-100 mt-1">{monitoredSymbols.length}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.deltaVsSnapshot')}</p>
          <p className={`text-xl font-bold mt-1 ${realtimeDeltaVsSnapshot > 0 ? 'text-emerald-300' : realtimeDeltaVsSnapshot < 0 ? 'text-red-300' : 'text-gray-100'}`}>
            {Math.round(realtimeDeltaVsSnapshot).toLocaleString('vi-VN')}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">{t('dashboardRealtime.deltaVsSnapshotHint')}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.stale')}</p>
          <p className={`text-xl font-bold mt-1 ${realtimeStalePositions > 0 ? 'text-amber-300' : 'text-gray-100'}`}>
            {realtimeStalePositions}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">{t('dashboardRealtime.staleHint')}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">{t('dashboardRealtime.upDownFlat')}</p>
          <p className="text-lg font-bold text-gray-100 mt-1">
            {realtimeMarketBreadth.up} / {realtimeMarketBreadth.down} / {realtimeMarketBreadth.flat}
          </p>
        </div>
      </div>

      <DashboardRealtimePanel
        holdings={liveHoldings}
        trackedSymbolNames={trackedSymbolNames}
        quotesBySymbol={quotesBySymbol}
        realtimeStatus={realtimeStatus}
        lastEventAt={lastEventAt}
        alerts={alerts}
        darkFlowAlerts={darkFlowAlerts}
        metrics={metrics}
        monitoredSymbols={monitoredSymbols}
        enableSnapshot={isAuthenticated && Boolean(activePortfolioId)}
        onSyncRequest={handleSync}
        showSummaryMetrics={false}
        portfolioId={activePortfolioId}
      />

      {/* Charts */}
      <div className="space-y-4">
        <div>
          <EquityVsBenchmarkChart portfolioId={activePortfolioId} />
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          {t('dashboard.holdings')}
        </h2>
        <HoldingsTable holdings={liveHoldings} loading={loadingHoldings} />
      </div>

      {/* Risk & Performance Analytics */}
      <PortfolioAnalyticsPanel portfolioId={activePortfolioId} />
    </div>
  );
}
