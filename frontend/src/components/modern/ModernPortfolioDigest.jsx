import React, { useMemo } from 'react';
import { useI18n } from '../../context/LangContext';

export default function ModernPortfolioDigest({ digest, loading }) {
  const { t } = useI18n();

  const newsItems = useMemo(() => {
    if (!digest?.digest_full) return [];
    // Split by lines and remove bullet points if they exist
    return digest.digest_full
      .split('\n')
      .map(line => line.trim())
      .filter(l => l.length > 5)
      .map(l => l.replace(/^[-*•]\s*/, ''))
      .slice(0, 8); // Keep it compact
  }, [digest]);

  if (loading) {
    return (
      <div className="p-4 space-y-3 animate-pulse">
        <div className="h-2 bg-slate-800 rounded w-1/3" />
        <div className="h-10 bg-slate-800/50 rounded w-full" />
        <div className="h-10 bg-slate-800/50 rounded w-full" />
      </div>
    );
  }

  if (!digest || !digest.has_digest) {
    return (
      <div className="p-4 text-center">
        <div className="text-2xl mb-2 opacity-20">📰</div>
        <p className="text-[11px] text-slate-500 italic">
          Bản tin AI đang được chuẩn bị... <br/>
          (Thường cập nhật sau 16:05 phiên khớp lệnh)
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
          <span className="w-1 h-3 bg-cyan-500 rounded-full" />
          AI Digest
        </h3>
        <span className="text-[9px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
          {digest.date}
        </span>
      </div>

      {/* Summary Highlight */}
      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
         <p className="text-[11px] text-cyan-200 leading-relaxed font-medium">
           {digest.digest_summary}
         </p>
      </div>

      {/* Bullet Points */}
      <div className="space-y-2">
        {newsItems.map((line, idx) => {
          const isBullish = line.toLowerCase().includes('tăng') || line.toLowerCase().includes('tích cực');
          const isBearish = line.toLowerCase().includes('giảm') || line.toLowerCase().includes('tiêu cực');
          
          return (
            <div key={idx} className="flex gap-2 group">
              <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${isBullish ? 'bg-emerald-400' : isBearish ? 'bg-rose-400' : 'bg-slate-600'}`} />
              <p className="text-[11px] text-slate-400 leading-normal group-hover:text-slate-200 transition-colors">
                {line}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
