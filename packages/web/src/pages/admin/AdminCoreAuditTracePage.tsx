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
  action: '',
  actor: '',
  reason: '',
  symbol: '',
  serviceCode: '',
};

function kindLabel(kind: any, t: (key: string) => string) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'system_ai_settings') {
    return t('adminCoreAuditTrace.kindAiSettings');
  }
  if (normalized === 'whale_config') {
    return t('adminCoreAuditTrace.kindWhaleConfig');
  }
  if (normalized === 'advisory') {
    return t('adminCoreAuditTrace.kindAdvisory');
  }
  if (normalized === 'crawl_audit') {
    return t('adminCoreAuditTrace.kindCrawlAudit');
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
  const { t, localeTag } = useI18n();
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
        ? t('adminCoreAuditTrace.errorNoPermission')
        : t('adminCoreAuditTrace.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [cursor.endingBefore, cursor.startingAfter, filters.action, filters.actor, filters.kind, filters.reason, filters.search, filters.serviceCode, filters.symbol, t]);

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
            ? t('adminCoreAuditTrace.errorDetailNotFound')
            : t('adminCoreAuditTrace.errorDetailGeneric'));
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
  }, [selectedRequestId, refreshTick, t]);

  const summaryCards = Array.isArray(snapshot?.summary_cards) ? snapshot.summary_cards : [];
  const rows = Array.isArray(snapshot?.data) ? snapshot.data : [];
  const selectedRequest = detail?.request || rows.find((item: any) => item.id === selectedRequestId) || rows[0] || null;
  const sourceRecord = detail?.source_record || null;
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
                {t('adminCoreAuditTrace.heroTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreAuditTrace.heroDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreAuditTrace.backToOverview')}
            </Link>
            <Link
              to="/admin/jobs"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreAuditTrace.openJobs')}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || detailLoading}
            >
              {loading || detailLoading ? t('adminCoreAuditTrace.loading') : t('adminCoreAuditTrace.refresh')}
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
          <span>{t('adminCoreAuditTrace.filterSearch')}</span>
          <input
            value={filtersDraft.search}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="request_id, actor, reason, summary"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.filterKind')}</span>
          <select
            value={filtersDraft.kind}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setFiltersDraft((current) => ({ ...current, kind: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreAuditTrace.filterAll')}</option>
            <option value="system_ai_settings">{t('adminCoreAuditTrace.kindAiSettings')}</option>
            <option value="whale_config">{t('adminCoreAuditTrace.kindWhaleConfig')}</option>
            <option value="advisory">{t('adminCoreAuditTrace.kindAdvisory')}</option>
            <option value="crawl_audit">{t('adminCoreAuditTrace.kindCrawlAudit')}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.filterAction')}</span>
          <input
            value={filtersDraft.action}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, action: event.target.value }))}
            placeholder={t('adminCoreAuditTrace.filterActionPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.filterActor')}</span>
          <input
            value={filtersDraft.actor}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, actor: event.target.value }))}
            placeholder={t('adminCoreAuditTrace.filterActorPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.filterReason')}</span>
          <input
            value={filtersDraft.reason}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, reason: event.target.value }))}
            placeholder={t('adminCoreAuditTrace.filterReasonPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.filterSymbol')}</span>
          <input
            value={filtersDraft.symbol}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, symbol: event.target.value }))}
            placeholder={t('adminCoreAuditTrace.filterSymbolPh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreAuditTrace.filterServiceCode')}</span>
          <input
            value={filtersDraft.serviceCode}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFiltersDraft((current) => ({ ...current, serviceCode: event.target.value }))}
            placeholder={t('adminCoreAuditTrace.filterServiceCodePh')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {t('adminCoreAuditTrace.applyFilters')}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('adminCoreAuditTrace.clearFilters')}
          </button>
        </div>
      </form>

      <AdminPanel
        title={t('adminCoreAuditTrace.summaryTitle')}
        description={t('adminCoreAuditTrace.summaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreAuditTrace.summaryLoading') : t('adminCoreAuditTrace.summaryEmpty')}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title={t('adminCoreAuditTrace.tableTitle')}
          description={t('adminCoreAuditTrace.tableDescription')}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openPrevPage}
                disabled={!prevCursor || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('adminCoreAuditTrace.prevPage')}
              </button>
              <button
                type="button"
                onClick={openNextPage}
                disabled={!hasMore || loading}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('adminCoreAuditTrace.nextPage')}
              </button>
            </div>
          )}
        >
          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreAuditTrace.thKind')}</th>
                    <th className="px-4 py-3">{t('adminCoreAuditTrace.thAction')}</th>
                    <th className="px-4 py-3">{t('adminCoreAuditTrace.thActor')}</th>
                    <th className="px-4 py-3">{t('adminCoreAuditTrace.thSummary')}</th>
                    <th className="px-4 py-3">{t('adminCoreAuditTrace.thTime')}</th>
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
                            {kindLabel(row.kind, t)}
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
                            {t('adminCoreAuditTrace.viewDetail')}
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
              {loading ? t('adminCoreAuditTrace.tableLoading') : t('adminCoreAuditTrace.tableEmpty')}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreAuditTrace.detailTitle')}
          description={t('adminCoreAuditTrace.detailDescription')}
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
                    {kindLabel(selectedRequest.kind, t)}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {selectedRequest.source_model}
                  </span>
                </div>
              </div>

              {detailLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminCoreAuditTrace.detailLoading')}</p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminValueRow label={t('adminCoreAuditTrace.rowRequestId')} value={selectedRequest.request_id} />
                <AdminValueRow label={t('adminCoreAuditTrace.rowKind')} value={kindLabel(selectedRequest.kind, t)} />
                <AdminValueRow label={t('adminCoreAuditTrace.rowAction')} value={selectedRequest.action || selectedRequest.event || '—'} />
                <AdminValueRow label={t('adminCoreAuditTrace.rowActor')} value={selectedRequest.actor || '—'} />
                <AdminValueRow label={t('adminCoreAuditTrace.rowReason')} value={selectedRequest.reason || '—'} />
                <AdminValueRow label={t('adminCoreAuditTrace.rowTime')} value={(selectedRequest.created_at || selectedRequest.timestamp) || '—'} />
              </div>

              {selectedRequest.kind === 'system_ai_settings' ? (
                <DetailBlock title={t('adminCoreAuditTrace.detailAiSettingsTitle')}>
                  <AdminValueRow label={t('adminCoreAuditTrace.rowSettingsId')} value={String(selectedRequest.settings_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'whale_config' ? (
                <DetailBlock title={t('adminCoreAuditTrace.detailWhaleTitle')}>
                  <AdminValueRow label={t('adminCoreAuditTrace.rowDraftId')} value={String(selectedRequest.draft_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowVersionId')} value={String(selectedRequest.version_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowRolloutId')} value={String(selectedRequest.rollout_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowTicketRef')} value={selectedRequest.ticket_ref || '—'} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'advisory' ? (
                <DetailBlock title={t('adminCoreAuditTrace.detailAdvisoryTitle')}>
                  <AdminValueRow label={t('adminCoreAuditTrace.rowSymbol')} value={selectedRequest.symbol || '—'} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowActorId')} value={selectedRequest.actor_id || '—'} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowUserId')} value={String(selectedRequest.user_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.metadata_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'crawl_audit' ? (
                <DetailBlock title={t('adminCoreAuditTrace.detailCrawlTitle')}>
                  <AdminValueRow label={t('adminCoreAuditTrace.rowEvent')} value={selectedRequest.event || '—'} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowRunId')} value={String(selectedRequest.run_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowJobId')} value={String(selectedRequest.job_id ?? '—')} />
                  <AdminValueRow label={t('adminCoreAuditTrace.rowServiceCode')} value={selectedRequest.service_code || '—'} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.payload)}</pre>
                </DetailBlock>
              ) : null}

              <DetailBlock title={t('adminCoreAuditTrace.detailSourceTitle')}>
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(sourceRecord)}</pre>
              </DetailBlock>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading || detailLoading ? t('adminCoreAuditTrace.detailLoading') : t('adminCoreAuditTrace.detailEmpty')}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
