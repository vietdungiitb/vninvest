import React from 'react';

const { createElement } = React;
const e = createElement;

export default function SupportQueueFilters({ filters, onChange, t }) {
  return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/45 p-3" },
    e("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" }, [
      e("input", {
        key: "search-input",
        value: filters.search || "",
        onChange: (event) => onChange('search', event.target.value),
        placeholder: t('support.staffFilters.searchPlaceholder', 'Tìm kiếm...'),
        className: "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
      }),
      e("select", {
        key: "status-select",
        value: filters.status || "",
        onChange: (event) => onChange('status', event.target.value),
        className: "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
      }, [
        e("option", { key: "all", value: "" }, t('support.staffFilters.statusAll', 'Tất cả trạng thái')),
        e("option", { key: "open", value: "OPEN" }, t('support.status.OPEN', 'Mở')),
        e("option", { key: "progress", value: "IN_PROGRESS" }, t('support.status.IN_PROGRESS', 'Đang xử lý')),
        e("option", { key: "resolved", value: "RESOLVED" }, t('support.status.RESOLVED', 'Đã giải quyết')),
        e("option", { key: "closed", value: "CLOSED" }, t('support.status.CLOSED', 'Đã đóng')),
        e("option", { key: "reopened", value: "REOPENED" }, t('support.status.REOPENED', 'Mở lại')),
      ]),
      e("select", {
        key: "priority-select",
        value: filters.priority || "",
        onChange: (event) => onChange('priority', event.target.value),
        className: "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
      }, [
        e("option", { key: "all", value: "" }, t('support.staffFilters.priorityAll', 'Tất cả độ ưu tiên')),
        e("option", { key: "low", value: "LOW" }, t('support.priority.LOW', 'Thấp')),
        e("option", { key: "medium", value: "MEDIUM" }, t('support.priority.MEDIUM', 'Trung bình')),
        e("option", { key: "high", value: "HIGH" }, t('support.priority.HIGH', 'Cao')),
        e("option", { key: "urgent", value: "URGENT" }, t('support.priority.URGENT', 'Khẩn cấp')),
      ]),
      e("label", {
        key: "mine-label",
        className: "flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
      }, [
        e("input", {
          key: "mine-checkbox",
          type: "checkbox",
          checked: Boolean(filters.mineOnly),
          onChange: (event) => onChange('mineOnly', event.target.checked),
          className: "h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
        }),
        t('support.staffFilters.mineOnly', 'Chỉ vé của tôi')
      ])
    ])
  );
}
