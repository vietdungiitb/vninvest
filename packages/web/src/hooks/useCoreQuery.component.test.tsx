import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCoreQuery, CORE_USER_QUERY_SCOPE } from "./useCoreQuery.js";

describe("useCoreQuery scope", () => {
  // CHANGED ASSERTION (tenantreg-e, E9 P2). This test used to be
  // "scope core-user, khong tenant" and asserted
  //   expect(JSON.stringify(keys)).not.toContain("tenant-A");
  // That assertion pinned the *buggy* contract: an unscoped cache plus a
  // tenant-scoped API meant a workspace switch left the previous tenant's
  // entries fresh and readable under the new workspace's name. It is inverted
  // below. The "don't let tenant-changed invalidations touch core-user" intent
  // is preserved differently — QueryProvider now invalidates the core-user
  // PREFIX on tenant-changed (providers/QueryProvider.tsx), which is the
  // correct place for that decision.
  it("scope core-user by tenant so a switch cannot serve the previous tenant's cache", async () => {
    localStorage.setItem("tenant_id", "tenant-A");
    try {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: any) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => useCoreQuery(["probe"], { queryFn: async () => ({ ok: true }), refetchInterval: false }),
        { wrapper }
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const keys = client.getQueryCache().findAll().map((q) => q.queryKey);
      expect(keys).toContainEqual([CORE_USER_QUERY_SCOPE, "tenant-A", "probe"]);
      // The scope prefix is still first, so a targeted invalidation by prefix
      // (QueryProvider) still matches.
      expect(keys[0][0]).toBe(CORE_USER_QUERY_SCOPE);
    } finally {
      localStorage.removeItem("tenant_id");
    }
  });
});
