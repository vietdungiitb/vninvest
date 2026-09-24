import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { defaultCoreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

export function AdminCoreTenantsPage() {
  const { t, localeTag } = useI18n();
  const { tenantId } = useParams<{ tenantId: string }>();
  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn + không fetch.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  const [searchDraft, setSearchDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [registry, setRegistry] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<any>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  // R1 pagination (BE StandardPageNumberPagination, default 20/trang).
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  // R1 staff-switch (endpoint R5 /api/soc/staff/switch/).
  const [switchTarget, setSwitchTarget] = useState<any>(null);
  const [switchReason, setSwitchReason] = useState('');
  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchMsg, setSwitchMsg] = useState<any>(null);

  const loadRegistry = useCallback(async () => {
    if (!isStaffGate) return;
    setLoadingRegistry(true);
    setError(null);
    try {
      const response = await (coreApiAdapter as unknown as { getCoreOperatorTenants: (params: any) => Promise<any> }).getCoreOperatorTenants({
        search: search || undefined,
        status: status || undefined,
        page,
      });
      setRegistry(response || null);
      setTotalCount(Number(response?.count || 0));
      setHasNext(Boolean(response?.next));
      setHasPrev(Boolean(response?.previous));
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('adminCoreTenants.errorNoPermission')
        : t('adminCoreTenants.errorGeneric'));
    } finally {
      setLoadingRegistry(false);
    }
  }, [search, status, page, t, isStaffGate]);

  const loadDetail = useCallback(async () => {
    if (!tenantId) {
      setDetail(null);
      return;
    }
    if (!isStaffGate) return;

    setLoadingDetail(true);
    try {
      const response = await (coreApiAdapter as unknown as { getCoreOperatorTenantDetail: (id: string) => Promise<any> }).getCoreOperatorTenantDetail(tenantId);
      setDetail(response.data || null);
    } catch (err: any) {
      setError(err?.response?.status === 404
        ? t('adminCoreTenants.errorNotFound')
        : t('adminCoreTenants.errorDetail'));
    } finally {
      setLoadingDetail(false);
    }
  }, [tenantId, t, isStaffGate]);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const summaryCards = registry?.summary_cards || [];
  const tenants = registry?.data || [];
  const selectedTenant = detail?.tenant || null;
  const selectedCommercial = detail?.commercial_summary || null;
  const selectedSecurity = detail?.security_summary || null;
  const recentActions = detail?.recent_operator_actions || [];
  const lastFetchedLabel = lastFetched
    ? lastFetched.toLocaleString(localeTag)
    : null;

  const submitFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setStatus(statusDraft.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearchDraft('');
    setStatusDraft('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const doSwitch = async () => {
    if (!switchTarget || switchBusy) return;
    const reason = switchReason.trim();
    if (reason.length < 5) {
      setSwitchMsg(t('adminCoreTenants.switchError'));
      return;
    }
    setSwitchBusy(true);
    setSwitchMsg(null);
    try {
      // R5: endpoint staff-switch qua soc adapter (/operator/soc/ prefix).
      const api = defaultCoreApiAdapter as unknown as {
        staffSwitch: (b: any) => Promise<any>;
      };
      const res = await api.staffSwitch({ tenant_id: switchTarget.id, reason });
      try {
        window.sessionStorage.setItem('staff_switch', JSON.stringify({
          token: res?.token || null,
          tenant: res?.tenant || { id: switchTarget.id },
          expires_at: res?.expires_at || null,
        }));
      } catch { /* private mode — token vẫn hiển thị 1 lần */ }
      setSwitchMsg(t('adminCoreTenants.switchSuccess'));
      setSwitchTarget(null);
      setSwitchReason('');
    } catch {
      setSwitchMsg(t('adminCoreTenants.switchError'));
    } finally {
      setSwitchBusy(false);
    }
  };

  // R0: chặn render khi không staff (fetch đã skip ở trên).
  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{t('adminCoreTenants.heroEyebrow')}</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCoreTenants.title')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreTenants.description')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.backToOverview')}
            </Link>
            <button
              type="button"
              onClick={loadRegistry}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loadingRegistry || loadingDetail}
            >
              {loadingRegistry || loadingDetail ? t('adminCoreTenants.loading') : t('adminCoreTenants.refresh')}
            </button>
          </div>
        </div>
      </section>

      {lastFetchedLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('adminCoreTenants.snapshotAt', { time: lastFetchedLabel })}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={submitFilters}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3"
      >
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreTenants.filterTenant')}</span>
          <input
            value={searchDraft}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchDraft(event.target.value)}
            placeholder={t('adminCoreTenants.filterTenantPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.filterStatus')}</span>
          <select
            value={statusDraft}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setStatusDraft(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="active">{t('adminCoreTenants.filterActive')}</option>
            <option value="suspended">{t('adminCoreTenants.filterSuspended')}</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {t('adminCoreTenants.applyFilters')}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('adminCoreTenants.clearFilters')}
          </button>
        </div>
      </form>

      <AdminPanel
        title={t('adminCoreTenants.summaryTitle')}
        description={t('adminCoreTenants.summaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('adminCoreTenants.noSummaryData')}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <AdminPanel
          title={t('adminCoreTenants.registryTitle')}
          description={t('adminCoreTenants.registryDescription')}
        >
          {tenants.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreTenants.thTenant')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPlan')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thStatus')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thRisk')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thUpdated')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {tenants.map((tenantRow: any) => {
                    const isSelected = tenantId && tenantRow.id === tenantId;
                    return (
                      <tr key={tenantRow.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950 dark:text-white">{tenantRow.display_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{tenantRow.tenant_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{tenantRow.plan_code}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(tenantRow.status)}`}>
                            {tenantRow.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(tenantRow.current_usage_risk)}`}>
                            {tenantRow.current_usage_risk}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {tenantRow.updated_at || '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/admin/tenants/${tenantRow.id}`}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {t('adminCoreTenants.columnViewDetail')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loadingRegistry ? t('adminCoreTenants.loading') : t('adminCoreTenants.noTenants')}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={!hasPrev || loadingRegistry}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
            >
              {t('adminCoreTenants.prevPage')}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('adminCoreTenants.pageOf', {
                page,
                pages: Math.max(1, Math.ceil(totalCount / 20)),
                total: totalCount,
              })}
            </span>
            <button
              type="button"
              disabled={!hasNext || loadingRegistry}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
            >
              {t('adminCoreTenants.nextPage')}
            </button>
          </div>
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreTenants.detailTitle')}
          description={t('adminCoreTenants.detailDescription')}
        >
          {tenantId ? (
            selectedTenant ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedTenant.display_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTenant.tenant_code}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/tenants/${selectedTenant.id}/service-accounts`}
                      className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-200"
                    >
                      {t('adminCoreTenants.viewServiceAccounts')}
                    </Link>
                    <Link
                      to={`/admin/tenants/${selectedTenant.id}/pats`}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 dark:text-cyan-200"
                    >
                      {t('adminCoreTenants.viewPATs')}
                    </Link>
                    <Link
                      to={`/admin/tenants/${selectedTenant.id}/usage`}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-200"
                    >
                      {t('adminCoreTenants.viewUsage')}
                    </Link>
                    <Link
                      to={`/admin/tenants/${selectedTenant.id}/billing`}
                      className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-200"
                    >
                      {t('adminCoreTenants.viewBilling')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setSwitchReason(''); setSwitchMsg(null); setSwitchTarget(selectedTenant); }}
                      className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
                    >
                      {t('adminCoreTenants.switchAction')}
                    </button>
                  </div>
                </div>
                <AdminValueRow label={t('adminCoreTenants.detailStatus')} value={selectedTenant.status} />
                <AdminValueRow label={t('adminCoreTenants.detailPlan')} value={selectedTenant.plan_code} />
                <AdminValueRow label={t('adminCoreTenants.detailSuspension')} value={selectedTenant.suspension_state} />
                <AdminValueRow label={t('adminCoreTenants.detailUsageRisk')} value={selectedTenant.current_usage_risk} />
                <AdminValueRow label={t('adminCoreTenants.detailInvoiceState')} value={selectedTenant.invoice_state} />

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.commercialInfo')}</h3>
                  <AdminValueRow label={t('adminCoreTenants.detailBillingCycle')} value={selectedCommercial?.billing_cycle || '—'} />
                  <AdminValueRow label={t('adminCoreTenants.detailNextInvoice')} value={selectedCommercial?.next_invoice_date || '—'} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.securityInfo')}</h3>
                  <AdminValueRow label={t('adminCoreTenants.detailServiceAccounts')} value={String(selectedSecurity?.service_account_count ?? '—')} />
                  <AdminValueRow label={t('adminCoreTenants.detailActivePats')} value={String(selectedSecurity?.active_pat_count ?? '—')} />
                  <AdminValueRow label={t('adminCoreTenants.detailRotationsDue')} value={String(selectedSecurity?.rotations_due_count ?? '—')} />
                  <AdminValueRow label={t('adminCoreTenants.detailAnomalyState')} value={selectedSecurity?.anomaly_state || '—'} />
                  <AdminValueRow label={t('adminCoreTenants.detailLatestPatUse')} value={selectedSecurity?.latest_pat_last_used_at || '—'} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.recentActions')}</h3>
                  {recentActions.length > 0 ? (
                    <div className="space-y-3">
                      {recentActions.map((action: any) => (
                        <div key={`${action.action}-${action.at || action.summary}`} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                          <p className="text-sm font-semibold text-slate-950 dark:text-white">{action.summary}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {action.action}
                            {action.at ? ` • ${action.at}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminCoreTenants.noRecentActions')}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {loadingDetail ? t('adminCoreTenants.loading') : t('adminCoreTenants.noDetailData')}
              </p>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t('adminCoreTenants.noDetail')}
            </div>
          )}
        </AdminPanel>
      </div>
      {switchTarget ? (
        <div className="mt-4 rounded-3xl border border-amber-500/30 bg-white p-5 shadow-sm dark:border-amber-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            {t('adminCoreTenants.switchTitle', { name: switchTarget.display_name || switchTarget.tenant_code || switchTarget.id })}
          </h3>
          <input
            type="text"
            value={switchReason}
            onChange={(e) => setSwitchReason(e.target.value)}
            placeholder={t('adminCoreTenants.switchReasonPh')}
            className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          {switchMsg ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{switchMsg}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={switchBusy}
              onClick={doSwitch}
              className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {t('adminCoreTenants.switchSubmit')}
            </button>
            <button
              type="button"
              onClick={() => { setSwitchTarget(null); setSwitchReason(''); setSwitchMsg(null); }}
              className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold dark:border-slate-700"
            >
              {t('adminCoreTenants.switchCancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
