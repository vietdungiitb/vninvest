import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));
vi.mock("@/context/LangContext.js", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { usePortfolio } from "@/context/PortfolioContext.js";
import {
  sidebarItems,
  isActivePath,
} from "../../layouts/full/vertical/sidebar/sidebaritems";
import { routeCatalog } from "../../app/routeCatalog.js";
import { Sidebar } from "../../layouts/full/vertical/sidebar/Sidebar";
import viDict from "../../i18n/vi.js";
import enDict from "../../i18n/en.js";

function mockPortfolio(overrides: Record<string, unknown> = {}) {
  (usePortfolio as any).mockReturnValue({
    userTenants: [],
    activeTenantId: null,
    switchTenant: vi.fn(),
    userIdentity: { id: null, username: "", email: "", isStaff: false, isSuperuser: false },
    ...overrides,
  });
}

function renderSidebar() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard"] },
      createElement(Sidebar, { mobileOpen: true, onMobileClose: () => {} }),
    ),
  );
}

function allPaths() {
  return sidebarItems.flatMap((group) => group.items.map((item) => item.path));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPortfolio();
});

describe("main menu contract (menu 2026-09-22)", () => {
  it("has no group/item label duplicates and no UserConfig label", () => {
    const nav = (viDict as any).layout.nav;
    expect(nav.group.dashboard).not.toBe(nav.dashboard);
    expect(nav.group.trading).not.toBe(nav.transactions);
    expect(nav.settings).toBe("Cài đặt");
    expect(JSON.stringify(nav)).not.toContain("UserConfig");
    const enNav = (enDict as any).layout.nav;
    expect(enNav.settings).toBe("Settings");
    expect(JSON.stringify(enNav)).not.toContain("UserConfig");
  });

  it("has no duplicate paths and no whale-alerts entry", () => {
    const paths = allPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).not.toContain("/whale-alerts");
    const signals = sidebarItems.find((group) => group.group === "layout.nav.group.signals");
    expect(signals?.items.map((item) => item.path)).toEqual(["/alert-center", "/ai-advisory"]);
    const admin = sidebarItems.find((group) => group.group === "layout.nav.group.admin");
    expect(admin?.items.map((item) => item.path)).not.toContain("/alert-center");
    expect(admin?.items.every((item) => (item as any).staffOnly === true)).toBe(true);
  });

  it("hides the admin group for non-staff", () => {
    mockPortfolio({ userIdentity: { isStaff: false, isSuperuser: false } });
    renderSidebar();
    expect(screen.queryByText("layout.nav.group.admin")).toBeNull();
    expect(screen.queryByText("layout.nav.soc")).toBeNull();
    expect(screen.queryByText("layout.nav.tenantAdmin")).toBeNull();
    expect(screen.queryByText("layout.nav.adminUsers")).toBeNull();
    expect(screen.queryByText("layout.nav.adminTenants")).toBeNull();
    expect(screen.queryByText("layout.nav.adminBilling")).toBeNull();
    expect(screen.queryByText("layout.nav.adminUsage")).toBeNull();
    expect(screen.queryByText("layout.nav.adminAudit")).toBeNull();
    expect(screen.getByText("layout.nav.dashboard")).toBeTruthy();
  });

  it("shows the full admin group for staff", () => {
    mockPortfolio({ userIdentity: { isStaff: true, isSuperuser: false } });
    renderSidebar();
    expect(screen.getByText("layout.nav.group.admin")).toBeTruthy();
    expect(screen.getByText("layout.nav.soc")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminCrawlControl")).toBeTruthy();
    expect(screen.getByText("layout.nav.tenantAdmin")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminUsers")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminTenants")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminBilling")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminUsage")).toBeTruthy();
    expect(screen.getByText("layout.nav.adminAudit")).toBeTruthy();
  });

  it("matches nested paths via isActivePath", () => {
    expect(isActivePath("/alert-center/123", "/alert-center")).toBe(true);
    expect(isActivePath("/alert-center", "/alert-center")).toBe(true);
    expect(isActivePath("/dashboard", "/dashboard")).toBe(true);
    expect(isActivePath("/", "/dashboard")).toBe(true);
    expect(isActivePath("/settings/ai/agents", "/settings/ai")).toBe(true);
    expect(isActivePath("/watchlist", "/alert-center")).toBe(false);
  });

  it("covers every sidebar path in routeCatalog", () => {
    const catalogPaths = new Set((routeCatalog as Array<{ path: string }>).map((entry) => entry.path));
    const missing = allPaths().filter((path) => !catalogPaths.has(path));
    expect(missing).toEqual([]);
  });

  it("shows tenant self-service group for non-staff with tenant", () => {
    mockPortfolio({
      userTenants: [{ tenant_id: "t1", display_name: "T1", plan: "pro" }],
    });
    renderSidebar();
    expect(screen.getByText("layout.nav.group.tenantSelf")).toBeTruthy();
    expect(screen.getByText("layout.nav.tenantKeys")).toBeTruthy();
    expect(screen.getByText("layout.nav.tenantUsageSummary")).toBeTruthy();
  });

  it("hides tenant self-service group when user has no tenant", () => {
    mockPortfolio({ userTenants: [] });
    renderSidebar();
    expect(screen.queryByText("layout.nav.group.tenantSelf")).toBeNull();
    expect(screen.queryByText("layout.nav.tenantKeys")).toBeNull();
  });
});
