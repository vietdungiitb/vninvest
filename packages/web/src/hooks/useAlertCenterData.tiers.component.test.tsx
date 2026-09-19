import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAlertCenterData } from "./useAlertCenterData.js";

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getAlertCenterFeed: vi.fn(),
    getAlertCenterSummary: vi.fn(),
    getAlertCenterSymbolStats: vi.fn(),
    getAIAlertsFeed: vi.fn(),
    getAIAlertsSummary: vi.fn(),
    getAIAlertsSymbolStats: vi.fn(),
  },
}));

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const adapter = coreApiAdapter as any;

describe("useAlertCenterData tiers (C2)", () => {
  it("3 queries core-user scope + tiers 5s/30s/30s", async () => {
    adapter.getAlertCenterFeed.mockResolvedValue({ results: [], next: null, previous: null });
    adapter.getAlertCenterSummary.mockResolvedValue({ total: 0, unseen: 0, by_severity: {} });
    adapter.getAlertCenterSymbolStats.mockResolvedValue({ symbols: [], total_alerts_in_scope: 0, pagination: {} });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: any) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    renderHook(() => useAlertCenterData({ lane: "main", autoRefresh: true }), { wrapper });
    await waitFor(() => expect(adapter.getAlertCenterFeed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(adapter.getAlertCenterSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(adapter.getAlertCenterSymbolStats).toHaveBeenCalledTimes(1));
    const cached = client.getQueryCache().findAll();
    const keys = cached.map((q) => q.queryKey);
    expect(keys).toContainEqual(["core-user", "alert-center-feed", "main", "", "", "", "", "", "0"]);
    expect(keys).toContainEqual(["core-user", "alert-center-summary", "main", "", "", "", "", "", "0"]);
    expect(keys).toContainEqual(["core-user", "alert-center-stats", "main", "", "", "", "", "", "0"]);
    const intervals = Object.fromEntries(
      cached.map((q) => [String((q.queryKey as string[])[1]), (q.options as any).refetchInterval])
    );
    expect(intervals["alert-center-feed"]).toBe(5000);
    expect(intervals["alert-center-summary"]).toBe(30000);
    expect(intervals["alert-center-stats"]).toBe(30000);
  });
});
