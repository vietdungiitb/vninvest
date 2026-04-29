import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../context/LangContext';
import Can from '../Can';
import RecommendationCardExplainability from './RecommendationCardExplainability';
import DataFreshnessBadge from './DataFreshnessBadge';
import ActionChecklist from './ActionChecklist';
import AgenticThoughtStream from './AgenticThoughtStream';

export default function WhaleAdvisoryCommandPanel({
  item,
  activeSymbol,
  onRefresh,
  onDeleteCurrent,
  refreshing,
  deleting,
  rowMessage,
}) {
  const { t } = useI18n();
  const advisory = item || {};
  const symbol = activeSymbol || advisory.symbol || '';
  const resolvedSymbol = String(symbol).toUpperCase();
  const hasAdvisory = Boolean(item);
  const side = (advisory.side || '').toUpperCase();
  const isBuy = side === 'BUY';

  // Helper formatting
  const fmtCompact = (val) => Number(val || 0).toLocaleString();
  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString() : '--:--';

  return (
    <div className={`flex flex-col h-full neon-glass-panel overflow-hidden bg-slate-900/20 transition-all duration-500 ${refreshing ? 'shadow-[0_0_35px_rgba(6,182,212,0.5)] border-cyan-500/60 scale-[1.01]' : 'agentic-glow-cyan'}`}>
      {/* Header Cell */}
      <div className="p-6 border-b border-slate-800/60 bg-slate-900/40">
         <div className="flex items-start justify-between">
            <div>
                <div className="flex items-center gap-3 mb-2">
                   <h2 className="text-2xl font-black tracking-tighter text-white">
                     {resolvedSymbol || t('whaleAdvisory.selectFallback')}
                   </h2>
                   {hasAdvisory && (
                     <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 ${
                          isBuy 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                        }`}>
                          {side}
                        </span>
                        {advisory.is_discovery && (
                           <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                             {advisory.discovery_bucket || 'Discovery'}
                           </span>
                        )}
                     </div>
                   )}
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <div className={`w-1.5 h-1.5 rounded-full ${hasAdvisory ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`} />
                     {t('whaleAdvisory.lastAnalysis', { time: fmtTime(advisory.created_at) })}
                   </span>
                </div>
             </div>
             
             <div className="flex gap-2">
                <button 
                 onClick={() => onRefresh?.(resolvedSymbol)}
                 disabled={refreshing || !resolvedSymbol}
                 className={`relative px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all overflow-hidden group ${
                   refreshing 
                   ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                   : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95'
                 }`}
                >
                  <span className="relative z-10">
                    {refreshing ? t('common.loading') : t('whaleAdvisory.smartRefresh')}
                  </span>
                  {!refreshing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  )}
                </button>
             </div>
          </div>
       </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto panel-scrollbar p-6 space-y-6 bg-slate-950/10">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm group relative overflow-hidden">
             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('whaleAdvisory.whaleIntensity')}</div>
             <div className="flex items-end gap-2">
               <div className="text-lg font-black text-white font-mono">{advisory.whale_intensity || 0}%</div>
               <div className="flex-1 h-1.5 bg-slate-800 rounded-full mb-1.5 overflow-hidden">
                  <div 
                   className={`h-full transition-all duration-1000 ${advisory.whale_intensity > 75 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]'}`}
                   style={{ width: `${advisory.whale_intensity || 0}%` }}
                  />
               </div>
             </div>
             <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm">
             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('whaleAdvisory.confidenceScore')}</div>
             <div className="text-lg font-black text-cyan-400 font-mono">{advisory.confidence || 0}%</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm">
             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('whaleAdvisory.trackingStatus')}</div>
             <div className="text-sm font-bold text-slate-300 uppercase">{hasAdvisory ? (advisory.is_discovery ? 'Discovery' : t('whaleAdvisory.active')) : t('whaleAdvisory.standby')}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-sm">
             <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('whaleAdvisory.valueReference')}</div>
             <div className="text-sm font-bold text-slate-300 font-mono">{fmtCompact(advisory.matched_value || 0)} <span className="text-[10px] text-slate-500 font-normal">{t('whaleAdvisory.currencyVnd')}</span></div>
          </div>
        </div>

        {/* Advisory Explanation Area */}
        {hasAdvisory ? (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-4 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                   <h3 className="text-[11px] font-black text-slate-200 uppercase tracking-widest">{t('whaleAdvisory.thoughtStreamTitle')}</h3>
                </div>
                <div className="text-[10px] font-mono text-slate-600">
                  {advisory.ai_provider} / {advisory.ai_model}
                </div>
              </div>
              
              {/* Agentic Thought Component */}
              <div className="p-6 rounded-3xl bg-slate-950/40 border border-slate-800/60 leading-relaxed shadow-inner group">
                 <div className="prose prose-invert prose-sm max-w-none">
                    <AgenticThoughtStream content={advisory.ai_summary} />
                 </div>
              </div>

              {/* Deep Analysis (Premium) */}
              <Can 
                I="read" 
                a="WhaleAdvisoryDetail"
                fallback={
                  <Link
                    to="/upgrade"
                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/30 text-[11px] text-amber-500 hover:bg-amber-500/10 transition-colors"
                  >
                    <span>🔒 {t('whaleHub.deepAnalysis')}</span>
                    <span className="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black text-[9px] uppercase">{t('whaleAdvisory.upgradeHint')}</span>
                  </Link>
                }
              >
                {advisory.ai_detail && (
                  <div className="mt-4 p-6 rounded-3xl bg-slate-900/30 border border-slate-800/40">
                     <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                        <span>{t('whaleAdvisory.detailedAnalysis')}</span>
                        <div className="h-px flex-1 mx-4 bg-slate-800/60" />
                     </h4>
                     <p className="text-slate-400 text-[13px] leading-7 italic font-medium">
                        {advisory.ai_detail}
                     </p>
                  </div>
                )}
              </Can>
           </div>
        ) : (
           <div className="flex flex-col items-center justify-center py-24 text-slate-600 text-center animate-pulse">
              <div className="mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-xs uppercase tracking-widest font-bold max-w-[200px]">
                {t('whaleAdvisory.noSymbolsActive')}
              </p>
           </div>
        )}

        {/* Explainability component integration */}
        {hasAdvisory && (
           <div className="rounded-3xl overflow-hidden border border-slate-800/40">
              <RecommendationCardExplainability 
                advisory={advisory}
                realtimeStatus="live"
              />
           </div>
        )}

        {/* Action Checklist integration */}
        {hasAdvisory && (
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/40 shadow-xl">
             <ActionChecklist
                symbol={resolvedSymbol}
                onProceed={() => onRefresh?.(resolvedSymbol)}
             />
          </div>
        )}

      </div>

      {/* Row Message / Secondary Actions */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-800/60 bg-slate-900/60 backdrop-blur-md">
        <div className="flex-1">
          {rowMessage ? (
            <p className="text-[11px] font-bold text-cyan-400 animate-in fade-in duration-300">{rowMessage}</p>
          ) : (
            <div className="flex gap-4">
               <Link to={`/whale-alerts/${resolvedSymbol}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors">{t('whaleAdvisory.whaleDashboardLink')}</Link>
               <Link to={`/stocks/${resolvedSymbol}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors">{t('whaleAdvisory.workspaceLink')}</Link>
            </div>
          )}
        </div>
        
        {hasAdvisory && onDeleteCurrent && (
          <button
            type="button"
            onClick={() => onDeleteCurrent?.(resolvedSymbol)}
            disabled={deleting || refreshing}
            className={`text-[9px] font-black uppercase tracking-widest transition-colors ${
              deleting ? 'text-slate-600' : 'text-slate-700 hover:text-rose-500'
            }`}
          >
            {deleting ? t('whaleAdvisory.deletingAdvisory') : t('whaleAdvisory.purgeAdvisory')}
          </button>
        )}
      </div>
    </div>
  );
}
