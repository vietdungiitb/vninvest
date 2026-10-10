/**
 * S-11 - `/portfolios` (khong id) phai la entry cua workspace.
 *
 * VI SAO: `routeCatalog.js` + 5 route `portfolio-*` ton tai nhung sidebar tro
 * `/portfolios` lai map vao `core-portfolios` (trang CRUD cu) => 5 man hinh
 * moi khong co loi vao nao tu menu. Test nay khoa lai:
 *   1. `/portfolios` render DUNG khung workspace (1 `<h1>` + nav 5 tab);
 *   2. co link "Quan ly danh muc" tro `/portfolios/manage` (loi vao trang CRUD);
 *   3. `/portfolios/7/holdings` (deep-link) van render workspace.
 *
 * Khong mock adapter: khi khong co BE, khung van phai dung (chi hien loi API),
 * va TUYET DOI khong nem loi cau truc (xem `portfolio-real-path` B0).
 */

import { describe, expect, test, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioWorkspacePage } from "../PortfolioWorkspacePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <PortfolioProvider>
      <LangProvider>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/portfolios" element={<PortfolioWorkspacePage />} />
            <Route path="/portfolios/:portfolioId/:tab" element={<PortfolioWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    </PortfolioProvider>,
  );
}

describe("/portfolios la entry workspace", () => {
  test("khong id van render khung + dung MOT h1", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/portfolios");
    await waitFor(() => {
      const alert = screen.queryByRole("alert");
      if (alert) {
        expect(alert.textContent ?? "").not.toMatch(/Cannot read properties of undefined/);
      }
    });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: /Các màn hình danh mục|portfolio/i })).toBeTruthy();
    err.mockRestore();
  });

  test("co link 'Quan ly danh muc' tro /portfolios/manage", () => {
    renderAt("/portfolios");
    const link = screen.getByRole("link", { name: /Quản lý danh mục/ });
    expect(link.getAttribute("href")).toBe("/portfolios/manage");
  });

  test("deep-link /portfolios/7/holdings van render workspace", () => {
    renderAt("/portfolios/7/holdings");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("loc").textContent).toBe("/portfolios/7/holdings");
  });

  test("doi tab o deep-link van doi path", async () => {
    renderAt("/portfolios/7/overview");
    const activity = screen.getByRole("button", { name: /Hoạt động|Activity/ });
    fireEvent.click(activity);
    await waitFor(() => {
      expect(screen.getByTestId("loc").textContent).toBe("/portfolios/7/activity");
    });
  });
});
