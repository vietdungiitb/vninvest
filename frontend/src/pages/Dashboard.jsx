/**
 * pages/Dashboard.jsx
 * Trang chính: StatCards + HoldingsTable + (Charts ở Bước 5).
 * Refactored to "Command Center" layout with high information density.
 * Production Ready Version.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { getSummary, getHoldings, syncPrices, getTrackedSymbols, getEquityCurve } from '../api/client';
import StatCard from '../components/StatCard';
import HoldingsTable from '../components/HoldingsTable';
import DashboardRealtimePanel from '../components/DashboardRealtimePanel';
import PortfolioAnalyticsPanel from '../components/PortfolioAnalyticsPanel';
import EquityVsBenchmarkChart from '../components/EquityVsBenchmarkChart';
import PortfolioDigestPanel from '../components/PortfolioDigestPanel';
import PortfolioHeatmap from '../components/PortfolioHeatmap';
import AllocationPieChart from '../components/AllocationPieChart';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
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
  const [equityCurve, setEquityCurve] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [loadingEquity, setLoadingEquity] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoadingSummary(false);
      setLoadingHoldings(false);
    }
  }, [isAuthenticated, activePortfolioId]);

  const fetchEquity = useCallback(async () => {
    if (!isAuthenticated || !activePortfolioId) return;
    setLoadingEquity(true);
    try {
      const res = await getEquityCurve(activePortfolioId, 30);
      setEquityCurve(res.data.points || []);
    } catch (err) {
      console.error('Lỗi tải equity curve:', err);
    } finally {
      setLoadingEquity(false);
    }
  }, [isAuthenticated, activePortfolioId]);

  useEffect(() => {
    fetchData();
    fetchEquity();
  }, [fetchData, fetchEquity]);

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

  // Sparkline data for Market Value (NAV)
  const navSparkline = useMemo(() => {
    return equityCurve.map(p => ({ value: p.nav }));
  }, [equityCurve]);

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

  const realtimeAlertsPanel = (
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
  );

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-[1700px] mx-auto min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-xl shadow-lg shadow-brand-600/20">
                💼
             </div>
             <div>
                <h1 className="text-3xl font-black text-white tracking-tight leading-none">
                  {summary?.portfolio_name ?? t('common.loading')}
                </h1>
                {summary?.last_updated && (
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mt-1.5 opacity-80">
                    {t('dashboard.lastUpdated', { value: formatDateTime(summary.last_updated) })}
                  </p>
                )}
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {syncMsg && (
            <div className="bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg">
              <span className="text-[10px] text-brand-400 font-bold uppercase tracking-wider animate-pulse">{syncMsg}</span>
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`group flex items-center gap-3 disabled:opacity-50
                       border text-[11px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all shadow-2xl
                       ${realtimeStatus === 'live'
                         ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5'
                         : realtimeStatus === 'idle'
                           ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5'
                           : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
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
                <div className="relative">
                  {realtimeStatus === 'live' && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                      <span className="relative w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
                    </>
                  )}
                  {realtimeStatus === 'idle' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  )}
                </div>
                {syncButtonLabel}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* MOBILE ONLY: Priority Intelligence Feed */}
        <div className="lg:hidden">
          {realtimeAlertsPanel}
        </div>

        {/* Left/Center Columns: Main Dashboard (3/4 width on desktop) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Row 1: Key Financial Performance Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <StatCard
              label={t('dashboard.marketValue')}
              unit={t('dashboard.thousandVndUnitShort')}
              value={marketValue}
              loading={loadingSummary}
              showInteger={true}
              sparklineData={navSparkline}
            />
            <StatCard
              label={t('dashboard.unrealizedPL')}
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
              unit={t('dashboard.thousandVndUnitShort')}
              value={summary?.total_realized_pl}
              isPositive={realizedPL > 0}
              isNegative={realizedPL < 0}
              loading={loadingSummary}
              showInteger={true}
            />
            <StatCard
              label={t('dashboard.dividends')}
              unit={t('dashboard.thousandVndUnitShort')}
              value={summary?.total_dividends}
              loading={loadingSummary}
              showInteger={true}
            />
          </div>

          {/* Row 2: Secondary Market Freshness & Meta-stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="group rounded-2xl border border-white/5 bg-gray-950/40 p-5 backdrop-blur-md hover:bg-white/5 transition-all">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('dashboardRealtime.monitoredSymbols')}</p>
              <p className="text-2xl font-black text-gray-100 mt-2 tracking-tight">{monitoredSymbols.length}</p>
            </div>
            <div className="group rounded-2xl border border-white/5 bg-gray-950/40 p-5 backdrop-blur-md hover:bg-white/5 transition-all">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('dashboardRealtime.deltaVsSnapshot')}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-2xl font-black tracking-tight ${realtimeDeltaVsSnapshot > 0 ? 'text-emerald-400' : realtimeDeltaVsSnapshot < 0 ? 'text-rose-400' : 'text-gray-100'}`}>
                  {realtimeDeltaVsSnapshot > 0 ? '+' : ''}{Math.round(realtimeDeltaVsSnapshot).toLocaleString('vi-VN')}
                </p>
                <span className="text-[10px] text-gray-600 font-bold tracking-widest">{t('dashboard.thousandVndUnitShort')}</span>
              </div>
            </div>
            <div className="group rounded-2xl border border-white/5 bg-gray-950/40 p-5 backdrop-blur-md hover:bg-white/5 transition-all">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('dashboardRealtime.stale')}</p>
              <p className={`text-2xl font-black mt-2 tracking-tight ${realtimeStalePositions > 0 ? 'text-amber-400' : 'text-gray-100'}`}>
                {realtimeStalePositions}
              </p>
            </div>
            <div className="group rounded-2xl border border-white/5 bg-gray-950/40 p-5 backdrop-blur-md hover:bg-white/5 transition-all">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('dashboardRealtime.upDownFlat')}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-black text-emerald-400 tracking-tight">{realtimeMarketBreadth.up}</span>
                <span className="text-sm font-bold text-gray-700">/</span>
                <span className="text-2xl font-black text-rose-400 tracking-tight">{realtimeMarketBreadth.down}</span>
                <span className="text-sm font-bold text-gray-700">/</span>
                <span className="text-2xl font-black text-gray-400 tracking-tight">{realtimeMarketBreadth.flat}</span>
              </div>
            </div>
          </div>

          {/* Row 3: Visual Analytics (Charts) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
             <div className="xl:col-span-1 min-h-[400px]">
                <EquityVsBenchmarkChart portfolioId={activePortfolioId} />
             </div>
             <div className="xl:col-span-1 min-h-[400px]">
                <AllocationPieChart portfolioId={activePortfolioId} />
             </div>
          </div>

          {/* Row 4: Performance Heatmap (High-density Visual) */}
          <div className="w-full">
             <PortfolioHeatmap holdings={liveHoldings} quotesBySymbol={quotesBySymbol} />
          </div>

          {/* Row 5: Content Intelligence Digest */}
          <PortfolioDigestPanel />

          {/* Row 6: Detailed Holdings Inventory */}
          <div className="bg-gray-950/40 border border-white/5 rounded-[2rem] p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-600/30 group-hover:bg-brand-600 transition-all" />
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
                 {t('dashboard.holdings')}
               </h2>
               <div className="h-px flex-1 mx-6 bg-white/5" />
               <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{liveHoldings.length} symbols</span>
            </div>
            <HoldingsTable holdings={liveHoldings} loading={loadingHoldings} />
          </div>
        </div>

        {/* Right Column: Sticky Intelligence Feed & Deep Risk Analytics (1/4 width) */}
        <div className="hidden lg:block space-y-8">
          <div className="sticky top-8 space-y-8">
            <div className="shadow-2xl shadow-brand-900/10">
               {realtimeAlertsPanel}
            </div>
            <PortfolioAnalyticsPanel portfolioId={activePortfolioId} />
          </div>
        </div>

      </div>
    </div>
  );
}
