/**
 * FU-05 — deep-link thật cho `PortfolioHoldingsPage`.
 *
 * AC-3: vong tron **state -> URL -> quay lai -> state khoi phuc**. Day la
 * observable nguoi dung thay khi gui link cho dong nghiep.
 *
 * AC-4: chi state da ap dung moi vao URL. (Trang nay khong co `*Draft`.)
 *
 * AC-5 (an toan): `sortKey` tu URL phai duoc kiem tra membership — neu mo
 * `?sortKey=<bat ky>` vao comparator se loi hoac sap xep sai.
 */

import { describe, expect, test, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioHoldingsPage } from "../PortfolioHoldingsPage";

vi.mock("../../../adapters/coreApiAdapter.js", async () => {
  // Giu nguyen phan export con lai (authTokenStorage...) — chi thay endpoint.
  const actual = await vi.importActual<Record<string, unknown>>(
    "../../../adapters/coreApiAdapter.js",
  );
  return {
    ...actual,
    defaultCoreApiAdapter: {
      ...(actual.defaultCoreApiAdapter as object),
      getPortfolioHoldings: vi.fn().mockResolvedValue({
        results: [
          { symbol: "VFC", company_name: "Vingroup", industry: "Bất động sản",
            quantity: 1000, avg_cost: "85000", current_price: "90000",
            market_value: "90000000", weight_pct: 55.1, unrealized_pnl_pct: 5.88 },
          { symbol: "HPG", company_name: "Hòa Phát", industry: "Thép",
            quantity: 500, avg_cost: "70000", current_price: "65000",
            market_value: "32500000", weight_pct: 20.0, unrealized_pnl_pct: -7.14 },
        ],
        count: 2,
      }),
    },
  };
});

afterEach(cleanup);

let url = "";
function UrlSpy() {
  const loc = useLocation();
  url = `${loc.pathname}${loc.search}`;
  return null;
}

async function mount(search: string, extraEntries: string[] = []) {
  const router = createMemoryRouter(
    [{ path: "/p", element: (
      <>
        <UrlSpy />
        <PortfolioProvider>
          <LangProvider>
            <PortfolioHoldingsPage portfolioId={1} />
          </LangProvider>
        </PortfolioProvider>
      </>
    ) }],
    { initialEntries: [`/p${search}`, ...extraEntries] },
  );
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.queryByText(/Dang t/i)).toBeNull(), { timeout: 4000 });
  return router;
}

describe("FU-05 — PortfolioHoldingsPage deep-link", () => {
  test("AC-3: doc search tu URL — loc san duoc ap dung", async () => {
    await mount("?search=HPG");
    await waitFor(() => expect(screen.queryByText("Vingroup")).toBeNull());
    expect(screen.getByText("Hòa Phát")).toBeTruthy();
  });

  test("AC-3: doi search -> URL doi", async () => {
    await mount("");
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
    fireEvent.change(input, { target: { value: "HPG" } });
    await waitFor(() => expect(url).toContain("search=HPG"));
  });

  /**
   * WAVE 4 / Major 2 — VIẾT LẠI, không xoá.
   *
   * ⚠ **Bản cũ pass vì LÝ DO SAI (hazard 10).** Nó gọi
   * `fireEvent.change(input, { value: "HPG" })` — **một** sự kiện mang giá trị
   * ĐÃ HOÀN CHỈNH — rồi đòi `navigate(-1)` khôi phục bảng chưa lọc. Người dùng
   * thật gõ 3 ký tự ⇒ **3** sự kiện `change`. Với `push`, lịch sử sẽ chứa
   * `?search=H` → `?search=HP` → `?search=HPG`, và `navigate(-1)` chỉ quay về
   * `?search=HP`, **không** phải bảng chưa lọc. Tức là AC cũ đang bảo vệ một
   * hành vi **không tồn tại** với người dùng thật.
   *
   * Major 2 sửa đúng cái đó: `search` ghi bằng `replace` ⇒ cả 3 ký tự là **một**
   * bước. Observable mới đo được, và **fail-trước**: với code cũ lần ghi cuối là
   * `PUSH` (đỏ), với code mới là `REPLACE` (xanh).
   *
   * Đổi hành vi (cần Owner biết): **không còn undo-bộ-lọc-bằng-nút-Back** —
   * Back sẽ rời trang. Đánh đổi này là chủ ý: giữ nó thì Back phải bấm N lần với
   * N = số ký tự đã gõ. Ghi trong `docs/REPORT_FINAL_UIUX_WAVE4.md`.
   */
  test("AC-3 (rev 2): go N ky tu → khong tao PUSH entry (Major 2)", async () => {
    const router = await mount("");
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
    const input = screen.getByRole("searchbox");

    // Mô phỏng gõ TAY: 3 sự kiện change, không phải 1 sự kiện mang "HPG".
    fireEvent.change(input, { target: { value: "H" } });
    await waitFor(() => expect(url).toContain("search=H"));
    fireEvent.change(input, { target: { value: "HP" } });
    await waitFor(() => expect(url).toContain("search=HP"));
    fireEvent.change(input, { target: { value: "HPG" } });
    await waitFor(() => expect(url).toContain("search=HPG"));

    // Lần ghi cuối phải là REPLACE. Code cũ (push) ⇒ PUSH ⇒ test này ĐỎ.
    expect(router.state.historyAction).toBe("REPLACE");
  });

  test("AC-3b (rev 2): ca 3 ky tu la MOT buoc undo, khong phai 3", async () => {
    // `mount` tao 2 entry: index 0 `/p`, index 1 `/p`. Sau khi gõ, `navigate(-1)`
    // phai quay ve index 0 ⇒ URL KHONG con `search=`.
    // Code cũ (push mỗi ký tự) ⇒ quay về `?search=HP` ⇒ test này ĐỎ.
    const router = await mount("", ["/p"]);
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "H" } });
    fireEvent.change(input, { target: { value: "HP" } });
    fireEvent.change(input, { target: { value: "HPG" } });
    await waitFor(() => expect(url).toContain("search=HPG"));

    await router.navigate(-1);
    await waitFor(() => expect(url).not.toContain("search="));
    // Observable: dữ liệu VFC quay lại, không chỉ URL đổi người.
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
  });

  test("AC-5: sortKey gia khong hop le bi bo qua, khong lam hong render", async () => {
    await mount("?sortKey=%3B%20DROP%20TABLE");
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
    // bang van render binh thuong
    expect(screen.getByRole("table")).toBeTruthy();
  });

  test("AC-5: sortKey hop le duoc ap dung tu URL", async () => {
    await mount("?sortKey=symbol&sortDir=asc");
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    await waitFor(() => {
      // Symbol render trong `<th scope="row">` (PortfolioHoldingsPage.tsx:232),
      // khong phai `<td>` — quyet dinh day thay vi do lai DOM.
      const syms = screen.getAllByRole("rowheader").map((c) => c.textContent ?? "");
      expect(syms).toEqual(["HPG", "VFC"]);
    });
  });

  test("URL khong giu gia tri mac dinh (sortDir mac dinh = desc)", async () => {
    await mount("?sortKey=symbol");
    expect(url).not.toContain("sortDir=");
  });
});
