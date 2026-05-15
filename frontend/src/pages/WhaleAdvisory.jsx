import React, { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import RiskModeSelector from '../components/advisory/RiskModeSelector';
import RecommendationHistoryMini from '../components/advisory/RecommendationHistoryMini';
import FactsFirstWhaleBubbleChart from '../components/FactsFirstWhaleBubbleChart';
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
  const { userPlan, activePortfolioId } = usePortfolio();
  const { t } = useI18n();
  const packageShellHostEnabled = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST === '1';

  const [riskMode, setRiskMode] = useState(() => localStorage.getItem('vninvest:risk-mode') || 'balanced');
  const [activeSymbol, setActiveSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
  const [supportTab, setSupportTab] = useState(() => localStorage.getItem('vninvest:advisory-support-tab') || 'telemetry');

  const {
    items, error, symbolStats, statsLoading, refreshInfoMap, pendingRefreshSymbols,
    pendingDeleteSymbols, rowMessages, fetchData, loadRefreshInfo,
    handleRefreshAdvisory, handleDeleteAdvisory
  } = useWhaleAdvisoryData(watchlistOnly, isDiscoveryMode, { activePortfolioId });

  // Sync risk mode
  useEffect(() => localStorage.setItem('vninvest:risk-mode', riskMode), [riskMode]);

  useEffect(() => {
    localStorage.setItem('vninvest:advisory-support-tab', supportTab);
  }, [supportTab]);

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

  const advisoryShellHostHref = useMemo(() => {
    const params = new URLSearchParams();
    const resolvedSymbol = String(activeSymbol || filteredStats[0]?.symbol || 'BCM').trim().toUpperCase();

    if (resolvedSymbol) {
      params.set('symbol', resolvedSymbol);
    }

    const query = params.toString();
    return query ? `/ai-advisory/shell?${query}` : '/ai-advisory/shell';
  }, [activeSymbol, filteredStats]);
  
  const refreshInfo = activeSymbol ? refreshInfoMap[activeSymbol] : null;

  return (
    <div className="mx-auto max-w-[1800px] pt-6 pb-8 px-4 lg:px-8 space-y-4 min-h-screen bg-slate-950/20">
      <WhaleAdvisoryBentoHeader
        userPlan={userPlan}
        statsLoading={statsLoading}
        onRefresh={fetchData}
        shellHostHref={advisoryShellHostHref}
        showShellHostLink={packageShellHostEnabled}
      />

      {error ? (
        <div className="p-20 text-center neon-glass-panel border-rose-500/20">
          <div className="text-rose-500 mb-4 scale-150 inline-block text-4xl">⚠️</div>
          <p className="text-slate-300 font-bold text-lg">{error}</p>
          <button onClick={fetchData} className="mt-6 px-6 py-2 bg-slate-800 rounded-xl text-cyan-400 hover:bg-slate-700 transition-all">{t('common.retry')}</button>
        </div>
      ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
              {/* Left 2 columns: advisory command panel for long reading */}
              <div className="xl:col-span-2 flex flex-col min-h-[560px]" key={`main-${activeSymbol}`}>
                <WhaleAdvisoryCommandPanel
                  item={activeItem}
                  activeSymbol={activeSymbol}
                  onRefresh={handleRefreshAdvisory}
                  onDeleteCurrent={handleDeleteAdvisory}
                  refreshing={!!pendingRefreshSymbols[activeSymbol]}
                  deleting={!!pendingDeleteSymbols[activeSymbol]}
                  rowMessage={rowMessages[activeSymbol]}
                />
              </div>

              {/* Right column: symbol sidebar */}
              <div className="xl:col-span-1 flex flex-col min-h-[560px]">
                <WhaleSymbolSidebar
                  symbolStats={symbolStats}
                  symbolSearch={symbolSearch}
                  setSymbolSearch={setSymbolSearch}
                  activeSymbol={activeSymbol}
                  setActiveSymbol={setActiveSymbol}
                  page={page}
                  setPage={setPage}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
              {/* Bubble chart as primary supporting module */}
              <div className="xl:col-span-2 min-h-[360px]">
                <div className="h-full neon-glass-panel p-3">
                  {activeSymbol ? (
                    <FactsFirstWhaleBubbleChart symbol={activeSymbol} isEmbedded={true} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl">
                      <div className="text-3xl opacity-20">🐋</div>
                      <p className="text-[9px] font-black uppercase tracking-widest">{t('whaleChart.selectSymbolToStart')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Harmonized support modules */}
              <div className="xl:col-span-1 min-h-[360px] neon-glass-panel overflow-hidden flex flex-col">
                <div className="p-2 border-b border-slate-800/60 bg-slate-900/50 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupportTab('telemetry')}
                    className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                  >
                    {t('whaleAdvisory.infoPanel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportTab('risk')}
                    className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'risk' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                  >
                    {t('whaleAdvisory.riskCalibration')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupportTab('history')}
                    className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'history' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                  >
                    {t('whaleAdvisory.temporalHistory')}
                  </button>
                </div>
                <div className="flex-1 p-3 overflow-y-auto panel-scrollbar">
                  {supportTab === 'telemetry' && (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3">
                      <TrustTelemetryPanel />
                    </div>
                  )}
                  {supportTab === 'risk' && (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3">
                      <RiskModeSelector symbol={activeSymbol} value={riskMode} onChange={setRiskMode} />
                    </div>
                  )}
                  {supportTab === 'history' && (
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3">
                      <RecommendationHistoryMini symbol={activeSymbol} limit={6} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
      )}

      {refreshInfo && (
        <footer className="flex items-center gap-3 text-slate-500 text-xs mt-4">
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
