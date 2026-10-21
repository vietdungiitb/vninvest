import { jest } from '@jest/globals';
import { createSocClient } from "../soc.js";

describe("SOC adapter", () => {
  let coreGet;
  let corePost;
  let corePut;
  let corePatch;
  let coreDelete;
  let soc;

  beforeEach(() => {
    coreGet = jest.fn().mockResolvedValue({});
    corePost = jest.fn().mockResolvedValue({});
    corePut = jest.fn().mockResolvedValue({});
    corePatch = jest.fn().mockResolvedValue({});
    coreDelete = jest.fn().mockResolvedValue({});
    soc = createSocClient({ coreGet, corePost, corePut, corePatch, coreDelete });
  });

  // ─── Overview Domain ─────────────────────────────────────────────────────
  describe("Overview", () => {
    it("getSocOverviewSummary calls coreGet", async () => {
      await soc.getSocOverviewSummary();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/overview/");
    });

    it("getSocServiceList calls coreGet with page", async () => {
      await soc.getSocServiceList(2);
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/?page=2");
    });

    it("getSocSloOverview calls coreGet", async () => {
      await soc.getSocSloOverview();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/overview/slo-overview/");
    });

    it("P3 SSE: getSocOverviewStreamUrl returns stream path", async () => {
      expect(soc.getSocOverviewStreamUrl()).toBe("/operator/soc/overview/stream/");
    });

    it("exportSocConfigAudits calls coreGet with params", async () => {
      await soc.exportSocConfigAudits({ service_key: "vnbroker", limit: 100 });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/overview/export/audits/?service_key=vnbroker&limit=100");
    });

    it("exportSocRunLogs calls coreGet with params", async () => {
      await soc.exportSocRunLogs({ limit: 50 });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/overview/export/run-logs/?limit=50");
    });

    it("getSocServiceDetail calls coreGet with serviceKey", async () => {
      await soc.getSocServiceDetail("crawl-scheduler");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/crawl-scheduler/");
    });

    it("getSocServiceDetail throws without serviceKey", () => {
      expect(() => soc.getSocServiceDetail()).toThrow("serviceKey");
    });

    it("getSocServiceConfig calls coreGet", async () => {
      await soc.getSocServiceConfig("my-service");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/my-service/config/");
    });

    it("getSocServiceHealth calls coreGet", async () => {
      await soc.getSocServiceHealth("svc-01");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/svc-01/health/");
    });

    it("getSocServiceAudit calls coreGet with page", async () => {
      await soc.getSocServiceAudit("svc-01", 3);
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/svc-01/audit/?page=3");
    });

    it("getSocServiceHistory calls coreGet with page", async () => {
      await soc.getSocServiceHistory("svc-01", 1);
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/svc-01/history/?page=1");
    });
  });

  // ─── VNBroker Domain ─────────────────────────────────────────────────────
  // Contract test: assert SHAPE + giá trị thật, KHÔNG chỉ assert URL.
  // L-V04: test chỉ assert URL là xanh giả — contract lệch vẫn xanh
  // (audit Entry 384 §D1: 8 lỗi P0 tồn tại dù toàn bộ suite xanh).
  describe("VNBroker", () => {
    const CONFIG_PAYLOAD = {
      timeout: { connect: 10, read: 30, write: 10, pool: 5 },
      max_retries: 3,
      preferred_provider: "vci",
      fallback_providers: ["kbs", "dnse"],
    };

    it("getSocVnbrokerConfig trả config payload THẬT, không phải envelope", async () => {
      coreGet.mockResolvedValue({
        id: 6,
        service: 1,
        service_key: "vnbroker_quote",
        config_schema_version: "1.0",
        applied_by: "admin",
        is_current: true,
        config_payload: CONFIG_PAYLOAD,
        config: CONFIG_PAYLOAD,
        providers_catalog: [{ provider: "vci", label: "VCI" }],
      });
      const result = await soc.getSocVnbrokerConfig();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/config/");
      // payload thật nằm ở `config` — đây là thứ panel sửa
      expect(result.config.preferred_provider).toBe("vci");
      expect(result.config.timeout.read).toBe(30);
      // envelope KHÔNG được lẫn vào config (bug F-01)
      expect(result.config.id).toBeUndefined();
      expect(result.config.service).toBeUndefined();
      expect(result.providers_catalog).toHaveLength(1);
      expect(result.applied_by).toBe("admin");
    });

    it("applySocVnbrokerConfig gửi config_payload + change_reason + expected_updated_at", async () => {
      corePost.mockResolvedValue({ config_payload: CONFIG_PAYLOAD, config: CONFIG_PAYLOAD });
      const result = await soc.applySocVnbrokerConfig(CONFIG_PAYLOAD, {
        changeReason: "tang timeout read",
        expectedUpdatedAt: "2026-10-19T10:00:00Z",
      });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/vnbroker/config/", {
        config_payload: CONFIG_PAYLOAD,
        change_reason: "tang timeout read",
        expected_updated_at: "2026-10-19T10:00:00Z",
      });
      expect(result.config.preferred_provider).toBe("vci");
    });

    it("applySocVnbrokerConfig gửi payload sạch — không kèm field envelope", async () => {
      corePost.mockResolvedValue({ config_payload: CONFIG_PAYLOAD });
      await soc.applySocVnbrokerConfig(CONFIG_PAYLOAD, {});
      const body = corePost.mock.calls[0][1];
      expect(body.config_payload).toEqual(CONFIG_PAYLOAD);
      expect(body.config_payload.id).toBeUndefined();
      expect(body.config_payload.service).toBeUndefined();
      expect(body.config_payload.is_current).toBeUndefined();
    });

    it("previewSocVnbrokerConfig map errors -> validationErrors, impact -> mã cảnh báo", async () => {
      corePost.mockResolvedValue({
        valid: false,
        errors: ["max_retries phải trong khoảng [0, 10]"],
        config_payload: CONFIG_PAYLOAD,
        providers_catalog: [],
        impact: { providers_changed: true, timeout_changed: false },
      });
      const result = await soc.previewSocVnbrokerConfig(CONFIG_PAYLOAD);
      expect(corePost).toHaveBeenCalledWith("/operator/soc/vnbroker/config/preview/", {
        config_payload: CONFIG_PAYLOAD,
      });
      expect(result.valid).toBe(false);
      expect(result.validationErrors).toEqual(["max_retries phải trong khoảng [0, 10]"]);
      expect(result.impactWarnings).toEqual(["providers_changed"]);
    });

    it("getSocVnbrokerHealth KHÔNG tự chế provider_health", async () => {
      coreGet.mockResolvedValue({
        service_key: "vnbroker_quote",
        status: "healthy",
        avg_response_ms: 45,
        last_check_at: "2026-10-19T10:00:00Z",
        consecutive_failures: 0,
      });
      const result = await soc.getSocVnbrokerHealth();
      expect(result.status).toBe("healthy");
      expect(result.avg_response_ms).toBe(45);
      expect(result.last_check_at).toBe("2026-10-19T10:00:00Z");
      // KHÔNG còn provider_health bịa từ health cấp service (F-05)
      expect(result.provider_health).toBeUndefined();
    });

    it("getSocVnbrokerProviderHealth đọc số đo thật theo provider", async () => {
      coreGet.mockResolvedValue({
        checked_at: "2026-10-19T10:00:00Z",
        source: "runtime",
        providers: [
          {
            provider: "vci",
            label: "VCI",
            status: "healthy",
            latency_ms: 120,
            success_rate: 99.5,
            error_rate: 0.5,
            total_requests: 200,
          },
          { provider: "dnse", label: "DNSE", status: "degraded", latency_ms: null, success_rate: null },
        ],
      });
      const result = await soc.getSocVnbrokerProviderHealth();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/provider-health/");
      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].latency_ms).toBe(120);
      expect(result.providers[0].success_rate).toBe(99.5);
      // thiếu số đo => null, KHÔNG ép về 0 (tránh hiển thị "0ms" giả)
      expect(result.providers[1].latency_ms).toBeNull();
      expect(result.providers[1].success_rate).toBeNull();
    });

    it("testSocVnbrokerConnection gửi provider được chọn", async () => {
      corePost.mockResolvedValue({ provider: "kbs", status: "ok", latency_ms: 88 });
      const result = await soc.testSocVnbrokerConnection("kbs");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/vnbroker/test-connection/", { provider: "kbs" });
      expect(result.latency_ms).toBe(88);
    });

    it("getSocVnbrokerProviders trả primary + fallback (không bỏ)", async () => {
      coreGet.mockResolvedValue({
        primary: "vci",
        fallback: ["kbs", "dnse"],
        enabled: true,
        providers: [{ provider: "vci", label: "VCI", enabled: true, runtime_ready: true }],
      });
      const result = await soc.getSocVnbrokerProviders();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/providers/");
      expect(result.primary).toBe("vci");
      expect(result.fallback).toEqual(["kbs", "dnse"]);
      expect(result.enabled).toBe(true);
      expect(result.providers[0].runtime_ready).toBe(true);
    });

    it("runSocVnbrokerBenchmark đọc report.results và đổi tên field BE", async () => {
      corePost.mockResolvedValue({
        ok: true,
        has_report: true,
        report: {
          symbol: "VNM",
          providers: ["VCI"],
          concurrency_levels: [8],
          results: [
            {
              provider: "VCI",
              concurrency: 8,
              runs: 3,
              total_requests: 30,
              success_requests: 29,
              failed_requests: 1,
              rate_limited_requests: 0,
              timeout_errors: 0,
              transport_errors: 1,
              requests_per_minute: 120.5,
              rate_limited_pct: 0,
              success_pct: 96.67,
              p50_latency_seconds: 0.25,
              p95_latency_seconds: 0.4,
            },
          ],
          recommendation: {
            primary_provider: "VCI",
            fallback_provider: "KBS",
            adaptive_start_concurrency: 8,
          },
        },
      });
      const result = await soc.runSocVnbrokerBenchmark({ provider: "vci" });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/vnbroker/benchmark/", { provider: "vci" });
      expect(result.has_report).toBe(true);
      expect(result.report.results).toHaveLength(1);
      expect(result.report.results[0].latency_ms).toBe(250);
      expect(result.report.results[0].p95_latency_ms).toBe(400);
      expect(result.report.results[0].rpm).toBe(120.5);
      expect(result.report.results[0].success_rate).toBe(96.67);
      expect(result.report.results[0].rate_limit_pct).toBe(0);
      expect(result.report.recommendation.primary_provider).toBe("VCI");
    });

    it("getSocVnbrokerBenchmarkLatest trả has_report=false khi chưa có report", async () => {
      coreGet.mockResolvedValue({ has_report: false, report: null });
      const result = await soc.getSocVnbrokerBenchmarkLatest();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/benchmark/");
      expect(result.has_report).toBe(false);
      expect(result.report).toBeNull();
    });

    it("getSocVnbrokerCircuitBreaker đọc circuit_breaker.status + per_provider", async () => {
      coreGet.mockResolvedValue({
        source: "runtime",
        circuit_breaker: {
          status: "open",
          failures: 5,
          threshold: 5,
          window_seconds: 60,
          cooldown_seconds: 300,
        },
        per_provider: { vci: { status: "closed", failures: 0 }, kbs: { status: "open", failures: 7 } },
      });
      const result = await soc.getSocVnbrokerCircuitBreaker();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/circuit-breaker-status/");
      expect(result.status).toBe("open");
      expect(result.failures).toBe(5);
      expect(result.threshold).toBe(5);
      expect(result.per_provider.vci.status).toBe("closed");
      expect(result.per_provider.kbs.failures).toBe(7);
    });

    it("getSocVnbrokerOwnership calls coreGet", async () => {
      await soc.getSocVnbrokerOwnership();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/vnbroker/ownership/");
    });

    it("KHÔNG còn getSocVnbrokerMetrics — số liệu throughput/error_rate từng bịa (F-06)", async () => {
      expect(soc.getSocVnbrokerMetrics).toBeUndefined();
    });
  });

  // ─── DataOps Market-Data Runtime ─────────────────────────────────────────
  describe("DataOps", () => {
    it("getSocDataOpsQueueTiers calls coreGet", async () => {
      await soc.getSocDataOpsQueueTiers();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/queue-tiers/");
    });

    it("getSocDataOpsCoverage calls coreGet", async () => {
      await soc.getSocDataOpsCoverage();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/coverage/");
    });

    it("getSocDataOpsObservability calls coreGet", async () => {
      await soc.getSocDataOpsObservability();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/observability/");
    });

    // Slice G (QueueRecovery): queue_depths đi qua adapter nguyên vẹn
    it("getSocDataOpsObservability passes queue_depths through", async () => {
      coreGet.mockResolvedValueOnce({
        queue_depths: { realtime_prefetch: 5000, celery: 3 },
      });
      const data = await soc.getSocDataOpsObservability();
      expect(data.queue_depths).toEqual({ realtime_prefetch: 5000, celery: 3 });
    });

    it("getSocDataOpsRunLogs calls coreGet with page", async () => {
      await soc.getSocDataOpsRunLogs(5);
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/run-logs/?page=5&page_size=20");
    });
  });

  // ─── Service Management ──────────────────────────────────────────────────
  describe("Service Management", () => {
    it("updateSocService calls corePatch", async () => {
      await soc.updateSocService("svc-01", { enabled: false });
      expect(corePatch).toHaveBeenCalledWith("/operator/soc/services/svc-01/", { enabled: false });
    });

    it("triggerSocServiceHealthCheck calls corePost", async () => {
      await soc.triggerSocServiceHealthCheck("svc-01");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/services/svc-01/health-check/");
    });

    it("applySocServiceConfig calls corePost with reason", async () => {
      await soc.applySocServiceConfig("svc-01", { retry: 5 }, "tuning");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/services/svc-01/config/", {
        config_payload: { retry: 5 },
        change_reason: "tuning",
      });
    });

    it("resetSocServiceConfig calls corePost", async () => {
      await soc.resetSocServiceConfig("svc-01", "rollback");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/services/svc-01/config/reset/", {
        change_reason: "rollback",
      });
    });

    it("purgeSocDataOpsRunLogs calls corePost with keep", async () => {
      await soc.purgeSocDataOpsRunLogs(100);
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/run-logs/purge/?keep=100");
    });

    it("previewSocDataOpsPlanner calls corePost", async () => {
      await soc.previewSocDataOpsPlanner({ mode: "fast" });
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/planner/preview/", { mode: "fast" });
    });

    it("runSocDataOpsPlanner calls corePost", async () => {
      await soc.runSocDataOpsPlanner({ mode: "full" });
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/planner/run/", { mode: "full" });
    });

    it("abortSocDataOpsPlannerRun calls corePost and throws without runId", () => {
      soc.abortSocDataOpsPlannerRun("run-123");
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/planner/run/run-123/abort/");
      expect(() => soc.abortSocDataOpsPlannerRun()).toThrow("runId");
    });

    it("getSocDataOpsRuntimeConfig / apply / preview / audit / inventory", async () => {
      await soc.getSocDataOpsRuntimeConfig();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/runtime-config/");

      await soc.getSocDataOpsRuntimeConfigSchema();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/runtime-config/schema/");

      await soc.applySocDataOpsRuntimeConfig({ batch: 50 });
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/runtime-config/", { config_payload: { batch: 50 } });

      await soc.applySocDataOpsRuntimeConfig({ batch: 50 }, { expected_updated_at: "2026-09-18T07:00:00Z", change_reason: "test" });
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/runtime-config/", {
        config_payload: { batch: 50 },
        expected_updated_at: "2026-09-18T07:00:00Z",
        change_reason: "test",
      });

      await soc.previewSocDataOpsRuntimeConfig({ batch: 50 });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/dataops/runtime-config/preview/", { config_payload: { batch: 50 } });

      await soc.getSocDataOpsRuntimeConfigAudit(2);
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/runtime-config/audit/?page=2");

      await soc.getSocDataOpsInventory();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/inventory/");
    });
  });

  // ─── Scheduler Control Center ────────────────────────────────────────────
  describe("Scheduler", () => {
    it("getSocSchedulerPlan calls coreGet", async () => {
      await soc.getSocSchedulerPlan();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/scheduler/plan/");
    });

    it("getSocSchedulerHealth calls coreGet", async () => {
      await soc.getSocSchedulerHealth();
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/scheduler/health/");
    });

    it("getSocSchedulerJobHistory calls coreGet with params", async () => {
      await soc.getSocSchedulerJobHistory("job-01", 2, 50);
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/scheduler/jobs/job-01/history/?page=2&page_size=50");
    });

    it("postSocSchedulerJobAction calls corePost", async () => {
      await soc.postSocSchedulerJobAction("job-01", "pause", "maintenance");
      expect(corePost).toHaveBeenCalledWith(
        "/operator/scraping/dataops/scheduler/jobs/job-01/actions/",
        { action: "pause", reason: "maintenance" }
      );
    });
  });

  // ─── Prefetch ────────────────────────────────────────────────────────────
  describe("Prefetch", () => {
    it("getSocPrefetchConfig calls coreGet and normalizes", async () => {
      coreGet.mockResolvedValue({ config: { ttl: 300 } });
      const result = await soc.getSocPrefetchConfig();
      expect(result.config).toEqual({ ttl: 300 });
    });

    it("applySocPrefetchConfig calls corePost", async () => {
      await soc.applySocPrefetchConfig({ ttl: 600 });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/prefetch/config/", { config_payload: { ttl: 600 } });
    });

    it("getSocPrefetchProfiles maps profiles", async () => {
      coreGet.mockResolvedValue({ profiles: ["fast", "deep"], descriptions: { fast: "Fast scan" } });
      const result = await soc.getSocPrefetchProfiles();
      expect(result.results).toHaveLength(2);
      expect(result.results[0].name).toBe("fast");
    });

    it("getSocPrefetchCacheStatus computes hit_rate and size_mb", async () => {
      coreGet.mockResolvedValue({ hit_ratio: 0.85, redis: { memory_usage_mb: 128, ttl_minutes: 15 } });
      const result = await soc.getSocPrefetchCacheStatus();
      expect(result.hit_rate).toBe(85);
      expect(result.size_mb).toBe(128);
    });

    it("getSocPrefetchCacheStatus prefers live ttl_minutes, falls back to cache_ttl_seconds", async () => {
      coreGet.mockResolvedValue({ hit_ratio: 0.816, redis: { memory_usage_mb: 125 }, ttl_minutes: 0.4, ttl_seconds: 25, cache_ttl_seconds: 25 });
      const live = await soc.getSocPrefetchCacheStatus();
      expect(live.ttl_minutes).toBe(0.4);
      expect(live.ttl_seconds).toBe(25);

      coreGet.mockResolvedValue({ hit_ratio: 0.5, redis: { memory_usage_mb: 10 }, cache_ttl_seconds: 30 });
      const fallback = await soc.getSocPrefetchCacheStatus();
      expect(fallback.ttl_minutes).toBe(0.5);
    });

    it("previewSocPrefetchConfig posts config_payload to preview endpoint", async () => {
      corePost.mockResolvedValue({ valid: true, errors: [], change_summary: ["batch_size"] });
      const result = await soc.previewSocPrefetchConfig({ batch_size: 40 });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/prefetch/config/preview/", { config_payload: { batch_size: 40 } });
      expect(result.valid).toBe(true);
      expect(result.change_summary).toEqual(["batch_size"]);
    });

    it("purgeSocPrefetchCache calls corePost", async () => {
      await soc.purgeSocPrefetchCache();
      expect(corePost).toHaveBeenCalledWith("/operator/soc/prefetch/purge-cache/");
    });

    it("warmSocPrefetchNow calls corePost with mode and body", async () => {
      await soc.warmSocPrefetchNow("sync");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/prefetch/warm-now/?mode=sync", {});
    });

    it("warmSocPrefetchNow includes universe_group_ids when provided", async () => {
      await soc.warmSocPrefetchNow("sync", { groups: ["vn100"] });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/prefetch/warm-now/?mode=sync", { universe_group_ids: ["vn100"] });
    });

    it("getSocPrefetchUniverseGroups / Schedule call coreGet", async () => {
      await soc.getSocPrefetchUniverseGroups();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/prefetch/universe-groups/");
      await soc.getSocPrefetchSchedule();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/prefetch/task-schedule/");
    });
  });

  // ─── Signals (Read-Only) ─────────────────────────────────────────────────
  describe("Signals", () => {
    const signalPaths = [
      ["getSocSignalConfig", "/operator/soc/signals/config/"],
      ["getSocSignalOwnership", "/operator/soc/signals/ownership/"],
      ["getSocWhaleDetection", "/operator/soc/signals/whale/"],
      ["getSocDarkPoolDetection", "/operator/soc/signals/dark-pool/"],
      ["getSocScreenerDetection", "/operator/soc/signals/screener/"],
      ["getSocSignalRetention", "/operator/soc/signals/retention-policy/"],
      ["getSocSignalMetrics", "/operator/soc/signals/summary/"],
    ];

    it.each(signalPaths)("%s calls coreGet with %s", async (method, expectedUrl) => {
      await soc[method]();
      expect(coreGet).toHaveBeenCalledWith(expectedUrl);
    });

    it("getSocSignalConfig normalizes config", async () => {
      coreGet.mockResolvedValue({ config_payload: { window: 60 } });
      const result = await soc.getSocSignalConfig();
      expect(result.config).toEqual({ window: 60 });
    });

    it("recent endpoints accept paging/filter params and keep bare URLs by default", async () => {
      await soc.getSocWhaleRecent();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/whale/recent/");
      await soc.getSocDarkPoolRecent({ page_size: 100, severity: "high" });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/dark-pool/recent/?page_size=100&severity=high");
      await soc.getSocScreenerRecent({ page: 2, symbol: "VCI", direction: "buy" });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/screener/recent/?page=2&symbol=VCI&direction=buy");
    });

    it("testSocWhaleDetection posts symbol and previewSocSignalRetention posts payload", async () => {
      await soc.testSocWhaleDetection("VNM");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/whale/test/", { symbol: "VNM" });
      await soc.previewSocSignalRetention({ intraday_tick_retention_days: 7 });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/retention-policy/preview/", {
        config_payload: { intraday_tick_retention_days: 7 },
      });
    });

    it("exportSocSignalFeed calls feed export with type and filters", async () => {
      await soc.exportSocSignalFeed({ type: "whale", symbol: "VCI" });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/feed/export/?type=whale&symbol=VCI");
    });

    it("triage: deliveries/seen/ack/mute hit the right endpoints", async () => {
      await soc.getSocSignalDeliveries({ page_size: 100, unacked_only: true });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/deliveries/?page_size=100&unacked_only=true");
      await soc.markSocSignalDeliverySeen("d-1");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/deliveries/d-1/seen/", {});
      await soc.ackSocSignalDelivery("d-1");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/deliveries/d-1/ack/", {});
      await soc.muteSocSignalDeliveries({ symbol: "VCI", mute_minutes: 60, reason: "noise" });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/deliveries/mute/", {
        symbol: "VCI",
        mute_minutes: 60,
        reason: "noise",
      });
    });

    it("triage: seen/ack throw without deliveryId", () => {
      expect(() => soc.markSocSignalDeliverySeen()).toThrow("deliveryId");
      expect(() => soc.ackSocSignalDelivery()).toThrow("deliveryId");
    });

    it("W2.3 rules: list/performance GET + request/feedback POST hit right endpoints", async () => {
      await soc.getSocSignalRules();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/rules/");
      await soc.getSocSignalRulesPerformance();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/signals/rules/performance/");
      await soc.requestSocSignalRuleChange({ rule_key: "whale_threshold_vnd", threshold_vnd: 500000000, change_reason: "noise" });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/rules/request/", {
        rule_key: "whale_threshold_vnd",
        threshold_vnd: 500000000,
        change_reason: "noise",
      });
      await soc.feedbackSocSignalRule({ alert_id: "a-1", signal: "down", reason: "inaccurate" });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/signals/rules/feedback/", {
        alert_id: "a-1",
        signal: "down",
        reason: "inaccurate",
      });
    });

    it("P2c SSE: getSocSignalStreamUrl builds path with query", () => {
      expect(soc.getSocSignalStreamUrl({ type: "whale", symbol: "VCI" })).toBe(
        "/operator/soc/signals/stream/?type=whale&symbol=VCI",
      );
      expect(soc.getSocSignalStreamUrl({})).toBe("/operator/soc/signals/stream/");
    });

    it("P1-1 DataOps SSE: getSocDataOpsStreamUrl builds path", () => {
      expect(soc.getSocDataOpsStreamUrl()).toBe("/operator/soc/dataops/stream/");
    });
  });

  // ─── Screener ────────────────────────────────────────────────────────────
  describe("Screener", () => {
    it("getSocScreenerConfig calls coreGet and normalizes", async () => {
      await soc.getSocScreenerConfig();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/screener/config/");
    });

    it("applySocScreenerConfig calls corePost", async () => {
      await soc.applySocScreenerConfig({ scan: true });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/screener/config/", { config_payload: { scan: true } });
    });

    it("getSocScreenerRules maps rules", async () => {
      coreGet.mockResolvedValue({ rules: [{ type: "gap", name: "Gap Up" }, { type: "volume" }] });
      const result = await soc.getSocScreenerRules(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].name).toBe("Gap Up");
      expect(result.results[1].id).toBe("volume-1");
    });

    it("getSocScreenerResults maps results", async () => {
      coreGet.mockResolvedValue({ symbols_matched: [{ symbol: "VCI", rule: "gap", timestamp: "T1", value: 1.5 }] });
      const result = await soc.getSocScreenerResults(1);
      expect(result.results[0].symbol).toBe("VCI");
    });

    it("getSocScreenerAlerts maps paginated results (BE contract)", async () => {
      coreGet.mockResolvedValue({ count: 1, next: null, previous: null, results: [{ symbol: "VCI", rule: "Volume Spike", timestamp: "T1", value: "2x" }] });
      const result = await soc.getSocScreenerAlerts();
      expect(result.results).toHaveLength(1);
      expect(result.results[0].message).toBe("Volume Spike: 2x");
    });

    it("getSocScreenerAlerts returns empty list when no result key", async () => {
      coreGet.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
      const result = await soc.getSocScreenerAlerts();
      expect(result.results).toEqual([]);
    });

    it("manualSocScreenerScan calls corePost", async () => {
      await soc.manualSocScreenerScan(["VCI", "VNM"]);
      expect(corePost).toHaveBeenCalledWith("/operator/soc/screener/manual-scan/", { symbols: ["VCI", "VNM"] });
    });

    it("createSocScreenerRule calls corePost", async () => {
      await soc.createSocScreenerRule({ type: "volume", threshold: 1.5 });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/screener/rules/", { type: "volume", threshold: 1.5 });
    });

    it("updateSocScreenerRule calls corePut", async () => {
      await soc.updateSocScreenerRule("rule-1", { threshold: 2 });
      expect(corePut).toHaveBeenCalledWith("/operator/soc/screener/rules/rule-1/", { threshold: 2 });
    });

    it("deleteSocScreenerRule calls coreDelete", async () => {
      await soc.deleteSocScreenerRule("rule-1");
      expect(coreDelete).toHaveBeenCalledWith("/operator/soc/screener/rules/rule-1/delete/");
    });

    it("getSocScreenerMetrics derives from results", async () => {
      coreGet.mockResolvedValue({ symbols_scanned: 200, alerts_triggered: 10, scan_duration_ms: 1500 });
      const metrics = await soc.getSocScreenerMetrics();
      expect(metrics.rules_hit_rate).toBe(5);
      expect(metrics.avg_scan_duration_ms).toBe(1500);
    });
  });

  // ─── Matrix ──────────────────────────────────────────────────────────────
  describe("Matrix", () => {
    it("getSocMatrixCycle calls coreGet with cycleId", async () => {
      await soc.getSocMatrixCycle("cycle-42");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/matrix/cycles/cycle-42/");
    });

    it("startSocMatrixCycle calls corePost", async () => {
      await soc.startSocMatrixCycle({ symbols: ["VCI"] });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/matrix/cycles/start/", { symbols: ["VCI"] });
    });

    it("abortSocMatrixCycle calls corePost", async () => {
      await soc.abortSocMatrixCycle("cycle-42");
      expect(corePost).toHaveBeenCalledWith("/operator/soc/matrix/cycles/cycle-42/abort/");
    });

    it("getSocMatrixProviders calls coreGet", async () => {
      await soc.getSocMatrixProviders();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/matrix/providers/");
    });

    it("getSocMatrixMonitor calls coreGet with cycleId param", async () => {
      await soc.getSocMatrixMonitor("cycle-42");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/matrix/monitor/?cycle_id=cycle-42");
    });
  });

  // ─── Symbol Groups ───────────────────────────────────────────────────────
  describe("Symbol Groups", () => {
    it("getSocSymbolGroups calls coreGet", async () => {
      await soc.getSocSymbolGroups();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/symbol-groups/");
    });

    it("createSocSymbolGroup calls corePost", async () => {
      await soc.createSocSymbolGroup({ name: "Blue Chips", symbols: ["VCI", "VNM"] });
      expect(corePost).toHaveBeenCalledWith("/operator/soc/symbol-groups/", { name: "Blue Chips", symbols: ["VCI", "VNM"] });
    });

    it("updateSocSymbolGroup calls corePut", async () => {
      await soc.updateSocSymbolGroup("blue-chips", { symbols: ["VCI"] });
      expect(corePut).toHaveBeenCalledWith("/operator/soc/symbol-groups/blue-chips/", { symbols: ["VCI"] });
    });

    it("deleteSocSymbolGroup calls coreDelete", async () => {
      await soc.deleteSocSymbolGroup("blue-chips");
      expect(coreDelete).toHaveBeenCalledWith("/operator/soc/symbol-groups/blue-chips/");
    });
  });

  // ─── Backfill Progress API ───────────────────────────────────────────────
  describe("Backfill", () => {
    it("getSocBackfillRuns calls coreGet with query params", async () => {
      await soc.getSocBackfillRuns({ status: "running", limit: 10 });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/backfill/runs/?status=running&limit=10");
    });

    it("getSocBackfillRunDetail calls coreGet with runId", async () => {
      await soc.getSocBackfillRunDetail("run-abc");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/backfill/runs/run-abc/");
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("normalizeConfigEnvelope handles missing config", async () => {
      coreGet.mockResolvedValue({ status: "ok" });
      const result = await soc.getSocVnbrokerConfig();
      expect(result.config).toEqual({});
    });

    it("getSocVnbrokerHealth falls back to unknown status", async () => {
      coreGet.mockResolvedValue({});
      const result = await soc.getSocVnbrokerHealth();
      expect(result.status).toBe("unknown");
      expect(result.avg_response_ms).toBeNull();
      expect(result.consecutive_failures).toBe(0);
    });

    it("getSocBackfillRuns defaults limit=20", async () => {
      await soc.getSocBackfillRuns({});
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/backfill/runs/?limit=20");
    });

    it("getSocBackfillRuns omits params when status/jobKey not provided", async () => {
      await soc.getSocBackfillRuns({ limit: 10 });
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/dataops/backfill/runs/?limit=10");
    });

    it("getSocScreenerMetrics handles zero scanned symbols", async () => {
      coreGet.mockResolvedValue({ symbols_scanned: 0, alerts_triggered: 0 });
      const metrics = await soc.getSocScreenerMetrics();
      expect(metrics.rules_hit_rate).toBe(0);
    });

    it("getSocVnbrokerProviderHealth trả mảng rỗng khi BE chưa có nguồn số liệu", async () => {
      coreGet.mockResolvedValue({});
      const result = await soc.getSocVnbrokerProviderHealth();
      expect(result.providers).toEqual([]);
      expect(result.source).toBe("unknown");
    });

    it("encodeURIComponent is used for special characters in serviceKey", async () => {
      await soc.getSocServiceDetail("my service");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/my%20service/");
    });
  });
});
