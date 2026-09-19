import { useQuery } from "@tanstack/react-query";

export const CORE_USER_QUERY_SCOPE = "core-user";

/**
 * User-scoped query hook for core (non-tenant-admin) screens.
 * Scope key is ['core-user', ...] — intentionally NOT tenant-scoped,
 * so `tenant-changed` invalidations for tenant-admin never touch it (C1).
 */
export function useCoreQuery<T = unknown>(
  queryKey: string[],
  options?: {
    enabled?: boolean;
    queryFn?: () => Promise<T>;
    refetchInterval?: number | false;
  },
) {
  const scopedKey = [CORE_USER_QUERY_SCOPE, ...queryKey];
  return useQuery<T>({
    queryKey: scopedKey,
    queryFn: options?.queryFn as () => Promise<T>,
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
