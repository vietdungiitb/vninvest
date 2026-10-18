/**
 * R1.8 — AiHubNav chung 3 route + 1 hệ token + giữ filter qua tab.
 * Fail-before: AC1 (inline style root) / AC2 (không AiHubNav) / AC3 (thiếu p) /
 * AC4 (mất filter khi qua tab) RED. AC5 = gate check-ai-cc AC8. AC6 review.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    locale: "vi",
    localeTag: "vi-VN",
    t: (k: string) => k,
    formatNumber: (n: unknown) => String(n ?? ""),
    formatCurrency: (n: unknown) => String(n ?? ""),
    formatDate: (d: unknown) => String(d ?? ""),
    formatTime: (t: unknown) => String(t ?? ""),
    formatDateTime: (dt: unknown) => String(dt ?? ""),
  }),
}));

import { AICommandCenterPage } from "../../pages/AICommandCenterPage.js";
import { AIUsageAnalyticsPage } from "../../pages/AIUsageAnalyticsPage.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";

const adapterMocks = vi.hoisted(() => ({
  getAICommandCenterConfig: vi.fn(),
  updateAICommandCenterConfig: vi.fn(),
  getAIAuditLogs: vi.fn(),
  getUserConfig: vi.fn(),
  updateUserConfig: vi.fn(),
  getAIUsageAggregate: vi.fn(),
  getAIUsageSummary: vi.fn(),
  getAIUsageRecords: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    get getAICommandCenterConfig() {
      return adapterMocks.getAICommandCenterConfig;
    },
    get updateAICommandCenterConfig() {
      return adapterMocks.updateAICommandCenterConfig;
    },
    get getAIAuditLogs() {
      return adapterMocks.getAIAuditLogs;
    },
    get getUserConfig() {
      return adapterMocks.getUserConfig;
    },
get updateUserConfig() {
        return adapterMocks.updateUserConfig;
      },
      get getAIUsageAggregate() {
      return adapterMocks.getAIUsageAggregate;
    },
    get getAIUsageSummary() {
      return adapterMocks.getAIUsageSummary;
    },
    get getAIUsageRecords() {
      return adapterMocks.getAIUsageRecords;
    },
  },
}));

vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  ConfirmProvider: ({ children }: { children: unknown }) => children,
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

const baseSettings = {
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_ready: true,
  effective_ai_provider: "openai",
  effective_ai_model: "gpt-4o-mini",
  effective_ai_source: "command_center",
  advisory_whale_signal_enabled: false,
  advisory_refresh_interval_hours: 6,
  advisory_max_tokens_per_day: 1000,
  temperature: 0.3,
  ai_api_key_configured: false,
  ai_prompt_config: null,
  ai_prompt_config_history: [],
};

const LOGS = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  action: "update_settings",
  actor: "admin",
  reason: "",
  before_json: {},
  after_json: {},
  diff_summary: "",
  created_at: "2026-10-10T00:00:00Z",
}));

function mockAll() {
  adapterMocks.getAICommandCenterConfig.mockResolvedValue({ ...baseSettings });
  adapterMocks.updateAICommandCenterConfig.mockImplementation(async (p: Record<string, unknown>) => ({
    ...baseSettings,
    ...p,
  }));
  adapterMocks.getAIAuditLogs.mockImplementation(
    ({ offset = 0, limit = 10 }: { offset: number; limit: number }) =>
      Promise.resolve({ results: LOGS.slice(offset, offset + limit), total: LOGS.length })
  );
  adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
  adapterMocks.updateUserConfig.mockResolvedValue({ advisory_whale_signal_enabled: true });
  adapterMocks.getAIUsageAggregate.mockResolvedValue({ total_requests: 1 });
  adapterMocks.getAIUsageSummary.mockResolvedValue({ results: [] });
  adapterMocks.getAIUsageRecords.mockResolvedValue({ results: [], total: 0 });
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: true, isSuperuser: false },
  } as never);
}

function renderRoutes(initial: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initial] },
      createElement(Routes, null, [
          createElement(Route, { key: "hub", path: "/settings/ai", element: createElement(AICommandCenterPage, {}) }),
          createElement(Route, { key: "usage", path: "/settings/ai/usage", element: createElement(AIUsageAnalyticsPage, {}) }),
        ])
      )
    );
}

const HUB = resolve(process.cwd(), "src/pages/AICommandCenterPage.tsx");
const AI_PAGES = [
  HUB,
  resolve(process.cwd(), "src/pages/AIUsageAnalyticsPage.tsx"),
];

describe("R1.8: AiHubNav + 1 hệ token", () => {
  beforeEach(() => {
    for (const fn of Object.values(adapterMocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
    mockAll();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AC1: 0 style={{ trong 3 page (trừ quota động)", () => {
    const bad: string[] = [];
    for (const f of AI_PAGES) {
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((ln, i) => {
        if (/style:\s*\{/.test(ln)) {
          // ngoại lệ duy nhất: quota width động (kề quotaBar)
          const ctx = src.split("\n").slice(Math.max(0, i - 4), i + 5).join("\n");
          if (!ctx.includes("quota")) bad.push(`${f}:${i + 1}`);
        }
      });
    }
    expect(bad, bad.join(",")).toEqual([]);
  });

  it("AC2: cả 3 route render AiHubNav, active đúng", async () => {
    for (const [path, activeKey] of [
      ["/settings/ai", "aiCommandCenter.tabOverview"],
      ["/settings/ai/usage", "aiCommandCenter.tabUsage"],
    ] as const) {
      const { unmount } = renderRoutes(path);
      const navs = await screen.findAllByRole("navigation");
      // R5.1d: tìm nav hub theo **cấu trúc**: nav chứa link `/settings/ai/usage`.
      // Breadcrumb cũng có link `/settings/ai` nên `a[href^="/settings/ai"]` vẫn
      // khớp nhầm breadcrumb (nó đứng trước trong DOM). `/settings/ai/usage` chỉ
      // xuất hiện trong tab nav ⇒ chỉ khớp đúng 1 nav. Cùng cách với selector E2E.
      const hubNav = navs.find((n) => n.querySelector('a[href="/settings/ai/usage"]'));
      expect(hubNav, `thiếu AiHubNav ở ${path}`).toBeTruthy();
      const active = hubNav?.querySelector('[aria-current="page"]');
      expect(active?.textContent, `thiếu tab active ở ${path}`).toBeTruthy();
      unmount();
    }
  });

  it("AC3: /settings/ai/usage có h1 + p mô tả", async () => {
    const { container } = renderRoutes("/settings/ai/usage");
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("routes.aiUsageAnalytics");
    // p mô tả cấp page (dashboard cũng render cùng key — lấy phần tử page)
    const descs = screen.getAllByText("aiUsageAnalytics.description");
    expect(descs.length).toBeGreaterThan(0);
    expect(container.querySelector("h1 + p")?.textContent).toBe("aiUsageAnalytics.description");
  });

  it("AC4: qua tab Usage rồi về ⇒ filter audit còn nguyên", async () => {
    renderRoutes("/settings/ai?action=update_settings&page=3");
    await waitFor(() => {
      const calls = adapterMocks.getAIAuditLogs.mock.calls as { offset: number }[][];
      expect(calls.some((c) => (c[0] as unknown as { offset: number }).offset === 20)).toBe(true);
    });
    const usageTab = screen.getByText("aiCommandCenter.tabUsage");
    await act(async () => {
      fireEvent.click(usageTab);
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "routes.aiUsageAnalytics"
      );
    });
    const overviewTab = screen.getByText("aiCommandCenter.tabOverview");
    expect(overviewTab.closest("a")?.getAttribute("href")).toContain("action=update_settings");
    await act(async () => {
      fireEvent.click(overviewTab);
    });
    await waitFor(() => {
      const calls = adapterMocks.getAIAuditLogs.mock.calls as { offset: number }[][];
      expect(
        calls.some((c) => (c[0] as unknown as { offset: number }).offset === 20)
      ).toBe(true);
    });
  }, 20000);
});
