import React, { useState, useEffect, useMemo } from 'react';
import useAIAdvisor from '../../hooks/useAIAdvisor';
import { useI18n } from '../../context/LangContext';

export default function AIAdvisorAlertPanel({ holdings, watchlist, technicals, alerts, newsDigest, criticalSoundEnabled }) {
  const { t, formatDateTime } = useI18n();
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'news'
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastRecCount, setLastRecCount] = useState(0);
  
  const { recommendations } = useAIAdvisor({ holdings, watchlist, technicals, alerts });

  // Play sound when new recommendations appear
  useEffect(() => {
    if (recommendations.length > lastRecCount) {
       playAlertTone();
    }
    setLastRecCount(recommendations.length);
  }, [recommendations.length, lastRecCount]);

  const playAlertTone = () => {
    if (!criticalSoundEnabled) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new window.AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine'; 
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
      oscillator.onended = () => ctx.close();
    } catch (err) { console.warn('Audio play failed', err); }
  };

  const hasStrongAlert = recommendations.some(r => r.rsi > 70 || r.rsi < 30);

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all duration-500 overflow-hidden ${
      hasStrongAlert ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse-slow' : 'border-slate-800 bg-slate-900/50'
    } ${isCollapsed ? 'h-[60px]' : 'min-h-[420px]'}`}>
      
      {/* Header with Tabs and Circular Toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('alerts')}
            className={`text-[11px] font-black uppercase tracking-widest transition-colors ${activeTab === 'alerts' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AI Alerts {recommendations.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/20 rounded-full text-[9px]">{recommendations.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('news')}
            className={`text-[11px] font-black uppercase tracking-widest transition-colors ${activeTab === 'news' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            AI News
          </button>
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="group flex items-center justify-center w-8 h-8 rounded-full border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-500 transition-all duration-300"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          <svg 
            className={`w-4 h-4 text-slate-400 group-hover:text-slate-200 transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 panel-scrollbar bg-slate-900/20">
          {activeTab === 'alerts' ? (
            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-2xl mb-2 block">✨</span>
                  <p className="text-xs text-slate-500 italic">Danh mục đang ở trạng thái cân bằng.</p>
                </div>
              ) : (
                recommendations.map(rec => (
                  <div key={rec.symbol} className="group relative bg-slate-950/40 border border-slate-800/50 rounded-xl p-3 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-100">{rec.symbol}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${rec.action === 'TRIM' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {rec.isNewOpportunity ? 'Cơ hội mua' : (rec.action === 'TRIM' ? 'Bán bớt' : 'Mua thêm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${rec.rsi > 70 ? 'bg-rose-500' : rec.rsi < 30 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${rec.rsi}%` }} />
                         </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{rec.reason}</p>
                    
                    {/* Hover Tooltip */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-slate-900/95 rounded-xl p-3 flex flex-col justify-center border border-emerald-500/30">
                       <p className="text-[10px] font-bold text-emerald-400 mb-1">CƠ SỞ THUẬT TOÁN:</p>
                       <p className="text-[10px] text-slate-300 leading-tight">{rec.algoLogic}</p>
                       <div className="mt-2 flex gap-4">
                          <div>
                            <p className="text-[8px] text-slate-500 uppercase">RSI</p>
                            <p className="text-[10px] font-bold text-slate-200">{rec.rsi?.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-500 uppercase">Tỷ trọng</p>
                            <p className="text-[10px] font-bold text-slate-200">{rec.weight.toFixed(1)}%</p>
                          </div>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(!newsDigest || newsDigest.length === 0) ? (
                <div className="py-12 text-center">
                  <span className="text-2xl mb-2 block">📰</span>
                  <p className="text-xs text-slate-500 italic">Chưa có bản tin AI mới nhất.</p>
                </div>
              ) : (
                newsDigest.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="border-l-2 border-sky-500/30 pl-3 py-1">
                    <p className="text-xs font-bold text-slate-200 hover:text-sky-400 cursor-pointer transition-colors line-clamp-2">
                      {item.headline || item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-slate-500">{formatDateTime(item.ts || item.created_at)}</span>
                      {item.sentiment === 'positive' && <span className="text-[9px] text-emerald-400">Positive</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Branding */}
      {!isCollapsed && (
        <div className="px-4 py-2 bg-slate-950/20 border-t border-slate-800/30 flex items-center justify-between">
           <span className="text-[9px] text-slate-600 uppercase tracking-tighter italic">Powered by VNInvest Core AI</span>
           <span className="text-[9px] text-slate-600">{activeTab === 'alerts' ? 'Logic: Portfolio Optimization' : 'Logic: News Sentiment'}</span>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-slow {
          0%, 100% { border-color: rgba(16, 185, 129, 0.3); }
          50% { border-color: rgba(16, 185, 129, 0.6); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s infinite ease-in-out;
        }
      `}} />
    </div>
  );
}
