import React from 'react';
import WhaleBubbleChart from './WhaleBubbleChart.jsx';
import { Fish } from 'lucide-react';

export default function FactsFirstWhaleBubbleChart({ symbol, isEmbedded = false }) {
  if (!symbol) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl">
        <Fish className="h-16 w-16 opacity-20 text-slate-500" />
        <p className="text-[9px] font-black uppercase tracking-widest">Chọn mã để xem biểu đồ</p>
      </div>
    );
  }
  return <WhaleBubbleChart symbol={symbol} isEmbedded={isEmbedded} />;
}
