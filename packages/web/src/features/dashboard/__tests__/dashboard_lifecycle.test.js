import { jest, describe, test, expect, beforeEach, afterEach } from "@jest/globals";

// Mock react BEFORE importing modules that use it
let mockStateVal = {};
let mockStateSetters = {};
let mockEffects = [];
let mockRefCurrent = {};

jest.unstable_mockModule("react", () => {
  return {
    useState: (initial) => {
      const stateKey = typeof initial === "function" ? "computed" : JSON.stringify(initial);
      if (!(stateKey in mockStateVal)) {
        mockStateVal[stateKey] = typeof initial === "function" ? initial() : initial;
      }
      const setter = (val) => {
        if (typeof val === "function") {
          mockStateVal[stateKey] = val(mockStateVal[stateKey]);
        } else {
          mockStateVal[stateKey] = val;
        }
        if (mockStateSetters[stateKey]) {
          mockStateSetters[stateKey](mockStateVal[stateKey]);
        }
      };
      return [mockStateVal[stateKey], setter];
    },
    useEffect: (effect, deps) => {
      mockEffects.push({ effect, deps });
    },
    useRef: (initial) => {
      const refKey = JSON.stringify(initial);
      if (!(refKey in mockRefCurrent)) {
        mockRefCurrent[refKey] = { current: initial };
      }
      return mockRefCurrent[refKey];
    },
    useCallback: (fn) => fn,
    createElement: () => ({}),
  };
});

// Import modules
const { useCoreDashboardData } = await import("../useCoreDashboardData.js");
const { collectUniqueSortedSymbols } = await import("../../../pages/DashboardPage.js");
const { coreApiAdapter } = await import("../../../adapters/coreApiAdapter.js");

describe("SaaS Native Dashboard Lifecycle Tests", () => {
  beforeEach(() => {
    mockStateVal = {};
    mockStateSetters = {};
    mockEffects = [];
    mockRefCurrent = {};
    jest.restoreAllMocks();
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

      // Simulate hook execution
      const hookResult = useCoreDashboardData({ portfolioId: 1, enabled: true });

      // We call the React useEffect logic manually
      const effectObj = mockEffects.find(e => e.deps && e.deps.some(d => d === 0)); // refreshToken is 0
      expect(effectObj).toBeDefined();

      // Run the load function inside useEffect
      const cleanup = effectObj.effect();

      // Wait for async load() to execute and resolve all promises
      await new Promise(resolve => setTimeout(resolve, 50));

      // Retrieve state values updated
      const stateKeys = Object.keys(mockStateVal);
      const stateKey = stateKeys.find(k => k.startsWith('{"loading":'));
      
      const stateUpdate = mockStateVal[stateKey];
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

      const effectObj = mockEffects.find(e => e.deps && e.deps.some(d => d === 0));
      expect(effectObj).toBeDefined();

      // Run effect
      effectObj.effect();

      // Wait for async load() to execute and resolve all promises
      await new Promise(resolve => setTimeout(resolve, 50));

      // After load, hasHydrated is set to true
      expect(mockStateVal["false"]).toBe(true);
    });
  });
});
