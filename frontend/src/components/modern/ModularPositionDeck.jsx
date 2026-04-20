import React, { useState, useMemo } from 'react';
import { useI18n } from '../../context/LangContext';
import HoldingsTable from '../HoldingsTable';
import OptimizationModal from './OptimizationModal';

export default function ModularPositionDeck({ holdings, loading, quotesBySymbol, technicals, alerts, analytics, digest }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');

  // Logic for Health Score Calculation
  const healthStats = useMemo(() => {
    if (!analytics) return { score: 0, grade: 'N/A', color: 'text-slate-500' };
    
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

    return { score: total, grade, color };
  }, [analytics]);

  const [showOptimization, setShowOptimization] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: '📋' },
    { id: 'technical', label: 'Kỹ thuật', icon: '📊' },
    { id: 'whale', label: 'Cá mập', icon: '🐋' },
    { id: 'ai', label: 'AI Bot', icon: '🤖' },
  ];

  // Filter alerts for symbols in current portfolio
  const portfolioSymbols = new Set(holdings.map(h => h.symbol.trim().toUpperCase()));
  const filteredWhaleAlerts = (alerts || []).filter(a => portfolioSymbols.has(a.symbol.trim().toUpperCase()));

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full">
      {/* Tab Header */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 border-b border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-2">
        {activeTab === 'overview' && (
          <div className="h-full overflow-y-auto panel-scrollbar">
             <HoldingsTable holdings={holdings} loading={loading} />
          </div>
        )}

        {activeTab === 'technical' && (
          <div className="h-full overflow-y-auto panel-scrollbar">
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
                 ) : technicals?.map((tech, idx) => (
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
                 {(!technicals || technicals.length === 0) && !loading && (
                   <tr><td colSpan="5" className="text-center py-4 text-slate-600 italic">Không có dữ liệu kỹ thuật.</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        )}

        {activeTab === 'whale' && (
          <div className="h-full overflow-y-auto panel-scrollbar p-2">
             <div className="space-y-4">
                {filteredWhaleAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-slate-900/40 border-l-2 border-emerald-500 p-3 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 font-bold">{alert.symbol}</span>
                      <span className="text-[10px] text-slate-500">{alert.time || 'Vừa xong'}</span>
                    </div>
                    <p className="text-xs text-slate-300">{alert.message || 'Phát hiện dòng tiền lớn nhập cuộc.'}</p>
                  </div>
                ))}
                {filteredWhaleAlerts.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                     <span className="text-3xl mb-2">🐋</span>
                     <p className="text-sm italic">Đang quét dòng tiền "Cá mập" riêng cho danh mục này...</p>
                   </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="h-full overflow-y-auto panel-scrollbar p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Left: Score Gauge */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-slate-800 rounded-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl">🤖</div>
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6">Portfolio Health Score</h4>
                   
                   <div className="relative flex items-center justify-center w-32 h-32">
                     {/* Circular Track */}
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
                      <span className="text-[10px] uppercase font-bold tracking-tighter text-slate-500">Thanh khoản & Hiệu suất</span>
                   </div>
                </div>

                {/* Right: AI Synthesis */}
                <div className="flex flex-col gap-4">
                   <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                      <h5 className="text-[11px] font-bold text-emerald-400 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        AI Commentary
                      </h5>
                      <p className="text-sm text-slate-300 leading-relaxed italic">
                        "{digest?.digest_summary || 'Đang phân tích các mã nắm giữ để đưa ra nhận định tối ưu...'}"
                      </p>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                         <span className="text-[9px] text-slate-500 uppercase block mb-1">Rủi ro (Sharpe)</span>
                         <span className={`text-sm font-bold ${analytics?.sharpe_ratio >= 1.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                           {analytics?.sharpe_ratio || 'N/A'}
                         </span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                         <span className="text-[9px] text-slate-500 uppercase block mb-1">Sụt giảm tối đa</span>
                         <span className="text-sm font-bold text-rose-400">
                           {analytics?.max_drawdown_pct || 0}%
                         </span>
                      </div>
                   </div>

                   <button 
                      onClick={() => setShowOptimization(true)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                   >
                      Tối ưu hóa danh mục với AI
                   </button>
                </div>
             </div>
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
