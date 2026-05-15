/**
 * VnbrokerPanel.jsx — VNBroker configuration and health monitoring
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const buildChangeSummary = (currentConfig, nextConfig) => {
  const keys = new Set([...Object.keys(currentConfig || {}), ...Object.keys(nextConfig || {})]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(currentConfig?.[key]) !== JSON.stringify(nextConfig?.[key]))
    .map((key) => key);
};

const VnbrokerPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [draftConfigText, setDraftConfigText] = useState('');
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newConfig, setNewConfig] = useState(null);
  const [previewWarnings, setPreviewWarnings] = useState([]);
  const [previewErrors, setPreviewErrors] = useState(null);
  const [changeSummary, setChangeSummary] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cfg, hth, mtr] = await Promise.all([
          socApi.getVnbrokerConfig(),
          socApi.getVnbrokerHealth(),
          socApi.getVnbrokerMetrics(),
        ]);
        const currentConfig = cfg.config || {};
        setConfig(currentConfig);
        setDraftConfigText(JSON.stringify(currentConfig, null, 2));
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

  const handleOpenPreview = async () => {
    let parsedConfig;

    try {
      parsedConfig = JSON.parse(draftConfigText || '{}');
    } catch {
      setError(t('soc.dataops.invalid_json'));
      return;
    }

    try {
      const preview = await socApi.previewVnbrokerConfig(parsedConfig);
      const warnings = [];
      if (preview.impact?.providers_changed) {
        warnings.push(t('soc.preview.provider_change_warning'));
      }
      if (preview.impact?.timeout_changed) {
        warnings.push(t('soc.preview.timeout_change_warning'));
      }

      setNewConfig(preview.config_payload || parsedConfig);
      setPreviewWarnings(warnings);
      setPreviewErrors(preview.valid ? null : { config_payload: preview.errors || [] });
      setChangeSummary(buildChangeSummary(config || {}, preview.config_payload || parsedConfig));
      setShowPreview(true);
      setError(null);
    } catch (err) {
      setError(err.message || t('soc.dataops.preview_failed'));
    }
  };

  const handleApply = async () => {
    if (!newConfig) {
      return;
    }

    try {
      setIsSubmitting(true);
      await socApi.applyVnbrokerConfig(newConfig);
      setConfig(newConfig);
      setDraftConfigText(JSON.stringify(newConfig, null, 2));
      setShowPreview(false);
      setNewConfig(null);
      setPreviewWarnings([]);
      setPreviewErrors(null);
      setChangeSummary([]);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.dataops.title')}</h2>
        <button
          onClick={handleOpenPreview}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
        >
          {t('soc.actions.preview')}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config Section */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.dataops.editor_label')}</h3>
        <textarea
          value={draftConfigText}
          onChange={(event) => setDraftConfigText(event.target.value)}
          className="min-h-[260px] w-full rounded border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200"
          spellCheck={false}
        />
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
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.dataops.metrics')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">{t('soc.dataops.throughput')}</p>
              <p className="text-2xl font-bold text-blue-400">{metrics.throughput || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('soc.dataops.error_rate')}</p>
              <p className="text-2xl font-bold text-red-400">{metrics.error_rate || 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <ConfigPreviewModal
        isOpen={showPreview}
        before={config}
        after={newConfig || {}}
        onClose={() => {
          setShowPreview(false);
          setPreviewWarnings([]);
          setPreviewErrors(null);
        }}
        onConfirm={handleApply}
        changeSummary={changeSummary}
        impactWarnings={previewWarnings}
        validationErrors={previewErrors}
        domain="dataops"
        isSubmitting={isSubmitting}
        t={t}
      />
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
VnbrokerPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default VnbrokerPanel;
