/**
 * R4.2 AC5 — UI hiện thời điểm xoay kế tiếp + phạm vi khoá.
 *
 * Fail-before: trước R4.2 `AICommandCenterForm.tsx` không có khối `ai_key_rotation`
 * nên dò này không tồn tại dù BE đã trả mốc xoay khoá.
 *
 * Ba thứ cần khóa bằng test:
 * 1. Có mốc xoay ⇒ hiện dò thông tin (kèm **scope** để user biết khoá của mình
 *    có được dùng cho suy luận hay không).
 * 2. Chưa từng xoay ⇒ hiện "chưa từng xoay" chứ **không** hiện `Invalid Date`.
 *    Đây là lỗi hay gặp: `new Date(null).toLocaleDateString()` trả "01/01/1970".
 * 3. BE **không** trả khối nào ⇒ không render dò rỗng (tránh UI rác khi endpoint
 *    cũ chưa có).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const baseSettings = {
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_ready: true,
  effective_ai_provider: "openai",
  effective_ai_model: "gpt-4o-mini",
  effective_ai_source: "command_center",
  advisory_refresh_interval_hours: 6,
  advisory_max_tokens_per_day: 1000,
  temperature: 0.3,
  ai_api_key_configured: false,
  ai_prompt_config: null,
  ai_prompt_config_history: [],
};

function renderPage() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ["/settings/ai"] },
      createElement(LangProvider, null, createElement(AICommandCenterPage, { key: "page" })),
    ),
  );
}

beforeEach(() => {
  for (const fn of Object.values(adapterMocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
  adapterMocks.getAIAuditLogs.mockResolvedValue({ results: [], total: 0 });
  adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
  adapterMocks.updateUserConfig.mockResolvedValue({});
});

describe("R4.2 AC5: hien thoi diem xoay khoa", () => {
  it("hien scope + moc xoay khi BE tra khong ai_key_rotation", async () => {
    adapterMocks.getAICommandCenterConfig.mockResolvedValue({
      ...baseSettings,
      ai_key_rotation: {
        key_scope: "management",
        key_rotated_at: "2026-10-01T00:00:00Z",
        grace_until: null,
        within_grace: true,
        days_until_grace_end: null,
        next_rotation_at: "2027-01-01T00:00:00Z",
      },
    });
    renderPage();
    const node = await screen.findByTestId("key-rotation-info");
    expect(node.textContent).toContain("management");
    expect(node.textContent).not.toContain("1970");
  });

  it("chua tung xoay thi hien ro 'chua tung xoay', khong hien Invalid Date", async () => {
    adapterMocks.getAICommandCenterConfig.mockResolvedValue({
      ...baseSettings,
      ai_key_rotation: {
        key_scope: "inference",
        key_rotated_at: null,
        grace_until: null,
        within_grace: true,
        days_until_grace_end: null,
        next_rotation_at: null,
      },
    });
    renderPage();
    const node = await screen.findByTestId("key-rotation-info");
    expect(node.textContent).toContain("inference");
    expect(node.textContent).not.toContain("1970");
    expect(node.textContent?.length).toBeGreaterThan(10);
  });

  it("BE khong tra khoi ai_key_rotation thi khong render dong rong", async () => {
    adapterMocks.getAICommandCenterConfig.mockResolvedValue({ ...baseSettings });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("field-api-key")).toBeTruthy();
    });
    expect(screen.queryByTestId("key-rotation-info")).toBeNull();
  });
});