import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

const DONUT_COLORS = ['#0891b2', '#7c3aed', '#475569'];

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

export function MoneyFlowDonut({ summary, loading, compact = false }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <section className={`card-section p-4 ${compact ? 'h-full min-h-0' : ''}`}>
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const donutData = [
    { name: t('whaleAlertsDashboard.sharkSegment'), value: summary?.shark_pct || 0 },
    { name: t('whaleAlertsDashboard.whaleSegment'), value: summary?.whale_pct || 0 },
    { name: t('whaleAlertsDashboard.retailSegment'), value: summary?.small_pct || 0 },
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
