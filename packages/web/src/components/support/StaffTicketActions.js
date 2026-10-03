import React, { useEffect, useState } from 'react';

const { createElement } = React;
const e = createElement;

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

  return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/50 p-3" }, [
    e("div", { key: "header", className: "mb-3 flex items-center justify-between gap-3" }, [
      e("h3", { key: "title", className: "text-sm font-semibold uppercase tracking-wide text-slate-300" },
        t('support.staffActions.title', 'Thao tác nghiệp vụ')
      ),
      e("div", { key: "actions", className: "flex gap-2" }, [
        e("button", {
          key: "me-btn",
          type: "button",
          onClick: () => setAssigneeValue(currentUserId || null),
          className: "rounded-lg border border-cyan-700 bg-cyan-700/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-700/25"
        }, t('support.staffActions.assignToMe', 'Nhận xử lý')),
        e("button", {
          key: "unassign-btn",
          type: "button",
          onClick: () => setAssigneeValue(null),
          className: "rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        }, t('support.staffActions.unassign', 'Hủy phân công'))
      ])
    ]),
    e("div", { key: "grid", className: "grid grid-cols-1 gap-3 md:grid-cols-2" }, [
      e("div", { key: "status" }, [
        e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
          t('support.statusLabel', 'Trạng thái')
        ),
        e("select", {
          key: "status-select",
          value: statusValue,
          onChange: (event) => setStatusValue(event.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        }, [
          e("option", { key: "open", value: "OPEN" }, t('support.status.OPEN', 'Mở')),
          e("option", { key: "progress", value: "IN_PROGRESS" }, t('support.status.IN_PROGRESS', 'Đang xử lý')),
          e("option", { key: "resolved", value: "RESOLVED" }, t('support.status.RESOLVED', 'Đã giải quyết')),
          e("option", { key: "closed", value: "CLOSED" }, t('support.status.CLOSED', 'Đã đóng')),
          e("option", { key: "reopened", value: "REOPENED" }, t('support.status.REOPENED', 'Mở lại'))
        ])
      ]),
      e("div", { key: "priority" }, [
        e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
          t('support.priorityLabel', 'Độ ưu tiên')
        ),
        e("select", {
          key: "priority-select",
          value: priorityValue,
          onChange: (event) => setPriorityValue(event.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        }, [
          e("option", { key: "low", value: "LOW" }, t('support.priority.LOW', 'Thấp')),
          e("option", { key: "medium", value: "MEDIUM" }, t('support.priority.MEDIUM', 'Trung bình')),
          e("option", { key: "high", value: "HIGH" }, t('support.priority.HIGH', 'Cao')),
          e("option", { key: "urgent", value: "URGENT" }, t('support.priority.URGENT', 'Khẩn cấp'))
        ])
      ])
    ]),
    e("div", { key: "footer", className: "mt-3 flex items-center justify-between gap-3" }, [
      e("p", { key: "assignee", className: "text-xs text-slate-400" }, [
        t('support.assignee', 'Người xử lý'),
        ": ",
        e("span", { key: "val", className: "font-semibold text-slate-200" },
          ticket.assignee_username || t('support.staffActions.unassigned', 'Chưa phân công')
        )
      ]),
      e("button", {
        key: "save-btn",
        type: "button",
        disabled: loading,
        onClick: () => onApply({ status: statusValue, priority: priorityValue, assignee_id: assigneeValue }),
        className: "rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
      }, loading ? t('support.staffActions.saving', 'Đang lưu...') : t('support.staffActions.saveChanges', 'Lưu thay đổi'))
    ])
  ]);
}
