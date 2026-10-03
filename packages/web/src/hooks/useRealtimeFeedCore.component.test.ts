import { describe, it, expect, vi } from "vitest";
import { normalizePollSymbolCandidates, resolveRealtimePollIntervalMs } from "./useRealtimeFeedCore.js";

describe("useRealtimeFeedCore helpers (W-14)", () => {
  describe("normalizePollSymbolCandidates", () => {
    it("filters market_discovery pseudo-symbol", () => {
      const result = normalizePollSymbolCandidates(["market_discovery", "VCI", "HPG"], {}, false);
      expect(result.symbols).not.toContain("MARKET_DISCOVERY");
      expect(result.symbols).toContain("VCI");
    });

    it("returns all symbols when ws is unhealthy", () => {
      const result = normalizePollSymbolCandidates(["VCI", "HPG"], {}, false);
      expect(result.symbols).toHaveLength(2);
      expect(result.hasOverThreshold).toBe(false);
    });

    it("marks stale_over_threshold and hasOverThreshold true", () => {
      const quotes: Record<string, unknown> = {
        HPG: { current_price: 100, stale_over_threshold: true, age_seconds: 100, stale_threshold_seconds: 30 } as unknown,
      };
      const result = normalizePollSymbolCandidates(["HPG"], quotes as any, true);
      expect(result.hasOverThreshold).toBe(true);
      expect(result.symbols).toContain("HPG");
    });

    it("when wsHealthy true, only returns staleOrMissing", () => {
      const quotes: Record<string, unknown> = {
        VCI: { current_price: 100, stale: false, freshness_seconds: 5 } as unknown,
        HPG: { current_price: 0, stale: true } as unknown,
      };
      const result = normalizePollSymbolCandidates(["VCI", "HPG"], quotes as any, true);
      expect(result.symbols).toContain("HPG");
      expect(result.symbols).not.toContain("VCI");
    });
  });

  describe("resolveRealtimePollIntervalMs", () => {
    it("wsHealthy false uses max(pollInterval,5000)", () => {
      const ms = resolveRealtimePollIntervalMs({
        wsHealthy: false,
        hasRecoveryCandidates: false,
        pollInterval: 10000,
        hasOverThresholdCandidates: false,
        staleResyncRetryMs: 3000,
        wsHealthyRecoveryPollIntervalMs: 8000,
        wsHealthyMinPollIntervalMs: 30000,
      } as any);
      expect(ms).toBe(10000);
    });

    it("wsHealthy true with recovery uses recovery interval", () => {
      const ms = resolveRealtimePollIntervalMs({
        wsHealthy: true,
        hasRecoveryCandidates: true,
        pollInterval: 10000,
        hasOverThresholdCandidates: false,
        staleResyncRetryMs: 3000,
        wsHealthyRecoveryPollIntervalMs: 8000,
        wsHealthyMinPollIntervalMs: 30000,
      } as any);
      expect(ms).toBe(8000);
    });

    it("hasOverThreshold forces min with staleResyncRetryMs", () => {
      const ms = resolveRealtimePollIntervalMs({
        wsHealthy: true,
        hasRecoveryCandidates: false,
        pollInterval: 30000,
        hasOverThresholdCandidates: true,
        staleResyncRetryMs: 3000,
        wsHealthyRecoveryPollIntervalMs: 8000,
        wsHealthyMinPollIntervalMs: 30000,
      } as any);
      expect(ms).toBe(3000);
    });
  });
});
