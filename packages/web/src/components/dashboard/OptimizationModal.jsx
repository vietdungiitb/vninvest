import React, { useState, useMemo } from 'react';
import useAIAdvisor from '../../hooks/useAIAdvisor.js';

export default function OptimizationModal({ onClose, holdings, technicals, analytics, currentScore, alerts }) {
  const [strategy, setStrategy] = useState('conservative'); // 'conservative' | 'aggressive'
  const [acknowledged, setAcknowledged] = useState({}); // { symbol: true }
  const [expandedSymbol, setExpandedSymbol] = useState(null);
  const [confirmCount, setConfirmCount] = useState(null); // null | number — toast state

  // Configuration based on strategy
  const { recommendations, config } = useAIAdvisor({ holdings, technicals, alerts, strategy });

  // Score Projection (Option A)
  const projectedScore = useMemo(() => {
    const tickedCount = Object.values(acknowledged).filter(Boolean).length;
    return Math.min(currentScore + (tickedCount * 5), currentScore + 30);
  }, [currentScore, acknowledged]);

  const toggleAcknowledge = (symbol) => {
    setAcknowledged(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900/90 border border-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header Section */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-3">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-lg">🤖</span>
              AI Advisor Optimization
            </h2>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-1">Rebalancing & Asset Allocation</p>
          </div>

          <div className="flex items-center gap-8">
            {/* Strategy Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button 
                onClick={() => setStrategy('conservative')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${strategy === 'conservative' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Conservative
              </button>
              <button 
                onClick={() => setStrategy('aggressive')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${strategy === 'aggressive' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Aggressive
              </button>
            </div>

            {/* Score Comparison */}
            <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-slate-500 uppercase">Hiện tại</span>
                <span className="text-lg font-black text-slate-400">{currentScore}</span>
              </div>
              <span className="text-slate-600">→</span>
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-emerald-500 uppercase">Dự kiến</span>
                <span className="text-xl font-black text-emerald-400">
                  {projectedScore} 
                  <span className="text-[10px] ml-1 opacity-60">+{projectedScore - currentScore}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action List Section */}
        <div className="flex-1 overflow-y-auto panel-scrollbar p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh sách gợi ý tối ưu ({recommendations.length})</h3>
            <span className="text-[10px] text-slate-500 italic">Dựa trên RSI, SMA và Tỷ trọng danh mục</span>
          </div>

          {recommendations.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-4 opacity-10">💎</div>
              <p className="text-sm text-slate-500 italic">Danh mục của bạn đang ở trạng thái cân bằng lý tưởng.</p>
            </div>
          ) : recommendations.map((rec) => (
            <div key={rec.symbol} className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center p-4 gap-4">
                <input 
                  type="checkbox" 
                  checked={acknowledged[rec.symbol] || false}
                  onChange={() => toggleAcknowledge(rec.symbol)}
                  className="w-5 h-5 rounded-md border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                
                <div className="w-16">
                  <span className="text-sm font-black text-slate-200">{rec.symbol}</span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rec.action === 'TRIM' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {rec.action === 'TRIM' ? 'Bán bớt (Trim)' : 'Mua thêm (Build)'}
                  </span>
                  <span className="text-xs text-slate-400">{rec.reason}</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Tỷ trọng</span>
                    <span className="text-xs font-bold text-slate-300">{rec.weight.toFixed(1)}%</span>
                  </div>
                  <button 
                    onClick={() => setExpandedSymbol(expandedSymbol === rec.symbol ? null : rec.symbol)}
                    className="p-2 text-slate-500 hover:text-slate-200 bg-slate-800/30 rounded-lg transition-all"
                  >
                    {expandedSymbol === rec.symbol ? '🔼' : 'ℹ️'}
                  </button>
                </div>
              </div>

              {/* Deep Dive Panel */}
              {expandedSymbol === rec.symbol && (
                <div className="px-14 pb-4 pt-2 border-t border-slate-800/50 bg-slate-950/20 grid grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase">RSI Signal</span>
                    <div className="flex items-center gap-2">
                       <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${rec.rsi > 70 ? 'bg-rose-500' : rec.rsi < 30 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${rec.rsi ?? 0}%` }} />
                       </div>
                       <span className="text-xs font-bold text-slate-300">{rec.rsi?.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase">Live Market Activity</span>
                    <span className="text-xs text-slate-400">
                      Cá mập: <span className="font-bold text-emerald-400">{rec.whaleCount} tín hiệu</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase">AI Recommendation</span>
                    <span className="text-xs text-slate-400">
                      {rec.action === 'TRIM' ? 'Tối ưu lợi nhuận & giảm rủi ro tập trung.' : 'Tăng vị thế tại vùng tích lũy kỹ thuật.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Section */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
          {confirmCount !== null ? (
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
              <span>✓</span> Đã ghi nhận {confirmCount} gợi ý — đang đóng...
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 italic max-w-md">
              * Các gợi ý này mang tính chất tham khảo dựa trên thuật toán tối ưu hóa tài sản. Vui lòng kiểm tra lại trước khi thực hiện giao dịch thực tế.
            </p>
          )}
          <div className="flex items-center gap-3">
             <button 
                onClick={onClose}
                disabled={confirmCount !== null}
                className="px-6 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
             >
                Đóng
             </button>
             <button 
                disabled={confirmCount !== null}
                onClick={() => {
                  const count = Object.values(acknowledged).filter(Boolean).length;
                  setConfirmCount(count);
                  setTimeout(onClose, 1500);
                }}
                className="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Xác nhận & Ghi nhận
             </button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-sky-500/10 blur-[100px] rounded-full" />
      </div>
    </div>
  );
}
