/**
 * socApi.js — API client functions for SOC endpoints
 * Base URL: /api/soc/
 */

const BASE_URL = '/api/soc';
const CANONICAL_DATAOPS_BASE_URL = '/core/v1/operator/scraping/dataops';

const getAccessToken = () => {
  try {
    return localStorage.getItem('access_token');
  } catch {
    return null;
  }
};

const fetch = (input, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return globalThis.fetch(input, {
    credentials: 'include',
    ...options,
    headers,
  });
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }
  return response.json();
};

const normalizeConfigEnvelope = (payload) => {
  const config = payload?.config ?? payload?.config_payload ?? {};
  return {
    ...payload,
    config,
    config_payload: payload?.config_payload ?? config,
  };
};

const normalizeVnbrokerHealth = (payload) => {
  const status = payload?.status || 'unknown';
  return {
    ...payload,
    provider_health: payload?.provider_health || {
      healthy: status === 'healthy' ? 1 : 0,
      degraded: status === 'degraded' ? 1 : 0,
      critical: status === 'unhealthy' ? 1 : 0,
    },
  };
};

// Overview endpoints
export const socApi = {
  getOverviewSummary: async () => {
    const resp = await fetch(`${BASE_URL}/overview/`);
    return handleResponse(resp);
  },

  // Overview
  getServiceList: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/services/?page=${page}`);
    return handleResponse(resp);
  },

  getHealthStatus: async () => {
    const resp = await fetch(`${BASE_URL}/overview/health-status/`);
    return handleResponse(resp);
  },

  getServiceDetail: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/services/${serviceKey}/`);
    return handleResponse(resp);
  },

  getServiceConfig: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/services/${serviceKey}/config/`);
    return handleResponse(resp);
  },

  getServiceHealth: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/services/${serviceKey}/health/`);
    return handleResponse(resp);
  },

  getServiceAudit: async (serviceKey, page = 1) => {
    const resp = await fetch(`${BASE_URL}/services/${serviceKey}/audit/?page=${page}`);
    return handleResponse(resp);
  },

  getServiceHistory: async (serviceKey, page = 1) => {
    const resp = await fetch(`${BASE_URL}/services/${serviceKey}/history/?page=${page}`);
    return handleResponse(resp);
  },

  // VNBroker
  getVnbrokerConfig: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/config/`);
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  applyVnbrokerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/vnbroker/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  previewVnbrokerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/vnbroker/config/preview/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    return handleResponse(resp);
  },

  getVnbrokerHealth: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/health/`);
    return normalizeVnbrokerHealth(await handleResponse(resp));
  },

  testVnbrokerConnection: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/test-connection/`, { method: 'POST' });
    return handleResponse(resp);
  },

  getVnbrokerProviders: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/providers/`);
    return handleResponse(resp);
  },

  runVnbrokerBenchmark: async (payload = {}) => {
    const resp = await fetch(`${BASE_URL}/vnbroker/benchmark/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  getVnbrokerBenchmarkLatest: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/benchmark/`);
    return handleResponse(resp);
  },

  getVnbrokerCircuitBreaker: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/circuit-breaker-status/`);
    return handleResponse(resp);
  },

  getVnbrokerMetrics: async () => {
    const health = await socApi.getVnbrokerHealth();
    const latency = Number(health.avg_response_ms || 0);
    const status = health.status || 'unknown';
    const errorRateByStatus = {
      healthy: 0,
      degraded: 25,
      unknown: 50,
      unhealthy: 100,
      maintenance: 0,
    };

    return {
      throughput: latency > 0 ? Number((1000 / latency).toFixed(2)) : 0,
      error_rate: errorRateByStatus[status] ?? 0,
    };
  },

  // DataOps market-data runtime
  getDataOpsQueueTiers: async () => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/queue-tiers/`);
    return handleResponse(resp);
  },

  getDataOpsCoverage: async () => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/coverage/`);
    return handleResponse(resp);
  },

  getDataOpsRunLogs: async (page = 1) => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/run-logs/?page=${page}`);
    return handleResponse(resp);
  },

  previewDataOpsPlanner: async (payload) => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/planner/preview/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  runDataOpsPlanner: async (payload) => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/planner/run/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  getDataOpsRuntimeConfig: async () => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/runtime-config/`);
    return handleResponse(resp);
  },

  applyDataOpsRuntimeConfig: async (config) => {
    const resp = await fetch(`${CANONICAL_DATAOPS_BASE_URL}/runtime-config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    return handleResponse(resp);
  },

  previewDataOpsRuntimeConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/dataops/runtime-config/preview/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok && resp.status !== 400) {
      throw new Error(payload.detail || `API error: ${resp.status}`);
    }
    return payload;
  },

  getDataOpsRuntimeConfigAudit: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/dataops/runtime-config/audit/?page=${page}`);
    return handleResponse(resp);
  },

  getDataOpsInventory: async () => {
    const resp = await fetch(`${BASE_URL}/dataops/inventory/`);
    return handleResponse(resp);
  },

  // Prefetch
  getPrefetchConfig: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/config/`);
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  applyPrefetchConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/prefetch/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  getPrefetchProfiles: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/config/profiles/`);
    const data = await handleResponse(resp);
    return {
      ...data,
      results: (data.profiles || []).map((profile) => ({
        name: profile,
        description: data.descriptions?.[profile] || '',
      })),
    };
  },

  getPrefetchCacheStatus: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/cache-status/`);
    const data = await handleResponse(resp);
    return {
      ...data,
      hit_rate: Number(((data.hit_ratio || 0) * 100).toFixed(1)),
      size_mb: data.redis?.memory_usage_mb || 0,
      ttl_minutes: data.redis?.ttl_minutes || 0,
    };
  },

  purgePrefetchCache: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/purge-cache/`, { method: 'POST' });
    return handleResponse(resp);
  },

  warmPrefetchNow: async (mode = 'async') => {
    const resp = await fetch(`${BASE_URL}/prefetch/warm-now/?mode=${encodeURIComponent(mode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(resp);
  },

  getPrefetchUniverseGroups: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/universe-groups/`);
    return handleResponse(resp);
  },

  getPrefetchSchedule: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/task-schedule/`);
    return handleResponse(resp);
  },

  getPrefetchMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/metrics/`);
    return handleResponse(resp);
  },

  // Signals (read-only)
  getSignalConfig: async () => {
    const resp = await fetch(`${BASE_URL}/signals/config/`);
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  getSignalOwnership: async () => {
    const resp = await fetch(`${BASE_URL}/signals/ownership/`);
    return handleResponse(resp);
  },

  getWhaleDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/whale/`);
    return handleResponse(resp);
  },

  getDarkPoolDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/dark-pool/`);
    return handleResponse(resp);
  },

  getScreenerDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/screener/`);
    return handleResponse(resp);
  },

  getSignalRetention: async () => {
    const resp = await fetch(`${BASE_URL}/signals/retention-policy/`);
    return handleResponse(resp);
  },

  getSignalMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/signals/summary/`);
    return handleResponse(resp);
  },

  // Screener
  getScreenerConfig: async () => {
    const resp = await fetch(`${BASE_URL}/screener/config/`);
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  applyScreenerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/screener/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_payload: config }),
    });
    return normalizeConfigEnvelope(await handleResponse(resp));
  },

  getScreenerRules: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/screener/rules/?page=${page}`);
    const data = await handleResponse(resp);
    return {
      ...data,
      results: (data.rules || []).map((rule, index) => ({
        id: rule.id || `${rule.type || 'rule'}-${index}`,
        name: rule.name || rule.type || `Rule ${index + 1}`,
        ...rule,
      })),
    };
  },

  getScreenerResults: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/screener/results/?page=${page}`);
    const data = await handleResponse(resp);
    return {
      ...data,
      results: (data.symbols_matched || []).map((item, index) => ({
        id: item.id || `${item.symbol || 'symbol'}-${index}`,
        symbol: item.symbol,
        rule_name: item.rule_name || item.rule,
        timestamp: item.timestamp || data.timestamp,
        value: item.value,
      })),
    };
  },

  getScreenerAlerts: async () => {
    const resp = await fetch(`${BASE_URL}/screener/alert-history/`);
    const data = await handleResponse(resp);
    return {
      ...data,
      results: (data.alerts || []).map((alert, index) => ({
        id: alert.id || `alert-${index}`,
        symbol: alert.symbol,
        message: `${alert.rule || 'rule'}: ${alert.value ?? ''}`.trim(),
        timestamp: alert.timestamp,
      })),
    };
  },

  manualScan: async (symbols = []) => {
    const resp = await fetch(`${BASE_URL}/screener/manual-scan/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    });
    return handleResponse(resp);
  },

  createScreenerRule: async (payload) => {
    const resp = await fetch(`${BASE_URL}/screener/rules/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  updateScreenerRule: async (ruleId, payload) => {
    const resp = await fetch(`${BASE_URL}/screener/rules/${encodeURIComponent(ruleId)}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  deleteScreenerRule: async (ruleId) => {
    const resp = await fetch(`${BASE_URL}/screener/rules/${encodeURIComponent(ruleId)}/delete/`, {
      method: 'DELETE',
    });
    if (resp.status === 204) return null;
    return handleResponse(resp);
  },

  getScreenerMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/screener/results/`);
    const data = await handleResponse(resp);
    const symbolsScanned = Number(data.symbols_scanned || 0);
    const alertsTriggered = Number(data.alerts_triggered || 0);
    return {
      avg_scan_duration_ms: Number(data.scan_duration_ms || 0),
      rules_hit_rate: symbolsScanned > 0
        ? Number(((alertsTriggered / symbolsScanned) * 100).toFixed(2))
        : 0,
    };
  },

  getScreenerTemplates: async () => {
    const resp = await fetch(`${BASE_URL}/screener/templates/`);
    return handleResponse(resp);
  },

  // Matrix
  getMatrixCycle: async (cycleId) => {
    const resp = await fetch(`${BASE_URL}/matrix/cycles/${cycleId}/`);
    return handleResponse(resp);
  },

  startMatrixCycle: async (payload = {}) => {
    const resp = await fetch(`${BASE_URL}/matrix/cycles/start/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  abortMatrixCycle: async (cycleId) => {
    const resp = await fetch(`${BASE_URL}/matrix/cycles/${cycleId}/abort/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return handleResponse(resp);
  },

  getMatrixProviders: async () => {
    const resp = await fetch(`${BASE_URL}/matrix/providers/`);
    return handleResponse(resp);
  },

  getMatrixMonitor: async (cycleId) => {
    const query = cycleId ? `?cycle_id=${encodeURIComponent(cycleId)}` : '';
    const resp = await fetch(`${BASE_URL}/matrix/monitor/${query}`);
    return handleResponse(resp);
  },

  // ── Symbol Groups ────────────────────────────────────────────────────────────
  getSymbolGroups: async () => {
    const resp = await fetch(`${BASE_URL}/symbol-groups/`);
    return handleResponse(resp);
  },

  createSymbolGroup: async (payload) => {
    const resp = await fetch(`${BASE_URL}/symbol-groups/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  updateSymbolGroup: async (slug, payload) => {
    const resp = await fetch(`${BASE_URL}/symbol-groups/${encodeURIComponent(slug)}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(resp);
  },

  deleteSymbolGroup: async (slug) => {
    const resp = await fetch(`${BASE_URL}/symbol-groups/${encodeURIComponent(slug)}/`, {
      method: 'DELETE',
    });
    if (resp.status === 204) return null;
    return handleResponse(resp);
  },
};
