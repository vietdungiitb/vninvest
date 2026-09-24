/**
 * adminToneClasses — single shared status→pill-tone mapper for Admin Console pages.
 *
 * Slice 1 (F1 readability): every tone returns a LIGHT + `dark:` pair so pills
 * stay readable in both modes. The previous per-file copies returned dark-only
 * text (e.g. `text-emerald-200` with no `dark:`), which is near-invisible on
 * light cards (contrast ~1.3:1, WCAG AA needs 4.5:1).
 *
 * Keyword union covers all statuses/kinds used across AdminCore* fleet pages
 * (tenants, billing, usage, overview, jobs, audit-trace, PATs, service-accounts).
 * Unknown values fall back to the neutral slate tone (also dual-mode).
 */
const EMERALD = new Set([
  'active', 'healthy', 'normal', 'completed', 'success', 'advisory',
]);
const AMBER = new Set([
  'warning', 'trialing', 'rotating', 'queued', 'crawl_audit', 'pending_approval',
]);
const ROSE = new Set([
  'critical', 'degraded', 'suspended', 'manual', 'past_due', 'overdue',
  'credit_hold', 'revoked', 'disabled', 'failed', 'cancelled',
]);
const SKY = new Set(['running']);
const CYAN = new Set(['signal_run', 'system_ai_settings']);
const VIOLET = new Set(['crawl_run', 'whale_config']);

export function adminToneClasses(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase();
  if (EMERALD.has(normalized)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  }
  if (AMBER.has(normalized)) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200';
  }
  if (ROSE.has(normalized)) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200';
  }
  if (SKY.has(normalized)) {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200';
  }
  if (CYAN.has(normalized)) {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200';
  }
  if (VIOLET.has(normalized)) {
    return 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200';
  }
  return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200';
}
