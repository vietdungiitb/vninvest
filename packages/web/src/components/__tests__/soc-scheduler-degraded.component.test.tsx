import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const adapterMocks = vi.hoisted(() => ({
  getSocSchedulerPlan: vi.fn(),
  getSocSchedulerHealth: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocSchedulerPlan: adapterMocks.getSocSchedulerPlan,
    getSocSchedulerHealth: adapterMocks.getSocSchedulerHealth,
  },
}));

import { SocSchedulerBoard } from "../soc/SocSchedulerBoard.js";

describe("SocSchedulerBoard overdue filter (Slice F2)", () => {
  beforeEach(() => {
    adapterMocks.getSocSchedulerPlan.mockReset();
    adapterMocks.getSocSchedulerHealth.mockReset();
    adapterMocks.getSocSchedulerHealth.mockResolvedValue({
      overall_health: "degraded",
      jobs_total: 2,
      enabled_count: 2,
      degraded_count: 1,
      by_status: {},
      by_freshness: {},
    });
  });

  afterEach(() => cleanup());

  it("hides jobs overdue beyond 24h when the filter toggle is enabled", async () => {
    const now = Date.now();
    adapterMocks.getSocSchedulerPlan.mockResolvedValue({
      generated_at: new Date(now).toISOString(),
      jobs: [
        {
          job_key: "ingest-price-board-60s",
          domain: "market_data",
          status: "healthy",
          lag_seconds: 120,
          next_run_at: new Date(now + 60000).toISOString(),
          trigger_type: "interval",
        },
        {
          job_key: "legacy-chronically-late",
          domain: "market_data",
          status: "degraded",
          lag_seconds: 3 * 24 * 3600,
          next_run_at: new Date(now - 3600000).toISOString(),
          trigger_type: "interval",
        },
      ],
    });

    render(<SocSchedulerBoard />);

    await waitFor(() => {
      expect(screen.getByText("legacy-chronically-late")).toBeTruthy();
    });

    const toggle = screen.getByText("soc.scheduler.filter_overdue_24h");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.queryByText("legacy-chronically-late")).toBeNull();
    });
    expect(screen.getByText("ingest-price-board-60s")).toBeTruthy();
  });
});
