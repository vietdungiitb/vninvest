import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useI18n } from '../../context/LangContext.js';
import PaginationBar from '../shared/PaginationBar.jsx';
import { buildModernDashboardSymbolUniverse, filterUniverseByScope } from '../../utils/modernDashboardSymbolUniverse.js';
import WhaleAnalyticsTab from './WhaleAnalyticsTab.jsx';
import AIAdvisorDeckPanel from './AIAdvisorDeckPanel.jsx';

export default function FactsFirstModularPositionDeck({
  holdings = [],
  trackedSymbols = [],
  watchlistGroups = [],
  loading = false,
  quotesBySymbol = {},
  technicals = [],
  alerts = [],
  analytics = null,
  digest = null,
  onRequestDigest = null,
  selectedSession = null,
  onSelectSession = null,
  selectedSymbol: selectedSymbolProp = 'all',
  onSelectSymbol = null,
  className = '',
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [symbolScope, setSymbolScope] = useState('holdings');
  const [selectedSymbol, setSelectedSymbol] = useState(selectedSymbolProp || 'all');

  useEffect(() => {
    if (selectedSymbolProp && selectedSymbolProp !== selectedSymbol) {
      setSelectedSymbol(selectedSymbolProp);
    }
  }, [selectedSymbolProp, selectedSymbol]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const isOverviewTab = activeTab === 'overview';
  const isTechnicalTab = activeTab === 'technical';
  const isWhaleTab = activeTab === 'whale';
  const isAITab = activeTab === 'ai';
  const needsTechnicalsView = isTechnicalTab || isAITab;

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: '📋' },
    { id: 'technical', label: 'Kỹ thuật', icon: '📊' },
    { id: 'whale', label: 'Cá mập', icon: '🐋' },
    { id: 'ai', label: 'AI Bot', icon: '🤖' },
  ];

  // Build symbol universe
  const symbolUniverse = useMemo(() => {
    return buildModernDashboardSymbolUniverse({
      holdings,
      trackedSymbols,
      watchlistGroups,
      quotesBySymbol,
    });
  }, [holdings, trackedSymbols, watchlistGroups, quotesBySymbol]);

  const scopeOptions = useMemo(() => {
    const counts = {
      holdings: symbolUniverse.filter((item) => item.in_holdings).length,
      tracked: symbolUniverse.filter((item) => item.in_tracked).length,
      watchlist: symbolUniverse.filter((item) => item.in_watchlist).length,
      all: symbolUniverse.length,
    };

    return [
      { value: 'holdings', label: t('modernDeck.scopeHoldings', 'Đang nắm giữ'), count: counts.holdings },
      { value: 'tracked', label: t('modernDeck.scopeTracked', 'Theo dõi riêng'), count: counts.tracked },
      { value: 'watchlist', label: t('modernDeck.scopeWatchlist', 'Watchlist'), count: counts.watchlist },
      { value: 'all', label: t('modernDeck.scopeAll', 'Tất cả'), count: counts.all },
    ];
  }, [symbolUniverse, t]);

  const scopedUniverse = useMemo(
    () => filterUniverseByScope(symbolUniverse, symbolScope),
    [symbolUniverse, symbolScope],
  );

  const symbolOptions = useMemo(
    () => scopedUniverse.map((item) => item.symbol).filter(Boolean),
    [scopedUniverse],
  );

  useEffect(() => {
    if (selectedSymbol !== 'all' && !symbolOptions.includes(selectedSymbol)) {
      setSelectedSymbol('all');
    }
  }, [selectedSymbol, symbolOptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [symbolScope, selectedSymbol]);

  const activeSymbolSet = useMemo(() => {
    if (selectedSymbol !== 'all') {
      return new Set([selectedSymbol]);
    }
    return new Set(symbolOptions);
  }, [selectedSymbol, symbolOptions]);

  const filteredOverviewRows = useMemo(
    () => {
      if (!isOverviewTab) return [];
      return scopedUniverse.filter((item) => activeSymbolSet.has(String(item?.symbol || '').trim().toUpperCase()));
    },
    [isOverviewTab, scopedUniverse, activeSymbolSet],
  );

  const filteredTechnicals = useMemo(
    () => {
      if (!needsTechnicalsView) return [];
      return (technicals || []).filter((item) => activeSymbolSet.has(String(item?.symbol || '').trim().toUpperCase()));
    },
    [needsTechnicalsView, technicals, activeSymbolSet],
  );

  const pagedOverviewRows = useMemo(() => {
    if (!isOverviewTab) return [];
    const start = (currentPage - 1) * pageSize;
    return filteredOverviewRows.slice(start, start + pageSize);
  }, [isOverviewTab, filteredOverviewRows, currentPage, pageSize]);

  const pagedTechnicals = useMemo(() => {
    if (!isTechnicalTab) return [];
    const start = (currentPage - 1) * pageSize;
    return filteredTechnicals.slice(start, start + pageSize);
  }, [isTechnicalTab, filteredTechnicals, currentPage, pageSize]);

  const fmtNumber = (value, digits = 0) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return Number(value).toLocaleString('vi-VN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const fmtSignedPercent = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    const numeric = Number(value);
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(digits)}%`;
  };

  const sourceBadgeClass = {
    holdings: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    tracked: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    watchlist: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  };

  const sourceBadgeLabel = {
    holdings: t('modernDeck.badgeHoldings', 'Holding'),
    tracked: t('modernDeck.badgeTracked', 'Tracked'),
    watchlist: t('modernDeck.badgeWatchlist', 'Watchlist'),
  };

  return (
    <div className={`bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full ${className}`}>
      {selectedSession && (
        <div className="flex items-center justify-between bg-emerald-950/40 border-b border-emerald-800/30 px-4 py-2 text-[11px] text-emerald-300">
          <span>Phiên đang chọn: <strong>{typeof selectedSession === 'object' ? (selectedSession.tradeDate || selectedSession.sessionDate || JSON.stringify(selectedSession)) : selectedSession}</strong></span>
          <button onClick={() => onSelectSession?.(null)} className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase">Hủy</button>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            } focus-visible:outline-none`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t('modernDeck.scopeLabel', 'Phạm vi mã')}
          </label>
          <select
            value={symbolScope}
            onChange={(event) => setSymbolScope(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t('modernDeck.symbolLabel', 'Mã')}
          </label>
          <select
            value={selectedSymbol}
            onChange={(event) => {
              const val = event.target.value;
              setSelectedSymbol(val);
              onSelectSymbol?.(val === 'all' ? null : val);
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">{t('modernDeck.symbolAll', 'Tất cả mã')}</option>
            {symbolOptions.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-400">
          {t('modernDeck.scopeSummary', {
            defaultValue: '{count} mã trong phạm vi hiện tại',
            count: symbolOptions.length,
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden p-2 min-h-[400px]">
        {isOverviewTab && (
          <div className="h-full flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto panel-scrollbar">
               {!loading && filteredOverviewRows.length === 0 ? (
                 <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center text-slate-500">
                   <div className="text-4xl opacity-30">📭</div>
                   <div>
                     <p className="text-base font-semibold text-slate-300">
                       {t('modernDeck.overviewEmptyTitle', 'Không có mã trong phạm vi đã chọn')}
                     </p>
                     <p className="mt-1 max-w-md text-sm text-slate-500">
                       {t('modernDeck.overviewEmptyHelp', 'Hãy đổi phạm vi/mã ở toolbar. Nếu muốn có dữ liệu vị thế, bạn có thể thêm giao dịch tại trang Transactions.')}
                     </p>
                   </div>
                 </div>
               ) : (
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider">
                       <th className="px-3 py-2">{t('modernDeck.headerSymbol', 'Mã')}</th>
                       <th className="px-3 py-2">{t('modernDeck.headerSource', 'Nguồn')}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerCurrentPrice', 'Giá hiện tại')}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerChange', '% thay đổi')}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerQuantity', 'Số lượng')}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerAvgCost', 'Giá vốn TB')}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerMarketValue', 'Giá trị TT')}</th>
                     </tr>
                   </thead>
                   <tbody className="text-xs">
                     {loading && (
                       <tr>
                         <td colSpan="7" className="py-4 text-center animate-pulse">{t('modernDeck.loading', 'Đang tải...')}</td>
                       </tr>
                     )}
                     {!loading && pagedOverviewRows.map((row) => (
                       <tr key={row.symbol} className="border-b border-slate-800/30 hover:bg-slate-800/30 cursor-pointer" onClick={() => {
                         setSelectedSymbol(row.symbol);
                         onSelectSymbol?.(row.symbol);
                       }}>
                         <td className="px-3 py-2">
                           <div className="font-bold text-slate-200">{row.symbol}</div>
                           <div className="text-[11px] text-slate-500">{row.company_name || '--'}</div>
                         </td>
                         <td className="px-3 py-2">
                           <div className="flex flex-wrap gap-1">
                             {row.source_tags?.length
                               ? row.source_tags.map((tag) => (
                                   <span
                                     key={`${row.symbol}-${tag}`}
                                     className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sourceBadgeClass[tag] || 'border-slate-700 text-slate-300'}`}
                                   >
                                     {sourceBadgeLabel[tag] || tag}
                                   </span>
                                 ))
                               : <span className="text-slate-500">--</span>}
                           </div>
                         </td>
                         <td className="px-3 py-2 text-right text-slate-300">{fmtNumber(row.current_price)}</td>
                         <td className={`px-3 py-2 text-right font-bold ${Number(row.change_pct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {fmtSignedPercent(row.change_pct)}
                         </td>
                         <td className="px-3 py-2 text-right text-slate-300">
                           {row.in_holdings ? fmtNumber(row.quantity) : '--'}
                         </td>
                         <td className="px-3 py-2 text-right text-slate-400">
                           {row.in_holdings ? fmtNumber(row.avg_cost) : '--'}
                         </td>
                         <td className="px-3 py-2 text-right text-slate-200 font-bold">
                           {row.in_holdings ? fmtNumber(row.market_value) : '--'}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
             {!loading && filteredOverviewRows.length > 0 && (
               <PaginationBar
                 total={filteredOverviewRows.length}
                 page={currentPage}
                 size={pageSize}
                 onPageChange={setCurrentPage}
                 onSizeChange={handlePageSizeChange}
               />
             )}
          </div>
        )}

        {isTechnicalTab && (
          <div className="h-full flex flex-col overflow-hidden">
             {symbolScope !== 'holdings' && (
               <div className="mb-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                 {t('modernDeck.technicalScopeHint', 'Tab Kỹ thuật hiện đang lọc trên dữ liệu kỹ thuật sẵn có. Technicals cho tracked/watchlist/all sẽ đầy đủ sau khi bulk API theo symbol universe được triển khai.')}
               </div>
             )}
             <div className="flex-1 overflow-y-auto panel-scrollbar">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider">
                     <th className="px-3 py-2">Mã</th>
                     <th className="px-3 py-2 text-right">RSI (14)</th>
                     <th className="px-3 py-2 text-right">SMA20</th>
                     <th className="px-3 py-2 text-right">SMA50</th>
                     <th className="px-3 py-2 text-right">Momentum</th>
                   </tr>
                 </thead>
                 <tbody className="text-xs">
                   {loading ? (
                     <tr><td colSpan="5" className="text-center py-4 animate-pulse">Đang tải...</td></tr>
                   ) : pagedTechnicals.map((tech, idx) => (
                     <tr key={idx} className="border-b border-slate-800/30 hover:bg-slate-800/30 cursor-pointer" onClick={() => {
                       setSelectedSymbol(tech.symbol);
                       onSelectSymbol?.(tech.symbol);
                     }}>
                       <td className="px-3 py-2 font-bold text-slate-200">{tech.symbol}</td>
                       <td className={`px-3 py-2 text-right font-bold ${tech.rsi_14 > 70 ? 'text-rose-400' : tech.rsi_14 < 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                         {tech.rsi_14 || '--'}
                       </td>
                       <td className="px-3 py-2 text-right text-slate-400">{tech.sma20?.toLocaleString('vi-VN')}</td>
                       <td className="px-3 py-2 text-right text-slate-400">{tech.sma50?.toLocaleString('vi-VN')}</td>
                       <td className={`px-3 py-2 text-right font-bold ${tech.momentum_20d_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {tech.momentum_20d_pct?.toFixed(2)}%
                       </td>
                     </tr>
                   ))}
                   {filteredTechnicals.length === 0 && !loading && (
                     <tr><td colSpan="5" className="text-center py-4 text-slate-600 italic">Không có dữ liệu kỹ thuật.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
             {!loading && filteredTechnicals.length > 0 && (
               <PaginationBar
                 total={filteredTechnicals.length}
                 page={currentPage}
                 size={pageSize}
                 onPageChange={setCurrentPage}
                 onSizeChange={handlePageSizeChange}
               />
             )}
          </div>
        )}

        {isWhaleTab && (
          <div className="h-full flex flex-col overflow-hidden min-h-[300px]">
            <WhaleAnalyticsTab
              holdings={holdings}
              quotesBySymbol={quotesBySymbol}
              selectedSymbol={selectedSymbol !== 'all' ? selectedSymbol : undefined}
              symbolOptions={symbolOptions}
            />
          </div>
        )}

        {isAITab && (
          <AIAdvisorDeckPanel
            holdings={holdings}
            technicals={technicals}
            alerts={alerts}
            analytics={analytics}
            digest={digest}
            onRequestDigest={onRequestDigest}
            symbolScope={symbolScope}
            symbolOptions={symbolOptions}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
