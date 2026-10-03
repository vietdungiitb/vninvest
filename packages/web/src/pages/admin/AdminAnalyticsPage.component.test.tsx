import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminAnalyticsPage } from "./AdminAnalyticsPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocAnalyticsGrowth: vi.fn(),
    getSocAnalyticsCohorts: vi.fn(),
    getSocAnalyticsAlerts: vi.fn(),
  },
}));

import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

// jsdom lacks ResizeObserver (recharts ResponsiveContainer needs it).
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const i18nValue = {
  locale: "vi",
  t: (key: string) => key,
};

function renderPage(staff: boolean) {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  } as never);
  return render(
    createElement(MemoryRouter, null, createElement(AdminAnalyticsPage)),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (defaultCoreApiAdapter.getSocAnalyticsGrowth as ReturnType<typeof vi.fn>).mockReset();
  (defaultCoreApiAdapter.getSocAnalyticsCohorts as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      trial_active: 2, converted_paid: 1, conversion_rate: 0.3333,
      upgrades_30d: 1, downgrades_30d: 0, notes: "n",
    });
  (defaultCoreApiAdapter.getSocAnalyticsAlerts as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      alerts: [{ kind: "trial_expiring", severity: "warning",
        tenant_code: "t1", tenant_id: "u1", detail: "2026-10-01" }],
      suspended_spike_7d: 0,
    });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminAnalyticsPage growth (R8.1 tenant-admin-refactor)", () => {
  it("renders growth chart for staff and switches days", async () => {
    (defaultCoreApiAdapter.getSocAnalyticsGrowth as ReturnType<typeof vi.fn>).mockResolvedValue({
      days: 30, signups: [{ date: "2026-09-01", count: 5 }],
      trials: [{ date: "2026-09-01", count: 1 }],
      paid_new: [{ date: "2026-09-01", count: 0 }],
      churned: [{ date: "2026-09-01", count: 0 }],
    });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("adminAnalytics.growthTitle")).toBeTruthy();
    expect(screen.getByText("adminAnalytics.cohortTitle")).toBeTruthy();
    expect(screen.getByText("adminAnalytics.alertsTitle")).toBeTruthy();
    });
    expect(defaultCoreApiAdapter.getSocAnalyticsGrowth).toHaveBeenCalledWith(30);
    const dayButtons = screen.getAllByText("adminAnalytics.days");
    fireEvent.click(dayButtons[dayButtons.length - 1]);
    await waitFor(() => {
      expect(defaultCoreApiAdapter.getSocAnalyticsGrowth).toHaveBeenCalledWith(90);
    });
  });

  it("shows noPermission and skips fetch for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
    expect(defaultCoreApiAdapter.getSocAnalyticsGrowth).not.toHaveBeenCalled();
  });
});
