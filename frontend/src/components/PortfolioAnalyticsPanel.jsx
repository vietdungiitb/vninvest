/**
 * components/PortfolioAnalyticsPanel.jsx
 * Panel hiển thị risk metrics: Sharpe, Sortino, Max Drawdown, TWR, Volatility, Best/Worst day.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getAnalytics } from '../api/client';
import { useI18n } from '../context/LangContext';

function getPeriodOptions(t) {
  return [
    { label: t('portfolioAnalytics.periods.p3m'), days: 90 },
    { label: t('portfolioAnalytics.periods.p6m'), days: 180 },
    { label: t('portfolioAnalytics.periods.p1y'), days: 365 },
    { label: t('portfolioAnalytics.periods.p3y'), days: 1095 },
  ];
}

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
  const { t } = useI18n();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(365);
  const periodOptions = getPeriodOptions(t);

  const fetchMetrics = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics(portfolioId, days);
      setMetrics(res.data);
    } catch (err) {
      setError(t('portfolioAnalytics.loadError'));
      console.error('Lỗi getAnalytics:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, days, t]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const fmt = (v, suffix = '') =>
    v !== null && v !== undefined ? `${v}${suffix}` : null;

  const noData = !metrics || metrics.total_trading_days < 5;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {t('portfolioAnalytics.title')}
        </h3>
        <div className="flex gap-1">
          {periodOptions.map(opt => (
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
          {t('portfolioAnalytics.computing')}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-red-400 text-sm text-center py-6">{error}</div>
      )}

      {/* No data */}
      {!loading && !error && noData && (
        <div className="text-gray-500 text-sm text-center py-6">
          {t('portfolioAnalytics.insufficientData')}
        </div>
      )}

      {/* Metrics grid */}
      {!loading && !error && !noData && metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <MetricCard
              label={t('portfolioAnalytics.metrics.sharpeRatio')}
              value={fmt(metrics.sharpe_ratio)}
              hint={t('portfolioAnalytics.hints.sharpeRatio')}
              colorClass={scoreColor(metrics.sharpe_ratio, true)}
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.sortinoRatio')}
              value={fmt(metrics.sortino_ratio)}
              hint={t('portfolioAnalytics.hints.sortinoRatio')}
              colorClass={scoreColor(metrics.sortino_ratio, true)}
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.maxDrawdown')}
              value={fmt(metrics.max_drawdown_pct, '%')}
              hint={t('portfolioAnalytics.hints.maxDrawdown')}
              colorClass={scoreColor(metrics.max_drawdown_pct, false)}
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.twr')}
              value={fmt(metrics.twr_pct, '%')}
              hint={t('portfolioAnalytics.hints.twr')}
              colorClass={
                metrics.twr_pct > 0 ? 'text-green-400'
                : metrics.twr_pct < 0 ? 'text-red-400'
                : 'text-gray-400'
              }
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label={t('portfolioAnalytics.metrics.volatility')}
              value={fmt(metrics.volatility_annual_pct, '%')}
              hint={t('portfolioAnalytics.hints.volatilityAnnual')}
              colorClass="text-gray-100"
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.bestDay')}
              value={fmt(metrics.best_day_pct, '%')}
              colorClass="text-green-400"
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.worstDay')}
              value={fmt(metrics.worst_day_pct, '%')}
              colorClass="text-red-400"
            />
            <MetricCard
              label={t('portfolioAnalytics.metrics.tradingDays')}
              value={metrics.total_trading_days}
              hint={t('portfolioAnalytics.tradingDaysHint', { days: metrics.period_days })}
              colorClass="text-gray-300"
            />
          </div>
        </>
      )}
    </div>
  );
}
