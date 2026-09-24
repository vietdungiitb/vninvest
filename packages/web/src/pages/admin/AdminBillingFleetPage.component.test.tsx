import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminBillingFleetPage } from "./AdminBillingFleetPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocBillingOverview: vi.fn(),
    getSocBillingInvoices: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
};

function renderPage(staff: boolean) {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  } as never);
  return render(
    createElement(MemoryRouter, null, createElement(AdminBillingFleetPage)),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (defaultCoreApiAdapter.getSocBillingOverview as ReturnType<typeof vi.fn>).mockReset();
  (defaultCoreApiAdapter.getSocBillingInvoices as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminBillingFleetPage (R2 tenant-admin-refactor)", () => {
  it("renders MRR cards and invoice rows for staff", async () => {
    (defaultCoreApiAdapter.getSocBillingOverview as ReturnType<typeof vi.fn>).mockResolvedValue({
      mrr: 600000, arr: 7200000, currency: "VND", plan_mix: [{ plan: "pro", count: 1, mrr: 500000 }],
      trials_active: 2, invoices_failed_30d: 1, revenue_6m: [{ month: "2026-09", total: "200001" }],
    });
    (defaultCoreApiAdapter.getSocBillingInvoices as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1, next: null, previous: null,
      results: [{ id: 7, invoice_number: "INV-1", status: "paid", amount_due: "100000",
        currency: "VND", paid_at: null, tenant_code: "t1", tenant_id: "uuid-1",
        tenant_name: "T1", tenant_plan: "pro", created_at: "2026-09-01" }],
    });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("INV-1")).toBeTruthy();
    });
    expect(screen.getByText("adminBillingFleet.title")).toBeTruthy();
    expect(screen.getByText("adminBillingFleet.pageOf")).toBeTruthy();
  });

  it("shows noPermission and skips fetch for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
    expect(defaultCoreApiAdapter.getSocBillingOverview).not.toHaveBeenCalled();
    expect(defaultCoreApiAdapter.getSocBillingInvoices).not.toHaveBeenCalled();
  });

  it("export button downloads CSV with download=csv", async () => {
    (defaultCoreApiAdapter.getSocBillingOverview as ReturnType<typeof vi.fn>).mockResolvedValue({
      mrr: 0, arr: 0, plan_mix: [], trials_active: 0, invoices_failed_30d: 0, revenue_6m: [],
    });
    (defaultCoreApiAdapter.getSocBillingInvoices as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 0, next: null, previous: null, results: [],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["a,b"], { type: "text/csv" })),
    });
    vi.stubGlobal("fetch", fetchMock);
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement");
    const clickSpy = vi.fn();
    createSpy.mockImplementation(((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLElement;
      }
      return (origCreate as typeof document.createElement).call(document, tag as any);
    }) as typeof document.createElement);
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("adminBillingFleet.export")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("adminBillingFleet.export"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/operator/soc/billing/invoices/");
    expect(url).toContain("download=csv");
    expect(clickSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
    createSpy.mockRestore();
  });
});
