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
      className={`grid grid-cols-[1fr_110px] items-center gap-1.5 rounded-lg border border-slate-800/95 bg-slate-950/72 px-2.5 py-1 transition-colors hover:border-slate-600/90 hover:bg-slate-900/82 ${flashClass}`}
    >
      <div>
        <p className="text-[11px] font-bold tracking-wide text-slate-100">{symbol}</p>
        <p className="text-[9px] text-slate-500">
          {freshnessSeconds > 0 ? t('dashboardRealtime.secondsShort', { value: freshnessSeconds }) : '—'}
        </p>
      </div>
      <div className="text-right min-w-[110px]">
        <p className="text-[10px] font-semibold text-slate-100 tabular-nums">
          {currentPrice !== null && currentPrice !== undefined ? Number(currentPrice).toLocaleString('vi-VN') : '—'}
        </p>
        <p className={`text-[10px] font-bold tabular-nums min-w-[60px] ${isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-slate-400'}`}>
          {pct === 0 ? '0.00%' : `${isUp ? '+' : ''}${pct.toFixed(2)}%`}
        </p>
      </div>
    </Link>
  );
});

export default function SidebarWatchlist({ trackedSymbols = [] }) {
  const { t } = useI18n();
  const [industryFilter, setIndustryFilter] = useState('all');
  const symbols = useMemo(() => toSymbolList(trackedSymbols), [trackedSymbols]);
  const symbolIndustryMap = useMemo(() => {
    const next = new Map();
    (trackedSymbols || []).forEach((item) => {
      const symbol = String(item?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      const industry = String(item?.industry || 'Khác').trim() || 'Khác';
      next.set(symbol, industry);
    });
    return next;
  }, [trackedSymbols]);

  const industryOptions = useMemo(() => {
    const set = new Set();
    symbolIndustryMap.forEach((industry) => set.add(industry));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [symbolIndustryMap]);

  const filteredSymbols = useMemo(() => {
    if (industryFilter === 'all') {
      return symbols;
    }
    return symbols.filter((symbol) => (symbolIndustryMap.get(symbol) || 'Khác') === industryFilter);
  }, [industryFilter, symbolIndustryMap, symbols]);

  const realtimeFeed = useRealtimeFeedFromManager({
    symbols,
    pollInterval: 5000,
    maxAlerts: 8,
  });

  const quotesBySymbol = realtimeFeed?.quotesBySymbol || {};

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 py-2.5">
      <div className="sidebar-sticky-header -mx-3 mb-1.5 px-3 pb-1.5 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">{t('layout.watchlistRadar')}</p>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">{filteredSymbols.length}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {industryOptions.slice(0, 5).map((industry) => (
            <button
              key={industry}
              type="button"
              onClick={() => setIndustryFilter(industry)}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all ${industryFilter === industry ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
            >
              {industry === 'all' ? t('dashboardRealtime.filterAll') : industry}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-scrollbar space-y-1 overflow-y-auto pr-1">
        {filteredSymbols.length === 0 && (
          <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-500">
            {t('dashboardRealtime.noSymbols')}
          </p>
        )}
        {filteredSymbols.map((symbol) => (
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
