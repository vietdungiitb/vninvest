/**
 * MatrixScrapeMonitor — Heatmap visualization of symbol group × provider scrape status
 * Real-time polling để theo dõi tiến độ scrape matrix
 */
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

export const MatrixScrapeMonitor = ({ cycleId, t }) => {
  const [matrix, setMatrix] = useState([]);
  const [stats, setStats] = useState({ total: 0, done: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pollMatrix = async () => {
      try {
        // Fetch từ /api/soc/matrix/cycle/{cycleId}/
        const resp = await fetch(`/api/soc/matrix/cycle/${cycleId}/`);
        if (!resp.ok) throw new Error('Failed to fetch matrix');
        const data = await resp.json();
        setMatrix(data.cells || []);
        
        // Calculate stats
        const total = data.cells?.length || 0;
        const done = data.cells?.filter(c => c.status === 'done').length || 0;
        const failed = data.cells?.filter(c => c.status === 'failed').length || 0;
        const pending = data.cells?.filter(c => c.status === 'pending').length || 0;
        setStats({ total, done, failed, pending });
        setLoading(false);
      } catch (err) {
        console.error('Matrix poll error:', err);
        setLoading(false);
      }
    };

    pollMatrix();
    const interval = setInterval(pollMatrix, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, [cycleId]);

  const getStatusColor = (status) => {
    const colors = {
      done: 'bg-green-600 text-white',
      failed: 'bg-red-600 text-white',
      pending: 'bg-gray-400 text-gray-900',
      skipped: 'bg-blue-600 text-white',
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <p className="text-slate-400">{t('soc.matrix.loading')}</p>
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

      {/* Matrix Grid */}
      <div className="overflow-auto">
        <div className="inline-grid gap-1 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
          {matrix.map((cell, idx) => (
            <div
              key={idx}
              className={`p-2 rounded text-center text-xs font-mono ${getStatusColor(cell.status)}`}
              title={`${cell.group} × ${cell.provider}: ${cell.status}`}
            >
              <div className="truncate">{cell.group}</div>
              <div className="truncate text-opacity-80">{cell.provider}</div>
            </div>
          ))}
        </div>
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

MatrixScrapeMonitor.propTypes = {
  cycleId: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
};
