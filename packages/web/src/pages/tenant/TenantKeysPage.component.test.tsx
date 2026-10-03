import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import * as ToastContext from "../../components/ShellToast.js";
import { TenantKeysPage } from "./TenantKeysPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    coreGet: vi.fn(),
    corePost: vi.fn(),
    corePatch: vi.fn(),
    coreDelete: vi.fn(),
    corePut: vi.fn(),
  },
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(TenantKeysPage)),
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
  (defaultCoreApiAdapter.corePost as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TenantKeysPage", () => {
  it("renders skeleton while loading", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>)
      .mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    const hasSkeleton = container.querySelector("[class*='skeleton'], [class*='Skeleton']");
    expect(hasSkeleton || screen.queryByText("tenantKeys.title")).toBeTruthy();
  });

  it("renders noPermission when canRead is false", async () => {
    vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
      ability: { can: () => false },
    } as never);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("common.noPermission").length).toBeGreaterThan(0);
    });
  });

  it("creates key and shows secret exactly once", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("usage-summary")) return { total_keys: 1, keys: [] };
        return { results: [] };
      });
    (defaultCoreApiAdapter.corePost as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "k1", label: "personal:mykey", secret: "vni_pro_abcdef",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("tenantKeys.createAction").length).toBeGreaterThan(0);
    });
    const createBtn = screen.getAllByRole("button", { name: "tenantKeys.createAction" })[0];
    await act(async () => {
      fireEvent.click(createBtn);
    });
    await waitFor(() => {
      const el = document.querySelector('input[name="display_name"]');
      if (!el) throw new Error("input not yet");
      expect(el).toBeTruthy();
    });
    const nameInput = document.querySelector('input[name="display_name"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "mykey" } });
    });
    const innerBtn = document.querySelector("button.bg-emerald-600") as HTMLButtonElement;
    expect(innerBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(innerBtn);
    });
    await waitFor(() => {
      expect(defaultCoreApiAdapter.corePost).toHaveBeenCalled();
    }, { timeout: 3000 });
    await waitFor(() => {
      const body = document.body.textContent || "";
      expect(body).toContain("vni_pro_abcdef");
    }, { timeout: 3000 });
    expect(document.body.textContent).toContain("tenantKeys.secretOnceWarning");
  });

  it("revokes key after confirm", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("usage-summary")) return { total_keys: 1, active_keys: 1, keys: [] };
        return { results: [{ id: "k1", label: "personal:mykey", token_prefix: "vni_pro_abcd", status: "active" }] };
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("tenantKeys.revokeAction")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("tenantKeys.revokeAction"));
    });
    await waitFor(() => {
      expect(defaultCoreApiAdapter.corePost).toHaveBeenCalledWith(
        "/partner/me/keys/k1/revoke/", expect.anything());
    });
  });

  it("renders a status pill per key so active vs revoked is distinguishable", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("usage-summary")) return { total_keys: 2, active_keys: 1, keys: [] };
        return {
          results: [
            { pat_id: "k1", label: "personal:live", token_prefix: "vni_a", status: "active" },
            { pat_id: "k2", label: "personal:dead", token_prefix: "vni_b", status: "revoked", revoked: true, revoked_at: "2026-09-20T10:00:00+07:00" },
            { pat_id: "k3", label: "personal:old", token_prefix: "vni_c", status: "expired" },
          ],
        };
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("key-status-k1")).toBeTruthy();
    });
    expect(screen.getByTestId("key-status-k1").textContent).toContain("tenantKeys.status.active");
    expect(screen.getByTestId("key-status-k2").textContent).toContain("tenantKeys.status.revoked");
    expect(screen.getByTestId("key-status-k3").textContent).toContain("tenantKeys.status.expired");
    // the status column header exists
    expect(document.body.textContent).toContain("tenantKeys.colStatus");
  });

  it("hides rotate/revoke on non-active keys and shows the active/total summary", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("usage-summary")) return { total_keys: 2, active_keys: 1, keys: [] };
        return {
          results: [
            { pat_id: "k1", label: "personal:live", token_prefix: "vni_a", status: "active" },
            { pat_id: "k2", label: "personal:dead", token_prefix: "vni_b", status: "revoked", revoked: true },
          ],
        };
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("key-status-summary")).toBeTruthy();
    });
    // exactly one actionable row (the active one)
    expect(screen.getAllByText("tenantKeys.revokeAction")).toHaveLength(1);
    expect(screen.getAllByText("tenantKeys.noActions")).toHaveLength(1);
  });

  it("never renders a raw ISO timestamp for expires/last-used", async () => {
    (defaultCoreApiAdapter.coreGet as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (String(url).includes("usage-summary")) return { total_keys: 1, active_keys: 1, keys: [] };
        return {
          results: [{
            pat_id: "k1", label: "personal:live", token_prefix: "vni_a", status: "active",
            expires_at: "2026-09-27T21:55:59.060485+07:00",
            last_used_at: "2026-09-26T08:00:00+07:00",
          }],
        };
      });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("key-status-k1")).toBeTruthy();
    });
    const body = document.body.textContent || "";
    expect(body).not.toContain("2026-09-27T21:55:59.060485+07:00");
    expect(body).not.toContain("2026-09-26T08:00:00+07:00");
  });
});
