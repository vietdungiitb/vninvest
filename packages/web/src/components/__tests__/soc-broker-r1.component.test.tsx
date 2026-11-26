import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SocBrokerPanel } from "../soc/SocBrokerPanel.js";
import { createTranslator } from "../../i18n/index.js";

// t PHẢI ổn định identity: nếu trả hàm mới mỗi render, useCallback([t]) trong reload() đổi identity
// ⇒ useEffect chạy lại ⇒ setError("") xoá lỗi ngay sau khi bấm (bài học L-F10).
const tVi = createTranslator("vi");
vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({ t: tVi, locale: "vi" }),
  LangProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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
  adapterMocks.getSocBrokerAudit.mockResolvedValue({ audits: [] });
  adapterMocks.saveSocBrokerCredential.mockResolvedValue({ ok: true });
}

function renderPanel() {
  return render(<SocBrokerPanel />);
}

describe("SocBrokerPanel R1 — i18n + credential contract", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    mockLoaded();
  });
  afterEach(() => cleanup());

  it("AC1: translated headers, no raw i18n key", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Danh sách nhà môi giới")).toBeTruthy();
    });
    expect(screen.queryByText("soc.broker.table_caption")).toBeNull();
    expect(screen.queryByText("soc.broker.col_provider")).toBeNull();
  });

  it("AC2/R2: no JSON textarea — 3 tabs with labeled fields per broker", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByRole("tab", { name: "DNSE" })).toBeTruthy());
    expect(document.querySelector("textarea")).toBeNull();
    expect((screen.getByLabelText("Client ID") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Client Secret") as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByRole("tab", { name: "SSI" }));
    expect(screen.getByLabelText("Client ID")).toBeTruthy();
    expect(screen.getByLabelText("API Key")).toBeTruthy();
    expect(screen.getByLabelText("API Secret")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "TCBS" }));
    expect(screen.queryByLabelText("Client ID")).toBeNull();
    expect(screen.getByLabelText("API Key")).toBeTruthy();
  });

  it("AC2: empty fields do not call POST and show translated error", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByRole("tab", { name: "DNSE" })).toBeTruthy());
    fireEvent.click(await screen.findByRole("button", { name: "Lưu credential" }));
    await waitFor(() => {
      expect(screen.getByText(/Nhập đủ/)).toBeTruthy();
    });
    expect(adapterMocks.saveSocBrokerCredential).not.toHaveBeenCalled();
  });

  it("AC3: filling DNSE fields calls POST with per-provider secrets shape", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("Client ID")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Client ID"), { target: { value: "id" } });
    fireEvent.change(screen.getByLabelText("Client Secret"), { target: { value: "secret" } });
    fireEvent.click(await screen.findByRole("button", { name: "Lưu credential" }));
    await waitFor(() => expect(adapterMocks.saveSocBrokerCredential).toHaveBeenCalled());
    expect(adapterMocks.saveSocBrokerCredential).toHaveBeenCalledWith(
      "dnse",
      { client_id: "id", client_secret: "secret" },
      ["backfill"],
    );
  });
});
