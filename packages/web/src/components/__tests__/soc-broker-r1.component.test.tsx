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

  it("AC2/AC3: secrets textarea starts empty with client_id schema placeholder", async () => {
    renderPanel();
    await waitFor(() => {
      expect(document.querySelector("textarea")).toBeTruthy();
    });
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
    expect(textarea.placeholder).toContain("client_id");
    expect(textarea.placeholder).toContain("client_secret");
  });

  it("AC2: empty secrets does not call POST and shows translated error", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Danh sách nhà môi giới")).toBeTruthy();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Lưu credential" }));
    await waitFor(() => {
      expect(screen.getByText(/secrets/i)).toBeTruthy();
    });
    expect(adapterMocks.saveSocBrokerCredential).not.toHaveBeenCalled();
  });

  it("AC3: wrong schema does not call POST; valid schema calls POST with provider/secrets/purposes", async () => {
    renderPanel();
    await waitFor(() => {
      expect(document.querySelector("textarea")).toBeTruthy();
    });
    const textarea = await screen.findByRole("textbox", { name: "JSON credential" }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"api_key":"x","api_secret":"y"}' } });
    fireEvent.click(await screen.findByRole("button", { name: "Lưu credential" }));
    await waitFor(() => expect(screen.getByText(/client_id/)).toBeTruthy());
    expect(adapterMocks.saveSocBrokerCredential).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: '{"client_id":"id","client_secret":"secret"}' } });
    fireEvent.click(await screen.findByRole("button", { name: "Lưu credential" }));
    await waitFor(() => expect(adapterMocks.saveSocBrokerCredential).toHaveBeenCalled());
    expect(adapterMocks.saveSocBrokerCredential).toHaveBeenCalledWith(
      "dnse",
      { client_id: "id", client_secret: "secret" },
      ["backfill"],
    );
  });
});
