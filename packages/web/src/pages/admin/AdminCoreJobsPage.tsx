import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';

const DEFAULT_LIMIT = 25;
const DEFAULT_FILTERS = {
  search: '',
  kind: '',
  status: '',
  serviceDomain: '',
  serviceCode: '',
};

function toneClasses(status: any) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'running') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  }
  if (normalized === 'queued') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'completed' || normalized === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'failed' || normalized === 'cancelled') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function kindTone(kind: any) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'signal_run') {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  }
  if (normalized === 'crawl_run') {
    return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function kindLabel(kind: any) {
  if (kind === 'signal_run') {
    return 'Signal';
  }
  if (kind === 'crawl_run') {
    return 'Crawl';
  }
  return kind || '—';
}

function formatPercentValue(value: any) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return `${numeric.toFixed(1)}%`;
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
      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

export function AdminCoreJobsPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState({ startingAfter: '', endingBefore: '' });
  const [selectedJobId, setSelectedJobId] = useState('');

  const loadJobs = useCallback(async () => {
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
      if (filters.status) {
        params.status = filters.status;
      }
      if (filters.serviceDomain) {
        params.service_domain = filters.serviceDomain;
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

      const response = await (coreApiAdapter as unknown as { getCoreOperatorJobs: (params: any) => Promise<any> }).getCoreOperatorJobs(params);
      const nextSnapshot = response.data || null;
      const nextJobs = Array.isArray(nextSnapshot?.data) ? nextSnapshot.data : [];

      setSnapshot(nextSnapshot);
      setLastFetched(new Date());
      setSelectedJobId((current: string) => {
        if (current && nextJobs.some((item: any) => item.id === current)) {
          return current;
        }
        return nextJobs[0]?.id || '';
      });
    } catch (nextError: any) {
      setError(nextError?.response?.status === 403
        ? 'Không đủ quyền để xem bảng jobs operator.'
        : 'Không tải được bảng jobs operator.');
    } finally {
      setLoading(false);
    }
  }, [cursor.endingBefore, cursor.startingAfter, filters.kind, filters.search, filters.serviceCode, filters.serviceDomain, filters.status]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs, refreshTick]);

  const summaryCards = Array.isArray(snapshot?.summary_cards) ? snapshot.summary_cards : [];
  const jobs = Array.isArray(snapshot?.data) ? snapshot.data : [];
  const selectedJob = jobs.find((item: any) => item.id === selectedJobId) || jobs[0] || null;
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

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Bảng jobs và materializer
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Theo dõi các lượt chạy SignalServiceRun và CrawlRun theo current-code operator projection, hoàn toàn read-only ở slice này.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/core/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Quay lại tổng quan
            </Link>
            <Link
              to="/admin/core/audit/requests"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Mở audit trace
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
          <span>Tìm jobs</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="Mã job, task_id, mô tả, log"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Loại job</span>
          <select
            value={filtersDraft.kind}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, kind: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Tất cả</option>
            <option value="signal_run">Signal</option>
            <option value="crawl_run">Crawl</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Trạng thái</span>
          <select
            value={filtersDraft.status}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Tất cả</option>
            <option value="running">running</option>
            <option value="queued">queued</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>Miền dịch vụ</span>
          <input
            value={filtersDraft.serviceDomain}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceDomain: event.target.value }))}
            placeholder="Ví dụ: whale"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>Mã dịch vụ crawl</span>
          <input
            value={filtersDraft.serviceCode}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceCode: event.target.value }))}
            placeholder="Ví dụ: crawl_alpha"
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

      <Panel
        title="Tổng hợp jobs"
        description="Các chụp nhanh current-code operator jobs đang hiển thị."
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải summary…' : 'Chưa có dữ liệu tổng hợp jobs.'}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Bảng jobs"
          description="Các dòng SignalServiceRun và CrawlRun được sắp theo snapshot hiện tại."
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
          {jobs.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Tóm tắt</th>
                    <th className="px-4 py-3">Thời điểm</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {jobs.map((job: any) => {
                    const isSelected = job.id === selectedJobId;
                    return (
                      <tr key={job.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${kindTone(job.kind)}`}>
                            {kindLabel(job.kind)}
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{job.request_id}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(job.status_category || job.status)}`}>
                            {job.status_display || job.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950 dark:text-white">{job.summary}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{job.source_model}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                          <p>{job.created_at || '—'}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {job.kind === 'signal_run' ? formatPercentValue(job.progress_pct) : job.trigger_type_display || job.trigger_type || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedJobId(job.id)}
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
              {loading ? 'Đang tải bảng jobs…' : 'Không có job phù hợp bộ lọc.'}
            </div>
          )}
        </Panel>

        <Panel
          title="Chi tiết job"
          description="Bản ghi đã chọn, read-only, không có write action ở slice CA-07 này."
        >
          {selectedJob ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedJob.summary}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedJob.request_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${kindTone(selectedJob.kind)}`}>
                    {kindLabel(selectedJob.kind)}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(selectedJob.status_category || selectedJob.status)}`}>
                    {selectedJob.status_display || selectedJob.status || '—'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ValueRow label="Mã yêu cầu" value={selectedJob.request_id} />
                <ValueRow label="Nguồn model" value={selectedJob.source_model} />
                <ValueRow label="Tóm tắt" value={selectedJob.summary} />
                <ValueRow label="Trạng thái" value={selectedJob.status_display || selectedJob.status || '—'} />
                <ValueRow label="Tạo lúc" value={selectedJob.created_at || '—'} />
                <ValueRow label="Cập nhật lúc" value={selectedJob.updated_at || '—'} />
                <ValueRow label="Bắt đầu" value={selectedJob.started_at || '—'} />
                <ValueRow label="Kết thúc" value={selectedJob.finished_at || '—'} />
              </div>

              {selectedJob.kind === 'signal_run' ? (
                <DetailBlock title="Chi tiết signal">
                  <ValueRow label="Miền dịch vụ" value={selectedJob.service_domain_display || selectedJob.service_domain || '—'} />
                  <ValueRow label="Loại chạy" value={selectedJob.run_type_display || selectedJob.run_type || '—'} />
                  <ValueRow label="Task ID" value={selectedJob.task_id || '—'} />
                  <ValueRow label="Người tạo" value={selectedJob.created_by_username || '—'} />
                  <ValueRow label="Tiến độ" value={formatPercentValue(selectedJob.progress_pct)} />
                  <ValueRow label="Đã xử lý" value={String(selectedJob.processed_items ?? '—')} />
                  <ValueRow label="Đã lưu" value={String(selectedJob.stored_items ?? '—')} />
                  <ValueRow label="Đã lỗi" value={String(selectedJob.failed_items ?? '—')} />
                </DetailBlock>
              ) : null}

              {selectedJob.kind === 'crawl_run' ? (
                <DetailBlock title="Chi tiết crawl">
                  <ValueRow label="Mã dịch vụ" value={selectedJob.service_code || '—'} />
                  <ValueRow label="Mô tả job" value={selectedJob.job_description || '—'} />
                  <ValueRow label="Loại kích hoạt" value={selectedJob.trigger_type_display || selectedJob.trigger_type || '—'} />
                  <ValueRow label="Job ID" value={String(selectedJob.job_id ?? '—')} />
                  <ValueRow label="Task ID" value={selectedJob.task_id || '—'} />
                </DetailBlock>
              ) : null}

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {selectedJob.log_excerpt ? (
                  <>
                    <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Log trích xuất</p>
                    <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 dark:text-slate-300">{selectedJob.log_excerpt}</pre>
                  </>
                ) : (
                  'Job này chưa có log trích xuất.'
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? 'Đang tải chi tiết job…' : 'Chọn một job trong bảng bên trái để mở chi tiết.'}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
