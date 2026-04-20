import React from 'react';
import { useI18n } from '../../context/LangContext';
import AllocationPieChart from '../AllocationPieChart';
import ModernPortfolioDigest from './ModernPortfolioDigest';

export default function ModernSidebar({ portfolioId, alerts, breadth, analytics, digest, loading }) {
  const { t } = useI18n();

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
    <div className="flex flex-col gap-4 h-full overflow-y-auto panel-scrollbar pr-1">
      {/* Risk Metrics Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
          <span className="w-1 h-3 bg-amber-500 rounded-full" />
          Chỉ số Rủi ro & Hiệu suất
        </h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          {metrics.map((m, idx) => (
            <div key={idx} className="flex flex-col">
               <span className="text-[10px] text-slate-500 mb-1">{m.label}</span>
               <span className={`text-sm font-bold ${m.color}`}>
                 {loading ? '...' : (m.value !== null && m.value !== undefined) ? `${m.value}${m.unit || ''}` : 'N/A'}
               </span>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation Module */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 min-h-[300px]">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
          <span className="w-1 h-3 bg-cyan-500 rounded-full" />
          Cơ cấu tài sản
        </h3>
        <AllocationPieChart portfolioId={portfolioId} />
      </div>

      {/* AI News Digest */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        <ModernPortfolioDigest digest={digest} loading={loading} />
      </div>

      {/* Live Alerts Stream (Compact Footer or dedicated module) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1 h-3 bg-rose-500 rounded-full" />
            Luồng tín hiệu Live
          </div>
          <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded">
            {alerts?.length || 0} event
          </span>
        </h3>
        <div className="space-y-3">
          {alerts?.slice(0, 5).map((alert, idx) => (
            <div key={idx} className="text-[11px] border-l-2 border-slate-700 pl-3 py-1 bg-slate-900/20 hover:bg-slate-900/40 transition-colors">
              <span className="text-slate-500 mr-2">{alert.time || '10:45'}</span>
              <span className="font-bold text-emerald-400 mr-2">{alert.symbol}</span>
              <span className="text-slate-300">{alert.message || 'Whale entry detected'}</span>
            </div>
          ))}
          {(!alerts || alerts.length === 0) && (
             <div className="text-slate-600 text-[11px] italic text-center py-8">
               Đang chờ tín hiệu thời gian thực...
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
