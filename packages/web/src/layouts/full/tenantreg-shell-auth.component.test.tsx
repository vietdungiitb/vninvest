/**
 * tenantreg-e / E3 + E4 — the shell chrome must not lie.
 *
 * E3: the sidebar rendered a no-op logout button and the hardcoded strings
 *     'User' / 'user@example.com' while destructuring `userIdentity` and never
 *     using it.
 * E4: StaffRoute toasted the literal string "common.noPermission" — there was no
 *     t() call anywhere in the file and ShellToast renders {message} raw.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const h = vi.hoisted(() => ({
  usePortfolio: vi.fn(),
  navigate: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: h.usePortfolio }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock("@/components/ShellToast.js", () => ({
  useToast: () => ({ warning: h.toastWarning, error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

import { Sidebar } from "@/layouts/full/vertical/sidebar/Sidebar.js";
import { StaffRoute } from "@/components/StaffRoute.js";

const IDENTITY = {
  id: 42,
  username: "nam",
  email: "nam@example.com",
  isStaff: false,
  isSuperuser: false,
  display_name: "Nguyễn Nam",
  avatar_url: "https://cdn.example/nam.png",
};

beforeEach(() => {
  h.usePortfolio.mockReset();
  h.navigate.mockReset();
  h.toastWarning.mockReset();
  h.usePortfolio.mockReturnValue({
    userTenants: [],
    activeTenantId: null,
    switchTenant: vi.fn(),
    userIdentity: IDENTITY,
    logout: vi.fn().mockResolvedValue(undefined),
  });
});

function renderSidebar() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard"] },
      createElement(Sidebar, { mobileOpen: true, onMobileClose: vi.fn() }),
    ),
  );
}

describe("tenantreg-e E3 — Sidebar identity + logout", () => {
  it("renders the real identity, not the 'User' / 'user@example.com' placeholders", () => {
    renderSidebar();
    expect(screen.getByText("Nguyễn Nam")).toBeTruthy();
    expect(screen.getByText("nam@example.com")).toBeTruthy();
    expect(screen.queryByText("user@example.com")).toBeNull();
    expect(screen.queryByText("User")).toBeNull();
  });

  it("the logout button actually logs out and navigates to /login", () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    h.usePortfolio.mockReturnValue({
      userTenants: [], activeTenantId: null, switchTenant: vi.fn(),
      userIdentity: IDENTITY, logout,
    });
    renderSidebar();

    const button = screen.getByRole("button", { name: /Đăng xuất|Log out/ });
    fireEvent.click(button);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith("/login");
  });

  it("falls back to the username when display_name is absent", () => {
    h.usePortfolio.mockReturnValue({
      userTenants: [], activeTenantId: null, switchTenant: vi.fn(),
      userIdentity: { ...IDENTITY, display_name: "" },
      logout: vi.fn().mockResolvedValue(undefined),
    });
    renderSidebar();
    expect(screen.getByText("nam")).toBeTruthy();
  });

  it("shows a localized placeholder when the identity is still loading", () => {
    h.usePortfolio.mockReturnValue({
      userTenants: [], activeTenantId: null, switchTenant: vi.fn(),
      userIdentity: { id: null, username: '', email: '', isStaff: false, isSuperuser: false },
      logout: vi.fn().mockResolvedValue(undefined),
    });
    renderSidebar();
    expect(screen.getByText("Người dùng")).toBeTruthy();
  });

  it("renders the workspace selector with the active workspace selected (E5/E1)", () => {
    h.usePortfolio.mockReturnValue({
      userTenants: [
        { tenant_id: "tenant-a", display_name: "Alpha", plan: "pro" },
        { tenant_id: "tenant-b", display_name: "Beta", plan: "free" },
      ],
      activeTenantId: "tenant-b",
      switchTenant: vi.fn(),
      userIdentity: IDENTITY,
      logout: vi.fn().mockResolvedValue(undefined),
    });
    renderSidebar();
    const select = screen.getByLabelText(/Không gian làm việc|Workspace/) as HTMLSelectElement;
    // A blank selector with no matching option was the E5 symptom.
    expect(select.value).toBe("tenant-b");
    expect(screen.getByText("Alpha (PRO)")).toBeTruthy();
  });
});

describe("tenantreg-e E4 — StaffRoute toast is translated", () => {
  function renderStaff(isStaff: boolean) {
    h.usePortfolio.mockReturnValue({ userIdentity: { ...IDENTITY, isStaff, isSuperuser: false } });
    return render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/admin/tenants"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/admin/tenants",
            element: createElement(StaffRoute, null, createElement("span", null, "SECRET")),
          }),
          createElement(Route, { path: "/dashboard", element: createElement("span", null, "DASHBOARD") }),
        ),
      ),
    );
  }

  it("does NOT toast the raw i18n key", () => {
    renderStaff(false);
    expect(h.toastWarning).toHaveBeenCalledTimes(1);
    const message = h.toastWarning.mock.calls[0][0];
    expect(message).not.toBe("common.noPermission");
    expect(message).toMatch(/quyền|permission/i);
  });

  it("does not toast for a staff user", () => {
    renderStaff(true);
    expect(h.toastWarning).not.toHaveBeenCalled();
    expect(screen.getByText("SECRET")).toBeTruthy();
  });

  it("the key it translates actually exists in BOTH locales (no defaultValue fallback in prod)", async () => {
    // `common.noPermission` is pre-existing (vi.js:5 / en.js:5). If slice D ever
    // drops it the toast would silently degrade to the defaultValue, so pin it.
    const { default: vi } = await import("@/i18n/vi.js");
    const { default: en } = await import("@/i18n/en.js");
    expect((vi as any).common?.noPermission).toBeTruthy();
    expect((en as any).common?.noPermission).toBeTruthy();
    expect((vi as any).common.noPermission).not.toBe("common.noPermission");
    expect((en as any).common.noPermission).not.toBe("common.noPermission");
  });
});
