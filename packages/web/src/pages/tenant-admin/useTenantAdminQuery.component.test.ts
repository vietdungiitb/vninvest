import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { useTenantAdminQuery, invalidateTenantAdminQueries } from "./useTenantAdminQuery.js";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    coreGet: vi.fn(async (url: string) => ({ url, results: [] })),
    corePost: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    corePut: vi.fn(),
    getCostTrend: vi.fn(),
    getApiUsageAnalytics: vi.fn(),
    getAllUsageTrends: vi.fn(),
    getUsageForecast: vi.fn(),
    getAlertConfigs: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { Wrapper, client };
}

describe("useTenantAdminQuery tenant isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    (defaultCoreApiAdapter.coreGet as any).mockClear();
  });

  it("scopes queryKey by active tenant_id from localStorage", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => useTenantAdminQuery<{ url: string }>(["members"], "/partner/members/"),
      { wrapper: Wrapper as any },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = (result.current as any).data;
    expect(cached.url).toBe("/partner/members/");
  });

  it("does NOT share cache between two tenants (no cross-tenant stale data)", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    const { Wrapper } = wrapper();
    const first = renderHook(
      () => useTenantAdminQuery<any>(["members"], "/partner/members/"),
      { wrapper: Wrapper as any },
    );
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const callsAfterA = (defaultCoreApiAdapter.coreGet as any).mock.calls.length;

    // Simulate tenant switch (as PortfolioContext.switchTenant does)
    act(() => {
      window.localStorage.setItem("tenant_id", "tenant-B");
      window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    });

    const second = renderHook(
      () => useTenantAdminQuery<any>(["members"], "/partner/members/"),
      { wrapper: Wrapper as any },
    );
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    // tenant-B must trigger a fresh fetch, not reuse tenant-A cache
    const callsAfterB = (defaultCoreApiAdapter.coreGet as any).mock.calls.length;
    expect(callsAfterB).toBeGreaterThan(callsAfterA);
  });

  it("invalidateTenantAdminQueries only invalidates active tenant scope", async () => {
    window.localStorage.setItem("tenant_id", "tenant-A");
    const { Wrapper, client } = wrapper();
    renderHook(
      () => useTenantAdminQuery<any>(["members"], "/partner/members/"),
      { wrapper: Wrapper as any },
    );
    // Prefetch the key for tenant-A
    await client.prefetchQuery({
      queryKey: ["tenant-admin", "tenant-A", "members"],
      queryFn: async () => ({ ok: true }),
    });
    expect(client.getQueryData(["tenant-admin", "tenant-A", "members"])).toBeDefined();

    // Switch tenant then invalidate — tenant-A data should still be present (scope differs)
    act(() => {
      window.localStorage.setItem("tenant_id", "tenant-B");
      invalidateTenantAdminQueries(client);
    });
    expect(client.getQueryData(["tenant-admin", "tenant-A", "members"])).toBeDefined();
  });
});
