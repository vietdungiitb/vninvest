/**
 * VnbrokerPanel.jsx — VNBroker configuration and health monitoring
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../api/socApi';
import { ConfigPreviewModal } from '../components/soc/ConfigPreviewModal';
import { WriteGuardBanner } from '../components/soc/WriteGuardBanner';

const VnbrokerPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newConfig, setNewConfig] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cfg, hth, mtr] = await Promise.all([
          socApi.getVnbrokerConfig(),
          socApi.getVnbrokerHealth(),
          socApi.getVnbrokerMetrics(),
        ]);
        setConfig(cfg.config || {});
        setHealth(hth);
        setMetrics(mtr);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApply = async () => {
    try {
      await socApi.applyVnbrokerConfig(newConfig);
      setConfig(newConfig);
      setShowPreview(false);
      setNewConfig(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.vnbroker.title')}</h2>
        <button
          onClick={() => setShowPreview(true)}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
        >
          {t('soc.actions.apply')}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config Section */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.config')}</h3>
        <pre className="bg-slate-800 p-4 rounded text-sm text-slate-300 overflow-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>

      {/* Health Section */}
      {health && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.health')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">{t('soc.health.status_healthy')}</p>
              <p className="text-2xl font-bold text-green-400">{health.provider_health?.healthy || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('soc.health.status_degraded')}</p>
              <p className="text-2xl font-bold text-yellow-400">{health.provider_health?.degraded || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('soc.health.status_critical')}</p>
              <p className="text-2xl font-bold text-red-400">{health.provider_health?.critical || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Section */}
      {metrics && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.metrics')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Throughput (req/s)</p>
              <p className="text-2xl font-bold text-blue-400">{metrics.throughput || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Error Rate</p>
              <p className="text-2xl font-bold text-red-400">{metrics.error_rate || 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <ConfigPreviewModal
        isOpen={showPreview}
        before={config}
        after={newConfig}
        onClose={() => setShowPreview(false)}
        onApply={handleApply}
        t={t}
      />
    </div>
  );
};

VnbrokerPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default VnbrokerPanel;
