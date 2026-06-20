import React, { useState } from 'react';

const { createElement } = React;
const e = createElement;

const categories = ['TECHNICAL', 'ACCOUNT', 'BILLING', 'FEATURE_REQUEST', 'OTHER'];

export default function TicketCreationForm({ onCreateTicket, loading, t }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('TECHNICAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [body, setBody] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (subject.trim().length < 10 || body.trim().length < 20) {
      return;
    }
    await onCreateTicket({
      subject: subject.trim(),
      category,
      priority,
      body: body.trim(),
    });
    setSubject('');
    setBody('');
  };

  return e("form", { onSubmit: submit, className: "space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4" }, [
    e("div", { key: "subject-block" }, [
      e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
        t('support.subject', 'Tiêu đề')
      ),
      e("input", {
        key: "input",
        value: subject,
        onChange: (event) => setSubject(event.target.value),
        className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
        placeholder: t('support.subjectPlaceholder', 'Nhập tiêu đề (tối thiểu 10 ký tự)...')
      })
    ]),
    e("div", { key: "grid-block", className: "grid grid-cols-1 gap-3 md:grid-cols-2" }, [
      e("div", { key: "category" }, [
        e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
          t('support.category', 'Danh mục')
        ),
        e("select", {
          key: "category-select",
          value: category,
          onChange: (event) => setCategory(event.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        }, categories.map((item) =>
          e("option", { key: item, value: item }, t(`support.categoryOptions.${item}`, item))
        ))
      ]),
      e("div", { key: "priority" }, [
        e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
          t('support.priorityLabel', 'Độ ưu tiên')
        ),
        e("select", {
          key: "priority-select",
          value: priority,
          onChange: (event) => setPriority(event.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        }, [
          e("option", { key: "low", value: "LOW" }, t('support.priority.LOW', 'Thấp')),
          e("option", { key: "medium", value: "MEDIUM" }, t('support.priority.MEDIUM', 'Trung bình')),
          e("option", { key: "high", value: "HIGH" }, t('support.priority.HIGH', 'Cao')),
          e("option", { key: "urgent", value: "URGENT" }, t('support.priority.URGENT', 'Khẩn cấp'))
        ])
      ])
    ]),
    e("div", { key: "description-block" }, [
      e("label", { key: "lbl", className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" },
        t('support.description', 'Mô tả chi tiết')
      ),
      e("textarea", {
        key: "textarea",
        value: body,
        onChange: (event) => setBody(event.target.value),
        rows: 6,
        className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
        placeholder: t('support.descriptionPlaceholder', 'Nhập mô tả chi tiết yêu cầu hỗ trợ (tối thiểu 20 ký tự)...')
      })
    ]),
    e("div", { key: "actions", className: "flex justify-end" },
      e("button", {
        type: "submit",
        disabled: loading || subject.trim().length < 10 || body.trim().length < 20,
        className: "rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
      }, loading ? t('support.creating', 'Đang tạo...') : t('support.createTicket', 'Gửi yêu cầu hỗ trợ'))
    )
  ]);
}
