'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { VNStockChart, WhaleBubbleOverlay } from '../../../../../../react-stockcharts-master/dist/index.js';
import type { OHLCVBar } from 'vnstockcharts';
import { ALLOWED_SYMBOLS, type AllowedSymbol, normalizeTimeframe } from '@/lib/validation';
import { fetchChartFeed } from '@/lib/api';
import type { ChartFeed } from '@/lib/chartFeed';

const timeframes = ['1d', '1w', '1m'] as const;

function toWidgetBars(feed: ChartFeed): OHLCVBar[] {
  return feed.bars.map((bar, index) => ({
    date: new Date(bar.date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    buyVolume: bar.buyVolume,
    sellVolume: bar.sellVolume,
    foreignBuy: bar.foreignBuy,
    foreignSell: bar.foreignSell,
    index,
    dataIndex: index
  }));
}

export function ChartDemo() {
  const t = useTranslations('chart');
  const locale = useLocale();
  const noopAdapter = useMemo(
    () => ({
      fetchBars: async () => [],
      fetchMoreBars: async () => [],
      subscribeToBar: () => () => undefined,
      subscribeToTrades: () => () => undefined,
      subscribeToOrderbook: () => () => undefined,
      searchSymbols: async () => []
    }),
    []
  );
  const [symbol, setSymbol] = useState<AllowedSymbol>('VNM');
  const [timeframe, setTimeframe] = useState<(typeof timeframes)[number]>('1d');
  const [feed, setFeed] = useState<ChartFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bars = useMemo(() => (feed ? toWidgetBars(feed) : []), [feed]);
  const whaleEvents = useMemo(
    () =>
      feed?.whale_events.map((event) => ({
        ts: new Date(event.ts),
        price: event.price,
        side: event.side,
        matchedValue: event.matchedValue,
        severity: event.severity
      })) ?? [],
    [feed]
  );

  useEffect(() => {
    let cancelled = false;
    const from = new Date(Date.now() - 90 * 86_400_000);
    const to = new Date();

    async function loadFeed() {
      try {
        setLoading(true);
        const nextFeed = await fetchChartFeed(symbol, normalizeTimeframe(timeframe), from, to);
        if (!cancelled) {
          setFeed(nextFeed);
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    void loadFeed();
    const timerId = window.setInterval(() => {
      void loadFeed();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [symbol, timeframe]);

  return (
    <section id="chart" className="container pb-16 md:pb-20">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="badge">{t('badge')}</div>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{t('title')}</h2>
          <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{t('lead')}</p>
        </div>

        <div className="flex flex-wrap gap-3 rounded-3xl border border-white/8 bg-slate-950/50 p-4">
          <label className="grid gap-1 text-xs uppercase tracking-[0.22em] text-slate-500">
            <span>{t('symbolLabel')}</span>
            <select
              className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value as AllowedSymbol)}
            >
              {ALLOWED_SYMBOLS.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.22em] text-slate-500">
            <span>{t('timeframeLabel')}</span>
            <select
              className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-2 text-sm text-white outline-none"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value as (typeof timeframes)[number])}
            >
              {timeframes.map((entry) => (
                <option key={entry} value={entry}>{entry.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_0.8fr]">
        <div className="card rounded-[1.75rem] p-4 md:p-5">
          <div className="h-[620px] min-h-[520px] overflow-hidden rounded-[1.5rem] border border-white/8 bg-slate-950/60 p-2">
            {error ? (
              <div className="flex h-full items-center justify-center rounded-[1.25rem] border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-100">
                {error}
              </div>
            ) : (
              <VNStockChart
                adapter={noopAdapter as never}
                data={bars}
                symbol={symbol}
                timeframe={timeframe}
                locale={locale === 'en' ? 'en' : 'vi'}
                theme="dark"
                style={{ width: '100%', height: '100%' }}
              >
                <WhaleBubbleOverlay events={whaleEvents} threshold={5_000_000_000} />
              </VNStockChart>
            )}
          </div>
        </div>

        <div className="grid gap-4 content-start">
          <div className="card rounded-[1.75rem] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('sessionLabel')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{feed?.session.date ? new Date(feed.session.date).toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN') : '—'}</div>
            <div className="mt-2 text-sm text-slate-300">{loading ? t('refreshLabel') : `${feed?.session.change_pct ?? 0}%`}</div>
          </div>
          <div className="card rounded-[1.75rem] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('volumeLabel')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{feed?.session.volume.toLocaleString('vi-VN') ?? '—'}</div>
          </div>
          <div className="card rounded-[1.75rem] p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('whaleLabel')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{whaleEvents.length}</div>
          </div>
          <div className="card rounded-[1.75rem] p-5 text-sm leading-7 text-slate-300">
            {loading ? t('refreshLabel') : feed?.symbol}
          </div>
        </div>
      </div>
    </section>
  );
}
