/**
 * VnbrokerPanel.jsx — VNBroker configuration and health monitoring (structured form)
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { getDNSEConfig } from '../../api/client';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const DEFAULT_PROVIDER_OPTIONS = ['vci', 'kbs', 'dnse'];

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
  const [dnseCredentialConfigured, setDnseCredentialConfigured] = useState(false);
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
  const [isResetting, setIsResetting] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [cfg, hth, mtr, pvd, dnseCfg] = await Promise.all([
        socApi.getVnbrokerConfig(),
        socApi.getVnbrokerHealth(),
        socApi.getVnbrokerMetrics(),
        socApi.getVnbrokerProviders().catch(() => ({ results: [] })),
        getDNSEConfig().catch(() => ({ is_configured: false })),
      ]);
      const currentConfig = cfg.config || {};
      const providerCatalog = pvd.results || pvd.providers || [];
      const providerOptions = providerCatalog
        .map((provider) => String(provider?.provider || provider?.id || provider?.name || '').trim().toLowerCase())
        .filter(Boolean);
      const selectableProviders = providerOptions.length > 0 ? providerOptions : DEFAULT_PROVIDER_OPTIONS;
      const preferredProvider = String(currentConfig.preferred_provider || '').trim().toLowerCase();

      setConfig(currentConfig);
      setDraft(JSON.parse(JSON.stringify(currentConfig)));
      setHealth(hth);
      setMetrics(mtr);
      setProviders(providerCatalog);
      setBenchmarkProvider(
        selectableProviders.includes(preferredProvider)
          ? preferredProvider
          : selectableProviders[0],
      );
      setDnseCredentialConfigured(Boolean(dnseCfg?.is_configured));
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

  const setPerProviderField = (providerId, key, value) => setDraft((prev) => {
    const perProviderConfig = prev.per_provider_config || {};
    const providerConfig = perProviderConfig[providerId] || {};
    const updated = { ...providerConfig, [key]: value === '' ? null : value };
    return {
      ...prev,
      per_provider_config: {
        ...perProviderConfig,
        [providerId]: updated,
      },
    };
  });

  const setPerProviderTimeout = (providerId, timeoutKey, value) => setDraft((prev) => {
    const perProviderConfig = prev.per_provider_config || {};
    const providerConfig = perProviderConfig[providerId] || {};
    const timeout = providerConfig.timeout || {};
    const updated = {
      ...providerConfig,
      timeout: { ...timeout, [timeoutKey]: value === '' ? '' : Number(value) },
    };
    return {
      ...prev,
      per_provider_config: {
        ...perProviderConfig,
        [providerId]: updated,
      },
    };
  });

  const toggleProviderExpand = (providerId) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

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
      const result = await socApi.runVnbrokerBenchmark({
        provider: benchmarkProvider,
        duration_seconds: 30,
      });
      setBenchmarkStatus(JSON.stringify(result?.report || result || {}, null, 2));
    } catch (err) {
      setBenchmarkStatus(err.message);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm(t('soc.vnbroker.reset_confirm'))) return;
    setIsResetting(true);
    try {
      await socApi.applyVnbrokerConfig({});
      await fetchData();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  const providerOptions = providers
    .map((provider) => String(provider?.provider || provider?.id || provider?.name || '').trim().toLowerCase())
    .filter((providerId, index, allProviderIds) => providerId && allProviderIds.indexOf(providerId) === index);
  const selectableProviders = providerOptions.length > 0 ? providerOptions : DEFAULT_PROVIDER_OPTIONS;
  const timeoutCfg = draft.timeout || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.vnbroker.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleOpenPreview}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
          >
            {t('soc.actions.preview')}
          </button>
          <button
            onClick={handleResetToDefaults}
            disabled={isResetting}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded text-white text-sm"
          >
            {t('soc.vnbroker.reset_to_defaults')}
          </button>
        </div>
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
              {selectableProviders.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
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

        {/* Per-Provider Configuration Section */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">{t('soc.vnbroker.per_provider_config_title')}</h4>
          <p className="text-xs text-slate-400 mb-4">{t('soc.vnbroker.per_provider_config_hint')}</p>
          <div className="space-y-3">
            {selectableProviders.map((providerId) => {
              const isExpanded = expandedProviders[providerId];
              const providerCfg = draft.per_provider_config?.[providerId] || {};
              const hasOverride = Object.keys(providerCfg).length > 0;
              return (
                <div key={providerId} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleProviderExpand(providerId)}
                    className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-750 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-white">{providerId.toUpperCase()}</span>
                      {hasOverride && <span className="text-xs bg-blue-700 text-white px-2 py-0.5 rounded">Được tùy chỉnh</span>}
                    </span>
                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 py-4 bg-slate-750 border-t border-slate-700 space-y-4">
                      {/* Timeout for this provider */}
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">{t('soc.vnbroker.timeout_section')}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[['connect', t('soc.vnbroker.timeout_connect')], ['read', t('soc.vnbroker.timeout_read')], ['write', t('soc.vnbroker.timeout_write')], ['pool', t('soc.vnbroker.timeout_pool')]].map(([key, label]) => (
                            <div key={`${providerId}-timeout-${key}`}>
                              <label className="block text-xs text-slate-500 mb-1">{label} (s)</label>
                              <input
                                type="number"
                                step="0.5"
                                placeholder="(không ghi đè)"
                                value={providerCfg.timeout?.[key] ?? ''}
                                onChange={(e) => setPerProviderTimeout(providerId, key, e.target.value)}
                                className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Retry settings for this provider */}
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">{t('soc.vnbroker.retry_section')}</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('soc.vnbroker.max_retries')}</label>
                            <input
                              type="number"
                              placeholder="(không ghi đè)"
                              value={providerCfg.max_retries ?? ''}
                              onChange={(e) => setPerProviderField(providerId, 'max_retries', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('soc.vnbroker.retry_delay_seconds')}</label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="(không ghi đè)"
                              value={providerCfg.retry_delay_seconds ?? ''}
                              onChange={(e) => setPerProviderField(providerId, 'retry_delay_seconds', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Rate limiting for this provider */}
                      <div>
                        <h5 className="text-xs font-semibold text-slate-400 mb-2 uppercase">{t('soc.vnbroker.rate_limit_section')}</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('soc.vnbroker.requests_per_minute')}</label>
                            <input
                              type="number"
                              placeholder="(không ghi đè)"
                              value={providerCfg.requests_per_minute ?? ''}
                              onChange={(e) => setPerProviderField(providerId, 'requests_per_minute', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('soc.vnbroker.burst_limit')}</label>
                            <input
                              type="number"
                              placeholder="(không ghi đè)"
                              value={providerCfg.burst_limit ?? ''}
                              onChange={(e) => setPerProviderField(providerId, 'burst_limit', e.target.value === '' ? null : Number(e.target.value))}
                              className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Clear override button */}
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            per_provider_config: {
                              ...prev.per_provider_config,
                              [providerId]: {},
                            },
                          }))}
                          className="text-xs px-2 py-1 text-slate-300 hover:text-slate-100 border border-slate-600 hover:border-slate-400 rounded transition-colors"
                        >
                          {t('soc.vnbroker.clear_provider_override')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Providers status */}
      {providers.length > 0 && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.vnbroker.providers_status')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providers.map((pv) => (
              <div key={pv.id || pv.name} className="bg-slate-800 p-3 rounded border border-slate-700">
                <p className="font-semibold text-slate-100 text-sm">{(pv.provider || pv.id || pv.name || '').toUpperCase()}</p>
                <p
                  className={`text-xs font-medium mt-0.5 ${(
                    pv.runtime_ready
                    || pv.configured
                    || (String(pv.provider || pv.id || '').toLowerCase() === 'dnse' && dnseCredentialConfigured)
                  ) ? 'text-green-400' : 'text-slate-500'}`}
                >
                  {(
                    pv.runtime_ready
                    || pv.configured
                    || (String(pv.provider || pv.id || '').toLowerCase() === 'dnse' && dnseCredentialConfigured)
                  ) ? t('soc.vnbroker.provider_configured') : t('soc.vnbroker.provider_not_configured')}
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
            {selectableProviders.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
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
