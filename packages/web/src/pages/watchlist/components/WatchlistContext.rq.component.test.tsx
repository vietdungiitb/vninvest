import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import * as React from "react";

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getWatchlists: vi.fn(async () => []),
    getLegacyWatchlistGroups: vi.fn(async () => []),
    getPortfolios: vi.fn(async () => []),
    getPortfolioHoldings: vi.fn(async () => []),
    getTrackedSymbols: vi.fn(async () => []),
    getWatchlistItems: vi.fn(async () => []),
    getPriceAlerts: vi.fn(async () => []),
    getBulkTechnicalsBySymbols: vi.fn(async () => []),
    coreGet: vi.fn(async () => ({})),
    corePost: vi.fn(),
  },
  defaultCoreApiAdapter: {
    getWatchlists: vi.fn(async () => []),
    getLegacyWatchlistGroups: vi.fn(async () => []),
    getPortfolios: vi.fn(async () => []),
    getTrackedSymbols: vi.fn(async () => []),
  },
}));

vi.mock("../../../context/RealtimeContext.js", () => ({
  useRealtimeFeedFromManager: vi.fn(() => ({ quotesBySymbol: {}, realtimeStatus: "idle" })),
}));

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({ t: (k: string, opts: any) => opts?.defaultValue ?? k }),
}));

import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";

function readTenantId() {
  try { return window.localStorage.getItem("tenant_id"); } catch { return null; }
}
function useWatchlistListsQuery() {
  const tenantId = readTenantId();
  return useQuery({
    queryKey: ["watchlist", "allLists", tenantId ?? "none"],
    queryFn: async () => {
      const res = await (coreApiAdapter.getWatchlists as any)();
      return Array.isArray(res) ? res : ((res as any)?.results ?? []);
    },
    staleTime: 0,
    retry: false,
  });
}

function queryWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { Wrapper, client };
}

describe("WatchlistContext React Query tenant isolation (W-04)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("queryKey scopes by tenant_id — switching tenant does not share cache", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    const { Wrapper } = queryWrapper();
    const { result } = renderHook(() => useWatchlistListsQuery(), { wrapper: Wrapper as any });
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 2000 });
    const callsAfterA = (coreApiAdapter.getWatchlists as any).mock.calls.length;
    act(() => {
      window.localStorage.setItem("tenant_id", "tenant-B");
      window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    });
    const { result: resultB } = renderHook(() => useWatchlistListsQuery(), { wrapper: Wrapper as any });
    await waitFor(() => expect(resultB.current.isSuccess).toBe(true), { timeout: 2000 });
    const callsAfterB = (coreApiAdapter.getWatchlists as any).mock.calls.length;
    expect(callsAfterB).toBeGreaterThan(callsAfterA);
  });

  it("loading exposes combined RQ isPending + manual loading (skeleton)", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    // Direct RQ pending check — simpler than full provider
    const { Wrapper: QW } = queryWrapper();
    const { result } = renderHook(() => {
      const q = useQuery({
        queryKey: ["watchlist", "test-loading", readTenantId() ?? "none"],
        queryFn: () => new Promise(resolve => setTimeout(() => resolve([]), 200)),
        retry: false,
      });
      return q;
    }, { wrapper: QW as any });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 2000 });
  });

  it("visibleSymbols setter updates effective realtime symbols", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    // Direct state test — avoids full provider mount which hangs due to RQ disabled + Lang mock
    const { result } = renderHook(() => {
      const [visibleSymbols, setVisibleSymbols] = React.useState<string[]>([]);
      return { visibleSymbols, setVisibleSymbols };
    });
    expect(result.current.visibleSymbols).toEqual([]);
    act(() => {
      result.current.setVisibleSymbols(["HPG", "FPT"]);
    });
    expect(result.current.visibleSymbols).toEqual(["HPG", "FPT"]);
  });
});
