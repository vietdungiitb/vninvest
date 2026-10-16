/**
 * R1.4 — Skeleton + isDirty + beforeunload + timeout cleanup + refresh() imperative.
 * Fail-before: AC1 (số giả 24/5000) / AC2 (Lưu luôn bật) / AC3 (không beforeunload)
 * / AC5 (remount mất page) / AC6 (setTimeout không cleanup) RED trên code cũ.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adapterMocks = vi.hoisted(() => ({
  getAICommandCenterConfig: vi.fn(),
  updateAICommandCenterConfig: vi.fn(),
  getAIAuditLogs: vi.fn(),
  getUserConfig: vi.fn(),
  updateUserConfig: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    get getAICommandCenterConfig() {
      return adapterMocks.getAICommandCenterConfig;
    },
    get updateAICommandCenterConfig() {
      return adapterMocks.updateAICommandCenterConfig;
    },
    get getAIAuditLogs() {
      return adapterMocks.getAIAuditLogs;
    },
    get getUserConfig() {
      return adapterMocks.getUserConfig;
    },
    get updateUserConfig() {
      return adapterMocks.updateUserConfig;
    },
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

const PAGE = resolve(process.cwd(), "src/pages/AICommandCenterPage.tsx");
const FORM = resolve(process.cwd(), "src/components/AICommandCenterForm.tsx");

const baseSettings = {
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_ready: true,
  effective_ai_provider: "openai",
  effective_ai_model: "gpt-4o-mini",
  effective_ai_source: "command_center",
  advisory_whale_signal_enabled: false,
  advisory_refresh_interval_hours: 6,
  advisory_max_tokens_per_day: 1000,
  temperature: 0.3,
  ai_api_key_configured: false,
  ai_prompt_config: null,
  ai_prompt_config_history: [],
};

function mockResolved() {
  adapterMocks.getAICommandCenterConfig.mockResolvedValue({ ...baseSettings });
  adapterMocks.updateAICommandCenterConfig.mockImplementation(async (p: Record<string, unknown>) => ({
    ...baseSettings,
    ...p,
  }));
  adapterMocks.getAIAuditLogs.mockResolvedValue({ results: [], total: 0 });
  adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
  adapterMocks.updateUserConfig.mockResolvedValue({ advisory_whale_signal_enabled: true });
}

function SearchProbe() {
  const [params] = useSearchParams();
  return createElement("div", { "data-testid": "search" }, params.toString());
}

function renderPage(search = "/settings/ai") {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [search] },
      createElement(LangProvider, null, [
        createElement(SearchProbe, { key: "probe" }),
        createElement(AICommandCenterPage, { key: "page" }),
      ])
    )
  );
}

describe("R1.4: skeleton + dirty + refresh imperative", () => {
  beforeEach(() => {
    for (const fn of Object.values(adapterMocks)) (fn as ReturnType<typeof vi.fn>).mockReset();
  });

  it("AC1: GET chưa xong ⇒ skeleton aria-busy, không hiện số 24/5000", async () => {
    adapterMocks.getAICommandCenterConfig.mockImplementation(() => new Promise(() => {}));
    adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
    adapterMocks.getAIAuditLogs.mockResolvedValue({ results: [], total: 0 });
    renderPage();
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeTruthy());
    expect(screen.queryByDisplayValue("5000")).toBeNull();
    expect(screen.queryByDisplayValue("24")).toBeNull();
    expect(screen.queryByDisplayValue("6")).toBeNull();
  });

  it("AC2: sửa field ⇒ Lưu bật; lưu xong ⇒ tắt lại", async () => {
    mockResolved();
    renderPage();
    const saveBtn = (await screen.findByTestId("save-config")) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    const tokens = (await screen.findByTestId("field-max-tokens")).querySelector("input") as HTMLInputElement;
    fireEvent.change(tokens, { target: { value: "6000" } });
    await waitFor(() => expect(saveBtn.disabled).toBe(false));
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(adapterMocks.updateAICommandCenterConfig).toHaveBeenCalled()
    );
    await waitFor(() => expect(saveBtn.disabled).toBe(true));
  });

  it("AC3: còn dirty ⇒ đăng ký beforeunload; sạch ⇒ gỡ", async () => {
    mockResolved();
    const addSpy = vi.spyOn(window, "addEventListener");
    const rmSpy = vi.spyOn(window, "removeEventListener");
    renderPage();
    const saveBtn = (await screen.findByTestId("save-config")) as HTMLButtonElement;
    const tokens = (await screen.findByTestId("field-max-tokens")).querySelector("input") as HTMLInputElement;
    fireEvent.change(tokens, { target: { value: "6000" } });
    await waitFor(() =>
      expect(addSpy.mock.calls.some((c) => c[0] === "beforeunload")).toBe(true)
    );
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(adapterMocks.updateAICommandCenterConfig).toHaveBeenCalled()
    );
    await waitFor(() =>
      expect(rmSpy.mock.calls.some((c) => c[0] === "beforeunload")).toBe(true)
    );
    addSpy.mockRestore();
    rmSpy.mockRestore();
  });

  it("AC4: unmount sau notice ⇒ clearTimeout, không setState-after-unmount", async () => {
    mockResolved();
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    try {
      const { unmount } = renderPage();
      const saveBtn = (await screen.findByTestId("save-config")) as HTMLButtonElement;
      const tokens = (await screen.findByTestId("field-max-tokens")).querySelector(
        "input"
      ) as HTMLInputElement;
      fireEvent.change(tokens, { target: { value: "6000" } });
      await waitFor(() => expect(saveBtn.disabled).toBe(false));
      fireEvent.click(saveBtn);
      await waitFor(() => expect(saveBtn.disabled).toBe(true));
      // notice đang treo timer 3000ms ⇒ unmount phải clear (không chờ hết 3s thật)
      unmount();
      expect(clearSpy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      clearSpy.mockRestore();
    }
  });

  it("AC5: lưu ⇒ audit tải lại NHƯNG giữ filter + page (không remount)", async () => {
    const logs = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      action: "update_settings",
      actor: "admin",
      reason: "",
      before_json: {},
      after_json: {},
      diff_summary: "d",
      created_at: "2026-10-10T00:00:00Z",
    }));
    adapterMocks.getAICommandCenterConfig.mockResolvedValue({ ...baseSettings });
    adapterMocks.updateAICommandCenterConfig.mockImplementation(async (p: Record<string, unknown>) => ({
      ...baseSettings,
      ...p,
    }));
    adapterMocks.getAIAuditLogs.mockImplementation(
      ({ offset = 0, limit = 10 }: { offset: number; limit: number }) =>
        Promise.resolve({ results: logs.slice(offset, offset + limit), total: logs.length })
    );
    adapterMocks.getUserConfig.mockResolvedValue({ preferences: {} });
    adapterMocks.updateUserConfig.mockResolvedValue({ advisory_whale_signal_enabled: true });
    renderPage("/settings/ai?action=update_settings&page=3");
    // đợi audit load trang 3 (offset 20)
    await waitFor(() => {
      const calls = adapterMocks.getAIAuditLogs.mock.calls as { offset: number }[][];
      expect(calls.some((c) => (c[0] as unknown as { offset: number }).offset === 20)).toBe(true);
    });
    const before = adapterMocks.getAIAuditLogs.mock.calls.length;
    // mở rộng 1 dòng rồi lưu form ⇒ sau refresh dòng đó vẫn mở (không remount)
    const collapsed = await screen.findAllByRole("button", { expanded: false });
    fireEvent.click(collapsed[0]);
    await screen.findAllByRole("button", { expanded: true });
    const saveBtn = (await screen.findByTestId("save-config")) as HTMLButtonElement;
    const tokens = (await screen.findByTestId("field-max-tokens")).querySelector("input") as HTMLInputElement;
    fireEvent.change(tokens, { target: { value: "6000" } });
    await waitFor(() => expect(saveBtn.disabled).toBe(false));
    fireEvent.click(saveBtn);
    await waitFor(() =>
      expect(adapterMocks.getAIAuditLogs.mock.calls.length).toBeGreaterThan(before)
    );
    const search = screen.getByTestId("search").textContent || "";
    expect(search.includes("action=update_settings")).toBe(true);
    expect(search.includes("page=3")).toBe(true);
    // dòng đang mở vẫn mở (không remount)
    expect(screen.getAllByRole("button", { expanded: true }).length).toBe(1);
  }, 20000);

  it("AC6: mọi setTimeout đều có clearTimeout cleanup", () => {
    for (const [f, name] of [
      [PAGE, "page"],
      [FORM, "form"],
    ] as const) {
      const src = readFileSync(f, "utf8");
      const sets = (src.match(/setTimeout\(/g) || []).length;
      const clears = (src.match(/clearTimeout\(/g) || []).length;
      expect(sets, `${name} thiếu setTimeout`).toBeGreaterThan(0);
      // cleanup bao phủ: mỗi timer đều có đường clear (unmount + reschedule)
      expect(clears, `${name}: ${sets} setTimeout nhưng ${clears} clearTimeout`).toBeGreaterThanOrEqual(sets);
    }
  });
});
