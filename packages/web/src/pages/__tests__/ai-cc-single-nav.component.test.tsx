/**
 * S1 AC1.1 / AC1.2 / AC1.3 — `/settings/ai` phải có **đúng MỘT** hệ thống điều hướng.
 *
 * Bối cảnh (đo trước khi viết, `dev` @ `96cc87e12`):
 *   - `AICommandCenterPage.tsx:227` render `<AiHubNav>` — 5 tab ROUTE (`/settings/ai`,
 *     `/usage`, `/traces`, `/slo`, `/audit`).
 *   - `AICommandCenterPage.tsx:229-245` render `<nav className={styles.hubNav}>` thứ 2 —
 *     3 anchor trong trang (`#overview`, `#runtime`, `#audit`).
 *   - Cả hai dùng **cùng một bộ class** `aiSettings.module.css:132/145/169` và **cùng
 *     `aria-label`** = `t("aiCommandCenter.title")`.
 *   - Khi vừa tải (`location.hash === ""`): `AiHubNav.tsx:79` set active **và**
 *     `AICommandCenterPage.tsx:233` set active ⇒ **hai ô "Tổng quan" sáng đồng thời**.
 *
 * Fail-before: chạy nguyên file này trên bản tiền-sửa ⇒ 3 case đỏ.
 *
 * Ghi chú về mock: `AICommandCenterPage` gọi `usePortfolio()` để biết staff
 * (`AiHubNav.tsx:66`) và `getUserConfig()` cho event gate — cả hai phải mock,
 * nếu không component throw và assert đỏ vì **lý do sai** (xem `ai-hub-breadcrumb`
 * `.component.test.tsx:20-22` ghi lại đúng bài học này).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { LangProvider } from "../../context/LangContext.js";
import { AICommandCenterPage } from "../AICommandCenterPage.js";

// Lazy import trong page — không mock thì Suspense kéo thêm cả chuỗi component.
vi.mock("../../components/AIAuditLogsPanel.js", () => ({ AIAuditLogsPanel: () => null }));
vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

let isStaff = true;
vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({
    userIdentity: { isStaff, isSuperuser: false },
    userEntitlements: null,
    userPlan: null,
    ability: { can: () => true },
  }),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

const baseSettings = {
  ai_provider: "gemini",
  ai_model: "gemini-3.8-flash",
  ai_ready: true,
  effective_ai_provider: "gemini",
  effective_ai_model: "gemini-3.8-flash",
  effective_ai_source: "command_center",
  advisory_refresh_interval_hours: 24,
  advisory_max_tokens_per_day: 1000,
  advisory_max_auto_refreshes_per_day: 24,
  temperature: 0.3,
};

function renderHub() {
  const { container } = render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings/ai"] },
      createElement(LangProvider, null, createElement(AICommandCenterPage, {})),
    ),
  );
  return container;
}

beforeEach(() => {
  isStaff = true;
  vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings } as never);
  vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({ preferences: {} } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("S1 AC1: /settings/ai chi co MOT he thong dieu huong", () => {
  it("AC1.1 — chi DUNG MOT <nav> mang aria-label cua trang", async () => {
    const container = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    // `AiHubNav.tsx:117` dat `aria-label` = t("aiCommandCenter.title").
    // Nav thu 2 cua page dat **cung** gia tri do ⇒ truoc khi sua co 2 phan tu khop.
    const navs = Array.from(
      container.querySelectorAll("nav"),
    ).filter((n) => n.getAttribute("aria-label") === "Trung tâm điều hành AI");

    expect(
      navs.length,
      `so <nav> mang aria-label "Trung tâm điều hành AI" = ${navs.length}, phai = 1`,
    ).toBe(1);
  });

  it("AC1.2 — khi khong co hash, CHI MOT muc duoc to sang (khong hai o 'Tong quan' cung sang)", async () => {
    const container = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    // ⚠ AC1.2 phi `aria-current` la AC RONG: nav thu 2 (`AICommandCenterPage.tsx:230-244`)
    // chi gan `className`, **khong** gan `aria-current` ⇒ dem `aria-current` ra 1
    // CA TRUOC LAN SAU khi sua (do lai: ban v2 cua plan viet AC nay va no xanh san).
    // Observable that su moi sai la **class trang thai active**, thu su dat o ca 2 noi:
    //   - tab route: `AiHubNav.tsx:124` gan `styles.hubNavLinkActive`
    //   - anchor   : `AICommandCenterPage.tsx:233` gan `styles.hubNavLinkActive`
    // Khong hash => ca hai deu true => **2 o "Tong quan" cung sang**.
    //
    // Regex khop `hubNavLinkActive` nen dung duoc ca khi vitest tra class hashed
    // (`_hubNavLinkActive_xxx`) lan khi tra proxy ten goc.
    const activeCells = Array.from(
      container.querySelectorAll("a[class*='hubNavLinkActive']"),
    );

    expect(
      activeCells.length,
      `so muc dang to sang = ${activeCells.length}, phai = 1 ` +
      `(cac muc: ${activeCells.map((a) => a.textContent + " -> " + a.getAttribute("href")).join(" | ")})`,
    ).toBe(1);

    // Muc dang active phai la o cua he TAB ROUTE, khong phai anchor trong trang.
    const activeHref = activeCells[0]?.getAttribute("href") ?? "";
    expect(
      activeHref.includes("#"),
      `muc dang active la "${activeHref}" — day la anchor trong trang, khong phai tab route`,
    ).toBe(false);

    // Va `aria-current` cua he route van phai dung 1 (khong phai bo mat khi xoa nav thu 2).
    expect(container.querySelectorAll('[aria-current="page"]').length).toBe(1);
  });

  it("AC1.3 — he 5 tab ROUTE van con nguyen va tro dung dia chi", async () => {
    const container = renderHub();
    await waitFor(() => {
      expect(container.querySelector("h1")).toBeTruthy();
    });

    const hrefs = Array.from(container.querySelectorAll("nav a")).map((a) => a.getAttribute("href"));
    for (const expected of [
      "/settings/ai",
      "/settings/ai/usage",
      "/settings/ai/traces",
      "/settings/ai/slo",
      "/settings/ai/audit",
    ]) {
      expect(
        hrefs.some((h) => (h ?? "").startsWith(expected)),
        `thieu tab route ${expected}; nhan duoc: ${hrefs.join(" | ")}`,
      ).toBe(true);
    }
  });
});
