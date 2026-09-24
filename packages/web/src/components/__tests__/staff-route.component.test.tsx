import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));
vi.mock("@/components/ShellToast.js", () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

import { usePortfolio } from "@/context/PortfolioContext.js";
import { StaffRoute, TenantRoute } from "../StaffRoute.js";

function renderAt(path: string, isStaff: boolean) {
  (usePortfolio as any).mockReturnValue({
    userIdentity: { isStaff, isSuperuser: false },
  });
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: "/admin/tenants",
          element: createElement(StaffRoute, null, createElement("span", null, "SECRET-ADMIN")),
        }),
        createElement(Route, {
          path: "/dashboard",
          element: createElement("span", null, "DASHBOARD"),
        }),
      ),
    ),
  );
}

describe("StaffRoute (R0 tenant-admin-refactor)", () => {
  it("renders children for staff", () => {
    renderAt("/admin/tenants", true);
    expect(screen.getByText("SECRET-ADMIN")).toBeTruthy();
    expect(screen.queryByText("DASHBOARD")).toBeNull();
  });

  it("redirects non-staff to /dashboard", () => {
    renderAt("/admin/tenants", false);
    expect(screen.queryByText("SECRET-ADMIN")).toBeNull();
    expect(screen.getByText("DASHBOARD")).toBeTruthy();
  });
});

describe("TenantRoute (R0 tenant-admin-refactor)", () => {
  function renderTenantAt(path: string, tenants: unknown[]) {
    (usePortfolio as any).mockReturnValue({
      userIdentity: { isStaff: false, isSuperuser: false },
      userTenants: tenants,
    });
    return render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/tenant/keys",
            element: createElement(TenantRoute, null, createElement("span", null, "SELF-KEYS")),
          }),
          createElement(Route, {
            path: "/dashboard",
            element: createElement("span", null, "DASHBOARD"),
          }),
        ),
      ),
    );
  }

  it("renders children for users with a tenant", () => {
    renderTenantAt("/tenant/keys", [{ tenant_id: "t1" }]);
    expect(screen.getByText("SELF-KEYS")).toBeTruthy();
  });

  it("redirects tenant-less users to /dashboard", () => {
    renderTenantAt("/tenant/keys", []);
    expect(screen.queryByText("SELF-KEYS")).toBeNull();
    expect(screen.getByText("DASHBOARD")).toBeTruthy();
  });
});
