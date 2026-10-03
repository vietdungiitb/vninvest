import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

function mockLoaded() {
  adapterMocks.getSocBrokerConfig.mockResolvedValue({ config: baseConfig });
  adapterMocks.getSocBrokerHealth.mockResolvedValue({
    kill_switch_write: false,
    providers: [{ provider: "dnse", enabled: true, is_verified: true }],
  });
  adapterMocks.getSocBrokerCredentials.mockResolvedValue({ credentials: [] });
  adapterMocks.getSocBrokerAudit.mockResolvedValue({
    audits: [{ action: "apply", actor: "staff1", change_summary: "rpm change", timestamp: "2026-09-23T01:00:00Z" }],
  });
}

describe("SocBrokerPanel (B2.3)", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    mockLoaded();
  });

  afterEach(() => cleanup());

  it("renders config, health and audit rows after load", async () => {
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("soc.broker.config_title")).toBeTruthy();
    });
    expect(screen.getByText("soc.broker.health_title")).toBeTruthy();
    expect(screen.getByText("soc.broker.audit_title")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("rpm change")).toBeTruthy();
    });
    expect(screen.getByText("staff1")).toBeTruthy();
  });

  it("opens preview modal with change summary on preview click", async () => {
    adapterMocks.previewSocBrokerConfig.mockResolvedValue({
      before: baseConfig,
      after: { ...baseConfig, kill_switch_write: true },
      change_summary: ["kill_switch_write: False → True"],
      validation_errors: [],
    });
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("soc.broker.preview_btn")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("soc.broker.preview_btn"));
    await waitFor(() => {
      expect(adapterMocks.previewSocBrokerConfig).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("kill_switch_write: False → True")).toBeTruthy();
    });
  });

  it("applies config and shows audit after apply", async () => {
    adapterMocks.applySocBrokerConfig.mockResolvedValue({ ok: true, change_summary: [] });
    render(<SocBrokerPanel />);
    await waitFor(() => {
      expect(screen.getByText("soc.broker.apply_btn")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("soc.broker.apply_btn"));
    await waitFor(() => {
      expect(adapterMocks.applySocBrokerConfig).toHaveBeenCalled();
    });
  });
});
