import React, { useState } from 'react';

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

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.subject')}</label>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          placeholder={t('support.subjectPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.category')}</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{t(`support.categoryOptions.${item}`, { defaultValue: item })}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.priorityLabel')}</label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          >
            <option value="LOW">{t('support.priority.LOW')}</option>
            <option value="MEDIUM">{t('support.priority.MEDIUM')}</option>
            <option value="HIGH">{t('support.priority.HIGH')}</option>
            <option value="URGENT">{t('support.priority.URGENT')}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{t('support.description')}</label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          placeholder={t('support.descriptionPlaceholder')}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || subject.trim().length < 10 || body.trim().length < 20}
          className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t('support.creating') : t('support.createTicket')}
        </button>
      </div>
    </form>
  );
}
