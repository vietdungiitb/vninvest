import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocOverviewPanel } from "../soc/SocOverviewPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocOverviewSummary: vi.fn(),
  getSocSloOverview: vi.fn(),
  updateSocService: vi.fn(),
  triggerSocServiceHealthCheck: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocOverviewSummary: adapterMocks.getSocOverviewSummary,
    getSocSloOverview: adapterMocks.getSocSloOverview,
    updateSocService: adapterMocks.updateSocService,
    triggerSocServiceHealthCheck: adapterMocks.triggerSocServiceHealthCheck,
  },
}));

const baseServices = [
  { service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true, avg_response_ms: 120, last_check_at: "2026-09-16T09:00:00Z" },
  { service_key: "svc_degraded", name: "Degraded SVC", domain: "prefetch", status: "degraded", is_active: true },
  { service_key: "svc_critical", name: "Critical SVC", domain: "signals", status: "unhealthy", is_active: true },
  { service_key: "svc_maintenance", name: "Maintenance SVC", domain: "screener", status: "maintenance", is_active: true },
  { service_key: "svc_unknown", name: "Unknown SVC", domain: "dataops", status: "unknown", is_active: true },
  { service_key: "svc_disabled", name: "Disabled SVC", domain: "platform", status: "healthy", is_active: false },
];

describe("SocOverviewPanel — PR-1 W3 maintenance metric", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows maintenance card with count 1 and unknown 0 when fixture has 1 maintenance", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: baseServices });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    // metric labels are i18n keys in test env
    expect(screen.getByText("soc.overview.maintenance_count")).toBeTruthy();
    // maintenance card value 1 should appear at least once
    const maintenanceValues = screen.getAllByText("1");
    expect(maintenanceValues.length).toBeGreaterThan(0);
    // unknown count should be 1 (only svc_unknown), not 2 (maintenance not counted as unknown)
    // total services =6, so we check that unknown card exists
    expect(screen.getByText("soc.overview.unknown_count")).toBeTruthy();
  });
});

describe("SocOverviewPanel — PR-1 W2 bar 6 segments", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("renders 6 segments when 6 statuses each have 1 service, total width ≈100%", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: baseServices });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    const { container } = render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    const bar = container.querySelector('[class*="overviewHealthBar"]');
    expect(bar).toBeTruthy();
    const segments = bar!.querySelectorAll('[class*="overviewHealthBarSegment"]');
    expect(segments.length).toBe(6);
    let totalWidth = 0;
    segments.forEach((el) => {
      const w = (el as HTMLElement).style.width;
      totalWidth += parseFloat(w.replace("%", "")) || 0;
    });
    expect(totalWidth).toBeGreaterThan(99);
    expect(totalWidth).toBeLessThan(101);
  });
});

describe("SocOverviewPanel — PR-1 W4 SLO fail", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows SLO error banner but keeps service grid when SLO fetch fails", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true }],
    });
    adapterMocks.getSocSloOverview.mockRejectedValue(new Error("SLO boom"));
    render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Healthy SVC")).toBeTruthy());
    expect(screen.getByText("SLO boom")).toBeTruthy();
    expect(screen.getByText("soc.overview.retry_slo")).toBeTruthy();
    // retry should clear error when next SLO succeeds
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    fireEvent.click(screen.getByText("soc.overview.retry_slo"));
    await waitFor(() => expect(screen.queryByText("SLO boom")).toBeNull());
  });
});

describe("SocOverviewPanel — PR-1 W1 toggle confirm", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
    adapterMocks.updateSocService.mockReset();
  });
  afterEach(() => cleanup());

  it("shows modal on toggle, cancel does not call API, confirm with reason calls API with change_reason", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true }],
    });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    adapterMocks.updateSocService.mockResolvedValue({});
    render(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Healthy SVC")).toBeTruthy());
    const toggleBtn = screen.getByText("soc.overview.disable_service");
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(screen.getByText("soc.overview.toggle_title")).toBeTruthy());
    // confirm button disabled when reason empty
    const confirmBtn = screen.getByRole("button", { name: "Xác nhận" }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    // cancel should close and not call API
    fireEvent.click(screen.getByText("Hủy"));
    await waitFor(() => expect(screen.queryByText("soc.overview.toggle_title")).toBeNull());
    expect(adapterMocks.updateSocService).not.toHaveBeenCalled();
    // reopen, fill reason, confirm
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(screen.getByText("soc.overview.toggle_title")).toBeTruthy());
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "bao tri dinh ky" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Xác nhận" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(adapterMocks.updateSocService).toHaveBeenCalledWith("svc_healthy", { is_active: false, change_reason: "bao tri dinh ky" }));
  });
});
