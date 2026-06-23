import React from 'react';
import WhaleBubbleChart from './WhaleBubbleChart.jsx';
import { Fish } from 'lucide-react';

export default function FactsFirstWhaleBubbleChart({
  symbol,
  timeframe = 'session',
  onTimeframeChange = undefined,
  onSymbolChange = undefined,
  holdings = [],
  quotesBySymbol = {},
  symbolOptions = [],
  isEmbedded = false,
  selectedSymbol = '',
  analyticsData = undefined,
  analyticsLoading = undefined,
  analyticsError = undefined,
  syncTimestamp = null,
  onSyncHover = undefined,
}) {
  const resolvedSymbol = String(symbol || selectedSymbol || '').trim().toUpperCase();

  if (!resolvedSymbol) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-3 border border-dashed border-slate-800 rounded-3xl">
        <Fish className="h-16 w-16 opacity-20 text-slate-500" />
        <p className="text-[9px] font-black uppercase tracking-widest">Chọn mã để xem biểu đồ</p>
      </div>
    );
  }

  const hasPrefetchedAnalyticsState = analyticsData !== undefined
    || analyticsLoading !== undefined
    || analyticsError !== undefined;

  return (
    <WhaleBubbleChart
      isControlled={hasPrefetchedAnalyticsState}
      externalSymbol={resolvedSymbol}
      externalTimeframe={timeframe}
      externalData={analyticsData?.bubbles || null}
      externalFlowData={analyticsData?.flow || null}
      externalLoading={analyticsLoading}
      externalError={analyticsError}
      onTimeframeChange={onTimeframeChange}
      onSymbolChange={onSymbolChange || (() => {})}
      isEmbedded={isEmbedded}
      selectedSymbol={resolvedSymbol}
      quotesBySymbol={quotesBySymbol}
      holdings={holdings}
      symbolOptions={symbolOptions}
      syncTimestamp={syncTimestamp}
      onSyncHover={onSyncHover}
    />
  );
}
