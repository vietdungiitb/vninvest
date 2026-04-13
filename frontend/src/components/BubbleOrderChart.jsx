import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

function fmtPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString(undefined);
}

function fmtVol(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
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

function severityLabel(severity, t) {
  const normalizedSeverity = String(severity || '').toLowerCase();
  if (normalizedSeverity === 'extreme') return t('whaleHub.severityExtreme');
  if (normalizedSeverity === 'high') return t('whaleHub.severityHigh');
  if (normalizedSeverity === 'medium') return t('whaleHub.severityMedium');
  return t('whaleHub.severityLow');
}

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
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 sm:items-center">
        <div className="min-w-0">
          <p className="text-label">{t('whaleAlertsDashboard.largeOrderDistribution')}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.priceVolumeBubble')}</h3>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2 whitespace-nowrap text-[10px] text-slate-400 sm:gap-3">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />{t('whaleAlertsDashboard.buy')}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />{t('whaleAlertsDashboard.sell')}</span>
        </div>
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <XAxis
              dataKey="idx"
              type="number"
              tick={false}
              axisLine={false}
              tickLine={false}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 20 }}
              tickFormatter={(v) => Number(v).toLocaleString()}
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
                    <p className="text-slate-400">{d.time} · {fmtPrice(d.price)} · {t('whaleAlertsDashboard.volumeShort')} {fmtVol(d.volume)}</p>
                    <p style={{ color: sideColor(d.side) }}>{d.side === 'buy' ? `▲ ${t('whaleAlertsDashboard.buy')}` : d.side === 'sell' ? `▼ ${t('whaleAlertsDashboard.sell')}` : '—'} {sizeClassEmoji(d.size_class)}</p>
                    <p className="text-slate-400">{t('whaleAlertsDashboard.severity')}: {d.severity ? severityLabel(d.severity, t) : '—'} · {t('whaleAlertsDashboard.score')}: {d.display_score ?? '—'}</p>
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
