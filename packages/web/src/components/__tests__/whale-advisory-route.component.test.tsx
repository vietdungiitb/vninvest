import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
// @ts-expect-error vite ?raw import — resolved by vitest/vite, no type declaration needed
import mainSource from "../../main.tsx?raw";
// @ts-expect-error vite ?raw import
import pageRegistrySource from "../../pages/pageRegistry.js?raw";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));
vi.mock("@/components/ShellToast.js", () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/components/ConfirmModal.js", () => ({ useConfirm: () => async () => true }));
vi.mock("@/hooks/useWhaleAdvisoryData.js", () => ({
  useWhaleAdvisoryData: vi.fn(() => ({
    items: [],
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
  })),
}));

import { usePortfolio } from "@/context/PortfolioContext.js";
import { getPageComponent } from "../../pages/pageRegistry.js";

async function renderWhaleAdvisory() {
  (usePortfolio as any).mockReturnValue({
    userPlan: "Pro",
    activePortfolioId: "p1",
  });
  const { WhaleAdvisoryPage } = await import("../../pages/signals/WhaleAdvisoryPage.tsx");
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/ai-advisory"] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "ai-advisory",
          element: createElement(WhaleAdvisoryPage),
        }),
      ),
    ),
  );
}

describe("WhaleAdvisory route (S08)", () => {
  it("no dead /ai-advisory/shell link in source", () => {
    expect(mainSource).not.toContain("/ai-advisory/shell");
    expect(pageRegistrySource).not.toContain("/ai-advisory/shell");
  });

  it("pageRegistry no longer has dead ai-advisory entry", () => {
    expect(pageRegistrySource).not.toContain('makePageEntry("ai-advisory"');
  });

  it("ai-advisory removed from pageRegistry; whale-advisory is the live component", () => {
    expect(getPageComponent("ai-advisory")).toBeNull();
    expect(getPageComponent("whale-advisory")).toBeTruthy();
  });

  it("WhaleAdvisoryPage renders without shell host link", async () => {
    await renderWhaleAdvisory();
    expect(screen.queryByText("Mở shell kiểm chứng")).toBeNull();
  }, 30000);
});
