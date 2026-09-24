import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { defaultCoreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { downloadSocCsv } from './socCsv.js';
import { useI18n } from '../../context/LangContext.js';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { AdminPageHeader, AdminMetricCard, AdminEmptyState } from './adminUi.js';

const fmtVND = (v: any, localeTag = 'vi-VN') => new Intl.NumberFormat(localeTag).format(Number(v || 0));

export function AdminBillingFleetPage() {
  const { t, localeTag } = useI18n();
  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn + không fetch.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  const [overview, setOverview] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadSocCsv('/operator/soc/billing/invoices/',
        { status, plan, search }, 'soc-invoices.csv');
    } catch (err: any) {
      setError(err?.message || t('adminBillingFleet.errorGeneric'));
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    if (!isStaffGate) return;
    setLoading(true);
    setError(null);
    try {
      const api = defaultCoreApiAdapter as unknown as {
        getSocBillingOverview: () => Promise<any>;
        getSocBillingInvoices: (p: any) => Promise<any>;
      };
      const [ov, inv] = await Promise.all([
        api.getSocBillingOverview(),
        api.getSocBillingInvoices({ page, status: status || undefined, plan: plan || undefined, search: search || undefined }),
      ]);
      setOverview(ov || null);
      setInvoices(inv?.results || []);
      setCount(Number(inv?.count || 0));
      setHasNext(Boolean(inv?.next));
      setHasPrev(Boolean(inv?.previous));
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('common.noPermission')
        : t('adminBillingFleet.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [page, status, plan, search, t, isStaffGate]);

  useEffect(() => { load(); }, [load]);

  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <AdminPageHeader
        eyebrow={t('adminBillingFleet.eyebrow')}
        title={t('adminBillingFleet.title')}
        description={t('adminBillingFleet.description')}
      />
      {error ? <p className="text-sm text-rose-600">{String(error?.message || error)}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label={t('adminBillingFleet.mrr')} value={`${fmtVND(overview?.mrr, localeTag)}đ`} detail={t('adminBillingFleet.arrDetail', { v: fmtVND(overview?.arr, localeTag) })} />
        <AdminMetricCard label={t('adminBillingFleet.trials')} value={String(overview?.trials_active ?? '—')} />
        <AdminMetricCard label={t('adminBillingFleet.failed')} value={String(overview?.invoices_failed_30d ?? '—')} />
        <AdminMetricCard label={t('adminBillingFleet.plans')} value={String((overview?.plan_mix || []).length)} detail={(overview?.plan_mix || []).map((p: any) => `${p.plan}:${p.count}`).join(' · ')} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">{t('adminBillingFleet.revenueTitle')}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
          {(overview?.revenue_6m || []).map((r: any) => (
            <div key={r.month} className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-950/60">
              <p className="text-[11px] text-slate-500">{r.month}</p>
              <p className="text-sm font-semibold">{fmtVND(r.total, localeTag)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950">
            <option value="">{t('adminBillingFleet.filterAll')}</option>
            {['paid', 'past_due', 'open', 'draft', 'void', 'uncollectible'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950">
            <option value="">{t('adminBillingFleet.filterPlanAll')}</option>
            {['free', 'starter', 'pro', 'enterprise', 'custom', 'internal'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('adminBillingFleet.searchPh')} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <button type="button" onClick={() => setPage(1)} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{t('adminBillingFleet.apply')}</button>
          <button type="button" disabled={exporting} onClick={doExport} className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40">{t('adminBillingFleet.export')}</button>
        </div>
        {invoices.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead><tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="px-3 py-2">{t('adminBillingFleet.thInvoice')}</th>
              <th className="px-3 py-2">{t('adminBillingFleet.thTenant')}</th>
              <th className="px-3 py-2">{t('adminBillingFleet.thAmount')}</th>
              <th className="px-3 py-2">{t('adminBillingFleet.thStatus')}</th>
              <th className="px-3 py-2">{t('adminBillingFleet.thPaid')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-3 py-2"><Link className="text-blue-600 hover:underline" to={`/admin/tenants/${inv.tenant_id}/billing`}>{inv.tenant_name || inv.tenant_code}</Link></td>
                  <td className="px-3 py-2">{fmtVND(inv.amount_due, localeTag)} {inv.currency}</td>
                  <td className="px-3 py-2">{inv.status}</td>
                  <td className="px-3 py-2">{inv.paid_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdminEmptyState>{loading ? t('adminBillingFleet.loading') : t('adminBillingFleet.empty')}</AdminEmptyState>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button type="button" disabled={!hasPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40">‹</button>
          <span className="text-xs text-slate-500">{t('adminBillingFleet.pageOf', { page, pages: totalPages, total: count })}</span>
          <button type="button" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)} className="rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40">›</button>
        </div>
      </div>
    </div>
  );
}
