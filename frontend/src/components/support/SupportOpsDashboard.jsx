import React from 'react';

function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return '—';
  }
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function SupportOpsDashboard({ data, loading, t }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 text-sm text-slate-400">
        {t('support.ops.loading')}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('support.ops.activeQueue')}
        value={data.queue?.active_total ?? 0}
        hint={`${t('support.ops.unassigned')}: ${data.queue?.unassigned_active ?? 0}`}
      />
      <StatCard
        label={t('support.ops.urgentQueue')}
        value={data.queue?.urgent_active ?? 0}
        hint={`${t('support.ops.reopened')}: ${data.queue?.reopened_active ?? 0}`}
      />
      <StatCard
        label={t('support.ops.firstResponseAvg')}
        value={fmtDuration(data.sla?.avg_first_response_seconds)}
        hint={`${t('support.ops.breach8h')}: ${data.sla?.first_response_breach_8h ?? 0}`}
      />
      <StatCard
        label={t('support.ops.resolutionAvg')}
        value={fmtDuration(data.sla?.avg_resolution_seconds)}
        hint={`${t('support.ops.breach72h')}: ${data.sla?.resolution_breach_72h ?? 0}`}
      />
    </div>
  );
}