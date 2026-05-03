import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCoreOperatorAuditRequestDetail, getCoreOperatorAuditRequests } from '../api/client';
import { useI18n } from '../context/LangContext';

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

function toneClasses(kind) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'system_ai_settings') {
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  }
  if (normalized === 'whale_config') {
    return 'border-violet-500/30 bg-violet-500/10 text-violet-200';
  }
  if (normalized === 'advisory') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'crawl_audit') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function kindLabel(kind) {
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

function formatDateTimeValue(value, formatDateTimeFn) {
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

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
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
      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="mt-3 space-y-1">{children}</div>
    </div>
  );
}

export default function AdminCoreAuditTrace() {
  const { t, formatDateTime } = useI18n();
  const [snapshot, setSnapshot] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filtersDraft, setFiltersDraft] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState({ startingAfter: '', endingBefore: '' });
  const [selectedRequestId, setSelectedRequestId] = useState('');

  const loadAuditRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: DEFAULT_LIMIT };
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

      const response = await getCoreOperatorAuditRequests(params);
      const nextSnapshot = response.data || null;
      const nextRows = Array.isArray(nextSnapshot?.data) ? nextSnapshot.data : [];

      setSnapshot(nextSnapshot);
      setLastFetched(new Date());
      setSelectedRequestId((current) => {
        if (current && nextRows.some((item) => item.id === current)) {
          return current;
        }
        return nextRows[0]?.id || '';
      });
      setDetail(null);
    } catch (nextError) {
      setError(nextError?.response?.status === 403
        ? 'Không đủ quyền để xem audit trace operator.'
        : 'Không tải được audit trace operator.');
    } finally {
      setLoading(false);
    }
  }, [cursor.endingBefore, cursor.startingAfter, filters.action, filters.actor, filters.kind, filters.reason, filters.search, filters.serviceCode, filters.symbol, refreshTick]);

  useEffect(() => {
    loadAuditRequests();
  }, [loadAuditRequests]);

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
        const response = await getCoreOperatorAuditRequestDetail(selectedRequestId);
        if (!cancelled) {
          setDetail(response.data || null);
        }
      } catch (nextError) {
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
  const selectedRequest = detail?.request || rows.find((item) => item.id === selectedRequestId) || rows[0] || null;
  const sourceRecord = detail?.source_record || null;
  const hasMore = Boolean(snapshot?.has_more);
  const nextCursor = snapshot?.next_cursor || '';
  const prevCursor = snapshot?.prev_cursor || '';
  const lastFetchedLabel = lastFetched
    ? formatDateTime(lastFetched, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const submitFilters = (event) => {
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
                {t('adminCoreAuditTrace.title', { defaultValue: 'Truy vết audit' })}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreAuditTrace.description', {
                  defaultValue: 'Xem các audit log current-code operator theo chụp nhanh hiện tại, có panel chi tiết và source record cho từng bản ghi.',
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/core/overview"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreAuditTrace.backToOverview', { defaultValue: 'Quay lại tổng quan' })}
            </Link>
            <Link
              to="/admin/core/runtime/jobs"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreAuditTrace.openJobs', { defaultValue: 'Mở jobs' })}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || detailLoading}
            >
              {loading || detailLoading ? 'Đang tải…' : t('adminCoreAuditTrace.refresh', { defaultValue: 'Làm mới' })}
            </button>
          </div>
        </div>
      </section>

      {lastFetchedLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('adminCoreAuditTrace.lastFetched', { defaultValue: `Đã chụp lúc ${lastFetchedLabel}` })}
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
          <span>{t('adminCoreAuditTrace.searchLabel', { defaultValue: 'Tìm audit trace' })}</span>
          <input
            value={filtersDraft.search}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, search: event.target.value }))}
            placeholder="request_id, actor, reason, summary"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.kindLabel', { defaultValue: 'Loại audit' })}</span>
          <select
            value={filtersDraft.kind}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, kind: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">{t('adminCoreAuditTrace.allKinds', { defaultValue: 'Tất cả' })}</option>
            <option value="system_ai_settings">Cấu hình AI</option>
            <option value="whale_config">Cấu hình Whale</option>
            <option value="advisory">Advisory</option>
            <option value="crawl_audit">Crawl</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.actionLabel', { defaultValue: 'Hành động' })}</span>
          <input
            value={filtersDraft.action}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, action: event.target.value }))}
            placeholder="update_settings, apply, run_started"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.actorLabel', { defaultValue: 'Người thực hiện' })}</span>
          <input
            value={filtersDraft.actor}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, actor: event.target.value }))}
            placeholder="operator-admin"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.reasonLabel', { defaultValue: 'Lý do' })}</span>
          <input
            value={filtersDraft.reason}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Cập nhật cấu hình"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{t('adminCoreAuditTrace.symbolLabel', { defaultValue: 'Mã cổ phiếu' })}</span>
          <input
            value={filtersDraft.symbol}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, symbol: event.target.value }))}
            placeholder="VNM"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 md:col-span-2">
          <span>{t('adminCoreAuditTrace.serviceCodeLabel', { defaultValue: 'Mã dịch vụ crawl' })}</span>
          <input
            value={filtersDraft.serviceCode}
            onChange={(event) => setFiltersDraft((current) => ({ ...current, serviceCode: event.target.value }))}
            placeholder="crawl_alpha"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {t('adminCoreAuditTrace.applyFilters', { defaultValue: 'Áp dụng bộ lọc' })}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t('adminCoreAuditTrace.clearFilters', { defaultValue: 'Xóa bộ lọc' })}
          </button>
        </div>
      </form>

      <Panel
        title={t('adminCoreAuditTrace.summaryTitle', { defaultValue: 'Tổng hợp audit trace' })}
        description={t('adminCoreAuditTrace.summaryDescription', { defaultValue: 'Các audit log current-code operator đang hiển thị theo chụp nhanh hiện tại.' })}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải summary…' : 'Chưa có dữ liệu tổng hợp audit trace.'}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={t('adminCoreAuditTrace.listTitle', { defaultValue: 'Bảng audit trace' })}
          description={t('adminCoreAuditTrace.listDescription', { defaultValue: 'Các bản ghi audit được xếp theo snapshot hiện tại và có detail fetch riêng.' })}
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
                  {rows.map((row) => {
                    const isSelected = row.id === selectedRequestId;
                    return (
                      <tr key={row.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(row.kind)}`}>
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
                          {formatDateTimeValue(row.created_at || row.timestamp, formatDateTime)}
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
        </Panel>

        <Panel
          title={t('adminCoreAuditTrace.detailTitle', { defaultValue: 'Chi tiết audit trace' })}
          description={t('adminCoreAuditTrace.detailDescription', { defaultValue: 'Bản ghi đã chọn và source record đi kèm để truy vết operator.' })}
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
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(selectedRequest.kind)}`}>
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
                <ValueRow label="Mã yêu cầu" value={selectedRequest.request_id} />
                <ValueRow label="Loại audit" value={kindLabel(selectedRequest.kind)} />
                <ValueRow label="Hành động" value={selectedRequest.action || selectedRequest.event || '—'} />
                <ValueRow label="Actor" value={selectedRequest.actor || '—'} />
                <ValueRow label="Lý do" value={selectedRequest.reason || '—'} />
                <ValueRow label="Thời điểm" value={formatDateTimeValue(selectedRequest.created_at || selectedRequest.timestamp, formatDateTime)} />
              </div>

              {selectedRequest.kind === 'system_ai_settings' ? (
                <DetailBlock title="Chi tiết AI settings">
                  <ValueRow label="Settings ID" value={String(selectedRequest.settings_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'whale_config' ? (
                <DetailBlock title="Chi tiết Whale config">
                  <ValueRow label="Draft ID" value={String(selectedRequest.draft_id ?? '—')} />
                  <ValueRow label="Version ID" value={String(selectedRequest.version_id ?? '—')} />
                  <ValueRow label="Rollout ID" value={String(selectedRequest.rollout_id ?? '—')} />
                  <ValueRow label="Ticket ref" value={selectedRequest.ticket_ref || '—'} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'advisory' ? (
                <DetailBlock title="Chi tiết Advisory">
                  <ValueRow label="Mã cổ phiếu" value={selectedRequest.symbol || '—'} />
                  <ValueRow label="Actor ID" value={selectedRequest.actor_id || '—'} />
                  <ValueRow label="User ID" value={String(selectedRequest.user_id ?? '—')} />
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.before_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.after_state_json)}</pre>
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{stringifyValue(selectedRequest.metadata_json)}</pre>
                </DetailBlock>
              ) : null}

              {selectedRequest.kind === 'crawl_audit' ? (
                <DetailBlock title="Chi tiết crawl audit">
                  <ValueRow label="Event" value={selectedRequest.event || '—'} />
                  <ValueRow label="Run ID" value={String(selectedRequest.run_id ?? '—')} />
                  <ValueRow label="Job ID" value={String(selectedRequest.job_id ?? '—')} />
                  <ValueRow label="Mã dịch vụ" value={selectedRequest.service_code || '—'} />
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
        </Panel>
      </div>
    </div>
  );
}