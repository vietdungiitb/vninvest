import React, { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import RiskModeSelector from '../components/advisory/RiskModeSelector';
import RecommendationHistoryMini from '../components/advisory/RecommendationHistoryMini';
import TrustTelemetryPanel from '../components/advisory/TrustTelemetryPanel';

// Modular Components
import WhaleAdvisoryBentoHeader from '../components/advisory/WhaleAdvisoryBentoHeader';
import WhaleSymbolSidebar from '../components/advisory/WhaleSymbolSidebar';
import WhaleAdvisoryCommandPanel from '../components/advisory/WhaleAdvisoryCommandPanel';
import { useWhaleAdvisoryData } from '../hooks/useWhaleAdvisoryData';

function fmtTime(ts) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString();
}

/**
 * WhaleAdvisory — The Agentic Command Center (2026)
 * Orchestrates the modular bento-grid layout for whale intelligence.
 */
export default function WhaleAdvisory() {
  const { userPlan } = usePortfolio();
  const { t } = useI18n();

  const [riskMode, setRiskMode] = useState(() => localStorage.getItem('vninvest:risk-mode') || 'balanced');
  const [activeSymbol, setActiveSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [watchlistOnly, setWatchlistOnly] = useState(false);

  const {
    items, error, symbolStats, statsLoading, refreshInfoMap, pendingRefreshSymbols,
    pendingDeleteSymbols, rowMessages, fetchData, loadRefreshInfo,
    handleRefreshAdvisory, handleDeleteAdvisory
  } = useWhaleAdvisoryData(watchlistOnly);

  // Sync risk mode
  useEffect(() => localStorage.setItem('vninvest:risk-mode', riskMode), [riskMode]);

  // Load refresh info dynamically
  useEffect(() => {
    if (activeSymbol) loadRefreshInfo(activeSymbol);
  }, [activeSymbol, loadRefreshInfo]);

  // Derived filtered stats based on search
  const filteredStats = useMemo(() => {
    let list = Array.isArray(symbolStats) ? symbolStats : [];
    if (symbolSearch) {
      const q = symbolSearch.toLowerCase();
      list = list.filter(s => (s.symbol || '').toLowerCase().includes(q));
    }
    return list;
  }, [symbolStats, symbolSearch]);

  // F4 Guard: Fix ActiveSymbol desync when filtering
  useEffect(() => {
    if (!activeSymbol && filteredStats.length > 0) {
      setActiveSymbol(filteredStats[0].symbol);
    } else if (activeSymbol && filteredStats.length > 0) {
      const stillExists = filteredStats.some(s => s.symbol === activeSymbol);
      if (!stillExists) setActiveSymbol(filteredStats[0].symbol);
    } else if (filteredStats.length === 0) {
      setActiveSymbol('');
    }
  }, [activeSymbol, filteredStats]);

  const activeItem = useMemo(() => {
    if (!activeSymbol) return null;
    return items.filter(i => i.symbol === activeSymbol).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }, [activeSymbol, items]);
  
  const refreshInfo = activeSymbol ? refreshInfoMap[activeSymbol] : null;

  return (
    <div className="mx-auto max-w-[1800px] pt-24 pb-8 px-4 lg:px-8 space-y-6 min-h-screen bg-slate-950/20">
      <WhaleAdvisoryBentoHeader userPlan={userPlan} statsLoading={statsLoading} onRefresh={fetchData} />

      {error ? (
        <div className="p-20 text-center neon-glass-panel border-rose-500/20">
          <div className="text-rose-500 mb-4 scale-150 inline-block text-4xl">⚠️</div>
          <p className="text-slate-300 font-bold text-lg">{error}</p>
          <button onClick={fetchData} className="mt-6 px-6 py-2 bg-slate-800 rounded-xl text-cyan-400 hover:bg-slate-700 transition-all">{t('common.retry')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[82vh]">
          <div className="lg:row-span-2 overflow-hidden flex flex-col">
            <WhaleSymbolSidebar 
              symbolStats={symbolStats} symbolSearch={symbolSearch} setSymbolSearch={setSymbolSearch}
              activeSymbol={activeSymbol} setActiveSymbol={setActiveSymbol}
              page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize}
            />
          </div>

          <div className="lg:col-span-2 overflow-hidden flex flex-col h-full transition-all duration-500 animate-in fade-in" key={`panel-${activeSymbol}`}>
            <WhaleAdvisoryCommandPanel 
              item={activeItem} activeSymbol={activeSymbol}
              onRefresh={handleRefreshAdvisory} onDeleteCurrent={handleDeleteAdvisory}
              refreshing={!!pendingRefreshSymbols[activeSymbol]} deleting={!!pendingDeleteSymbols[activeSymbol]}
              rowMessage={rowMessages[activeSymbol]}
            />
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden transition-all duration-500 animate-in fade-in fill-mode-backwards" key={`details-${activeSymbol}`} style={{ animationDelay: '100ms' }}>
             <div className={`neon-glass-panel p-6 flex flex-col transition-all duration-500 ${pendingRefreshSymbols[activeSymbol] ? 'shadow-[0_0_25px_rgba(6,182,212,0.4)] border-cyan-500/50 scale-[1.02]' : ''}`}>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{t('whaleAdvisory.riskCalibration')}</h3>
                <RiskModeSelector symbol={activeSymbol} value={riskMode} onChange={setRiskMode} />
             </div>
             <div className={`neon-glass-panel p-6 overflow-hidden flex flex-col transition-all duration-500 ${pendingRefreshSymbols[activeSymbol] ? 'shadow-[0_0_25px_rgba(6,182,212,0.4)] border-cyan-500/50 scale-[1.02]' : ''}`}>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex justify-between">
                   <span>{t('whaleAdvisory.temporalHistory')}</span>
                   <span className="text-cyan-500/50">{t('whaleAdvisory.lastCycles', {count: 5})}</span>
                </h3>
                <div className="flex-1 overflow-y-auto panel-scrollbar">
                  <RecommendationHistoryMini symbol={activeSymbol} limit={5} />
                </div>
             </div>
             
             <div className="md:col-span-2 neon-glass-panel p-6 overflow-hidden flex flex-col">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">
                  {t('whaleAdvisory.operationalTelemetry')}
                </h3>
                <div className="flex-1 overflow-y-auto panel-scrollbar">
                  <TrustTelemetryPanel />
                </div>
             </div>
          </div>
        </div>
      )}

      {activeSymbol && refreshInfo && (
        <footer className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 px-8 py-5 text-[10px] uppercase font-black tracking-widest text-slate-500 bg-slate-900/60 rounded-[2.5rem] border border-slate-800/40 backdrop-blur-xl shadow-2xl">
           <div className="flex items-center gap-3">
              <span className="text-slate-600">{t('whaleAdvisory.tokensRemaining')}</span>
              <span className="text-cyan-400 font-mono text-xs scale-110">{(refreshInfo.tokens_remaining_today || 0).toLocaleString()}</span>
           </div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
           <div className="flex items-center gap-3">
              <span className="text-slate-600">{t('whaleAdvisory.dailyRefreshQuota')}</span>
              <span className="px-3 py-1 bg-slate-950 rounded-lg text-emerald-400 font-mono text-xs">
                {refreshInfo.auto_refreshes_used_today || 0} <span className="text-slate-700 mx-1">/</span> {refreshInfo.advisory_max_auto_refreshes_per_day || 0}
              </span>
           </div>
           {refreshInfo.next_refresh_at && (
             <>
               <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
               <div className="flex items-center gap-3">
                  <span className="text-slate-600">{t('whaleAdvisory.nextCycle')}</span>
                  <span className="text-amber-400 font-mono text-xs italic">{fmtTime(refreshInfo.next_refresh_at)}</span>
               </div>
             </>
           )}
        </footer>
      )}
    </div>
  );
}
