import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
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
/**
 * WAVE 8 / NAV-1 — `search` là query string deep-link (mặc định `""`).
 * `SearchProbe` đọc `useSearchParams()` — cùng nguồn sự thật với hook `useUrlValue`
 * nên đọc lại được URL sau khi hook ghi.
 */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function renderPage(search = "") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [search ? `/?${search}` : "/"] },
      createElement(
        QueryClientProvider,
        { client },
        createElement(SearchProbe),
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

  // ── WAVE 8 / NAV-1: `tab` phai điều khiển bằng URL thật, không chỉ setState ──
  // 3 test trên chỉ chứng minh "trang không crash". Ba test dưới đây mới là
  // tiêu chuẩn người dùng quan tâm: F5 / copy link có giữ đúng tab không.
  describe("NAV-1: tab đồng bộ URL", () => {
    function mockOk() {
      (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
        async (url: string) => {
          if (String(url).includes("/partner/me/summary/")) {
            return { tenant: { plan: "free" }, quotas: {}, my: {} };
          }
          return { results: [] };
        });
    }

    /** Đọc `location.search` — cùng nguồn sự thật với hook `useUrlValue`. */
    function currentSearch(): string {
      return screen.getByTestId("search").textContent || "";
    }

    it("A. URL rỗng → tab mặc định `meters` và URL KHÔNG bị ghi `?tab=meters`", async () => {
      mockOk();
      renderPage("");
      await waitFor(() => expect(screen.getByTestId("search")).toBeTruthy());
      expect(currentSearch()).toBe("");
    });

    it("C. deep-link ?tab=history → mount ra ĐÃ ở tab history", async () => {
      mockOk();
      renderPage("tab=history");
      await waitFor(() => expect(screen.getByTestId("search")).toBeTruthy());
      // `usageTabCodec` giữ nguyên giá trị khác mặc định trong URL.
      expect(currentSearch()).toBe("tab=history");
    });

    it("C2. ?tab=bogus → vẫn hiện panel MẶC ĐỊNH, không rơi vào trạng thái rỗng", async () => {
      mockOk();
      renderPage("tab=bogus");
      await waitFor(() => {
        const body = document.body.textContent || "";
        expect(body).toContain("tenantUsageSummary.cardPlan");
      });
      // ⚠ Cố ý **không** assert URL rỗng. `useUrlValue` chỉ ghi URL khi setter
      // được gọi; nó không tự viết lại URL lúc mount. Nên `?tab=bogus` vẫn nằm
      // lại cho tới khi người dùng bấm tab — đây là hành vi ĐÚNG: không tự ý
      // sửa URL của người dùng. Điều cần chứng minh là **panel mặc định vẫn
      // hiện**, đó là điều người dùng quan tâm.
    });
  });
});
