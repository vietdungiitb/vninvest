/**
 * S-04 - hook trạng thái dùng chung cho 5 trang Portfolio workspace.
 *
 * Vì sao có hook: 5 trang đều cần cùng một danh sách danh mục + cùng một
 * danh mục đang chọn. Nếu mỗi trang tự gọi API thì đổi danh mục không lan sang
 * trang khác, và mỗi trang tự xử lý loading/error — 5 lần.
 *
 * NGUYÊN TẮC: hook KHÔNG bịa dữ liệu. Mọi trường hợp thiếu dữ liệu đều đi
 * qua `reason` để trang hiện đúng lý do thay vì số 0 (D7).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultCoreApiAdapter } from "../adapters/coreApiAdapter.js";

export type PortfolioAdapter = {
  getPortfolios?: () => Promise<unknown>;
  getPortfolioSummary?: (id: string | number) => Promise<unknown>;
  getPortfolioHoldings?: (id: string | number) => Promise<unknown>;
  getPortfolioEquityCurve?: (id: string | number) => Promise<unknown>;
  getPortfolioAllocation?: (id: string | number) => Promise<unknown>;
  getPortfolioMetrics?: (id: string | number) => Promise<unknown>;
  getTransactions?: (id: string | number, params?: Record<string, unknown>) => Promise<unknown>;
};

/** Bóc `data` khỏi envelope `{data, meta}`; chịu cả list phẳng. */
export function unwrapEnvelope(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as Record<string, unknown>).data;
  }
  return payload;
}

export function asRows(payload: unknown): Array<Record<string, unknown>> {
  const data = unwrapEnvelope(payload);
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["results", "holdings", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export interface WorkspaceState {
  portfolios: Array<Record<string, unknown>>;
  selectedId: string | number | null;
  loading: boolean;
  error: string | null;
  selectPortfolio: (id: string | number | null) => void;
  reload: () => Promise<void>;
}

/** Danh sách danh mục + danh mục đang chọn. Dùng chung cho cả 5 trang. */
export function usePortfolioWorkspace(adapter?: PortfolioAdapter): WorkspaceState {
  const api = (adapter ?? defaultCoreApiAdapter) as PortfolioAdapter;
  const [portfolios, setPortfolios] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof api.getPortfolios !== "function") {
        setError("adapter_missing_getPortfolios");
        return;
      }
      const rows = asRows(await api.getPortfolios());
      setPortfolios(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => String(r.id ?? r.pk) === String(prev))) return prev;
        const first = rows[0];
        const id = first?.id ?? first?.pk ?? null;
        return (id ?? null) as string | number | null;
      });
    } catch (err) {
      setError((err as Error)?.message ?? "load_failed");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectPortfolio = useCallback((id: string | number | null) => setSelectedId(id), []);

  return useMemo(
    () => ({ portfolios, selectedId, loading, error, selectPortfolio, reload }),
    [portfolios, selectedId, loading, error, selectPortfolio, reload],
  );
}

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Mã lý do khi dữ liệu rỗng — truyền thẳng cho UI. */
  reason: string | null;
  reload: () => Promise<void>;
}

/**
 * Gọi 1 endpoint theo `portfolioId` và giữ trạng thái.
 *
 * `emptyReason(data)` quyết định `reason` khi `data` không có gì để vẽ —
 * tách riêng để mỗi loại dùng ngưỡng riêng (2 điểm NAV vs ≥1 item).
 */
export function usePortfolioResource<T>(
  portfolioId: string | number | null,
  fetcher: ((id: string | number) => Promise<unknown>) | undefined,
  emptyReason: (data: T | null) => string | null,
): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!portfolioId || !fetcher) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData((await fetcher(portfolioId)) as T);
    } catch (err) {
      setError((err as Error)?.message ?? "load_failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, fetcher]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    loading,
    error,
    reason: data === null && !loading && !error ? emptyReason(data) : null,
    reload,
  };
}
