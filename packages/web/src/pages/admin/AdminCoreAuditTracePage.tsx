import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

const DEFAULT_LIMIT = 25;
const DEFAULT_FILTERS = {
  search: '',
  kind: '',
  action: '',
  actor: '',
  reason: '',
  symbol: '',
  serviceCode: '',
};

function kindLabel(kind: any) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'system_ai_settings') {
    return 'Cấu hình AI';
  }
  if (normalized === 'whale_config') {
    return 'Cấu hình Whale';
  }
  if (normalized === 'advisory') {
    return 'Advisory';
  }
  if (normalized === 'crawl_audit') {
    return 'Crawl';
  }
  return kind || '—';
}

function stringifyValue(value: any) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

export function AdminCoreAuditTracePage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState({ startingAfter: '', endingBefore: '' });
  const [selectedRequestId, setSelectedRequestId] = useState('');

  const loadAuditRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { limit: DEFAULT_LIMIT };
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.kind) {
        params.kind = filters.kind;
      }
      if (filters.action) {
        params.action = filters.action;
      }
      if (filters.actor) {
        params.actor = filters.actor;
      }
      if (filters.reason) {
        params.reason = filters.reason;
      }
      if (filters.symbol) {
        params.symbol = filters.symbol;
      }
      if (filters.serviceCode) {
        params.service_code = filters.serviceCode;
      }
      if (cursor.startingAfter) {
        params.starting_after = cursor.startingAfter;
      }
      if (cursor.endingBefore) {
        params.ending_before = cursor.endingBefore;
      }

      const response = await (coreApiAdapter as unknown as { getCoreOperatorAuditRequests: (params: any) => Promise<any> }).getCoreOperatorAuditRequests(params);
      const nextSnapshot = response.data || null;
      const nextRows = Array.isArray(nextSnapshot?.data) ? nextSnapshot.data : [];

      setSnapshot(nextSnapshot);
      setLastFetched(new Date());
      setSelectedRequestId((current: string) => {
        if (current && nextRows.some((item: any) => item.id === current)) {
          return current;
        }
        return nextRows[0]?.id || '';
      });
      setDetail(null);
    } catch (nextError: any) {
      setError(nextError?.response?.status === 403
        ? 'Không đủ quyền để xem audit trace operator.'
        : 'Không tải được audit trace operator.');
    } finally {
      setLoading(false);
    }
  }, [cursor.endingBefore, cursor.startingAfter, filters.action, filters.actor, filters.kind, filters.reason, filters.search, filters.serviceCode, filters.symbol]);

  useEffect(() => {
    loadAuditRequests();
  }, [loadAuditRequests, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedRequestId) {
        setDetail(null);
        setDetailError(null);
        return;
      }

      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await (coreApiAdapter as unknown as { getCoreOperatorAuditRequestDetail: (id: string) => Promise<any> }).getCoreOperatorAuditRequestDetail(selectedRequestId);
        if (!cancelled) {
          setDetail(response.data || null);
        }
      } catch (nextError: any) {
        if (!cancelled) {
          setDetailError(nextError?.response?.status === 404
            ? 'Không tìm thấy audit trace đã chọn.'
            : 'Không tải được chi tiết audit trace.');
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedRequestId, refreshTick]);

  const summaryCards = Array.isArray(snapshot?.summary_cards) ? snapshot.summary_cards : [];
  const rows = Array.isArray(snapshot?.data) ? snapshot.data : [];
  const selectedRequest = detail?.request || rows.find((item: any) => item.id === selectedRequestId) || rows[0] || null;
  const sourceRecord = detail?.source_record || null;
  const hasMore = Boolean(snapshot?.has_more);
  const nextCursor = snapshot?.next_cursor || '';
  const prevCursor = snapshot?.prev_cursor || '';
  const lastFetchedLabel = lastFetched
    ? lastFetched.toLocaleString()
    : null;

  const submitFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setCursor({ startingAfter: '', endingBefore: '' });
    setFilters({ ...filtersDraft });
  };

  const clearFilters = () => {
    setFiltersDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setCursor({ startingAfter: '', endingBefore: '' });
  };

  const refresh = () => {
    setRefreshTick((current) => current + 1);
  };

  const openNextPage = () => {
    if (!nextCursor) {
      return;
    }
    setCursor({ startingAfter: nextCursor, endingBefore: '' });
  };

  const openPrevPage = () => {
    if (!prevCursor) {
      return;
    }
    setCursor({ startingAfter: '', endingBefore: prevCursor });
  };

  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn thêm.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  if (!isStaffGate) {
    return (<p>Không đủ quyền truy cập.</p>);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Truy vết audit
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Xem các audit log current-code operator theo chụp nhanh hiện tại, có panel chi tiết và source record cho từng bản ghi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Quay lại tổng quan
            </Link>
            <Link
              to="/admin/jobs"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Mở jobs
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || detailLoading}
            >
              {loading || detailLoading ? 'Đang tải…' : 'Làm mới'}
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
          <span>Tìm audit trace</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="request_id, actor, reason, summary"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Loại audit</span>
          <select
            value={filtersDraft.kind}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, kind: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Tất cả</option>
            <option value="system_ai_settings">Cấu hình AI</option>
            <option value="whale_config">Cấu hình Whale</option>
            <option value="advisory">Advisory</option>
            <option value="crawl_audit">Crawl</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Hành động</span>
          <input
            value={filtersDraft.action}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, action: event.target.value }))}
            placeholder="update_settings, apply, run_started"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Người thực hiện</span>
          <input
            value={filtersDraft.actor}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, actor: event.target.value }))}
            placeholder="operator-admin"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Lý do</span>
          <input
            value={filtersDraft.reason}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Cập nhật cấu hình"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Mã cổ phiếu</span>
          <input
            value={filtersDraft.symbol}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, symbol: event.target.value }))}
            placeholder="VNM"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>Mã dịch vụ crawl</span>
          <input
            value={filtersDraft.serviceCode}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceCode: event.target.value }))}
            placeholder="crawl_alpha"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Áp dụng bộ lọc
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Xóa bộ lọc
          </button>
        </div>
      </form>

      <AdminPanel
        title="Tổng hợp audit trace"
        description="Các audit log current-code operator đang hiển thị theo chụp nhanh hiện tại."
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải summary…' : 'Chưa có dữ liệu tổng hợp audit trace.'}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title="Bảng audit trace"
          description="Các bản ghi audit được xếp theo snapshot hiện tại và có detail fetch riêng."
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openPrevPage}
                disabled={!prevCursor || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={openNextPage}
                disabled={!hasMore || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Trang sau
              </button>
            </div>
          )}
        >
          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Tóm tắt</th>
                    <th className="px-4 py-3">Thời điểm</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {rows.map((row: any) => {
                    const isSelected = row.id === selectedRequestId;
                    return (
                      <tr key={row.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(row.kind)}`}>
                            {kindLabel(row.kind)}
                          </span>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.request_id}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{row.action || row.event || '—'}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{row.actor || '—'}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950 dark:text-white">{row.summary}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.source_model}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {(row.created_at || row.timestamp) || '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestId(row.id)}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            Xem chi tiết
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
              {loading ? 'Đang tải audit trace…' : 'Không có audit trace phù hợp bộ lọc.'}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title="Chi tiết audit trace"
          description="Bản ghi đã chọn và source record đi kèm để truy vết operator."
        >
          {detailError ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {detailError}
            </div>
          ) : null}

          {selectedRequest ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedRequest.summary}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedRequest.request_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(selectedRequest.kind)}`}>
                    {kindLabel(selectedRequest.kind)}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {selectedRequest.source_model}
                  </span>
                </div>
              </div>

              {detailLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải chi tiết audit trace…</p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminValueRow label="Mã yêu cầu" value={selectedRequest.request_id} />
                <AdminValueRow label="Loại audit" value={kindLabel(selectedRequest.kind)} />
                <AdminValueRow label="Hành động" value={selectedRequest.action || selectedRequest.event || '—'} />
                <AdminValueRow label="Actor" value={selectedRequest.actor || '—'} />
                <AdminValueRow label="Lý do" value={selectedRequest.reason || '—'} />
                <AdminValueRow label="Thời điểm" value={(selectedRequest.created_at || selectedRequest.timestamp) || '—'} />
              </div>

              {selectedRequest.kind === 'system_ai_settings' ? (
                <DetailBlock title="Chi tiết AI settings">
                  <AdminValueRow label="Settings ID" value={String(selectedRequest.settings_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'whale_config' ? (
                <DetailBlock title="Chi tiết Whale config">
                  <AdminValueRow label="Draft ID" value={String(selectedRequest.draft_id ?? '—')} />
                  <AdminValueRow label="Version ID" value={String(selectedRequest.version_id ?? '—')} />
                  <AdminValueRow label="Rollout ID" value={String(selectedRequest.rollout_id ?? '—')} />
                  <AdminValueRow label="Ticket ref" value={selectedRequest.ticket_ref || '—'} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'advisory' ? (
                <DetailBlock title="Chi tiết Advisory">
                  <AdminValueRow label="Mã cổ phiếu" value={selectedRequest.symbol || '—'} />
                  <AdminValueRow label="Actor ID" value={selectedRequest.actor_id || '—'} />
                  <AdminValueRow label="User ID" value={String(selectedRequest.user_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.metadata_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'crawl_audit' ? (
                <DetailBlock title="Chi tiết crawl audit">
                  <AdminValueRow label="Event" value={selectedRequest.event || '—'} />
                  <AdminValueRow label="Run ID" value={String(selectedRequest.run_id ?? '—')} />
                  <AdminValueRow label="Job ID" value={String(selectedRequest.job_id ?? '—')} />
                  <AdminValueRow label="Mã dịch vụ" value={selectedRequest.service_code || '—'} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.payload)}</pre>
                </DetailBlock>
              ) : null}

              <DetailBlock title="Source record">
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(sourceRecord)}</pre>
              </DetailBlock>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading || detailLoading ? 'Đang tải chi tiết audit trace…' : 'Chọn một audit trace trong bảng bên trái để mở chi tiết.'}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
