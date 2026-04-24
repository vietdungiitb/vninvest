import React, { Suspense, lazy, useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/LangContext';
import OptimizationModal from './OptimizationModal';
import PaginationBar from '../shared/PaginationBar';
import { filterUniverseByScope } from '../../utils/modernDashboardSymbolUniverse';

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];
const WhaleAnalyticsTab = lazy(() => import('../WhaleAnalyticsTab'));

export default function ModularPositionDeck({ holdings, symbolUniverse = [], loading, quotesBySymbol, technicals, alerts, analytics, digest, onRequestDigest }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [symbolScope, setSymbolScope] = useState('holdings');
  const [selectedSymbol, setSelectedSymbol] = useState('all');
  const [showOptimization, setShowOptimization] = useState(false);

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
  const isAITab = activeTab === 'ai';
  const needsTechnicalsView = isTechnicalTab || isAITab;
  const needsHealthStats = isAITab || showOptimization;

  // Logic for Health Score Calculation
  const healthStats = useMemo(() => {
    if (!needsHealthStats) {
      return { hasData: false, score: 0, grade: 'N/A', color: 'text-slate-500' };
    }

    const hasAnalytics = analytics && [
      analytics.sharpe_ratio,
      analytics.alpha_annual_pct,
      analytics.max_drawdown_pct,
    ].some((value) => value !== null && value !== undefined);

    if (!hasAnalytics) return { hasData: false, score: 0, grade: 'N/A', color: 'text-slate-500' };
    
    const sharpe = analytics.sharpe_ratio || 0;
    const alpha = analytics.alpha_annual_pct || 0;
    const maxDD = Math.abs(analytics.max_drawdown_pct || 0);

    const sharpeScore = Math.min(Math.max(sharpe / 2.5, 0), 1) * 40;
    const alphaScore = Math.min(Math.max(alpha / 20, 0), 1) * 30;
    const ddScore = (1 - Math.min(maxDD / 30, 1)) * 30;
    
    const total = Math.round(sharpeScore + alphaScore + ddScore);
    
    let grade = 'F';
    let color = 'text-rose-500';
    if (total >= 90) { grade = 'A+'; color = 'text-emerald-400'; }
    else if (total >= 80) { grade = 'A'; color = 'text-emerald-500'; }
    else if (total >= 70) { grade = 'B'; color = 'text-sky-400'; }
    else if (total >= 60) { grade = 'C'; color = 'text-amber-400'; }
    else if (total >= 40) { grade = 'D'; color = 'text-orange-400'; }

    return { hasData: true, score: total, grade, color };
  }, [analytics, needsHealthStats]);

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: '📋' },
    { id: 'technical', label: 'Kỹ thuật', icon: '📊' },
    { id: 'whale', label: 'Cá mập', icon: '🐋' },
    { id: 'ai', label: 'AI Bot', icon: '🤖' },
  ];

  const scopeOptions = useMemo(() => {
    const counts = {
      holdings: symbolUniverse.filter((item) => item.in_holdings).length,
      tracked: symbolUniverse.filter((item) => item.in_tracked).length,
      watchlist: symbolUniverse.filter((item) => item.in_watchlist).length,
      all: symbolUniverse.length,
    };

    return [
      { value: 'holdings', label: t('modernDeck.scopeHoldings', { defaultValue: 'Đang nắm giữ' }), count: counts.holdings },
      { value: 'tracked', label: t('modernDeck.scopeTracked', { defaultValue: 'Theo dõi riêng' }), count: counts.tracked },
      { value: 'watchlist', label: t('modernDeck.scopeWatchlist', { defaultValue: 'Watchlist' }), count: counts.watchlist },
      { value: 'all', label: t('modernDeck.scopeAll', { defaultValue: 'Tất cả' }), count: counts.all },
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

  useEffect(() => {
    if (!isAITab) {
      return;
    }
    onRequestDigest?.();
  }, [isAITab, onRequestDigest]);

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

  // Paginated slices
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
    holdings: t('modernDeck.badgeHoldings', { defaultValue: 'Holding' }),
    tracked: t('modernDeck.badgeTracked', { defaultValue: 'Tracked' }),
    watchlist: t('modernDeck.badgeWatchlist', { defaultValue: 'Watchlist' }),
  };

  const isHoldingsScope = symbolScope === 'holdings';

  const aiScopeTitle = useMemo(() => {
    const option = scopeOptions.find((item) => item.value === symbolScope);
    return option?.label || t('modernDeck.scopeAll', { defaultValue: 'Tất cả' });
  }, [scopeOptions, symbolScope, t]);

  const aiMonitorSummary = useMemo(() => {
    if (!isAITab) {
      return {
        symbolsCount: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
      };
    }

    const symbolsCount = symbolOptions.length;
    const bullishCount = filteredTechnicals.filter((item) => Number(item.momentum_20d_pct) > 0).length;
    const bearishCount = filteredTechnicals.filter((item) => Number(item.momentum_20d_pct) < 0).length;
    const neutralCount = Math.max(0, filteredTechnicals.length - bullishCount - bearishCount);
    return {
      symbolsCount,
      bullishCount,
      bearishCount,
      neutralCount,
    };
  }, [isAITab, filteredTechnicals, symbolOptions]);

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Tab Header */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {t('modernDeck.scopeLabel', { defaultValue: 'Phạm vi mã' })}
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
            {t('modernDeck.symbolLabel', { defaultValue: 'Mã' })}
          </label>
          <select
            value={selectedSymbol}
            onChange={(event) => setSelectedSymbol(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">{t('modernDeck.symbolAll', { defaultValue: 'Tất cả mã' })}</option>
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

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-2">
        {activeTab === 'overview' && (
          <div className="h-full flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto panel-scrollbar">
               {!loading && filteredOverviewRows.length === 0 ? (
                 <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center text-slate-500">
                   <div className="text-4xl opacity-30">📭</div>
                   <div>
                     <p className="text-base font-semibold text-slate-300">
                       {t('modernDeck.overviewEmptyTitle', { defaultValue: 'Không có mã trong phạm vi đã chọn' })}
                     </p>
                     <p className="mt-1 max-w-md text-sm text-slate-500">
                       {t('modernDeck.overviewEmptyHelp', { defaultValue: 'Hãy đổi phạm vi/mã ở toolbar. Nếu muốn có dữ liệu vị thế, bạn có thể thêm giao dịch tại trang Transactions.' })}
                     </p>
                   </div>
                   <Link
                     to="/transactions"
                     className="rounded-lg border border-emerald-500/30 bg-emerald-600/15 px-4 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-600/25"
                   >
                     Mở Transactions
                   </Link>
                 </div>
               ) : (
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                       <th className="px-3 py-2">{t('modernDeck.headerSymbol', { defaultValue: 'Mã' })}</th>
                       <th className="px-3 py-2">{t('modernDeck.headerSource', { defaultValue: 'Nguồn' })}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerCurrentPrice', { defaultValue: 'Giá hiện tại' })}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerChange', { defaultValue: '% thay đổi' })}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerQuantity', { defaultValue: 'Số lượng' })}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerAvgCost', { defaultValue: 'Giá vốn TB' })}</th>
                       <th className="px-3 py-2 text-right">{t('modernDeck.headerMarketValue', { defaultValue: 'Giá trị TT' })}</th>
                     </tr>
                   </thead>
                   <tbody className="text-xs">
                     {loading && (
                       <tr>
                         <td colSpan="7" className="py-4 text-center animate-pulse">{t('modernDeck.loading', { defaultValue: 'Đang tải...' })}</td>
                       </tr>
                     )}
                     {!loading && pagedOverviewRows.map((row) => (
                       <tr key={row.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30">
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

        {activeTab === 'technical' && (
          <div className="h-full flex flex-col overflow-hidden">
             {symbolScope !== 'holdings' && (
               <div className="mb-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                 {t('modernDeck.technicalScopeHint', { defaultValue: 'Tab Kỹ thuật hiện đang lọc trên dữ liệu kỹ thuật sẵn có. Technicals cho tracked/watchlist/all sẽ đầy đủ sau khi bulk API theo symbol universe được triển khai.' })}
               </div>
             )}
             <div className="flex-1 overflow-y-auto panel-scrollbar">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
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
                     <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
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

        {activeTab === 'whale' && (
          <div className="h-full flex flex-col overflow-hidden">
            <Suspense
              fallback={(
                <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-400">
                  {t('modernDeck.loading', { defaultValue: 'Đang tải...' })}
                </div>
              )}
            >
              <WhaleAnalyticsTab
                holdings={holdings}
                quotesBySymbol={quotesBySymbol}
                selectedSymbol={selectedSymbol !== 'all' ? selectedSymbol : undefined}
                symbolOptions={symbolOptions}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="h-full overflow-y-auto panel-scrollbar p-6">
             {isHoldingsScope ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl">🤖</div>
                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6">
                       {t('modernDeck.aiHealthScoreTitle', { defaultValue: 'Portfolio Health Score' })}
                     </h4>
                     {healthStats.hasData ? (
                       <>
                         <div className="relative flex items-center justify-center w-32 h-32">
                           <svg className="w-full h-full transform -rotate-90">
                             <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                             <circle
                               cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                               strokeDasharray={364.4}
                               strokeDashoffset={364.4 - (364.4 * healthStats.score) / 100}
                               className={`${healthStats.color} transition-all duration-1000 ease-out`}
                             />
                           </svg>
                           <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-3xl font-black ${healthStats.color}`}>{healthStats.score}</span>
                              <span className="text-[10px] text-slate-500">/ 100</span>
                           </div>
                         </div>

                         <div className="mt-6 flex flex-col items-center">
                            <span className={`text-4xl font-black mb-1 ${healthStats.color}`}>{healthStats.grade}</span>
                            <span className="text-[10px] uppercase font-bold tracking-tighter text-slate-500">
                              {t('modernDeck.aiHealthScoreSubtitle', { defaultValue: 'Thanh khoản & Hiệu suất' })}
                            </span>
                         </div>
                       </>
                     ) : (
                       <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-slate-500">
                         <div className="mb-3 text-4xl opacity-25">🧠</div>
                         <p className="text-sm font-semibold text-slate-300">
                           {t('modernDeck.aiNoAnalyticsTitle', { defaultValue: 'Chưa có dữ liệu phân tích' })}
                         </p>
                         <p className="mt-1 max-w-xs text-xs text-slate-500">
                           {t('modernDeck.aiNoAnalyticsHelp', { defaultValue: 'Health Score sẽ xuất hiện khi danh mục có đủ dữ liệu analytics để tính Sharpe, Alpha và drawdown.' })}
                         </p>
                       </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-4">
                     <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                        <h5 className="text-[11px] font-bold text-emerald-400 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                          {t('modernDeck.aiCommentaryTitle', { defaultValue: 'AI Commentary' })}
                        </h5>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                          "{digest?.digest_summary || t('modernDeck.aiCommentaryEmpty', { defaultValue: 'Chưa có bản tóm tắt AI cho danh mục này. Hệ thống sẽ hiển thị khi có đủ dữ liệu tổng hợp.' })}"
                        </p>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                           <span className="text-[9px] text-slate-500 uppercase block mb-1">
                             {t('modernDeck.aiSharpeLabel', { defaultValue: 'Rủi ro (Sharpe)' })}
                           </span>
                           <span className={`text-sm font-bold ${analytics?.sharpe_ratio >= 1.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {analytics?.sharpe_ratio ?? 'N/A'}
                           </span>
                        </div>
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                           <span className="text-[9px] text-slate-500 uppercase block mb-1">
                             {t('modernDeck.aiDrawdownLabel', { defaultValue: 'Sụt giảm tối đa' })}
                           </span>
                           <span className="text-sm font-bold text-rose-400">
                            {analytics?.max_drawdown_pct ?? 'N/A'}{analytics?.max_drawdown_pct !== null && analytics?.max_drawdown_pct !== undefined ? '%' : ''}
                           </span>
                        </div>
                     </div>

                     <button
                        onClick={() => setShowOptimization(true)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                     >
                        {t('modernDeck.aiOptimizeButton', { defaultValue: 'Tối ưu hóa danh mục với AI' })}
                     </button>
                  </div>
               </div>
             ) : (
               <div className="flex flex-col gap-4">
                 <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                   {t('modernDeck.aiMonitorModeHint', {
                     defaultValue: 'AI tab đang ở chế độ monitor theo scope hiện tại. Portfolio Health Score và nút tối ưu hóa chỉ áp dụng cho scope holdings.',
                   })}
                 </div>

                 <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                   <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                     <div className="text-[10px] uppercase tracking-wider text-slate-500">
                       {t('modernDeck.aiMonitorScopeLabel', { defaultValue: 'Scope hiện tại' })}
                     </div>
                     <div className="mt-2 text-lg font-black text-slate-100">{aiScopeTitle}</div>
                   </div>
                   <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                     <div className="text-[10px] uppercase tracking-wider text-slate-500">
                       {t('modernDeck.aiMonitorSymbolsLabel', { defaultValue: 'Số mã monitor' })}
                     </div>
                     <div className="mt-2 text-2xl font-black text-slate-100">{aiMonitorSummary.symbolsCount}</div>
                   </div>
                   <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                     <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                       {t('modernDeck.aiMonitorBullishLabel', { defaultValue: 'Momentum dương' })}
                     </div>
                     <div className="mt-2 text-2xl font-black text-emerald-300">{aiMonitorSummary.bullishCount}</div>
                   </div>
                   <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                     <div className="text-[10px] uppercase tracking-wider text-rose-300">
                       {t('modernDeck.aiMonitorBearishLabel', { defaultValue: 'Momentum âm' })}
                     </div>
                     <div className="mt-2 text-2xl font-black text-rose-300">{aiMonitorSummary.bearishCount}</div>
                   </div>
                 </div>

                 <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                   <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                     {t('modernDeck.aiMonitorCommentaryTitle', { defaultValue: 'AI Monitor Commentary' })}
                   </h5>
                   <p className="text-sm leading-relaxed text-slate-300 italic">
                     "{digest?.digest_summary || t('modernDeck.aiCommentaryEmpty', { defaultValue: 'Chưa có bản tóm tắt AI cho danh mục này. Hệ thống sẽ hiển thị khi có đủ dữ liệu tổng hợp.' })}"
                   </p>
                 </div>

                 <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                   <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                     {t('modernDeck.aiMonitorFallbackTitle', { defaultValue: 'Fallback behavior (scope non-holdings)' })}
                   </h5>
                   <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                     <li>{t('modernDeck.aiMonitorFallbackLine1', { defaultValue: 'Portfolio Health Score được ẩn để tránh sai semantics.' })}</li>
                     <li>{t('modernDeck.aiMonitorFallbackLine2', { defaultValue: 'Nút tối ưu hóa danh mục bị tắt ngoài scope holdings.' })}</li>
                     <li>{t('modernDeck.aiMonitorFallbackLine3', { defaultValue: 'Nội dung AI tập trung theo monitor scope: symbols, momentum technical và digest hiện có.' })}</li>
                   </ul>
                 </div>
               </div>
             )}
          </div>
        )}

        {showOptimization && (
           <OptimizationModal 
              onClose={() => setShowOptimization(false)}
              holdings={holdings}
              technicals={technicals}
              analytics={analytics}
              currentScore={healthStats.score}
              alerts={alerts}
           />
        )}
      </div>
    </div>
  );
}
