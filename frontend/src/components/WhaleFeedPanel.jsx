import React from 'react';
import { useI18n } from '../context/LangContext';

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

function fmtVol(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}

function fmtPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString(undefined);
}

function sizeClassEmoji(cls) {
  if (cls === 'shark') return '🦈';
  if (cls === 'whale') return '🐋';
  return '🐟';
}

function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white';
  if (severity === 'high') return 'bg-amber-400 text-slate-950';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950';
  return 'bg-slate-800 text-slate-200';
}

function severityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

export function AlertFeedCard({ order, animated }) {
  const { t } = useI18n();
  if (!order) return null;
  const isBuy = order.side === 'buy';
  const isBig = order.size_class === 'shark';
  const severity = typeof order.severity === 'string' ? order.severity.toLowerCase() : null;
  const severityClass = severity ? severityTone(severity) : '';
  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-4 py-3 text-[12px] transition-all ${
        isBuy
          ? 'border-emerald-700/60 bg-emerald-950/30'
          : order.side === 'sell'
          ? 'border-rose-700/60 bg-rose-950/30'
          : 'border-slate-700/60 bg-slate-900/30'
      } ${animated ? 'animate-pulse-once' : ''}`}
    >
      {isBig && (
        <span className="absolute right-2 top-1.5 text-[18px] leading-none opacity-50">
          {sizeClassEmoji(order.size_class)}
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">{order.time}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              isBuy ? 'bg-emerald-900/60 text-emerald-300' : order.side === 'sell' ? 'bg-rose-900/60 text-rose-300' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isBuy ? t('whaleAlertsDashboard.bigBuy') : order.side === 'sell' ? t('whaleAlertsDashboard.bigSell') : t('whaleAlertsDashboard.neutral')}
          </span>
          {severity && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass}`}>
              {severityLabel(severity, t)}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-base font-bold text-white">{fmtBil(order.matched_value)}</span>
        <span className="text-slate-400">
          {fmtVol(order.volume)} @ {fmtPrice(order.price)}
        </span>
      </div>
      {(order.display_score != null || order.event_score != null) && (
        <div className="mt-1 text-[11px] text-slate-400">
          {t('whaleAlertsDashboard.score')} {order.display_score ?? '—'} / {t('whaleAlertsDashboard.event')} {order.event_score ?? '—'}
        </div>
      )}
    </div>
  );
}

export function WhaleFeedPanel({
  symbol,
  realtimeAlerts,
  feedData = null,
  loading: controlledLoading,
  onRefresh = null,
  feedHeightClass = 'h-[420px] sm:h-[500px] xl:h-[560px]',
}) {
  const { t } = useI18n();
  const [data, setData] = React.useState(null);
  const [internalLoading, setInternalLoading] = React.useState(true);
  const prevCountRef = React.useRef(0);
  const feedViewportStyle = { scrollbarGutter: 'stable' };
  
  const isControlled = typeof onRefresh === 'function' || controlledLoading !== undefined || feedData !== null;

  const fetch = React.useCallback(async () => {
    try {
      // Inline dynamic import to avoid circular dependencies if any, 
      // but client.js is safe.
      const { getWhaleFeed } = await import('../api/client');
      const resp = await getWhaleFeed(symbol);
      setData(resp.data);
    } catch (_) { /* silent */ }
    finally { setInternalLoading(false); }
  }, [symbol]);

  React.useEffect(() => {
    if (isControlled) return undefined;
    setData(null);
    setInternalLoading(true);
    fetch();
    return undefined;
  }, [fetch, isControlled]);

  React.useEffect(() => {
    if (isControlled) return;
    const count = realtimeAlerts?.length || 0;
    if (count > prevCountRef.current) { fetch(); }
    prevCountRef.current = count;
  }, [realtimeAlerts, fetch, isControlled]);

  const activeData = isControlled ? feedData : data;
  const loading = isControlled ? Boolean(controlledLoading) : internalLoading;
  const orders = activeData?.whale_orders || [];
  const handleRefresh = typeof onRefresh === 'function' ? onRefresh : fetch;

  const sourceMeta = React.useMemo(() => {
    const src = String(activeData?.source || '').toLowerCase();
    if (src === 'redis_stream') {
      return { label: t('whaleAlertsDashboard.sourceRedisStream'), tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200' };
    }
    if (src === 'intraday_tick_db') {
      return { label: t('whaleAlertsDashboard.sourceIntradayDb'), tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200' };
    }
    if (src === 'vnstock') {
      return { label: t('whaleAlertsDashboard.sourceVnstock'), tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200' };
    }
    return { label: t('whaleAlertsDashboard.sourceUnknown'), tone: 'border-slate-700 bg-slate-950/70 text-slate-300' };
  }, [activeData?.source, t]);

  return (
    <section className="card-section p-4 flex flex-col xl:h-full xl:min-h-0">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.feedLabel')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">
            {t('whaleAlertsDashboard.realtimeThreshold', { value: activeData ? fmtBil(activeData.threshold) : '—' })}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className={`rounded-full border px-2.5 py-1 font-semibold ${sourceMeta.tone}`}>
              {t('whaleAlertsDashboard.source')}: {sourceMeta.label}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1">
              {t('whaleAlertsDashboard.updated')}: {activeData?.fetched_at ? new Date(activeData.fetched_at).toLocaleTimeString(undefined) : '—'}
            </span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-400 hover:text-slate-200"
        >
          ↻
        </button>
      </div>
      {loading ? (
        <div className={`panel-scrollbar mt-3 min-h-0 ${feedHeightClass} overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-900" />
            ))}
          </div>
        </div>
      ) : orders.length === 0 && (realtimeAlerts?.length || 0) === 0 ? (
        <div className={`panel-scrollbar mt-3 flex min-h-0 ${feedHeightClass} items-center justify-center overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <p className="text-center text-[12px] text-slate-500">
            {t('whaleAlertsDashboard.noLargeOrders')}
          </p>
        </div>
      ) : (
        <div className={`panel-scrollbar mt-3 min-h-0 ${feedHeightClass} overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <div className="flex flex-col gap-2">
            {(realtimeAlerts || []).slice(0, 3).map((a, i) => (
              <AlertFeedCard
                key={a.event_id || `ws-${a.ts}-${i}`}
                order={{
                  time: a.ts ? new Date(a.ts).toLocaleTimeString(undefined) : '—',
                  ts: a.ts || null,
                  matched_value: a.matched_value,
                  side: (a.side || '').toLowerCase(),
                  volume: null,
                  price: null,
                  size_class: a.size_class ?? null,
                  severity: a.severity ?? null,
                  display_score: a.display_score ?? null,
                  event_score: a.event_score ?? null,
                }}
                animated={i === 0}
              />
            ))}
            {orders.map((o, i) => (
              <AlertFeedCard key={`${o.time}-${i}`} order={o} animated={false} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
