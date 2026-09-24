import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';

function toneClasses(status: any) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'healthy' || normalized === 'normal') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'warning' || normalized === 'pending_approval') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'critical' || normalized === 'suspended' || normalized === 'disabled') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function Panel({ title, description, actions, children }: { title: string; description?: string | null; actions?: React.ReactNode; children: React.ReactNode }) {
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

function MetricCard({ card }: { card: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
          {card.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p> : null}
        </div>
        {card.status ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(card.status)}`}>
            {card.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ValueRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export function AdminCoreServiceAccountsPage() {
  const { t } = useI18n();
  const { tenantId } = useParams<{ tenantId: string }>();
  // R6: read-only ở phase này — không hardcode quyền (BE chưa có endpoint write).
  const canCreate = false;
  const canUpdate = false;
  const tenantIdStr = tenantId || '';
  const [tenantDetail, setTenantDetail] = useState<any>(null);
  const [summaryCards, setSummaryCards] = useState<any[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<any[]>([]);
  const [selectedServiceAccountId, setSelectedServiceAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersDraft, setFiltersDraft] = useState({
    search: '',
    status: '',
    environment: '',
    rotationRisk: '',
    policyId: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    environment: '',
    rotationRisk: '',
    policyId: '',
  });
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      setActionNote('');
      try {
        const [tenantResponse, serviceAccountResponse] = await Promise.all([
          (coreApiAdapter as unknown as { getCoreOperatorTenantDetail: (id: string) => Promise<any> }).getCoreOperatorTenantDetail(tenantIdStr),
          (coreApiAdapter as unknown as { getCoreOperatorTenantServiceAccounts: (id: string, params?: any) => Promise<any> }).getCoreOperatorTenantServiceAccounts(tenantIdStr, {
            search: filters.search || undefined,
            status: filters.status || undefined,
            environment: filters.environment || undefined,
            rotation_risk: filters.rotationRisk || undefined,
            policy_id: filters.policyId || undefined,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setTenantDetail(tenantResponse.data || null);
        const nextServiceAccounts = Array.isArray(serviceAccountResponse?.data) ? serviceAccountResponse.data : [];
        setSummaryCards(Array.isArray(serviceAccountResponse?.summary_cards) ? serviceAccountResponse.summary_cards : []);
        setServiceAccounts(nextServiceAccounts);
        setSelectedServiceAccountId((current) => {
          if (current && nextServiceAccounts.some((item: any) => item.id === current)) {
            return current;
          }
          return nextServiceAccounts[0]?.id || '';
        });
      } catch (nextError: any) {
        if (!cancelled) {
      setError(nextError?.response?.status === 404
        ? t('adminCoreTenants.errorNotFound')
        : t('adminCoreTenants.saTitle'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [filters, refreshTick, tenantId, tenantIdStr, t]);

  const selectedServiceAccount = serviceAccounts.find((item: any) => item.id === selectedServiceAccountId) || null;
  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const securitySummary = tenantDetail?.security_summary || null;
  const listLabel = tenantSummary?.display_name || tenantSummary?.tenant_code || tenantId;

  const submitFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...filtersDraft });
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      environment: '',
      rotationRisk: '',
      policyId: '',
    };
    setFiltersDraft(clearedFilters);
    setFilters(clearedFilters);
  };

  const refresh = () => {
    setRefreshTick((current) => current + 1);
  };

  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn thêm.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCoreTenants.saTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreTenants.saDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.saBackToTenant')}
            </Link>
            <Link
              to="/admin/tenants"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.saBackToRegistry')}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.refresh')}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {actionNote ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
          {actionNote}
        </div>
      ) : null}

      <Panel
        title={t('adminCoreTenants.saTenantInfo')}
        description={t('adminCoreTenants.saTenantDescription')}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? t('adminCoreTenants.loading') : listLabel}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard card={{ label: 'Tenant', value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <MetricCard card={{ label: 'Plan', value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <MetricCard card={{ label: 'Status', value: tenantSummary.status || '—', status: tenantSummary.status }} />
            <MetricCard card={{ label: 'Security', value: securitySummary?.anomaly_state || '—', status: securitySummary?.anomaly_state }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.saTenantInfo')}
          </p>
        )}
      </Panel>

      <form
        onSubmit={submitFilters}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3"
      >
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreTenants.saFilterSearch')}</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder={t('adminCoreTenants.saFilterSearchPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.saFilterStatus')}</span>
          <select
            value={filtersDraft.status}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="active">{t('adminCoreTenants.filterActive')}</option>
            <option value="pending_approval">Pending approval</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.saFilterEnvironment')}</span>
          <select
            value={filtersDraft.environment}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, environment: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="prod">prod</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.saFilterRotationRisk')}</span>
          <select
            value={filtersDraft.rotationRisk}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, rotationRisk: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="normal">normal</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreTenants.saFilterPolicyId')}</span>
          <input
            value={filtersDraft.policyId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, policyId: event.target.value }))}
            placeholder={t('adminCoreTenants.saFilterPolicyPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
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
          <button
            type="button"
            disabled={!canCreate}
            title={t('adminCoreTenants.saCreateNote')}
            onClick={() => setActionNote(t('adminCoreTenants.saCreateNote'))}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-emerald-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCoreTenants.saCreate')}
          </button>
        </div>
      </form>

      <Panel
        title={t('adminCoreTenants.saSummaryTitle')}
        description={t('adminCoreTenants.saSummaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.noSummaryData')}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={t('adminCoreTenants.saRegistryTitle')}
          description={t('adminCoreTenants.saRegistryDescription')}
          actions={loading ? <span className="text-xs text-slate-500 dark:text-slate-400">{t('adminCoreTenants.loading')}</span> : null}
        >
          {serviceAccounts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaName')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaEnvironment')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaStatus')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaPat')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaRotation')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thSaUpdated')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {serviceAccounts.map((serviceAccount: any) => {
                    const isSelected = serviceAccount.id === selectedServiceAccountId;
                    return (
                      <tr key={serviceAccount.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950 dark:text-white">{serviceAccount.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{serviceAccount.id}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {Array.isArray(serviceAccount.policy_ids) && serviceAccount.policy_ids.length > 0 ? serviceAccount.policy_ids.join(', ') : t('adminCoreTenants.saPolicyBundle')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{serviceAccount.environment}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(serviceAccount.status)}`}>
                            {serviceAccount.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {serviceAccount.active_pat_count}/{serviceAccount.pat_count}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(serviceAccount.rotation_risk)}`}>
                            {serviceAccount.rotation_risk}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {serviceAccount.updated_at || '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedServiceAccountId(serviceAccount.id)}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {t('adminCoreTenants.columnViewDetail')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.saNoItems')}
            </div>
          )}
        </Panel>

        <Panel
          title={t('adminCoreTenants.saDetailTitle')}
          description={t('adminCoreTenants.saDetailDescription')}
          actions={(
            <button
              type="button"
              disabled={!canUpdate || !selectedServiceAccount}
              title={t('adminCoreTenants.saEditNote')}
              onClick={() => setActionNote(t('adminCoreTenants.saEditNote'))}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-amber-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
            >
              {t('adminCoreTenants.saEdit')}
            </button>
          )}
        >
          {selectedServiceAccount ? (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedServiceAccount.id}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.saEnvironment')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.environment}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.saStatus')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.status}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.saPatActive')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.active_pat_count} / {selectedServiceAccount.pat_count}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.saRotationRisk')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.rotation_risk}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.saProperties')}</h3>
                <ValueRow label={t('adminCoreTenants.saPolicyBundle')} value={Array.isArray(selectedServiceAccount.policy_ids) && selectedServiceAccount.policy_ids.length > 0 ? selectedServiceAccount.policy_ids.join(', ') : '—'} />
                <ValueRow label={t('adminCoreTenants.saLatestPatUsed')} value={selectedServiceAccount.latest_pat_last_used_at || '—'} />
                <ValueRow label={t('adminCoreTenants.saLastOperatorAction')} value={selectedServiceAccount.last_operator_action_at || '—'} />
                <ValueRow label={t('adminCoreTenants.saCreatedAt')} value={selectedServiceAccount.created_at || '—'} />
                <ValueRow label={t('adminCoreTenants.saUpdatedAt')} value={selectedServiceAccount.updated_at || '—'} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('adminCoreTenants.saReadFirstNote')}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.saNoDetail')}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
