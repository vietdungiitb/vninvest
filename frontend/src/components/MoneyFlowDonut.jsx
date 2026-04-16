import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useI18n } from '../context/LangContext';

const DONUT_COLORS = ['#22c55e', '#f43f5e', '#64748b'];

function fmtBil(v) {
  if (v == null) return '—';
  const n = Number(v);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `${n < 0 ? '-' : ''}${(abs / 1_000_000_000_000).toFixed(1)}N`;
  if (abs >= 1_000_000_000) return `${n < 0 ? '-' : ''}${(abs / 1_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}${(abs / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString(undefined);
}

export function MoneyFlowDonut({ summary, loading, compact = false }) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(null);

  if (loading) {
    return (
      <section className={`card-section p-4 ${compact ? 'h-full min-h-0' : ''}`}>
        <div className="h-48 animate-pulse rounded-xl bg-slate-900" />
      </section>
    );
  }

  const donutData = [
    {
      name: t('whaleAlertsDashboard.sideBuySegment'),
      shortName: t('whaleAlertsDashboard.sideBuySegmentShort'),
      value: summary?.buy_pct || 0,
    },
    {
      name: t('whaleAlertsDashboard.sideSellSegment'),
      shortName: t('whaleAlertsDashboard.sideSellSegmentShort'),
      value: summary?.sell_pct || 0,
    },
    {
      name: t('whaleAlertsDashboard.sideUnknownSegment'),
      shortName: t('whaleAlertsDashboard.sideUnknownSegmentShort'),
      value: summary?.unknown_pct || 0,
    },
  ].filter((d) => d.value > 0);

  const amountByIndex = [summary?.buy_value, summary?.sell_value, summary?.unknown_value];
  const flowNet = summary?.flow_net || 0;
  const netColor = flowNet >= 0 ? '#22c55e' : '#f43f5e';

  const centerLabel = activeIndex !== null && donutData[activeIndex]
    ? { text: donutData[activeIndex].shortName, value: fmtBil(amountByIndex[activeIndex]), color: DONUT_COLORS[activeIndex] }
    : { text: t('whaleAlertsDashboard.flowNet'), value: `${flowNet >= 0 ? '+' : ''}${fmtBil(flowNet)}`, color: netColor };

  return (
    <section className={`card-section p-4 ${compact ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className="border-b border-slate-800 pb-3">
        <p className="text-label">{t('whaleAlertsDashboard.sessionFlow')}</p>
        <h3 className="mt-0.5 text-sm font-semibold text-white">{t('whaleAlertsDashboard.sideFlowBreakdown')}</h3>
      </div>
      <div className={`mt-3 flex items-center gap-2 ${compact ? 'flex-1' : ''}`}>
        <div className={`relative shrink-0 ${compact ? 'h-44 w-44' : 'h-32 w-32'}`}>
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
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {donutData.length > 0
                  ? donutData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                        style={{ cursor: 'default', outline: 'none' }}
                      />
                    ))
                  : <Cell fill="#1e293b" />}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] text-slate-400 leading-tight text-center px-1">{centerLabel.text}</span>
            <span className="text-[12px] font-bold leading-tight" style={{ color: centerLabel.color }}>
              {centerLabel.value}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-[12px]">
          {donutData.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5" title={d.name}>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
              <span className="truncate text-slate-400 text-[11px]">{d.shortName}</span>
              <span className="ml-auto font-semibold text-white text-[11px]">{d.value.toFixed(1)}%</span>
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
            <div className="flex justify-between mt-0.5">
              <span className="text-slate-500">{t('whaleAlertsDashboard.other')}</span>
              <span className="text-slate-300 font-semibold">{fmtBil(summary?.unknown_value)}</span>
            </div>
            <div className="mt-1 border-t border-slate-800 pt-1 flex justify-between">
              <span className="text-slate-500">{t('whaleAlertsDashboard.total')}</span>
              <span className="text-white font-semibold">{fmtBil(summary?.total_value)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
