/**
 * FU-01 - moi trang phai co DUNG MOT `<h1>` o SHELL, khong phai o page.
 *
 * 5 route portfolio (`/portfolios/:id/{overview,holdings,allocation,analytics,
 * activity}`) deu map ve MOT entry `portfolio-workspace`
 * (`pageRegistry.js:210-211`) => khung `PortfolioWorkspace` la noi dung de
 * dat tieu de muc (h2), KHONG phai h1, vi `ShellPageTemplate.js:119` da
 * render `<h1>` theo route title. Dat them h1 o page se tao 2 h1 (sai a11y).
 *
 * Test nay khoa 3 dieu:
 *   1. `<h2>` tieu de ton tai (truoc khi sua: 0 - vi dung h1);
 *   2. chi 1 `<h2>` title (them o 5 tab con se thanh 2 => test bat);
 *   3. page KHONG tu render `<h1>` (shell cung cap).
 *
 * Do kiem chung hien viet: `ShellPageTemplate.js:119` da render `<h1>`, nen 32
 * component di qua shell khong duoc sua. Phan nay chi lo 5 route portfolio.
 */

import { describe, expect, test, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioWorkspacePage } from "../PortfolioWorkspacePage";

afterEach(cleanup);

function renderTab(tail: string) {
  return render(
    <MemoryRouter initialEntries={[`/portfolios/1/${tail}`]}>
      <PortfolioProvider>
        <LangProvider>
          <Routes>
            <Route path="/portfolios/:portfolioId/:tab" element={<PortfolioWorkspacePage />} />
          </Routes>
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

const TABS = ["overview", "holdings", "allocation", "analytics", "activity"];

describe("PortfolioWorkspace - heading", () => {
  test.each(TABS)("tab %s co h2 title", (tab) => {
    renderTab(tab);
    expect(screen.getAllByRole("heading", { level: 2, name: /Không gian danh mục/ })).toHaveLength(1);
  });

  test.each(TABS)("tab %s khong tu render h1 (shell cung cap)", (tab) => {
    renderTab(tab);
    // page khong tu render h1 — shell (ShellPageTemplate) cung cap h1 theo route title
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
  });

  test("h2 title khong rong", () => {
    renderTab("overview");
    const [h2] = screen.getAllByRole("heading", { level: 2, name: /Không gian danh mục/ });
    expect((h2.textContent ?? "").trim().length).toBeGreaterThan(0);
  });
});
