import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { defaultCoreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { AdminPageHeader, AdminEmptyState } from './adminUi.js';

export function AdminAnalyticsPage() {
  const { t } = useI18n();
  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn + không fetch.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  const [days, setDays] = useState(30);
  const [growth, setGrowth] = useState<any>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const load = useCallback(async () => {
    if (!isStaffGate) return;
    setLoading(true);
    setError(null);
    try {
      const api = defaultCoreApiAdapter as unknown as {
        getSocAnalyticsGrowth: (d: number) => Promise<any>;
        getSocAnalyticsCohorts: () => Promise<any>;
        getSocAnalyticsAlerts: () => Promise<any>;
      };
      const [g, c, a] = await Promise.all([
        api.getSocAnalyticsGrowth(days),
        api.getSocAnalyticsCohorts(),
        api.getSocAnalyticsAlerts(),
      ]);
      setGrowth(g);
      setCohort(c);
      setAlerts(a?.alerts || []);
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('common.noPermission')
        : t('adminAnalytics.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [days, t, isStaffGate]);

  useEffect(() => { load(); }, [load]);

  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  const rows = (growth?.signups || []).map((s: any, i: number) => ({
    date: (s.date || '').slice(5),
    signups: s.count,
    trials: growth?.trials?.[i]?.count || 0,
    paid: growth?.paid_new?.[i]?.count || 0,
    churned: growth?.churned?.[i]?.count || 0,
  }));
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <AdminPageHeader
        eyebrow={t('adminAnalytics.eyebrow')}
        title={t('adminAnalytics.title')}
        description={t('adminAnalytics.description')}
      />
      {error ? <p className="text-sm text-rose-600">{String(error?.message || error)}</p> : null}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('adminAnalytics.growthTitle')}</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                aria-selected={days === d}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${days === d ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : ''}`}
              >
                {t('adminAnalytics.days', { n: d })}
              </button>
            ))}
          </div>
        </div>
        {rows.length > 0 ? (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={rows}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.ceil(rows.length / 10)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="signups" name={t('adminAnalytics.sSignups')} fill="#3b82f6" />
                <Bar dataKey="trials" name={t('adminAnalytics.sTrials')} fill="#22c55e" />
                <Bar dataKey="paid" name={t('adminAnalytics.sPaid')} fill="#a855f7" />
                <Bar dataKey="churned" name={t('adminAnalytics.sChurned')} fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <AdminEmptyState>{loading ? t('adminAnalytics.loading') : t('adminAnalytics.empty')}</AdminEmptyState>
        )}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{t('adminAnalytics.cohortTitle')}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('adminAnalytics.trialActive')}</p>
            <p className="mt-1 text-2xl font-semibold">{cohort?.trial_active ?? '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('adminAnalytics.converted')}</p>
            <p className="mt-1 text-2xl font-semibold">{cohort?.converted_paid ?? '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('adminAnalytics.conversion')}</p>
            <p className="mt-1 text-2xl font-semibold">{cohort ? `${(cohort.conversion_rate * 100).toFixed(1)}%` : '—'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('adminAnalytics.migration')}</p>
            <p className="mt-1 text-sm font-semibold">↑ {cohort?.upgrades_30d ?? '—'} · ↓ {cohort?.downgrades_30d ?? '—'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{cohort?.notes || t('adminAnalytics.cohortNotes')}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{t('adminAnalytics.alertsTitle')}</h2>
        {alerts.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {alerts.map((a: any, i: number) => (
              <li
                key={`${a.kind}-${a.tenant_code}-${i}`}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm ${a.severity === 'critical' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}
              >
                <span>
                  <strong>{a.kind}</strong>
                  {' · '}{a.tenant_code}
                  {a.detail ? ` · ${a.detail}` : ''}
                </span>
                <span className={`font-semibold ${a.severity === 'critical' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {a.severity}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmptyState>{loading ? t('adminAnalytics.loading') : t('adminAnalytics.alertsEmpty')}</AdminEmptyState>
        )}
      </div>
    </div>
  );
}
