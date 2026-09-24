import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

const DEFAULT_LIMIT = 25;
const DEFAULT_FILTERS = {
  search: '',
  kind: '',
  status: '',
  serviceDomain: '',
  serviceCode: '',
};

function kindLabel(kind: any, t: (key: string) => string) {
  if (kind === 'signal_run') {
    return t('adminCoreJobs.kindSignal');
  }
  if (kind === 'crawl_run') {
    return t('adminCoreJobs.kindCrawl');
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

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

export function AdminCoreJobsPage() {
  const { t, localeTag } = useI18n();
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
        ? t('adminCoreJobs.errorNoPermission')
        : t('adminCoreJobs.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [cursor.endingBefore, cursor.startingAfter, filters.kind, filters.search, filters.serviceCode, filters.serviceDomain, filters.status, t]);

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
    ? lastFetched.toLocaleString(localeTag)
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
                {t('adminCoreJobs.heroTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreJobs.heroDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreJobs.backToOverview')}
            </Link>
            <Link
              to="/admin/audit-trace"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreJobs.openAuditTrace')}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('adminCoreJobs.loading') : t('adminCoreJobs.refresh')}
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
          <span>{t('adminCoreJobs.filterSearch')}</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder={t('adminCoreJobs.filterSearchPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreJobs.filterKind')}</span>
          <select
            value={filtersDraft.kind}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, kind: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreJobs.filterAll')}</option>
            <option value="signal_run">{t('adminCoreJobs.kindSignal')}</option>
            <option value="crawl_run">{t('adminCoreJobs.kindCrawl')}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreJobs.filterStatus')}</span>
          <select
            value={filtersDraft.status}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, status: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreJobs.filterAll')}</option>
            <option value="running">{t('adminCoreJobs.statusRunning')}</option>
            <option value="queued">{t('adminCoreJobs.statusQueued')}</option>
            <option value="completed">{t('adminCoreJobs.statusCompleted')}</option>
            <option value="failed">{t('adminCoreJobs.statusFailed')}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreJobs.filterServiceDomain')}</span>
          <input
            value={filtersDraft.serviceDomain}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceDomain: event.target.value }))}
            placeholder={t('adminCoreJobs.filterServiceDomainPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreJobs.filterServiceCode')}</span>
          <input
            value={filtersDraft.serviceCode}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceCode: event.target.value }))}
            placeholder={t('adminCoreJobs.filterServiceCodePh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {t('adminCoreJobs.applyFilters')}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('adminCoreJobs.clearFilters')}
          </button>
        </div>
      </form>

      <AdminPanel
        title={t('adminCoreJobs.summaryTitle')}
        description={t('adminCoreJobs.summaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreJobs.summaryLoading') : t('adminCoreJobs.summaryEmpty')}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title={t('adminCoreJobs.jobsTableTitle')}
          description={t('adminCoreJobs.jobsTableDescription')}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openPrevPage}
                disabled={!prevCursor || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('adminCoreJobs.prevPage')}
              </button>
              <button
                type="button"
                onClick={openNextPage}
                disabled={!hasMore || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('adminCoreJobs.nextPage')}
              </button>
            </div>
          )}
        >
          {jobs.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreJobs.thKind')}</th>
                    <th className="px-4 py-3">{t('adminCoreJobs.thStatus')}</th>
                    <th className="px-4 py-3">{t('adminCoreJobs.thSummary')}</th>
                    <th className="px-4 py-3">{t('adminCoreJobs.thTime')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {jobs.map((job: any) => {
                    const isSelected = job.id === selectedJobId;
                    return (
                      <tr key={job.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(job.kind)}`}>
                            {kindLabel(job.kind, t)}
                          </div>
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{job.request_id}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(job.status_category || job.status)}`}>
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
                            {t('adminCoreJobs.viewDetail')}
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
              {loading ? t('adminCoreJobs.tableLoading') : t('adminCoreJobs.tableEmpty')}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreJobs.detailTitle')}
          description={t('adminCoreJobs.detailDescription')}
        >
          {selectedJob ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedJob.summary}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedJob.request_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(selectedJob.kind)}`}>
                    {kindLabel(selectedJob.kind, t)}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(selectedJob.status_category || selectedJob.status)}`}>
                    {selectedJob.status_display || selectedJob.status || '—'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminValueRow label={t('adminCoreJobs.rowRequestId')} value={selectedJob.request_id} />
                <AdminValueRow label={t('adminCoreJobs.rowSourceModel')} value={selectedJob.source_model} />
                <AdminValueRow label={t('adminCoreJobs.rowSummary')} value={selectedJob.summary} />
                <AdminValueRow label={t('adminCoreJobs.rowStatus')} value={selectedJob.status_display || selectedJob.status || '—'} />
                <AdminValueRow label={t('adminCoreJobs.rowCreatedAt')} value={selectedJob.created_at || '—'} />
                <AdminValueRow label={t('adminCoreJobs.rowUpdatedAt')} value={selectedJob.updated_at || '—'} />
                <AdminValueRow label={t('adminCoreJobs.rowStartedAt')} value={selectedJob.started_at || '—'} />
                <AdminValueRow label={t('adminCoreJobs.rowFinishedAt')} value={selectedJob.finished_at || '—'} />
              </div>

              {selectedJob.kind === 'signal_run' ? (
                <DetailBlock title={t('adminCoreJobs.detailSignalTitle')}>
                  <AdminValueRow label={t('adminCoreJobs.rowServiceDomain')} value={selectedJob.service_domain_display || selectedJob.service_domain || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowRunType')} value={selectedJob.run_type_display || selectedJob.run_type || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowTaskId')} value={selectedJob.task_id || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowCreatedBy')} value={selectedJob.created_by_username || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowProgress')} value={formatPercentValue(selectedJob.progress_pct)} />
                  <AdminValueRow label={t('adminCoreJobs.rowProcessed')} value={String(selectedJob.processed_items ?? '—')} />
                  <AdminValueRow label={t('adminCoreJobs.rowStored')} value={String(selectedJob.stored_items ?? '—')} />
                  <AdminValueRow label={t('adminCoreJobs.rowFailed')} value={String(selectedJob.failed_items ?? '—')} />
                </DetailBlock>
              ) : null}

              {selectedJob.kind === 'crawl_run' ? (
                <DetailBlock title={t('adminCoreJobs.detailCrawlTitle')}>
                  <AdminValueRow label={t('adminCoreJobs.rowServiceCode')} value={selectedJob.service_code || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowJobDescription')} value={selectedJob.job_description || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowTriggerType')} value={selectedJob.trigger_type_display || selectedJob.trigger_type || '—'} />
                  <AdminValueRow label={t('adminCoreJobs.rowJobId')} value={String(selectedJob.job_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreJobs.rowTaskId')} value={selectedJob.task_id || '—'} />
                </DetailBlock>
              ) : null}

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {selectedJob.log_excerpt ? (
                  <>
                    <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">{t('adminCoreJobs.logExcerpt')}</p>
                    <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 dark:text-slate-300">{selectedJob.log_excerpt}</pre>
                  </>
                ) : (
                  t('adminCoreJobs.logEmpty')
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? t('adminCoreJobs.detailLoading') : t('adminCoreJobs.detailEmpty')}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
