import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCoreOperatorTenantDetail, getCoreOperatorTenantPATs, getCoreOperatorTenantServiceAccounts } from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

function toneClasses(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'healthy' || normalized === 'normal') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'warning' || normalized === 'rotating') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'critical' || normalized === 'revoked' || normalized === 'suspended' || normalized === 'disabled') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function Panel({ title, description, actions, children }) {
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

function MetricCard({ card }) {
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

function ValueRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function formatDateTime(value, formatDateTimeFn) {
  if (!value) {
    return '—';
  }

  return formatDateTimeFn(value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AdminCorePATs() {
  const { tenantId } = useParams();
  const { t, formatDateTime: formatI18nDateTime } = useI18n();
  const { ability } = usePortfolio();
  const canIssue = ability.can('issue', 'CorePATAdmin');
  const canRotate = ability.can('rotate', 'CorePATAdmin');
  const canRevoke = ability.can('revoke', 'CorePATAdmin');
  const [tenantDetail, setTenantDetail] = useState(null);
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [summaryCards, setSummaryCards] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      setActionNote('');
      try {
        const [tenantResponse, serviceAccountResponse, patResponse] = await Promise.all([
          getCoreOperatorTenantDetail(tenantId),
          getCoreOperatorTenantServiceAccounts(tenantId),
          getCoreOperatorTenantPATs(tenantId, {
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
        const nextServiceAccounts = Array.isArray(serviceAccountResponse.data?.data) ? serviceAccountResponse.data.data : [];
        const nextTokens = Array.isArray(patResponse.data?.data) ? patResponse.data.data : [];
        setServiceAccounts(nextServiceAccounts);
        setSummaryCards(Array.isArray(patResponse.data?.summary_cards) ? patResponse.data.summary_cards : []);
        setTokens(nextTokens);
        setSelectedTokenId((current) => {
          if (current && nextTokens.some((item) => item.id === current)) {
            return current;
          }
          return nextTokens[0]?.id || '';
        });
      } catch (nextError) {
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
  }, [filters, refreshTick, tenantId]);

  const selectedToken = tokens.find((item) => item.id === selectedTokenId) || null;
  const serviceAccountMap = new Map(serviceAccounts.map((item) => [item.id, item]));
  const selectedServiceAccount = selectedToken ? serviceAccountMap.get(selectedToken.service_account_id) || null : null;
  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const securitySummary = tenantDetail?.security_summary || null;
  const headerTenantLabel = tenantSummary?.display_name || tenantSummary?.tenant_code || tenantId;

  const submitFilters = (event) => {
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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCorePats.title', { defaultValue: 'PAT credentials theo tenant' })}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCorePats.description', {
                  defaultValue: 'Xem sổ đăng ký PAT, mức độ rủi ro và hành động gần nhất của tenant operator theo dữ liệu read-first.',
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/core/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCorePats.backToTenant', { defaultValue: 'Quay lại tenant' })}
            </Link>
            <Link
              to={`/admin/core/tenants/${tenantId}/service-accounts`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCorePats.backToServiceAccounts', { defaultValue: 'Quay lại service accounts' })}
            </Link>
            <Link
              to="/admin/core/tenants"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCorePats.backToRegistry', { defaultValue: 'Quay lại registry' })}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Đang tải…' : t('adminCorePats.refresh', { defaultValue: 'Làm mới' })}
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
        title={t('adminCorePats.tenantTitle', { defaultValue: 'Thông tin tenant' })}
        description={t('adminCorePats.tenantDescription', { defaultValue: 'Bối cảnh tenant operator đang được điều tra cho sổ PAT.' })}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? 'Đang đồng bộ…' : headerTenantLabel}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard card={{ label: 'Tenant', value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <MetricCard card={{ label: 'Plan', value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <MetricCard card={{ label: 'Trạng thái', value: tenantSummary.status || '—', status: tenantSummary.status }} />
            <MetricCard card={{ label: 'Bảo mật', value: securitySummary?.anomaly_state || '—', status: securitySummary?.anomaly_state }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </Panel>

      <form
        onSubmit={submitFilters}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3"
      >
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCorePats.searchLabel', { defaultValue: 'Tìm PAT' })}</span>
          <input
            value={filtersDraft.search}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="Token prefix, PAT ID, scope"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCorePats.statusLabel', { defaultValue: 'Trạng thái' })}</span>
          <select
            value={filtersDraft.status}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCorePats.allStatus', { defaultValue: 'Tất cả' })}</option>
            <option value="active">active</option>
            <option value="rotating">rotating</option>
            <option value="revoked">revoked</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCorePats.serviceAccountLabel', { defaultValue: 'Service account' })}</span>
          <select
            value={filtersDraft.serviceAccountId}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, serviceAccountId: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCorePats.allServiceAccounts', { defaultValue: 'Tất cả' })}</option>
            {serviceAccounts.map((serviceAccount) => (
              <option key={serviceAccount.id} value={serviceAccount.id}>
                {serviceAccount.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCorePats.anomalyLabel', { defaultValue: 'Anomaly' })}</span>
          <select
            value={filtersDraft.anomalyState}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, anomalyState: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCorePats.allAnomaly', { defaultValue: 'Tất cả' })}</option>
            <option value="normal">normal</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCorePats.expiresLabel', { defaultValue: 'Sắp hết hạn trong (ngày)' })}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={filtersDraft.expiresWithinDays}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, expiresWithinDays: event.target.value }))}
            placeholder="30"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {t('adminCorePats.applyFilters', { defaultValue: 'Áp dụng bộ lọc' })}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('adminCorePats.clearFilters', { defaultValue: 'Xóa bộ lọc' })}
          </button>
          <button
            type="button"
            disabled={!canIssue}
            onClick={() => setActionNote(t('adminCorePats.issueDisabledNotice', { defaultValue: 'Cấp PAT sẽ được nối ở slice viết sau; màn hình này chỉ giữ read-first và gating hiện tại.' }))}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-emerald-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCorePats.issueAction', { defaultValue: 'Cấp PAT' })}
          </button>
          <button
            type="button"
            disabled={!canRotate || !selectedToken}
            onClick={() => setActionNote(t('adminCorePats.rotateDisabledNotice', { defaultValue: 'Xoay PAT sẽ được nối ở slice viết sau; hiện tại màn hình này chỉ giữ read-first và gating.' }))}
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-cyan-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCorePats.rotateAction', { defaultValue: 'Xoay PAT đã chọn' })}
          </button>
          <button
            type="button"
            disabled={!canRevoke || !selectedToken}
            onClick={() => setActionNote(t('adminCorePats.revokeDisabledNotice', { defaultValue: 'Thu hồi PAT sẽ được nối ở slice viết sau; hiện tại màn hình này chỉ giữ read-first và gating.' }))}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-rose-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {t('adminCorePats.revokeAction', { defaultValue: 'Thu hồi PAT đã chọn' })}
          </button>
        </div>
      </form>

      <Panel
        title={t('adminCorePats.summaryTitle', { defaultValue: 'Tổng hợp PAT' })}
        description={t('adminCorePats.summaryDescription', { defaultValue: 'Chỉ số từ current-code operator wrapper theo bộ lọc đang áp dụng.' })}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải summary…' : 'Chưa có dữ liệu summary.'}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={t('adminCorePats.listTitle', { defaultValue: 'Sổ đăng ký PAT' })}
          description={t('adminCorePats.listDescription', { defaultValue: 'Dữ liệu read projection từ operator wrapper cho tenant đang chọn.' })}
          actions={loading ? <span className="text-xs text-slate-500 dark:text-slate-400">Đang tải…</span> : null}
        >
          {tokens.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">PAT</th>
                    <th className="px-4 py-3">Service account</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Hết hạn</th>
                    <th className="px-4 py-3">Anomaly</th>
                    <th className="px-4 py-3">Lần dùng gần nhất</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {tokens.map((token) => {
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
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(token.status)}`}>
                            {token.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {formatDateTime(token.expires_at, formatI18nDateTime)}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(token.anomaly_state)}`}>
                            {token.anomaly_state}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {formatDateTime(token.last_used_at, formatI18nDateTime)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTokenId(token.id)}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {t('adminCorePats.viewDetail', { defaultValue: 'Xem chi tiết' })}
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
              {loading ? 'Đang tải sổ PAT…' : 'Không có PAT phù hợp bộ lọc.'}
            </div>
          )}
        </Panel>

        <Panel
          title={t('adminCorePats.detailTitle', { defaultValue: 'Chi tiết PAT' })}
          description={t('adminCorePats.detailDescription', { defaultValue: 'Scopes, issuer, expiry và trạng thái cảnh báo của PAT đang chọn.' })}
          actions={(
            <button
              type="button"
              disabled={!canRotate || !selectedToken}
              onClick={() => setActionNote(t('adminCorePats.rotateDisabledNotice', { defaultValue: 'Xoay PAT sẽ được nối ở slice viết sau; hiện tại màn hình này chỉ giữ read-first và gating.' }))}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-cyan-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
            >
              {t('adminCorePats.rotateAction', { defaultValue: 'Xoay PAT đã chọn' })}
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Trạng thái</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.status}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Anomaly</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.anomaly_state}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Hết hạn</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatDateTime(selectedToken.expires_at, formatI18nDateTime)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Grace period</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedToken.grace_period_active ? 'active' : 'inactive'}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Thuộc tính chính</h3>
                <ValueRow label="Service account" value={selectedServiceAccount?.name || selectedToken.service_account_id} />
                <ValueRow label="Mã service account" value={selectedToken.service_account_id} />
                <ValueRow label="Scope bundle" value={Array.isArray(selectedToken.scope_codes) && selectedToken.scope_codes.length > 0 ? selectedToken.scope_codes.join(', ') : '—'} />
                <ValueRow label="Issuer actor type" value={selectedToken.issuer_actor_type || '—'} />
                <ValueRow label="Issuer actor id" value={selectedToken.issuer_actor_id || '—'} />
                <ValueRow label="Last used" value={formatDateTime(selectedToken.last_used_at, formatI18nDateTime)} />
                <ValueRow label="Last IP" value={selectedToken.last_ip || '—'} />
                <ValueRow label="Last used IP country" value={selectedToken.last_used_ip_country || '—'} />
                <ValueRow label="Last audit request" value={selectedToken.last_audit_request_id || '—'} />
                <ValueRow label="Revoked at" value={formatDateTime(selectedToken.revoked_at, formatI18nDateTime)} />
                <ValueRow label="Created at" value={formatDateTime(selectedToken.created_at, formatI18nDateTime)} />
                <ValueRow label="Updated at" value={formatDateTime(selectedToken.updated_at, formatI18nDateTime)} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('adminCorePats.readFirstNote', {
                  defaultValue: 'Màn hình này giữ read-first cho CA-05. Secret PAT không được hiển thị; issue/rotate/revoke chỉ được gate theo ability và sẽ nối write flow ở slice sau.',
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? 'Đang tải chi tiết PAT…' : 'Chọn một PAT trong bảng bên trái để mở chi tiết.'}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}