import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SocDataOpsConfigSection } from "../soc/SocDataOpsConfigSection.js";
import { DataOpsContext, type DataOpsContextValue } from "../soc/DataOpsContext.js";

const adapterMocks = vi.hoisted(() => ({
  getSocDataOpsRuntimeConfig: vi.fn(),
  getSocDataOpsRuntimeConfigAudit: vi.fn(),
  getSocDataOpsRuntimeConfigSchema: vi.fn(),
  previewSocDataOpsRuntimeConfig: vi.fn(),
  applySocDataOpsRuntimeConfig: vi.fn(),
  exportSocConfigAudits: vi.fn(),
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
  adapterMocks.getSocDataOpsRuntimeConfigSchema.mockResolvedValue({ fields: [] });
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
    adapterMocks.exportSocConfigAudits.mockReset();
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

const auditEntries = [
  {
    id: 2,
    actor: "alice",
    action: "apply",
    timestamp: "2026-09-18T07:00:00Z",
    change_summary: "tang hot tier",
    before_snapshot: { decay_days: 7 },
    after_snapshot: { decay_days: 9 },
  },
  {
    id: 1,
    actor: "bob",
    action: "apply",
    timestamp: "2026-09-17T07:00:00Z",
    change_summary: "giam warm tier",
    before_snapshot: { decay_days: 9 },
    after_snapshot: { decay_days: 7 },
  },
];

describe("SocDataOpsConfigSection audit (C3 — CFG-04/CFG-05 read)", () => {
  beforeEach(() => {
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockReset();
    adapterMocks.previewSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.applySocDataOpsRuntimeConfig.mockReset();
    adapterMocks.exportSocConfigAudits.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfig.mockResolvedValue({
      config: baseConfig,
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T07:00:00Z",
    });
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockResolvedValue({
      results: auditEntries,
      next: null,
      count: 2,
    });
  });

  afterEach(() => cleanup());

  it("renders actor, local timestamp, summary and expands before/after diff", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(screen.getByText("tang hot tier")).toBeTruthy();
    });
    expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
    expect(screen.getByText("soc.dataops.audit_total: 2")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "soc.dataops.audit_view" })[0]);
    await waitFor(() => {
      expect(screen.getByText("decay_days")).toBeTruthy();
    });
    const cells = Array.from(container.querySelectorAll("td")).map((cell) => cell.textContent || "");
    expect(cells.some((cell) => cell.includes("9"))).toBe(true);
    expect(cells.some((cell) => cell.includes("7"))).toBe(true);
  });

  it("filters audit rows by summary search", async () => {
    render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(screen.getByText("tang hot tier")).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText("soc.dataops.audit_filter_search"), {
      target: { value: "giam" },
    });
    await waitFor(() => {
      expect(screen.queryByText("tang hot tier")).toBeNull();
    });
    expect(screen.getByText("giam warm tier")).toBeTruthy();
  });

  it("exports config audits via adapter with matrix service key", async () => {
    adapterMocks.exportSocConfigAudits.mockResolvedValue([
      { service_key: "matrix_cycle_coordinator", action: "apply", actor: "alice" },
    ]);
    const createObjectUrl = vi.fn(() => "blob:audit");
    const revokeObjectUrl = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    (URL as unknown as { createObjectURL: typeof createObjectUrl }).createObjectURL = createObjectUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectUrl }).revokeObjectURL = revokeObjectUrl;

    render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(screen.getByText("tang hot tier")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "soc.export.export_config_audits" }));

    await waitFor(() => {
      expect(adapterMocks.exportSocConfigAudits).toHaveBeenCalledWith({
        service_key: "matrix_cycle_coordinator",
        limit: 50,
      });
    });

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});

describe("SocDataOpsConfigSection lock & revert (C5 — CFG-05 write / CFG-07)", () => {
  beforeEach(() => {
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockReset();
    adapterMocks.previewSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.applySocDataOpsRuntimeConfig.mockReset();
    adapterMocks.exportSocConfigAudits.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfig.mockResolvedValue({
      config: baseConfig,
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T07:00:00Z",
    });
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockResolvedValue({
      results: auditEntries,
      next: null,
      count: 2,
    });
    adapterMocks.applySocDataOpsRuntimeConfig.mockResolvedValue({
      config: baseConfig,
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T09:00:00Z",
    });
  });

  afterEach(() => cleanup());

  it("reverts an audit row via apply with rollback action + expected_updated_at", async () => {
    render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(screen.getByText("tang hot tier")).toBeTruthy();
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button", { name: "soc.dataops.revert" })[1]);

    await waitFor(() => {
      expect(adapterMocks.applySocDataOpsRuntimeConfig).toHaveBeenCalledTimes(1);
    });
    const [config, opts] = adapterMocks.applySocDataOpsRuntimeConfig.mock.calls[0];
    expect(config).toEqual({ decay_days: 9 });
    expect(opts.audit_action).toBe("rollback");
    expect(opts.expected_updated_at).toBe("2026-09-18T07:00:00Z");
    expect(adapterMocks.getSocDataOpsRuntimeConfigAudit).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("soc.dataops.revert_success")).toBeTruthy();
    });
    vi.restoreAllMocks();
  });

  it("sends expected_updated_at + change_reason then shows conflict banner and reload-compare on 409", async () => {
    adapterMocks.previewSocDataOpsRuntimeConfig.mockResolvedValue({ is_valid: true, validation_errors: [] });
    adapterMocks.applySocDataOpsRuntimeConfig.mockRejectedValue(
      Object.assign(new Error("Core API request error 409 ...: Cấu hình đã được cập nhật bởi người khác"), {
        status: 409,
        code: "CONFIG_CONFLICT",
      }),
    );
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="decay_days"]')).toBeTruthy();
    });
    fireEvent.change(field(container, "decay_days"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("soc.dataops.change_reason"), { target: { value: "test reason" } });
    fireEvent.click(screen.getByRole("button", { name: "soc.actions.preview" }));
    await waitFor(() => {
      expect(screen.getByText("soc.config_preview.confirm_apply")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "soc.config_preview.confirm_apply" }));

    await waitFor(() => {
      expect(adapterMocks.applySocDataOpsRuntimeConfig).toHaveBeenCalledTimes(1);
    });
    const [config, opts] = adapterMocks.applySocDataOpsRuntimeConfig.mock.calls[0];
    expect(config.decay_days).toBe(14);
    expect(opts.expected_updated_at).toBe("2026-09-18T07:00:00Z");
    expect(opts.change_reason).toBe("test reason");
    expect(screen.getByText("soc.dataops.reload_compare")).toBeTruthy();

    adapterMocks.getSocDataOpsRuntimeConfig.mockResolvedValue({
      config: { ...baseConfig, decay_days: 14 },
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T08:00:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "soc.dataops.reload_compare" }));
    await waitFor(() => {
      expect(screen.getByText("soc.config_preview.changes")).toBeTruthy();
    });
  });
});

describe("SocDataOpsConfigSection write guard per-field + schema (C6 — CFG-08/CFG-09)", () => {
  beforeEach(() => {
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigSchema.mockReset();
    adapterMocks.previewSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.applySocDataOpsRuntimeConfig.mockReset();
    adapterMocks.exportSocConfigAudits.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfig.mockResolvedValue({
      config: baseConfig,
      ownership: {
        owner_team: "BIDV",
        can_apply: true,
        mode: "rw",
        locked_fields: ["decay_days", "hot_user_demand.poll_interval_seconds"],
      },
      updated_at: "2026-09-18T07:00:00Z",
    });
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockResolvedValue({ results: [], next: null });
    adapterMocks.getSocDataOpsRuntimeConfigSchema.mockResolvedValue({
      fields: [
        { key: "decay_days", type: "int", min: 1, max: 365, default: 7, help: "decay help" },
        { key: "hot_user_demand.poll_interval_seconds", type: "int", min: 10, max: 3600, default: 30, help: "poll help" },
      ],
    });
  });

  afterEach(() => cleanup());

  it("disables + locks locked fields, shows per-field badge chips, others stay editable", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-locked="decay_days"]')).toBeTruthy();
    });
    expect(field(container, "decay_days").disabled).toBe(true);
    expect(container.querySelector('label[for="decay_days"] [role="img"]')).toBeTruthy();
    expect(field(container, "hot_user_demand.poll_interval_seconds").disabled).toBe(true);
    expect(field(container, "parity_snapshot_retention_days").disabled).toBe(false);
    expect(container.querySelector('[data-locked="hot_user_demand.poll_interval_seconds"]')).toBeTruthy();
  });

  it("renders bounds from schema when present (C6.4 fallback hard-coded otherwise)", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="decay_days"]')).toBeTruthy();
    });
    const decayInput = field(container, "decay_days");
    expect(decayInput.max).toBe("365");
    const hotPoll = field(container, "hot_user_demand.poll_interval_seconds");
    expect(hotPoll.min).toBe("10");
  });
});

describe("SocDataOpsConfigSection presets + freshness (C7 — CFG-10)", () => {
  function ConfigHarness({ envelope }: { envelope: unknown }) {
    const ctxValue = {
      state: {
        activeSubTab: "inventory",
        runs: [],
        inventory: null,
        coverage: null,
        config: envelope,
        configUpdatedAt: (envelope as { updated_at?: string | null } | null)?.updated_at ?? null,
        loading: {},
        error: null,
        errors: {},
      },
      actions: {
        setActiveSubTab: () => {},
        refreshInventory: async () => {},
        refreshRuns: async () => {},
        refreshCoverage: async () => {},
        refreshConfig: async () => {},
        triggerBackfill: async () => "",
        abortRun: async () => {},
      },
    } as DataOpsContextValue;
    return createElement(
      DataOpsContext.Provider,
      { value: ctxValue },
      createElement(SocDataOpsConfigSection, null),
    );
  }

  beforeEach(() => {
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigAudit.mockReset();
    adapterMocks.getSocDataOpsRuntimeConfigSchema.mockReset();
    adapterMocks.previewSocDataOpsRuntimeConfig.mockReset();
    adapterMocks.applySocDataOpsRuntimeConfig.mockReset();
    adapterMocks.exportSocConfigAudits.mockReset();
    setup();
  });

  afterEach(() => cleanup());

  it("fills all tier fields via preset buttons (C7.3)", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="hot_user_demand.poll_interval_seconds"]')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "soc.dataops.preset_performance" }));
    expect(field(container, "hot_user_demand.poll_interval_seconds").value).toBe("15");
    expect(field(container, "warm_liquid_market.poll_interval_seconds").value).toBe("15");
    expect(field(container, "cold_full_market.max_batch_size").value).toBe("100");
    expect(field(container, "recovery_backlog.max_dispatch_per_cycle").value).toBe("100");
  });

  it("shows new-update banner without overwriting a dirty form (C7.2)", async () => {
    const envelopeA = {
      config: baseConfig,
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T07:00:00Z",
    };
    const { container, rerender } = render(createElement(ConfigHarness, { envelope: envelopeA }));
    await waitFor(() => {
      expect(container.querySelector('[data-field="decay_days"]')).toBeTruthy();
    });
    fireEvent.change(field(container, "decay_days"), { target: { value: "14" } });

    const envelopeB = {
      config: { ...baseConfig, decay_days: 21 },
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T08:00:00Z",
    };
    rerender(createElement(ConfigHarness, { envelope: envelopeB }));

    await waitFor(() => {
      expect(screen.getByText("soc.dataops.new_update_note")).toBeTruthy();
    });
    expect(field(container, "decay_days").value).toBe("14");
  });

  it("renders last-updated in local time (C7.4)", async () => {
    const { container } = render(<SocDataOpsConfigSection />);
    await waitFor(() => {
      expect(container.querySelector('[data-field="decay_days"]')).toBeTruthy();
    });
    expect(screen.getByText(/soc\.dataops\.last_updated/)).toBeTruthy();
  });
});
