import React, { useState } from 'react';
import { useI18n } from '../../context/LangContext';
import HoldingsTable from '../HoldingsTable';

export default function ModularPositionDeck({ holdings, loading, quotesBySymbol, technicals, alerts }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');

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
          <div className="flex items-center justify-center h-full text-slate-500 text-sm italic">
            AI Bot đang chấm điểm danh mục của bạn...
          </div>
        )}
      </div>
    </div>
  );
}
