/**
 * R5.3 (FE) — UI 4 system sub-agent prompt, staff-only, có diff preview.
 *
 * Fail-before: trước R5.3 form KHÔNG có 4 ô này. BE đã chặn 403 nhưng UI chưa tồn tại.
 *
 * Mock theo đúng pattern của `ai-cc-r14-dirty.component.test.tsx` (cùng bộ test
 * render `AICommandCenterForm`): `coreApiAdapter` + `LangProvider` + `MemoryRouter`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

const adapterMocks = vi.hoisted(() => ({
  getAICommandCenterConfig: vi.fn(),
  updateAICommandCenterConfig: vi.fn(),
  getAIAuditLogs: vi.fn(),
  getUserConfig: vi.fn(),
  updateUserConfig: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    get getAICommandCenterConfig() { return adapterMocks.getAICommandCenterConfig; },
    get updateAICommandCenterConfig() { return adapterMocks.updateAICommandCenterConfig; },
    get getAIAuditLogs() { return adapterMocks.getAIAuditLogs; },
    get getUserConfig() { return adapterMocks.getUserConfig; },
    get updateUserConfig() { return adapterMocks.updateUserConfig; },
  },
}));

vi.mock("../../context/PortfolioContext.js", () => ({
  usePortfolio: () => ({ userIdentity: { isStaff: true, isSuperuser: false } }),
}));

vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

import { LangProvider } from "../../context/LangContext.js";
import { AICommandCenterPage } from "../../pages/AICommandCenterPage.js";

const STAFF_SETTINGS = {
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_ready: true,
  advisory_refresh_interval_hours: 24,
  advisory_max_tokens_per_day: 5000,
  temperature: 0.3,
  ai_api_key_configured: false,
  ai_prompt_config: null,
  ai_prompt_config_history: [],
  sub_agent_prompts: {
    technical_agent_prompt: "KT-HIEN-TAI",
    flow_agent_prompt: "DONG-TIEN-HIEN-TAI",
    sentiment_agent_prompt: "TAM-LY-HIEN-TAI",
    synthesis_agent_prompt: "TONG-HOP-HIEN-TAI",
  },
  sub_agent_prompts_version: 3,
  config_updated_at: "2026-10-18T00:00:00Z",
};

/** BE bỏ hẳn key khi user không phải staff (`response_data.pop`). */
const MEMBER_SETTINGS = { ...STAFF_SETTINGS };
delete (MEMBER_SETTINGS as Record<string, unknown>).sub_agent_prompts;
delete (MEMBER_SETTINGS as Record<string, unknown>).sub_agent_prompts_version;

function mockSettings(settings: Record<string, unknown>) {
  adapterMocks.getAICommandCenterConfig.mockResolvedValue({ ...settings });
  adapterMocks.updateAICommandCenterConfig.mockImplementation(
    async (p: Record<string, unknown>) => ({ ...settings, ...p }),
  );
  adapterMocks.getAIAuditLogs.mockResolvedValue({ results: [], total: 0 });
  adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
  adapterMocks.updateUserConfig.mockResolvedValue({ advisory_whale_signal_enabled: true });
}

function renderPage() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings/ai"] },
      createElement(LangProvider, null, createElement(AICommandCenterPage, {})),
    ),
  );
}

const promptBoxes = () =>
  (screen.queryAllByRole("textbox") as HTMLTextAreaElement[]).filter((b) =>
    (b.getAttribute("data-testid") || "").startsWith("sub-agent-"),
  );

describe("R5.3 FE — 4 system sub-agent prompt", () => {
  beforeEach(() => {
    cleanup();
    adapterMocks.getAICommandCenterConfig.mockReset();
    adapterMocks.updateAICommandCenterConfig.mockReset();
  });

  it("AC1 staff thấy 4 ô prompt với giá trị đang lưu", async () => {
    mockSettings(STAFF_SETTINGS);
    renderPage();
    await waitFor(() => expect(promptBoxes().length).toBeGreaterThan(0));
    const values = promptBoxes().map((b) => b.value);
    expect(values, `thấy ${values.length} ô`).toHaveLength(4);
    expect(values.sort()).toEqual([
      "DONG-TIEN-HIEN-TAI", "KT-HIEN-TAI", "TAM-LY-HIEN-TAI", "TONG-HOP-HIEN-TAI",
    ].sort());
  });

  it("AC1 hiện version hiện hành (3)", async () => {
    mockSettings(STAFF_SETTINGS);
    renderPage();
    await waitFor(() => expect(promptBoxes().length).toBe(4));
    const version = screen.getByTestId("sub-agent-prompts").textContent || "";
    expect(version).toMatch(/3/);
  });

  it("AC2 user thường KHÔNG thấy khối prompt (BE bỏ key)", async () => {
    mockSettings(MEMBER_SETTINGS);
    renderPage();
    await waitFor(() => expect(adapterMocks.getAICommandCenterConfig).toHaveBeenCalled());
    expect(screen.queryByTestId("sub-agent-prompts")).toBeNull();
    expect(promptBoxes()).toHaveLength(0);
  });

  it("AC4 sửa 1 prompt => payload gửi đúng 4 khoá, không gửi khoá lạ", async () => {
    mockSettings(STAFF_SETTINGS);
    renderPage();
    await waitFor(() => expect(promptBoxes().length).toBe(4));

    const target = promptBoxes().find((b) => b.value === "KT-HIEN-TAI")!;
    fireEvent.change(target, { target: { value: "KT-MOI" } });
    // R1.9 AC4: bấm Lưu mở **modal preview trước**, phải bấm Xác nhận mới PUT.
    fireEvent.click(screen.getByTestId("save-config"));
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeTruthy());
    fireEvent.click(screen.getByTestId("preview-confirm"));

    await waitFor(() => expect(adapterMocks.updateAICommandCenterConfig).toHaveBeenCalled());
    const body = adapterMocks.updateAICommandCenterConfig.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty("sub_agent_prompts");
    const sap = body.sub_agent_prompts as Record<string, string>;
    expect(Object.keys(sap).sort()).toEqual([
      "flow_agent_prompt",
      "sentiment_agent_prompt",
      "synthesis_agent_prompt",
      "technical_agent_prompt",
    ]);
    expect(sap.technical_agent_prompt).toBe("KT-MOI");
    expect(Object.keys(body)).not.toContain("sub_agent_prompt");
  });

  it("không sửa gì thì KHÔNG mở preview và KHÔNG gọi API (BE tăng version mỗi lần nhận giá trị khác)", async () => {
    mockSettings(STAFF_SETTINGS);
    renderPage();
    await waitFor(() => expect(promptBoxes().length).toBe(4));
    fireEvent.click(screen.getByTestId("save-config"));
    // Không có thay đổi ⇒ không có diff ⇒ không mở modal, không PUT.
    await waitFor(() => {
      expect(screen.queryByTestId("preview-confirm")).toBeNull();
    });
    expect(adapterMocks.updateAICommandCenterConfig).not.toHaveBeenCalled();
  });
});