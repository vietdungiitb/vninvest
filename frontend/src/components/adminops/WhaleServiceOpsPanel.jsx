import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getWhaleServiceJobs,
  retryWhaleServiceJob,
  triggerWhaleServiceJob,
} from '../../api/client';
import { useI18n } from '../../context/LangContext';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('vi-VN');
}

function isoDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_OPTIONS = ['ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL', 'SKIPPED_DUPLICATE'];
const SERVICE_OPTIONS = ['ALL', 'USER_REFRESH', 'BACKFILL', 'GLOBAL_RECOMPUTE'];

export default function WhaleServiceOpsPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState(null);
  const [message, setMessage] = useState('');
  const [jobs, setJobs] = useState([]);

  const [globalSymbols, setGlobalSymbols] = useState('');
  const [backfillSymbols, setBackfillSymbols] = useState('');
  const [backfillStartDate, setBackfillStartDate] = useState(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return isoDate(start);
  });
  const [backfillEndDate, setBackfillEndDate] = useState(() => isoDate(new Date()));

  const [filters, setFilters] = useState({
    status: 'ALL',
    service_type: 'ALL',
    date_from: '',
    date_to: '',
  });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters.service_type && filters.service_type !== 'ALL') params.service_type = filters.service_type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const resp = await getWhaleServiceJobs(params);
      setJobs(Array.isArray(resp?.data) ? resp.data : []);
    } catch (err) {
      setMessage(err?.response?.data?.error || err?.message || 'Không tải được danh sách job Whale Service.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const parseSymbols = useCallback((raw) => {
    if (!raw) return [];
    return String(raw)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, []);

  const handleTriggerGlobalRecompute = useCallback(async () => {
    setSubmitting(true);
    setMessage('');
    try {
      const symbols = parseSymbols(globalSymbols);
      const params = symbols.length ? { symbols } : {};
      const resp = await triggerWhaleServiceJob('GLOBAL_RECOMPUTE', params);
      setMessage(resp?.data?.message || 'Đã trigger GLOBAL_RECOMPUTE thành công.');
      await loadJobs();
    } catch (err) {
      setMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Trigger GLOBAL_RECOMPUTE thất bại.');
    } finally {
      setSubmitting(false);
    }
  }, [globalSymbols, loadJobs, parseSymbols]);

  const handleTriggerBackfill = useCallback(async () => {
    setSubmitting(true);
    setMessage('');
    try {
      const symbols = parseSymbols(backfillSymbols);
      const params = {
        symbols,
        start_date: backfillStartDate,
        end_date: backfillEndDate,
      };
      const resp = await triggerWhaleServiceJob('BACKFILL', params);
      setMessage(resp?.data?.message || 'Đã trigger BACKFILL thành công.');
      await loadJobs();
    } catch (err) {
      setMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Trigger BACKFILL thất bại.');
    } finally {
      setSubmitting(false);
    }
  }, [backfillSymbols, backfillStartDate, backfillEndDate, loadJobs, parseSymbols]);

  const handleRetry = useCallback(async (jobId) => {
    setRetryingJobId(jobId);
    setMessage('');
    try {
      const resp = await retryWhaleServiceJob(jobId);
      setMessage(resp?.data?.message || `Đã xếp hàng retry cho job #${jobId}.`);
      await loadJobs();
    } catch (err) {
      setMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || `Retry thất bại cho job #${jobId}.`);
    } finally {
      setRetryingJobId(null);
    }
  }, [loadJobs]);

  const filteredSummary = useMemo(() => {
    const summary = { total: jobs.length, pending: 0, running: 0, failed: 0, partial: 0 };
    jobs.forEach((job) => {
      const st = String(job?.status || '').toUpperCase();
      if (st === 'PENDING') summary.pending += 1;
      if (st === 'RUNNING') summary.running += 1;
      if (st === 'FAILED') summary.failed += 1;
      if (st === 'PARTIAL') summary.partial += 1;
    });
    return summary;
  }, [jobs]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-cyan-900/40 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
          {t('adminOps.whaleServiceOpsTitle', { defaultValue: 'Whale Service Orchestration' })}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          {t('adminOps.whaleServiceOpsDesc', { defaultValue: 'Trigger GLOBAL_RECOMPUTE/BACKFILL, theo dõi job registry và retry an toàn cho FAILED/PARTIAL.' })}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">GLOBAL_RECOMPUTE</h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Để trống symbols để chạy toàn bộ scope hệ thống.</p>
          <label className="mt-3 block text-xs text-gray-500 dark:text-gray-300">Symbols (comma-separated)</label>
          <input
            type="text"
            value={globalSymbols}
            onChange={(e) => setGlobalSymbols(e.target.value)}
            placeholder="ACB, SHB, VCB"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleTriggerGlobalRecompute}
            disabled={submitting}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Trigger GLOBAL_RECOMPUTE
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">BACKFILL (default 3 tháng)</h4>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-300">Từ ngày</label>
              <input
                type="date"
                value={backfillStartDate}
                onChange={(e) => setBackfillStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-300">Đến ngày</label>
              <input
                type="date"
                value={backfillEndDate}
                onChange={(e) => setBackfillEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <label className="mt-3 block text-xs text-gray-500 dark:text-gray-300">Symbols (comma-separated, để trống = all)</label>
          <input
            type="text"
            value={backfillSymbols}
            onChange={(e) => setBackfillSymbols(e.target.value)}
            placeholder="ACB, SHB, VCB"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={handleTriggerBackfill}
            disabled={submitting || !backfillStartDate || !backfillEndDate}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Trigger BACKFILL
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">Service Type</label>
            <select
              value={filters.service_type}
              onChange={(e) => setFilters((prev) => ({ ...prev, service_type: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              {SERVICE_OPTIONS.map((serviceType) => <option key={serviceType} value={serviceType}>{serviceType}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">Từ ngày</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">Đến ngày</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="button"
            onClick={loadJobs}
            disabled={loading}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : 'Lọc/Refresh'}
          </button>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-5">
          <div>Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredSummary.total}</span></div>
          <div>PENDING: <span className="font-semibold text-amber-500">{filteredSummary.pending}</span></div>
          <div>RUNNING: <span className="font-semibold text-blue-500">{filteredSummary.running}</span></div>
          <div>FAILED: <span className="font-semibold text-rose-500">{filteredSummary.failed}</span></div>
          <div>PARTIAL: <span className="font-semibold text-orange-500">{filteredSummary.partial}</span></div>
        </div>

        {message ? (
          <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">{message}</p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Service</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Progress</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">By</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-center text-slate-500" colSpan={7}>Không có job phù hợp bộ lọc.</td>
                </tr>
              ) : jobs.map((job) => {
                const status = String(job?.status || '').toUpperCase();
                const canRetry = status === 'FAILED' || status === 'PARTIAL';
                return (
                  <tr key={job.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-2 font-semibold">#{job.id}</td>
                    <td className="px-2 py-2">{job.service_type}</td>
                    <td className="px-2 py-2">{status}</td>
                    <td className="px-2 py-2">{Number(job.progress_pct || 0).toFixed(0)}%</td>
                    <td className="px-2 py-2">{fmtDate(job.created_at)}</td>
                    <td className="px-2 py-2">{job.created_by_username || '—'}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={!canRetry || retryingJobId === job.id}
                        onClick={() => handleRetry(job.id)}
                        className="rounded-md border border-rose-500/40 px-2 py-1 font-semibold text-rose-400 hover:bg-rose-900/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {retryingJobId === job.id ? 'Retrying...' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
