import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import * as LangContext from "../../context/LangContext.js";
import * as PortfolioContext from "../../context/PortfolioContext.js";
import { AdminUsageFleetPage } from "./AdminUsageFleetPage";

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocUsageOverview: vi.fn(),
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
    createElement(MemoryRouter, null, createElement(AdminUsageFleetPage)),
  );
}

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
  (defaultCoreApiAdapter.getSocUsageOverview as ReturnType<typeof vi.fn>).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminUsageFleetPage (R3 tenant-admin-refactor)", () => {
  it("renders cards, top tenants and quotas for staff", async () => {
    (defaultCoreApiAdapter.getSocUsageOverview as ReturnType<typeof vi.fn>).mockResolvedValue({
      calls_today: 100, calls_30d: 600, error_rate_30d: 0.05,
      top_tenants: [{ tenant_id: "u1", tenant_code: "t1", display_name: "T1", calls: 300, errors: 20 }],
      quotas_near_limit: [{ tenant_code: "t1", display_name: "T1", meter: "api_calls", used_pct: 90 }],
    });
    renderPage(true);
    await waitFor(() => {
      expect(screen.getByText("T1")).toBeTruthy();
    });
    expect(screen.getByText("adminUsageFleet.title")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("shows noPermission and skips fetch for non-staff", async () => {
    renderPage(false);
    await waitFor(() => {
      expect(screen.getByText("common.noPermission")).toBeTruthy();
    });
    expect(defaultCoreApiAdapter.getSocUsageOverview).not.toHaveBeenCalled();
  });
});
