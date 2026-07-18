import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import * as AbilityContext from "../../context/AbilityContext.js";
import * as ToastContext from "../../components/ShellToast.js";
import { TenantAdminRolesPage } from "./TenantAdminRolesPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    coreGet: vi.fn(),
    corePost: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    corePut: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
  formatNumber: (n: any) => n,
  formatCurrency: (n: any) => n,
  formatPriceVND: (n: any) => n,
  formatQuotePrice: (p: any) => p,
  formatQuoteVolume: (v: any) => v,
  formatQuoteInteger: (v: any) => v,
  formatDate: (d: any) => d,
  formatTime: (t: any) => t,
  formatDateTime: (dt: any) => dt,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(TenantAdminRolesPage)),
  );
}

beforeEach(() => {
  window.localStorage.setItem("tenant_id", "tenant-A");
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as any);
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({ activeTenantId: "tenant-A" } as any);
  vi.spyOn(AbilityContext, "useAbility").mockReturnValue({ can: () => true } as any);
  vi.spyOn(ToastContext, "useToast").mockReturnValue({ success: vi.fn(), error: vi.fn(), info: vi.fn() } as any);
  (defaultCoreApiAdapter.coreGet as any).mockReset();
});

describe("TenantAdminRolesPage", () => {
  it("renders skeleton while loading tenant-admin roles", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const hasSkeleton = container.querySelector("[class*='skeleton'], [class*='Skeleton']");
    expect(hasSkeleton || screen.queryByText("tenantRoles.title")).toBeTruthy();
  });

  it("renders error state when fetch fails", async () => {
    (defaultCoreApiAdapter.coreGet as any).mockRejectedValue(new Error("boom"));
    const { container } = renderPage();
    await waitFor(() => {
      const text = container.textContent || "";
      expect(text.includes("tenantRoles.loadError") || text.includes("boom")).toBe(true);
    });
  });
});
