import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminCoreTenantsPage } from "./AdminCoreTenantsPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getCoreOperatorTenants: vi.fn(),
    getCoreOperatorTenantDetail: vi.fn(),
    corePost: vi.fn(),
  },
  defaultCoreApiAdapter: {
    staffSwitch: vi.fn(),
  },
}));

import { coreApiAdapter, defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
};

function renderPage(staff: boolean) {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  } as never);
  return render(
    createElement(MemoryRouter, null, createElement(AdminCoreTenantsPage)),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (coreApiAdapter.getCoreOperatorTenants as ReturnType<typeof vi.fn>).mockReset();
  (coreApiAdapter.getCoreOperatorTenantDetail as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminCoreTenantsPage (R0 tenant-admin-refactor)", () => {
  it("renders registry rows for staff and links to /admin/tenants/:id", async () => {
    (coreApiAdapter.getCoreOperatorTenants as ReturnType<typeof vi.fn>).mockResolvedValue({
      summary_cards: [],
      data: [{ id: "t-1", display_name: "Acme", tenant_code: "acme", plan_code: "pro", status: "active" }],
    });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("Acme")).toBeTruthy();
    });
    const link = screen.getByText("adminCoreTenants.columnViewDetail").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin/tenants/t-1");
  });

  it("shows noPermission and skips fetch for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
    expect(coreApiAdapter.getCoreOperatorTenants).not.toHaveBeenCalled();
  });

  it("paginates with page param and shows pager", async () => {
    (coreApiAdapter.getCoreOperatorTenants as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ summary_cards: [], data: [], count: 45, next: "x", previous: null });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("adminCoreTenants.pageOf")).toBeTruthy();
    });
    expect(coreApiAdapter.getCoreOperatorTenants).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    fireEvent.click(screen.getByText("adminCoreTenants.nextPage"));
    await waitFor(() => {
      expect(coreApiAdapter.getCoreOperatorTenants).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it("switch modal posts reason and stores token", async () => {
    (coreApiAdapter.getCoreOperatorTenants as ReturnType<typeof vi.fn>).mockResolvedValue({
      summary_cards: [],
      data: [{ id: "t-9", display_name: "Acme9", tenant_code: "acme9" }],
      count: 1, next: null, previous: null,
    });
    (coreApiAdapter.getCoreOperatorTenantDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { tenant: { id: "t-9", display_name: "Acme9", tenant_code: "acme9" } },
    });
    (defaultCoreApiAdapter.staffSwitch as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: "tok", tenant: { id: "t-9" }, expires_at: "2030-01-01",
    });
    vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
      userIdentity: { isStaff: true, isSuperuser: false },
    } as never);
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/admin/tenants/t-9"] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/admin/tenants/:tenantId", element: createElement(AdminCoreTenantsPage) }),
        ),
      ),
    );
    await waitFor(() => {
      expect(screen.getByText("adminCoreTenants.switchAction")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("adminCoreTenants.switchAction"));
    fireEvent.change(screen.getByPlaceholderText("adminCoreTenants.switchReasonPh"), {
      target: { value: "ho tro khach hang" },
    });
    fireEvent.click(screen.getByText("adminCoreTenants.switchSubmit"));
    await waitFor(() => {
      expect(defaultCoreApiAdapter.staffSwitch).toHaveBeenCalledWith(
        { tenant_id: "t-9", reason: "ho tro khach hang" },
      );
    });
    const stored = window.sessionStorage.getItem("staff_switch");
    expect(stored).toContain("tok");
  });
});
