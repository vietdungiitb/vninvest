/**
 * FU-01 - moi trang phai co DUNG MOT `<h1>`.
 *
 * 5 route portfolio (`/portfolios/:id/{overview,holdings,allocation,analytics,
 * activity}`) deu map ve MOT entry `portfolio-workspace`
 * (`pageRegistry.js:210-211`) => khung `PortfolioWorkspace` la noi dung de
 * dat `<h1>`, KHONG phai 5 file tab con.
 *
 * Test nay khoa 2 dieu:
 *   1. `<h1>` ton tai (truoc khi sua: 0);
 *   2. **chi 1** `<h1>` (them o 5 tab con se thanh 2 => test bat).
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
  test.each(TABS)("tab %s co h1", (tab) => {
    renderTab(tab);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  test.each(TABS)("tab %s chi co DUNG MOT h1", (tab) => {
    renderTab(tab);
    // 2 hoac nhieu hon = da them h1 o tab con (sai)
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeLessThanOrEqual(1);
  });

  test("h1 khong rong", () => {
    renderTab("overview");
    const [h1] = screen.getAllByRole("heading", { level: 1 });
    expect((h1.textContent ?? "").trim().length).toBeGreaterThan(0);
  });
});
