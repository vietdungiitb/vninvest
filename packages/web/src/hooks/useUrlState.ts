/**
 * FU-05 — đồng bộ state bảng/filter với URL query, dùng `useSearchParams` của
 * `react-router-dom@6.30.3` (**đã có sẵn** — không thêm dependency, vì
 * `packages/web/package.json` + `package-lock.json` nằm trong deny-list).
 *
 * Vì sao cần hook: 12 file có cả bộ lọc + phân trang + sắp xếp. Sửa tay =
 * lặp đoạn parse/serialize `URLSearchParams` 12 lần.
 *
 * AC-4: chỉ đồng bộ state **đã áp dụng**. State `*Draft` (ô input đang soạn)
 * tuyệt đối không đưa vào URL — nếu đồng bộ cả hai sẽ `useEffect` loop.
 *
 * Ranh giới nhất thiết: hook chỉ đọc/ghi `URLSearchParams`, không điều hướng.
 * Back/forward do React Router lo, ta chỉ derive state từ `searchParams`.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type UrlStateCodec<T> = {
  /** URL -> state. Phai tra `undefined` khi tham so khong ton tai (de phan bi "xoa" voi "gia tri rong"). */
  parse: (raw: string | null) => T | undefined;
  /** state -> string cho URL. Tra `undefined` khi nen bo khoi URL. */
  serialize: (value: T) => string | undefined;
};

/** So nguyen, tra undefined khi khong hop le (khong phai NaN/Infinity). */
export const intCodec: UrlStateCodec<number> = {
  parse(raw) {
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  },
  serialize(v) {
    return Number.isFinite(v) ? String(Math.trunc(v)) : undefined;
  },
};

export const stringCodec: UrlStateCodec<string> = {
  parse: (raw) => (raw == null || raw === "" ? undefined : raw),
  serialize: (v) => (v === "" ? undefined : v),
};

/**
 * Gia tri co 2 chon (sort direction, trang thai tab).
 *
 * ⚠ `parse` **phai tra `undefined` khi tham so vang** — neu tra thang `a`,
 * hook se dung `a` thay cho `fallback`. Loi nay lam `sortDir` mac dinh
 * `"asc"` thay vi `"desc"` va pham hien o test sap xep cua PortfolioHoldings.
 */
export function boolCodec<T extends string>(a: T, b: T): UrlStateCodec<T> {
  return {
    parse: (raw) => {
      if (raw == null || raw === "") return undefined;
      if (raw === b) return b;
      if (raw === a) return undefined; // `a` la mac dinh ⇒ khong can ghi URL
      return undefined;
    },
    serialize: (v) => (v === a ? undefined : v),
  };
}

/**
 * Doc 1 gia tri tu query string.
 *
 * @param key       ten tham so trong URL
 * @param codec     cach parse/serialize (mac dinh: chuoi)
 * @param fallback  gia tri khi URL khong co tham so
 */
export function useUrlValue<T>(
  key: string,
  codec: UrlStateCodec<T>,
  fallback: T,
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();

  const value = useMemo(() => {
    const parsed = codec.parse(params.get(key));
    return parsed === undefined ? fallback : parsed;
  }, [params, key, codec, fallback]);

  const setValue = useCallback(
    (next: T) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          const raw = codec.serialize(next);
          if (raw === undefined) p.delete(key);
          else p.set(key, raw);
          return p;
        },
        { replace: false },
      );
    },
    [setParams, key, codec],
  );

  return [value, setValue];
}

/**
 * Nhom nhieu gia tri trong 1 lan `setParams` — tranh nhieu lan push history.
 * dung khi mot bo loc thay doi 3 tham so cung luc.
 */
export function useUrlState<T extends Record<string, unknown>>(
  spec: { [K in keyof T]: UrlStateCodec<T[K]> },
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const [params, setParams] = useSearchParams();

  const value = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(spec) as Array<keyof T>) {
      const parsed = spec[k].parse(params.get(String(k)));
      if (parsed !== undefined) out[k] = parsed;
    }
    return out;
  }, [params, spec, defaults]);

  const setValue = useCallback(
    (patch: Partial<T>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const k of Object.keys(patch) as Array<keyof T>) {
            const raw = spec[k].serialize(patch[k] as T[typeof k]);
            if (raw === undefined) p.delete(String(k));
            else p.set(String(k), raw);
          }
          return p;
        },
        { replace: false },
      );
    },
    [setParams, spec],
  );

  return [value, setValue];
}
