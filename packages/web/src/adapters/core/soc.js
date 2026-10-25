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

// ─── VNBroker normalizers ───────────────────────────────────────────────
// Hợp đồng BE <-> FE cho domain vnbroker (BE: service_ops/views/vnbroker.py).
//
// NGUYÊN TẮC: adapter KHÔNG tự chế dữ liệu. Mọi field đều lấy từ response BE
// rồi đổi tên cho dễ đọc. Field BE không tồn tại => null/unknown, TUYỆT ĐỐI
// không bịa bằng công thức (audit Entry 384 §D1: F-01..F-08).
const normalizeVnbrokerConfig = (payload) => {
  const config = payload?.config_payload ?? payload?.config ?? {};
  return {
    service_key: payload?.service_key || "",
    config_schema_version: payload?.config_schema_version || "",
    config,
    providers_catalog: Array.isArray(payload?.providers_catalog) ? payload.providers_catalog : [],
    applied_by: payload?.applied_by || "",
    applied_at: payload?.applied_at || null,
    change_reason: payload?.change_reason || "",
    is_current: payload?.is_current !== false,
  };
};

const normalizeVnbrokerHealth = (payload) => ({
  service_key: payload?.service_key || "",
  status: payload?.status || "unknown",
  last_check_at: payload?.last_check_at || null,
  last_success_at: payload?.last_success_at || null,
  consecutive_failures: Number(payload?.consecutive_failures || 0),
  avg_response_ms: payload?.avg_response_ms == null ? null : Number(payload.avg_response_ms),
  detail: payload?.detail || {},
});

const normalizeVnbrokerProviders = (payload) => ({
  primary: payload?.primary || "",
  fallback: Array.isArray(payload?.fallback) ? payload.fallback : [],
  enabled: payload?.enabled !== false,
  providers: Array.isArray(payload?.providers) ? payload.providers : [],
});

const normalizeVnbrokerProviderHealth = (payload) => {
  const rows = Array.isArray(payload?.providers) ? payload.providers : [];
  return {
    checked_at: payload?.checked_at || null,
    source: payload?.source || "unknown",
    providers: rows.map((row) => ({
      provider: row?.provider || "",
      label: row?.label || row?.provider || "",
      status: row?.status || "unknown",
      latency_ms: row?.latency_ms == null ? null : Number(row.latency_ms),
      success_rate: row?.success_rate == null ? null : Number(row.success_rate),
      error_rate: row?.error_rate == null ? null : Number(row.error_rate),
      total_requests: Number(row?.total_requests || 0),
      failed_requests: Number(row?.failed_requests || 0),
      last_success_at: row?.last_success_at || null,
      last_error: row?.last_error || "",
      circuit_state: row?.circuit_state || "unknown",
    })),
  };
};

const normalizeVnbrokerBenchmarkResult = (row) => ({
  provider: row?.provider || "",
  concurrency: Number(row?.concurrency || 0),
  runs: Number(row?.runs || 0),
  elapsed_seconds: Number(row?.elapsed_seconds || 0),
  total_requests: Number(row?.total_requests || 0),
  success_requests: Number(row?.success_requests || 0),
  rate_limited_requests: Number(row?.rate_limited_requests || 0),
  failed_requests: Number(row?.failed_requests || 0),
  timeout_errors: Number(row?.timeout_errors || 0),
  transport_errors: Number(row?.transport_errors || 0),
  rpm: Number(row?.requests_per_minute || 0),
  success_rate: Number(row?.success_pct || 0),
  rate_limit_pct: Number(row?.rate_limited_pct || 0),
  latency_ms: Math.round(Number(row?.p50_latency_seconds || 0) * 1000),
  p95_latency_ms: Math.round(Number(row?.p95_latency_seconds || 0) * 1000),
});

const normalizeVnbrokerBenchmark = (payload) => {
  const report = payload?.report || null;
  if (!report) {
    return { has_report: false, report: null };
  }
  return {
    has_report: true,
    report: {
      symbol: report.symbol || "",
      started_at: report.started_at || null,
      finished_at: report.finished_at || null,
      providers: Array.isArray(report.providers) ? report.providers : [],
      concurrency_levels: Array.isArray(report.concurrency_levels) ? report.concurrency_levels : [],
      results: (Array.isArray(report.results) ? report.results : []).map(
        normalizeVnbrokerBenchmarkResult,
      ),
      recommendation: report.recommendation || null,
    },
  };
};

const normalizeVnbrokerCircuitBreaker = (payload) => {
  const cb = payload?.circuit_breaker || {};
  const perProvider = payload?.per_provider || {};
  return {
    status: cb.status || "unknown",
    failures: Number(cb.failures || 0),
    threshold: Number(cb.threshold || 0),
    window_seconds: Number(cb.window_seconds || 0),
    cooldown_seconds: Number(cb.cooldown_seconds || 0),
    source: payload?.source || "unknown",
    per_provider: Object.fromEntries(
      Object.entries(perProvider).map(([key, value]) => [
        key,
        {
          status: value?.status || "unknown",
          failures: Number(value?.failures || 0),
        },
      ]),
    ),
  };
};

// `impactWarnings` trả về MÃ (không phải câu chữ) — panel lo sang i18n.
const normalizeVnbrokerPreview = (payload) => {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  const impact = payload?.impact || {};
  const impactWarnings = [];
  if (impact.providers_changed) impactWarnings.push("providers_changed");
  if (impact.timeout_changed) impactWarnings.push("timeout_changed");
  return {
    valid: payload?.valid !== false && errors.length === 0,
    validationErrors: errors,
    impactWarnings,
    configPayload: payload?.config_payload || {},
    providersCatalog: Array.isArray(payload?.providers_catalog) ? payload.providers_catalog : [],
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

    getSocSloOverview() {
      return coreGet("/operator/soc/overview/slo-overview/");
    },

    getSocServiceList(page = 1) {
      return coreGet(`/operator/soc/services/?page=${page}`);
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
    // `config` Ở ĐÂY là CONFIG PAYLOAD THẬT (timeout/max_retries/preferred_provider…),
    // KHÔNG phải envelope. Gửi envelope làm `config_payload` ⇒ BE `from_dict`
    // không đọc được key nào ở cấp 1 ⇒ toàn bộ chỉnh sửa của user bị mất
    // (audit Entry 384 §D1 F-01).
    getSocVnbrokerConfig() {
      return coreGet("/operator/soc/vnbroker/config/").then(normalizeVnbrokerConfig);
    },

    applySocVnbrokerConfig(config, options = {}) {
      const body = { config_payload: config, change_reason: options.changeReason || "" };
      if (options.expectedUpdatedAt) body.expected_updated_at = options.expectedUpdatedAt;
      return corePost("/operator/soc/vnbroker/config/", body).then(normalizeVnbrokerConfig);
    },

    previewSocVnbrokerConfig(config) {
      return corePost("/operator/soc/vnbroker/config/preview/", { config_payload: config }).then(
        normalizeVnbrokerPreview,
      );
    },

    getSocVnbrokerHealth() {
      return coreGet("/operator/soc/vnbroker/health/").then(normalizeVnbrokerHealth);
    },

    // Health PER PROVIDER — nguồn thật, không suy ra từ health cấp service.
    getSocVnbrokerProviderHealth() {
      return coreGet("/operator/soc/vnbroker/provider-health/").then(normalizeVnbrokerProviderHealth);
    },

    testSocVnbrokerConnection(provider = "vci") {
      return corePost("/operator/soc/vnbroker/test-connection/", { provider });
    },

    getSocVnbrokerProviders() {
      return coreGet("/operator/soc/vnbroker/providers/").then(normalizeVnbrokerProviders);
    },

    runSocVnbrokerBenchmark(payload = {}) {
      return corePost("/operator/soc/vnbroker/benchmark/", payload).then(normalizeVnbrokerBenchmark);
    },

    getSocVnbrokerBenchmarkLatest() {
      return coreGet("/operator/soc/vnbroker/benchmark/").then(normalizeVnbrokerBenchmark);
    },

    getSocVnbrokerCircuitBreaker() {
      return coreGet("/operator/soc/vnbroker/circuit-breaker-status/").then(
        normalizeVnbrokerCircuitBreaker,
      );
    },

    getSocVnbrokerOwnership() {
      return coreGet("/operator/soc/vnbroker/ownership/");
    },

    // ─── Operator users (A2) ─────────────────────────────────────────
    getSocUsers(params = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
      }
      const suffix = qs.toString();
      return coreGet(`/operator/soc/users/${suffix ? `?${suffix}` : ""}`);
    },

    setSocUserActive(userId, body) {
      return corePost(`/operator/soc/users/${encodeURIComponent(userId)}/set-active/`, body);
    },

    setSocUserPlan(userId, body) {
      return corePost(`/operator/soc/users/${encodeURIComponent(userId)}/set-plan/`, body);
    },

    // ─── Billing fleet (R2 refactor) ─────────────────────────────
    getSocBillingOverview() {
      return coreGet("/operator/soc/billing/overview/");
    },

    getSocBillingInvoices(params = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
      }
      const suffix = qs.toString();
      return coreGet(`/operator/soc/billing/invoices/${suffix ? `?${suffix}` : ""}`);
    },

    // ─── Usage fleet (R3 refactor) ───────────────────────────────
    getSocUsageOverview() {
      return coreGet("/operator/soc/usage/overview/");
    },

    // ─── Audit events (R4 refactor) ────────────────────────────
    getSocAuditEvents(params = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && String(v) !== "") qs.set(k, String(v));
      }
      const suffix = qs.toString();
      return coreGet(`/operator/soc/audit-events/${suffix ? `?${suffix}` : ""}`);
    },

    // ─── Staff switch (R5 refactor) ────────────────────────────
    staffSwitch(body) {
      return corePost("/operator/soc/staff/switch/", body);
    },

    // ─── Analytics fleet (R8) ──────────────────────────────────
    getSocAnalyticsGrowth(days = 30) {
      return coreGet(`/operator/soc/analytics/growth/?days=${days}`);
    },

    getSocAnalyticsCohorts() {
      return coreGet("/operator/soc/analytics/cohorts/");
    },

    getSocAnalyticsAlerts() {
      return coreGet("/operator/soc/analytics/alerts/");
    },

    // ─── Broker system config (B2.3) ─────────────────────────────────────
    getSocBrokerConfig() {
      return coreGet("/operator/soc/broker/config/");
    },

    applySocBrokerConfig(config, changeReason = "") {
      return corePost("/operator/soc/broker/config/apply/", {
        config_payload: config,
        change_reason: changeReason,
      });
    },

    previewSocBrokerConfig(config) {
      return corePost("/operator/soc/broker/config/preview/", { config_payload: config });
    },

    getSocBrokerAudit(limit = 50) {
      return coreGet(`/operator/soc/broker/audit/?limit=${limit}`);
    },

    getSocBrokerHealth() {
      return coreGet("/operator/soc/broker/health/");
    },

    getSocBrokerCredentials() {
      return coreGet("/operator/soc/broker/credentials/");
    },

    saveSocBrokerCredential(provider, secrets, purposes) {
      return corePost("/operator/soc/broker/credentials/", {
        provider,
        secrets,
        allowed_purposes: purposes,
      });
    },

    deleteSocBrokerCredential(provider) {
      return coreDelete(`/operator/soc/broker/credentials/${encodeURIComponent(provider)}/`);
    },

    testSocBrokerConnection(provider) {
      return corePost("/operator/soc/broker/test-connection/", { provider });
    },

    // ─── DataOps Market-Data Runtime ───────────────────────────────────────
    getSocDataOpsQueueTiers() {
      return coreGet("/operator/scraping/dataops/queue-tiers/").then((data) => {
        if (data && Array.isArray(data.tiers)) {
          return {
            ...data,
            tiers: data.tiers.map((t) => ({
              ...t,
              examples: t.examples || t.active_symbols || [],
              active_symbols: t.active_symbols || t.examples || [],
            })),
          };
        }
        return data;
      });
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
    getSocDataOpsRuntimeConfigSchema() {
      return coreGet("/operator/scraping/dataops/runtime-config/schema/");
    },

    applySocDataOpsRuntimeConfig(config, opts = {}) {
      return corePost("/operator/scraping/dataops/runtime-config/", {
        config_payload: config,
        ...opts,
      });
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
        // F-2: BE giờ trả ttl_minutes/ttl_seconds/cache_ttl_seconds live từ
        // config (trước đây chỉ đọc redis.ttl_minutes không tồn tại → 0 min).
        ttl_minutes: data.ttl_minutes ?? data.redis?.ttl_minutes ?? (
          data.cache_ttl_seconds != null ? Number((data.cache_ttl_seconds / 60).toFixed(1)) : 0
        ),
        ttl_seconds: data.ttl_seconds ?? data.cache_ttl_seconds ?? 0,
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

    // ─── Signals triage W2.2 (ack/mute trên deliveries của operator) ────────
    getSocSignalDeliveries(params = {}) {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.page_size) qs.set("page_size", String(params.page_size));
      if (params.delivery_state) qs.set("delivery_state", params.delivery_state);
      if (params.symbol) qs.set("symbol", params.symbol);
      if (params.unacked_only) qs.set("unacked_only", "true");
      const query = qs.toString();
      return coreGet(`/operator/soc/signals/deliveries/${query ? `?${query}` : ""}`);
    },

    markSocSignalDeliverySeen(deliveryId) {
      if (!deliveryId) throw new Error("deliveryId is required for markSocSignalDeliverySeen");
      return corePost(`/operator/soc/signals/deliveries/${encodeURIComponent(deliveryId)}/seen/`, {});
    },

    ackSocSignalDelivery(deliveryId) {
      if (!deliveryId) throw new Error("deliveryId is required for ackSocSignalDelivery");
      return corePost(`/operator/soc/signals/deliveries/${encodeURIComponent(deliveryId)}/ack/`, {});
    },

    muteSocSignalDeliveries(payload = {}) {
      return corePost("/operator/soc/signals/deliveries/mute/", payload);
    },

    // ─── Signals rules W2.3 (rule management + precision, bridge-write request) ──
    getSocSignalRules() {
      return coreGet("/operator/soc/signals/rules/");
    },

    getSocSignalRulesPerformance() {
      return coreGet("/operator/soc/signals/rules/performance/");
    },

    requestSocSignalRuleChange(payload = {}) {
      return corePost("/operator/soc/signals/rules/request/", payload);
    },

    feedbackSocSignalRule(payload = {}) {
      return corePost("/operator/soc/signals/rules/feedback/", payload);
    },

    getSocSignalStreamUrl(params = {}) {
      return `/operator/soc/signals/stream/${buildSignalsRecentQuery(params)}`;
    },

    getSocOverviewStreamUrl() {
      return "/operator/soc/overview/stream/";
    },

    getSocDataOpsStreamUrl() {
      return "/operator/soc/dataops/stream/";
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
      // SC-01: BE returns DRF paginated {count, next, previous, results: [...]} —
      // there is no `alerts` key. Map `results` so the Alerts card is not empty.
      return coreGet("/operator/soc/screener/alert-history/").then((data) => ({
        ...data,
        results: ((data.results || data.alerts) || []).map((alert, index) => ({
          id: alert.id || `alert-${index}`,
          symbol: alert.symbol,
          message: `${alert.rule || alert.rule_name || 'rule'}: ${alert.value ?? ''}`.trim(),
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

// Removed: no matching backend route and no call site, so each could only 404.
//   getSocHealthStatus()    -> /core/v1/operator/soc/health-status/  (the real
//     route is `/api/soc/overview/health-status/`, unreachable from a helper that
//     prefixes `/core/v1`)
//   getSocPrefetchMetrics() -> /core/v1/operator/soc/prefetch/metrics/
