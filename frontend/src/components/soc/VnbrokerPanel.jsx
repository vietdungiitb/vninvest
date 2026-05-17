/**
 * VnbrokerPanel.jsx — VNBroker configuration and health monitoring (structured form)
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { getDNSEConfig } from '../../api/client';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const DEFAULT_PROVIDER_OPTIONS = ['vci', 'kbs', 'dnse'];

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeProviderId = (value) => String(value || '').trim().toLowerCase();

const uniqueProviders = (providers) => {
  const output = [];
  providers.forEach((providerId) => {
    const normalized = normalizeProviderId(providerId);
    if (normalized && !output.includes(normalized)) {
      output.push(normalized);
    }
  });
  return output;
};

const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;

const getBenchmarkLatencyMs = (result) => {
  const directLatency = Number(result?.latency_ms || 0);
  if (Number.isFinite(directLatency) && directLatency > 0) {
    return directLatency;
  }

  const p95LatencySeconds = Number(result?.p95_latency_seconds || 0);
  if (Number.isFinite(p95LatencySeconds) && p95LatencySeconds > 0) {
    return p95LatencySeconds * 1000;
  }

  const p50LatencySeconds = Number(result?.p50_latency_seconds || 0);
  if (Number.isFinite(p50LatencySeconds) && p50LatencySeconds > 0) {
    return p50LatencySeconds * 1000;
  }

  return 1000;
};

const getBenchmarkErrorPct = (result) => {
  const explicitErrorPct = Number(result?.error_pct);
  if (Number.isFinite(explicitErrorPct) && explicitErrorPct >= 0) {
    return explicitErrorPct;
  }

  const successPct = Number(result?.success_pct);
  if (Number.isFinite(successPct)) {
    return Math.max(0, 100 - successPct);
  }

  return 0;
};

const buildProviderOptimizationFromBenchmarkResult = (result) => {
  const latencyMs = getBenchmarkLatencyMs(result);
  const successPct = Number(result?.success_pct || 98);
  const errorPct = getBenchmarkErrorPct(result);
  const rateLimitedPct = Number(result?.rate_limited_pct || 0);
  const requestsPerMinuteObserved = Number(result?.requests_per_minute || 0);

  const timeoutSafetyFactor = successPct < 95 ? 2.0 : 1.5;
  const baseTimeoutSeconds = Math.max(latencyMs / 1000, 1);

  const connectTimeout = clampNumber(roundHalf(baseTimeoutSeconds * timeoutSafetyFactor * 1.2), 1, 60);
  const readTimeout = clampNumber(roundHalf(baseTimeoutSeconds * timeoutSafetyFactor * 8), 5, 120);
  const writeTimeout = clampNumber(roundHalf(baseTimeoutSeconds * timeoutSafetyFactor), 1, 60);
  const poolTimeout = clampNumber(roundHalf(baseTimeoutSeconds * timeoutSafetyFactor * 0.8), 1, 30);

  let maxRetries = 4;
  if (errorPct < 1) maxRetries = 2;
  else if (errorPct < 5) maxRetries = 3;
  if (rateLimitedPct > 15) maxRetries = Math.max(maxRetries, 4);

  const retryDelay = clampNumber(roundHalf(latencyMs / 500), 0.5, 3);
  const rateLimitFactor = rateLimitedPct > 10 ? 0.8 : 0.9;
  const safeRequestsPerMinute = clampNumber(Math.floor(requestsPerMinuteObserved * rateLimitFactor), 10, 240);
  const safeBurstLimit = clampNumber(Math.ceil(safeRequestsPerMinute * 0.2), 2, 40);

  return {
    timeout: {
      connect: connectTimeout,
      read: readTimeout,
      write: writeTimeout,
      pool: poolTimeout,
    },
    max_retries: maxRetries,
    retry_delay_seconds: retryDelay,
    requests_per_minute: safeRequestsPerMinute,
    burst_limit: safeBurstLimit,
  };
};

const pickBestBenchmarkResult = (report, preferredProviderId) => {
  const results = Array.isArray(report?.results) ? report.results : [];
  if (!results.length) return null;

  const sorted = [...results]
    .filter((entry) => normalizeProviderId(entry?.provider))
    .sort((a, b) => {
      const rateLimitedDelta = Number(a?.rate_limited_pct || 100) - Number(b?.rate_limited_pct || 100);
      if (rateLimitedDelta !== 0) return rateLimitedDelta;
      const rpmDelta = Number(b?.requests_per_minute || 0) - Number(a?.requests_per_minute || 0);
      if (rpmDelta !== 0) return rpmDelta;
      return Number(b?.success_pct || 0) - Number(a?.success_pct || 0);
    });

  if (preferredProviderId) {
    const matched = sorted.find((entry) => normalizeProviderId(entry?.provider) === preferredProviderId);
    if (matched) {
      return matched;
    }
  }
  return sorted[0];
};

const buildOptimizedConfigFromBenchmark = (currentDraft, report, selectableProviders) => {
  const recommendation = report?.recommendation || {};
  const recommendedPrimary = normalizeProviderId(recommendation.primary_provider);
  const bestResult = pickBestBenchmarkResult(report, recommendedPrimary);
  const primaryProvider = normalizeProviderId(bestResult?.provider || recommendedPrimary || currentDraft?.preferred_provider);
  const selectedPrimary = selectableProviders.includes(primaryProvider)
    ? primaryProvider
    : (selectableProviders[0] || DEFAULT_PROVIDER_OPTIONS[0]);

  const recommendedFallbacks = recommendation?.runtime_patch?.fallback_sources;
  const recommendedSingleFallback = recommendation?.fallback_provider;
  const fallbackFromRecommendation = Array.isArray(recommendedFallbacks)
    ? recommendedFallbacks
    : [recommendedSingleFallback].filter(Boolean);
  const fallbackFromReport = Array.isArray(report?.providers)
    ? report.providers
    : (Array.isArray(report?.results) ? report.results.map((entry) => entry?.provider) : []);

  const benchmarkResults = Array.isArray(report?.results) ? report.results : [];
  const generatedProviderConfig = benchmarkResults.reduce((acc, result) => {
    const providerId = normalizeProviderId(result?.provider);
    if (!providerId || !selectableProviders.includes(providerId)) {
      return acc;
    }
    return {
      ...acc,
      [providerId]: buildProviderOptimizationFromBenchmarkResult(result),
    };
  }, {});

  const fallbackFromCurrent = Array.isArray(currentDraft?.fallback_providers)
    ? currentDraft.fallback_providers
    : [];

  const orderedFallbackProviders = uniqueProviders([
    ...fallbackFromRecommendation,
    ...fallbackFromReport,
    ...fallbackFromCurrent,
  ]).filter((providerId) => providerId !== selectedPrimary && selectableProviders.includes(providerId));

  return {
    ...currentDraft,
    preferred_provider: selectedPrimary,
    fallback_providers: orderedFallbackProviders,
    per_provider_config: {
      ...(currentDraft?.per_provider_config || {}),
      ...generatedProviderConfig,
    },
  };
};

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
  const [benchmarkReport, setBenchmarkReport] = useState(null);
  const [optimizedDraft, setOptimizedDraft] = useState(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState({});
  const [previewMode, setPreviewMode] = useState('manual');

  const fetchData = useCallback(async () => {
    try {
      const [cfg, hth, mtr, pvd, dnseCfg, benchmarkLatest] = await Promise.all([
        socApi.getVnbrokerConfig(),
        socApi.getVnbrokerHealth(),
        socApi.getVnbrokerMetrics(),
        socApi.getVnbrokerProviders().catch(() => ({ results: [] })),
        getDNSEConfig().catch(() => ({ is_configured: false })),
        socApi.getVnbrokerBenchmarkLatest().catch(() => ({ has_report: false, report: null })),
      ]);
      const currentConfig = cfg.config || {};
      const providerCatalog = pvd.results || pvd.providers || [];
      const providerOptions = providerCatalog
        .map((provider) => String(provider?.provider || provider?.id || provider?.name || '').trim().toLowerCase())
        .filter(Boolean);
      const selectableProviders = providerOptions.length > 0 ? providerOptions : DEFAULT_PROVIDER_OPTIONS;
      const preferredProvider = String(currentConfig.preferred_provider || '').trim().toLowerCase();
      const latestReport = benchmarkLatest?.report || null;

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
      setBenchmarkReport(latestReport);
      setOptimizedDraft(
        latestReport
          ? buildOptimizedConfigFromBenchmark(currentConfig, latestReport, selectableProviders)
          : null,
      );
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
      setPreviewMode('manual');
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
    const payloadToApply = previewMode === 'optimized' && optimizedDraft
      ? optimizedDraft
      : draft;
    try {
      setIsSubmitting(true);
      await socApi.applyVnbrokerConfig(payloadToApply);
      setConfig(JSON.parse(JSON.stringify(payloadToApply)));
      setDraft(JSON.parse(JSON.stringify(payloadToApply)));
      setShowPreview(false);
      setPreviewWarnings([]);
      setPreviewErrors(null);
      setChangeSummary([]);
      setPreviewMode('manual');
      if (previewMode === 'optimized') {
        setBenchmarkStatus(t('soc.vnbroker.optimized_saved_success'));
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkReport(null);
    setBenchmarkStatus(null);
    try {
      const result = await socApi.runVnbrokerBenchmark({
        provider: benchmarkProvider,
        duration_seconds: 30,
      });
      const report = result?.report || null;
      setBenchmarkReport(report);
      const nextOptimizedDraft = report
        ? buildOptimizedConfigFromBenchmark(draft, report, selectableProviders)
        : null;
      setOptimizedDraft(nextOptimizedDraft);
      setBenchmarkStatus(
        report
          ? t('soc.vnbroker.benchmark_ready')
          : t('soc.vnbroker.benchmark_no_report'),
      );
    } catch (err) {
      setBenchmarkReport(null);
      setOptimizedDraft(null);
      setBenchmarkStatus(err.message);
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleOpenOptimizedPreview = async () => {
    if (!optimizedDraft || !benchmarkReport) {
      setError(t('soc.vnbroker.benchmark_no_report'));
      return;
    }

    try {
      const preview = await socApi.previewVnbrokerConfig(optimizedDraft);
      setPreviewMode('optimized');
      setPreviewWarnings([t('soc.vnbroker.optimized_preview_warning')]);
      setPreviewErrors(preview.valid === false ? { config_payload: preview.errors || [] } : null);
      setChangeSummary(buildChangeSummary(config || {}, optimizedDraft));
      setShowPreview(true);
      setError(null);
    } catch (err) {
      setError(err.message);
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
  const previewAfterConfig = previewMode === 'optimized' && optimizedDraft ? optimizedDraft : draft;

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
        <div className="flex flex-wrap gap-3 mb-3">
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
          <button
            onClick={handleOpenOptimizedPreview}
            disabled={!optimizedDraft || isBenchmarking}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded text-white text-sm"
          >
            {t('soc.vnbroker.optimized_save')}
          </button>
        </div>

        {optimizedDraft && (
          <p className="mb-2 inline-flex items-center rounded-full border border-emerald-600 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-200">
            {t('soc.vnbroker.optimized_badge_ready')}
          </p>
        )}

        {benchmarkReport?.recommendation && (
          <div className="mb-3 rounded border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-200">
            <p>
              {t('soc.vnbroker.optimized_primary')}:{' '}
              <strong>{String(benchmarkReport.recommendation.primary_provider || draft.preferred_provider || '').toUpperCase()}</strong>
            </p>
            <p>
              {t('soc.vnbroker.optimized_fallback')}:{' '}
              <strong>
                {Array.isArray(benchmarkReport.recommendation.runtime_patch?.fallback_sources)
                  ? benchmarkReport.recommendation.runtime_patch.fallback_sources.join(', ')
                  : (draft.fallback_providers || []).join(', ')}
              </strong>
            </p>
          </div>
        )}

        {benchmarkStatus && <p className="mb-2 text-xs text-slate-300">{benchmarkStatus}</p>}

        {Array.isArray(benchmarkReport?.results) && benchmarkReport.results.length > 0 && (
          <div className="mb-3 overflow-x-auto rounded border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-xs text-slate-200">
              <thead className="bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t('soc.vnbroker.benchmark_col_provider')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.vnbroker.benchmark_col_latency')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.vnbroker.benchmark_col_rpm')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.vnbroker.benchmark_col_success')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.vnbroker.benchmark_col_rate_limited')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {benchmarkReport.results.map((result) => {
                  const providerId = String(result?.provider || '').toUpperCase();
                  const latencyMs = Math.round(getBenchmarkLatencyMs(result));
                  const rpm = Number(result?.requests_per_minute || 0);
                  const success = Number(result?.success_pct || 0);
                  const rateLimited = Number(result?.rate_limited_pct || 0);
                  return (
                    <tr key={`${providerId}-${result?.concurrency || 'n/a'}`}>
                      <td className="px-3 py-2 font-semibold">{providerId}</td>
                      <td className="px-3 py-2 text-right">{latencyMs} ms</td>
                      <td className="px-3 py-2 text-right">{rpm}</td>
                      <td className="px-3 py-2 text-right">{success.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{rateLimited.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {benchmarkReport && (
          <pre className="bg-slate-800 p-3 rounded text-xs text-slate-300 overflow-auto max-h-48">
            {JSON.stringify(benchmarkReport || {}, null, 2)}
          </pre>
        )}
      </div>

      {/* Preview Modal */}
      <ConfigPreviewModal
        isOpen={showPreview}
        before={config}
        after={previewAfterConfig}
        onClose={() => {
          setShowPreview(false);
          setPreviewWarnings([]);
          setPreviewErrors(null);
          setPreviewMode('manual');
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
