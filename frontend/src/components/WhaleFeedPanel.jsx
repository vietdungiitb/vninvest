import React from 'react';
import { useI18n } from '../context/LangContext';

// ── Giờ phiên giao dịch HOSE (UTC+7) ──────────────────────
const SESSION_WINDOWS = {
  session: null,         // Cả phiên — không filter
  morning: { startH: 9, startM: 0, endH: 11, endM: 30 },
  afternoon: { startH: 13, startM: 0, endH: 14, endM: 45 },
};

function inSessionWindow(tsRaw, windowKey) {
  if (windowKey === 'session' || !tsRaw) return true;
  const w = SESSION_WINDOWS[windowKey];
  if (!w) return true;
  let d;
  try { d = new Date(tsRaw); } catch { return true; }
  if (Number.isNaN(d.getTime())) return true;
  // Chuyển sang UTC+7
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const h = vn.getUTCHours();
  const m = vn.getUTCMinutes();
  const totalMin = h * 60 + m;
  const startMin = w.startH * 60 + w.startM;
  const endMin = w.endH * 60 + w.endM;
  return totalMin >= startMin && totalMin <= endMin;
}

function matchesTradeDate(tsRaw, tradeDate) {
  if (!tradeDate || !tsRaw) return true;
  let parsed;
  try { parsed = new Date(tsRaw); } catch { return false; }
  if (Number.isNaN(parsed.getTime())) return false;
  const vn = new Date(parsed.getTime() + 7 * 3600 * 1000);
  const yyyy = vn.getUTCFullYear();
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` === String(tradeDate).trim();
}

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
  if (normalizedSeverity === 'extreme') return t('whaleAlertsDashboard.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleAlertsDashboard.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleAlertsDashboard.severityMedium');
  return t('whaleAlertsDashboard.severityLow');
}

function normalizeEventTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Math.floor(parsed.getTime() / 1000) * 1000).toISOString();
  }
  return String(value).trim();
}

function buildFeedEventKey(item) {
  if (!item) return '';
  const eventId = String(item.event_id || '').trim();
  if (eventId) return `id:${eventId}`;
  const alertKind = String(item.alert_kind || 'whale_alert').toLowerCase();
  const side = String(item.side || '').toLowerCase();
  const matchedValue = Number(item.matched_value || 0);
  const roundedMatchedValue = Number.isFinite(matchedValue) ? Math.round(matchedValue) : 0;
  const timestamp = normalizeEventTimestamp(item.ts || item.time || '');
  return [alertKind, side, roundedMatchedValue, timestamp].join('|');
}

export function AlertFeedCard({ order, animated }) {
  const { t } = useI18n();
  if (!order) return null;
  const isDarkFlow = String(order.alert_kind || '').toLowerCase() === 'dark_flow_alert';
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
              isDarkFlow
                ? 'bg-violet-900/60 text-violet-300'
                : isBuy
                ? 'bg-emerald-900/60 text-emerald-300'
                : order.side === 'sell'
                ? 'bg-rose-900/60 text-rose-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {order.typeLabel || (isDarkFlow
              ? t('whaleAlertsDashboard.darkFlowStrength')
              : (isBuy ? t('whaleAlertsDashboard.bigBuy') : order.side === 'sell' ? t('whaleAlertsDashboard.bigSell') : t('whaleAlertsDashboard.neutral')))}
          </span>
          {severity && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass}`}>
              {severityLabel(severity, t)}
            </span>
          )}
        </div>
      </div>
      {order.matched_value != null ? (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-white">{fmtBil(order.matched_value)}</span>
          <span className="text-slate-400">
            {fmtVol(order.volume)} @ {fmtPrice(order.price)}
          </span>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
          <span>{order.description || t('whaleAlertsDashboard.darkFlowStrength')}</span>
          {order.strength != null && (
            <span className="rounded-full border border-cyan-700/60 bg-cyan-950/30 px-2 py-0.5 text-cyan-300">
              {t('whaleAlertsDashboard.strength')}: {Number(order.strength).toFixed(2)}
            </span>
          )}
          {order.confidence && (
            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 uppercase text-slate-300">
              {order.confidence}
            </span>
          )}
        </div>
      )}
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
  ordersOverride = null,
  selectedTradeDate = null,
  loading: controlledLoading,
  onRefresh = null,
  feedHeightClass = 'h-[420px] sm:h-[500px] xl:h-[560px]',
}) {
  const { t, formatDateTime } = useI18n();
  const [data, setData] = React.useState(null);
  const [internalLoading, setInternalLoading] = React.useState(true);
  const prevCountRef = React.useRef(0);
  const feedViewportStyle = { scrollbarGutter: 'stable' };

  // ── Session window state ──────────────────────────────────
  const [sessionWindow, setSessionWindow] = React.useState('session');

  // ── SessionFacts (CVD / Strength) ────────────────────────
  const [sessionFacts, setSessionFacts] = React.useState(null);
  React.useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      try {
        const { getSessionFacts } = await import('../api/client');
        const resp = await getSessionFacts(symbol, selectedTradeDate);
        if (!cancelled) setSessionFacts(resp.data);
      } catch { /* silent — fallback: strip hidden when unavailable */ }
    })();
    return () => { cancelled = true; };
  }, [selectedTradeDate, symbol]);
  
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
  const orders = Array.isArray(ordersOverride) ? ordersOverride : (activeData?.whale_orders || []);
  const handleRefresh = typeof onRefresh === 'function' ? onRefresh : fetch;
  const realtimeItems = React.useMemo(
    () => (realtimeAlerts || [])
      .filter((a) => matchesTradeDate(a.ts, selectedTradeDate))
      .filter((a) => inSessionWindow(a.ts, sessionWindow))
      .slice(0, 3),
    [realtimeAlerts, selectedTradeDate, sessionWindow],
  );
  const realtimeEventKeys = React.useMemo(() => {
    const keys = new Set();
    realtimeItems.forEach((item) => {
      const key = buildFeedEventKey(item);
      if (key) keys.add(key);
    });
    return keys;
  }, [realtimeItems]);

  const dedupedHistoryOrders = React.useMemo(() => {
    const seen = new Set();
    const unique = [];
    (orders || []).forEach((order, index) => {
      const key = buildFeedEventKey({ ...order, alert_kind: 'whale_alert' }) || `history:${order?.time || 'na'}:${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(order);
    });
    return unique;
  }, [orders]);

  const dedupedOrders = React.useMemo(
    () => dedupedHistoryOrders
      .filter((order) => !realtimeEventKeys.has(buildFeedEventKey({ ...order, alert_kind: 'whale_alert' })))
      .filter((order) => matchesTradeDate(order.ts || order.raw_ts, selectedTradeDate))
      .filter((order) => inSessionWindow(order.ts || order.raw_ts, sessionWindow)),
    [dedupedHistoryOrders, realtimeEventKeys, selectedTradeDate, sessionWindow],
  );

  const sourceMeta = React.useMemo(() => {
    const src = String(activeData?.source || '').toLowerCase();
    if (src === 'redis_stream') {
      return { label: t('whaleAlertsDashboard.sourceRedisStream'), tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200' };
    }
    if (src === 'intraday_tick_db') {
      return { label: t('whaleAlertsDashboard.sourceIntradayDb'), tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200' };
    }
    if (src === 'vnbroker') {
      return { label: t('whaleAlertsDashboard.sourceVnbroker'), tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200' };
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
              {t('whaleAlertsDashboard.updated')}: {activeData?.fetched_at ? formatDateTime(activeData.fetched_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
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

      {/* ── Nút lọc phiên giao dịch ──────────────────────── */}
      <div className="mt-3 flex items-center gap-1.5">
        {[
          { key: 'session', label: t('whaleAlertsDashboard.sessionWindowAll') },
          { key: 'morning', label: t('whaleAlertsDashboard.sessionWindowMorning') },
          { key: 'afternoon', label: t('whaleAlertsDashboard.sessionWindowAfternoon') },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSessionWindow(key)}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
              sessionWindow === key
                ? 'bg-cyan-600 text-white'
                : 'border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-1 text-[9px] text-slate-600">
          {t('whaleAlertsDashboard.sessionWindowHint')}
        </span>
      </div>

      {/* ── CVD / Strength mini-strip ─────────────────────── */}
      {sessionFacts && (
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {t('whaleAlertsDashboard.sessionFactsLabel')}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {/* CVD bar */}
            <div className="flex min-w-[120px] flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">{t('whaleAlertsDashboard.cvdLabel2')}</span>
                <span className={`font-semibold ${
                  sessionFacts.cvd_normalized > 55 ? 'text-emerald-400'
                  : sessionFacts.cvd_normalized < 45 ? 'text-rose-400'
                  : 'text-slate-300'
                }`}>
                  {sessionFacts.cvd_normalized != null ? sessionFacts.cvd_normalized.toFixed(1) : '—'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    sessionFacts.cvd_normalized > 55 ? 'bg-emerald-500'
                    : sessionFacts.cvd_normalized < 45 ? 'bg-rose-500'
                    : 'bg-slate-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, sessionFacts.cvd_normalized ?? 50))}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-600">
                {sessionFacts.cvd_normalized > 55
                  ? t('whaleAlertsDashboard.cvdBuy')
                  : sessionFacts.cvd_normalized < 45
                  ? t('whaleAlertsDashboard.cvdSell')
                  : t('whaleAlertsDashboard.cvdNeutral')}
              </p>
            </div>
            {/* Metrics chips */}
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded border border-emerald-800/50 bg-emerald-950/40 px-2 py-0.5 text-[10px] text-emerald-300">
                {t('whaleAlertsDashboard.buyStrengthShort')} {sessionFacts.buy_strength != null ? sessionFacts.buy_strength.toFixed(1) : '—'}
              </span>
              <span className="rounded border border-violet-800/50 bg-violet-950/40 px-2 py-0.5 text-[10px] text-violet-300">
                {t('whaleAlertsDashboard.instStrengthShort')} {sessionFacts.institutional_strength != null ? sessionFacts.institutional_strength.toFixed(1) : '—'}
              </span>
              <span className={`rounded border px-2 py-0.5 text-[10px] ${
                Math.abs(sessionFacts.delta_strength_pct ?? 0) > 15
                  ? 'border-amber-700/50 bg-amber-950/40 text-amber-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}>
                Δ {sessionFacts.delta_strength_pct != null ? sessionFacts.delta_strength_pct.toFixed(1) : '—'}%
              </span>
              <span className="rounded border border-rose-800/50 bg-rose-950/40 px-2 py-0.5 text-[10px] text-rose-300">
                {t('whaleAlertsDashboard.darkFlowShort')} {sessionFacts.dark_flow_score != null ? sessionFacts.dark_flow_score.toFixed(1) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className={`panel-scrollbar mt-3 min-h-0 ${feedHeightClass} overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-900" />
            ))}
          </div>
        </div>
      ) : dedupedOrders.length === 0 && realtimeItems.length === 0 ? (
        <div className={`panel-scrollbar mt-3 flex min-h-0 ${feedHeightClass} items-center justify-center overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <p className="text-center text-[12px] text-slate-500">
            {t('whaleAlertsDashboard.noLargeOrders')}
          </p>
        </div>
      ) : (
        <div className={`panel-scrollbar mt-3 min-h-0 ${feedHeightClass} overflow-y-scroll overscroll-contain pr-1`} style={feedViewportStyle}>
          <div className="flex flex-col gap-4">
            {/* ─── Realtime Alerts Section ─── */}
            {realtimeItems.length > 0 && (
              <div>
                <div className="mb-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    🚨 {t('whaleAlertsDashboard.realtimeAlertsTitle')}
                  </h4>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t('whaleAlertsDashboard.realtimeAlertsDesc')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {realtimeItems.map((a, i) => {
                    const isDarkFlow = String(a.alert_kind || '').toLowerCase() === 'dark_flow_alert';
                    return (
                      <AlertFeedCard
                        key={a.event_id || `ws-${a.ts}-${i}`}
                        order={{
                          time: a.ts ? formatDateTime(a.ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
                          ts: a.ts || null,
                          alert_kind: a.alert_kind || 'whale_alert',
                          matched_value: a.matched_value,
                          side: (a.side || '').toLowerCase(),
                          volume: null,
                          price: null,
                          size_class: a.size_class ?? null,
                          severity: a.severity ?? null,
                          display_score: a.display_score ?? null,
                          event_score: a.event_score ?? null,
                          description: a.description ?? null,
                          strength: a.strength ?? null,
                          confidence: a.confidence ?? null,
                          typeLabel: isDarkFlow ? t('whaleAlertsDashboard.alertTypeDarkFlow') : t('whaleAlertsDashboard.alertTypeWhale'),
                        }}
                        animated={i === 0}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── History Orders Section ─── */}
            {dedupedOrders.length > 0 && (
              <div>
                <div className="mb-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    📊 {t('whaleAlertsDashboard.historyOrdersTitle')}
                  </h4>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t('whaleAlertsDashboard.historyOrdersDesc')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {dedupedOrders.map((o, i) => (
                    <AlertFeedCard key={buildFeedEventKey({ ...o, alert_kind: 'whale_alert' }) || `history-${i}`} order={o} animated={false} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
