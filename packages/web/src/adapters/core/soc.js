/**
 * soc.js
 *
 * SOC (Security Operations Center) admin client for coreApiAdapter.
 * Full port of legacy frontend/src/api/socApi.js (~45 functions, 10 domains).
 *
 * Base URL (via transport): /core/v1/operator/soc/… and /core/v1/operator/scraping/dataops/…
 */

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

// W1.1: query paging/filter cho 3 recent endpoints (page/page_size/symbol/severity/direction).
// W2.5: thêm type cho feed export.
const buildSignalsRecentQuery = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.type) qs.set("type", params.type);
  if (params.symbol) qs.set("symbol", params.symbol);
  if (params.severity) qs.set("severity", params.severity);
  if (params.direction) qs.set("direction", params.direction);
  const query = qs.toString();
  return query ? `?${query}` : "";
};

export function createSocClient({ coreGet, corePost, corePut, corePatch, coreDelete }) {
  return {
    // ─── Overview ──────────────────────────────────────────────────────────
    getSocOverviewSummary() {
      return coreGet("/operator/soc/overview/");
    },

    getSocServiceList(page = 1) {
      return coreGet(`/operator/soc/services/?page=${page}`);
    },

    getSocHealthStatus() {
      return coreGet("/operator/soc/health-status/");
    },

    getSocSloOverview() {
      return coreGet("/operator/soc/overview/slo-overview/");
    },

    exportSocConfigAudits(params = {}) {
      const qs = new URLSearchParams();
      if (params.service_key) qs.set("service_key", params.service_key);
      if (params.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      return coreGet(`/operator/soc/overview/export/audits/${query ? `?${query}` : ""}`);
    },

    exportSocRunLogs(params = {}) {
      const qs = new URLSearchParams();
      if (params.service_key) qs.set("service_key", params.service_key);
      if (params.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      return coreGet(`/operator/soc/overview/export/run-logs/${query ? `?${query}` : ""}`);
    },

    getSocServiceDetail(serviceKey) {
      if (!serviceKey) throw new Error("serviceKey is required for getSocServiceDetail");
      return coreGet(`/operator/soc/services/${encodeURIComponent(serviceKey)}/`);
    },

    getSocServiceConfig(serviceKey) {
      if (!serviceKey) throw new Error("serviceKey is required for getSocServiceConfig");
      return coreGet(`/operator/soc/services/${encodeURIComponent(serviceKey)}/config/`);
    },

    getSocServiceHealth(serviceKey) {
      if (!serviceKey) throw new Error("serviceKey is required for getSocServiceHealth");
      return coreGet(`/operator/soc/services/${encodeURIComponent(serviceKey)}/health/`);
    },

    getSocServiceAudit(serviceKey, page = 1) {
      if (!serviceKey) throw new Error("serviceKey is required for getSocServiceAudit");
      return coreGet(`/operator/soc/services/${encodeURIComponent(serviceKey)}/audit/?page=${page}`);
    },

    getSocServiceHistory(serviceKey, page = 1) {
      if (!serviceKey) throw new Error("serviceKey is required for getSocServiceHistory");
      return coreGet(`/operator/soc/services/${encodeURIComponent(serviceKey)}/history/?page=${page}`);
    },

    // ─── VNBroker ──────────────────────────────────────────────────────────
    getSocVnbrokerConfig() {
      return coreGet("/operator/soc/vnbroker/config/").then(normalizeConfigEnvelope);
    },

    applySocVnbrokerConfig(config) {
      return corePost("/operator/soc/vnbroker/config/", { config_payload: config }).then(normalizeConfigEnvelope);
    },

    previewSocVnbrokerConfig(config) {
      return corePost("/operator/soc/vnbroker/config/preview/", { config_payload: config });
    },

    getSocVnbrokerHealth() {
      return coreGet("/operator/soc/vnbroker/health/").then(normalizeVnbrokerHealth);
    },

    testSocVnbrokerConnection() {
      return corePost("/operator/soc/vnbroker/test-connection/");
    },

    getSocVnbrokerProviders() {
      return coreGet("/operator/soc/vnbroker/providers/");
    },

    runSocVnbrokerBenchmark(payload = {}) {
      return corePost("/operator/soc/vnbroker/benchmark/", payload);
    },

    getSocVnbrokerBenchmarkLatest() {
      return coreGet("/operator/soc/vnbroker/benchmark/");
    },

    getSocVnbrokerCircuitBreaker() {
      return coreGet("/operator/soc/vnbroker/circuit-breaker-status/");
    },

    getSocVnbrokerMetrics() {
      return this.getSocVnbrokerHealth().then((health) => {
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
      });
    },

    // ─── DataOps Market-Data Runtime ───────────────────────────────────────
    getSocDataOpsQueueTiers() {
      return coreGet("/operator/scraping/dataops/queue-tiers/");
    },

    getSocDataOpsCoverage() {
      return coreGet("/operator/scraping/dataops/coverage/");
    },

    getSocDataOpsObservability() {
      return coreGet("/operator/scraping/dataops/observability/");
    },

    getSocDataOpsRunLogs(page = 1, pageSize = 20) {
      return coreGet(`/operator/scraping/dataops/run-logs/?page=${page}&page_size=${pageSize}`);
    },

    // ─── Service Management ────────────────────────────────────────────────
    updateSocService(serviceKey, payload) {
      if (!serviceKey) throw new Error("serviceKey is required for updateSocService");
      return corePatch(`/operator/soc/services/${encodeURIComponent(serviceKey)}/`, payload);
    },

    triggerSocServiceHealthCheck(serviceKey) {
      if (!serviceKey) throw new Error("serviceKey is required for triggerSocServiceHealthCheck");
      return corePost(`/operator/soc/services/${encodeURIComponent(serviceKey)}/health-check/`);
    },

    applySocServiceConfig(serviceKey, configPayload, changeReason = '') {
      if (!serviceKey) throw new Error("serviceKey is required for applySocServiceConfig");
      return corePost(`/operator/soc/services/${encodeURIComponent(serviceKey)}/config/`, {
        config_payload: configPayload,
        change_reason: changeReason,
      });
    },

    resetSocServiceConfig(serviceKey, reason = '') {
      if (!serviceKey) throw new Error("serviceKey is required for resetSocServiceConfig");
      return corePost(`/operator/soc/services/${encodeURIComponent(serviceKey)}/config/reset/`, {
        change_reason: reason,
      });
    },

    purgeSocDataOpsRunLogs(keep = 50) {
      return corePost(`/operator/scraping/dataops/run-logs/purge/?keep=${keep}`);
    },

    previewSocDataOpsPlanner(payload) {
      return corePost("/operator/scraping/dataops/planner/preview/", payload);
    },

    runSocDataOpsPlanner(payload) {
      return corePost("/operator/scraping/dataops/planner/run/", payload);
    },

    abortSocDataOpsPlannerRun(runId) {
      if (!runId) throw new Error("runId is required for abortSocDataOpsPlannerRun");
      return corePost(`/operator/scraping/dataops/planner/run/${encodeURIComponent(runId)}/abort/`);
    },

    getSocDataOpsRuntimeConfig() {
      return coreGet("/operator/scraping/dataops/runtime-config/");
    },

    applySocDataOpsRuntimeConfig(config) {
      return corePost("/operator/scraping/dataops/runtime-config/", { config_payload: config });
    },

    previewSocDataOpsRuntimeConfig(config) {
      return corePost("/operator/soc/dataops/runtime-config/preview/", { config_payload: config });
    },

    getSocDataOpsRuntimeConfigAudit(page = 1) {
      return coreGet(`/operator/soc/dataops/runtime-config/audit/?page=${page}`);
    },

    getSocDataOpsInventory() {
      return coreGet("/operator/soc/dataops/inventory/");
    },

    // ─── Scheduler Control Center ──────────────────────────────────────────
    getSocSchedulerPlan() {
      return coreGet("/operator/scraping/dataops/scheduler/plan/");
    },

    getSocSchedulerHealth() {
      return coreGet("/operator/scraping/dataops/scheduler/health/");
    },

    getSocSchedulerJobHistory(jobKey, page = 1, pageSize = 20) {
      if (!jobKey) throw new Error("jobKey is required for getSocSchedulerJobHistory");
      return coreGet(
        `/operator/scraping/dataops/scheduler/jobs/${encodeURIComponent(jobKey)}/history/?page=${page}&page_size=${pageSize}`
      );
    },

    postSocSchedulerJobAction(jobKey, action, reason = '') {
      if (!jobKey) throw new Error("jobKey is required for postSocSchedulerJobAction");
      return corePost(
        `/operator/scraping/dataops/scheduler/jobs/${encodeURIComponent(jobKey)}/actions/`,
        { action, reason }
      );
    },

    // ─── Prefetch ──────────────────────────────────────────────────────────
    getSocPrefetchConfig() {
      return coreGet("/operator/soc/prefetch/config/").then(normalizeConfigEnvelope);
    },

    applySocPrefetchConfig(config) {
      return corePost("/operator/soc/prefetch/config/", { config_payload: config }).then(normalizeConfigEnvelope);
    },

    getSocPrefetchProfiles() {
      return coreGet("/operator/soc/prefetch/config/profiles/").then((data) => ({
        ...data,
        results: (data.profiles || []).map((profile) => ({
          name: profile,
          description: data.descriptions?.[profile] || '',
        })),
      }));
    },

    getSocPrefetchCacheStatus() {
      return coreGet("/operator/soc/prefetch/cache-status/").then((data) => ({
        ...data,
        hit_rate: Number(((data.hit_ratio || 0) * 100).toFixed(1)),
        size_mb: data.redis?.memory_usage_mb || 0,
        ttl_minutes: data.redis?.ttl_minutes || 0,
      }));
    },

    purgeSocPrefetchCache() {
      return corePost("/operator/soc/prefetch/purge-cache/");
    },

    previewSocPrefetchConfig(config) {
      return corePost("/operator/soc/prefetch/config/preview/", { config_payload: config });
    },

    warmSocPrefetchNow(mode = 'async', opts = {}) {
      const groups = opts.groups || opts.universe_group_ids;
      const body = groups && groups.length ? { universe_group_ids: groups } : {};
      return corePost(`/operator/soc/prefetch/warm-now/?mode=${encodeURIComponent(mode)}`, body);
    },

    getSocPrefetchUniverseGroups() {
      return coreGet("/operator/soc/prefetch/universe-groups/");
    },

    getSocPrefetchSchedule() {
      return coreGet("/operator/soc/prefetch/task-schedule/");
    },

    getSocPrefetchMetrics() {
      return coreGet("/operator/soc/prefetch/metrics/");
    },

    // ─── Signals (Read-Only) ───────────────────────────────────────────────
    getSocSignalConfig() {
      return coreGet("/operator/soc/signals/config/").then(normalizeConfigEnvelope);
    },

    getSocSignalOwnership() {
      return coreGet("/operator/soc/signals/ownership/");
    },

    getSocWhaleDetection() {
      return coreGet("/operator/soc/signals/whale/");
    },

    getSocDarkPoolDetection() {
      return coreGet("/operator/soc/signals/dark-pool/");
    },

    getSocScreenerDetection() {
      return coreGet("/operator/soc/signals/screener/");
    },

    getSocSignalRetention() {
      return coreGet("/operator/soc/signals/retention-policy/");
    },

    previewSocSignalRetention(config) {
      return corePost("/operator/soc/signals/retention-policy/preview/", { config_payload: config || {} });
    },

    testSocWhaleDetection(symbol) {
      return corePost("/operator/soc/signals/whale/test/", symbol ? { symbol } : {});
    },

    getSocSignalMetrics() {
      return coreGet("/operator/soc/signals/summary/");
    },

    // ─── Signals (Advanced) ────────────────────────────────────────────────
    getSocSignalPerformanceMetrics() {
      return coreGet("/operator/soc/signals/performance-metrics/");
    },

    getSocWhaleRecent(params = {}) {
      return coreGet(`/operator/soc/signals/whale/recent/${buildSignalsRecentQuery(params)}`);
    },

    getSocDarkPoolRecent(params = {}) {
      return coreGet(`/operator/soc/signals/dark-pool/recent/${buildSignalsRecentQuery(params)}`);
    },

    getSocScreenerRecent(params = {}) {
      return coreGet(`/operator/soc/signals/screener/recent/${buildSignalsRecentQuery(params)}`);
    },

    runSocSignalJob(domain, symbol) {
      return corePost("/operator/soc/signals/jobs/run/", { domain, symbol });
    },

    getSocSignalJobStatus(runLogId) {
      if (!runLogId) throw new Error("runLogId is required for getSocSignalJobStatus");
      return coreGet(`/operator/soc/signals/jobs/status/?run_log_id=${encodeURIComponent(runLogId)}`);
    },

    getSocSignalMaterialization() {
      return coreGet("/operator/soc/signals/materialization/");
    },

    exportSocSignalFeed(params = {}) {
      return coreGet(`/operator/soc/signals/feed/export/${buildSignalsRecentQuery(params)}`);
    },

    // ─── Screener ──────────────────────────────────────────────────────────
    getSocScreenerConfig() {
      return coreGet("/operator/soc/screener/config/").then(normalizeConfigEnvelope);
    },

    applySocScreenerConfig(config) {
      return corePost("/operator/soc/screener/config/", { config_payload: config }).then(normalizeConfigEnvelope);
    },

    getSocScreenerRules(page = 1) {
      return coreGet(`/operator/soc/screener/rules/?page=${page}`).then((data) => ({
        ...data,
        results: (data.rules || []).map((rule, index) => ({
          id: rule.id || `${rule.type || 'rule'}-${index}`,
          name: rule.name || rule.type || `Rule ${index + 1}`,
          ...rule,
        })),
      }));
    },

    getSocScreenerResults(page = 1) {
      return coreGet(`/operator/soc/screener/results/?page=${page}`).then((data) => ({
        ...data,
        results: (data.symbols_matched || []).map((item, index) => ({
          id: item.id || `${item.symbol || 'symbol'}-${index}`,
          symbol: item.symbol,
          rule_name: item.rule_name || item.rule,
          timestamp: item.timestamp || data.timestamp,
          value: item.value,
        })),
      }));
    },

    getSocScreenerAlerts() {
      return coreGet("/operator/soc/screener/alert-history/").then((data) => ({
        ...data,
        results: (data.alerts || []).map((alert, index) => ({
          id: alert.id || `alert-${index}`,
          symbol: alert.symbol,
          message: `${alert.rule || 'rule'}: ${alert.value ?? ''}`.trim(),
          timestamp: alert.timestamp,
        })),
      }));
    },

    manualSocScreenerScan(symbols = []) {
      return corePost("/operator/soc/screener/manual-scan/", { symbols });
    },

    createSocScreenerRule(payload) {
      return corePost("/operator/soc/screener/rules/", payload);
    },

    updateSocScreenerRule(ruleId, payload) {
      if (!ruleId) throw new Error("ruleId is required for updateSocScreenerRule");
      return corePut(`/operator/soc/screener/rules/${encodeURIComponent(ruleId)}/`, payload);
    },

    deleteSocScreenerRule(ruleId) {
      if (!ruleId) throw new Error("ruleId is required for deleteSocScreenerRule");
      return coreDelete(`/operator/soc/screener/rules/${encodeURIComponent(ruleId)}/delete/`);
    },

    getSocScreenerMetrics() {
      return coreGet("/operator/soc/screener/results/").then((data) => {
        const symbolsScanned = Number(data.symbols_scanned || 0);
        const alertsTriggered = Number(data.alerts_triggered || 0);
        return {
          avg_scan_duration_ms: Number(data.scan_duration_ms || 0),
          rules_hit_rate: symbolsScanned > 0
            ? Number(((alertsTriggered / symbolsScanned) * 100).toFixed(2))
            : 0,
        };
      });
    },

    getSocScreenerOwnership() {
      return coreGet("/operator/soc/screener/ownership/");
    },

    // ─── Matrix ────────────────────────────────────────────────────────────
    getSocMatrixCycle(cycleId) {
      if (!cycleId) throw new Error("cycleId is required for getSocMatrixCycle");
      return coreGet(`/operator/soc/matrix/cycles/${encodeURIComponent(cycleId)}/`);
    },

    startSocMatrixCycle(payload = {}) {
      return corePost("/operator/soc/matrix/cycles/start/", payload);
    },

    abortSocMatrixCycle(cycleId) {
      if (!cycleId) throw new Error("cycleId is required for abortSocMatrixCycle");
      return corePost(`/operator/soc/matrix/cycles/${encodeURIComponent(cycleId)}/abort/`);
    },

    getSocMatrixProviders() {
      return coreGet("/operator/soc/matrix/providers/").then((data) => {
        if (data && Array.isArray(data.providers)) {
          return {
            ...data,
            providers: data.providers.map((item) => ({
              ...item,
              key: item.provider || item.key || "",
              name: item.label || item.name || "",
              status: item.status || (item.runtime_ready ? "ready" : "blocked"),
            })),
          };
        } else if (Array.isArray(data)) {
          return data.map((item) => ({
            ...item,
            key: item.provider || item.key || "",
            name: item.label || item.name || "",
            status: item.status || (item.runtime_ready ? "ready" : "blocked"),
          }));
        }
        return data;
      });
    },

    getSocMatrixMonitor(cycleId) {
      const query = cycleId ? `?cycle_id=${encodeURIComponent(cycleId)}` : '';
      return coreGet(`/operator/soc/matrix/monitor/${query}`);
    },

    // ─── Symbol Groups ─────────────────────────────────────────────────────
    getSocSymbolGroups() {
      return coreGet("/operator/soc/symbol-groups/");
    },

    syncSocSymbolGroups(payload) {
      return corePost("/operator/soc/symbol-groups/sync/", payload || {});
    },

    createSocSymbolGroup(payload) {
      return corePost("/operator/soc/symbol-groups/", payload);
    },

    updateSocSymbolGroup(slug, payload) {
      if (!slug) throw new Error("slug is required for updateSocSymbolGroup");
      return corePut(`/operator/soc/symbol-groups/${encodeURIComponent(slug)}/`, payload);
    },

    deleteSocSymbolGroup(slug) {
      if (!slug) throw new Error("slug is required for deleteSocSymbolGroup");
      return coreDelete(`/operator/soc/symbol-groups/${encodeURIComponent(slug)}/`);
    },

    // ─── Backfill Progress API ─────────────────────────────────────────────
    getSocBackfillRuns({ status: statusFilter, jobKey, limit = 20 } = {}) {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (jobKey) params.set('job_key', jobKey);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return coreGet(`/operator/soc/dataops/backfill/runs/${qs ? `?${qs}` : ""}`);
    },

    getSocBackfillRunDetail(runId) {
      if (!runId) throw new Error("runId is required for getSocBackfillRunDetail");
      return coreGet(`/operator/soc/dataops/backfill/runs/${encodeURIComponent(runId)}/`);
    },
  };
}
