import React from 'react';

export default function SupportQueueFilters({ filters, onChange, t }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={filters.search}
          onChange={(event) => onChange('search', event.target.value)}
          placeholder={t('support.staffFilters.searchPlaceholder')}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        />
        <select
          value={filters.status}
          onChange={(event) => onChange('status', event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        >
          <option value="">{t('support.staffFilters.statusAll')}</option>
          <option value="OPEN">{t('support.status.OPEN')}</option>
          <option value="IN_PROGRESS">{t('support.status.IN_PROGRESS')}</option>
          <option value="RESOLVED">{t('support.status.RESOLVED')}</option>
          <option value="CLOSED">{t('support.status.CLOSED')}</option>
          <option value="REOPENED">{t('support.status.REOPENED')}</option>
        </select>
        <select
          value={filters.priority}
          onChange={(event) => onChange('priority', event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        >
          <option value="">{t('support.staffFilters.priorityAll')}</option>
          <option value="LOW">{t('support.priority.LOW')}</option>
          <option value="MEDIUM">{t('support.priority.MEDIUM')}</option>
          <option value="HIGH">{t('support.priority.HIGH')}</option>
          <option value="URGENT">{t('support.priority.URGENT')}</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={filters.mineOnly}
            onChange={(event) => onChange('mineOnly', event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
          />
          {t('support.staffFilters.mineOnly')}
        </label>
      </div>
    </div>
  );
}