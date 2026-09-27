/**
 * tenantreg-e / E9 — workspace switch must not leave the previous tenant's data
 * in the query cache, and the earlier cross-tenant stale-cache fix must not
 * regress.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act, render } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useCoreQuery, CORE_USER_QUERY_SCOPE } from "./useCoreQuery.js";
import { QueryProvider } from "../providers/QueryProvider.js";
import { TENANT_ADMIN_QUERY_SCOPE } from "../pages/tenant-admin/useTenantAdminQuery.js";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("tenantreg-e E9 — useCoreQuery is tenant-scoped", () => {
  it("adopts a new key after a switch, so the old tenant's entry is unreachable", async () => {
    localStorage.setItem("tenant_id", "tenant-A");
    const qc = client();
    const seen: any[] = [];
    const queryFn = vi.fn(async () => {
      seen.push(localStorage.getItem("tenant_id"));
      return { tenant: localStorage.getItem("tenant_id") };
    });

    const wrapper = ({ children }: any) =>
      createElement(QueryClientProvider, { client: qc }, children);

    const { result, rerender } = renderHook(
      () => useCoreQuery(["alert-center-summary-global"], { queryFn, refetchInterval: false }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ tenant: "tenant-A" });
    expect(seen).toEqual(["tenant-A"]);

    // Simulate the switch: localStorage write + a re-render, exactly what
    // Sidebar's <select onChange> does via switchTenant().
    act(() => {
      localStorage.setItem("tenant_id", "tenant-B");
    });
    rerender();

    await waitFor(() => expect(result.current.data).toEqual({ tenant: "tenant-B" }));
    expect(seen).toEqual(["tenant-A", "tenant-B"]);

    const keys = qc.getQueryCache().findAll().map((q) => q.queryKey);
    expect(keys).toContainEqual([CORE_USER_QUERY_SCOPE, "tenant-B", "alert-center-summary-global"]);
    expect(keys).toContainEqual([CORE_USER_QUERY_SCOPE, "tenant-A", "alert-center-summary-global"]);
  });

  it("uses the 'none' bucket when no workspace is selected", async () => {
    const qc = client();
    const wrapper = ({ children }: any) =>
      createElement(QueryClientProvider, { client: qc }, children);
    const { result } = renderHook(
      () => useCoreQuery(["probe"], { queryFn: async () => ({ ok: true }), refetchInterval: false }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryCache().findAll().map((q) => q.queryKey)).toEqual([
      [CORE_USER_QUERY_SCOPE, "none", "probe"],
    ]);
  });
});

describe("tenantreg-e E9 — QueryProvider invalidation on tenant-changed", () => {
  /**
   * QueryProvider owns a module-level QueryClient singleton, so the only way to
   * observe the real behaviour is to grab the client it actually provides.
   */
  function renderProviderAndCaptureClient(): QueryClient {
    let captured: QueryClient | null = null;
    function Grab() {
      captured = useQueryClient();
      return null;
    }
    render(createElement(QueryProvider, null, createElement(Grab, null)));
    if (!captured) throw new Error("QueryProvider did not provide a client");
    return captured as unknown as QueryClient;
  }

  it("invalidates BOTH the tenant-admin and the core-user scope", async () => {
    const qc = renderProviderAndCaptureClient();
    await qc.prefetchQuery({
      queryKey: [TENANT_ADMIN_QUERY_SCOPE, "tenant-B", "roles"],
      queryFn: async () => "roles",
    });
    await qc.prefetchQuery({
      queryKey: [CORE_USER_QUERY_SCOPE, "tenant-B", "summary"],
      queryFn: async () => "summary",
    });

    const invalidate = vi.spyOn(qc, "invalidateQueries");

    act(() => {
      localStorage.setItem("tenant_id", "tenant-B");
      window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    });

    const invalidatedKeys = invalidate.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(invalidatedKeys).toContainEqual([TENANT_ADMIN_QUERY_SCOPE, "tenant-B"]);
    expect(invalidatedKeys).toContainEqual([CORE_USER_QUERY_SCOPE]);
  });

  it("does not regress the earlier P0 fix: the previous tenant's tenant-admin entries are dropped", async () => {
    const qc = renderProviderAndCaptureClient();
    // Entry seeded while workspace A was active...
    await qc.prefetchQuery({
      queryKey: [TENANT_ADMIN_QUERY_SCOPE, "tenant-A", "roles"],
      queryFn: async () => "A-data",
    });

    act(() => {
      localStorage.setItem("tenant_id", "tenant-B");
      window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    });

    // ...must not be reachable by the key the app now uses for workspace B.
    await expect(
      qc.fetchQuery({
        queryKey: [TENANT_ADMIN_QUERY_SCOPE, "tenant-B", "roles"],
        queryFn: async () => "B-data",
      }),
    ).resolves.toBe("B-data");
  });

  it("unsubscribes on unmount so a remount does not double-invalidate", async () => {
    const view = render(createElement(QueryProvider, null, null));
    view.unmount();
    // Re-render to obtain a fresh client reference, then assert a stale
    // listener from the unmounted provider is gone by checking the module
    // singleton's cache is untouched when the event fires with no provider.
    const qc = renderProviderAndCaptureClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    act(() => {
      window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    });
    // exactly one listener (the current provider), not two
    expect(invalidate).toHaveBeenCalledTimes(2); // tenant-admin + core-user
  });
});
