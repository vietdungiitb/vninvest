/**
 * R4.5 — tab thứ 6 "Nhật ký kiểm toán" + phân quyền staff.
 *
 * Bối cảnh đo được trước khi viết:
 * - Plan ghi "6 tab (thêm Traces)" nhưng **Traces đã có từ R3.2**; thực tế có 5 tab
 *   khớp 5 route. Owner đã chốt tab thứ 6 là **Nhật ký kiểm toán** (BE đã có sẵn
 *   endpoint audit + export CSV của R4.3).
 * - `StaffRoute.tsx:14` **đã có sẵn** guard staff-only ⇒ AC3 dùng lại, không tự chế.
 *
 * AC3 là AC quan trọng nhất: "tab ẩn **không** truy cập được bằng URL trực tiếp".
 * Vì vậy test này kiểm **cả hai lớp**: tab không render (UI) **và** route bọc
 * `StaffRoute` (guard). Chỉ kiểm lớp UI thì AC3 hỏng mà test vẫn xanh — cùng lớp
 * lỗi với `L-V04`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AiHubNav } from "../../components/AiHubNav.js";
import { StaffRoute } from "../../components/StaffRoute.js";

vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => usePortfolioMock(),
  PortfolioProvider: ({ children }: { children?: unknown }) => children,
}));

import * as PortfolioContext from "../../context/PortfolioContext.js";
import * as LangContext from "../../context/LangContext.js";
import * as ToastContext from "../../components/ShellToast.js";

const usePortfolioMock = vi.fn();

function staffPortfolio() {
  return { userIdentity: { isStaff: true, isSuperuser: false } } as any;
}

function memberPortfolio() {
  return { userIdentity: { isStaff: false, isSuperuser: false } } as any;
}

// `t` bị mock trả **key** nen phải so theo `labelKey`, khong phai nhan tieng Viet.
const TABS = [
  "aiCommandCenter.tabOverview",
  "aiCommandCenter.tabAgents",
  "aiCommandCenter.tabUsage",
  "aiCommandCenter.tabTraces",
  "aiCommandCenter.tabSlo",
];

function renderNav(path = "/settings/ai") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(AiHubNav, { key: "nav" }),
    ),
  );
}

beforeEach(() => {
  usePortfolioMock.mockReset();
  vi.spyOn(LangContext, "useI18n").mockReturnValue({
    locale: "vi",
    t: (key: string) => key,
    formatNumber: (n: unknown) => n,
  } as any);
  vi.spyOn(ToastContext, "useToast").mockReturnValue({
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  } as any);
});

describe("R4.5 AC1: 6 tab trong AiHubNav", () => {
  it("staff thay 6 tab, trong do co 'Nhat ky kiem toan'", () => {
    usePortfolioMock.mockReturnValue(staffPortfolio());
    const { container } = renderNav();
    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(6);
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining([
      "/settings/ai",
      "/settings/ai/agents",
      "/settings/ai/usage",
      "/settings/ai/traces",
      "/settings/ai/slo",
      "/settings/ai/audit",
    ]));
  });

  it("tab moi dung o cuoi, khong chen giua cac tab cu", () => {
    usePortfolioMock.mockReturnValue(staffPortfolio());
    const { container } = renderNav();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs[hrefs.length - 1]).toBe("/settings/ai/audit");
    // 5 tab cu giu nguyen thu tu.
    expect(hrefs.slice(0, 5)).toEqual([
      expect.stringMatching(/^\/settings\/ai(\?|$)/),
      "/settings/ai/agents",
      "/settings/ai/usage",
      "/settings/ai/traces",
      "/settings/ai/slo",
    ]);
  });
});

describe("R4.5 AC2: user thuong khong thay tab staff", () => {
  it("member chi thay 5 tab, khong co tab audit", () => {
    usePortfolioMock.mockReturnValue(memberPortfolio());
    const { container } = renderNav();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toHaveLength(5);
    expect(hrefs).not.toContain("/settings/ai/audit");
    for (const tab of TABS) {
      expect(screen.getByText(tab)).toBeTruthy();
    }
  });

  it("superuser van thay tab audit (khong khoá nhầm nguoi quan tri)", () => {
    usePortfolioMock.mockReturnValue({ userIdentity: { isStaff: false, isSuperuser: true } } as any);
    const { container } = renderNav();
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/settings/ai/audit");
  });
});

describe("R4.5 AC3: go URL truc tiep van bi chan (khong chi an UI)", () => {
  it("route /settings/ai/audit duoc boc StaffRoute trong main.tsx", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    const auditRoute = main
      .split("\n")
      .find((line) => line.includes("settings/ai/audit"));
    expect(auditRoute, "khong tim thay route settings/ai/audit trong main.tsx").toBeTruthy();
    expect(auditRoute).toContain("StaffRoute");
  });

  it("non-staff mo thang /settings/ai/audit bi dua ve /dashboard", async () => {
    usePortfolioMock.mockReturnValue(memberPortfolio());
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/audit"] },
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { path: "/settings/ai/audit", element: createElement(StaffRoute, null, "AUDIT-PAGE") },
          ),
          createElement(Route, { path: "/dashboard", element: "DASHBOARD" }),
        ),
      ),
    );
    await waitFor(() => {
      expect(screen.getByText("DASHBOARD")).toBeTruthy();
    });
    expect(screen.queryByText("AUDIT-PAGE")).toBeNull();
  });

  it("staff van mo duoc trang audit", async () => {
    usePortfolioMock.mockReturnValue(staffPortfolio());
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/settings/ai/audit"] },
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { path: "/settings/ai/audit", element: createElement(StaffRoute, null, "AUDIT-PAGE") },
          ),
          createElement(Route, { path: "/dashboard", element: "DASHBOARD" }),
        ),
      ),
    );
    await waitFor(() => {
      expect(screen.getByText("AUDIT-PAGE")).toBeTruthy();
    });
  });
});

describe("R4.5 AC4: active state dung tren 6 route", () => {
  const CASES: Array<[string, string]> = [
    ["/settings/ai", "/settings/ai"],
    ["/settings/ai/agents", "/settings/ai/agents"],
    ["/settings/ai/usage", "/settings/ai/usage"],
    ["/settings/ai/traces", "/settings/ai/traces"],
    ["/settings/ai/slo", "/settings/ai/slo"],
    ["/settings/ai/audit", "/settings/ai/audit"],
  ];

  for (const [path, expectedHref] of CASES) {
    it(`${path} danh dau active dung ${expectedHref}`, () => {
      usePortfolioMock.mockReturnValue(staffPortfolio());
      const { container } = renderNav(path);
      const active = Array.from(container.querySelectorAll('a[aria-current="page"]'));
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute("href")).toBe(expectedHref);
    });
  }
});
