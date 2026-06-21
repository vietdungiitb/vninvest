import React from 'react';
import WhaleBubbleChart from './WhaleBubbleChart.jsx';

export default function FactsFirstWhaleBubbleChart({ symbol, isEmbedded = false }) {
  if (!symbol) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl">
        <div className="text-3xl opacity-20">🐋</div>
        <p className="text-[9px] font-black uppercase tracking-widest">Chọn mã để xem biểu đồ</p>
      </div>
    );
  }
  return <WhaleBubbleChart symbol={symbol} isEmbedded={isEmbedded} />;
}
