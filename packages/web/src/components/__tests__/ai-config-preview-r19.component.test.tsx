/**
 * R1.9 FE — preview modal + 409 conflict.
 * Fail-before: AiConfigPreviewModal chưa tồn tại (import error) + form chưa
 * mở preview (lưu trực tiếp) + chưa gửi expected_updated_at.
 * AC4: modal liệt kê field đổi; Cancel không PUT.
 * AC5: 409 hiện 2 lựa chọn (tải mới & ghi đè / hủy), không lỗi thô.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  AICommandCenterForm,
  type AICommandCenterTransport,
} from "../AICommandCenterForm";
import * as LangContext from "../../context/LangContext.js";

const T1 = "2026-10-16T00:00:00+00:00";
const T2 = "2026-10-16T00:05:00+00:00";

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
  config_updated_at: T1,
};

function conflictError() {
  const err = new Error("Conflict") as Error & {
    code: string;
    status: number;
    payload: Record<string, unknown>;
  };
  err.code = "ai_config_conflict";
  err.status = 409;
  err.payload = {
    current_updated_at: T2,
    current: { advisory_max_tokens_per_day: 1000 },
  };
  return err;
}

function renderForm(transport: AICommandCenterTransport) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(AICommandCenterForm, { transport })
    )
  );
}

describe("R1.9 FE: preview + 409", () => {
  beforeEach(() => {
    vi.spyOn(LangContext, "useI18n").mockReturnValue({
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
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function baseTransport(overrides: Partial<AICommandCenterTransport> = {}): AICommandCenterTransport {
    return {
      getConfig: vi.fn().mockResolvedValue({ ...baseSettings }),
      updateConfig: vi.fn().mockImplementation(async (p: Record<string, unknown>) => ({
        ...baseSettings,
        ...p,
        config_updated_at: T2,
      })),
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      ...overrides,
    };
  }

  async function dirtyAndOpenPreview(transport: AICommandCenterTransport) {
    renderForm(transport);
    const saveBtn = (await screen.findByTestId("save-config")) as HTMLButtonElement;
    const tokens = (await screen.findByTestId("field-max-tokens")).querySelector("input") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(tokens, { target: { value: "6000" } });
    });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    return transport;
  }

  it("AC4: modal liệt kê field đổi; Cancel không gửi PUT", async () => {
    const transport = baseTransport();
    await dirtyAndOpenPreview(transport);
    const modal = await screen.findByTestId("config-preview");
    expect(modal.textContent).toContain("advisory_max_tokens_per_day");
    expect(modal.textContent).toContain("6000");
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-cancel"));
    });
    expect(transport.updateConfig).not.toHaveBeenCalled();
    expect(screen.queryByTestId("config-preview")).toBeNull();
  });

  it("AC4b: Confirm gửi PUT kèm expected_updated_at", async () => {
    const transport = baseTransport();
    await dirtyAndOpenPreview(transport);
    await screen.findByTestId("config-preview");
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });
    await waitFor(() => expect(transport.updateConfig).toHaveBeenCalledTimes(1));
    const payload = (transport.updateConfig as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.expected_updated_at).toBe(T1);
  });

  it("AC5: 409 hiện xung đột với 2 lựa chọn, không lỗi thô", async () => {
    const transport = baseTransport({
      updateConfig: vi.fn().mockRejectedValueOnce(conflictError()),
    });
    await dirtyAndOpenPreview(transport);
    await screen.findByTestId("config-preview");
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });
    const conflict = await screen.findByTestId("config-conflict");
    const modal = await screen.findByTestId("config-preview");
    expect(modal.textContent).toContain("aiCommandCenter.conflictTitle");
    expect(conflict.textContent).toContain("aiCommandCenter.conflictDesc");
    expect(screen.getByTestId("conflict-reload")).toBeTruthy();
    expect(screen.getByTestId("conflict-cancel")).toBeTruthy();
    expect(conflict.textContent).not.toContain("Core API request error");
  });

  it("AC5b: Tải mới & ghi đè gửi lại PUT với token mới", async () => {
    const updateConfig = vi
      .fn()
      .mockRejectedValueOnce(conflictError())
      .mockImplementation(async (p: Record<string, unknown>) => ({
        ...baseSettings,
        ...p,
        config_updated_at: "2026-10-16T00:06:00+00:00",
      }));
    const transport = baseTransport({ updateConfig });
    await dirtyAndOpenPreview(transport);
    await screen.findByTestId("config-preview");
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });
    await screen.findByTestId("config-conflict");
    await act(async () => {
      fireEvent.click(screen.getByTestId("conflict-reload"));
    });
    await waitFor(() => expect(updateConfig).toHaveBeenCalledTimes(2));
    const second = updateConfig.mock.calls[1][0] as Record<string, unknown>;
    expect(second.expected_updated_at).toBe(T2);
  });

  it("AC5c: Hủy ở màn xung đột không gửi thêm PUT", async () => {
    const updateConfig = vi.fn().mockRejectedValueOnce(conflictError());
    const transport = baseTransport({ updateConfig });
    await dirtyAndOpenPreview(transport);
    await screen.findByTestId("config-preview");
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-confirm"));
    });
    await screen.findByTestId("config-conflict");
    await act(async () => {
      fireEvent.click(screen.getByTestId("conflict-cancel"));
    });
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("config-conflict")).toBeNull();
  });
});
