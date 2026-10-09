import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderInRouter } from "./socRouterHarness.js";
import { DataOpsProvider, useDataOps } from "../soc/DataOpsContext.js";

const adapterMocks = vi.hoisted(() => ({
  getSocDataOpsInventory: vi.fn(),
  getSocDataOpsRunLogs: vi.fn(),
  getSocDataOpsCoverage: vi.fn(),
  getSocDataOpsRuntimeConfig: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: adapterMocks,
}));

function Probe() {
  const { state } = useDataOps();
  const decay = (state.config?.config as { decay_days?: number } | null | undefined)?.decay_days;
  return createElement(
    "div",
    null,
    createElement("span", null, `decay: ${decay ?? "none"}`),
    createElement("span", null, `updated: ${state.configUpdatedAt ?? "none"}`),
  );
}

describe("DataOpsContext runtime config (C7.1 — CFG-10)", () => {
  beforeEach(() => {
    adapterMocks.getSocDataOpsInventory.mockReset().mockResolvedValue({ summary: { total_rows: 0 } });
    adapterMocks.getSocDataOpsRunLogs.mockReset().mockResolvedValue({ results: [], next: null });
    adapterMocks.getSocDataOpsCoverage.mockReset().mockResolvedValue({});
    adapterMocks.getSocDataOpsRuntimeConfig.mockReset().mockResolvedValue({
      config: { decay_days: 7, parity_snapshot_retention_days: 30 },
      ownership: { owner_team: "BIDV", can_apply: true, mode: "rw", locked_fields: [] },
      updated_at: "2026-09-18T07:00:00Z",
    });
  });

  afterEach(() => cleanup());

  it("fetches runtime config into state.config + configUpdatedAt", async () => {
    renderInRouter(createElement(DataOpsProvider, null, createElement(Probe, null)));

    await waitFor(() => {
      expect(screen.getByText("decay: 7")).toBeTruthy();
    });
    expect(screen.getByText("updated: 2026-09-18T07:00:00Z")).toBeTruthy();
  });
});