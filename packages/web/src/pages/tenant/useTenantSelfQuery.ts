import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { tenantIdStorage } from "../../adapters/core/transport.js";

type HttpMethod = "get" | "post" | "patch" | "delete" | "put";

interface CoreAdapter {
  coreGet: (u: string, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
  corePost: (u: string, b?: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
  corePatch: (u: string, b?: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
  coreDelete: (u: string, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
  corePut: (u: string, b?: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
}

function coreFetch(method: HttpMethod, url: string, body?: unknown, headers?: Record<string, string>) {
  const adapter = defaultCoreApiAdapter as unknown as CoreAdapter;
  switch (method) {
    case "get": return adapter.coreGet(url, { headers });
    case "post": return adapter.corePost(url, body, { headers });
    case "patch": return adapter.corePatch(url, body, { headers });
    case "delete": return adapter.coreDelete(url, { headers });
    case "put": return adapter.corePut(url, body, { headers });
  }
}

/**
 * TEN-02 R1 — đọc tenant qua `tenantIdStorage` (SSOT). Hằng `TENANT_STORAGE_KEY`
 * và đọc `localStorage` trực tiếp ở đây là bản sao của SSOT; nó bỏ qua bước
 * migrate sessionStorage -> localStorage nên user còn phiên bản cũ thấy `null`
 * ở màn tenant-self trong khi phần còn lại của app thấy tenant.
 */
function readActiveTenantId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return tenantIdStorage.getTenantId();
}

export const TENANT_SELF_QUERY_SCOPE = "tenant-self";

export function useTenantSelfQuery<T = unknown>(
  queryKey: string[],
  url: string,
  options?: {
    enabled?: boolean;
    headers?: Record<string, string>;
    queryFn?: () => Promise<T>;
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
  },
) {
  const tenantId = readActiveTenantId();
  const scopedKey = [TENANT_SELF_QUERY_SCOPE, tenantId ?? "none", ...queryKey];
  return useQuery<T>({
    queryKey: scopedKey,
    queryFn: options?.queryFn
      ? options.queryFn
      : () => coreFetch("get", url, undefined, options?.headers) as Promise<T>,
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: options?.refetchIntervalInBackground,
  });
}

export function useTenantSelfMutation<T = unknown>(
  method: HttpMethod,
  url: string,
  invalidateKeys: string[][],
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (err: Error) => void;
  },
) {
  const queryClient = useQueryClient();
  return useMutation<T, Error, unknown>({
    mutationFn: (body) => coreFetch(method, url, body) as Promise<T>,
    onSuccess: (data) => {
      const tenantId = readActiveTenantId();
      for (const key of invalidateKeys) {
        const scoped = [TENANT_SELF_QUERY_SCOPE, tenantId ?? "none", ...key];
        queryClient.invalidateQueries({ queryKey: scoped });
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

export function invalidateTenantSelfQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const tenantId = readActiveTenantId();
  queryClient.invalidateQueries({
    queryKey: [TENANT_SELF_QUERY_SCOPE, tenantId ?? "none"],
  });
}
