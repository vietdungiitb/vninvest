import React, { useEffect, useState } from 'react';

export default function StaffTicketActions({
  ticket,
  currentUserId,
  loading,
  onApply,
  t,
}) {
  const [statusValue, setStatusValue] = useState(ticket?.status || 'OPEN');
  const [priorityValue, setPriorityValue] = useState(ticket?.priority || 'MEDIUM');
  const [assigneeValue, setAssigneeValue] = useState(ticket?.assignee || null);

  useEffect(() => {
    setStatusValue(ticket?.status || 'OPEN');
    setPriorityValue(ticket?.priority || 'MEDIUM');
    setAssigneeValue(ticket?.assignee || null);
  }, [ticket?.id, ticket?.status, ticket?.priority, ticket?.assignee]);

  if (!ticket) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{t('support.staffActions.title')}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAssigneeValue(currentUserId || null)}
            className="rounded-lg border border-cyan-700 bg-cyan-700/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-700/25"
          >
            {t('support.staffActions.assignToMe')}
          </button>
          <button
            type="button"
            onClick={() => setAssigneeValue(null)}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t('support.staffActions.unassign')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.statusLabel')}</label>
          <select
            value={statusValue}
            onChange={(event) => setStatusValue(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="OPEN">{t('support.status.OPEN')}</option>
            <option value="IN_PROGRESS">{t('support.status.IN_PROGRESS')}</option>
            <option value="RESOLVED">{t('support.status.RESOLVED')}</option>
            <option value="CLOSED">{t('support.status.CLOSED')}</option>
            <option value="REOPENED">{t('support.status.REOPENED')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.priorityLabel')}</label>
          <select
            value={priorityValue}
            onChange={(event) => setPriorityValue(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="LOW">{t('support.priority.LOW')}</option>
            <option value="MEDIUM">{t('support.priority.MEDIUM')}</option>
            <option value="HIGH">{t('support.priority.HIGH')}</option>
            <option value="URGENT">{t('support.priority.URGENT')}</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {t('support.assignee')}: <span className="font-semibold text-slate-200">{ticket.assignee_username || t('support.staffActions.unassigned')}</span>
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => onApply({ status: statusValue, priority: priorityValue, assignee_id: assigneeValue })}
          className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('support.staffActions.saving') : t('support.staffActions.saveChanges')}
        </button>
      </div>
    </div>
  );
}