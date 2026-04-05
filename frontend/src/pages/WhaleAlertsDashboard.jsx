import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDepthChart, getRVOL, getStockOrderFlow, getStockWorkspaceOverview, getWhaleFeed } from '../api/client';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import { useI18n } from '../context/LangContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatPercentDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const numericValue = Number(value);
  return `${numericValue > 0 ? '+' : ''}${numericValue.toFixed(2)}%`;
}

function sizeClassEmoji(cls) {
  if (cls === 'shark') return '🦈';
  if (cls === 'whale') return '🐋';
  return '🐟';
}

function sideColor(side) {
  if (side === 'buy') return '#22c55e';
  if (side === 'sell') return '#f43f5e';
  return '#94a3b8';
}

function severityTone(severity) {
  if (severity === 'extreme') return 'bg-rose-500 text-white';
  if (severity === 'high') return 'bg-amber-400 text-slate-950';
  if (severity === 'medium') return 'bg-cyan-400 text-slate-950';
  return 'bg-slate-800 text-slate-200';
}

function formatFeedTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(undefined);
}

function getFeedSourceMeta(source, t) {
  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'redis_stream') {
    return {
      label: t('whaleAlertsDashboard.sourceRedisStream'),
      tone: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200',
    };
  }
  if (normalizedSource === 'intraday_tick_db') {
    return {
      label: t('whaleAlertsDashboard.sourceIntradayDb'),
      tone: 'border-cyan-900/60 bg-cyan-950/30 text-cyan-200',
    };
  }
  if (normalizedSource === 'vnstock') {
    return {
      label: t('whaleAlertsDashboard.sourceVnstock'),
      tone: 'border-amber-800/60 bg-amber-950/30 text-amber-200',
    };
  }
  return {
    label: t('whaleAlertsDashboard.sourceUnknown'),
    tone: 'border-slate-700 bg-slate-950/70 text-slate-300',
  };
}

// ─── AlertFeedCard ─────────────────────────────────────────────────────────

function AlertFeedCard({ order, animated }) {
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
              {severity}
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

// ─── WhaleFeedPanel ────────────────────────────────────────────────────────

export function WhaleFeedPanel({
  symbol,
  realtimeAlerts,
  feedData = null,
  loading: controlledLoading,
  onRefresh = null,
  feedHeightClass = 'h-[420px] sm:h-[500px] xl:h-[560px]',
}) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const prevCountRef = useRef(0);
  const feedViewportStyle = { scrollbarGutter: 'stable' };
  const isControlled = typeof onRefresh === 'function' || controlledLoading !== undefined || feedData !== null;

  const fetch = useCallback(async () => {
    try {
      const resp = await getWhaleFeed(symbol);
      setData(resp.data);
    } catch (_) { /* silent */ }
    finally { setInternalLoading(false); }
  }, [symbol]);

  useEffect(() => {
    if (isControlled) {
      return undefined;
    }
    setData(null);
    setInternalLoading(true);
    fetch();
    return undefined;
  }, [fetch, isControlled]);

  // Re-fetch khi có whale alert WS mới
  useEffect(() => {
    if (isControlled) {
      return;
    }
    const count = realtimeAlerts?.length || 0;
    if (count > prevCountRef.current) { fetch(); }
    prevCountRef.current = count;
  }, [realtimeAlerts, fetch, isControlled]);

  const activeData = isControlled ? feedData : data;
  const loading = isControlled ? Boolean(controlledLoading) : internalLoading;
  const orders = activeData?.whale_orders || [];
  const handleRefresh = typeof onRefresh === 'function' ? onRefresh : fetch;
  const sourceMeta = getFeedSourceMeta(activeData?.source, t);
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
              {t('whaleAlertsDashboard.updated')}: {formatFeedTime(activeData?.fetched_at)}
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
          {/* WS alerts on top */}
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
                  weights_version: a.weights_version ?? null,
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

// ─── MoneyFlowDonut ────────────────────────────────────────────────────────

const DONUT_COLORS = ['#0891b2', '#7c3aed', '#475569'];

export function MoneyFlowDonut({ summary, loading, compact = false }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <section className={`card-section p-4 ${compact ? 'h-full min-h-0' : ''}`}>
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const totalValue = (summary?.shark_value || 0) + (summary?.whale_value || 0) + (summary?.small_value || 0);
  const donutData = [
    { name: t('whaleAlertsDashboard.sharkSegment'), value: summary?.shark_pct || 0, realValue: summary?.shark_value || 0 },
    { name: t('whaleAlertsDashboard.whaleSegment'), value: summary?.whale_pct || 0, realValue: summary?.whale_value || 0 },
    { name: t('whaleAlertsDashboard.retailSegment'), value: summary?.small_pct || 0, realValue: summary?.small_value || 0 },
  ].filter((d) => d.value > 0);

  const flowNet = summary?.flow_net || 0;
  const netColor = flowNet >= 0 ? '#22c55e' : '#f43f5e';

  return (
    <section className={`card-section p-4 ${compact ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="border-b border-slate-800 pb-3">
        <p className="text-label">{t('whaleAlertsDashboard.sessionFlow')}</p>
        <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.flowBreakdown')}</h3>
      </div>
      <div className={`mt-3 flex items-center gap-4 ${compact ? 'flex-1' : ''}`}>
        <div className={`relative shrink-0 ${compact ? 'h-48 w-48' : 'h-36 w-36'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData.length > 0 ? donutData : [{ value: 1, name: t('whaleAlertsDashboard.noData') }]}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="80%"
                dataKey="value"
                paddingAngle={2}
              >
                {donutData.length > 0
                  ? donutData.map((entry, index) => (
                      <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))
                  : <Cell fill="#1e293b" />}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                formatter={(val, name) => [`${val.toFixed(1)}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-400">{t('whaleAlertsDashboard.flowNet')}</span>
            <span className="text-[13px] font-bold" style={{ color: netColor }}>
              {flowNet >= 0 ? '+' : ''}{fmtBil(flowNet)}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-[12px]">
          {donutData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
              <span className="truncate text-slate-400">{d.name}</span>
              <span className="ml-auto font-semibold text-white">{d.value.toFixed(1)}%</span>
            </div>
          ))}
          <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">{t('whaleAlertsDashboard.buy')}</span>
              <span className="text-emerald-300 font-semibold">{fmtBil(summary?.buy_value)}</span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-slate-500">{t('whaleAlertsDashboard.sell')}</span>
              <span className="text-rose-300 font-semibold">{fmtBil(summary?.sell_value)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── BubbleScatterChart ─────────────────────────────────────────────────────

const CustomBubble = (props) => {
  const { cx, cy, payload } = props;
  const r = Math.max(4, Math.min(28, Math.sqrt((payload.matched_value || 0) / 1_000_000_000) * 12));
  const fill = sideColor(payload.side);
  return (
    <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.55} stroke={fill} strokeWidth={1.5} />
  );
};

export function BubbleOrderChart({ orders, loading }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <section className="card-section p-4">
        <div className="border-b border-slate-800 pb-3">
          <p className="text-label">{t('whaleAlertsDashboard.largeOrderDistribution')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.priceVolumeBubble')}</h3>
        </div>
        <div className="mt-4 h-56 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const bubbleData = (orders || []).map((o, i) => ({
    ...o,
    idx: i,
    y: o.price || 0,
    x: i,
  }));

  if (!bubbleData.length) {
    return (
      <section className="card-section p-4">
        <div className="border-b border-slate-800 pb-3">
          <p className="text-label">{t('whaleAlertsDashboard.largeOrderDistribution')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.priceVolumeBubble')}</h3>
        </div>
        <div className="mt-4 flex h-56 items-center justify-center text-[12px] text-slate-500 border border-dashed border-slate-800 rounded-xl">
          {t('whaleAlertsDashboard.noThresholdOrders')}
        </div>
      </section>
    );
  }

  return (
    <section className="card-section p-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.largeOrderDistribution')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.priceVolumeBubble')}</h3>
        </div>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />{t('whaleAlertsDashboard.buy')}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />{t('whaleAlertsDashboard.sell')}</span>
          <span className="text-slate-600">{t('whaleAlertsDashboard.bubbleLegend')}</span>
        </div>
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="idx" type="number" name="STT" tick={false} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="y"
              type="number"
              name="Giá"
              tickFormatter={(v) => (v / 1000).toFixed(0) + 'K'}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="space-y-1 p-2 text-[11px]">
                    <p className="font-semibold text-white">{fmtBil(d.matched_value)}</p>
                    <p className="text-slate-400">{d.time} · {fmtPrice(d.price)} · KL {fmtVol(d.volume)}</p>
                    <p style={{ color: sideColor(d.side) }}>{d.side === 'buy' ? `▲ ${t('whaleAlertsDashboard.buy')}` : d.side === 'sell' ? `▼ ${t('whaleAlertsDashboard.sell')}` : '—'} {sizeClassEmoji(d.size_class)}</p>
                    <p className="text-slate-400">{t('whaleAlertsDashboard.severity')}: {d.severity ?? '—'} · {t('whaleAlertsDashboard.score')}: {d.display_score ?? '—'}</p>
                  </div>
                );
              }}
            />
            <Scatter
              data={bubbleData}
              shape={<CustomBubble />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── RVOLChart ──────────────────────────────────────────────────────────────

const CustomBarShape = (props) => {
  const { x, y, width, height, payload } = props;
  const fill = payload?.is_spike ? '#a855f7' : '#334155';
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />;
};

function RVOLChartPanel({ symbol, loading: parentLoading }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRVOL(symbol)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol]);

  const maxSpike = (data?.buckets || []).reduce((max, b) => b.is_spike && b.rvol > max ? b.rvol : max, 0);

  return (
    <section className="card-section p-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.rvolLabel')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.rvolTitle')}</h3>
        </div>
        {maxSpike >= 2 && (
          <span className="rounded-full border border-violet-600/60 bg-violet-950/40 px-2.5 py-1 text-[10px] font-semibold text-violet-300">
            {t('whaleAlertsDashboard.spikeAlert', { value: maxSpike.toFixed(1) })}
          </span>
        )}
      </div>
      {loading || parentLoading ? (
        <div className="mt-4 h-44 animate-pulse rounded-xl bg-slate-900" />
      ) : !data?.buckets?.length ? (
        <div className="mt-4 flex h-44 items-center justify-center text-[12px] text-slate-500 border border-dashed border-slate-800 rounded-xl">
          {t('whaleAlertsDashboard.noRvolData')}
        </div>
      ) : (
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.buckets} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmtVol}
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                formatter={(val, name) => [
                  name === 'volume' ? fmtVol(val) : fmtVol(val),
                  name === 'volume' ? t('whaleAlertsDashboard.volumeShort') : 'SMA20',
                ]}
              />
              <Bar dataKey="volume" shape={<CustomBarShape />} />
              <Line dataKey="sma20" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine
                y={(data.buckets.find((b) => b.sma20 > 0)?.sma20 || 0) * 2}
                stroke="#a855f7"
                strokeDasharray="4 2"
                label={{ value: '2× AVG', fill: '#a855f7', fontSize: 10, position: 'insideTopRight' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500 mr-1 align-middle" />{t('whaleAlertsDashboard.spikeLegend')}</span>
        <span><span className="inline-block w-2.5 h-0.5 bg-amber-400 mr-1 align-middle" />{t('whaleAlertsDashboard.sma20')}</span>
        <span><span className="inline-block w-2.5 h-0.5 bg-slate-600 mr-1 align-middle" />{t('whaleAlertsDashboard.normalLegend')}</span>
      </div>
    </section>
  );
}

// ─── DepthChartPanel ────────────────────────────────────────────────────────

function DepthChartPanel({ symbol, compact = false }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const r = await getDepthChart(symbol);
      setData(r.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => { setLoading(true); fetch(); }, [fetch]);

  // Xây dựng dữ liệu depth chart từ bids/asks
  const chartData = React.useMemo(() => {
    if (!data) return [];
    const bids = [...(data.bids || [])].reverse(); // giá thấp → cao
    const asks = data.asks || [];
    const points = [];
    bids.forEach((b) => points.push({ price: b.price, cumBid: b.cumulative, cumAsk: 0 }));
    asks.forEach((a) => points.push({ price: a.price, cumBid: 0, cumAsk: a.cumulative }));
    return points.sort((a, b) => a.price - b.price);
  }, [data]);

  return (
    <section className={`card-section p-4 ${compact ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.depthLabel')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.depthTitle')}</h3>
        </div>
        <button
          onClick={fetch}
          className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-400 hover:text-slate-200"
        >
          {t('whaleAlertsDashboard.refresh')}
        </button>
      </div>

      {loading ? (
        <div className={`mt-4 animate-pulse rounded-xl bg-slate-900 ${compact ? 'h-full min-h-0 flex-1' : 'h-52'}`} />
      ) : !chartData.length ? (
        <div className={`mt-4 flex items-center justify-center text-[12px] text-slate-500 border border-dashed border-slate-800 rounded-xl ${compact ? 'h-full min-h-0 flex-1' : 'h-52'}`}>
          {t('whaleAlertsDashboard.noDepthData')}
        </div>
      ) : (
        <>
          <div className={`mt-3 ${compact ? 'h-full min-h-0 flex-1' : 'h-52'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="price"
                  tickFormatter={(v) => (v / 1000).toFixed(0) + 'K'}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtVol}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  formatter={(val, name) => [fmtVol(val), name === 'cumBid' ? t('whaleAlertsDashboard.cumBid') : t('whaleAlertsDashboard.cumAsk')]}
                  labelFormatter={(label) => `${t('whaleAlertsDashboard.price')}: ${fmtPrice(label)}`}
                />
                {data?.reference_price && (
                  <ReferenceLine
                    x={data.reference_price}
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    label={{ value: 'Ref', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                  />
                )}
                {(data?.walls || []).map((w, i) => (
                  <ReferenceLine
                    key={i}
                    x={w.price}
                    stroke={w.side === 'bid' ? '#22c55e' : '#f43f5e'}
                    strokeWidth={2}
                    label={{ value: w.label, fill: w.side === 'bid' ? '#22c55e' : '#f43f5e', fontSize: 9, position: 'insideTopLeft' }}
                  />
                ))}
                <Area
                  type="stepAfter"
                  dataKey="cumBid"
                  stroke="#22c55e"
                  fill="rgba(34,197,94,0.15)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  type="stepBefore"
                  dataKey="cumAsk"
                  stroke="#f43f5e"
                  fill="rgba(244,63,94,0.15)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Wall summary */}
          {(data?.walls || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.walls.map((w, i) => (
                <div
                  key={i}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold ${
                    w.side === 'bid'
                      ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-300'
                      : 'border-rose-700/50 bg-rose-950/20 text-rose-300'
                  }`}
                >
                  {w.label} @ {fmtPrice(w.price)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function OrderFlowRadarPanel({ symbol, loading, orderFlowData, latestRealtimeAlert, window: selectedWindow, onWindowChange }) {
  const { t } = useI18n();
  const cvdSeries = orderFlowData?.cvd_series || [];
  const darkFlow = orderFlowData?.dark_flow || {};
  const latestSignal = orderFlowData?.latest_signal || null;
  const signals = orderFlowData?.signals || [];
  const tickRate = orderFlowData?.tick_rate || {};
  const sizeDistribution = orderFlowData?.size_distribution || {};

  const chartData = cvdSeries.map((item) => ({
    ...item,
    label: item.bucket_ts ? new Date(item.bucket_ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—',
    cumulative_cvd: Number(item.cumulative_cvd || 0),
  }));

  const liveSignal = latestRealtimeAlert || latestSignal;
  const liveStrength = Number(liveSignal?.strength || darkFlow?.strength || 0);
  const smallOrderRatio = Number(
    liveSignal?.small_order_ratio ?? tickRate?.small_order_ratio ?? sizeDistribution?.small_ratio ?? 0
  );

  if (loading) {
    return <section className="card-section p-4"><div className="h-80 animate-pulse rounded-2xl bg-slate-900" /></section>;
  }

  return (
    <section className="card-section p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <p className="text-label">{t('whaleAlertsDashboard.orderFlowRadar')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('whaleAlertsDashboard.darkMoneyTitle', { symbol })}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-[10px]">
            {['5m', '15m', '30m', '1h'].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onWindowChange?.(w)}
                className={`px-2.5 py-1 transition-colors ${
                  selectedWindow === w
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 uppercase tracking-widest">
              {String(darkFlow?.confidence || liveSignal?.confidence || 'low')}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
              {String(darkFlow?.signal_type || liveSignal?.signal_type || 'none')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.strength')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{liveStrength.toFixed(1)}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
              style={{ width: `${Math.max(4, Math.min(100, liveStrength))}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.tickRatePerMin')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{Number(tickRate?.tick_rate_per_min || 0).toFixed(1)}</p>
          <p className="mt-2 text-xs text-slate-400">{t('whaleAlertsDashboard.smallOrders')}: {(smallOrderRatio * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-label">{t('whaleAlertsDashboard.realtimeEvent')}</p>
          <p className="mt-2 text-sm font-medium text-slate-100">{liveSignal?.description || darkFlow?.components?.absorption?.description || t('whaleAlertsDashboard.noRealtimeEvent')}</p>
          <p className="mt-2 text-[11px] text-slate-500">{liveSignal?.ts ? new Date(liveSignal.ts).toLocaleString(undefined) : '—'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">{t('whaleAlertsDashboard.cvd30m')}</p>
            <span className="text-[11px] text-slate-500">{t('whaleAlertsDashboard.bucketsCount', { count: chartData.length })}</span>
          </div>
          <div className="h-56">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
                {t('whaleAlertsDashboard.noIntradayCvd')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="whaleOrderFlowCvd" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [fmtCompact(value), 'CVD']}
                    labelStyle={{ color: '#cbd5e1' }}
                    contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12 }}
                  />
                  <Area type="monotone" dataKey="cumulative_cvd" stroke="#22d3ee" fill="url(#whaleOrderFlowCvd)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm font-semibold text-slate-200">{t('whaleAlertsDashboard.recentSignals')}</p>
          <div className="mt-3 space-y-2">
            {signals.length === 0 ? (
              <p className="text-sm text-slate-500">{t('whaleAlertsDashboard.noSignalsSaved')}</p>
            ) : signals.slice(0, 4).map((item) => (
              <div key={item.id || `${item.symbol}-${item.created_at}`} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{item.signal_type}</p>
                  <p className="text-[11px] text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleTimeString(undefined) : '—'}</p>
                </div>
                <p className="mt-1 text-sm text-slate-200">{t('whaleAlertsDashboard.strength')} {Number(item.strength || 0).toFixed(1)} • {item.confidence || 'low'}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t('whaleAlertsDashboard.tickRate')} {Number(item.tick_rate || 0).toFixed(1)} • {t('whaleAlertsDashboard.small')} {formatPercentDelta(Number(item.small_order_ratio || 0) * 100)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function WhaleAlertsDashboard() {
  const { t } = useI18n();
  const { symbol } = useParams();
  const normalizedSymbol = (symbol || '').toUpperCase();

  const { alerts, latestWhaleAlert, latestDarkFlowAlert, realtimeStatus, lastEventAt } = useRealtimeFeed({
    symbols: normalizedSymbol ? [normalizedSymbol] : [],
  });

  const symbolAlerts = (alerts || []).filter((a) => a.symbol === normalizedSymbol);
  const symbolWhaleAlert = latestWhaleAlert?.symbol === normalizedSymbol ? latestWhaleAlert : null;
  const symbolDarkFlowAlert = latestDarkFlowAlert?.symbol === normalizedSymbol ? latestDarkFlowAlert : null;

  // Lấy whale feed + summary
  const [feedData, setFeedData] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [orderFlowData, setOrderFlowData] = useState(null);
  const [orderFlowLoading, setOrderFlowLoading] = useState(true);
  const [orderFlowWindow, setOrderFlowWindow] = useState('30m');

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const [feedResp, overviewResp] = await Promise.allSettled([
        getWhaleFeed(normalizedSymbol),
        getStockWorkspaceOverview(normalizedSymbol),
      ]);

      if (feedResp.status === 'fulfilled') {
        setFeedData(feedResp.value.data);
      }
      if (overviewResp.status === 'fulfilled') {
        setCompanyName(overviewResp.value.data?.company_name || '');
      }
    } catch (_) {}
    finally { setFeedLoading(false); }
  }, [normalizedSymbol]);

  useEffect(() => { setFeedData(null); fetchFeed(); }, [fetchFeed]);

  // Re-fetch khi có WS whale alert
  const prevWhaleRef = useRef(null);
  useEffect(() => {
    if (symbolWhaleAlert && symbolWhaleAlert?.ts !== prevWhaleRef.current) {
      prevWhaleRef.current = symbolWhaleAlert.ts;
      fetchFeed();
    }
  }, [symbolWhaleAlert, fetchFeed]);

  // Auto-refresh mỗi 60s
  useEffect(() => {
    const id = setInterval(fetchFeed, 60_000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  const fetchOrderFlow = useCallback(async ({ silent = false } = {}) => {
    if (!normalizedSymbol) return;
    if (!silent) setOrderFlowLoading(true);
    try {
      const response = await getStockOrderFlow(normalizedSymbol, orderFlowWindow);
      setOrderFlowData(response?.data || null);
    } catch (_) {
      setOrderFlowData(null);
    } finally {
      if (!silent) setOrderFlowLoading(false);
    }
  }, [normalizedSymbol, orderFlowWindow]);

  useEffect(() => {
    if (!normalizedSymbol) return;
    let cancelled = false;

    const run = async (silent = false) => {
      if (cancelled) return;
      await fetchOrderFlow({ silent });
    };

    run(false);
    const interval = setInterval(() => {
      run(true);
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchOrderFlow, normalizedSymbol]);

  const prevDarkFlowRef = useRef(null);
  useEffect(() => {
    if (symbolDarkFlowAlert && symbolDarkFlowAlert?.ts !== prevDarkFlowRef.current) {
      prevDarkFlowRef.current = symbolDarkFlowAlert.ts;
      fetchOrderFlow({ silent: true });
    }
  }, [symbolDarkFlowAlert, fetchOrderFlow]);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 p-4 xl:px-5">
      {/* Header */}
      <section className="card-section px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/watchlist" className="text-label hover:text-slate-300 transition-colors">
              {t('layout.nav.watchlist')}
            </Link>
            <span className="text-slate-700">/</span>
            <Link to={`/stocks/${normalizedSymbol}`} className="text-label hover:text-slate-300 transition-colors">
              {normalizedSymbol}
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-200 text-sm font-semibold">🦈 {t('layout.nav.whaleAlerts')}</span>

            <div className="w-full mt-1 text-xs text-slate-400">
              <span className="text-slate-500">{t('whaleAlertsDashboard.stockSymbol')}:</span> <span className="font-semibold text-slate-200">{normalizedSymbol}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="text-slate-500">{t('whaleAlertsDashboard.companyName')}:</span>{' '}
              <span className="font-semibold text-slate-200">{companyName || t('whaleAlertsDashboard.updating')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* WS whale alert badge */}
            {symbolWhaleAlert && (
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold animate-pulse ${
                (symbolWhaleAlert.side || '').toLowerCase() === 'buy'
                  ? 'border-emerald-600/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-rose-600/60 bg-rose-950/40 text-rose-300'
              }`}>
                🚨 {(symbolWhaleAlert.side || '').toUpperCase()} · {fmtBil(symbolWhaleAlert.matched_value)}
              </div>
            )}
            <div className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400">
              {realtimeStatus === 'live' ? t('whaleAlertsDashboard.statusLive') : realtimeStatus === 'polling' ? t('whaleAlertsDashboard.statusPolling') : t('whaleAlertsDashboard.statusConnecting')}
              {lastEventAt ? ` · ${new Date(lastEventAt).toLocaleTimeString(undefined)}` : ''}
            </div>
            <Link
              to={`/stocks/${normalizedSymbol}`}
              className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← {t('whaleAlertsDashboard.stockWorkspace')}
            </Link>
          </div>
        </div>
      </section>

      {/* Row 1: Alert Feed + (Donut + Depth stacked) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <WhaleFeedPanel
          symbol={normalizedSymbol}
          realtimeAlerts={symbolAlerts}
          feedData={feedData}
          loading={feedLoading}
          onRefresh={fetchFeed}
        />
        <div className="grid h-full min-h-0 grid-rows-2 gap-4">
          <MoneyFlowDonut summary={feedData?.summary} loading={feedLoading} compact />
          <DepthChartPanel symbol={normalizedSymbol} compact />
        </div>
      </div>

      {/* Row 2: Bubble Chart + RVOL */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <BubbleOrderChart orders={feedData?.whale_orders} loading={feedLoading} />
        <RVOLChartPanel symbol={normalizedSymbol} loading={false} />
      </div>

      {/* Row 3: Order Flow Radar full width */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <OrderFlowRadarPanel
            symbol={normalizedSymbol}
            loading={orderFlowLoading}
            orderFlowData={orderFlowData}
            latestRealtimeAlert={symbolDarkFlowAlert}
            window={orderFlowWindow}
            onWindowChange={setOrderFlowWindow}
          />
        </div>
      </div>
    </div>
  );
}
