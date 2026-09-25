import { useState, useMemo, useEffect } from 'react';
import PaginationBar from '../shared/PaginationBar.jsx';
import WhaleAnalyticsTab from './WhaleAnalyticsTab.jsx';
import AIAdvisorDeckPanel from './AIAdvisorDeckPanel.jsx';
import { ClipboardList, BarChart3, Fish, Bot } from 'lucide-react';
import { buildModernDashboardSymbolUniverse, filterUniverseByScope } from '../../utils/modernDashboardSymbolUniverse.js';

interface Holding {
  symbol?: string;
  quantity?: number;
  current_price?: number;
  avg_cost?: number;
  market_value?: number;
  [key: string]: unknown;
}

interface CoreDashboardPositionDeckProps {
  holdings?: Holding[];
  trackedSymbols?: { symbol?: string; [key: string]: unknown }[];
  watchlistGroups?: { items?: { symbol?: string; [key: string]: unknown }[]; [key: string]: unknown }[];
  loading?: boolean;
  quotesBySymbol?: Record<string, { change_pct?: number; current_price?: number; [key: string]: unknown }>;
  technicals?: unknown[];
  alerts?: unknown[];
  analytics?: unknown;
  digest?: unknown;
  onRequestDigest?: () => void;
  selectedSession?: unknown;
  onSelectSession?: (session: unknown) => void;
  selectedSymbol?: string | null;
  onSelectSymbol?: (symbol: string | null) => void;
  className?: string;
}

export function CoreDashboardPositionDeck({
  holdings = [],
  trackedSymbols = [],
  watchlistGroups = [],
  loading = false,
  quotesBySymbol = {},
  technicals = [],
  alerts = [],
  analytics = undefined,
  digest = undefined,
  onRequestDigest = undefined,
  selectedSession = undefined,
  onSelectSession = undefined,
  selectedSymbol: selectedSymbolProp = 'all',
  onSelectSymbol = undefined,
  className = '',
}: CoreDashboardPositionDeckProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [symbolScope, setSymbolScope] = useState('all');
  const [selectedSymbol, setSelectedSymbol] = useState(selectedSymbolProp || 'all');

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const isOverviewTab = activeTab === 'overview';
  const isTechnicalTab = activeTab === 'technical';
  const isWhaleTab = activeTab === 'whale';
  const isAITab = activeTab === 'ai';
  const needsTechnicalsView = isTechnicalTab || isAITab;

  const tabs = [
    { id: 'overview' as const, label: 'Tổng quan', icon: ClipboardList },
    { id: 'technical' as const, label: 'Kỹ thuật', icon: BarChart3 },
    { id: 'whale' as const, label: 'Cá mập', icon: Fish },
    { id: 'ai' as const, label: 'AI Bot', icon: Bot },
  ];

  const symbolUniverse = useMemo(() => {
    return buildModernDashboardSymbolUniverse({
      holdings: holdings as any,
      trackedSymbols: trackedSymbols as any,
      watchlistGroups: watchlistGroups as any,
      quotesBySymbol: quotesBySymbol as any,
    });
  }, [holdings, trackedSymbols, watchlistGroups, quotesBySymbol]);

  const scopeOptions = useMemo(() => {
    const counts = {
      holdings: symbolUniverse.filter((item: any) => item.in_holdings).length,
      tracked: symbolUniverse.filter((item: any) => item.in_tracked).length,
      watchlist: symbolUniverse.filter((item: any) => item.in_watchlist).length,
      all: symbolUniverse.length,
    };
    return [
      { value: 'holdings', label: 'Đang nắm giữ', count: counts.holdings },
      { value: 'tracked', label: 'Theo dõi riêng', count: counts.tracked },
      { value: 'watchlist', label: 'Watchlist', count: counts.watchlist },
      { value: 'all', label: 'Tất cả', count: counts.all },
    ];
  }, [symbolUniverse]);

  const scopedUniverse = useMemo(
    () => filterUniverseByScope(symbolUniverse, symbolScope),
    [symbolUniverse, symbolScope],
  );

  const symbolOptions = useMemo(
    () => scopedUniverse.map((item: any) => item.symbol).filter(Boolean),
    [scopedUniverse],
  );

  // Synchronize parent selectedSymbolProp selection changes
  useEffect(() => {
    const target = selectedSymbolProp || 'all';
    if (target !== selectedSymbol) {
      // Auto-adjust scope if target is a specific symbol not present in current scope
      if (target !== 'all') {
        const uppercaseTarget = target.trim().toUpperCase();
        const found = symbolUniverse.find((item: any) => String(item?.symbol || '').trim().toUpperCase() === uppercaseTarget);
        if (found) {
          const currentScopeSymbols = scopedUniverse.map((item: any) => String(item.symbol || '').trim().toUpperCase());
          if (!currentScopeSymbols.includes(uppercaseTarget)) {
            if (found.in_holdings) {
              setSymbolScope('holdings');
            } else if (found.in_tracked) {
              setSymbolScope('tracked');
            } else if (found.in_watchlist) {
              setSymbolScope('watchlist');
            } else {
              setSymbolScope('all');
            }
          }
        } else {
          setSymbolScope('all');
        }
      }
      setSelectedSymbol(target);
    }
  }, [selectedSymbolProp, selectedSymbol, symbolUniverse, scopedUniverse]);

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

  const filteredOverviewRows = useMemo(() => {
    if (!isOverviewTab) return [];
    return scopedUniverse.filter((item: any) => activeSymbolSet.has(String(item?.symbol || '').trim().toUpperCase()));
  }, [isOverviewTab, scopedUniverse, activeSymbolSet]);

  const filteredTechnicals = useMemo(() => {
    if (!needsTechnicalsView) return [];
    const techMap = new Map();
    (technicals || []).forEach((item: any) => {
      const sym = String(item?.symbol || '').trim().toUpperCase();
      if (sym) {
        techMap.set(sym, item);
      }
    });

    const symbolsToShow = selectedSymbol !== 'all' && selectedSymbol
      ? [selectedSymbol]
      : scopedUniverse.map((item: any) => item.symbol).filter(Boolean);

    return symbolsToShow.map((symbol) => {
      const upperSym = String(symbol).trim().toUpperCase();
      const existing = techMap.get(upperSym);
      if (existing) {
        return existing;
      }
      return {
        symbol: upperSym,
        rsi_14: null,
        sma20: null,
        sma50: null,
        momentum_20d_pct: null,
      };
    });
  }, [needsTechnicalsView, technicals, selectedSymbol, scopedUniverse]);

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

  const fmtNumber = (value: unknown, digits = 0) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return Number(value).toLocaleString('vi-VN', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const fmtSignedPercent = (value: unknown, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    const numeric = Number(value);
    const sign = numeric > 0 ? '+' : '';
    return `${sign}${numeric.toFixed(digits)}%`;
  };

  const sourceBadgeClass: Record<string, string> = {
    holdings: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    tracked: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    watchlist: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  };

  const sourceBadgeLabel: Record<string, string> = {
    holdings: 'Holding',
    tracked: 'Tracked',
    watchlist: 'Watchlist',
  };

  return (
    <div className={`dashboard-full-width-deck flex flex-col ${className}`}>
      {selectedSession ? (
        <div className="flex items-center justify-between bg-emerald-950/40 border-b border-emerald-800/30 px-4 py-2 text-[var(--fs-2xs)] text-emerald-300">
          <span>Phiên đang chọn: <strong>{typeof selectedSession === 'object' ? JSON.stringify(selectedSession) : String(selectedSession as string)}</strong></span>
          <button onClick={() => onSelectSession?.(null)} className="text-[var(--fs-2xs)] text-slate-500 hover:text-slate-300 font-bold uppercase">Hủy</button>
        </div>
      ) : null}

      <div className="flex items-center gap-1 bg-slate-900/80 p-1 border-b border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
              } focus-visible:outline-none`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="text-[var(--fs-2xs)] font-bold uppercase tracking-widest text-slate-500">Phạm vi mã</label>
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
          <label className="text-[var(--fs-2xs)] font-bold uppercase tracking-widest text-slate-500">Mã</label>
          <select
            value={selectedSymbol}
            onChange={(event) => {
              const val = event.target.value;
              setSelectedSymbol(val);
              onSelectSymbol?.(val === 'all' ? null : val);
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">Tất cả mã</option>
            {symbolOptions.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-[var(--fs-2xs)] text-slate-400">
          {symbolOptions.length} mã trong phạm vi hiện tại
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 min-h-[400px]">
        {isOverviewTab && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto panel-scrollbar">
              {!loading && filteredOverviewRows.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center text-slate-500">
                  <div className="text-4xl opacity-30">📭</div>
                  <div>
                    <p className="text-base font-semibold text-slate-300">Không có mã trong phạm vi đã chọn</p>
                    <p className="mt-1 max-w-md text-sm text-slate-500">Hãy đổi phạm vi/mã ở toolbar.</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[var(--fs-2xs)] text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-2">Mã</th>
                      <th className="px-3 py-2">Nguồn</th>
                      <th className="px-3 py-2 text-right">Giá hiện tại</th>
                      <th className="px-3 py-2 text-right">% thay đổi</th>
                      <th className="px-3 py-2 text-right">Số lượng</th>
                      <th className="px-3 py-2 text-right">Giá vốn TB</th>
                      <th className="px-3 py-2 text-right">Giá trị TT</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {loading && (
                      <tr>
                        <td colSpan={7} className="py-4 text-center animate-pulse">Đang tải...</td>
                      </tr>
                    )}
                    {!loading && pagedOverviewRows.map((row: any) => (
                      <tr key={row.symbol} className="border-b border-slate-800/30 hover:bg-slate-800/30 cursor-pointer" onClick={() => {
                        setSelectedSymbol(row.symbol);
                        onSelectSymbol?.(row.symbol);
                      }}>
                        <td className="px-3 py-2">
                          <div className="font-bold text-slate-200">{row.symbol}</div>
                          <div className="text-[var(--fs-2xs)] text-slate-500">{row.company_name || '--'}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(row.source_tags?.length
                              ? row.source_tags.map((tag: string) => (
                                  <span
                                    key={`${row.symbol}-${tag}`}
                                    className={`rounded-full border px-2 py-0.5 text-[var(--fs-2xs)] font-bold ${sourceBadgeClass[tag] || 'border-slate-700 text-slate-300'}`}
                                  >
                                    {sourceBadgeLabel[tag] || tag}
                                  </span>
                                ))
                              : <span className="text-slate-500">--</span>)}
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
                Tab Kỹ thuật hiện đang lọc trên dữ liệu kỹ thuật sẵn có.
              </div>
            )}
            <div className="flex-1 overflow-y-auto panel-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[var(--fs-2xs)] text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Mã</th>
                    <th className="px-3 py-2 text-right">RSI (14)</th>
                    <th className="px-3 py-2 text-right">SMA20</th>
                    <th className="px-3 py-2 text-right">SMA50</th>
                    <th className="px-3 py-2 text-right">Momentum</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-4 animate-pulse">Đang tải...</td></tr>
                  ) : pagedTechnicals.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-400 italic">Không có dữ liệu kỹ thuật.</td></tr>
                  ) : (pagedTechnicals as any[]).map((tech: any, idx: number) => {
                    const hasRsi = tech.rsi_14 !== null && tech.rsi_14 !== undefined;
                    const rsiColor = hasRsi
                      ? tech.rsi_14 > 70
                        ? 'text-rose-400'
                        : tech.rsi_14 < 30
                        ? 'text-emerald-400'
                        : 'text-slate-200'
                      : 'text-slate-500';

                    const hasMomentum = tech.momentum_20d_pct !== null && tech.momentum_20d_pct !== undefined;
                    const momentumColor = hasMomentum
                      ? tech.momentum_20d_pct >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                      : 'text-slate-500';

                    return (
                      <tr key={`${tech.symbol}-${idx}`} className="border-b border-slate-800/30 hover:bg-slate-800/30 cursor-pointer" onClick={() => {
                        setSelectedSymbol(tech.symbol);
                        onSelectSymbol?.(tech.symbol);
                      }}>
                        <td className="px-3 py-2 font-bold text-slate-200">{tech.symbol}</td>
                        <td className={`px-3 py-2 text-right font-bold ${rsiColor}`}>
                          {hasRsi ? tech.rsi_14.toFixed(1) : '--'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {tech.sma20 !== null && tech.sma20 !== undefined ? tech.sma20.toLocaleString('vi-VN') : '--'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {tech.sma50 !== null && tech.sma50 !== undefined ? tech.sma50.toLocaleString('vi-VN') : '--'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${momentumColor}`}>
                          {hasMomentum ? `${tech.momentum_20d_pct.toFixed(2)}%` : '--'}
                        </td>
                      </tr>
                    );
                  })}
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
              holdings={holdings as any}
              quotesBySymbol={quotesBySymbol as any}
              selectedSymbol={selectedSymbol !== 'all' ? selectedSymbol : undefined}
              symbolOptions={symbolOptions as any}
            />
          </div>
        )}

        {isAITab && (
          <AIAdvisorDeckPanel
            holdings={holdings as any}
            technicals={technicals as any}
            alerts={alerts as any}
            analytics={analytics}
            digest={digest}
            onRequestDigest={onRequestDigest as any}
            symbolScope={symbolScope}
            symbolOptions={symbolOptions as any}
          />
        )}
      </div>
    </div>
  );
}

export default CoreDashboardPositionDeck;
