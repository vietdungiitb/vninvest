import { useEffect, useState, useCallback, useMemo } from 'react';
import { defaultCoreApiAdapter } from '../adapters/coreApiAdapter.js';
import { useI18n } from '../context/LangContext.js';
import { useToast } from '../components/ShellToast.js';
import { useConfirm } from '../components/ConfirmModal.js';

interface CrawlJob {
  id: number;
  service_code: string;
  description: string;
  is_active: boolean;
}

interface CrawlRun {
  id: number;
  job: number;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface StatusPillProps {
  status: string;
  t: (key: string) => string;
}

function StatusPill({ status, t }: StatusPillProps) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: t('adminCrawl.stPending') },
    queued: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: t('adminCrawl.stQueued') },
    running: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: t('adminCrawl.stRunning') },
    success: { cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: t('adminCrawl.stSuccess') },
    failed: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: t('adminCrawl.stFailed') },
  };
  const entry = map[status?.toLowerCase()] || map.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

export default function AdminCrawlControlPage() {
  const api = defaultCoreApiAdapter as any;
  const { t, localeTag } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const activeRunByJobId = useMemo(() => {
    const activeStatuses = new Set(['queued', 'running']);
    return runs.reduce<Record<number, CrawlRun>>((acc, run) => {
      const normalizedStatus = String(run?.status || '').toLowerCase();
      if (!activeStatuses.has(normalizedStatus)) return acc;
      const existing = acc[run.job];
      if (!existing || new Date(run.created_at) > new Date(existing.created_at)) {
        acc[run.job] = run;
      }
      return acc;
    }, {});
  }, [runs]);

  const fetchAll = useCallback(async () => {
    try {
      const [jobsRes, runsRes] = await Promise.all([
        api.getAdminCrawlJobs(),
        api.getAdminCrawlRuns({ limit: 50, ordering: '-created_at' }),
      ]);
      setJobs(jobsRes?.results || jobsRes || []);
      setRuns(runsRes?.results || runsRes || []);
      setFetchError(false);
    } catch (err) {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchAll();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleRun = async (id: number) => {
    try {
      await api.runAdminCrawlJob(id);
      fetchAll();
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string };
      toast.error(err?.detail || err?.message || t('adminCrawl.runFailed'));
    }
  };

  const handleStop = async (id: number) => {
    const ok = await confirm({
      title: t('adminCrawl.stopTitle'),
      message: t('adminCrawl.stopMessage'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.stopAdminCrawlJob(id);
      fetchAll();
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string };
      toast.error(err?.detail || err?.message || t('adminCrawl.stopFailed'));
    }
  };

  if (loading && jobs.length === 0 && !fetchError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">{t('adminCrawl.loading')}</div>
      </div>
    );
  }

  if (fetchError && jobs.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{t('adminCrawl.eyebrow')}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{t('adminCrawl.title')}</h1>
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {t('adminCrawl.loadError')}
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); setFetchError(false); fetchAll(); }}
          className="mt-3 rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('adminCrawl.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{t('adminCrawl.eyebrow')}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{t('adminCrawl.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('adminCrawl.description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-auto min-h-[380px] lg:h-[500px]">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('adminCrawl.jobsTitle')}</h2>
          </div>
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 text-xs uppercase text-gray-500 dark:text-gray-400 pt-2">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('adminCrawl.thService')}</th>
                  <th className="px-4 py-3 font-medium">{t('adminCrawl.thStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('adminCrawl.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {jobs.map((job) => {
                  const activeRun = activeRunByJobId[job.id];
                  const activeRunStatus = String(activeRun?.status || '').toLowerCase();
                  const hasActiveRun = Boolean(activeRun);
                  const canRun = job.is_active && !hasActiveRun;
                  const canStop = hasActiveRun;

                  return (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white font-mono text-xs">{job.service_code}</div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-1">{job.description}</div>
                      </td>
                      <td className="px-4 py-4">
                        {hasActiveRun ? (
                          <span className={`font-semibold text-xs flex items-center gap-1.5 ${activeRunStatus === 'running' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeRunStatus === 'running' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                            {activeRunStatus === 'running' ? t('adminCrawl.rowRunning') : t('adminCrawl.rowQueued')}
                          </span>
                        ) : job.is_active ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            {t('adminCrawl.rowReady')}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-semibold text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            {t('adminCrawl.rowDisabled')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleRun(job.id)}
                          disabled={!canRun}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 dark:hover:bg-blue-400 mr-2 disabled:opacity-50 transition-colors"
                        >
                          {t('adminCrawl.runBtn')}
                        </button>
                        <button
                          onClick={() => handleStop(job.id)}
                          disabled={!canStop}
                          className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        >
                          {t('adminCrawl.stopBtn')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t('adminCrawl.emptyJobs')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-auto min-h-[380px] lg:h-[500px]">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('adminCrawl.runsTitle')}</h2>
            <button onClick={fetchAll} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors">
              {t('adminCrawl.syncBtn')}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 text-xs uppercase text-gray-500 dark:text-gray-400 pt-2">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('adminCrawl.thService')}</th>
                  <th className="px-4 py-3 font-medium">{t('adminCrawl.thStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('adminCrawl.thRunWindow')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {runs.map((run) => {
                  const started = run.started_at ? new Date(run.started_at).toLocaleTimeString(localeTag) : t('adminCrawl.waitingStart');
                  const job = jobs.find((j) => j.id === run.job);
                  const sCode = job ? job.service_code.replace(/_/g, '-') : `Job #${run.job}`;

                  return (
                    <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] truncate max-w-[120px]" title={sCode}>{sCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={run.status} t={t} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-900 dark:text-white font-medium">{started}</div>
                        {run.finished_at && run.started_at && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {t('adminCrawl.secondsShort', { v: ((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1) })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t('adminCrawl.emptyRuns')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
