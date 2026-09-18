import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocDataOpsConfigSection } from "../soc/SocDataOpsConfigSection.js";

const adapterMocks = vi.hoisted(() => ({
  getSocDataOpsRuntimeConfig: vi.fn(),
  getSocDataOpsRuntimeConfigAudit: vi.fn(),
  previewSocDataOpsRuntimeConfig: vi.fn(),
  applySocDataOpsRuntimeConfig: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: adapterMocks,
}));

const baseConfig = {
  decay_days: 7,
  parity_snapshot_retention_days: 30,
  hot_user_demand: { poll_interval_seconds: 30, max_batch_size: 50, max_dispatch_per_cycle: 50 },
  warm_liquid_market: { poll_interval_seconds: 120, max_batch_size: 50, max_dispatch_per_cycle: 50 },
  cold_full_market: { poll_interval_seconds: 900, max_batch_size: 200, max_dispatch_per_cycle: 200 },
  recovery_backlog: { poll_interval_seconds: 600, max_batch_size: 50, max_dispatch_per_cycle: 50 },
};

function setup() {
  adapterMocks.getSocDataOpsRuntimeConfig.mockResolvedValue({
    config: baseConfig,
    ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
    updated_at: "2026-09-18T07:00:00Z",
  });
  adapterMocks.getSocDataOpsRuntimeConfigAudit.mockResolvedValue({ results: [], next: null });
}

const field = (container: HTMLElement, id: string) => {
  const el = container.querySelector(`[data-field="${id}"]`);
  if (!el) throw new Error(`missing field ${id}`);
  return el as HTMLInputElement;
};

describe("SocDataOpsConfigSection form (C1 — CFG-01)", () => {
  beforeEach(() => {
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockReset();
    adapterMocks.previewSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.applySocDataOpsRuntimeConfig.mockReset();
    setup();
  });

  afterEach(() => cleanup());

  it("renders 14 number inputs with defaults 7 / 30 / 30", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelectorAll('input[type="number"]').length).toBe(14);
    });
    expect(field(container, "decay_days").value).toBe("7");
    expect(field(container, "parity_snapshot_retention_days").value).toBe("30");
    expect(field(container, "hot_user_demand.poll_interval_seconds").value).toBe("30");
  });

  it("shows an inline error when poll interval < 10 and clears it after fixing", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="hot_user_demand.poll_interval_seconds"]')).toBeTruthy();
    });
    const hotPoll = field(container, "hot_user_demand.poll_interval_seconds");
    fireEvent.change(hotPoll, { target: { value: "5" } });
    await waitFor(() => {
      expect(screen.getAllByText("soc.dataops.field_range_error").length).toBeGreaterThan(0);
    });
    expect(hotPoll.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(hotPoll, { target: { value: "30" } });
    await waitFor(() => {
      expect(screen.queryByText("soc.dataops.field_range_error")).toBeNull();
    });
  });

  it("resets the form back to the saved config", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="decay_days"]')).toBeTruthy();
    });
    const decay = field(container, "decay_days");
    fireEvent.change(decay, { target: { value: "14" } });
    expect(decay.value).toBe("14");
    fireEvent.click(screen.getByRole("button", { name: "soc.actions.reset" }));
    await waitFor(() => {
      expect(field(container, "decay_days").value).toBe("7");
    });
  });

  it("opens the preview modal with a diff table and validation errors for an invalid field (C2)", async () => {
    adapterMocks.previewSocDataOpsRuntimeConfig.mockResolvedValue({
      is_valid: false,
      validation_errors: ["hot_user_demand.poll_interval_seconds phải >= 10"],
    });
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="hot_user_demand.poll_interval_seconds"]')).toBeTruthy();
    });
    fireEvent.change(field(container, "hot_user_demand.poll_interval_seconds"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "soc.actions.preview" }));

    await waitFor(() => {
      expect(
        screen.getByText((content) => typeof content === "string" && content.includes("phải >= 10")),
      ).toBeTruthy();
    });
    expect(adapterMocks.previewSocDataOpsRuntimeConfig).toHaveBeenCalledTimes(1);
    const cellTexts = Array.from(container.querySelectorAll("table td")).map((c) => c.textContent || "");
    expect(cellTexts.some((x) => x.includes("hot_user_demand.poll_interval_seconds"))).toBe(true);
    expect(screen.getByText("soc.config_preview.impact_invalid")).toBeTruthy();
  });

  it("shows only the changed tier field with runtime-risk impact when cadence changes (C2)", async () => {
    adapterMocks.previewSocDataOpsRuntimeConfig.mockResolvedValue({ is_valid: true, validation_errors: [] });
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="warm_liquid_market.poll_interval_seconds"]')).toBeTruthy();
    });
    fireEvent.change(field(container, "warm_liquid_market.poll_interval_seconds"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "soc.actions.preview" }));

    await waitFor(() => {
      expect(screen.getByText("soc.config_preview.changes")).toBeTruthy();
    });
    const cellTexts = Array.from(container.querySelectorAll("table td")).map((c) => c.textContent || "");
    expect(cellTexts.some((x) => x.includes("warm_liquid_market.poll_interval_seconds"))).toBe(true);
    expect(screen.getByText("soc.config_preview.impact_runtime_risk")).toBeTruthy();
    expect(screen.queryByText("soc.config_preview.impact_invalid")).toBeNull();
  });
});
