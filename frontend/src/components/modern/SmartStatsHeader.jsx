import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/LangContext';
import { usePortfolio } from '../../context/PortfolioContext';

export default function SmartStatsHeader({ summary, loading, realtimeBreadth, onRefresh, analytics = null }) {
  const { t } = useI18n();
  const { portfolios, activePortfolioId, setActivePortfolioId } = usePortfolio();

  const marketValue = summary?.total_market_value || 0;
  const dayPL = summary?.total_unrealized_pl || 0;
  const dayPLPct = summary?.total_unrealized_pl_pct || 0;

  const breadthTotal = (realtimeBreadth?.up || 0) + (realtimeBreadth?.down || 0) + (realtimeBreadth?.flat || 0);

  const compactMetrics = [
    {
      key: 'alpha',
      label: t('dashboard.headerAlpha', { defaultValue: 'Alpha' }),
      value: analytics?.alpha_annual_pct,
      format: (value) => `${Number(value).toFixed(2)}%`,
      color: Number(analytics?.alpha_annual_pct) >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    {
      key: 'beta',
      label: t('dashboard.headerBeta', { defaultValue: 'Beta' }),
      value: analytics?.beta,
      format: (value) => Number(value).toFixed(2),
      color: 'text-slate-200',
    },
    {
      key: 'sharpe',
      label: t('dashboard.headerSharpe', { defaultValue: 'Sharpe' }),
      value: analytics?.sharpe_ratio,
      format: (value) => Number(value).toFixed(2),
      color: Number(analytics?.sharpe_ratio) >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    {
      key: 'maxDrawdown',
      label: t('dashboard.headerMaxDrawdown', { defaultValue: 'Drawdown tối đa' }),
      value: analytics?.max_drawdown_pct,
      format: (value) => `${Number(value).toFixed(2)}%`,
      color: 'text-rose-400',
    },
  ];

  return (
    <div className="sticky top-0 z-30 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 py-2">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-6">
        {/* Essential Metrics - Left Aligned to match Grid */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1">
              {t('dashboard.marketValue')}
            </span>
            <span className="text-sm font-black text-slate-100 leading-none">
              {loading || !marketValue ? '--' : Number(marketValue).toLocaleString('vi-VN')}
              {marketValue > 0 && <span className="text-[10px] font-normal text-slate-600 ml-1">đ</span>}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1">
              {t('dashboard.unrealizedPL')}
            </span>
            <div className={`flex items-center gap-1.5 leading-none ${dayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className="text-sm font-black">
                {loading ? '...' : (dayPL >= 0 ? '+' : '') + Number(dayPL).toLocaleString('vi-VN')}
              </span>
              <span className="text-[10px] font-bold px-1 rounded bg-current/10">
                {Number(dayPLPct).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 xl:block">
          <div className="grid grid-cols-4 gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/35 px-4 py-2">
            {compactMetrics.map((metric) => (
              <div key={metric.key} className="min-w-0">
                <div className="truncate text-[9px] uppercase tracking-[0.18em] text-slate-500">
                  {metric.label}
                </div>
                <div className={`mt-1 truncate text-xs font-black ${metric.color}`}>
                  {loading || metric.value === null || metric.value === undefined ? '--' : metric.format(metric.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Breadth & Status */}
        <div className="flex items-center gap-6">
          {/* Market Breadth */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">
              {t('dashboard.breadthLabel')}
            </span>
            <div className="flex items-center gap-1">
               <div className="flex h-1.5 w-32 rounded-full overflow-hidden bg-slate-800">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${((realtimeBreadth?.up || 0) / (breadthTotal || 1)) * 100}%` }}
                  />
                  <div 
                    className="bg-slate-600 h-full transition-all duration-500" 
                    style={{ width: `${((realtimeBreadth?.flat || 0) / (breadthTotal || 1)) * 100}%` }}
                  />
                  <div 
                    className="bg-rose-500 h-full transition-all duration-500" 
                    style={{ width: `${((realtimeBreadth?.down || 0) / (breadthTotal || 1)) * 100}%` }}
                  />
               </div>
               <span className="text-[10px] font-bold text-slate-300 ml-1">
                 {realtimeBreadth?.up}/{realtimeBreadth?.flat}/{realtimeBreadth?.down}
               </span>
            </div>
          </div>

            {/* Global Action */}
          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">

             <button
               onClick={() => onRefresh?.()}
               className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
               title={t('dashboard.refreshBtn', { defaultValue: 'Làm mới dữ liệu' })}
             >
               🔄
             </button>
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Realtime Active" />
          </div>
        </div>
      </div>
    </div>
  );
}
