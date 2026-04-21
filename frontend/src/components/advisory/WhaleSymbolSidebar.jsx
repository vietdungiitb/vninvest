import React, { useMemo } from 'react';
import { useI18n } from '../../context/LangContext';
import PaginationBar from '../shared/PaginationBar';

export default function WhaleSymbolSidebar({
  symbolStats,
  symbolSearch,
  setSymbolSearch,
  activeSymbol,
  setActiveSymbol,
  page,
  setPage,
  pageSize,
  setPageSize,
}) {
  const { t } = useI18n();

  const filteredStats = useMemo(() => {
    let list = Array.isArray(symbolStats) ? symbolStats : [];
    if (symbolSearch) {
      const search = symbolSearch.toLowerCase();
      list = list.filter(item => 
        (item.symbol || '').toLowerCase().includes(search)
      );
    }
    return list;
  }, [symbolStats, symbolSearch]);

  const pagedStats = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStats.slice(start, start + pageSize);
  }, [filteredStats, page, pageSize]);

  return (
    <div className="flex flex-col h-full neon-glass-panel overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-900/40">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
          {t('whaleAdvisory.activeSymbol')}
        </h3>
        <div className="relative">
          <input
            type="text"
            className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
            placeholder={t('whaleAdvisory.placeholders.searchSymbol')}
            value={symbolSearch}
            onChange={(e) => {
              setSymbolSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto panel-scrollbar p-2 space-y-1 bg-slate-950/20">
        {pagedStats.length > 0 ? (
          pagedStats.map((item) => {
            const isActive = activeSymbol === item.symbol;
            return (
              <button
                key={item.symbol}
                onClick={() => setActiveSymbol(item.symbol)}
                className={`w-full text-left p-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-cyan-400' : 'text-slate-200'}`}>
                      {item.symbol}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        {item.trade_count}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col">
                    <div className={`text-xs font-mono font-bold ${item.net_buy_shares >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.net_buy_shares >= 0 ? '▲' : '▼'} {Math.abs(item.net_buy_shares).toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{t('whaleAdvisory.netShares')}</div>
                  </div>
                </div>

                {/* Active Indicator Glow */}
                {isActive && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent" />
                  </>
                )}
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/30 flex items-center justify-center mb-3 text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm italic">
              {symbolSearch ? t('whaleAdvisory.noMatchingSymbols') : t('whaleAdvisory.noSymbolsActive')}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-900/60 backdrop-blur-md border-t border-slate-800/60">
        <PaginationBar
          mode="offset"
          total={filteredStats.length}
          page={page}
          size={pageSize}
          onPageChange={setPage}
          onSizeChange={setPageSize}
        />
        <div className="bg-slate-950/40 px-4 py-2 border-t border-slate-800/30 flex justify-between items-center">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
            {t('whaleAdvisory.pagination.totalSymbols', { count: filteredStats.length })}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot-pulse" />
            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">{t('whaleAdvisory.liveStatus')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
