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

async function mount(search: string) {
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
    { initialEntries: [`/p${search}`] },
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

  test("AC-3: quay lai khoi lich su khoi phuc LOC cu (khong phai URL co param)", async () => {
    const router = await mount("");
    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "HPG" } });
    await waitFor(() => expect(screen.queryByText("Vingroup")).toBeNull());
    await waitFor(() => expect(screen.getByText("Hòa Phát")).toBeTruthy());

    await router.navigate(-1);
    // Observable: du lieu VFC xuat hien lai, khong chi URL doi nguoi
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
