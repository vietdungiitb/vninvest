/**
 * WhaleAdvisoryPage — AI Advisory Dashboard
 * Converted from JSX to createElement pattern per packages/web convention
 */
import { createElement, useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { useWhaleAdvisoryData } from '../../hooks/useWhaleAdvisoryData.js';
import { WhaleAdvisoryBentoHeader } from '../../components/advisory/WhaleAdvisoryBentoHeader.js';
import { WhaleSymbolSidebar } from '../../components/advisory/WhaleSymbolSidebar.js';
import { WhaleAdvisoryCommandPanel } from '../../components/advisory/WhaleAdvisoryCommandPanel.js';
import { TrustTelemetryPanel } from '../../components/advisory/TrustTelemetryPanel.js';
import { RiskModeSelector } from '../../components/advisory/RiskModeSelector.js';
import { RecommendationHistoryMini } from '../../components/advisory/RecommendationHistoryMini.js';
import FactsFirstWhaleBubbleChart from '../../components/FactsFirstWhaleBubbleChart.jsx';

const e = createElement;

function fmtTime(ts) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString();
}

export function WhaleAdvisoryPage() {
  const { userPlan, activePortfolioId } = usePortfolio();
  const packageShellHostEnabled = false;

  const [riskMode, setRiskMode] = useState(() => localStorage.getItem('vninvest:risk-mode') || 'balanced');
  const [activeSymbol, setActiveSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
  const [supportTab, setSupportTab] = useState(() => localStorage.getItem('vninvest:advisory-support-tab') || 'telemetry');

  const {
    items, error, symbolStats, statsLoading, refreshInfoMap, pendingRefreshSymbols,
    pendingDeleteSymbols, rowMessages, fetchData, loadRefreshInfo,
    handleRefreshAdvisory, handleDeleteAdvisory,
  } = useWhaleAdvisoryData(watchlistOnly, isDiscoveryMode, { activePortfolioId });

  useEffect(() => localStorage.setItem('vninvest:risk-mode', riskMode), [riskMode]);
  useEffect(() => localStorage.setItem('vninvest:advisory-support-tab', supportTab), [supportTab]);
  useEffect(() => {
    if (activeSymbol) loadRefreshInfo(activeSymbol);
  }, [activeSymbol, loadRefreshInfo]);

  const filteredStats = useMemo(() => {
    let list = Array.isArray(symbolStats) ? symbolStats : [];
    if (symbolSearch) {
      const q = symbolSearch.toLowerCase();
      list = list.filter(s => (s.symbol || '').toLowerCase().includes(q));
    }
    return list;
  }, [symbolStats, symbolSearch]);

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
    return items.filter(i => i.symbol === activeSymbol).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }, [activeSymbol, items]);

  const advisoryShellHostHref = useMemo(() => {
    const resolvedSymbol = String(activeSymbol || filteredStats[0]?.symbol || 'BCM').trim().toUpperCase();
    return resolvedSymbol ? `/ai-advisory/shell?symbol=${resolvedSymbol}` : '/ai-advisory/shell';
  }, [activeSymbol, filteredStats]);

  const refreshInfo = activeSymbol ? refreshInfoMap[activeSymbol] : null;

  return e(
    'div',
    { className: 'mx-auto max-w-[1800px] pt-6 pb-8 px-4 lg:px-8 space-y-4 min-h-screen bg-slate-950/20' },
    e(WhaleAdvisoryBentoHeader, {
      userPlan: userPlan,
      statsLoading: statsLoading,
      onRefresh: fetchData,
      shellHostHref: advisoryShellHostHref,
      showShellHostLink: packageShellHostEnabled,
    }),

    error ? e(
      'div',
      { className: 'p-20 text-center neon-glass-panel border-rose-500/20' },
      e('div', { className: 'text-rose-500 mb-4 scale-150 inline-block text-4xl' }, '⚠️'),
      e('p', { className: 'text-slate-300 font-bold text-lg' }, error),
      e('button', { onClick: fetchData, className: 'mt-6 px-6 py-2 bg-slate-800 rounded-xl text-cyan-400 hover:bg-slate-700 transition-all' }, 'Thử lại')
    ) : e(
      'div',
      { className: 'space-y-4' },
      // Top row: Command Panel + Symbol Sidebar
      e(
        'div',
        { className: 'grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch' },
        e(
          'div',
          { className: 'xl:col-span-2 flex flex-col min-h-[560px]', key: `main-${activeSymbol}` },
          e(WhaleAdvisoryCommandPanel, {
            item: activeItem,
            activeSymbol: activeSymbol,
            onRefresh: handleRefreshAdvisory,
            onDeleteCurrent: handleDeleteAdvisory,
            refreshing: !!pendingRefreshSymbols[activeSymbol],
            deleting: !!pendingDeleteSymbols[activeSymbol],
            rowMessage: rowMessages[activeSymbol],
          })
        ),
        e(
          'div',
          { className: 'xl:col-span-1 flex flex-col min-h-[560px]' },
          e(WhaleSymbolSidebar, {
            symbolStats: symbolStats,
            symbolSearch: symbolSearch,
            setSymbolSearch: setSymbolSearch,
            activeSymbol: activeSymbol,
            setActiveSymbol: setActiveSymbol,
            page: page,
            setPage: setPage,
            pageSize: pageSize,
            setPageSize: setPageSize,
          })
        )
      ),

      // Bottom row: Bubble Chart + Support Panel
      e(
        'div',
        { className: 'grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch' },
        e(
          'div',
          { className: 'xl:col-span-2 min-h-[360px]' },
          e(
            'div',
            { className: 'h-full neon-glass-panel p-3' },
            activeSymbol ? e(FactsFirstWhaleBubbleChart, { symbol: activeSymbol, isEmbedded: true }) : e(
              'div',
              { className: 'flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl' },
              e('div', { className: 'text-3xl opacity-20' }, '🐋'),
              e('p', { className: 'text-[9px] font-black uppercase tracking-widest' }, 'Chọn mã để xem biểu đồ')
            )
          )
        ),
        e(
          'div',
          { className: 'xl:col-span-1 min-h-[360px] neon-glass-panel overflow-hidden flex flex-col' },
          e(
            'div',
            { className: 'p-2 border-b border-slate-800/60 bg-slate-900/50 grid grid-cols-3 gap-2' },
            e('button', {
              type: 'button',
              onClick: () => setSupportTab('telemetry'),
              className: `px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`,
            }, 'Telemetry'),
            e('button', {
              type: 'button',
              onClick: () => setSupportTab('risk'),
              className: `px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'risk' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`,
            }, 'Rủi ro'),
            e('button', {
              type: 'button',
              onClick: () => setSupportTab('history'),
              className: `px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${supportTab === 'history' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900/40 text-slate-400 border border-slate-800/60 hover:text-slate-200'}`,
            }, 'Lịch sử')
          ),
          e(
            'div',
            { className: 'flex-1 p-3 overflow-y-auto panel-scrollbar' },
            supportTab === 'telemetry' && e(
              'div',
              { className: 'rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3' },
              e(TrustTelemetryPanel)
            ),
            supportTab === 'risk' && e(
              'div',
              { className: 'rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3' },
              e(RiskModeSelector, { symbol: activeSymbol, value: riskMode, onChange: setRiskMode })
            ),
            supportTab === 'history' && e(
              'div',
              { className: 'rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3' },
              e(RecommendationHistoryMini, { symbol: activeSymbol, limit: 6 })
            )
          )
        )
      )
    ),

    refreshInfo && e(
      'footer',
      { className: 'flex items-center gap-3 text-slate-500 text-xs mt-4' },
      e('div', { className: 'flex items-center gap-3' },
        e('span', { className: 'text-slate-600' }, 'Token còn lại'),
        e('span', { className: 'text-cyan-400 font-mono text-xs scale-110' }, (refreshInfo.tokens_remaining_today || 0).toLocaleString())
      ),
      e('div', { className: 'w-1.5 h-1.5 rounded-full bg-slate-800' }),
      e('div', { className: 'flex items-center gap-3' },
        e('span', { className: 'text-slate-600' }, 'Hạn mức làm mới'),
        e('span', { className: 'px-3 py-1 bg-slate-950 rounded-lg text-emerald-400 font-mono text-xs' },
          e('span', null, refreshInfo.auto_refreshes_used_today || 0),
          e('span', { className: 'text-slate-700 mx-1' }, '/'),
          e('span', null, refreshInfo.advisory_max_auto_refreshes_per_day || 0)
        )
      ),
      refreshInfo.next_refresh_at && e(
        'div',
        { className: 'flex items-center gap-3' },
        e('div', { className: 'w-1.5 h-1.5 rounded-full bg-slate-800' }),
        e('div', { className: 'flex items-center gap-3' },
          e('span', { className: 'text-slate-600' }, 'Chu kỳ tiếp theo'),
          e('span', { className: 'text-amber-400 font-mono text-xs italic' }, fmtTime(refreshInfo.next_refresh_at))
        )
      )
    )
  );
}

export default WhaleAdvisoryPage;