import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

export function AdminCorePATsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  // R6: read-only ở phase này — không hardcode quyền (BE chưa có endpoint write).
  const canIssue = false;
  const canRotate = false;
  const canRevoke = false;
  const tenantIdStr = tenantId || '';
  const [tenantDetail, setTenantDetail] = useState<any>(null);
  const [serviceAccounts, setServiceAccounts] = useState<any[]>([]);
  const [summaryCards, setSummaryCards] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [actionNote, setActionNote] = useState('');
  const [filtersDraft, setFiltersDraft] = useState({
    search: '',
    status: '',
    serviceAccountId: '',
    anomalyState: '',
    expiresWithinDays: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    serviceAccountId: '',
    anomalyState: '',
    expiresWithinDays: '',
  });
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      setActionNote('');
      try {
        const [tenantResponse, serviceAccountResponse, patResponse] = await Promise.all([
          (coreApiAdapter as unknown as { getCoreOperatorTenantDetail: (id: string) => Promise<any> }).getCoreOperatorTenantDetail(tenantIdStr),
          (coreApiAdapter as unknown as { getCoreOperatorTenantServiceAccounts: (id: string) => Promise<any> }).getCoreOperatorTenantServiceAccounts(tenantIdStr),
          (coreApiAdapter as unknown as { getCoreOperatorTenantPATs: (id: string, params: any) => Promise<any> }).getCoreOperatorTenantPATs(tenantIdStr, {
            search: filters.search || undefined,
            status: filters.status || undefined,
            service_account_id: filters.serviceAccountId || undefined,
            anomaly_state: filters.anomalyState || undefined,
            expires_within_days: filters.expiresWithinDays || undefined,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setTenantDetail(tenantResponse.data || null);
        const nextServiceAccounts = Array.isArray(serviceAccountResponse?.data) ? serviceAccountResponse.data : [];
        const nextTokens = Array.isArray(patResponse?.data) ? patResponse.data : [];
        setServiceAccounts(nextServiceAccounts);
        setSummaryCards(Array.isArray(patResponse?.summary_cards) ? patResponse.summary_cards : []);
        setTokens(nextTokens);
        setSelectedTokenId((current) => {
          if (current && nextTokens.some((item: any) => item.id === current)) {
            return current;
          }
          return nextTokens[0]?.id || '';
        });
      } catch (nextError: any) {
        if (!cancelled) {
          setError(nextError?.response?.status === 404
            ? 'Không tìm thấy tenant operator cần xem PAT.'
            : 'Không tải được sổ đăng ký PAT của tenant operator.');
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
  }, [filters, refreshTick, tenantId, tenantIdStr]);

  const selectedToken = tokens.find((item: any) => item.id === selectedTokenId) || null;
  const serviceAccountMap = new Map(serviceAccounts.map((item: any) => [item.id, item]));
  const selectedServiceAccount = selectedToken ? serviceAccountMap.get(selectedToken.service_account_id) || null : null;
  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const securitySummary = tenantDetail?.security_summary || null;
  const headerTenantLabel = tenantSummary?.display_name || tenantSummary?.tenant_code || tenantId;

  const submitFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({ ...filtersDraft });
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      serviceAccountId: '',
      anomalyState: '',
      expiresWithinDays: '',
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
                {t('adminCoreTenants.patTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreTenants.patDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.patBackToTenant')}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/service-accounts`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.patBackToServiceAccounts')}
            </Link>
            <Link
              to="/admin/tenants"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreTenants.patBackToRegistry')}
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

      <AdminPanel
        title={t('adminCoreTenants.patTenantInfo')}
        description={t('adminCoreTenants.patTenantDescription')}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? 'Đang đồng bộ…' : headerTenantLabel}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard card={{ label: 'Tenant', value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <AdminMetricCard card={{ label: 'Plan', value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <AdminMetricCard card={{ label: 'Trạng thái', value: tenantSummary.status || '—', status: tenantSummary.status }} />
            <AdminMetricCard card={{ label: 'Bảo mật', value: securitySummary?.anomaly_state || '—', status: securitySummary?.anomaly_state }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </AdminPanel>

      <form
        onSubmit={submitFilters}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3"
      >
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreTenants.patFilterSearch')}</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder={t('adminCoreTenants.patFilterSearchPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.patFilterStatus')}</span>
          <select
            value={filtersDraft.status}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="active">active</option>
            <option value="rotating">rotating</option>
            <option value="revoked">revoked</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.patFilterServiceAccount')}</span>
          <select
            value={filtersDraft.serviceAccountId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, serviceAccountId: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            {serviceAccounts.map((serviceAccount: any) => (
              <option key={serviceAccount.id} value={serviceAccount.id}>
                {serviceAccount.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.patFilterAnomaly')}</span>
          <select
            value={filtersDraft.anomalyState}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, anomalyState: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreTenants.filterAll')}</option>
            <option value="normal">normal</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreTenants.patFilterExpiresWithin')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={filtersDraft.expiresWithinDays}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, expiresWithinDays: event.target.value }))}
            placeholder="30"
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
            disabled={!canIssue}
            title={t('adminCoreTenants.patIssueNote')}
            onClick={() => setActionNote(t('adminCoreTenants.patIssueNote'))}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-emerald-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCoreTenants.patIssue')}
          </button>
          <button
            type="button"
            disabled={!canRotate || !selectedToken}
            title={t('adminCoreTenants.patRotateNote')}
            onClick={() => setActionNote(t('adminCoreTenants.patRotateNote'))}
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-cyan-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCoreTenants.patRotate')}
          </button>
          <button
            type="button"
            disabled={!canRevoke || !selectedToken}
            title={t('adminCoreTenants.patRevokeNote')}
            onClick={() => setActionNote(t('adminCoreTenants.patRevokeNote'))}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-rose-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCoreTenants.patRevoke')}
          </button>
        </div>
      </form>

      <AdminPanel
        title={t('adminCoreTenants.patSummaryTitle')}
        description={t('adminCoreTenants.patSummaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.noSummaryData')}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title={t('adminCoreTenants.patRegistryTitle')}
          description={t('adminCoreTenants.patRegistryDescription')}
          actions={loading ? <span className="text-xs text-slate-500 dark:text-slate-400">{t('adminCoreTenants.loading')}</span> : null}
        >
          {tokens.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatName')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatServiceAccount')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatStatus')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatExpires')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatAnomaly')}</th>
                    <th className="px-4 py-3">{t('adminCoreTenants.thPatLastUsed')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {tokens.map((token: any) => {
                    const isSelected = token.id === selectedTokenId;
                    const serviceAccount = serviceAccountMap.get(token.service_account_id);
                    return (
                      <tr key={token.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-950 dark:text-white">{token.token_prefix}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{token.id}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {Array.isArray(token.scope_codes) && token.scope_codes.length > 0 ? token.scope_codes.join(', ') : 'Không có scope'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {serviceAccount?.name || token.service_account_id}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(token.status)}`}>
                            {token.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {token.expires_at || '—'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(token.anomaly_state)}`}>
                            {token.anomaly_state}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {token.last_used_at || '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTokenId(token.id)}
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
              {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.patNoItems')}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreTenants.patDetailTitle')}
          description={t('adminCoreTenants.patDetailDescription')}
          actions={(
            <button
              type="button"
              disabled={!canRotate || !selectedToken}
              onClick={() => setActionNote(t('adminCoreTenants.patRotateNote'))}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-cyan-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
            >
              {t('adminCoreTenants.patRotate')}
            </button>
          )}
        >
          {selectedToken ? (
            <div className="space-y-5">
              <div>
                <p className="font-mono text-lg font-semibold text-slate-950 dark:text-white">{selectedToken.token_prefix}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedToken.id}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedServiceAccount?.name || selectedToken.service_account_id}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.patStatus')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.status}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.patAnomaly')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.anomaly_state}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.patExpiry')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.expires_at || '—'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.patGracePeriod')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.grace_period_active ? t('adminCoreTenants.patActive') : t('adminCoreTenants.patInactive')}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreTenants.patProperties')}</h3>
                <AdminValueRow label={t('adminCoreTenants.patServiceAccount')} value={selectedServiceAccount?.name || selectedToken.service_account_id} />
                <AdminValueRow label={t('adminCoreTenants.patServiceAccountCode')} value={selectedToken.service_account_id} />
                <AdminValueRow label={t('adminCoreTenants.patScopeBundle')} value={Array.isArray(selectedToken.scope_codes) && selectedToken.scope_codes.length > 0 ? selectedToken.scope_codes.join(', ') : '—'} />
                <AdminValueRow label={t('adminCoreTenants.patIssuerType')} value={selectedToken.issuer_actor_type || '—'} />
                <AdminValueRow label={t('adminCoreTenants.patIssuerId')} value={selectedToken.issuer_actor_id || '—'} />
                <AdminValueRow label={t('adminCoreTenants.patLastUsed')} value={selectedToken.last_used_at || '—'} />
                <AdminValueRow label={t('adminCoreTenants.patLastIp')} value={selectedToken.last_ip || '—'} />
                <AdminValueRow label={t('adminCoreTenants.patLastIpCountry')} value={selectedToken.last_used_ip_country || '—'} />
                <AdminValueRow label={t('adminCoreTenants.patLastAuditRequest')} value={selectedToken.last_audit_request_id || '—'} />
                <AdminValueRow label="Revoked at" value={selectedToken.revoked_at || '—'} />
                <AdminValueRow label="Created at" value={selectedToken.created_at || '—'} />
                <AdminValueRow label="Updated at" value={selectedToken.updated_at || '—'} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('adminCoreTenants.patReadFirstNote')}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? t('adminCoreTenants.loading') : t('adminCoreTenants.patNoDetail')}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
