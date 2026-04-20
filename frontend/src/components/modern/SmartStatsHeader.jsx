import React from 'react';
import { useI18n } from '../../context/LangContext';
import { usePortfolio } from '../../context/PortfolioContext';

export default function SmartStatsHeader({ summary, loading, realtimeBreadth, onRefresh }) {
  const { t } = useI18n();
  const { portfolios, activePortfolioId, setActivePortfolioId } = usePortfolio();

  const marketValue = summary?.total_market_value || 0;
  const dayPL = summary?.total_unrealized_pl || 0;
  const dayPLPct = summary?.total_unrealized_pl_pct || 0;

  const breadthTotal = (realtimeBreadth?.up || 0) + (realtimeBreadth?.down || 0) + (realtimeBreadth?.flat || 0);

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-4 py-2">
      {/* Portfolio Selector & Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            💼
          </div>
          <select
            value={activePortfolioId || ''}
            onChange={(e) => setActivePortfolioId(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold text-slate-100 focus:ring-0 cursor-pointer hover:text-emerald-400 transition-colors"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Divider */}
        <div className="h-4 w-px bg-slate-800" />

        {/* Essential Metrics */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">
              {t('dashboard.marketValue')}
            </span>
            <span className="text-sm font-black text-slate-100 leading-none">
              {loading ? '...' : Number(marketValue).toLocaleString('vi-VN')}
              <span className="text-[10px] font-normal text-slate-600 ml-1">đ</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">
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
      </div>

      {/* Right side: Breadth & Status */}
      <div className="flex items-center gap-6">
        {/* Market Breadth */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1">
            Độ rộng danh mục
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
        <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
           <button
             onClick={() => onRefresh?.()}
             className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-all"
             title="Làm mới dữ liệu"
           >
             🔄
           </button>
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Realtime Active" />
        </div>
      </div>
    </div>
  );
}
