import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const ctx = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  refreshInventory: vi.fn(),
}));

vi.mock("../soc/DataOpsContext.js", () => ({
  useDataOps: () => ({ state: ctx.state, actions: { refreshInventory: ctx.refreshInventory } }),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocDataOpsQueueTiers: vi.fn().mockResolvedValue({ tiers: [] }),
  },
}));

import { SocDataInventorySection } from "../soc/SocDataInventorySection.js";

function baseInventory(latestDate: string) {
  return {
    summary: {
      total_rows: 1000,
      total_symbols: 10,
      earliest_date: "2000-01-01",
      latest_date: latestDate,
      calendar_days: 9000,
    },
    by_year: [],
    by_group: [],
    data_types: [],
  };
}

describe("SocDataInventorySection session-close caption (Slice F1)", () => {
  beforeEach(() => {
    ctx.refreshInventory.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("shows awaiting-session-close caption when latest date is before today and before 17:05 ICT", async () => {
    vi.setSystemTime(new Date("2026-09-18T03:00:00Z")); // 10:00 ICT
    ctx.state = {
      inventory: baseInventory("2026-09-17"),
      coverage: { datasets: [] },
      loading: { inventory: false },
    };

    render(<SocDataInventorySection />);

    expect(screen.getByText("soc.dataops.awaiting_session_close")).toBeTruthy();
  });

  it("shows latest-complete caption when latest date is today (ICT)", async () => {
    vi.setSystemTime(new Date("2026-09-18T03:00:00Z"));
    ctx.state = {
      inventory: baseInventory("2026-09-18"),
      coverage: { datasets: [] },
      loading: { inventory: false },
    };

    render(<SocDataInventorySection />);

    expect(screen.getByText("soc.dataops.latest_complete")).toBeTruthy();
  });

  it("shows a coverage warning banner when daily_prices coverage ratio is below 80%", async () => {
    vi.setSystemTime(new Date("2026-09-18T03:00:00Z"));
    ctx.state = {
      inventory: baseInventory("2026-09-18"),
      coverage: {
        datasets: [{ dataset: "daily_prices", fresh: 1, warm: 1, stale: 0, missing: 10, error: 0 }],
      },
      loading: { inventory: false },
    };

    render(<SocDataInventorySection />);

    expect(screen.getByText(/soc\.dataops\.coverage_warning/)).toBeTruthy();
  });
});
