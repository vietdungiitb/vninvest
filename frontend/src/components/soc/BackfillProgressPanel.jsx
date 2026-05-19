import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RUN_STATUS_TONE = {
  queued:   'bg-slate-700 text-slate-200',
  running:  'bg-emerald-800 text-emerald-100',
  success:  'bg-blue-800 text-blue-100',
  partial:  'bg-amber-800 text-amber-100',
  failed:   'bg-rose-900 text-rose-200',
  aborted:  'bg-slate-800 text-slate-400',
};
const runStatusTone = (s) => RUN_STATUS_TONE[s] || RUN_STATUS_TONE.queued;

const BATCH_STATE_TONE = {
  pending:  'text-slate-400',
  running:  'text-emerald-400',
  done:     'text-blue-300',
  failed:   'text-rose-400',
  skipped:  'text-slate-500',
};
const batchStateTone = (s) => BATCH_STATE_TONE[s] || 'text-slate-400';

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('vi-VN');
}

function fmtSec(s) {
  if (s == null) return '—';
  const sec = Math.round(s);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}p ${sec % 60}s` : `${Math.floor(m / 60)}h ${m % 60}p`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }) {
  const color =
    status === 'success' ? 'bg-blue-500' :
    status === 'partial' ? 'bg-amber-500' :
    status === 'failed'  ? 'bg-rose-600' :
    status === 'running' ? 'bg-emerald-500 animate-pulse' :
    'bg-slate-600';
  return (
    <div className="my-1 h-1.5 w-full rounded-full bg-slate-700">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
      />
    </div>
  );
}
ProgressBar.propTypes = {
  pct: PropTypes.number,
  status: PropTypes.string,
};

// ─── Batch row ────────────────────────────────────────────────────────────────

function BatchRow({ batch, t }) {
  return (
    <tr className="border-b border-slate-800 text-xs align-top">
      <td className="py-1.5 pr-3 font-mono text-slate-300">{batch.provider}</td>
      <td className={`py-1.5 pr-3 font-semibold uppercase ${batchStateTone(batch.state)}`}>
        {t(`soc.backfill.batch_state_${batch.state}`, { defaultValue: batch.state })}
      </td>
      <td className="py-1.5 pr-3 text-slate-300">{fmt(batch.symbols_count)}</td>
      <td className="py-1.5 pr-3 text-slate-300">{fmt(batch.inserted_rows)}</td>
      <td className="py-1.5 pr-3 text-slate-300">{fmt(batch.updated_rows)}</td>
      <td className="py-1.5 pr-3 text-amber-400">{fmt(batch.failed_symbols_count)}</td>
      <td className="py-1.5 text-slate-400">{fmt(batch.latency_p50_ms)}ms / {fmt(batch.latency_p95_ms)}ms</td>
    </tr>
  );
}
BatchRow.propTypes = {
  batch: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

// ─── Run detail drawer ────────────────────────────────────────────────────────

function RunDetailDrawer({ runId, onClose, t }) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await socApi.getBackfillRunDetail(runId);
      setRun(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/60 p-4">
      <div className="flex h-full w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-white">{t('soc.backfill.run_detail_title')}</p>
            <p className="font-mono text-xs text-slate-400 break-all">{runId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-400">{t('common.loading')}</p>}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {run && !loading && (
            <div className="space-y-4">
              {/* Run meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_status')}</p>
                  <p className={`mt-0.5 font-bold uppercase rounded px-2 py-0.5 inline-block ${runStatusTone(run.status)}`}>{run.status}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_mode')}</p>
                  <p className="mt-0.5 text-slate-200">{run.mode}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_planned')}</p>
                  <p className="mt-0.5 text-slate-200">{fmt(run.planned_symbols_count)}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_days')}</p>
                  <p className="mt-0.5 text-slate-200">{run.requested_days}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_inserted')}</p>
                  <p className="mt-0.5 text-blue-300 font-semibold">{fmt(run.inserted_rows)}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_failed_syms')}</p>
                  <p className="mt-0.5 text-rose-400 font-semibold">{fmt(run.failed_symbols_count)}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">{t('soc.backfill.col_duration')}</p>
                  <p className="mt-0.5 text-slate-200">{fmtSec(run.duration_seconds)}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-800/50 px-3 py-2">
                  <p className="text-slate-400">ETA</p>
                  <p className="mt-0.5 text-slate-200">{fmtSec(run.eta_seconds)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <p className="mb-1 text-xs text-slate-400">{t('soc.backfill.progress_label')}: {run.progress_pct ?? 0}%</p>
                <ProgressBar pct={run.progress_pct} status={run.status} />
              </div>

              {/* Error summary */}
              {run.error_summary && (
                <div className="rounded border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
                  <p className="mb-1 font-semibold">{t('soc.backfill.error_summary_title')}</p>
                  <pre className="whitespace-pre-wrap break-all">{run.error_summary}</pre>
                </div>
              )}

              {/* Batches */}
              {run.batches && run.batches.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-300">{t('soc.backfill.batches_title')} ({run.batches.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] uppercase text-slate-400">
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_provider')}</th>
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_state')}</th>
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_symbols')}</th>
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_inserted')}</th>
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_updated')}</th>
                          <th className="pb-1.5 pr-3">{t('soc.backfill.col_failed')}</th>
                          <th className="pb-1.5">p50/p95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.batches.map((b) => <BatchRow key={b.provider} batch={b} t={t} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
RunDetailDrawer.propTypes = {
  runId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function BackfillProgressPanel({ t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailRunId, setDetailRunId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await socApi.getBackfillRuns({ status: statusFilter || undefined, limit: 20 });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const STATUS_OPTIONS = ['', 'running', 'success', 'partial', 'failed', 'queued'];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-white">{t('soc.backfill.panel_title')}</h3>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? t(`soc.backfill.status_${s}`, { defaultValue: s }) : t('soc.backfill.filter_all_status')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {error && <p className="rounded border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {!loading && !error && data && (
        <>
          {data.results.length === 0 ? (
            <p className="text-sm text-slate-500">{t('soc.backfill.empty_state')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-700 bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">{t('soc.backfill.col_run_id')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_status')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_progress')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_inserted')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_failed_syms')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_duration')}</th>
                    <th className="px-3 py-2">{t('soc.backfill.col_started')}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((run) => (
                    <tr key={run.run_id} className="border-b border-slate-800 hover:bg-slate-800/30 align-top">
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs text-slate-200 max-w-[160px] truncate">{run.run_id}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{run.job_key || '—'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${runStatusTone(run.status)}`}>
                          {t(`soc.backfill.status_${run.status}`, { defaultValue: run.status })}
                        </span>
                      </td>
                      <td className="px-3 py-2 min-w-[100px]">
                        <p className="text-xs text-slate-300">{run.progress_pct ?? 0}%</p>
                        <ProgressBar pct={run.progress_pct} status={run.status} />
                        <p className="text-[10px] text-slate-500">{fmt(run.completed_symbols_count)}/{fmt(run.planned_symbols_count)}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-blue-300">{fmt(run.inserted_rows)}</td>
                      <td className={`px-3 py-2 text-xs font-semibold ${(run.failed_symbols_count || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {fmt(run.failed_symbols_count)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-300">{fmtSec(run.duration_seconds)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {run.started_at ? new Date(run.started_at).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDetailRunId(run.run_id)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          {t('soc.backfill.btn_detail')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {detailRunId && (
        <RunDetailDrawer
          runId={detailRunId}
          onClose={() => setDetailRunId(null)}
          t={t}
        />
      )}
    </div>
  );
}

BackfillProgressPanel.propTypes = {
  t: PropTypes.func.isRequired,
};
