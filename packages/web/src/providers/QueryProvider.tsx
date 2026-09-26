import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { invalidateTenantAdminQueries } from "../pages/tenant-admin/useTenantAdminQuery.js";
import { CORE_USER_QUERY_SCOPE } from "../hooks/useCoreQuery.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onTenantChanged = () => {
      // Primary defence (the P0 cross-tenant stale-cache fix, entry 127/183):
      // tenant-admin keys carry the tenant id, so invalidating the *new*
      // tenant's prefix drops the old tenant's entries out of reach.
      invalidateTenantAdminQueries(queryClient);
      // E9: `useCoreQuery` keys are now tenant-scoped too
      // (useCoreQuery.ts). Invalidating the prefix as well means an observer
      // that has not re-rendered yet (so has not recomputed its key) still
      // refetches instead of sitting on the previous tenant's data until
      // staleTime expires.
      queryClient.invalidateQueries({ queryKey: [CORE_USER_QUERY_SCOPE] });
    };
    window.addEventListener("tenant-changed", onTenantChanged);
    return () => {
      window.removeEventListener("tenant-changed", onTenantChanged);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
