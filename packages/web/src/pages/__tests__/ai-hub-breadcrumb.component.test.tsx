/**
 * R4.4 AC2 — mọi route AI CC phải có breadcrumb quay về `/settings`.
 *
 * Bối cảnh đo được trước khi viết: **không** trang AI CC nào render `Breadcrumb`.
 * Vậy AC2 không phải "sửa nhãn nhanh" mà là **thiếu hẳn**. Test ở đây quét **source**
 * của cả 5 trang để một trang mới thêm sau này (ví dụ tab AI mới) không lọt qua
 * quên render breadcrumb — cùng tinh thần với `test_urls_py_has_no_write_route...`
 * ở R4.3: sự vắng mặt phải được canh bằng thứ **chạy được**, không bằng grep tay.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../context/LangContext.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";

// `LangProvider` cần `PortfolioProvider` (gọi `usePortfolio()` ở `LangContext.js:31`).
// Bản đầu thiếu mock này ⇒ component throw ⇒ breadcrumb không render ⇒ assert đỏ vì
// lý do sai. Bằng chứng: `Error: usePortfolio must be used inside PortfolioProvider`.
vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff: false, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

/** 5 trang AI CC tương ứng 5 route trong `main.tsx`. */
const AI_CC_PAGES = [
  "AICommandCenterPage.tsx",      // /settings/ai
  "AIAgentFederationPage.tsx",    // /settings/ai/agents
  "AIUsageAnalyticsPage.tsx",     // /settings/ai/usage
  "AICommandTracesPage.tsx",      // /settings/ai/traces
  "AISloDashboardPage.tsx",       // /settings/ai/slo
];

function readPage(file: string): string {
  return readFileSync(resolve(process.cwd(), "src/pages", file), "utf8");
}

describe("R4.4 AC2: breadcrumb tren moi route AI CC", () => {
  it("ca 5 trang AI CC deu render Breadcrumb", () => {
    const missing = AI_CC_PAGES.filter((file) => !readPage(file).includes("Breadcrumb"));
    expect(
      missing, missing.length ? `thieu Breadcrumb: ${missing.join(", ")}` : "",
    ).toEqual([]);
  });

  it("Breadcrumb tao duong dan quay ve /settings tren route con", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/traces"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const back = screen.getByRole("link", { name: /cài đặt/i });
    expect(back.getAttribute("href")).toBe("/settings");
  });

  it("muc 'ai' la link toi /settings/ai, khong phai chuoi tho", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/slo"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const hub = screen.getByRole("link", { name: /trí tuệ nhân tạo/i });
    expect(hub.getAttribute("href")).toBe("/settings/ai");
  });

  it("3 muc dieu huong doc duoc tren /settings/ai/slo", () => {
    // AC3 la "3 anh"; test nay khoa phan "3 muc" bang DOM de anh chup khong
    // the chung minh duoc mau.
    const { container } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/slo"] },
        createElement(LangProvider, null, createElement(Breadcrumb, { key: "bc" })),
      ),
    );
    const nav = container.querySelector("nav.breadcrumb");
    expect(nav).toBeTruthy();
    const hrefs = Array.from(nav?.querySelectorAll("a") || []).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/settings/ai");
  });

  it("trang co that dung component Breadcrumb (khong phai ban sao inline)", () => {
    for (const file of AI_CC_PAGES) {
      const source = readPage(file);
      expect(source).toMatch(/from ["'][^"']*Breadcrumb/);
    }
    expect(existsSync(resolve(process.cwd(), "src/components/Breadcrumb.tsx"))).toBe(true);
  });
});