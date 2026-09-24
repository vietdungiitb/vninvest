import type { ReactNode } from 'react';
import { adminToneClasses } from './adminTone.js';

/**
 * Shared Admin Console UI kit (Slice 3 — F4).
 *
 * The 12 slate-system fleet pages (4 R-fleet + 8 AdminCore*) previously
 * copy-pasted Panel / MetricCard / ValueRow / page-header markup with slight
 * drift (shadow on/off, missing dark: pairs, divergent pills). New admin UI
 * must compose from this kit instead of adding new locals.
 *
 * Intentionally NOT covering: SOC glass panels (soc.module.css), crawl gray
 * cards, advertising violet theme, tenant-admin shell — separate subsystems.
 */

export function AdminPageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const body = (
    <>
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
      {description ? <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
    </>
  );
  return (
    <div>
      {eyebrow ? <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p> : null}
      {actions ? (
        <div className="flex items-center justify-between gap-3">
          <div>{body}</div>
          {actions}
        </div>
      ) : body}
    </div>
  );
}

export function AdminPanel({ title, description, actions, children }: {
  title: ReactNode;
  description?: ReactNode | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

type Metric = {
  label?: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  status?: unknown;
};

export function AdminMetricCard(props: Metric & { card?: Metric }) {
  const { label, value, detail, status } = props.card ?? props;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
          {detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p> : null}
        </div>
        {status ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(status)}`}>
            {String(status)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AdminValueRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
  );
}
