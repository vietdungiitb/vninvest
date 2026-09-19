import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCoreQuery, CORE_USER_QUERY_SCOPE } from "./useCoreQuery.js";

describe("useCoreQuery scope (C1)", () => {
  it("scope core-user, khong tenant", async () => {
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
      expect(keys).toContainEqual([CORE_USER_QUERY_SCOPE, "probe"]);
      expect(JSON.stringify(keys)).not.toContain("tenant-A");
    } finally {
      localStorage.removeItem("tenant_id");
    }
  });
});
