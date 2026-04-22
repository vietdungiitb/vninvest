import React, { useState, useEffect, useRef, useMemo } from 'react';
import useAIAdvisor from '../../hooks/useAIAdvisor';
import { useI18n } from '../../context/LangContext';

export default function AIAdvisorAlertPanel({ holdings, watchlist, technicals, alerts, newsDigest, criticalSoundEnabled }) {
  const { t, formatDateTime } = useI18n();
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'news'
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastRecCount, setLastRecCount] = useState(0);
  const [showFullDigest, setShowFullDigest] = useState(false);
  
  const { recommendations } = useAIAdvisor({ holdings, watchlist, technicals, alerts });

  // Play sound when new recommendations appear
  useEffect(() => {
    if (recommendations.length > lastRecCount) {
       playAlertTone();
    }
    setLastRecCount(recommendations.length);
  }, [recommendations.length]);

  const playAlertTone = () => {
    if (!criticalSoundEnabled) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new window.AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine'; // Softer than triangle
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

  const hasStrongAlert = recommendations.some(r => r.rsi > 70 || r.rsi < 35);

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all duration-500 overflow-hidden ${
      hasStrongAlert ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse-slow' : 'border-slate-800 bg-slate-900/50'
    } ${isCollapsed ? 'h-[60px]' : 'min-h-[420px]'}`}>
      
      {/* Header with Tabs and Collapse Toggle */}
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
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-all"
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          <svg className={`w-4 h-4 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
                    
                    {/* Hover Tooltip (Simplified version for Panel) */}
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
            <div className="space-y-3">
              {(!newsDigest || !newsDigest.has_digest) ? (
                <div className="py-12 text-center">
                  <span className="text-2xl mb-2 block">📰</span>
                  <p className="text-xs text-slate-500 italic">Chưa có bản tin AI mới nhất.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Bản tin được tạo tự động sau 16:05 các ngày trong tuần.</p>
                </div>
              ) : (
                <>
                  {/* Header: ngày + fallback badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Bản tin {newsDigest.date}</span>
                    {newsDigest.is_latest_fallback && (
                      <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Bản tin gần nhất</span>
                    )}
                  </div>

                  {/* Tóm tắt ngắn */}
                  <div className="border-l-2 border-sky-500/40 pl-3 py-1">
                    <p className="text-[11px] text-slate-300 leading-relaxed">{newsDigest.digest_summary}</p>
                  </div>

                  {/* Danh sách symbol được phân tích */}
                  {newsDigest.symbols?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newsDigest.symbols.map(sym => (
                        <span key={sym} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{sym}</span>
                      ))}
                    </div>
                  )}

                  {/* Nội dung đầy đủ (toggle) */}
                  {newsDigest.digest_full && (
                    <div>
                      <button
                        onClick={() => setShowFullDigest(p => !p)}
                        className="text-[9px] text-sky-500 hover:text-sky-300 transition-colors underline"
                      >
                        {showFullDigest ? 'Thu gọn' : 'Xem phân tích đầy đủ'}
                      </button>
                      {showFullDigest && (
                        <p className="mt-2 text-[10px] text-slate-400 leading-relaxed whitespace-pre-line">{newsDigest.digest_full}</p>
                      )}
                    </div>
                  )}

                  {/* Footer: timestamp + AI model */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                    <span className="text-[9px] text-slate-600">{formatDateTime(newsDigest.created_at)}</span>
                    {newsDigest.ai_model && (
                      <span className="text-[9px] text-slate-600 italic">{newsDigest.ai_model}</span>
                    )}
                  </div>
                </>
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
