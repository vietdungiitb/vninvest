import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { invalidateTenantAdminQueries } from "../pages/tenant-admin/useTenantAdminQuery.js";

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
      invalidateTenantAdminQueries(queryClient);
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
