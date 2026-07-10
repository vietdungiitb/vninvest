import React from 'react';

const { createElement } = React;
const e = createElement;

export default function TicketMetaPanel({ ticket, t, onReopen, reopenLoading, showStaffFields = false }) {
  if (!ticket) {
    return null;
  }

  const canReopen = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/50 p-3" }, [
    e("div", { key: "grid", className: "grid grid-cols-1 gap-2 text-sm text-slate-300 md:grid-cols-2" }, [
      e("p", { key: "code" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.ticketCode', 'Mã vé')),
        ": ",
        ticket.ticket_code
      ]),
      e("p", { key: "status" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.statusLabel', 'Trạng thái')),
        ": ",
        t(`support.status.${ticket.status}`, ticket.status)
      ]),
      e("p", { key: "priority" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.priorityLabel', 'Độ ưu tiên')),
        ": ",
        t(`support.priority.${ticket.priority}`, ticket.priority)
      ]),
      e("p", { key: "category" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.category', 'Danh mục')),
        ": ",
        t(`support.categoryOptions.${ticket.category}`, ticket.category)
      ]),
      showStaffFields ? e("p", { key: "requester" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.requester', 'Người yêu cầu')),
        ": ",
        ticket.requester_username || '—'
      ]) : null,
      showStaffFields ? e("p", { key: "assignee" }, [
        e("span", { key: "lbl", className: "text-slate-500" }, t('support.assignee', 'Người xử lý')),
        ": ",
        ticket.assignee_username || '—'
      ]) : null,
    ]),
    canReopen ? e("div", { key: "reopen-block", className: "mt-3" },
      e("button", {
        type: "button",
        onClick: onReopen,
        disabled: reopenLoading,
        className: "rounded-lg border border-amber-600 bg-amber-600/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-600/30 disabled:cursor-not-allowed disabled:opacity-50"
      }, t('support.reopenTicket', 'Mở lại vé'))
    ) : null
  ]);
}
