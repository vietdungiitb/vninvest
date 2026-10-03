import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocOverviewPanel } from "../soc/SocOverviewPanel.js";
import { SocPrefetchPanel } from "../soc/SocPrefetchPanel.js";
import { SocRuntimeKpiPanel } from "../soc/SocRuntimeKpiPanel.js";
import { validateDateRange } from "../soc/socValidation.js";

const adapterMocks = vi.hoisted(() => ({
  getSocOverviewSummary: vi.fn(),
  getSocSloOverview: vi.fn(),
  getSocPrefetchConfig: vi.fn(),
  getSocPrefetchCacheStatus: vi.fn(),
  getSocPrefetchUniverseGroups: vi.fn(),
  warmSocPrefetchNow: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocOverviewSummary: adapterMocks.getSocOverviewSummary,
    getSocSloOverview: adapterMocks.getSocSloOverview,
    getSocPrefetchConfig: adapterMocks.getSocPrefetchConfig,
    getSocPrefetchCacheStatus: adapterMocks.getSocPrefetchCacheStatus,
    getSocPrefetchUniverseGroups: adapterMocks.getSocPrefetchUniverseGroups,
    warmSocPrefetchNow: adapterMocks.warmSocPrefetchNow,
  },
}));

vi.mock("../soc/SocSchedulerBoard.js", () => ({
  SocSchedulerBoard: () => null,
}));

vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("SocOverviewPanel retry (COC-05)", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });

  afterEach(() => cleanup());

  it("shows a Retry button when the summary fetch fails, and clicking it retries successfully", async () => {
    adapterMocks.getSocOverviewSummary
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        services: [{ service_key: "vnbroker_quote", name: "VNBroker Quote", domain: "vnbroker", status: "healthy", is_active: true }],
        total: 1,
      });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });

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

  it("renders SLO badges when SLO overview data is present", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "vnbroker_quote", name: "VNBroker Quote", domain: "vnbroker", status: "healthy", is_active: true }],
      total: 1,
    });
    adapterMocks.getSocSloOverview.mockResolvedValue({
      services: [
        { service_key: "vnbroker_quote", uptime_30d: 0.98765, burn_rate_1h: 0.25, error_budget_remaining: 0.88, slo_target: 0.999 },
      ],
    });

    render(<SocOverviewPanel />);

    await waitFor(() => {
      expect(screen.getByText("soc.slo.uptime_label 98.77%")).toBeTruthy();
    });
    expect(screen.getByText("soc.slo.burn_rate_label 0.25")).toBeTruthy();
    expect(screen.getByText("soc.slo.budget_label 88.0%")).toBeTruthy();
  });
});

describe("SocRuntimeKpiPanel burn-rate sparkline (Phase 3 Step 4c)", () => {
  beforeEach(() => {
    adapterMocks.getSocSloOverview.mockReset();
  });

  afterEach(() => cleanup());

  it("renders per-service sparkline bars with SLO data", async () => {
    adapterMocks.getSocSloOverview.mockResolvedValue({
      services: [
        {
          service_key: "vnbroker_quote",
          name: "VNBroker Quote",
          domain: "vnbroker",
          status: "healthy",
          is_active: true,
          slo_target: 0.999,
          uptime_30d: 0.9875,
          burn_rate_1h: 0.25,
          error_budget_remaining: 0.88,
          last_check_at: "2026-09-15T09:00:00+07:00",
          recent_checks_24h: [
            { hour: "2026-09-14T10:00:00+07:00", checks: 2, failed: 0 },
            { hour: "2026-09-15T09:00:00+07:00", checks: 2, failed: 1 },
          ],
        },
      ],
    });

    render(<SocRuntimeKpiPanel />);

    await waitFor(() => {
      expect(screen.getByText("VNBroker Quote")).toBeTruthy();
    });
    const sparkline = screen.getByRole("img", {
      name: /soc.slo.spark_heading VNBroker Quote/,
    });
    expect(sparkline).toBeTruthy();
    expect(sparkline.querySelectorAll('[data-testid^="spark-bar-"]').length).toBe(2);
    expect(screen.getByText("soc.slo.spark_failed_summary")).toBeTruthy();
  });

  it("shows empty state when no SLO data exists (cold start)", async () => {
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });

    render(<SocRuntimeKpiPanel />);

    await waitFor(() => {
      expect(screen.getByText("soc.slo.spark_empty")).toBeTruthy();
    });
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