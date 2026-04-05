/**
 * pages/Dashboard.jsx
 * Trang chính: StatCards + HoldingsTable + (Charts ở Bước 5).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { getSummary, getHoldings, syncPrices } from '../api/client';
import StatCard from '../components/StatCard';
import HoldingsTable from '../components/HoldingsTable';
import PortfolioLineChart from '../components/PortfolioLineChart';
import AllocationPieChart from '../components/AllocationPieChart';
import DashboardRealtimePanel from '../components/DashboardRealtimePanel';
import PortfolioAnalyticsPanel from '../components/PortfolioAnalyticsPanel';
import EquityVsBenchmarkChart from '../components/EquityVsBenchmarkChart';
import { useI18n } from '../context/LangContext';

export default function Dashboard() {
  const { activePortfolioId } = usePortfolio();
  const { t, formatDateTime } = useI18n();

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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

  const unrealizedPL = parseFloat(summary?.total_unrealized_pl ?? 0);
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
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50
                       border border-gray-700 text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            {syncing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-brand-500
                                 rounded-full animate-spin inline-block" />
                {t('dashboard.syncingPrices')}
              </>
            ) : (
              t('dashboard.syncPrices')
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.marketValue')}
          value={summary?.total_market_value}
          loading={loadingSummary}
        />
        <StatCard
          label={t('dashboard.unrealizedPL')}
          value={summary?.total_unrealized_pl}
          sub={summary ? `${parseFloat(summary.total_unrealized_pl_pct).toFixed(2)}%` : null}
          isPositive={unrealizedPL > 0}
          isNegative={unrealizedPL < 0}
          loading={loadingSummary}
        />
        <StatCard
          label={t('dashboard.realizedPL')}
          value={summary?.total_realized_pl}
          isPositive={realizedPL > 0}
          isNegative={realizedPL < 0}
          loading={loadingSummary}
        />
        <StatCard
          label={t('dashboard.dividends')}
          value={summary?.total_dividends}
          loading={loadingSummary}
        />
      </div>

      <DashboardRealtimePanel holdings={holdings} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EquityVsBenchmarkChart portfolioId={activePortfolioId} />
        </div>
        <div className="lg:col-span-1">
          <AllocationPieChart portfolioId={activePortfolioId} />
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          {t('dashboard.holdings')}
        </h2>
        <HoldingsTable holdings={holdings} loading={loadingHoldings} />
      </div>

      {/* Risk & Performance Analytics */}
      <PortfolioAnalyticsPanel portfolioId={activePortfolioId} />
    </div>
  );
}
