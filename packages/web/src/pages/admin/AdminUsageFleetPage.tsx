import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { defaultCoreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { downloadSocCsv } from './socCsv.js';
import { useI18n } from '../../context/LangContext.js';
import { usePortfolio } from '../../context/PortfolioContext.js';

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p> : null}
    </div>
  );
}

const fmtInt = (v: any) => new Intl.NumberFormat('vi-VN').format(Number(v || 0));

export function AdminUsageFleetPage() {
  const { t } = useI18n();
  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn + không fetch.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!isStaffGate) return;
    setLoading(true);
    setError(null);
    try {
      const api = defaultCoreApiAdapter as unknown as {
        getSocUsageOverview: () => Promise<any>;
      };
      setOverview(await api.getSocUsageOverview());
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('common.noPermission')
        : t('adminUsageFleet.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t, isStaffGate]);

  useEffect(() => { load(); }, [load]);

  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  const top = overview?.top_tenants || [];
  const near = overview?.quotas_near_limit || [];
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Admin / Usage</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{t('adminUsageFleet.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminUsageFleet.description')}</p>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadSocCsv('/operator/soc/usage/export/', { days: 30 }, 'soc-usage.csv');
              } catch (err: any) {
                setError(err?.message || t('adminUsageFleet.errorGeneric'));
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            {t('adminUsageFleet.export')}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{String(error?.message || error)}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t('adminUsageFleet.callsToday')} value={fmtInt(overview?.calls_today)} />
        <MetricCard label={t('adminUsageFleet.calls30d')} value={fmtInt(overview?.calls_30d)} />
        <MetricCard label={t('adminUsageFleet.errorRate')} value={`${((overview?.error_rate_30d || 0) * 100).toFixed(2)}%`} />
        <MetricCard label={t('adminUsageFleet.nearLimit')} value={String(near.length)} detail={t('adminUsageFleet.nearLimitDetail')} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{t('adminUsageFleet.topTitle')}</h2>
        {top.length > 0 ? (
          <table className="mt-3 min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead><tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="px-3 py-2">{t('adminUsageFleet.thTenant')}</th>
              <th className="px-3 py-2">{t('adminUsageFleet.thCalls')}</th>
              <th className="px-3 py-2">{t('adminUsageFleet.thErrors')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {top.map((r: any) => (
                <tr key={r.tenant_id}>
                  <td className="px-3 py-2"><Link className="text-blue-600 hover:underline" to={`/admin/tenants/${r.tenant_id}/usage`}>{r.display_name || r.tenant_code}</Link></td>
                  <td className="px-3 py-2">{fmtInt(r.calls)}</td>
                  <td className="px-3 py-2">{fmtInt(r.errors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{loading ? t('adminUsageFleet.loading') : t('adminUsageFleet.empty')}</p>
        )}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{t('adminUsageFleet.quotaTitle')}</h2>
        {near.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {near.map((r: any, i: number) => (
              <li key={`${r.tenant_code}-${i}`} className="flex items-center justify-between rounded-xl bg-amber-500/10 px-4 py-2 text-sm">
                <span>{r.display_name || r.tenant_code} · {r.meter}</span>
                <span className="font-semibold text-amber-700 dark:text-amber-300">{r.used_pct}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t('adminUsageFleet.quotaEmpty')}</p>
        )}
      </div>
    </div>
  );
}
