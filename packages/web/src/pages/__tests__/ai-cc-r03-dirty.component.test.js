import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, cleanup } from "@testing-library/react";
import { createElement, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { shouldSendPromptConfig } from "../AICommandCenterPage.js";
import { AICommandCenterForm } from "../../components/AICommandCenterForm.js";
import * as LangContext from "../../context/LangContext.js";

/**
 * R0.3 fail-before: `ai_prompt_config` chi gui khi drawer that su dirty.
 * - Helper thuan `shouldSendPromptConfig` (don vi).
 * - Form bao drawer-edit qua `onPromptConfigEdited` (drawer stub co nut sua).
 */

vi.mock("../../components/AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: ({ onConfigChange }) =>
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "drawer-edit",
        onClick: () =>
          onConfigChange({
            version: 2,
            sources: { whale: { enabled: false, lookback: 7 } },
          }),
      },
      "drawer-edit-stub",
    ),
}));

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

const transport = {
  getConfig: vi.fn().mockResolvedValue({ ai_provider: "openai", ai_model: "gpt-4o-mini" }),
  updateConfig: vi.fn().mockResolvedValue({}),
  testConnection: vi.fn().mockResolvedValue({ ok: true }),
};

function renderForm(props = {}) {
  return render(
    createElement(MemoryRouter, null,
      createElement(AICommandCenterForm, { transport, ...props })),
  );
}

describe("R0.3 dirty-only prompt_config", () => {
  beforeEach(() => {
    vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shouldSendPromptConfig: chi gui khi dirty + co config", () => {
    expect(shouldSendPromptConfig({ version: 2, sources: {} }, true)).toBe(true);
    expect(shouldSendPromptConfig({ version: 2, sources: {} }, false)).toBe(false);
    expect(shouldSendPromptConfig(null, true)).toBe(false);
    expect(shouldSendPromptConfig(null, false)).toBe(false);
  });

  it("drawer edit bao onPromptConfigEdited (load thuong khong bao)", async () => {
    const onEdited = vi.fn();
    const onChanged = vi.fn();
    await act(async () => {
      renderForm({ onPromptConfigEdited: onEdited, onPromptConfigChange: onChanged });
    });
    // Mo drawer (nut co san trong form).
    fireEvent.click(screen.getByTestId("open-prompt-config"));
    await waitFor(() => {
      expect(screen.getByTestId("drawer-edit")).toBeTruthy();
    });
    expect(onEdited).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("drawer-edit"));
    await waitFor(() => {
      expect(onEdited).toHaveBeenCalledTimes(1);
    });
    expect(onChanged).toHaveBeenCalled();
  });
});
