import React, { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext';
import { useI18n } from '../context/LangContext';

function toSymbolList(items = []) {
  return [...new Set(items.map((item) => String(item?.symbol || '').trim().toUpperCase()).filter(Boolean))];
}

const SidebarTickerRow = memo(function SidebarTickerRow({ symbol, quote, t }) {
  const pct = Number(quote?.change_pct ?? 0);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const currentPrice = quote?.current_price;
  const freshnessSeconds = Number(quote?.freshness_seconds ?? 0);

  const [flashClass, setFlashClass] = useState('');
  const [prevPrice, setPrevPrice] = useState(currentPrice);

  useEffect(() => {
    if (prevPrice === null || prevPrice === undefined || currentPrice === null || currentPrice === undefined) {
      setPrevPrice(currentPrice);
      return;
    }

    if (Number(currentPrice) > Number(prevPrice)) {
      setFlashClass('rt-flash-up');
    } else if (Number(currentPrice) < Number(prevPrice)) {
      setFlashClass('rt-flash-down');
    }
    setPrevPrice(currentPrice);

    const timer = window.setTimeout(() => setFlashClass(''), 420);
    return () => window.clearTimeout(timer);
  }, [currentPrice, prevPrice]);

  return (
    <Link
      to={`/stocks/${symbol}`}
      className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 transition-colors hover:border-slate-700 hover:bg-slate-900/80 ${flashClass}`}
    >
      <div>
        <p className="text-xs font-bold tracking-wide text-slate-100">{symbol}</p>
        <p className="text-[10px] text-slate-500">
          {freshnessSeconds > 0 ? t('dashboardRealtime.secondsShort', { value: freshnessSeconds }) : '—'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-semibold text-slate-200 tabular-nums">
          {currentPrice !== null && currentPrice !== undefined ? Number(currentPrice).toLocaleString('vi-VN') : '—'}
        </p>
        <p className={`text-[11px] font-bold tabular-nums ${isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-slate-400'}`}>
          {pct === 0 ? '0.00%' : `${isUp ? '+' : ''}${pct.toFixed(2)}%`}
        </p>
      </div>
    </Link>
  );
});

export default function SidebarWatchlist({ trackedSymbols = [] }) {
  const { t } = useI18n();
  const symbols = useMemo(() => toSymbolList(trackedSymbols), [trackedSymbols]);
  const realtimeFeed = useRealtimeFeedFromManager({
    symbols,
    pollInterval: 5000,
    maxAlerts: 8,
  });

  const quotesBySymbol = realtimeFeed?.quotesBySymbol || {};

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">{t('layout.watchlistRadar')}</p>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">{symbols.length}</span>
      </div>
      <div className="panel-scrollbar space-y-1.5 overflow-y-auto pr-1">
        {symbols.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-500">
            {t('dashboardRealtime.noSymbols')}
          </p>
        )}
        {symbols.map((symbol) => (
          <SidebarTickerRow
            key={symbol}
            symbol={symbol}
            quote={quotesBySymbol[symbol] || { symbol }}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
