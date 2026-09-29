import { useQuery } from "@tanstack/react-query";
import { tenantIdStorage } from "@/adapters/coreApiAdapter.js";

export const CORE_USER_QUERY_SCOPE = "core-user";

/**
 * TEN-02 R1 — đọc tenant qua `tenantIdStorage`, không tự đọc `localStorage`.
 *
 * Đọc thẳng ở đây trước đây BỎ QUA bước migrate sessionStorage -> localStorage
 * mà `tenantIdStorage.getTenantId()` thực hiện, nên user còn phiên bản cũ thấy
 * `null` ở đây trong khi phần còn lại của app thấy tenant. Sai lệch đó làm
 * React Query key lệch nhau giữa các màn hình trong cùng một lần render.
 */
function readActiveTenantId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return tenantIdStorage.getTenantId();
}

/**
 * User-scoped query hook for core (non-tenant-admin) screens.
 *
 * E9 (P2) — the key IS tenant-scoped now: `['core-user', <tenantId>, ...]`.
 *
 * This used to be `['core-user', ...]` on purpose, with a comment saying the
 * non-scoping was deliberate "so `tenant-changed` invalidations for
 * tenant-admin never touch it (C1)". That reasoning is sound for the
 * invalidation, but it left the CACHE unscoped, and after slice B started
 * honouring `X-Tenant-ID` on every request that is a cross-tenant data leak
 * waiting to be rendered: `Header.tsx` polls `alert-center-summary-global` every
 * 30s and `useAlertCenterData.js` caches the feed/summary/stats, all of them
 * tenant-scoped server-side. After a workspace switch the previous tenant's
 * entries stayed fresh (`staleTime` 30s, `refetchOnWindowFocus` true) and were
 * served under the new workspace's name.
 *
 * The key shape now mirrors `useTenantAdminQuery`
 * (`['tenant-admin', <tenantId>, ...]`, useTenantAdminQuery.ts:46) so there is
 * one convention in the app. `QueryProvider` additionally invalidates this
 * scope on `tenant-changed` so an observer that has not re-rendered yet still
 * refetches.
 */
export function useCoreQuery<T = unknown>(
  queryKey: string[],
  options?: {
    enabled?: boolean;
    queryFn?: () => Promise<T>;
    refetchInterval?: number | false;
  },
) {
  const tenantId = readActiveTenantId();
  const scopedKey = [CORE_USER_QUERY_SCOPE, tenantId ?? "none", ...queryKey];
  return useQuery<T>({
    queryKey: scopedKey,
    queryFn: options?.queryFn as () => Promise<T>,
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
