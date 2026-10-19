import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AICommandCenterPage } from "./AICommandCenterPage";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";
import * as PortfolioContext from "../context/PortfolioContext.js";

const renderPage = () =>
  render(createElement(MemoryRouter, null, createElement(AICommandCenterPage, {})));

vi.mock("../components/AIAuditLogsPanel.js", () => ({
  AIAuditLogsPanel: () => null,
}));
vi.mock("../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

const baseSettings = {
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_ready: true,
  effective_ai_provider: "openai",
  effective_ai_model: "gpt-4o-mini",
  effective_ai_source: "command_center",
  advisory_whale_signal_enabled: false,
  preferences: { advisory_whale_signal_enabled: false },
  advisory_refresh_interval_hours: 6,
  advisory_max_tokens_per_day: 1000,
  temperature: 0.3,
  ai_api_key_configured: true,
  ai_api_key_masked: "••••••••test",
  system_prompt_template: "System for {symbol}",
};

const TRANSLATIONS = {
  "aiCommandCenter.eyebrow": "Cài đặt",
  "aiCommandCenter.overview": "Tổng quan",
  "aiCommandCenter.title": "Trung tâm điều hành AI",
  "aiCommandCenter.description":
    "Cấu hình nhà cung cấp AI, lựa chọn mô hình và API key phục vụ AI Advisor.",
  "aiCommandCenter.effectiveProvider": "Nhà cung cấp hiệu lực",
  "aiCommandCenter.effectiveProviderDesc": "Nguồn đọc từ AI Command Center.",
  "aiCommandCenter.effectiveModel": "Mô hình hiệu lực",
  "aiCommandCenter.effectiveModelDesc": "Mô hình đang dùng cho advisory runtime.",
  "aiCommandCenter.effectiveSource": "Nguồn hiệu lực",
  "aiCommandCenter.effectiveSourceDesc": "command_center hoặc system fallback.",
  "aiCommandCenter.runtimeStatus": "Trạng thái runtime",
  "aiCommandCenter.ready": "Sẵn sàng",
  "aiCommandCenter.readyDesc": "Runtime có thể sinh advisory.",
  "aiCommandCenter.needsConfig": "Cần cấu hình",
  "aiCommandCenter.needsConfigDesc": "Thiếu key, model hoặc source hợp lệ.",
  "aiCommandCenter.operationPolicy": "Chính sách vận hành",
  "aiCommandCenter.eventGate": "Gate sự kiện",
  "aiCommandCenter.gateEnabled": "Bật",
  "aiCommandCenter.gateDisabled": "Tắt",
  "aiCommandCenter.gateUnknown": "Chưa đọc",
  "aiCommandCenter.refreshInterval": "Khoảng làm mới",
  "aiCommandCenter.autoRefreshPerDay": "Auto refresh/ngày",
  "aiCommandCenter.tokensPerDay": "Token/ngày",
  "aiCommandCenter.fallbackTitle": "Sao lưu hệ thống AI (Fallback)",
  "aiCommandCenter.fallbackReset": "Đặt lại",
  "aiCommandCenter.quotaUsed": "lượt",
  "aiCommandCenter.auditLogsTitle": "Nhật ký audit Command Center",
  "aiCommandCenter.auditLogsDesc": "Mỗi trang hiển thị 10 bản ghi.",
  "aiCommandCenter.loadingConfig": "Đang tải cấu hình AI...",
  "aiCommandCenter.errorLoadConfig": "Lỗi khi tải cấu hình AI.",
  "aiCommandCenter.retryButton": "Thử lại",
  "aiCommandCenter.quotaLine": "Còn {remaining}/{max} lượt · đã dùng {used}",
  "aiCommandCenter.quotaResetIn": "reset sau {h}h {m}m",
  "aiCommandCenter.quotaSourcePersonal": "khóa cá nhân",
  "aiCommandCenter.quotaSourceSystem": "hệ thống",
  "aiCommandCenter.unknownError": "Lỗi không xác định.",
  "aiCommandCenter.errorBoundaryTitle": "Lỗi Trung tâm điều hành AI",
  "aiCommandCenter.runtimeConfig": "CẤU HÌNH AI RUNTIME",
  "aiCommandCenter.providerLabel": "Nhà cung cấp AI",
  "aiCommandCenter.modelLabel": "Mô hình AI",
  "aiCommandCenter.apiKeyLabel": "API Key",
  "aiCommandCenter.apiKeyPlaceholderNew": "Nhập API Key của nhà cung cấp...",
  "aiCommandCenter.apiKeyPlaceholderConfigured": "Đã có API Key, nhập key mới để thay đổi...",
  "aiCommandCenter.maxTokensLabel": "Định mức Token / ngày",
  "aiCommandCenter.refreshIntervalLabel": "Khoảng làm mới tự động (giờ)",
  "aiCommandCenter.refreshIntervalValue": "{hours} giờ/lần",
  "aiCommandCenter.temperatureLabel": "Temperature (0.0 - 1.0)",
  "aiCommandCenter.temperatureHelp": "0 = deterministic, 1 = creative. Mặc định 0.3.",
  "aiCommandCenter.saveBtn": "Lưu cấu hình",
  "aiCommandCenter.savingBtn": "Đang lưu cấu hình...",
  "aiCommandCenter.testBtn": "Kiểm tra kết nối",
  "aiCommandCenter.testingBtn": "Đang kết nối...",
  "aiCommandCenter.refreshFormBtn": "Làm mới form",
  "aiCommandCenter.promptConfig": "Tinh chỉnh nguồn dữ liệu",
  "aiCommandCenter.noticeSaved": "Lưu cấu hình AI thành công.",
  "aiCommandCenter.errorSaveConfig": "Lỗi khi lưu cấu hình.",
  "aiCommandCenter.errorEmptyModel": "Mô hình AI không được để trống.",
  "aiCommandCenter.errorTokensPositive": "Định mức token/ngày phải lớn hơn 0.",
  "aiCommandCenter.errorRefreshPositive": "Khoảng làm mới (giờ) phải lớn hơn 0.",
  "aiCommandCenter.apiKeyMaskedLabel": "API Key hiện tại",
  "aiCommandCenter.clearApiKey": "Xóa key",
  "aiCommandCenter.apiKeyCleared": "Đã xóa API Key.",
  "aiCommandCenter.apiKeyClearFailed": "Không thể xóa API Key.",
  "aiCommandCenter.systemPromptTitle": "System prompt template",
  "aiCommandCenter.systemPromptDesc": "Template system prompt cấp hệ thống (chỉ đọc).",
  "aiCommandCenter.systemPromptEmpty": "Chưa có system prompt template.",
  "aiCommandCenter.systemManagedByPlatform": "System prompt do nền tảng quản lý.",
};

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key, vars) => {
    let s = TRANSLATIONS[key] ?? key;
    if (vars && typeof vars === "object") {
      for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  },
  formatNumber: (n) => n,
  formatCurrency: (n) => n,
  formatPriceVND: (n) => n,
  formatQuotePrice: (p) => p,
  formatQuoteVolume: (v) => v,
  formatQuoteInteger: (v) => v,
  formatDate: (d) => d,
  formatTime: (t) => t,
  formatDateTime: (dt) => dt,
};

// R0.9 AC8: mac dinh non-staff (user thuong thay thong bao managed).
const mockStaff = (staff) => {
  vi.spyOn(PortfolioContext, "usePortfolio").mockReturnValue({
    userIdentity: { isStaff: staff, isSuperuser: false },
  });
};

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "updateAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "updateUserConfig").mockResolvedValue({ advisory_whale_signal_enabled: true });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
  mockStaff(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AICommandCenterPage", () => {
  it("loads and renders AI Command Center settings (Slice 2 restore)", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Nhà cung cấp hiệu lực")).toBeTruthy();
    });
    expect(coreApiAdapter.getUserConfig).toHaveBeenCalledTimes(1);
  });

  it("renders translated eyebrow and overview without raw i18n keys (Slice A)", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Cài đặt")).toBeTruthy();
    });
    expect(screen.getByText("Tổng quan")).toBeTruthy();
    expect(screen.queryByText("aiCommandCenter.eyebrow")).toBeNull();
    expect(screen.queryByText("aiCommandCenter.overview")).toBeNull();
  });

  it("does not crash when fallback_quota_remaining is missing (Slice A R-02)", async () => {
    const settingsWithQuotaMax = {
      ...baseSettings,
      fallback_quota_max: 5,
      fallback_quota_remaining: undefined,
      fallback_quota_reset: undefined,
      ai_provider: "openai",
    };
    coreApiAdapter.getAICommandCenterConfig.mockResolvedValue(settingsWithQuotaMax);
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Nhà cung cấp hiệu lực")).toBeTruthy();
    });
    // R1.10 AC2: nhãn đúng nghĩa "Còn 0/5 lượt · đã dùng 5" (không "0 lượt / 5 lượt").
    // R1.10 AC5: nguồn mặc định là hệ thống khi thiếu field — cùng 1 dòng quota.
    expect(screen.getByText(/Còn 0\/5 lượt · đã dùng 5.*hệ thống/)).toBeTruthy();
    expect(screen.getByText(/reset sau \d+h \d+m/)).toBeTruthy();
  });

  it("R1.10 AC4/AC5 — 0/5 hiện cảnh báo đỏ + nguồn khóa cá nhân", async () => {
    coreApiAdapter.getAICommandCenterConfig.mockResolvedValue({
      ...baseSettings,
      fallback_quota_max: 5,
      fallback_quota_remaining: 0,
      fallback_quota_used_today: 5,
      fallback_quota_source: "personal_key",
      fallback_quota_reset: undefined,
      ai_provider: "openai",
    });
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText(/Còn 0\/5 lượt · đã dùng 5/)).toBeTruthy();
    });
    expect(screen.getByText(/khóa cá nhân/)).toBeTruthy();
    expect(screen.getByText("aiCommandCenter.fallbackExhausted")).toBeTruthy();
  });

  it("updates policy display after save without reload (Slice A G-10)", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Nhà cung cấp hiệu lực")).toBeTruthy();
    });
    // S2 (2026-10-19): trước đây test neo vào ô "Khoảng làm mới" của panel chính sách
    // ("{n} giờ/lần"). S2 đã **xoá** ô đó vì nó trùng với ô sửa được trong form, nên test
    // chuyển neo sang `advisory_max_auto_refreshes_per_day` — ô **vẫn còn** trong panel và
    // đi qua **cùng đường** `updateConfig -> onSettingsChange -> applySettingsToOverview`.
    // Mục tiêu test (R1.4: tổng quan cập nhật sau khi lưu, KHÔNG remount) không đổi.
    const autoRefreshValue = () => screen.getByTestId("auto-refresh-value").textContent;
    await waitFor(() => {
      expect(autoRefreshValue()).toBe("24"); // baseSettings không có field -> fallback 24
    });

    const nextData = {
      ...baseSettings,
      advisory_refresh_interval_hours: 12,
      advisory_max_auto_refreshes_per_day: 8,
    };
    coreApiAdapter.updateAICommandCenterConfig.mockResolvedValue(nextData);

    const intervalInput = screen
      .getAllByRole("spinbutton")
      .find((el) => el.placeholder === "24" || el.value === "6");
    expect(intervalInput).toBeTruthy();
    fireEvent.change(intervalInput, { target: { value: "12" } });

    const saveBtn = screen.getByRole("button", { name: /lưu cấu hình/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    // R1.9 AC4: xác nhận preview mới gửi PUT.
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });

    await waitFor(() => {
      expect(coreApiAdapter.updateAICommandCenterConfig).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(autoRefreshValue()).toBe("8");
    });
  });

  it("toggles the event gate and persists via updateUserConfig (Slice 2)", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Nhà cung cấp hiệu lực")).toBeTruthy();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    const gate = checkboxes.find((c) => c.checked === false);
    expect(gate).toBeTruthy();

    await act(async () => {
      fireEvent.click(gate);
    });

    await waitFor(() => {
      expect(coreApiAdapter.updateUserConfig).toHaveBeenCalledWith({
        advisory_whale_signal_enabled: true,
      });
    });
  });

  it("shows an error message when config load fails (Slice 2 resilience)", async () => {
    coreApiAdapter.getAICommandCenterConfig.mockRejectedValue(new Error("network down"));
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("network down")).toBeTruthy();
    });
  });

  it("shows masked key and clears via PUT empty payload (F4)", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByTestId("api-key-mask")).toBeTruthy();
    });
    // Mask never contains full key material beyond last4 bullets
    expect(screen.getByTestId("api-key-mask").textContent).toContain("••••••••test");
    expect(screen.queryByDisplayValue("sk-test-full-key")).toBeNull();

    coreApiAdapter.updateAICommandCenterConfig.mockResolvedValue({
      ...baseSettings,
      ai_api_key_configured: false,
      ai_api_key_masked: "",
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("clear-api-key"));
    });

    await waitFor(() => {
      expect(coreApiAdapter.updateAICommandCenterConfig).toHaveBeenCalledWith({ ai_api_key: "" });
    });
    await waitFor(() => {
      expect(screen.getByText("Đã xóa API Key.")).toBeTruthy();
    });
  });

  it("R0.3 — save without opening drawer does NOT resend prompt_config", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByText("Nhà cung cấp hiệu lực")).toBeTruthy();
    });
    // R1.4 AC2: nút Lưu disabled khi sạch — sửa 1 field để bật nút (không mở drawer).
    // R1.9 AC4: Lưu mở preview trước — xác nhận mới gửi PUT.
    const intervalInput = screen
      .getAllByRole("spinbutton")
      .find((el) => el.placeholder === "24");
    expect(intervalInput).toBeTruthy();
    fireEvent.change(intervalInput, { target: { value: "12" } });
    const saveBtn = screen.getByRole("button", { name: /lưu cấu hình/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });
    await waitFor(() => {
      expect(coreApiAdapter.updateAICommandCenterConfig).toHaveBeenCalled();
    });
    const payload =
      coreApiAdapter.updateAICommandCenterConfig.mock.calls[0][0];
    expect(payload).not.toHaveProperty("ai_prompt_config");
  });

  it("R0.9 AC8 — staff sees system prompt template read-only (F5)", async () => {
    vi.restoreAllMocks();
    vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
    vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({ ...baseSettings });
    vi.spyOn(coreApiAdapter, "updateAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
    vi.spyOn(coreApiAdapter, "updateUserConfig").mockResolvedValue({ advisory_whale_signal_enabled: true });
    vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
    mockStaff(true);
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByTestId("system-prompt-template")).toBeTruthy();
    });
    expect(screen.getByTestId("system-prompt-template").textContent).toBe("System for {symbol}");
    expect(screen.queryByTestId("system-prompt-managed")).toBeNull();
  });

  it("R0.9 AC8 — non-staff sees managed notice, never the template", async () => {
    await act(async () => {
      renderPage();
    });
    await waitFor(() => {
      expect(screen.getByTestId("system-prompt-managed")).toBeTruthy();
    });
    expect(screen.getByTestId("system-prompt-managed").textContent).toContain(
      "System prompt do nền tảng quản lý."
    );
    expect(screen.queryByTestId("system-prompt-template")).toBeNull();
    expect(screen.queryByText("System for {symbol}")).toBeNull();
  });
});
