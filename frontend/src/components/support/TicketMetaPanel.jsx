import React from 'react';

export default function TicketMetaPanel({ ticket, t, onReopen, reopenLoading, showStaffFields = false }) {
  if (!ticket) {
    return null;
  }

  const canReopen = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 md:grid-cols-2">
        <p><span className="text-slate-500">{t('support.ticketCode')}:</span> {ticket.ticket_code}</p>
        <p><span className="text-slate-500">{t('support.statusLabel')}:</span> {t(`support.status.${ticket.status}`, { defaultValue: ticket.status })}</p>
        <p><span className="text-slate-500">{t('support.priorityLabel')}:</span> {t(`support.priority.${ticket.priority}`, { defaultValue: ticket.priority })}</p>
        <p><span className="text-slate-500">{t('support.category')}:</span> {t(`support.categoryOptions.${ticket.category}`, { defaultValue: ticket.category })}</p>
        {showStaffFields && <p><span className="text-slate-500">{t('support.requester')}:</span> {ticket.requester_username || '—'}</p>}
        {showStaffFields && <p><span className="text-slate-500">{t('support.assignee')}:</span> {ticket.assignee_username || '—'}</p>}
      </div>
      {canReopen && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onReopen}
            disabled={reopenLoading}
            className="rounded-lg border border-amber-600 bg-amber-600/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-600/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('support.reopenTicket')}
          </button>
        </div>
      )}
    </div>
  );
}
