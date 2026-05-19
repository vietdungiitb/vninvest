import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { socApi } from '../../api/socApi';

// ─── Status badge ────────────────────────────────────────────────────────────
const STATUS_TONE = {
  running:   'bg-emerald-700 text-emerald-100',
  enabled:   'bg-blue-800 text-blue-100',
  idle:      'bg-slate-700 text-slate-200',
  disabled:  'bg-slate-800 text-slate-400',
  degraded:  'bg-amber-800 text-amber-100',
  stale:     'bg-rose-900 text-rose-200',
  unknown:   'bg-slate-700 text-slate-400',
};
const statusTone = (s) => STATUS_TONE[s] || STATUS_TONE.unknown;

const FRESHNESS_TONE = {
  fresh:   'text-emerald-400',
  warm:    'text-blue-300',
  stale:   'text-amber-400',
  missing: 'text-slate-500',
};
const freshTone = (f) => FRESHNESS_TONE[f] || 'text-slate-400';

// ─── Lag formatter ───────────────────────────────────────────────────────────
function formatLag(seconds) {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p ${s % 60}s`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem > 0 ? `${h}h ${rem}p` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} ngày ${rh}h` : `${d} ngày`;
}

// ─── Confirm action modal ────────────────────────────────────────────────────
const RISKY_ACTIONS = new Set(['disable', 'abort']);

function ActionConfirmModal({ job, action, onConfirm, onCancel, t }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold text-white">
          {t('soc.scheduler.confirm_title')}
        </h3>
        <p className="mb-4 text-sm text-slate-300">
          {t('soc.scheduler.confirm_action')}: <span className="font-semibold text-amber-300">{action}</span>
          {' — '}<span className="font-mono text-xs text-slate-400">{job.job_key}</span>
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t('soc.scheduler.reason_label')}
        </label>
        <textarea
          className="mb-4 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={2}
          placeholder={t('soc.scheduler.reason_placeholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="rounded bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('soc.scheduler.confirm_proceed')}
          </button>
        </div>
      </div>
    </div>
  );
}
ActionConfirmModal.propTypes = {
  job: PropTypes.object.isRequired,
  action: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

// ─── Job history drawer ───────────────────────────────────────────────────────
function JobHistoryDrawer({ jobKey, onClose, t }) {
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const data = await socApi.getSchedulerJobHistory(jobKey, p, 15);
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobKey]);

  useEffect(() => { load(page); }, [load, page]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/50 p-4">
      <div className="flex h-full w-full max-w-xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-white">{t('soc.scheduler.history_drawer_title')}</p>
            <p className="font-mono text-xs text-slate-400">{jobKey}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-400">{t('common.loading')}</p>}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {history && !loading && (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {t('soc.scheduler.history_count', { count: history.count })}
              </p>
              {history.results.length === 0 ? (
                <p className="text-sm text-slate-500">{t('soc.scheduler.history_empty')}</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="pb-2 pr-3">{t('soc.scheduler.history_col_status')}</th>
                      <th className="pb-2 pr-3">{t('soc.scheduler.history_col_started')}</th>
                      <th className="pb-2 pr-3">{t('soc.scheduler.history_col_duration')}</th>
                      <th className="pb-2">{t('soc.scheduler.history_col_task_id')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.results.map((run) => (
                      <tr key={run.id} className="border-b border-slate-800 align-top">
                        <td className="py-2 pr-3">
                          <span className={`rounded px-2 py-0.5 font-semibold uppercase ${statusTone(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-300">{run.started_at || '—'}</td>
                        <td className="py-2 pr-3 text-slate-300">
                          {run.duration_seconds != null ? `${run.duration_seconds}s` : '—'}
                        </td>
                        <td className="py-2 font-mono text-slate-500 truncate max-w-[120px]">
                          {run.celery_task_id || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {t('soc.dataops.run_history_page')} {page}/{history.total_pages || 1}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!history.previous}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {t('soc.dataops.run_history_previous')}
                  </button>
                  <button
                    type="button"
                    disabled={!history.next}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {t('soc.dataops.run_history_next')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
JobHistoryDrawer.propTypes = {
  jobKey: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

// ─── Action row for a single job ─────────────────────────────────────────────
function JobActionButtons({ job, onAction, t }) {
  const caps = job.capabilities || [];
  const isRunning = job.is_inflight;
  const isDisabled = !job.enabled;

  const btn = (action, label, tone) => {
    const supported = caps.includes(action);
    const lockedByRunning = isRunning && action === 'run_now';
    return (
      <button
        key={action}
        type="button"
        disabled={!supported || lockedByRunning}
        onClick={() => onAction(job, action)}
        className={`rounded px-2 py-1 text-xs font-semibold transition ${tone} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-1">
      {btn('enable', t('soc.scheduler.action_enable'), 'bg-blue-800 text-blue-100 hover:bg-blue-700')}
      {btn('disable', t('soc.scheduler.action_disable'), 'bg-slate-700 text-slate-200 hover:bg-slate-600')}
      {btn('run_now', t('soc.scheduler.action_run_now'), 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700')}
      {btn('abort', t('soc.scheduler.action_abort'), 'bg-rose-900 text-rose-100 hover:bg-rose-800')}
    </div>
  );
}
JobActionButtons.propTypes = {
  job: PropTypes.object.isRequired,
  onAction: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

// ─── Health summary strip ─────────────────────────────────────────────────────
function SchedulerHealthStrip({ health, t }) {
  if (!health) return null;
  return (
    <div className="flex flex-wrap gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-5 py-3 text-xs">
      <span className={`font-bold uppercase ${health.overall_health === 'healthy' ? 'text-emerald-400' : health.overall_health === 'degraded' ? 'text-amber-400' : 'text-rose-400'}`}>
        {health.overall_health}
      </span>
      <span className="text-slate-400">{t('soc.scheduler.health_total')}: <span className="text-white">{health.jobs_total}</span></span>
      <span className="text-slate-400">{t('soc.scheduler.health_enabled')}: <span className="text-blue-300">{health.enabled_count}</span></span>
      <span className="text-slate-400">{t('soc.scheduler.health_degraded')}: <span className="text-amber-400">{health.degraded_count}</span></span>
      <span className="text-slate-400">{t('soc.scheduler.health_inflight')}: <span className="text-emerald-400">{health.by_status?.running || 0}</span></span>
      <span className="text-slate-400">{t('soc.scheduler.health_stale')}: <span className={health.by_freshness?.stale ? 'text-rose-400' : 'text-slate-300'}>{health.by_freshness?.stale || 0}</span></span>
    </div>
  );
}
SchedulerHealthStrip.propTypes = {
  health: PropTypes.object,
  t: PropTypes.func.isRequired,
};

// ─── Main SchedulerBoard ──────────────────────────────────────────────────────
const DOMAIN_FILTER_OPTIONS = ['all', 'market_data', 'signals', 'whale', 'platform', 'maintenance'];

export default function SchedulerBoard({ t, domainFilter: domainFilterProp }) {
  const embedded = domainFilterProp != null;
  const [plan, setPlan] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [domainFilter, setDomainFilter] = useState(domainFilterProp ?? 'all');
  const [confirmModal, setConfirmModal] = useState(null); // { job, action }
  const [historyJob, setHistoryJob] = useState(null);
  const [actionBanner, setActionBanner] = useState(null); // { type: 'success'|'error', msg, requestId }
  const bannerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, healthData] = await Promise.all([
        socApi.getSchedulerPlan(),
        socApi.getSchedulerHealth(),
      ]);
      setPlan(planData);
      setHealth(healthData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const executeActionRef = useRef(null);

  const handleAction = useCallback((job, action) => {
    if (RISKY_ACTIONS.has(action)) {
      setConfirmModal({ job, action });
    } else {
      executeActionRef.current?.(job.job_key, action, '');
    }
  }, []);

  const executeAction = useCallback(async (jobKey, action, reason) => {
    setConfirmModal(null);
    try {
      const result = await socApi.postSchedulerJobAction(jobKey, action, reason);
      setActionBanner({
        type: 'success',
        msg: result.message || t('soc.scheduler.action_success'),
        requestId: result.request_id,
      });
      load();
    } catch (err) {
      setActionBanner({
        type: 'error',
        msg: err.message || t('soc.scheduler.action_error'),
      });
    }
    setTimeout(() => setActionBanner(null), 6000);
  }, [load, t]);

  // bind ref so handleAction can call without stale closure
  executeActionRef.current = executeAction;

  const activeDomainFilter = embedded ? domainFilterProp : domainFilter;
  const filteredJobs = plan?.jobs?.filter(
    (j) => activeDomainFilter === 'all' || j.domain === activeDomainFilter,
  ) ?? [];

  return (
    <div className="space-y-4">
      {/* Health strip — hidden in embedded mode */}
      {!embedded && <SchedulerHealthStrip health={health} t={t} />}

      {/* Action banner */}
      {actionBanner && (
        <div
          ref={bannerRef}
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            actionBanner.type === 'success'
              ? 'border-emerald-700 bg-emerald-950/60 text-emerald-200'
              : 'border-rose-700 bg-rose-950/60 text-rose-200'
          }`}
        >
          {actionBanner.msg}
          {actionBanner.requestId && (
            <span className="ml-3 font-mono text-xs opacity-70">{actionBanner.requestId}</span>
          )}
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">{t('soc.scheduler.board_title')}</h3>
          {plan && (
            <p className="text-xs text-slate-400">
              {t('soc.scheduler.board_generated_at')}: {new Date(plan.generated_at).toLocaleString('vi-VN')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Domain filter — hidden in embedded mode */}
          {!embedded && (
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            {DOMAIN_FILTER_OPTIONS.map((d) => (
              <option key={d} value={d}>{d === 'all' ? t('soc.scheduler.filter_all_domains') : d}</option>
            ))}
          </select>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-rose-700 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-slate-700 bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('soc.scheduler.col_job')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_domain')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_status')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_freshness')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_next_run')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_lag')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_actions')}</th>
                <th className="px-4 py-3">{t('soc.scheduler.col_history')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {t('soc.scheduler.empty_state')}
                  </td>
                </tr>
              )}
              {filteredJobs.map((job) => (
                <tr key={job.job_key} className="border-b border-slate-800 hover:bg-slate-800/30 align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-slate-200">{job.job_key}</p>
                    {job.display_name && (
                      <p className="mt-0.5 text-[10px] text-slate-500">{job.display_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{job.domain}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${statusTone(job.status)}`}>
                      {t(`soc.scheduler.status_${job.status}`, { defaultValue: job.status })}
                    </span>
                    {job.is_inflight && (
                      <span className="ml-1 inline-block animate-pulse rounded bg-emerald-700/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        live
                      </span>
                    )}
                    {job.is_possibly_stuck && (
                      <span
                        title={t('soc.scheduler.tooltip_stuck')}
                        className="ml-1 inline-block rounded bg-amber-700/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200"
                      >
                        {t('soc.scheduler.badge_stuck')}
                      </span>
                    )}
                    {job.is_possibly_stuck && job.inflight_elapsed_seconds != null && (
                      <p className="mt-0.5 text-[9px] text-amber-400">
                        {`${Math.floor(job.inflight_elapsed_seconds / 3600)}h${Math.floor((job.inflight_elapsed_seconds % 3600) / 60)}m`}
                      </p>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-xs font-semibold ${freshTone(job.freshness_state)}`}>
                    {job.freshness_state ? t(`soc.scheduler.freshness_${job.freshness_state}`, { defaultValue: job.freshness_state }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {job.next_run_at ? new Date(job.next_run_at).toLocaleTimeString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {formatLag(job.lag_seconds)}
                  </td>
                  <td className="px-4 py-3">
                    <JobActionButtons job={job} onAction={handleAction} t={t} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setHistoryJob(job.job_key)}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      {t('soc.scheduler.view_history')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <ActionConfirmModal
          job={confirmModal.job}
          action={confirmModal.action}
          onConfirm={(reason) => executeAction(confirmModal.job.job_key, confirmModal.action, reason)}
          onCancel={() => setConfirmModal(null)}
          t={t}
        />
      )}

      {/* History drawer */}
      {historyJob && (
        <JobHistoryDrawer jobKey={historyJob} onClose={() => setHistoryJob(null)} t={t} />
      )}
    </div>
  );
}

SchedulerBoard.propTypes = {
  t: PropTypes.func.isRequired,
  domainFilter: PropTypes.string,
};

SchedulerBoard.defaultProps = {
  domainFilter: undefined,
};
