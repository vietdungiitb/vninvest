import React from 'react';

const { createElement } = React;
const e = createElement;

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
  return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/45 px-4 py-3" }, [
    e("p", { key: "label", className: "text-xs uppercase tracking-wide text-slate-500" }, label),
    e("p", { key: "value", className: "mt-1 text-2xl font-bold text-slate-100" }, value),
    hint ? e("p", { key: "hint", className: "mt-1 text-xs text-slate-400" }, hint) : null
  ]);
}

export default function SupportOpsDashboard({ data, loading, t }) {
  if (loading) {
    return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/45 p-4 text-sm text-slate-400" },
      t('support.ops.loading', 'Đang tải thống kê...')
    );
  }

  if (!data) {
    return null;
  }

  return e("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" }, [
    e(StatCard, {
      key: "active",
      label: t('support.ops.activeQueue', 'Vé đang xử lý'),
      value: data.queue?.active_total ?? 0,
      hint: `${t('support.ops.unassigned', 'Chưa phân công')}: ${data.queue?.unassigned_active ?? 0}`
    }),
    e(StatCard, {
      key: "urgent",
      label: t('support.ops.urgentQueue', 'Vé khẩn cấp'),
      value: data.queue?.urgent_active ?? 0,
      hint: `${t('support.ops.reopened', 'Mở lại')}: ${data.queue?.reopened_active ?? 0}`
    }),
    e(StatCard, {
      key: "first-response",
      label: t('support.ops.firstResponseAvg', 'Phản hồi đầu TB'),
      value: fmtDuration(data.sla?.avg_first_response_seconds),
      hint: `${t('support.ops.breach8h', 'Quá hạn 8h')}: ${data.sla?.first_response_breach_8h ?? 0}`
    }),
    e(StatCard, {
      key: "resolution",
      label: t('support.ops.resolutionAvg', 'Giải quyết TB'),
      value: fmtDuration(data.sla?.avg_resolution_seconds),
      hint: `${t('support.ops.breach72h', 'Quá hạn 72h')}: ${data.sla?.resolution_breach_72h ?? 0}`
    })
  ]);
}
