import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';

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
  const { tenantId } = useParams<{ tenantId: string }>();
  const ability = { can: (..._args: any[]) => false };
  const canCreate = ability.can('create', 'CoreServiceAccountAdmin');
  const canUpdate = ability.can('update', 'CoreServiceAccountAdmin');
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
        const nextServiceAccounts = Array.isArray(serviceAccountResponse.data?.data) ? serviceAccountResponse.data.data : [];
        setSummaryCards(Array.isArray(serviceAccountResponse.data?.summary_cards) ? serviceAccountResponse.data.summary_cards : []);
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
            ? 'Không tìm thấy tenant operator cần xem service account.'
            : 'Không tải được danh sách service account của tenant operator.');
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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {'Service account theo tenant'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {'Xem registry service account, PAT posture và hành động gần nhất của tenant operator trong một màn hình read-first.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/core/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Quay lại tenant'}
            </Link>
            <Link
              to="/admin/core/tenants"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Quay lại registry'}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
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
        title={'Thông tin tenant'}
        description={'Bối cảnh tenant operator đang được điều tra cho registry service account.'}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? 'Đang đồng bộ…' : listLabel}
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
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </Panel>

      <form
        onSubmit={submitFilters}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3"
      >
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{'Tìm service account'}</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="Tên, ID, policy"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{'Trạng thái'}</span>
          <select
            value={filtersDraft.status}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{'Tất cả'}</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending approval</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{'Môi trường'}</span>
          <select
            value={filtersDraft.environment}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, environment: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{'Tất cả'}</option>
            <option value="prod">prod</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{'Rủi ro xoay vòng'}</span>
          <select
            value={filtersDraft.rotationRisk}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, rotationRisk: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{'Tất cả'}</option>
            <option value="normal">normal</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{'Policy ID'}</span>
          <input
            value={filtersDraft.policyId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, policyId: event.target.value }))}
            placeholder="pol_market_read"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {'Áp dụng bộ lọc'}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {'Xóa bộ lọc'}
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => setActionNote('Tạo mới service account sẽ được mở ở slice viết sau; hiện tại màn hình này chỉ phục vụ đọc và gating.')}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-emerald-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          >
            {'Tạo service account'}
          </button>
        </div>
      </form>

      <Panel
        title={'Tổng hợp registry'}
        description={'Các chỉ số được trả từ current-code operator wrapper.'}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
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
          title={'Registry service account'}
          description={'Dữ liệu read projection từ operator wrapper cho tenant đang chọn.'}
          actions={loading ? <span className="text-xs text-slate-500 dark:text-slate-400">Đang tải…</span> : null}
        >
          {serviceAccounts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Service account</th>
                    <th className="px-4 py-3">Môi trường</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">PAT</th>
                    <th className="px-4 py-3">Xoay vòng</th>
                    <th className="px-4 py-3">Cập nhật</th>
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
                              {Array.isArray(serviceAccount.policy_ids) && serviceAccount.policy_ids.length > 0 ? serviceAccount.policy_ids.join(', ') : 'Không có policy'}
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
                            {'Xem chi tiết'}
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
              {loading ? 'Đang tải registry service account…' : 'Không có service account phù hợp bộ lọc.'}
            </div>
          )}
        </Panel>

        <Panel
          title={'Chi tiết service account'}
          description={'Posture gần nhất, policy bundle và hành động operator trên principal đã chọn.'}
          actions={(
            <button
              type="button"
              disabled={!canUpdate || !selectedServiceAccount}
              onClick={() => setActionNote('Chỉnh sửa service account sẽ được nối ở slice viết sau; hiện tại chỉ có read projection và gating.')}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:text-amber-200 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
            >
              {'Chỉnh sửa service account'}
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Môi trường</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.environment}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Trạng thái</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.status}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">PAT hiện hoạt</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.active_pat_count} / {selectedServiceAccount.pat_count}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rủi ro xoay vòng</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedServiceAccount.rotation_risk}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Thuộc tính chính</h3>
                <ValueRow label="Policy bundle" value={Array.isArray(selectedServiceAccount.policy_ids) && selectedServiceAccount.policy_ids.length > 0 ? selectedServiceAccount.policy_ids.join(', ') : '—'} />
                <ValueRow label="Latest PAT used" value={selectedServiceAccount.latest_pat_last_used_at || '—'} />
                <ValueRow label="Last operator action" value={selectedServiceAccount.last_operator_action_at || '—'} />
                <ValueRow label="Created at" value={selectedServiceAccount.created_at || '—'} />
                <ValueRow label="Updated at" value={selectedServiceAccount.updated_at || '—'} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {'Màn hình này giữ read-first cho CA-04. Nút tạo/chỉnh sửa được gate theo ability và sẽ nối write flow ở slice sau.'}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? 'Đang tải chi tiết service account…' : 'Chọn một service account trong bảng bên trái để mở chi tiết.'}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
