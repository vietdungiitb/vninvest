/**
 * WAVE 6 / NAV-1 — helper bọc `MemoryRouter` cho test SOC.
 *
 * Vì sao tồn tại: các panel SOC đã chuyển bộ lọc/sắp xếp/phân trang sang
 * `useUrlValue` / `useUrlState` (`hooks/useUrlState.ts`). Cả hai gọi
 * `useSearchParams`, mà `useLocation()` **throw** ngoài `<Router>`:
 *   "useLocation() may be used only in the context of a <Router> component."
 *
 * ⇒ **Bọc Router trong test là sửa đúng gốc**, không phải lách: component đã
 * cần Router ở production (`main.tsx` bọc `BrowserRouter` từ đầu), nên test
 * phải cấp đúng môi trường mà production đang cấp.
 *
 * Mẫu bám theo `src/pages/__tests__/page-heading-fu02c.component.test.tsx`.
 *
 * ⚠ KHÔNG được sửa `hooks/useUrlState.ts` để "chịu được" thiếu Router: lỗi đó
 * phải nổ khi lọc ở production, không được nuốt.
 *
 * `SearchProbe` đọc `useSearchParams()` và render ra `location.search` **thật** —
 * dùng để chứng minh URL đổi, không suy diễn từ props hay giả lập.
 */

import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

/** Đọc query string thật của Router đang bọc. */
export function SearchProbe() {
  const [sp] = useSearchParams();
  return <output data-testid="url-probe">{sp.toString()}</output>;
}

/**
 * Render 1 element bên trong `MemoryRouter`.
 *
 * @param el     element cần render
 * @param search query string ban đầu, ví dụ `"?users_page=3"`. Bỏ trống = URL sạch.
 */
export function renderInRouter(el: ReactElement, search = "") {
  const path = search ? `/soc${search}` : "/soc";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SearchProbe />
      {el}
    </MemoryRouter>,
  );
}

/**
 * Đọc `location.search` hiện tại.
 *
 * ⚠ Lấy probe **mới nhất** trong DOM, không phải probe đầu tiên: một file test
 * có nhiều `render`, `cleanup()` chỉ chạy ở `afterEach`. Nếu lấy `[0]` thì test
 * sau đọc lại probe của test trước — test PASS khi chạy riêng (`-t`) nhưng FAIL
 * khi chạy cả file. Đã mắc đúng lỗi này 1 lần; `cleanup()` trong `afterEach`
 * không cứu được vì `waitFor` chạy trước khi `afterEach` kịp dọn.
 */
export function currentUrl(): string {
  const probes = document.querySelectorAll('[data-testid="url-probe"]');
  return probes[probes.length - 1]?.textContent ?? "";
}