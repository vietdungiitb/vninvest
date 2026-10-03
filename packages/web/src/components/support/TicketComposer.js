import React, { useState } from 'react';

const { createElement } = React;
const e = createElement;

export default function TicketComposer({
  disabled,
  onSubmit,
  t,
}) {
  const [body, setBody] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    await onSubmit({ body: body.trim() });
    setBody('');
  };

  return e("form", { onSubmit: handleSubmit, className: "rounded-xl border border-slate-800 bg-slate-900/50 p-3" }, [
    e("textarea", {
      key: "body-textarea",
      value: body,
      onChange: (event) => setBody(event.target.value),
      rows: 4,
      placeholder: t('support.replyPlaceholder', 'Nhập nội dung phản hồi...'),
      className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
    }),
    e("div", { key: "actions", className: "mt-2 flex justify-end" },
      e("button", {
        type: "submit",
        disabled: disabled || body.trim().length < 2,
        className: "rounded-lg border border-cyan-600 bg-cyan-600/20 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-50"
      }, t('support.sendReply', 'Gửi phản hồi'))
    )
  ]);
}
