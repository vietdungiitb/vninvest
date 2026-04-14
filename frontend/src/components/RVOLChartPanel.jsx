import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

function fmtVol(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}

const CustomBarShape = (props) => {
  const { x, y, width, height, payload } = props;
  const fill = payload?.is_spike ? '#a855f7' : '#334155';
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />;
};

export function RVOLChartPanel({ symbol, loading: parentLoading }) {
  const { t } = useI18n();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const { getRVOL } = await import('../api/client');
        const r = await getRVOL(symbol);
        if (!cancelled) setData(r.data);
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    };
    fetch();
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
                  name === 'volume' ? t('whaleAlertsDashboard.volumeShort') : t('whaleAlertsDashboard.sma20'),
                ]}
              />
              <Bar dataKey="volume" shape={<CustomBarShape />} />
              <Line dataKey="sma20" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine
                y={(data.buckets.find((b) => b.sma20 > 0)?.sma20 || 0) * 2}
                stroke="#a855f7"
                strokeDasharray="4 2"
                label={{ value: t('whaleAlertsDashboard.avg2x'), fill: '#a855f7', fontSize: 10, position: 'insideTopRight' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500 mr-1 align-middle" />{t('whaleAlertsDashboard.spikeLegend')}</span>
        <span><span className="inline-block w-2.5 h-0.5 bg-amber-400 mr-1 align-middle" />{t('whaleAlertsDashboard.sma20')}</span>
      </div>
    </section>
  );
}
