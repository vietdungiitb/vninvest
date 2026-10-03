import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminCoreServiceAccountsPage } from "./AdminCoreServiceAccountsPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getCoreOperatorTenantDetail: vi.fn(),
    getCoreOperatorTenantServiceAccounts: vi.fn(),
  },
}));

import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
};

function renderPage(staff: boolean) {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  } as never);
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/admin/tenants/t-1/service-accounts"] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/admin/tenants/:tenantId/service-accounts",
          element: createElement(AdminCoreServiceAccountsPage),
        }),
      ),
    ),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (coreApiAdapter.getCoreOperatorTenantDetail as ReturnType<typeof vi.fn>)
    .mockResolvedValue({ data: { tenant: { display_name: "Acme" } } });
  (coreApiAdapter.getCoreOperatorTenantServiceAccounts as ReturnType<typeof vi.fn>)
    .mockResolvedValue({ data: [], summary_cards: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminCoreServiceAccountsPage (R6 tenant-admin-refactor)", () => {
  it("disables write buttons in read-only phase", async () => {
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("adminCoreTenants.saCreate")).toBeTruthy();
    });
    expect(screen.getByText("adminCoreTenants.saCreate").closest("button")).toHaveProperty("disabled", true);
    expect(screen.getByText("adminCoreTenants.saEdit").closest("button")).toHaveProperty("disabled", true);
  });

  it("shows noPermission for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
  });
});
