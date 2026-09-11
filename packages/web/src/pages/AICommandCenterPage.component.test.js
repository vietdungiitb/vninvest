import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { AICommandCenterPage } from "./AICommandCenterPage";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

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
};

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key) => key,
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

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "getUserConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "updateAICommandCenterConfig").mockResolvedValue({ ...baseSettings });
  vi.spyOn(coreApiAdapter, "updateUserConfig").mockResolvedValue({ advisory_whale_signal_enabled: true });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AICommandCenterPage", () => {
  it("loads and renders AI Command Center settings (Slice 2 restore)", async () => {
    await act(async () => {
      render(createElement(AICommandCenterPage, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("aiCommandCenter.effectiveProvider")).toBeTruthy();
    });
    expect(coreApiAdapter.getUserConfig).toHaveBeenCalledTimes(1);
  });

  it("toggles the event gate and persists via updateUserConfig (Slice 2)", async () => {
    await act(async () => {
      render(createElement(AICommandCenterPage, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("aiCommandCenter.effectiveProvider")).toBeTruthy();
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
      render(createElement(AICommandCenterPage, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("network down")).toBeTruthy();
    });
  });
});
