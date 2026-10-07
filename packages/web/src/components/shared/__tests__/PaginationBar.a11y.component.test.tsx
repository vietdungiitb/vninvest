/**
 * UX-05 — `PaginationBar` là component DÙNG CHUNG cho mọi bảng có phân trang.
 * Trước đó: 8 nút icon chỉ có `title`, 2 `<select>` không có tên accessible
 * (chữ "Kích thước trang" nằm trong `<span>` anh em, không phải `<label>`).
 *
 * `title` KHÔNG phải là tên accessible đáng tin: nó chỉ hiện khi hover, và bị
 * bỏ qua hoàn toàn trên touch. Skill fixing-accessibility §1 yêu cầu
 * `aria-label` / `aria-labelledby` cho icon-only button.
 *
 * Fail-trước/pass-sau: bỏ `aria-label` về bản gốc => các assert nay đỏ.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PaginationBar from "../PaginationBar.jsx";

const BASE = {
  page: 2, totalPages: 5, from: 11, to: 20, total: 50, loading: false,
};

function renderBoth() {
  return render(
    <>
      <PaginationBar mode="offset" {...BASE} onPageChange={() => {}} onSizeChange={() => {}} />
      <PaginationBar
        mode="cursor"
        currentPage={2}
        pageSize={10}
        hasPrev
        hasNext
        hasLast
        onFirst={() => {}} onPrev={() => {}} onNext={() => {}} onLast={() => {}}
        onSizeChange={() => {}}
      />
    </>,
  );
}

describe("PaginationBar — tên accessible", () => {
  it("mọi nút phân trang có aria-label", () => {
    const { container } = renderBoth();
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThanOrEqual(8);
    for (const b of buttons) {
      const name = b.getAttribute("aria-label") || b.textContent?.trim();
      expect(name, `nút không có tên truy cập: ${b.outerHTML.slice(0, 90)}`).toBeTruthy();
    }
  });

  it("nút icon có aria-label, KHONG chỉ dựa vào title", () => {
    const { container } = renderBoth();
    // mọi nút trong component này đều icon-only ⇒ phải có aria-label
    for (const b of Array.from(container.querySelectorAll("button"))) {
      expect(b.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("<select> kích thước trang có <label htmlFor> trỏ đúng id", () => {
    const { container } = renderBoth();
    const selects = Array.from(container.querySelectorAll("select"));
    expect(selects.length).toBe(2);
    for (const sel of selects) {
      const id = sel.getAttribute("id");
      expect(id, "<select> thiếu id để label htmlFor trỏ tới").toBeTruthy();
      const label = container.querySelector(`label[for="${id}"]`);
      expect(label, `không có <label for="${id}">`).not.toBeNull();
      expect(label?.textContent).toMatch(/Kích thước trang/);
    }
  });

  it("id của 2 select KHÔNG trùng nhau (tránh label trỏ nhầm)", () => {
    const { container } = renderBoth();
    const ids = Array.from(container.querySelectorAll("select")).map((s) => s.getAttribute("id"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("label gắn đúng qua htmlFor (không assert click-focus: jsdom không hiện thực)", () => {
    const { container } = renderBoth();
    const sel = container.querySelector("select") as HTMLSelectElement;
    const label = container.querySelector(`label[for="${sel.id}"]`) as HTMLLabelElement;
    expect(label.htmlFor).toBe(sel.id);
    // `label.click()` KHONG chuyển focus sang control trong jsdom — đó là giới hạn
    // môi trường test, không phải hành vi trình duột. Không assert điều không
    // đo được (cùng nguyên tắc với việc không báo PASS cho gate chưa chạy).
  });
});
