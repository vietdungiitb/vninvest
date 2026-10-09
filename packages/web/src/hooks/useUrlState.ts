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

/**
 * WAVE 4 / Major 2 — `replace` vs `push` khi ghi URL.
 *
 * Vì sao: `setSearchParams(..., { replace: false })` tao **1 history entry mỗi
 * lần gọi**. Với ô **nhập văn bản** gắn thẳng `onChange` (không qua nút Apply),
 * mỗi **ký tự** đẩy 1 entry ⇒ người dùng phải bấm Back hàng chục lần mới ra
 * khỏi trang. Đây là lỗi thật, đang xảy ra ở 3 trang:
 *   - `PortfolioHoldingsPage.tsx:105` `setSearch` (input search, L185)
 *   - `AdminAuditPage.tsx:109-110` `setTenantId` / `setActor`
 *   - `AdminBillingFleetPage.tsx:139` `setSearch`
 *
 * ⚠ **Mặc định `replace: false`** — giữ nguyên hành vi của mọi call site cũ.
 * Muốn đổi thì phải **truyền tường minh**. Đổi mặc định sẽ làm nút Back
 * không quay lại được trang trước ở mọi bộ lọc.
 */
export type UrlStateOptions = {
  /** `true` = mọi key đều `replace`. */
  replace?: boolean;
  /**
   * Chỉ các key này `replace`; key khác vẫn `push`. Dùng khi trang có lẫn ô
   * nhập văn bản (nên replace) và phân trang/tab (nên push — người dùng thường
   * muốn Back quay lại trang trước khi đổi trang).
   *
   * ⚠ Vì `setParams` chỉ nhận **một** cờ cho **cả** lần ghi, quy tắc là:
   * `replace` **chỉ** khi lần ghi đó chạm **toàn bộ** key nằm trong danh sách.
   * Lần ghi có lẫn key `push` thì `push` (hướng an toàn — giữ được nút Back).
   */
  replaceKeys?: readonly string[];
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
 * @param options   xem `UrlStateOptions` (mac dinh: `replace: false`)
 */
export function useUrlValue<T>(
  key: string,
  codec: UrlStateCodec<T>,
  fallback: T,
  options: UrlStateOptions = {},
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const replace = options.replace ?? false;

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
        { replace },
      );
    },
    [setParams, key, codec, replace],
  );

  return [value, setValue];
}

/**
 * Nhom nhieu gia tri trong 1 lan `setParams` — tranh nhieu lan push history.
 * dung khi mot bo loc thay doi 3 tham so cung luc.
 *
 * @param options `replaceKeys` se tach patch thanh 2 nhom: nhom `replace` va
 *   nhom `push`, moi nhom 1 lan `setParams`. Khong tach thi **khong** lam duoc
 *   (1 nham `setParams` chi nhan 1 co `replace` cho ca patch).
 */
export function useUrlState<T extends Record<string, unknown>>(
  spec: { [K in keyof T]: UrlStateCodec<T[K]> },
  defaults: T,
  options: UrlStateOptions = {},
): [T, (patch: Partial<T>) => void] {
  const [params, setParams] = useSearchParams();
  const replaceAll = options.replace ?? false;
  const replaceKeys = options.replaceKeys;

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
      // ⚠ **MOT** `setParams` duy nhat cho ca patch.
      // Đo được 2026-10-09: gọi `setParams` **hai** lần trong cùng một tick KHÔNG
      // compose — lần hai đọc `prev` cũ và ghi đè kết quả lần một. Bản đầu tiên
      // của hàm này chia 2 nhóm (replace / push) và vì vậy **mất** nhóm đứng
      // trước; test "patch nhieu key" đỏ và lộ ra đúng lỗi này.
      //
      // ⇒ Quy tắc: `replace` khi và CHỈ khi patch này **chỉ** chạm key được
      // liệt kê trong `replaceKeys`. Patch có lẫn key `push` (ví dụ đổi trang
      // kèm sửa ô tìm kiếm) thì `push` — hướng an toàn: giữ được nút Back.
      const keys = Object.keys(patch);
      const allReplace = keys.length > 0 && keys.every(
        (k) => replaceAll || Boolean(replaceKeys?.includes(k)),
      );
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const k of keys as Array<keyof T>) {
            const raw = spec[k].serialize(patch[k] as T[typeof k]);
            if (raw === undefined) p.delete(String(k));
            else p.set(String(k), raw);
          }
          return p;
        },
        { replace: allReplace },
      );
    },
    [setParams, spec, replaceAll, replaceKeys],
  );

  return [value, setValue];
}

/**
 * WAVE 4 — `useUrlRecord`: dong bo **mot ban ghi phong nhieu field** co **tien to**.
 *
 * Vì sao hook thứ ba: `useUrlState` ghi **tung tham so**. 4 trang admin
 * (`AdminCore{AuditTrace,Jobs,PATs,ServiceAccounts}Page`) lai co **mot object
 * phang 5–7 field** (`search`/`kind`/`status`/`serviceDomain`/…) duoc Apply
 * chung bang `setFilters({ ...filtersDraft })`. Nếu dung `useUrlState` thi phai
 * go 5–7 lan `setUrlState` cho mot lan bam nut ⇒ 5–7 history entry cho **mot**
 * thao tac. `useUrlRecord` ghi **mot** `setParams` cho ca ban ghi.
 *
 * @param prefix  tien to ten tham so, vi du `"audit_"` ⇒ `?audit_search=…`
 * @param options xem `UrlStateOptions`. Mac dinh `replace: false` (khong doi
 *   hanh vi call site cu).
 */
export function useUrlRecord<T extends Record<string, unknown>>(
  spec: { [K in keyof T]: UrlStateCodec<T[K]> },
  defaults: T,
  prefix = "",
  options: UrlStateOptions = {},
): [T, (next: T | Partial<T>) => void] {
  const [params, setParams] = useSearchParams();
  const replaceAll = options.replace ?? false;
  const replaceKeys = options.replaceKeys;

  const value = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(spec) as Array<keyof T>) {
      const parsed = spec[k].parse(params.get(prefix + String(k)));
      if (parsed !== undefined) out[k] = parsed;
    }
    return out;
  }, [params, spec, defaults, prefix]);

  const setValue = useCallback(
    (next: T | Partial<T>) => {
      // ⚠ `merged` hợp với **`defaults`**, KHÔNG với `value`.
      // Vì sao: call site thật gọi `setRecord({ ...filtersDraft })` — bản ghi ĐẦY ĐỦ,
      // nên hợp với `value` cũng ra cùng kết quả. Nhưng nếu hợp với `value`, một
      // lần ghi **một phần** (`setRecord({ search: 'x' })`) sẽ GIỮ lại tham số cũ
      // của các key không nêu ⇒ người dùng bỏ filter cũ đi rồi Apply thì filter
      // cũ vẫn còn trên URL. Hợp với `defaults` ⇒ phần không nêu được **xoá**.
      const merged = { ...defaults, ...next } as T;
      // Ghi TAT CA key cua spec (khong chi key co trong `next`) de mot lan Apply
      // da `setUrlRecord({ search: 'x' })` cung xoa duoc key da dat truoc do —
      // neu chi ghi key trong `next`, Apply mot lan sau se de lai tham so cu.
      // Chi `setUrlRecord` lam duoc dieu nay; `useUrlState` (patch) ghi dung
      // phan bi sua.
      //
      // Xem `useUrlState` ve **mot** `setParams` duy nhat cho ca patch: hai
      // lan go trong cung tick KHONG compose.
      const keys = Object.keys(spec) as Array<keyof T>;
      const touched = Object.keys(next) as Array<keyof T>;
      // ⚠ `every` phải chạy trên **`touched`** (key người dùng vừa ghi), KHÔNG
      // phải trên `keys` (toàn bộ key của spec). Bản đầu tiên dùng `keys` ⇒
      // `replaceKeys` **chết lặng lẽ** vì spec luôn có key ngoài danh sách
      // (audit Stage 5, ID-3: "dead code, không test nào bắt").
      const allReplace = touched.length > 0 && touched.every(
        (k) => replaceAll || Boolean(replaceKeys?.includes(String(k))),
      );
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const k of keys) {
            const raw = spec[k].serialize(merged[k]);
            const key = prefix + String(k);
            if (raw === undefined) p.delete(key);
            else p.set(key, raw);
          }
          return p;
        },
        { replace: allReplace },
      );
    },
    [setParams, spec, prefix, defaults, replaceAll, replaceKeys],
  );

  return [value, setValue];
}
