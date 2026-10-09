/**
 * WAVE 8 / NAV-1 — chứng minh tab của `WorkstationLayout` **thật sự** điều khiển
 * bằng URL, không phải "chỉ gọi hook cho có".
 *
 * Ba hành vi AC (cùng quy ước A/B/C của `soc-nav1-url-state.component.test.tsx`):
 *   A. URL rỗng → giá trị = default cũ (`chart`), **và URL vẫn rỗng** — không
 *      được ghi `?ws_tab=chart` (URL sạch khi chưa chọn).
 *   C. Deep-link `?ws_tab=orderbook` → mount ra **đã** ở tab đó (mất state sau F5
 *      chính là bug NAV-1 nói tới).
 *   B. Bấm tab khác → `useSearchParams` **đổi thật**, đọc lại được từ `SearchProbe`
 *      (cùng nguồn sự thật với hook) chứ không phải `setState` nội bộ.
 *
 * Vì sao bọc `MemoryRouter`: `useUrlValue` → `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>`. Không bọc thì cả 3 test dỏ với
 * `useLocation() may be used only in the context of a <Router> component.`
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

import { WorkstationLayout } from "../WorkstationLayout.jsx";

/** Đọc `location.search` hiện tại — bằng chứng trực tiếp rằng URL đã đổi. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

/** Mobile là điều kiện duy nhất render tab-bar (`WorkstationLayout.jsx:65`). */
function setViewportMobile(isMobile: boolean) {
  Object.defineProperty(window, "innerWidth", {
    value: isMobile ? 375 : 1440,
    configurable: true,
    writable: true,
  });
}

function renderLayout(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <WorkstationLayout enabled>
        {{ left: <div>L</div>, right: <div>R</div> }}
      </WorkstationLayout>
    </MemoryRouter>,
  );
}

/** Tab nào đang được chọn — đọc từ `aria-selected` (nguồn sự thật của UI). */
function selectedTab(): string | null | undefined {
  return screen.getAllByRole("tab").find((el) => el.getAttribute("aria-selected") === "true")
    ?.textContent;
}

describe("WorkstationLayout — NAV-1 tab dong bo URL", () => {
  beforeEach(() => {
    setViewportMobile(true);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── A. URL rong: gia tri mac dinh CU, va URL KHONG bi ghi ────────────────
  it("A. URL rong → activeTab = `chart` va URL VAN RONG (khong ghi ?ws_tab=chart)", () => {
    renderLayout("");

    expect(selectedTab()).toBe("📈 Biểu đồ");
    // Đây là điều kiện quan trọng nhất: codec phải bỏ giá trị mặc định khỏi URL.
    // Nếu hook ghi `?ws_tab=chart` thì mọi link copy ra ngoài đều thừa.
    expect(currentSearch()).toBe("");
  });

  // ── C. Deep-link: khoi tao dung o gia tri trong URL ───────────────────────
  it("C. deep-link ?ws_tab=orderbook → activeTab khoi tao = tab do", () => {
    renderLayout("?ws_tab=orderbook");

    expect(selectedTab()).toBe("📊 Sổ lệnh");
    expect(currentSearch()).toBe("ws_tab=orderbook");
  });

  it("C2. deep-link ?ws_tab=tradelog → activeTab khoi tao = tab do", () => {
    renderLayout("?ws_tab=tradelog");

    expect(selectedTab()).toBe("📋 Khớp lệnh");
    expect(currentSearch()).toBe("ws_tab=tradelog");
  });

  // ── B. Bam tab → URL THAT su doi ────────────────────────────────────────
  it("B. bam tab khac → URL doi that tu `chart` sang `orderbook`", () => {
    renderLayout("");
    expect(currentSearch()).toBe("");

    fireEvent.click(screen.getByRole("tab", { name: "📊 Sổ lệnh" }));

    expect(currentSearch()).toBe("ws_tab=orderbook");
    expect(selectedTab()).toBe("📊 Sổ lệnh");
  });

  it("B2. bam ve `chart` → tham so bi XOA khoi URL (khong phai ghi lai gia tri mac dinh)", () => {
    renderLayout("?ws_tab=orderbook");

    fireEvent.click(screen.getByRole("tab", { name: "📈 Biểu đồ" }));

    // Quay lai gia tri mac dinh ⇒ URL phai sach. `?ws_tab=chart` se la thua.
    expect(currentSearch()).toBe("");
    expect(selectedTab()).toBe("📈 Biểu đồ");
  });

  it("B3. chuyen tab nhieu lan lien tiep → chi con gia tri cuoi cung", () => {
    renderLayout("");

    fireEvent.click(screen.getByRole("tab", { name: "📊 Sổ lệnh" }));
    fireEvent.click(screen.getByRole("tab", { name: "📋 Khớp lệnh" }));

    expect(currentSearch()).toBe("ws_tab=tradelog");
    expect(selectedTab()).toBe("📋 Khớp lệnh");
  });
});