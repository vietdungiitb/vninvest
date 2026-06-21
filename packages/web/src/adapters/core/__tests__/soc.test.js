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

    it("getSocHealthStatus calls coreGet", async () => {
      await soc.getSocHealthStatus();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/health-status/");
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
  describe("VNBroker", () => {
    it("getSocVnbrokerConfig calls coreGet and normalizes", async () => {
      coreGet.mockResolvedValue({ status: "ok", config: { timeout: 30 } });
      const result = await soc.getSocVnbrokerConfig();
      expect(coreGet).toHaveBeenCalledWith("/operator/vnbroker/config/");
      expect(result.config).toEqual({ timeout: 30 });
    });

    it("applySocVnbrokerConfig calls corePost and normalizes", async () => {
      corePost.mockResolvedValue({ status: "saved", config_payload: { timeout: 30 } });
      const result = await soc.applySocVnbrokerConfig({ timeout: 30 });
      expect(corePost).toHaveBeenCalledWith("/operator/vnbroker/config/", { config_payload: { timeout: 30 } });
      expect(result.config_payload).toEqual({ timeout: 30 });
    });

    it("previewSocVnbrokerConfig calls corePost", async () => {
      await soc.previewSocVnbrokerConfig({ proxy: "auto" });
      expect(corePost).toHaveBeenCalledWith("/operator/vnbroker/config/preview/", { config_payload: { proxy: "auto" } });
    });

    it("getSocVnbrokerHealth calls coreGet and normalizes", async () => {
      coreGet.mockResolvedValue({ status: "healthy", avg_response_ms: 45 });
      const result = await soc.getSocVnbrokerHealth();
      expect(result.provider_health.healthy).toBe(1);
      expect(result.avg_response_ms).toBe(45);
    });

    it("testSocVnbrokerConnection calls corePost", async () => {
      await soc.testSocVnbrokerConnection();
      expect(corePost).toHaveBeenCalledWith("/operator/vnbroker/test-connection/");
    });

    it("getSocVnbrokerProviders calls coreGet", async () => {
      await soc.getSocVnbrokerProviders();
      expect(coreGet).toHaveBeenCalledWith("/operator/vnbroker/providers/");
    });

    it("runSocVnbrokerBenchmark calls corePost with payload", async () => {
      await soc.runSocVnbrokerBenchmark({ count: 100 });
      expect(corePost).toHaveBeenCalledWith("/operator/vnbroker/benchmark/", { count: 100 });
    });

    it("getSocVnbrokerBenchmarkLatest calls coreGet", async () => {
      await soc.getSocVnbrokerBenchmarkLatest();
      expect(coreGet).toHaveBeenCalledWith("/operator/vnbroker/benchmark/");
    });

    it("getSocVnbrokerCircuitBreaker calls coreGet", async () => {
      await soc.getSocVnbrokerCircuitBreaker();
      expect(coreGet).toHaveBeenCalledWith("/operator/vnbroker/circuit-breaker-status/");
    });

    it("getSocVnbrokerMetrics derives from health", async () => {
      coreGet.mockResolvedValue({ status: "healthy", avg_response_ms: "50" });
      const metrics = await soc.getSocVnbrokerMetrics();
      expect(metrics.throughput).toBe(20);
      expect(metrics.error_rate).toBe(0);
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

    it("getSocDataOpsRunLogs calls coreGet with page", async () => {
      await soc.getSocDataOpsRunLogs(5);
      expect(coreGet).toHaveBeenCalledWith("/operator/scraping/dataops/run-logs/?page=5");
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

      await soc.applySocDataOpsRuntimeConfig({ batch: 50 });
      expect(corePost).toHaveBeenCalledWith("/operator/scraping/dataops/runtime-config/", { config_payload: { batch: 50 } });

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
      expect(corePost).toHaveBeenCalledWith("/operator/prefetch/config/", { config_payload: { ttl: 600 } });
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

    it("purgeSocPrefetchCache calls corePost", async () => {
      await soc.purgeSocPrefetchCache();
      expect(corePost).toHaveBeenCalledWith("/operator/prefetch/purge-cache/");
    });

    it("warmSocPrefetchNow calls corePost with mode", async () => {
      await soc.warmSocPrefetchNow("sync");
      expect(corePost).toHaveBeenCalledWith("/operator/prefetch/warm-now/?mode=sync");
    });

    it("getSocPrefetchUniverseGroups / Schedule / Metrics call coreGet", async () => {
      await soc.getSocPrefetchUniverseGroups();
      expect(coreGet).toHaveBeenCalledWith("/operator/prefetch/universe-groups/");
      await soc.getSocPrefetchSchedule();
      expect(coreGet).toHaveBeenCalledWith("/operator/prefetch/task-schedule/");
      await soc.getSocPrefetchMetrics();
      expect(coreGet).toHaveBeenCalledWith("/operator/prefetch/metrics/");
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

    it("getSocScreenerAlerts maps alerts", async () => {
      coreGet.mockResolvedValue({ alerts: [{ symbol: "VCI", rule: "Volume Spike", timestamp: "T1", value: "2x" }] });
      const result = await soc.getSocScreenerAlerts();
      expect(result.results[0].message).toBe("Volume Spike: 2x");
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

    it("getSocScreenerTemplates calls coreGet", async () => {
      await soc.getSocScreenerTemplates();
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/screener/templates/");
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
      expect(result.config).toBeDefined();
    });

    it("getSocVnbrokerHealth falls back to unknown status", async () => {
      coreGet.mockResolvedValue({});
      const result = await soc.getSocVnbrokerHealth();
      expect(result.provider_health.critical).toBe(0);
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

    it("getSocVnbrokerMetrics handles unknown status", async () => {
      coreGet.mockResolvedValue({ status: "unknown", avg_response_ms: null });
      const metrics = await soc.getSocVnbrokerMetrics();
      expect(metrics.throughput).toBe(0);
      expect(metrics.error_rate).toBe(50);
    });

    it("encodeURIComponent is used for special characters in serviceKey", async () => {
      await soc.getSocServiceDetail("my service");
      expect(coreGet).toHaveBeenCalledWith("/operator/soc/services/my%20service/");
    });
  });
});
