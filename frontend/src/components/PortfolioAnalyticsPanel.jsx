/**
 * components/PortfolioAnalyticsPanel.jsx
 * Panel hiển thị risk metrics: Sharpe, Sortino, Max Drawdown, TWR, Volatility, Best/Worst day.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getAnalytics } from '../api/client';

const PERIOD_OPTIONS = [
  { label: '3T', days: 90 },
  { label: '6T', days: 180 },
  { label: '1N', days: 365 },
  { label: '3N', days: 1095 },
];

function MetricCard({ label, value, hint, colorClass = 'text-gray-100' }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-gray-500 uppercase tracking-wide truncate">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${colorClass}`}>
        {value ?? <span className="text-gray-600 text-base">—</span>}
      </span>
      {hint && <span className="text-xs text-gray-600">{hint}</span>}
    </div>
  );
}

function scoreColor(value, goodHigh = true) {
  if (value === null || value === undefined) return 'text-gray-400';
  if (goodHigh) {
    if (value >= 1) return 'text-green-400';
    if (value >= 0) return 'text-yellow-400';
    return 'text-red-400';
  }
  // goodHigh = false → nhỏ hơn = tốt (ví dụ drawdown)
  if (value >= -5) return 'text-green-400';
  if (value >= -15) return 'text-yellow-400';
  return 'text-red-400';
}

export default function PortfolioAnalyticsPanel({ portfolioId }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(365);

  const fetchMetrics = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics(portfolioId, days);
      setMetrics(res.data);
    } catch (err) {
      setError('Không tải được dữ liệu phân tích.');
      console.error('Lỗi getAnalytics:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, days]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const fmt = (v, suffix = '') =>
    v !== null && v !== undefined ? `${v}${suffix}` : null;

  const noData = !metrics || metrics.total_trading_days < 5;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Phân tích rủi ro &amp; hiệu suất
        </h3>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                days === opt.days
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          Đang tính toán…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-red-400 text-sm text-center py-6">{error}</div>
      )}

      {/* No data */}
      {!loading && !error && noData && (
        <div className="text-gray-500 text-sm text-center py-6">
          Chưa đủ dữ liệu để tính toán (cần ít nhất 5 ngày giao dịch).
        </div>
      )}

      {/* Metrics grid */}
      {!loading && !error && !noData && metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MetricCard
              label="Sharpe Ratio"
              value={fmt(metrics.sharpe_ratio)}
              hint="≥1 tốt, ≥2 xuất sắc"
              colorClass={scoreColor(metrics.sharpe_ratio, true)}
            />
            <MetricCard
              label="Sortino Ratio"
              value={fmt(metrics.sortino_ratio)}
              hint="Chỉ tính downside risk"
              colorClass={scoreColor(metrics.sortino_ratio, true)}
            />
            <MetricCard
              label="Max Drawdown"
              value={fmt(metrics.max_drawdown_pct, '%')}
              hint="Mức giảm lớn nhất từ đỉnh"
              colorClass={scoreColor(metrics.max_drawdown_pct, false)}
            />
            <MetricCard
              label="TWR"
              value={fmt(metrics.twr_pct, '%')}
              hint="Time-Weighted Return"
              colorClass={
                metrics.twr_pct > 0 ? 'text-green-400'
                : metrics.twr_pct < 0 ? 'text-red-400'
                : 'text-gray-400'
              }
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Volatility/N"
              value={fmt(metrics.volatility_annual_pct, '%')}
              hint="Biến động hàng năm"
              colorClass="text-gray-100"
            />
            <MetricCard
              label="Ngày tốt nhất"
              value={fmt(metrics.best_day_pct, '%')}
              colorClass="text-green-400"
            />
            <MetricCard
              label="Ngày tệ nhất"
              value={fmt(metrics.worst_day_pct, '%')}
              colorClass="text-red-400"
            />
            <MetricCard
              label="Ngày giao dịch"
              value={metrics.total_trading_days}
              hint={`Trong ${metrics.period_days} ngày qua`}
              colorClass="text-gray-300"
            />
          </div>
        </>
      )}
    </div>
  );
}
