/**
 * F-AC8 — Shared AICommandCenterForm field checklist.
 * Both SaaS AICommandCenterPage and ShellAiCommandCenterPage import this form;
 * any field drift (missing testid) fails here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import {
  AICommandCenterForm,
  AI_CC_FORM_FIELD_TESTIDS,
  AICommandCenterTransport,
  AISettings,
} from "../AICommandCenterForm";
import * as LangContext from "../../context/LangContext.js";

vi.mock("../AIAdvisoryPromptConfigDrawer.js", () => ({
  AIAdvisoryPromptConfigDrawer: () => null,
}));

const baseSettings: AISettings = {
  ai_provider: "local",
  ai_model: "custom",
  custom_endpoint: "http://localhost:11434/v1",
  advisory_max_tokens_per_day: 8000,
  advisory_refresh_interval_hours: 12,
  temperature: 0.5,
  ai_api_key_configured: true,
  ai_api_key_masked: "••••••••abcd",
  ai_ready: true,
  effective_ai_provider: "local",
  effective_ai_model: "llama3.2",
  effective_ai_source: "command_center",
};

function makeTransport(overrides: Partial<AICommandCenterTransport> = {}): AICommandCenterTransport {
  return {
    getConfig: vi.fn().mockResolvedValue({ ...baseSettings }),
    updateConfig: vi.fn().mockResolvedValue({ ...baseSettings }),
    testConnection: vi.fn().mockResolvedValue({ ok: true, message: "ok" }),
    ...overrides,
  };
}

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key: string) => key,
  formatNumber: (n: number) => String(n),
  formatCurrency: (n: number) => String(n),
  formatPriceVND: (n: number) => String(n),
  formatQuotePrice: (p: number) => String(p),
  formatQuoteVolume: (v: number) => String(v),
  formatQuoteInteger: (v: number) => String(v),
  formatDate: (d: unknown) => String(d),
  formatTime: (t: unknown) => String(t),
  formatDateTime: (dt: unknown) => String(dt),
  setLanguage: async () => "vi",
};

beforeEach(() => {
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AICommandCenterForm F-AC8", () => {
  it("exports full field checklist (8 testids)", () => {
    expect(AI_CC_FORM_FIELD_TESTIDS).toEqual([
      "field-ai-provider",
      "field-ai-model",
      "field-custom-model",
      "field-custom-endpoint",
      "field-api-key",
      "field-max-tokens",
      "field-refresh-interval",
      "field-temperature",
    ]);
  });

  it("renders every checklist field when local+custom model shows conditional rows", async () => {
    const transport = makeTransport();
    await actRender(createElement(AICommandCenterForm, { transport }));

    for (const testid of AI_CC_FORM_FIELD_TESTIDS) {
      expect(screen.getByTestId(testid), `missing ${testid}`).toBeTruthy();
    }
    expect(screen.getByTestId("api-key-mask")).toBeTruthy();
    expect(screen.getByTestId("clear-api-key")).toBeTruthy();
    expect(screen.getByTestId("save-config")).toBeTruthy();
    expect(screen.getByTestId("test-connection")).toBeTruthy();
  });

  it("SaaS page and Shell both import the shared form (source contract)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(__dirname, "../.."); // src/
    const pageSrc = fs.readFileSync(path.join(root, "pages/AICommandCenterPage.tsx"), "utf8");
    const shellSrc = fs.readFileSync(
      path.join(root, "pages/system/ShellAiCommandCenterPage.tsx"),
      "utf8"
    );
    expect(pageSrc).toContain("AICommandCenterForm");
    expect(shellSrc).toContain("AICommandCenterForm");
    // Shell must not re-declare local provider form fields
    expect(shellSrc).not.toContain("ai-api-key-input");
    expect(shellSrc).not.toContain("handleSaveSettings");
  });
});

async function actRender(element: React.ReactElement) {
  const { act } = await import("react");
  await act(async () => {
    render(element);
  });
  await waitFor(() => {
    expect(screen.getByTestId("ai-cc-form")).toBeTruthy();
  });
}
