import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import * as ToastContext from "../../components/ShellToast.js";
import { TenantUsageSummaryPage } from "./TenantUsageSummaryPage";

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
  formatNumber: (n: unknown) => n,
  formatCurrency: (n: unknown) => n,
  formatPriceVND: (n: unknown) => n,
  formatQuotePrice: (p: unknown) => p,
  formatQuoteVolume: (v: unknown) => v,
  formatQuoteInteger: (v: unknown) => v,
  formatDate: (d: unknown) => d,
  formatTime: (t: unknown) => t,
  formatDateTime: (dt: unknown) => dt,
};

/**
 * WAVE 7 / NAV-1 — trang doc `tab` bang `useUrlValue` (`react-router-dom`), nen
 * moi `render` phai co `<Router>`.
 *
 * KHONG bo wrapper: `useUrlValue` -> `useSearchParams` -> `useLocation()` nem
 * `useLocation() may be used only in the context of a <Router> component.`
 * Do la ly do 3 test trong file nay do khi `tab` duoc chuyen sang URL.
 * Pattern lay theo `soc-nav1-url-state.component.test.tsx`.
 */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      createElement(
        QueryClientProvider,
        { client },
        createElement(TenantUsageSummaryPage),
      ),
    ),
  );
}

beforeEach(() => {
  window.localStorage.setItem("tenant_id", "tenant-A");
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    ability: { can: () => true },
  } as never);
  vi.spyOn(ToastContext, "useToast").mockReturnValue({
    success: vi.fn(), error: vi.fn(), info: vi.fn(),
  } as never);
  (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TenantUsageSummaryPage", () => {
  it("renders skeleton while loading", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>)
      .mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const hasSkeleton = container.querySelector("[class*='skeleton'], [class*='Skeleton']");
    expect(hasSkeleton || screen.queryByText("tenantUsageSummary.title")).toBeTruthy();
  });

  it("renders cards from me/summary", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("/partner/me/summary/")) {
          return {
            tenant: { plan: "pro", status: "active" },
            quotas: { api_calls_limit: 50000 },
            my: { total_keys: 2, active_keys: 1, calls_30d: 42 },
          };
        }
        return { results: [] };
      });
    renderPage();
    await waitFor(() => {
      const body = document.body.textContent || "";
      expect(body).toContain("tenantUsageSummary.cardPlan");
    });
    const body = document.body.textContent || "";
    expect(body).toContain("pro");
  });

  it("renders chart rows from analytics", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("/partner/me/summary/")) {
          return { tenant: { plan: "free" }, quotas: {}, my: {} };
        }
        if (String(url).includes("api-calls")) {
          return { results: [{ endpoint: "/x/", calls: 7 }] };
        }
        return { results: [] };
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("/x/")).toBeTruthy();
    });
  });
});
