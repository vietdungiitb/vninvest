import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

function fmtVol(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}

function fmtExact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined);
}

const CustomBarShape = (props) => {
  const { x, y, width, height, payload } = props;
  const fill = payload?.is_spike ? '#a855f7' : '#0ea5e9';
  const opacity = payload?.is_spike ? 1 : 0.75;
  return <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={opacity} rx={2} />;
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

  const buckets = data?.buckets || [];
  const maxSpike = buckets.reduce((max, b) => (b.is_spike && b.rvol > max ? b.rvol : max), 0);
  const volumeDomainMax = React.useMemo(() => {
    const maxVolume = buckets.reduce((max, b) => {
      const n = Number(b?.volume) || 0;
      return n > max ? n : max;
    }, 0);
    if (maxVolume <= 0) return 1;
    return Math.ceil(maxVolume * 1.25);
  }, [buckets]);
  const chartData = React.useMemo(() => {
    return buckets.map((b) => {
      const baseline = Number(b?.baseline_avg) || 0;
      const baselinePlot = Math.min(baseline, volumeDomainMax * 0.95);
      return {
        ...b,
        baseline_plot: baselinePlot,
      };
    });
  }, [buckets, volumeDomainMax]);
  const baseline2xRaw = (buckets.find((b) => Number(b.baseline_avg) > 0)?.baseline_avg || 0) * 2;
  const baseline2xPlot = Math.min(Number(baseline2xRaw) || 0, volumeDomainMax * 0.95);

  const renderTooltip = React.useCallback(({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload || {};
    const volumeRaw = Number(point?.volume) || 0;
    const baselineRaw = Number(point?.baseline_avg) || 0;
    const rvol = Number(point?.rvol);

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="mb-1 text-base font-semibold text-white">{label}</div>
        <div className="space-y-1">
          <div>
            <span className="text-slate-300">{t('whaleAlertsDashboard.volumeShort')}:</span>{' '}
            <span className="font-semibold text-cyan-300">{fmtVol(volumeRaw)}</span>{' '}
            <span className="text-slate-400">({t('whaleAlertsDashboard.exactValue')}: {fmtExact(volumeRaw)})</span>
          </div>
          <div>
            <span className="text-slate-300">{t('whaleAlertsDashboard.baseline20')}:</span>{' '}
            <span className="font-semibold text-amber-300">{fmtVol(baselineRaw)}</span>{' '}
            <span className="text-slate-400">({t('whaleAlertsDashboard.exactValue')}: {fmtExact(baselineRaw)})</span>
          </div>
          {Number.isFinite(rvol) && (
            <div>
              <span className="text-slate-300">RVOL:</span>{' '}
              <span className="font-semibold text-violet-300">{rvol.toFixed(2)}x</span>
            </div>
          )}
        </div>
      </div>
    );
  }, [t]);

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
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
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
                domain={[0, volumeDomainMax]}
              />
              <Tooltip
                content={renderTooltip}
              />
              <Bar dataKey="volume" minPointSize={3} shape={<CustomBarShape />} />
              <Line dataKey="baseline_plot" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
              <ReferenceLine
                y={baseline2xPlot}
                stroke="#a855f7"
                strokeDasharray="4 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: '#0ea5e9' }} />{t('whaleAlertsDashboard.volumeShort')}</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500 mr-1 align-middle" />{t('whaleAlertsDashboard.spikeLegend')}</span>
        <span><span className="inline-block w-2.5 h-0.5 bg-amber-400 mr-1 align-middle" />{t('whaleAlertsDashboard.baseline20')}</span>
        <span><span className="inline-block w-2.5 h-0.5 bg-violet-500 mr-1 align-middle" style={{ borderTop: '2px dashed #a855f7', background: 'transparent' }} />{t('whaleAlertsDashboard.avg2x')}</span>
      </div>
    </section>
  );
}
