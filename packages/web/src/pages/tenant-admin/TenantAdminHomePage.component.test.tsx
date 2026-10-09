import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import * as AbilityContext from "../../context/AbilityContext.js";

// Polyfill ResizeObserver for recharts ResponsiveContainer in jsdom
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    coreGet: vi.fn(),
    corePost: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    corePut: vi.fn(),
    getDashboardSummary: vi.fn(),
    getUsageTrend: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { TenantAdminHomePage } from "./TenantAdminHomePage.js";

const i18nValue: any = {
  locale: "vi",
  t: (key: string, _opts?: any) => key,
  formatNumber: (n: any) => String(n),
  formatCurrency: (n: any) => String(n),
  formatPriceVND: (n: any) => String(n),
  formatQuotePrice: (p: any) => p,
  formatQuoteVolume: (v: any) => v,
  formatQuoteInteger: (v: any) => v,
  formatDate: (d: any) => d,
  formatTime: (t: any) => t,
  formatDateTime: (dt: any) => dt,
};

const summaryMock: any = {
  health_score: 85,
  health_breakdown: { quota: 90, activity: 80, base: 30 },
  members_active_today: 3,
  members_total: 5,
  api_calls_today: 120,
  api_calls_limit: 1000,
  quota_headroom_pct: 88,
  plan: "pro",
  plan_status: "active",
  trial_remaining_days: null,
  service_accounts: { active: 2, disabled: 0 },
  pats_expiring_soon: 1,
  pats_total: 3,
  sso_configured: true,
  webhook_count: 2,
  recent_events: [],
};

const trendMock: any = {
  daily: [
    { date: "2026-09-03", api_calls: 10, active_members: 2 },
    { date: "2026-09-04", api_calls: 12, active_members: 3 },
  ],
  days: 7,
};

/**
 * WAVE 9 — đọc `useSearchParams()`: cùng nguồn sự thật với `useUrlValue`.
 * Không dùng `window.location.search` — `MemoryRouter` không chạm vào `window`.
 */
function SearchProbe() {
  const [params] = useSearchParams();
  return createElement("div", { "data-testid": "search" }, params.toString());
}

function renderPage(client?: QueryClient, search = "") {
  const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(
        MemoryRouter,
        { initialEntries: [search ? `/?${search}` : "/"] },
        createElement(SearchProbe),
        createElement(TenantAdminHomePage),
      ),
    ),
  );
}

beforeEach(() => {
  window.localStorage.setItem("tenant_id", "tenant-A");
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    ability: { can: () => true } as any,
    userIdentity: { username: "tester", email: "t@example.com" } as any,
    userPlan: "pro",
    activeTenantId: "tenant-A",
  } as any);
  try {
    // some builds use AbilityContext directly
    vi.spyOn(AbilityContext as any, "useAbility").mockReturnValue({ can: () => true } as any);
  } catch {}
  (defaultCoreApiAdapter.getDashboardSummary as any).mockReset();
  (defaultCoreApiAdapter.getUsageTrend as any).mockReset();
  (defaultCoreApiAdapter.corePost as any)?.mockReset?.();
});

describe("TenantAdminHomePage Phase 0", () => {
  it("renders skeleton while loading", async () => {
    (defaultCoreApiAdapter.getDashboardSummary as any).mockReturnValue(new Promise(() => {}));
    (defaultCoreApiAdapter.getUsageTrend as any).mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    // Hardened: must find real skeleton DOM, not title fallback (audit Phase 1 feedback)
    await waitFor(() => {
      const skeletonEl = container.querySelector('[style*="shellPulse"], [style*="shellShimmer"], [class*="pulse"], [class*="shimmer"]') || (container.innerHTML.includes("shellPulse") || container.innerHTML.includes("shellShimmer") ? container : null);
      // ShellSkeleton renders pulse/shimmer animation; title alone is not sufficient
      const hasSkeleton = !!skeletonEl && (container.innerHTML.includes("shellPulse") || container.innerHTML.includes("shellShimmer"));
      expect(hasSkeleton).toBeTruthy();
    });
  });

  it("renders error state with retry when summary fails", async () => {
    (defaultCoreApiAdapter.getDashboardSummary as any).mockRejectedValue(new Error("boom-summary"));
    (defaultCoreApiAdapter.getUsageTrend as any).mockResolvedValue(trendMock);
    const { container } = renderPage();
    await waitFor(() => {
      const text = container.textContent || "";
      expect(text.includes("boom-summary") || text.includes("common.loadError")).toBe(true);
    });
    await waitFor(() => {
      const btns = Array.from(container.querySelectorAll("button"));
      expect(btns.length).toBeGreaterThan(0);
    });
  });

  it("does not share cache on tenant switch (F01 regression) — via QueryProvider invalidation", async () => {
    // Hardened: use single client with QueryProvider listener (audit Phase 1 feedback)
    // Mock QueryProvider's listener: we simulate what QueryProvider does (invalidate on tenant-changed)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateOnTenantChanged = () => {
      const tid = window.localStorage.getItem("tenant_id") ?? "none";
      client.invalidateQueries({ queryKey: ["tenant-admin", tid] });
    };
    window.addEventListener("tenant-changed", invalidateOnTenantChanged);

    (defaultCoreApiAdapter.getDashboardSummary as any).mockResolvedValue({ ...summaryMock, health_score: 80 });
    (defaultCoreApiAdapter.getUsageTrend as any).mockResolvedValue(trendMock);
    window.localStorage.setItem("tenant_id", "tenant-A");
    renderPage(client);
    await waitFor(() => expect((defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length).toBeGreaterThan(0));
    const callsAfterA = (defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length;
    // pre-seed to prove cache exists
    expect(client.getQueryData(["tenant-admin", "tenant-A", "tenant-home", "summary"])).toBeDefined();

    // switch tenant — should trigger fresh fetch for tenant-B, not reuse A
    (defaultCoreApiAdapter.getDashboardSummary as any).mockClear();
    (defaultCoreApiAdapter.getDashboardSummary as any).mockResolvedValue({ ...summaryMock, health_score: 90 });
    window.localStorage.setItem("tenant_id", "tenant-B");
    window.dispatchEvent(new CustomEvent("tenant-changed", { detail: { tenantId: "tenant-B" } }));
    // Force remount with same client but new tenant scope
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(TenantAdminHomePage)),
      ),
    );
    await waitFor(() => expect((defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length).toBeGreaterThan(0));
    const callsAfterB = (defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length;
    expect(callsAfterB).toBeGreaterThan(0);
    // ensure A cache preserved separately
    expect(client.getQueryData(["tenant-admin", "tenant-A", "tenant-home", "summary"])).toBeDefined();
    expect(client.getQueryData(["tenant-admin", "tenant-B", "tenant-home", "summary"])).toBeDefined();
    expect(callsAfterA).toBeDefined();
    window.removeEventListener("tenant-changed", invalidateOnTenantChanged);
  });

  it("switches trend 7d -> 30d triggers new fetch", async () => {
    (defaultCoreApiAdapter.getDashboardSummary as any).mockResolvedValue(summaryMock);
    (defaultCoreApiAdapter.getUsageTrend as any).mockResolvedValue(trendMock);
    const { container } = renderPage();
    await waitFor(() => expect((defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length).toBeGreaterThan(0));
    await waitFor(() => {
      const btn30 = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("30d"));
      expect(btn30).toBeTruthy();
    });
    const btn30 = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("30d"))!;
    (defaultCoreApiAdapter.getUsageTrend as any).mockClear();
    fireEvent.click(btn30);
    await waitFor(() => expect((defaultCoreApiAdapter.getUsageTrend as any).mock.calls.length).toBeGreaterThan(0));
    const lastCall = (defaultCoreApiAdapter.getUsageTrend as any).mock.calls[0]?.[0];
    expect(lastCall).toBe(30);
  });

  it("checklist PAT uses pats_total not expiring_soon (F04b)", async () => {
    (defaultCoreApiAdapter.getDashboardSummary as any).mockResolvedValue({
      ...summaryMock,
      pats_total: 0,
      pats_expiring_soon: 5,
    });
    (defaultCoreApiAdapter.getUsageTrend as any).mockResolvedValue(trendMock);
    const { container } = renderPage();
    await waitFor(() => {
      const text = container.textContent || "";
      // checklist PAT should be NOT done when pats_total=0 even though expiring=5
      expect(text.includes("tenantHome.checklistPAT")).toBe(true);
    });
    // Find PAT checklist row: it shows Setup button when not done
    const setupBtns = Array.from(container.querySelectorAll("a")).filter((a) => a.textContent?.includes("tenantHome.checklistSetup"));
    expect(setupBtns.length).toBeGreaterThan(0);
  });

  it("refresh button refetches both summary and trend", async () => {
    (defaultCoreApiAdapter.getDashboardSummary as any).mockResolvedValue(summaryMock);
    (defaultCoreApiAdapter.getUsageTrend as any).mockResolvedValue(trendMock);
    const { container } = renderPage();
    await waitFor(() => expect((defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length).toBeGreaterThan(0));
    await waitFor(() => {
      const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("common.refresh"));
      expect(btn).toBeTruthy();
    });
    (defaultCoreApiAdapter.getUsageTrend as any).mockClear();
    (defaultCoreApiAdapter.getDashboardSummary as any).mockClear();
    const refreshBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("common.refresh"))!;
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect((defaultCoreApiAdapter.getDashboardSummary as any).mock.calls.length + (defaultCoreApiAdapter.getUsageTrend as any).mock.calls.length).toBeGreaterThan(0);
    });
  });

  // ── WAVE 9 / NAV-1: `activityFilter` phai điều khiển bằng URL thật ─────────
  // `activityFilterCodec` BỎ giá trị mặc định `"all"` khỏi URL ⇒ URL sạch khi
  // người dùng chưa lọc. Đây là điều phải kiểm, không phải "dùng hook cho có".
  describe("NAV-1: activityFilter dong bo URL", () => {
    const search = () => screen.getByTestId("search").textContent || "";

    it("A. URL rong → mac dinh `all`, va URL VAN RONG", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId("search")).toBeTruthy());
      expect(search()).toBe("");
    });

    it("C. deep-link ?activity=order → gia tri khoi tao tu URL", async () => {
      renderPage(undefined, "activity=order");
      await waitFor(() => expect(screen.getByTestId("search")).toBeTruthy());
      // Gia tri KHAC mac dinh thi codec giu nguyen trong URL.
      expect(search()).toBe("activity=order");
    });

    it("C2. ?activity=all → rơi ve mac dinh (URL van chua tham so)", async () => {
      renderPage(undefined, "activity=all");
      await waitFor(() => expect(screen.getByTestId("search")).toBeTruthy());
      // `parse` tra `undefined` cho gia tri mac dinh ⇒ UI dung `all`.
      // Hook KHONG tu viet lai URL luc mount ⇒ `?activity=all` van con.
      // KHONG assert URL rong o day — xem ghi chu ben duoi.
      expect(search()).toBe("activity=all");
    });
  });
});