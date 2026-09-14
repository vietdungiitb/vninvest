import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocOverviewPanel } from "../soc/SocOverviewPanel.js";
import { SocPrefetchPanel } from "../soc/SocPrefetchPanel.js";
import { validateDateRange } from "../soc/socValidation.js";

const adapterMocks = vi.hoisted(() => ({
  getSocOverviewSummary: vi.fn(),
  getSocPrefetchConfig: vi.fn(),
  getSocPrefetchCacheStatus: vi.fn(),
  getSocPrefetchUniverseGroups: vi.fn(),
  warmSocPrefetchNow: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocOverviewSummary: adapterMocks.getSocOverviewSummary,
    getSocPrefetchConfig: adapterMocks.getSocPrefetchConfig,
    getSocPrefetchCacheStatus: adapterMocks.getSocPrefetchCacheStatus,
    getSocPrefetchUniverseGroups: adapterMocks.getSocPrefetchUniverseGroups,
    warmSocPrefetchNow: adapterMocks.warmSocPrefetchNow,
  },
}));

vi.mock("../soc/SocSchedulerBoard.js", () => ({
  SocSchedulerBoard: () => null,
}));

describe("SocOverviewPanel retry (COC-05)", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
  });

  afterEach(() => cleanup());

  it("shows a Retry button when the summary fetch fails, and clicking it retries successfully", async () => {
    adapterMocks.getSocOverviewSummary
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        services: [{ service_key: "vnbroker_quote", name: "VNBroker Quote", domain: "vnbroker", status: "healthy", is_active: true }],
        total: 1,
      });

    render(<SocOverviewPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    });
    expect(screen.getByText("VNBroker Quote")).toBeTruthy();
    expect(adapterMocks.getSocOverviewSummary).toHaveBeenCalledTimes(2);
  });
});

describe("SocPrefetchPanel warm groups (COC-38)", () => {
  beforeEach(() => {
    adapterMocks.getSocPrefetchConfig.mockReset();
    adapterMocks.getSocPrefetchCacheStatus.mockReset();
    adapterMocks.getSocPrefetchUniverseGroups.mockReset();
    adapterMocks.warmSocPrefetchNow.mockReset();
    adapterMocks.getSocPrefetchConfig.mockResolvedValue({ batch_size: 100, symbol_limit: 50 });
    adapterMocks.getSocPrefetchCacheStatus.mockResolvedValue({ hit_rate: 0, size_mb: 0, ttl_minutes: 30 });
    adapterMocks.getSocPrefetchUniverseGroups.mockResolvedValue({
      groups: [
        { id: "vn100", name: "VN100", selected: true },
        { id: "custom", name: "CUSTOM", selected: false },
      ],
    });
    adapterMocks.warmSocPrefetchNow.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("calls warmSocPrefetchNow with the selected universe groups", async () => {
    render(<SocPrefetchPanel />);

    const warmButton = await screen.findByText("soc.prefetch.warm_now");
    fireEvent.click(warmButton);

    await waitFor(() => {
      expect(adapterMocks.warmSocPrefetchNow).toHaveBeenCalledWith("async", { groups: ["vn100"] });
    });
  });
});

describe("validateDateRange (R-NEW-3)", () => {
  const t = (key: string) => key;

  it("returns null when both dates are valid", () => {
    expect(validateDateRange("2026-01-01", "2026-12-31", t)).toBeNull();
  });

  it("returns an error when 'from' is after 'to'", () => {
    expect(validateDateRange("2026-12-31", "2026-01-01", t)).toBe("soc.dataops.error_date_range");
  });

  it("returns an error when the window exceeds 365 days", () => {
    expect(validateDateRange("2025-01-01", "2026-12-31", t)).toBe("soc.dnse.error_max_range");
  });
});