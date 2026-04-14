import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

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

export function DepthChartPanel({ symbol, compact = false }) {
  const { t } = useI18n();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    try {
      const { getDepthChart } = await import('../api/client');
      const r = await getDepthChart(symbol);
      setData(r.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, [symbol]);

  React.useEffect(() => { setLoading(true); fetch(); }, [fetch]);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const bids = [...(data.bids || [])].reverse();
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
                    label={{ value: t('whaleAlertsDashboard.referenceShort'), fill: '#f59e0b', fontSize: 10, position: 'top' }}
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
        </>
      )}
    </section>
  );
}
