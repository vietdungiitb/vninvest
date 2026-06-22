import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';

function toneClasses(status: any) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'healthy' || normalized === 'normal') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'warning') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'critical' || normalized === 'suspended' || normalized === 'manual') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function Panel({ title, description, children }: { title: string; description?: string | null; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
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

export function AdminCoreTenantsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
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

  const loadRegistry = useCallback(async () => {
    setLoadingRegistry(true);
    setError(null);
    try {
      const response = await (coreApiAdapter as unknown as { getCoreOperatorTenants: (params: any) => Promise<any> }).getCoreOperatorTenants({
        search: search || undefined,
        status: status || undefined,
      });
      setRegistry(response.data || null);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? 'Không đủ quyền để xem danh sách tenant.'
        : 'Không tải được danh sách tenant.');
    } finally {
      setLoadingRegistry(false);
    }
  }, [search, status]);

  const loadDetail = useCallback(async () => {
    if (!tenantId) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    try {
      const response = await (coreApiAdapter as unknown as { getCoreOperatorTenantDetail: (id: string) => Promise<any> }).getCoreOperatorTenantDetail(tenantId);
      setDetail(response.data || null);
    } catch (err: any) {
      setError(err?.response?.status === 404
        ? 'Không tìm thấy tenant cần xem chi tiết.'
        : 'Không tải được chi tiết tenant.');
    } finally {
      setLoadingDetail(false);
    }
  }, [tenantId]);

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
    ? lastFetched.toLocaleString()
    : null;

  const submitFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setStatus(statusDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft('');
    setStatusDraft('');
    setSearch('');
    setStatus('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {'Danh sách tenant'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {'Tra cứu tenant, xem trạng thái vận hành và mở chi tiết thương mại/bảo mật từ một chụp nhanh duy nhất.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/core/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Quay lại tổng quan'}
            </Link>
            <button
              type="button"
              onClick={loadRegistry}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loadingRegistry || loadingDetail}
            >
              {loadingRegistry || loadingDetail ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        </div>
      </section>

      {lastFetchedLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {`Đã chụp lúc ${lastFetchedLabel}`}
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
          <span>{'Tìm tenant'}</span>
          <input
            value={searchDraft}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchDraft(event.target.value)}
            placeholder="Mã tenant, tên hiển thị, email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{'Trạng thái'}</span>
          <select
            value={statusDraft}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setStatusDraft(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{'Tất cả'}</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
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
        </div>
      </form>

      <Panel
        title={'Tổng hợp tenant'}
        description={'Các chỉ số từ registry hiện tại và trạng thái điều hành.'}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {'Chưa có dữ liệu tổng hợp tenant.'}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Panel
          title={'Registry'}
          description={'Bảng tenant đang chạy thật trong current-code operator wrapper.'}
        >
          {tenants.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Updated</th>
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
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(tenantRow.status)}`}>
                            {tenantRow.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(tenantRow.current_usage_risk)}`}>
                            {tenantRow.current_usage_risk}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {tenantRow.updated_at || '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/admin/core/tenants/${tenantRow.id}`}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {'Xem chi tiết'}
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
              {loadingRegistry ? 'Đang tải danh sách tenant…' : 'Không có tenant phù hợp bộ lọc.'}
            </p>
          )}
        </Panel>

        <Panel
          title={'Chi tiết tenant'}
          description={'Tổng hợp thương mại, bảo mật và hành động gần nhất cho tenant đang chọn.'}
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
                      to={`/admin/core/tenants/${selectedTenant.id}/service-accounts`}
                      className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-200"
                    >
                      {'Xem service accounts'}
                    </Link>
                    <Link
                      to={`/admin/core/tenants/${selectedTenant.id}/pats`}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/15 dark:text-cyan-200"
                    >
                      {'Xem PATs'}
                    </Link>
                    <Link
                      to={`/admin/core/tenants/${selectedTenant.id}/usage`}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-200"
                    >
                      {'Xem usage'}
                    </Link>
                    <Link
                      to={`/admin/core/tenants/${selectedTenant.id}/billing`}
                      className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-200"
                    >
                      {'Xem billing'}
                    </Link>
                  </div>
                </div>
                <ValueRow label="Status" value={selectedTenant.status} />
                <ValueRow label="Plan" value={selectedTenant.plan_code} />
                <ValueRow label="Suspension" value={selectedTenant.suspension_state} />
                <ValueRow label="Usage risk" value={selectedTenant.current_usage_risk} />
                <ValueRow label="Invoice state" value={selectedTenant.invoice_state} />

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Thông tin thương mại</h3>
                  <ValueRow label="Billing cycle" value={selectedCommercial?.billing_cycle || '—'} />
                  <ValueRow label="Next invoice" value={selectedCommercial?.next_invoice_date || '—'} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Thông tin bảo mật</h3>
                  <ValueRow label="Service accounts" value={String(selectedSecurity?.service_account_count ?? '—')} />
                  <ValueRow label="Active PATs" value={String(selectedSecurity?.active_pat_count ?? '—')} />
                  <ValueRow label="Rotations due" value={String(selectedSecurity?.rotations_due_count ?? '—')} />
                  <ValueRow label="Anomaly state" value={selectedSecurity?.anomaly_state || '—'} />
                  <ValueRow label="Latest PAT use" value={selectedSecurity?.latest_pat_last_used_at || '—'} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Hành động gần nhất</h3>
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có hành động gần nhất.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {loadingDetail ? 'Đang tải chi tiết tenant…' : 'Không tải được chi tiết tenant.'}
              </p>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Chọn một tenant trong bảng bên trái để mở chi tiết thương mại, bảo mật và dòng hành động gần nhất.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
