import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../context/LangContext';
import useWhaleAnalyticsData from '../hooks/useWhaleAnalyticsData';
import WhaleBubbleChart from './WhaleBubbleChart';

const TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15 phút' },
  { value: '30m', label: '30 phút' },
  { value: '1h', label: '1 giờ' },
  { value: 'morning', label: 'Phiên sáng' },
  { value: 'afternoon', label: 'Phiên chiều' },
  { value: 'session', label: 'Cả phiên' },
];

/**
 * WhaleAnalyticsTab Component
 * 
 * The Single Source of Truth (SSOT) wrapper for the Whale analytics view.
 * Manages shared state for symbol and timeframe, and orchestrates data fetching.
 * Features: Dual-pane sync, i18n compliance, and canonical time adapter integration.
 */
export default function WhaleAnalyticsTab({ 
  selectedSymbol, 
  holdings = [], 
  quotesBySymbol = {}, 
  symbolOptions = [] 
}) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState('session');
  const [symbol, setSymbol] = useState(selectedSymbol || '');

  // Parallel data fetching (Bubbles + Flow)
  const { data, loading, error } = useWhaleAnalyticsData(symbol, timeframe);

  // Available symbols calculation
  const availableSymbols = useMemo(() => {
    const sourceSymbols = Array.isArray(symbolOptions) && symbolOptions.length > 0
      ? symbolOptions
      : holdings.map((h) => String(h?.symbol || '').trim().toUpperCase()).filter(Boolean);
    const symbols = new Set(sourceSymbols);
    return Array.from(symbols).sort();
  }, [holdings, symbolOptions]);

  // Sync internal symbol state when selectedSymbol prop changes
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Handle auto-select if no symbol
  useEffect(() => {
    if (!symbol && availableSymbols.length > 0) {
      setSymbol(availableSymbols[0]);
    }
  }, [availableSymbols, symbol]);

  const smfi = data?.flow?.smfi ?? null;
  const strength = data?.flow?.dark_flow?.strength ?? 0;
  const isStale = Boolean(data?.meta?.is_stale);
  const isDegraded = Boolean(data?.meta?.degraded_mode);
  const staleReason = data?.meta?.stale_reason || null;
  const degradedBadgeLabel = staleReason === 'missing_intraday_ticks'
    ? (t('whaleAnalytics.degradedMissingIntraday') || 'Thiếu tick intraday')
    : (t('whaleAnalytics.degradedMode') || 'Thiếu dữ liệu tham chiếu');

  return (
    <div className="flex flex-col h-full bg-slate-950/20 overflow-hidden">
      {/* Shared Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/60 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-6">
           {/* Symbol Select */}
           <div className="flex items-center gap-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               {t('modernDeck.symbolLabel') || 'Mã CK'}
             </label>
             <select 
               value={symbol}
               onChange={(e) => setSymbol(e.target.value)}
               className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
             >
               {availableSymbols.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>
           
           {/* Timeframe Select */}
           <div className="flex items-center gap-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               {t('whaleAnalytics.timeframe') || 'Khoảng thời gian'}
             </label>
             <select 
               value={timeframe}
               onChange={(e) => setTimeframe(e.target.value)}
               className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 transition-all"
             >
               {TIMEFRAME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
             </select>
           </div>
        </div>

        {/* Real-time Insights Badges */}
        <div className="flex items-center gap-6">
          {smfi !== null && (
             <div className="flex flex-col items-end">
               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                 {t('whaleAnalytics.smfiIndex') || 'Chỉ số SMFI'}
               </span>
               <span className={`text-sm font-black ${smfi >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]`}>
                 {smfi > 0 ? '+' : ''}{smfi.toFixed(2)}
               </span>
             </div>
          )}
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
               {t('whaleAnalytics.instStrength') || 'Sức mạnh tổ chức'}
             </span>
             <div className="flex items-center gap-3">
               <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                 <div 
                   className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 transition-all duration-1000 ease-out" 
                   style={{ width: `${strength}%` }}
                 />
               </div>
               <span className="text-sm font-black text-slate-200">{strength.toFixed(1)}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-slate-950 to-slate-900/50">
        <div className="flex flex-col gap-3 p-4 max-w-[1600px] mx-auto">
          
          {/* Top Section: Whale Bubble Chart (Large) */}
          <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
             <div className="relative bg-slate-900/40 rounded-2xl border border-slate-800/60 shadow-2xl overflow-hidden">
                <WhaleBubbleChart 
                  isControlled={true}
                  externalSymbol={symbol}
                  externalTimeframe={timeframe}
                  externalData={data.bubbles}
                externalFlowData={data.flow}
                  externalLoading={loading}
                  externalError={error}
                  onTimeframeChange={setTimeframe}
                  onSymbolChange={setSymbol}
                  isEmbedded={true}
                  selectedSymbol={symbol}
                />
             </div>
          </div>

          {/* Summary Footer / Info */}
          <div className="flex justify-between items-center px-2 py-2">
             <p className="text-[10px] text-slate-500 italic max-w-md">
               {t('whaleAnalytics.disclaimer') || '* Dữ liệu dòng tiền và bubble được chuẩn hóa theo bucket thời gian tương ứng với timeframe đang chọn. Sức mạnh tổ chức (0-100) phản ánh mức độ tập trung của dòng tiền thông minh trong phiên.'}
             </p>
             <div className="flex gap-2">
                {isStale && (
                  <span className="px-2 py-1 rounded bg-amber-950/30 border border-amber-800/50 text-[9px] text-amber-300 font-bold uppercase">
                    {t('whaleAnalytics.staleData') || 'Dữ liệu chậm'}
                  </span>
                )}
                {isDegraded && (
                  <span className="px-2 py-1 rounded bg-rose-950/30 border border-rose-800/50 text-[9px] text-rose-300 font-bold uppercase">
                    {degradedBadgeLabel}
                  </span>
                )}
                <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-400 font-bold uppercase">
                  {t('whaleAnalytics.ssotVerified') || 'Xác thực SSOT'}
                </span>
                <span className="px-2 py-1 rounded bg-emerald-950/30 border border-emerald-800/50 text-[9px] text-emerald-400 font-bold uppercase">
                  {t('whaleAnalytics.realtimeFeed') || 'Dữ liệu Realtime'}
                </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
