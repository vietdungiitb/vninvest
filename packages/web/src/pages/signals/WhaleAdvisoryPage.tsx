import { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { useWhaleAdvisoryData } from '../../hooks/useWhaleAdvisoryData.js';
import { WhaleAdvisoryBentoHeader } from '../../components/advisory/WhaleAdvisoryBentoHeader.js';
import { WhaleSymbolSidebar } from '../../components/advisory/WhaleSymbolSidebar.js';
import { WhaleAdvisoryCommandPanel } from '../../components/advisory/WhaleAdvisoryCommandPanel.js';
import { TrustTelemetryPanel } from '../../components/advisory/TrustTelemetryPanel.js';
import { RiskModeSelector } from '../../components/advisory/RiskModeSelector.js';
import { RecommendationHistoryMini } from '../../components/advisory/RecommendationHistoryMini.js';
import FactsFirstWhaleBubbleChart from '../../components/FactsFirstWhaleBubbleChart.jsx';

function fmtTime(ts: string | number | null | undefined): string {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString();
}

interface RefreshInfo {
  tokens_remaining_today?: number;
  auto_refreshes_used_today?: number;
  advisory_max_auto_refreshes_per_day?: number;
  next_refresh_at?: string | number;
}

interface SymbolStat {
  symbol: string;
  [key: string]: any;
}

interface AdvisoryItem {
  symbol: string;
  created_at: string;
  [key: string]: any;
}

export function WhaleAdvisoryPage() {
  const { userPlan, activePortfolioId } = usePortfolio() as any;
  const packageShellHostEnabled = false;

  const [riskMode, setRiskMode] = useState(() => localStorage.getItem('vninvest:risk-mode') || 'balanced');
  const [activeSymbol, setActiveSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [watchlistOnly] = useState(false);
  const [isDiscoveryMode] = useState(false);
  const [supportTab, setSupportTab] = useState(() => localStorage.getItem('vninvest:advisory-support-tab') || 'telemetry');

  const {
    items, error, symbolStats, statsLoading, refreshInfoMap, pendingRefreshSymbols,
    pendingDeleteSymbols, rowMessages, fetchData, loadRefreshInfo,
    handleRefreshAdvisory, handleDeleteAdvisory,
  } = useWhaleAdvisoryData(watchlistOnly, isDiscoveryMode, { activePortfolioId }) as any;

  const itemsTyped = items as AdvisoryItem[];
  const refreshInfoMapTyped = refreshInfoMap as Record<string, RefreshInfo>;
  const symbolStatsTyped = symbolStats as SymbolStat[];

  useEffect(() => localStorage.setItem('vninvest:risk-mode', riskMode), [riskMode]);
  useEffect(() => localStorage.setItem('vninvest:advisory-support-tab', supportTab), [supportTab]);
  useEffect(() => {
    if (activeSymbol) loadRefreshInfo(activeSymbol);
  }, [activeSymbol, loadRefreshInfo]);

  const filteredStats = useMemo(() => {
    let list: SymbolStat[] = Array.isArray(symbolStatsTyped) ? symbolStatsTyped : [];
    if (symbolSearch) {
      const q = symbolSearch.toLowerCase();
      list = list.filter(s => (s.symbol || '').toLowerCase().includes(q));
    }
    return list;
  }, [symbolStatsTyped, symbolSearch]);

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

  const activeItem: AdvisoryItem | null = useMemo(() => {
    if (!activeSymbol) return null;
    return itemsTyped.filter(i => i.symbol === activeSymbol).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }, [activeSymbol, itemsTyped]);

  const advisoryShellHostHref = useMemo(() => {
    const resolvedSymbol = String(activeSymbol || filteredStats[0]?.symbol || 'BCM').trim().toUpperCase();
    return resolvedSymbol ? `/ai-advisory/shell?symbol=${resolvedSymbol}` : '/ai-advisory/shell';
  }, [activeSymbol, filteredStats]);

  const refreshInfo: RefreshInfo | null = activeSymbol ? refreshInfoMapTyped[activeSymbol] : null;

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
          <p className="text-slate-300 font-bold text-lg">{error as string}</p>
          <button onClick={fetchData} className="mt-6 px-6 py-2 bg-slate-800 rounded-xl text-cyan-400 hover:bg-slate-700 transition-all">
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top row: Command Panel + Symbol Sidebar */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
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

          {/* Bottom row: Bubble Chart + Support Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
            <div className="xl:col-span-2 min-h-[360px]">
              <div className="h-full neon-glass-panel p-3">
                {activeSymbol ? (
                  <FactsFirstWhaleBubbleChart symbol={activeSymbol} isEmbedded={true} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl">
                    <div className="text-3xl opacity-20">🐋</div>
                    <p className="text-[9px] font-black uppercase tracking-widest">Chọn mã để xem biểu đồ</p>
                  </div>
                )}
              </div>
            </div>
            <div className="xl:col-span-1 min-h-[360px] neon-glass-panel overflow-hidden flex flex-col">
              <div className="p-2 border-b border-slate-800/60 bg-slate-900/50 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSupportTab('telemetry')}
                  className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                >
                  Telemetry
                </button>
                <button
                  type="button"
                  onClick={() => setSupportTab('risk')}
                  className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'risk' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                >
                  Rủi ro
                </button>
                <button
                  type="button"
                  onClick={() => setSupportTab('history')}
                  className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'history' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`}
                >
                  Lịch sử
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
            <span className="text-slate-600">Token còn lại</span>
            <span className="text-cyan-400 font-mono text-xs scale-110">{(refreshInfo.tokens_remaining_today || 0).toLocaleString()}</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
          <div className="flex items-center gap-3">
            <span className="text-slate-600">Hạn mức làm mới</span>
            <span className="px-3 py-1 bg-slate-950 rounded-lg text-emerald-400 font-mono text-xs">
              <span>{refreshInfo.auto_refreshes_used_today || 0}</span>
              <span className="text-slate-700 mx-1">/</span>
              <span>{refreshInfo.advisory_max_auto_refreshes_per_day || 0}</span>
            </span>
          </div>
          {refreshInfo.next_refresh_at && (
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <div className="flex items-center gap-3">
                <span className="text-slate-600">Chu kỳ tiếp theo</span>
                <span className="text-amber-400 font-mono text-xs italic">{fmtTime(refreshInfo.next_refresh_at)}</span>
              </div>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

export default WhaleAdvisoryPage;
