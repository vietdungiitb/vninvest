import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  getAdminCrawlJobs,
  runAdminCrawlJob,
  stopAdminCrawlJob,
  getAdminCrawlRuns,
} from '../api/client';
import { useI18n } from '../context/LangContext';

function StatusPill({ status }) {
  const map = {
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    queued: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  const cls = map[status?.toLowerCase()] || map.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {status?.toUpperCase() || 'KHÔNG RÕ'}
    </span>
  );
}

export default function AdminCrawlControl() {
  const { t } = useI18n();
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeRunByJobId = useMemo(() => {
    const activeStatuses = new Set(['queued', 'running']);
    return runs.reduce((acc, run) => {
      const normalizedStatus = String(run?.status || '').toLowerCase();
      if (!activeStatuses.has(normalizedStatus)) {
        return acc;
      }
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
        getAdminCrawlJobs(),
        getAdminCrawlRuns({ limit: 50, ordering: '-created_at' }),
      ]);
      setJobs(jobsRes.data?.results || jobsRes.data || []);
      setRuns(runsRes.data?.results || runsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000); // Poll every 5s for realtime UX
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleRun = async (id) => {
    try {
      await runAdminCrawlJob(id);
      fetchAll();
    } catch (e) {
      alert(e?.response?.data?.error || 'Lỗi: Không thể khởi chạy job');
    }
  };

  const handleStop = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn ép dừng (hard stop) job này?')) return;
    try {
      await stopAdminCrawlJob(id);
      fetchAll();
    } catch (e) {
      alert(e?.response?.data?.error || 'Lỗi: Không thể dừng job. Có thể job không hoạt động?');
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Đang tải Admin Control Center...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trung tâm Điều khiển Dịch vụ Nền</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Quản lý tập trung các tiến trình ngầm (Pilot Phase 0)</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Jobs Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[500px]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 shadow-sm border-b dark:border-gray-700 pb-2">Danh sách Pilot Jobs</h2>
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 text-xs uppercase text-gray-500 dark:text-gray-400 pt-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Mã Dịch vụ (Service Code)</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-right">Tác vụ</th>
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
                            {activeRunStatus === 'running' ? 'Đang chạy' : 'Đang chờ chạy'}
                          </span>
                        ) : job.is_active ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Sẵn sàng
                          </span>
                        ) : (
                          <span className="text-gray-400 font-semibold text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            Vô hiệu hóa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleRun(job.id)}
                          disabled={!canRun}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 dark:hover:bg-blue-400 mr-2 disabled:opacity-50 transition-colors"
                        >
                          RUN
                        </button>
                        <button
                          onClick={() => handleStop(job.id)}
                          disabled={!canStop}
                          className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        >
                          STOP
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      Không có pilot jobs nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Runs History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lịch sử Chạy ngầm (Artifacts)</h2>
            <button onClick={fetchAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Đồng bộ tay</button>
          </div>
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 text-xs uppercase text-gray-500 dark:text-gray-400 pt-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Job ID / Tên</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-right">Khung giờ chạy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {runs.map((run) => {
                  const started = run.started_at ? new Date(run.started_at).toLocaleTimeString() : 'Đang đợi (Queued)...';
                  // Get service code from jobs list
                  const job = jobs.find((j) => j.id === run.job);
                  const sCode = job ? job.service_code.replace(/_/g, '-') : `Job #${run.job}`;
                  
                  return (
                    <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[11px] truncate max-w-[120px]" title={sCode}>{sCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-900 dark:text-white font-medium">{started}</div>
                        {run.finished_at && run.started_at && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {((new Date(run.finished_at) - new Date(run.started_at)) / 1000).toFixed(1)}s
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      Chưa có lịch sử chạy ngầm.
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
