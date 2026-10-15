import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { SocBrokerPanel } from "../soc/SocBrokerPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocBrokerConfig: vi.fn(),
  applySocBrokerConfig: vi.fn(),
  previewSocBrokerConfig: vi.fn(),
  getSocBrokerAudit: vi.fn(),
  getSocBrokerHealth: vi.fn(),
  getSocBrokerCredentials: vi.fn(),
  saveSocBrokerCredential: vi.fn(),
  deleteSocBrokerCredential: vi.fn(),
  testSocBrokerConnection: vi.fn(),
}));

const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocBrokerConfig: adapterMocks.getSocBrokerConfig,
    applySocBrokerConfig: adapterMocks.applySocBrokerConfig,
    previewSocBrokerConfig: adapterMocks.previewSocBrokerConfig,
    getSocBrokerAudit: adapterMocks.getSocBrokerAudit,
    getSocBrokerHealth: adapterMocks.getSocBrokerHealth,
    getSocBrokerCredentials: adapterMocks.getSocBrokerCredentials,
    saveSocBrokerCredential: adapterMocks.saveSocBrokerCredential,
    deleteSocBrokerCredential: adapterMocks.deleteSocBrokerCredential,
    testSocBrokerConnection: adapterMocks.testSocBrokerConnection,
  },
}));

vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => confirmMock,
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../pages/admin/socCsv.js", () => ({
  downloadSocCsv: vi.fn(() => Promise.resolve()),
}));

import { downloadSocCsv } from "../../pages/admin/socCsv.js";

const baseConfig = {
  entries: {
    dnse: { enabled: true, routing_order: 0, requests_per_minute: 60, purpose_allowlist: ["backfill"] },
    ssi: { enabled: true, routing_order: 1, requests_per_minute: 60, purpose_allowlist: ["snapshot"] },
    tcbs: { enabled: false, routing_order: 2, requests_per_minute: 60, purpose_allowlist: [] },
  },
  kill_switch_write: false,
  quiet_hours_start: "17:00",
  quiet_hours_end: "08:30",
};

function mockLoadedWave4() {
  adapterMocks.getSocBrokerConfig.mockResolvedValue({ config: baseConfig });
  adapterMocks.getSocBrokerHealth.mockResolvedValue({
    kill_switch_write: false,
    providers: [{
      provider: "dnse", enabled: true, credential_present: true, is_verified: false,
      needs_verification: true, stale_reason: "chua_xac_minh",
      queue_depth: 4,
      lane: {
        last_run: { status: "failed", started_at: "2026-10-15T10:00:00Z", finished_at: "2026-10-15T10:01:00Z", duration_s: 60, error: "boom" },
        runs_24h: { succeeded: 3, failed: 1, pending: 0, running: 0, total: 4 },
        error_rate_24h: 0.25,
        avg_latency_s_24h: 45.5,
        unresolved_issues: { info: 0, warning: 1, error: 1, total: 2 },
        top_errors: [{ code: "sync_failed", count: 1 }],
        consecutive_failures: 1,
        retries_configured: 3,
      },
    }],
    queues: { celery: 4 },
    top_errors: [{ code: "sync_failed", count: 1 }],
  });
  adapterMocks.getSocBrokerCredentials.mockResolvedValue({
    credentials: [{
      provider: "dnse", allowed_purposes: ["backfill"], is_verified: false,
      last_verified_at: null, preview: { client_id: "ID****" },
      needs_verification: true, stale_reason: "chua_xac_minh",
    }],
  });
  adapterMocks.getSocBrokerAudit.mockResolvedValue({
    audits: [{ action: "apply", actor: "staff1", change_summary: "rpm change", timestamp: "2026-10-15T01:00:00Z", request_id: "req_1" }],
  });
}

describe("SocBrokerPanel wave4 (B4.3)", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    confirmMock.mockClear();
    (downloadSocCsv as ReturnType<typeof vi.fn>).mockClear();
    mockLoadedWave4();
  });

  afterEach(() => cleanup());

  it("renders lane metrics, queue depth and top errors", async () => {
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("Vận hành lane (24h)", { exact: false })).toBeTruthy();
    });
    expect(screen.getByText(/25\.0%/)).toBeTruthy();
    expect(screen.getAllByText(/sync_failed/).length).toBeGreaterThan(0);
  });

  it("shows expiry badge for stale credential", async () => {
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getAllByText("Cần xác minh", { exact: false }).length).toBeGreaterThan(0);
    });
  });

  it("csv button downloads server csv with download=csv", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["a,b"], { type: "text/csv" })),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("Tải CSV từ máy chủ", { exact: false })).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Tải CSV từ máy chủ", { exact: false }));
    await waitFor(() => {
      expect(downloadSocCsv).toHaveBeenCalledWith(
        "/operator/soc/broker/audit/", { limit: 5000 }, "soc-broker-audit.csv");
    });
    vi.unstubAllGlobals();
  });

  it("kill-switch change asks destructive confirm before apply", async () => {
    adapterMocks.previewSocBrokerConfig.mockResolvedValue({
      before: baseConfig,
      after: { ...baseConfig, kill_switch_write: true },
      change_summary: ["kill_switch_write: False → True"],
      validation_errors: [],
    });
    adapterMocks.applySocBrokerConfig.mockResolvedValue({ ok: true, change_summary: [] });
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("soc.broker.preview_btn")).toBeTruthy();
    });
    const killLabel = screen.getByText("soc.broker.kill_switch");
    const box = within(killLabel.closest("label") as HTMLElement).getByRole("checkbox");
    fireEvent.click(box);
    fireEvent.click(screen.getByText("soc.broker.preview_btn"));
    await waitFor(() => {
      expect(screen.getByText("soc.config_preview.confirm_apply")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("soc.config_preview.confirm_apply"));
    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
    });
    const opts = confirmMock.mock.calls[0][0] as { variant?: string };
    expect(opts.variant).toBe("destructive");
    await waitFor(() => {
      expect(adapterMocks.applySocBrokerConfig).toHaveBeenCalled();
    });
  });
});
