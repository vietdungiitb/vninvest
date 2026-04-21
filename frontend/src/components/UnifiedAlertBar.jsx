import React from 'react';
import { useI18n } from '../context/LangContext';
import { alertSeveritySummaryTone } from '../utils/alertTaxonomy';

function SummaryChip({ label, count, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`v2-chip-focus rounded-md border px-3 py-1.5 text-left transition-all duration-150 hover:-translate-y-[1px] hover:brightness-110 ${tone} ${active ? 'ring-1 ring-offset-0 ring-white/30' : ''}`}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] opacity-85">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold leading-none tabular-nums">{count}</p>
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
    <section className="v2-panel rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            {t('dashboardRealtime.unifiedAlertStripTitle')}
          </h2>
          <p className="mt-0.5 max-w-[64ch] text-[11px] text-slate-500">{t('dashboardRealtime.unifiedAlertStripHint')}</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-[11px] text-slate-300">
          {t('dashboardRealtime.unreadAlerts', { count: formatNumber(unreadCount) })}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryChip
          label={t('dashboardRealtime.severityCritical')}
          count={formatNumber(alertSummary.critical || 0)}
          tone={alertSeveritySummaryTone('critical')}
          active={severityFilter === 'critical_only'}
          onClick={() => onSeverityFilterChange('critical_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityHigh')}
          count={formatNumber(alertSummary.high || 0)}
          tone={alertSeveritySummaryTone('high')}
          active={severityFilter === 'high_only'}
          onClick={() => onSeverityFilterChange('high_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityMedium')}
          count={formatNumber(alertSummary.medium || 0)}
          tone={alertSeveritySummaryTone('medium')}
          active={severityFilter === 'medium_only'}
          onClick={() => onSeverityFilterChange('medium_only')}
        />
        <SummaryChip
          label={t('dashboardRealtime.severityLow')}
          count={formatNumber(alertSummary.low || 0)}
          tone={alertSeveritySummaryTone('low')}
          active={severityFilter === 'low_only'}
          onClick={() => onSeverityFilterChange('low_only')}
        />
      </div>
    </section>
  );
}
