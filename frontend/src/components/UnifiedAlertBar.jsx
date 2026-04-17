import React from 'react';
import { useI18n } from '../context/LangContext';

function SummaryChip({ label, count, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`v2-chip-focus min-h-[74px] rounded-lg border px-3 py-2 text-left transition-all duration-150 hover:-translate-y-[1px] hover:brightness-110 ${tone} ${active ? 'ring-1 ring-offset-0 ring-white/30' : ''}`}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] opacity-85">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-none tabular-nums">{count}</p>
    </button>
  );
}

export default function UnifiedAlertBar({
  alertSummary,
  severityFilter,
  onSeverityFilterChange,
  unreadCount,
}) {
  const { t, formatNumber } = useI18n();

  return (
    <section className="v2-panel rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
            {t('dashboardRealtime.unifiedAlertStripTitle')}
          </h2>
          <p className="mt-1 max-w-[64ch] text-xs text-slate-500">{t('dashboardRealtime.unifiedAlertStripHint')}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300">
          {t('dashboardRealtime.unreadAlerts', { count: formatNumber(unreadCount) })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryChip
          label={t('dashboardRealtime.severityCritical')}
          count={formatNumber(alertSummary.critical || 0)}
          tone="border-rose-700/70 bg-rose-950/35 text-rose-200"
          active={severityFilter === 'critical_only'}
          onClick={() => onSeverityFilterChange('critical_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityHigh')}
          count={formatNumber(alertSummary.high || 0)}
          tone="border-amber-700/70 bg-amber-950/30 text-amber-200"
          active={severityFilter === 'high_only'}
          onClick={() => onSeverityFilterChange('high_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityMedium')}
          count={formatNumber(alertSummary.medium || 0)}
          tone="border-cyan-700/70 bg-cyan-950/25 text-cyan-200"
          active={severityFilter === 'medium_only'}
          onClick={() => onSeverityFilterChange('medium_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityLow')}
          count={formatNumber(alertSummary.low || 0)}
          tone="border-slate-700 bg-slate-900 text-slate-300"
          active={severityFilter === 'low_only'}
          onClick={() => onSeverityFilterChange('low_only')}
        />
      </div>
    </section>
  );
}
