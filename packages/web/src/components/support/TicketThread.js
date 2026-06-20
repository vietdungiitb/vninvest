import React from 'react';

const { createElement } = React;
const e = createElement;

function roleStyle(senderRole) {
  if (senderRole === 'STAFF') {
    return 'self-start border-cyan-700/70 bg-cyan-500/10';
  }
  if (senderRole === 'SYSTEM') {
    return 'self-center border-slate-600/70 bg-slate-700/20';
  }
  return 'self-end border-slate-700 bg-slate-800/70';
}

export default function TicketThread({ messages, loading, t }) {
  if (loading) {
    return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400" },
      t('support.loadingThread', 'Đang tải hội thoại...')
    );
  }

  if (!messages || !messages.length) {
    return e("div", { className: "rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400" },
      t('support.emptyThread', 'Không có tin nhắn nào.')
    );
  }

  // Reverse messages list so that latest is at the bottom (oldest at the top) or display in default order.
  // In legacy it maps directly: messages.map(...). Let's keep it identical.
  return e("div", { className: "flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3" },
    messages.map((message) =>
      e("div", { key: message.id, className: `max-w-[85%] rounded-xl border px-3 py-2 ${roleStyle(message.sender_role)}` }, [
        e("div", { key: "meta", className: "mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400" }, [
          e("span", { key: "sender", className: "font-semibold text-slate-300" }, message.sender_username),
          e("span", { key: "time" }, message.created_at ? new Date(message.created_at).toLocaleString('vi-VN') : '—')
        ]),
        e("p", { key: "body", className: "whitespace-pre-wrap text-sm text-slate-100" }, message.body),
        (Array.isArray(message.attachments) && message.attachments.length > 0) ? e("div", { key: "attachments", className: "mt-2 space-y-1 text-xs text-slate-300" },
          message.attachments.map((attachment) =>
            e("div", { key: attachment.id, className: "rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1" },
              `${attachment.original_name} (${Math.round((attachment.size_bytes || 0) / 1024)} KB)`
            )
          )
        ) : null
      ])
    )
  );
}
