import React, { useMemo } from 'react';
import { useI18n } from '../../context/LangContext';
import AllocationPieChart from '../AllocationPieChart';
import ModernPortfolioDigest from './ModernPortfolioDigest';
import EquityVsBenchmarkChart from '../EquityVsBenchmarkChart';

export default function ModernSidebar({ portfolioId, alerts, breadth, analytics, digest, loading, portfolioSymbols = [] }) {
  const { t } = useI18n();
  const trackedSymbolSet = useMemo(
    () => new Set((portfolioSymbols || []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean)),
    [portfolioSymbols],
  );
  const filteredAlerts = useMemo(() => {
    if (!trackedSymbolSet.size) return [];
    return (alerts || []).filter((alert) => trackedSymbolSet.has(String(alert?.symbol || '').trim().toUpperCase()));
  }, [alerts, trackedSymbolSet]);

  const metrics = [
    { 
      label: 'Alpha (Jensen)', 
      value: analytics?.alpha_annual_pct, 
      color: (analytics?.alpha_annual_pct >= 0) ? 'text-emerald-400' : 'text-rose-400', 
      unit: '%' 
    },
    { 
      label: 'Beta', 
      value: analytics?.beta, 
      color: 'text-slate-200' 
    },
    { 
      label: 'Sharpe Ratio', 
      value: analytics?.sharpe_ratio, 
      color: (analytics?.sharpe_ratio >= 0) ? 'text-emerald-400' : 'text-rose-400' 
    },
    { 
      label: 'Max Drawdown', 
      value: analytics?.max_drawdown_pct, 
      color: 'text-rose-400', 
      unit: '%' 
    },
  ];

  return (
    <div className="panel-scrollbar flex max-h-none flex-col gap-6 overflow-visible pr-2 pb-6">
      {/* Risk Metrics Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-5 flex items-center gap-2">
          <span className="w-1 h-3 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
          {t('dashboardRealtime.riskPerformanceTitle', { defaultValue: 'Chỉ số Rủi ro & Hiệu suất' })}
        </h3>
        <div className="grid grid-cols-2 gap-y-5 gap-x-8">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex flex-col">
               <span className="text-[10px] text-slate-500 mb-1.5 font-medium">{m.label}</span>
               <span className={`text-sm font-black tracking-tight ${m.color}`}>
                 {loading ? '...' : (m.value !== null && m.value !== undefined) ? `${m.value}${m.unit || ''}` : 'N/A'}
               </span>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0">
        <EquityVsBenchmarkChart portfolioId={portfolioId} />
      </div>

      {/* Allocation Module */}
      <div className="shrink-0">
        <AllocationPieChart portfolioId={portfolioId} />
      </div>


      {/* Live Alerts Stream */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[280px]">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1 h-3 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
            {t('dashboardRealtime.liveSignalStreamTitle', { defaultValue: 'Luồng tín hiệu Live' })}
          </div>
          <span className="text-[9px] px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
            {filteredAlerts.length} {t('dashboardRealtime.eventsLabel', { defaultValue: 'Sự kiện' })}
          </span>
        </h3>
        <div className="flex-1 space-y-3">
          {filteredAlerts.slice(0, 5).map((alert, idx) => (
            <div key={idx} className="group text-[11px] border-l-2 border-slate-700 hover:border-emerald-500 pl-4 py-1.5 bg-slate-900/30 hover:bg-slate-900/60 transition-all rounded-r-md">
              <div className="flex justify-between mb-0.5">
                <span className="font-black text-emerald-400">{alert.symbol}</span>
                <span className="text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors">{alert.time || t('dashboardRealtime.justNow', { defaultValue: 'Vừa xong' })}</span>
              </div>
              <p className="text-slate-400 leading-normal line-clamp-1">{alert.message || t('dashboardRealtime.liveSignalFallbackMessage', { defaultValue: 'Phát hiện tín hiệu mua/bán từ ví cá mập.' })}</p>
            </div>
          ))}
          {filteredAlerts.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-600 text-[11px] italic py-8">
               <div className="mb-2 opacity-20 text-2xl">📡</div>
               {t('dashboardRealtime.noLiveSignalsForTrackedSymbols', { defaultValue: 'Chưa có tín hiệu thời gian thực cho các mã đang theo dõi.' })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
