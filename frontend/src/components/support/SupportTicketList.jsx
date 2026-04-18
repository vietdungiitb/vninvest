import React from 'react';

function statusClass(status) {
  if (status === 'OPEN' || status === 'REOPENED') {
    return 'bg-cyan-500/20 text-cyan-300 border-cyan-700/60';
  }
  if (status === 'IN_PROGRESS') {
    return 'bg-amber-500/20 text-amber-300 border-amber-700/60';
  }
  if (status === 'RESOLVED') {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-700/60';
  }
  return 'bg-slate-700/40 text-slate-300 border-slate-600/80';
}

const priorities = {
  LOW: 'text-slate-300',
  MEDIUM: 'text-sky-300',
  HIGH: 'text-amber-300',
  URGENT: 'text-rose-300',
};

export default function SupportTicketList({
  tickets,
  selectedTicketId,
  loading,
  onSelect,
  t,
}) {
  if (loading) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">{t('support.loadingTickets')}</div>;
  }

  if (!tickets.length) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">{t('support.emptyList')}</div>;
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const active = selectedTicketId === ticket.id;
        return (
          <button
            type="button"
            key={ticket.id}
            onClick={() => onSelect(ticket)}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${active
              ? 'border-cyan-500/60 bg-cyan-500/10'
              : 'border-slate-800 bg-slate-900/45 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-200">{ticket.ticket_code}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(ticket.status)}`}>
                {t(`support.status.${ticket.status}`, { defaultValue: ticket.status })}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100">{ticket.subject}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span className={priorities[ticket.priority] || 'text-slate-300'}>{t(`support.priority.${ticket.priority}`, { defaultValue: ticket.priority })}</span>
              <span>{new Date(ticket.updated_at).toLocaleString('vi-VN')}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
