import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));
vi.mock("@/components/ShellToast.js", () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/components/ConfirmModal.js", () => ({ useConfirm: () => async () => true }));

const hookState: Record<string, unknown> = {
  items: [],
  loading: true,
  error: null,
  symbolStats: [],
  statsLoading: false,
  refreshInfoMap: {},
  pendingRefreshSymbols: {},
  pendingDeleteSymbols: {},
  rowMessages: {},
  fetchData: vi.fn(),
  loadRefreshInfo: vi.fn(),
  handleRefreshAdvisory: vi.fn(),
  handleDeleteAdvisory: vi.fn(),
};

vi.mock("@/hooks/useWhaleAdvisoryData.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/hooks/useWhaleAdvisoryData.js")>();
  return { ...mod, useWhaleAdvisoryData: vi.fn(() => hookState) };
});

import { usePortfolio } from "@/context/PortfolioContext.js";

async function renderPage() {
  (usePortfolio as any).mockReturnValue({ userPlan: "Pro", activePortfolioId: "p1" });
  const { WhaleAdvisoryPage } = await import("../../pages/signals/WhaleAdvisoryPage.tsx");
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/ai-advisory"] },
      createElement(Routes, null, createElement(Route, { path: "ai-advisory", element: createElement(WhaleAdvisoryPage) })),
    ),
  );
}

describe("WhaleAdvisory banner + skeleton + quota (S10)", () => {
  beforeEach(() => {
    Object.assign(hookState, {
      items: [],
      loading: true,
      error: null,
      symbolStats: [],
      statsLoading: false,
      refreshInfoMap: {},
    });
  });

  it("shows skeleton on first load", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  }, 30000);

  it("shows budgetSoftWarning banner when tokens run low", async () => {
    Object.assign(hookState, {
      items: [{ symbol: "FPT", created_at: new Date().toISOString() }],
      loading: false,
      symbolStats: [{ symbol: "FPT" }],
      refreshInfoMap: {
        FPT: {
          tokens_used: 1800,
          token_budget: 2000,
          tokens_remaining_today: 200,
          pct_used: 90,
          budget_soft_warning: true,
          budget_hard_exceeded: false,
          auto_refresh: false,
          auto_refreshes_used_today: 9,
          advisory_max_auto_refreshes_per_day: 10,
        },
      },
    });
    await renderPage();
    expect(await screen.findByText(/Token budget 90% used/, {}, { timeout: 20000 })).toBeTruthy();
  }, 30000);

  it("quota max comes from BE, not hardcoded 5", async () => {
    Object.assign(hookState, {
      items: [],
      loading: false,
      symbolStats: [{ symbol: "FPT" }],
      refreshInfoMap: {
        FPT: {
          tokens_used: 300,
          token_budget: 2000,
          tokens_remaining_today: 1700,
          pct_used: 15,
          budget_soft_warning: false,
          budget_hard_exceeded: false,
          auto_refresh: false,
          auto_refreshes_used_today: 2,
          advisory_max_auto_refreshes_per_day: 10,
        },
      },
    });
    const { container } = await renderPage();
    expect(container.textContent).toContain("10");
  }, 30000);

  it("shows a visible error instead of silently hiding the banner when refresh-info fails", async () => {
    Object.assign(hookState, {
      items: [{ symbol: "FPT", created_at: new Date().toISOString() }],
      loading: false,
      symbolStats: [{ symbol: "FPT" }],
      refreshInfoMap: {},
      refreshInfoErrors: { FPT: "refresh-info-unavailable" },
    });
    await renderPage();
    expect(await screen.findByText(/Không tải được hạn mức làm mới/, {}, { timeout: 20000 })).toBeTruthy();
  }, 30000);
});
