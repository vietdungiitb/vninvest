import React from 'react';

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
    return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">{t('support.loadingThread')}</div>;
  }

  if (!messages.length) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">{t('support.emptyThread')}</div>;
  }

  return (
    <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      {messages.map((message) => (
        <div key={message.id} className={`max-w-[85%] rounded-xl border px-3 py-2 ${roleStyle(message.sender_role)}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">{message.sender_username}</span>
            <span>{new Date(message.created_at).toLocaleString('vi-VN')}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-100">{message.body}</p>
          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-slate-300">
              {message.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1">
                  {attachment.original_name} ({Math.round((attachment.size_bytes || 0) / 1024)} KB)
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
