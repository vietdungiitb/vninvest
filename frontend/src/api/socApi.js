/**
 * socApi.js — API client functions for SOC endpoints
 * Base URL: /api/soc/
 */

const BASE_URL = '/api/soc';

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }
  return response.json();
};

// Overview endpoints
export const socApi = {
  // Overview
  getServiceList: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/overview/?page=${page}`);
    return handleResponse(resp);
  },

  getServiceDetail: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/overview/${serviceKey}/`);
    return handleResponse(resp);
  },

  getServiceConfig: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/overview/${serviceKey}/config/`);
    return handleResponse(resp);
  },

  getServiceHealth: async (serviceKey) => {
    const resp = await fetch(`${BASE_URL}/overview/${serviceKey}/health/`);
    return handleResponse(resp);
  },

  getServiceAudit: async (serviceKey, page = 1) => {
    const resp = await fetch(`${BASE_URL}/overview/${serviceKey}/audit/?page=${page}`);
    return handleResponse(resp);
  },

  getServiceHistory: async (serviceKey, page = 1) => {
    const resp = await fetch(`${BASE_URL}/overview/${serviceKey}/history/?page=${page}`);
    return handleResponse(resp);
  },

  // VNBroker
  getVnbrokerConfig: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/config/`);
    return handleResponse(resp);
  },

  applyVnbrokerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/vnbroker/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return handleResponse(resp);
  },

  previewVnbrokerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/vnbroker/preview/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return handleResponse(resp);
  },

  getVnbrokerHealth: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/health/`);
    return handleResponse(resp);
  },

  testVnbrokerConnection: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/test-connection/`, { method: 'POST' });
    return handleResponse(resp);
  },

  getVnbrokerProviders: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/providers/`);
    return handleResponse(resp);
  },

  getVnbrokerCircuitBreaker: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/circuit-breaker/`);
    return handleResponse(resp);
  },

  getVnbrokerMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/vnbroker/metrics/`);
    return handleResponse(resp);
  },

  // Prefetch
  getPrefetchConfig: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/config/`);
    return handleResponse(resp);
  },

  applyPrefetchConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/prefetch/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return handleResponse(resp);
  },

  getPrefetchProfiles: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/profiles/`);
    return handleResponse(resp);
  },

  getPrefetchCacheStatus: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/cache-status/`);
    return handleResponse(resp);
  },

  purgePrefetchCache: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/purge/`, { method: 'POST' });
    return handleResponse(resp);
  },

  getPrefetchUniverseGroups: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/universe-groups/`);
    return handleResponse(resp);
  },

  getPrefetchSchedule: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/schedule/`);
    return handleResponse(resp);
  },

  getPrefetchMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/prefetch/metrics/`);
    return handleResponse(resp);
  },

  // Signals (read-only)
  getSignalConfig: async () => {
    const resp = await fetch(`${BASE_URL}/signals/config/`);
    return handleResponse(resp);
  },

  getSignalOwnership: async () => {
    const resp = await fetch(`${BASE_URL}/signals/ownership/`);
    return handleResponse(resp);
  },

  getWhaleDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/whale-detection/`);
    return handleResponse(resp);
  },

  getDarkPoolDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/dark-pool/`);
    return handleResponse(resp);
  },

  getScreenerDetection: async () => {
    const resp = await fetch(`${BASE_URL}/signals/screener-detection/`);
    return handleResponse(resp);
  },

  getSignalRetention: async () => {
    const resp = await fetch(`${BASE_URL}/signals/retention/`);
    return handleResponse(resp);
  },

  getSignalMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/signals/metrics/`);
    return handleResponse(resp);
  },

  // Screener
  getScreenerConfig: async () => {
    const resp = await fetch(`${BASE_URL}/screener/config/`);
    return handleResponse(resp);
  },

  applyScreenerConfig: async (config) => {
    const resp = await fetch(`${BASE_URL}/screener/config/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    return handleResponse(resp);
  },

  getScreenerRules: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/screener/rules/?page=${page}`);
    return handleResponse(resp);
  },

  getScreenerResults: async (page = 1) => {
    const resp = await fetch(`${BASE_URL}/screener/results/?page=${page}`);
    return handleResponse(resp);
  },

  getScreenerAlerts: async () => {
    const resp = await fetch(`${BASE_URL}/screener/alerts/`);
    return handleResponse(resp);
  },

  manualScan: async (ruleIds = []) => {
    const resp = await fetch(`${BASE_URL}/screener/manual-scan/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_ids: ruleIds }),
    });
    return handleResponse(resp);
  },

  getScreenerMetrics: async () => {
    const resp = await fetch(`${BASE_URL}/screener/metrics/`);
    return handleResponse(resp);
  },

  getScreenerTemplates: async () => {
    const resp = await fetch(`${BASE_URL}/screener/templates/`);
    return handleResponse(resp);
  },

  // Matrix (if T06 implemented)
  getMatrixCycle: async (cycleId) => {
    const resp = await fetch(`${BASE_URL}/matrix/cycle/${cycleId}/`);
    return handleResponse(resp);
  },
};
