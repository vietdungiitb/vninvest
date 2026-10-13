/**
 * Nguồn dữ liệu duy nhất cho `/portfolios/manage`.
 *
 * Vì sao không tái dùng `usePortfolioWorkspace` (`hooks/usePortfolioWorkspace.ts`)
 * dù nó cũng gọi `getPortfolios()`: workspace chỉ cần **danh sách** để đổi tab,
 * còn trang quản lý cần **tiền thật** cho từng danh mục. Trước đây
 * `PortfoliosPage.tsx:60` đọc `res.results` rồi dừng — không gọi
 * `getPortfolioSummary` (`workspace.js:186`) dù adapter đã có sẵn, nên trang
 * không hiển thị được giá trị / lãi lỗ dù backend tính sẵn
 * (`portfolio_analytics_views.py:366-407`).
 *
 * Ràng buộc đã học được và áp dụng ở đây:
 * - **L-F10**: mọi object/array dùng làm key của `useMemo`/`useCallback` khai
 *   ở CẤP MODULE, không tạo literal trong render.
 * - **L-F09**: `setSearchParams` không compose — trang này giữ `cursor` trong
 *   `useState` chứ không trong URL, nên không dính lỗi đó.
 * - **LED-03 R5**: lỗi của một danh mục không được làm hỏng cả trang ⇒
 *   `Promise.allSettled`, không `Promise.all`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import {
  buildPortfolioPayload,
  toNumberOrNull,
  type PortfolioRow,
  type PortfolioSummary,
} from "./format";

type Id = string | number;

/** Lỗi đã bóc sẵn `code`/`fieldErrors` từ `CoreApiRequestError` (transport.js:304). */
export interface ManagedError {
  message: string;
  /** `payload.code` — ví dụ `portfolio_has_financial_history` (views.py:235). */
  code: string | null;
  status: number | null;
  fieldErrors: Record<string, string> | null;
}

const adapter = coreApiAdapter as unknown as {
  getPortfolios(params?: { cursor?: string; page_size?: number }): Promise<{
    results?: PortfolioRow[];
    next?: string | null;
    previous?: string | null;
  }>;
  getPortfolioSummary(id: Id): Promise<PortfolioSummary>;
  /** Drawer vị thế dùng chung adapter — khai ở đây để test tiêm một bản giả. */
  getPortfolioHoldings(id: Id): Promise<unknown>;
  createPortfolio(data: Record<string, unknown>): Promise<PortfolioRow>;
  updatePortfolio(id: Id, data: Record<string, unknown>): Promise<PortfolioRow>;
  deletePortfolio(id: Id): Promise<unknown>;
};

/** `page_size` = khớp `CoreCursorPagination.page_size` (pagination.py:37). */
const PAGE_SIZE = 50;

const EMPTY_PARAMS = { page_size: PAGE_SIZE } as const;

/** Đúng 5 method trang này dùng — khai thành type để test tiêm bản giả. */
export type PortfolioManageAdapter = typeof adapter;

/**
 * Bóc lỗi API thành shape dùng được. `instanceof CoreApiRequestError` không dùng
 * vì class không được export ra ngoài `transport.js`; đọc theo **hình dạng** đã
 * đọc ở `transport.js:304-315` (`status`/`payload`/`fieldErrors`/`code`).
 */
export function toManagedError(err: unknown): ManagedError {
  if (err && typeof err === "object") {
    const e = err as {
      status?: number;
      code?: string | null;
      fieldErrors?: Record<string, string> | null;
      payload?: { detail?: string; code?: string; field_errors?: Record<string, string> } | null;
      message?: string;
    };
    return {
      message: e.payload?.detail ?? e.message ?? "Request failed",
      code: e.code ?? e.payload?.code ?? null,
      status: typeof e.status === "number" ? e.status : null,
      fieldErrors: e.fieldErrors ?? e.payload?.field_errors ?? null,
    };
  }
  return { message: "Request failed", code: null, status: null, fieldErrors: null };
}

/** Rút `cursor` ra khỏi URL tuyệt đối mà `CoreCursorPagination` trả về. */
export function cursorFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /[?&]cursor=([^&]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Lấy summary cho từng danh mục, song song, **không** để một lỗi làm hỏng lô.
 * `allSettled` trả kèm `reason` nên danh mục lỗi vẫn hiện dòng với ô trống thay
 * vì biến mất khỏi bảng — user vẫn thấy danh mục tồn tại, chỉ không có số liệu.
 */
async function fetchSummaries(
  rows: PortfolioRow[],
  client: PortfolioManageAdapter,
): Promise<Record<string, PortfolioSummary>> {
  const settled = await Promise.allSettled(
    rows.map((row) => client.getPortfolioSummary(row.id)),
  );
  const out: Record<string, PortfolioSummary> = {};
  settled.forEach((entry, index) => {
    const id = String(rows[index]?.id ?? "");
    if (!id) return;
    if (entry.status === "fulfilled" && entry.value) out[id] = entry.value;
  });
  return out;
}

/** Tổng hợp KPI trên cả trang — chỉ cộng những gì BE thật sự trả về. */
export interface ManageTotals {
  marketValue: number;
  cost: number;
  unrealizedPnl: number;
  /** Số danh mục **có** summary; tách khỏi `count` (tổng số danh mục trong trang). */
  pricedCount: number;
  totalCount: number;
  complete: boolean;
}

export function usePortfolioManage(client: PortfolioManageAdapter = adapter) {
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PortfolioSummary>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMoney, setLoadingMoney] = useState(false);
  const [error, setError] = useState<ManagedError | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<Id | null>(null);
  const [deletingId, setDeletingId] = useState<Id | null>(null);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async (activeCursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.getPortfolios(
        activeCursor ? { ...EMPTY_PARAMS, cursor: activeCursor } : { ...EMPTY_PARAMS },
      );
      if (!aliveRef.current) return;
      const rows = (res?.results ?? []) as PortfolioRow[];
      setPortfolios(rows);
      // `next` là URL TUYỆT ĐỐI do DRF dựng. Chỉ giữ con trỏ `cursor` trong
      // state; sang trang sau dùng đúng URL BE trả về, không tự dựng lại.
      setNextUrl(res?.next ?? null);
      setSummaries({});
      setLoadingMoney(true);
      const loaded = await fetchSummaries(rows, client);
      if (!aliveRef.current) return;
      setSummaries(loaded);
    } catch (err: unknown) {
      if (!aliveRef.current) return;
      setPortfolios([]);
      setNextUrl(null);
      setError(toManagedError(err));
    } finally {
      if (aliveRef.current) {
        setLoading(false);
        setLoadingMoney(false);
      }
    }
  }, [client]);

  useEffect(() => {
    void load(cursor);
  }, [load, cursor]);

  const reload = useCallback(() => {
    void load(cursor);
  }, [load, cursor]);

  /** Điều hướng cursor: giữ stack để "Trước" không cần biết cursor lùi. */
  const goNext = useCallback(() => {
    const next = cursorFromUrl(nextUrl);
    if (!next) return;
    setStack((prev) => [...prev, next]);
    setCursor(next);
  }, [nextUrl]);

  const goPrev = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const target = next.pop() ?? null;
      setCursor(target);
      return next;
    });
  }, []);

  const createPortfolio = useCallback(
    async (input: { name: string; description?: string; openingBalance?: string }) => {
      setSavingId("new");
      try {
        const created = await client.createPortfolio(buildPortfolioPayload(input));
        await load(cursor);
        return { ok: true as const, data: created };
      } catch (err: unknown) {
        return { ok: false as const, error: toManagedError(err) };
      } finally {
        if (aliveRef.current) setSavingId(null);
      }
    },
    [client, load, cursor],
  );

  const updatePortfolio = useCallback(
    async (id: Id, input: { name: string; description?: string; openingBalance?: string }) => {
      setSavingId(id);
      try {
        const updated = await client.updatePortfolio(id, buildPortfolioPayload(input));
        // Đổi tên/không đổi tiền ⇒ không cần gọi lại `summary`, chỉ cập nhật dòng.
        setPortfolios((prev) =>
          prev.map((row) => (row.id === id ? ({ ...row, ...updated } as PortfolioRow) : row)),
        );
        return { ok: true as const, data: updated };
      } catch (err: unknown) {
        return { ok: false as const, error: toManagedError(err) };
      } finally {
        if (aliveRef.current) setSavingId(null);
      }
    },
    [client],
  );

  const deletePortfolio = useCallback(
    async (id: Id) => {
      setDeletingId(id);
      try {
        await client.deletePortfolio(id);
        await load(cursor);
        return { ok: true as const };
      } catch (err: unknown) {
        // 409 `portfolio_has_financial_history` là **hành vi đúng** (views.py:206-242):
        // sổ cái append-only, D-17 giữ ≥ 7 năm. Không phải lỗi hệ thống.
        return { ok: false as const, error: toManagedError(err) };
      } finally {
        if (aliveRef.current) setDeletingId(null);
      }
    },
    [client, load, cursor],
  );

  const totals = useMemo<ManageTotals>(() => {
    let marketValue = 0;
    let cost = 0;
    let unrealizedPnl = 0;
    let pricedCount = 0;
    for (const row of portfolios) {
      const s = summaries[String(row.id)];
      if (!s) continue;
      const mv = toNumberOrNull(s.total_market_value);
      const c = toNumberOrNull(s.total_cost);
      const pnl = toNumberOrNull(s.total_unrealized_pnl);
      if (mv !== null) marketValue += mv;
      if (c !== null) cost += c;
      if (pnl !== null) unrealizedPnl += pnl;
      // "Có số liệu" = **có giá trị thị trường**. Không dùng `total_cost` làm
      // tiêu chí: BE trả `"0"` cho danh mục chưa có sổ cái
      // (`portfolio_analytics_views.py:370`), nên `cost !== null` cho ra
      // pricedCount = số danh mục ⇒ mất cảnh báo "tạm tính" khi giá trị thị
      // trường đang `null` vì còn mã chưa có giá.
      if (mv !== null) pricedCount += 1;
    }
    return {
      marketValue,
      cost,
      unrealizedPnl,
      pricedCount,
      totalCount: portfolios.length,
      complete: pricedCount > 0 && pricedCount === portfolios.length,
    };
  }, [portfolios, summaries]);

  return {
    portfolios,
    summaries,
    totals,
    loading,
    loadingMoney,
    error,
    savingId,
    deletingId,
    canPrev: stack.length > 0,
    hasNext: cursorFromUrl(nextUrl) !== null,
    reload,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    goNext,
    goPrev,
  };
}