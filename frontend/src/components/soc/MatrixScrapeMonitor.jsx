/**
 * MatrixScrapeMonitor — Heatmap visualization of symbol group × provider scrape status
 * Real-time polling để theo dõi tiến độ scrape matrix
 */
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { socApi } from '../../api/socApi';

export const MatrixScrapeMonitor = ({ cycleId = '', pollIntervalMs = 5000, onCycleComplete, t }) => {
  const [matrix, setMatrix] = useState([]);
  const [stats, setStats] = useState({ total: 0, done: 0, failed: 0, pending: 0, claimed: 0, working: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const pollMatrix = async () => {
      try {
        const data = await socApi.getMatrixMonitor(cycleId);
        if (!isMounted) {
          return;
        }

        const cells = data.cells || [];
        setMatrix(cells);
        setStats({
          total: cells.length,
          done: data.cells_summary?.done || 0,
          failed: data.cells_summary?.failed || 0,
          pending: data.cells_summary?.pending || 0,
          claimed: data.cells_summary?.claimed || 0,
          working: data.cells_summary?.working || 0,
        });
        setError(null);
        setLoading(false);

        if (onCycleComplete && ['completed', 'aborted'].includes(data.status)) {
          onCycleComplete(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Matrix poll error:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    };

    pollMatrix();
    const interval = setInterval(pollMatrix, pollIntervalMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cycleId, onCycleComplete, pollIntervalMs]);

  const getStatusColor = (status) => {
    const colors = {
      done: 'bg-emerald-600 text-white',
      failed: 'bg-rose-600 text-white',
      claimed: 'bg-sky-600 text-white',
      working: 'bg-amber-500 text-slate-950',
      pending: 'bg-slate-700 text-slate-100',
      skipped: 'bg-slate-600 text-white',
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  const providerIds = Array.from(new Set(matrix.map((cell) => cell.provider))).sort();
  const symbolGroupIds = Array.from(new Set(matrix.map((cell) => cell.group || cell.symbol_group_id))).sort();
  const cellsByKey = new Map(
    matrix.map((cell) => [`${cell.group || cell.symbol_group_id}::${cell.provider}`, cell])
  );

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <p className="text-slate-400">{t('soc.matrix.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 rounded-lg border border-red-700">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
        <h3 className="text-lg font-bold text-white">{t('soc.matrix.monitor_title')}</h3>
        <p className="text-slate-300">{t('soc.matrix.idle_hint')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 space-y-4">
      <h3 className="text-lg font-bold text-white">{t('soc.matrix.monitor_title')}</h3>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-xs text-slate-400">{t('soc.matrix.total')}</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-green-900 p-3 rounded">
          <p className="text-xs text-green-300">{t('soc.matrix.status_done')}</p>
          <p className="text-2xl font-bold text-green-300">{stats.done}</p>
        </div>
        <div className="bg-red-900 p-3 rounded">
          <p className="text-xs text-red-300">{t('soc.matrix.status_failed')}</p>
          <p className="text-2xl font-bold text-red-300">{stats.failed}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <p className="text-xs text-gray-300">{t('soc.matrix.status_pending')}</p>
          <p className="text-2xl font-bold text-gray-300">{stats.pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bg-sky-900 p-3 rounded">
          <p className="text-xs text-sky-300">{t('soc.matrix.status_claimed')}</p>
          <p className="text-xl font-bold text-sky-200">{stats.claimed}</p>
        </div>
        <div className="bg-amber-900 p-3 rounded">
          <p className="text-xs text-amber-300">{t('soc.matrix.status_working')}</p>
          <p className="text-xl font-bold text-amber-200">{stats.working}</p>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-auto">
        <table className="min-w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-900 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('soc.matrix.symbol_group')}
              </th>
              {providerIds.map((providerId) => (
                <th
                  key={providerId}
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {providerId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbolGroupIds.map((groupId) => (
              <tr key={groupId}>
                <th className="sticky left-0 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-200">
                  {groupId}
                </th>
                {providerIds.map((providerId) => {
                  const cell = cellsByKey.get(`${groupId}::${providerId}`);
                  const status = cell?.status || 'pending';
                  return (
                    <td key={`${groupId}-${providerId}`} className="px-1 py-1">
                      <div
                        className={`min-w-[88px] rounded px-2 py-3 text-center text-xs font-mono ${getStatusColor(status)}`}
                        title={`${groupId} × ${providerId}: ${status}`}
                      >
                        <div className="truncate">{status}</div>
                        <div className="mt-1 truncate text-[10px] opacity-80">{providerId}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
        />
      </div>

      <p className="text-sm text-slate-400 text-center">
        {stats.done} {t('soc.matrix.of')} {stats.total} {t('soc.matrix.complete')}
      </p>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
MatrixScrapeMonitor.propTypes = {
  cycleId: PropTypes.string,
  pollIntervalMs: PropTypes.number,
  onCycleComplete: PropTypes.func,
  t: PropTypes.func.isRequired,
};
