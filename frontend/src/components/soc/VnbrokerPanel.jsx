/**
 * VnbrokerPanel.jsx — VNBroker configuration and health monitoring (structured form)
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const PROVIDERS = ['vci', 'tcbs', 'ssi', 'bsc', 'dnse'];

const buildChangeSummary = (currentConfig, nextConfig) => {
  const keys = new Set([...Object.keys(currentConfig || {}), ...Object.keys(nextConfig || {})]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(currentConfig?.[key]) !== JSON.stringify(nextConfig?.[key]));
};

const VnbrokerPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState({});
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewWarnings, setPreviewWarnings] = useState([]);
  const [previewErrors, setPreviewErrors] = useState(null);
  const [changeSummary, setChangeSummary] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [benchmarkProvider, setBenchmarkProvider] = useState('vci');
  const [benchmarkStatus, setBenchmarkStatus] = useState(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cfg, hth, mtr, pvd] = await Promise.all([
        socApi.getVnbrokerConfig(),
        socApi.getVnbrokerHealth(),
        socApi.getVnbrokerMetrics(),
        socApi.getVnbrokerProviders().catch(() => ({ results: [] })),
      ]);
      const currentConfig = cfg.config || {};
      setConfig(currentConfig);
      setDraft(JSON.parse(JSON.stringify(currentConfig)));
      setHealth(hth);
      setMetrics(mtr);
      setProviders(pvd.results || pvd.providers || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
  const setTimeoutField = (key, value) => setDraft((prev) => ({
    ...prev,
    timeout: { ...(prev.timeout || {}), [key]: value === '' ? '' : Number(value) },
  }));

  const handleOpenPreview = async () => {
    const warnings = [];
    if (draft.preferred_provider !== config?.preferred_provider) {
      warnings.push(t('soc.preview.provider_change_warning'));
    }
    try {
      const preview = await socApi.previewVnbrokerConfig(draft);
      setPreviewWarnings(warnings);
      setPreviewErrors(preview.valid === false ? { config_payload: preview.errors || [] } : null);
      setChangeSummary(buildChangeSummary(config || {}, draft));
      setShowPreview(true);
      setError(null);
    } catch (err) {
      setError(err.message || t('soc.dataops.preview_failed'));
    }
  };

  const handleApply = async () => {
    try {
      setIsSubmitting(true);
      await socApi.applyVnbrokerConfig(draft);
      setConfig(JSON.parse(JSON.stringify(draft)));
      setShowPreview(false);
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

  const handleBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkStatus(null);
    try {
      const result = await socApi.previewVnbrokerConfig({ preferred_provider: benchmarkProvider });
      setBenchmarkStatus(JSON.stringify(result?.impact || result || {}, null, 2));
    } catch (err) {
      setBenchmarkStatus(err.message);
    } finally {
      setIsBenchmarking(false);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  const timeoutCfg = draft.timeout || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.vnbroker.title')}</h2>
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

      {/* Config Form */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.config')}</h3>

        {/* Core fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.preferred_provider')}</label>
            <select
              value={draft.preferred_provider || ''}
              onChange={(e) => setField('preferred_provider', e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {PROVIDERS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.max_retries')}</label>
            <input
              type="number"
              value={draft.max_retries ?? ''}
              onChange={(e) => setField('max_retries', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.retry_delay_seconds')}</label>
            <input
              type="number"
              step="0.1"
              value={draft.retry_delay_seconds ?? ''}
              onChange={(e) => setField('retry_delay_seconds', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.requests_per_minute')}</label>
            <input
              type="number"
              value={draft.requests_per_minute ?? ''}
              onChange={(e) => setField('requests_per_minute', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.burst_limit')}</label>
            <input
              type="number"
              value={draft.burst_limit ?? ''}
              onChange={(e) => setField('burst_limit', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('soc.vnbroker.circuit_breaker_threshold')}</label>
            <input
              type="number"
              value={draft.circuit_breaker_threshold ?? ''}
              onChange={(e) => setField('circuit_breaker_threshold', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Timeout sub-section */}
        <h4 className="text-sm font-semibold text-slate-300 mb-3">{t('soc.vnbroker.timeout_section')}</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[['connect', t('soc.vnbroker.timeout_connect')], ['read', t('soc.vnbroker.timeout_read')], ['write', t('soc.vnbroker.timeout_write')], ['pool', t('soc.vnbroker.timeout_pool')]].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label} (s)</label>
              <input
                type="number"
                step="0.5"
                value={timeoutCfg[key] ?? ''}
                onChange={(e) => setTimeoutField(key, e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Providers status */}
      {providers.length > 0 && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.providers_status')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providers.map((pv) => (
              <div key={pv.id || pv.name} className="bg-slate-800 p-3 rounded border border-slate-700">
                <p className="font-semibold text-slate-100 text-sm">{(pv.id || pv.name || '').toUpperCase()}</p>
                <p className={`text-xs font-medium mt-0.5 ${pv.configured ? 'text-green-400' : 'text-slate-500'}`}>
                  {pv.configured ? t('soc.vnbroker.provider_configured') : t('soc.vnbroker.provider_not_configured')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Benchmark Tool */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.benchmark_title')}</h3>
        <div className="flex gap-3 mb-3">
          <select
            value={benchmarkProvider}
            onChange={(e) => setBenchmarkProvider(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {PROVIDERS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <button
            onClick={handleBenchmark}
            disabled={isBenchmarking}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded text-white text-sm"
          >
            {isBenchmarking ? t('soc.vnbroker.benchmark_running') : t('soc.vnbroker.benchmark_run')}
          </button>
        </div>
        {benchmarkStatus && (
          <pre className="bg-slate-800 p-3 rounded text-xs text-slate-300 overflow-auto max-h-48">
            {benchmarkStatus}
          </pre>
        )}
      </div>

      {/* Preview Modal */}
      <ConfigPreviewModal
        isOpen={showPreview}
        before={config}
        after={draft}
        onClose={() => {
          setShowPreview(false);
          setPreviewWarnings([]);
          setPreviewErrors(null);
        }}
        onConfirm={handleApply}
        changeSummary={changeSummary}
        impactWarnings={previewWarnings}
        validationErrors={previewErrors}
        domain="vnbroker"
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
