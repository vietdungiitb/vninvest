/**
 * pages/Dashboard.jsx
 * Trang chính: StatCards + HoldingsTable + (Charts ở Bước 5).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { getSummary, getHoldings, syncPrices } from '../api/client';
import StatCard from '../components/StatCard';
import HoldingsTable from '../components/HoldingsTable';
import PortfolioLineChart from '../components/PortfolioLineChart';
import AllocationPieChart from '../components/AllocationPieChart';
import DashboardRealtimePanel from '../components/DashboardRealtimePanel';
import PortfolioAnalyticsPanel from '../components/PortfolioAnalyticsPanel';
import EquityVsBenchmarkChart from '../components/EquityVsBenchmarkChart';

export default function Dashboard() {
  const { activePortfolioId } = usePortfolio();

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
      setSyncMsg(`Đã đồng bộ ${total} mã chứng khoán.`);
      await fetchData(); // reload sau sync
    } catch {
      setSyncMsg('Đồng bộ thất bại, kiểm tra server.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const unrealizedPL = parseFloat(summary?.total_unrealized_pl ?? 0);
  const realizedPL = parseFloat(summary?.total_realized_pl ?? 0);

  if (!activePortfolioId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Chưa có danh mục. Hãy tạo mới qua Django Admin.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">
            {summary?.portfolio_name ?? 'Đang tải...'}
          </h1>
          {summary?.last_updated && (
            <p className="text-xs text-gray-500 mt-0.5">
              Giá cập nhật lần cuối: {summary.last_updated}
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
                Đang đồng bộ...
              </>
            ) : (
              'Đồng bộ giá'
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng giá trị thị trường"
          value={summary?.total_market_value}
          loading={loadingSummary}
        />
        <StatCard
          label="Lãi/Lỗ chưa chốt"
          value={summary?.total_unrealized_pl}
          sub={summary ? `${parseFloat(summary.total_unrealized_pl_pct).toFixed(2)}%` : null}
          isPositive={unrealizedPL > 0}
          isNegative={unrealizedPL < 0}
          loading={loadingSummary}
        />
        <StatCard
          label="Lãi/Lỗ đã chốt"
          value={summary?.total_realized_pl}
          isPositive={realizedPL > 0}
          isNegative={realizedPL < 0}
          loading={loadingSummary}
        />
        <StatCard
          label="Cổ tức đã nhận"
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
          Vị thế đang nắm giữ
        </h2>
        <HoldingsTable holdings={holdings} loading={loadingHoldings} />
      </div>

      {/* Risk & Performance Analytics */}
      <PortfolioAnalyticsPanel portfolioId={activePortfolioId} />
    </div>
  );
}
