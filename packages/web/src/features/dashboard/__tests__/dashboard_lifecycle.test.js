import { jest, describe, test, expect, beforeEach, beforeAll } from "@jest/globals";

// Scoped manual mock: the fake React harness lives in test/mocks/, NOT in
// <rootDir>/__mocks__/ — Jest auto-applies a node-module manual mock to every
// suite, which broke 11/18 suites. See test/mocks/react.js + ledger Entry 234.
//
// ESM: this package is `"type": "module"`, so `require` does not exist here.
// Use `jest.unstable_mockModule` + a dynamic `import()` in the factory.
jest.unstable_mockModule("react", () => import("../../../../test/mocks/react.js"));

let useCoreDashboardData;
let collectUniqueSortedSymbols;
let coreApiAdapter;
let mockReact;

beforeAll(async () => {
  // Must resolve the mock BEFORE the hook under test is imported, otherwise
  // `useCoreDashboardData` captures the real React and its state is invisible.
  mockReact = await import("react");
  ({ useCoreDashboardData } = await import("../useCoreDashboardData.js"));
  ({ collectUniqueSortedSymbols } = await import("../../../utils/dashboardSymbols.js"));
  ({ coreApiAdapter } = await import("../../../adapters/coreApiAdapter.js"));
});

describe("SaaS Native Dashboard Lifecycle Tests", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockReact._resetMockState();
  });

  // ---------------------------------------------------------------------------
  // Scenario 4 & 2: readyToken Stable Sorting, Deduplication, and Empty States
  // ---------------------------------------------------------------------------
  describe("collectUniqueSortedSymbols (Set Semantics readyToken)", () => {
    test("Deduplicates, normalizes, and sorts symbols alphabetically", () => {
      const holdings = [{ symbol: "vcb " }, { symbol: "fpt" }];
      const trackedSymbols = [{ symbol: "FPT" }, { symbol: "tpb" }];
      const watchlists = [{ items: [{ symbol: "vnm" }, { symbol: "VCB" }] }];
      const watchlistGroups = [{ items: [{ symbol: "tpb" }] }];

      const token = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, watchlistGroups);
      expect(token).toBe("FPT|TPB|VCB|VNM");
    });

    test("Reordering list items does not change the serialized token (prevents WS churn)", () => {
      const listA = collectUniqueSortedSymbols([{ symbol: "VCB" }, { symbol: "FPT" }], [], [], []);
      const listB = collectUniqueSortedSymbols([{ symbol: "FPT" }, { symbol: "VCB" }], [], [], []);

      expect(listA).toBe(listB);
      expect(listA).toBe("FPT|VCB");
    });

    test("Handles empty or null lists gracefully by returning an empty string", () => {
      const token = collectUniqueSortedSymbols(null, [], undefined, []);
      expect(token).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 1 & 3: Phase 2 Degradation & SWR hasHydrated Lifecycle
  // ---------------------------------------------------------------------------
  describe("useCoreDashboardData hook logic & error isolation", () => {
    test("Degrades gracefully with [ERR_CORE_BULK_TECHNICAL_03] when Phase 2 fails, but Phase 1 displays", async () => {
      // Mock Phase 1 resolves successfully
      jest.spyOn(coreApiAdapter, "getPortfolioHoldings").mockResolvedValue({
        results: [{ symbol: "VCB", quantity: 100 }],
      });
      jest.spyOn(coreApiAdapter, "getPortfolioSummary").mockResolvedValue({
        portfolio_id: 1,
        net_value: 50000000,
      });
      jest.spyOn(coreApiAdapter, "getPortfolioAnalytics").mockResolvedValue({
        sharpe_ratio: 1.5,
      });
      jest.spyOn(coreApiAdapter, "getWatchlists").mockResolvedValue({ results: [] });
      jest.spyOn(coreApiAdapter, "getTrackedSymbols").mockResolvedValue({ results: [] });
      jest.spyOn(coreApiAdapter, "getLegacyWatchlistGroups").mockResolvedValue({ results: [] });

      // Mock Phase 2 fails (e.g. timeout 504)
      jest.spyOn(coreApiAdapter, "getBulkTechnicalsBySymbols").mockRejectedValue(
        new Error("Bulk technicals timed out")
      );

      const hookResult = useCoreDashboardData({ portfolioId: 1, enabled: true });

      const m = mockReact;
      const effectObj = m._getMockEffects().find(e => e.deps && e.deps.some(d => d === 0));
      expect(effectObj).toBeDefined();

      // Run the load function inside useEffect
      const cleanup = effectObj.effect();

      // Wait for async load() to execute and resolve all promises
      await new Promise(resolve => setTimeout(resolve, 200));

      // Retrieve state values updated (state lives inside __mocks__/react.js)
      const stateKeys = Object.keys(m._getMockState());
      const stateKey = stateKeys.find(k => k.startsWith('{"loading":'));
      const stateUpdate = m._getMockState()[stateKey];
      expect(stateUpdate.holdings).toEqual([{ symbol: "VCB", quantity: 100 }]);
      expect(stateUpdate.technicals).toEqual([]);
      expect(stateUpdate.technicalsStatus).toEqual({
        status: "failed",
        errorCode: "[ERR_CORE_BULK_TECHNICAL_03]",
      });

      if (cleanup) cleanup();
    });

    test("Checks hasHydrated turns true after resolve, preventing loader skeletons on refresh/polling", async () => {
      jest.spyOn(coreApiAdapter, "getPortfolioHoldings").mockResolvedValue({ results: [] });
      jest.spyOn(coreApiAdapter, "getPortfolioSummary").mockResolvedValue({ net_value: 0 });
      jest.spyOn(coreApiAdapter, "getPortfolioAnalytics").mockResolvedValue({});
      jest.spyOn(coreApiAdapter, "getWatchlists").mockResolvedValue({ results: [] });
      jest.spyOn(coreApiAdapter, "getTrackedSymbols").mockResolvedValue({ results: [] });
      jest.spyOn(coreApiAdapter, "getLegacyWatchlistGroups").mockResolvedValue({ results: [] });

      const hookResult = useCoreDashboardData({ portfolioId: 1, enabled: true });

      const m = mockReact;
      const effectObj = m._getMockEffects().find(e => e.deps && e.deps.some(d => d === 0));
      expect(effectObj).toBeDefined();

      // Run effect
      effectObj.effect();

      // Wait for async load() to execute and resolve all promises
      await new Promise(resolve => setTimeout(resolve, 200));

      // After load, hasHydrated is set to true  → useState(false) key is "false"
      expect(m._getMockState()["false"]).toBe(true);
    });
  });
});
