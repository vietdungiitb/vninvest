/**
 * R3.3 — test dashboard SLO LLM.
 *
 * AC2 `null` ⇒ `—` (không `0%`) · AC3 `$` chỉ khi `pricing_complete` ·
 * AC5 range 7/30/90 · AC6 cache 60 s + **không** poll khi `document.hidden` ·
 * AC4 chart dùng token của R1.6 (giá trị rỗng trong jsdom ⇒ fallback, không vỡ).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AISloDashboardPage } from "../AISloDashboardPage";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
    locale: "vi",
  }),
}));

// jsdom không có `ResizeObserver`; recharts `ResponsiveContainer` cần nó và thiếu
// thì **sập cả cây render** (bảng cũng biến mất ⇒ test khác đỏ theo, dễ chẩn
// đoán nhầm). Polyfill y hệt các file test recharts khác trong repo.
if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const row = (over: Record<string, unknown> = {}) => ({
  model: "gpt-4o-mini",
  requests: 10,
  success_rate: 0.95,
  p50_latency_ms: 120,
  p95_latency_ms: 480,
  p99_latency_ms: 900,
  tokens_total: 3000,
  tokens_per_day: 100,
  cost_total: "1.500000",
  cost_per_day: "0.050000",
  pricing_complete: true,
  ...over,
});

// Đường dẫn theo mẫu `ai-usage-chart-r16.component.test.ts` — `import.meta.url`
// trong vitest/Windows không phải URL `file:` nên `readFileSync(new URL(...))` vỡ.
const PAGE_SRC = resolve(process.cwd(), "src/pages/AISloDashboardPage.tsx");

function payload(results: unknown[], days = 30) {
  return { results, days, requests_total: results.length * 10 };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/ai/slo"]}>
      <AISloDashboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("R3.3 AISloDashboardPage", () => {
  it("AC2: không có dữ liệu ⇒ empty state, không bảng toán 0", async () => {
    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(payload([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("slo-empty")).toBeTruthy());
    expect(screen.queryByTestId("slo-table")).toBeNull();
  });

  it("AC2: `null` hiển thị `—`, KHÔNG phải 0 hoặc 0%", async () => {
    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(
      payload([
        row({
          success_rate: null,
          p95_latency_ms: null,
          tokens_per_day: null,
        }),
      ]),
    );
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("slo-row").length).toBe(1));
    const cells = screen.getByTestId("slo-row").textContent ?? "";
    expect(cells).toContain("—");
    expect(cells).not.toContain("0%");
    expect(screen.getByTestId("slo-success-rate").textContent).toBe("—");
  });

  it("AC3: `pricing_complete=false` ⇒ cột $ hiện `—`, không phải $0.00", async () => {
    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(
      payload([row({ pricing_complete: false, cost_per_day: "0.000000" })]),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId("slo-cost")).toBeTruthy());
    expect(screen.getByTestId("slo-cost").textContent).toBe("—");
  });

  it("AC3: có bảng giá ⇒ hiện $ + số", async () => {
    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(
      payload([row({ cost_per_day: "0.050000" })]),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId("slo-cost")).toBeTruthy());
    expect(screen.getByTestId("slo-cost").textContent).toContain("$0.05");
  });

  it("AC5: đổi range ⇒ gọi API với `days` tương ứng", async () => {
    const spy = vi
      .spyOn(coreApiAdapter, "getAIUsageSlo")
      .mockResolvedValue(payload([row()]));
    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalled());

    for (const days of [7, 90, 30]) {
      fireEvent.click(screen.getByTestId(`slo-range-${days}`));
      await waitFor(() =>
        expect(
          spy.mock.calls.some(
            ([p]) => (p as { days?: number }).days === days,
          ),
        ).toBe(true),
      );
    }
  });

  it("AC6: poll định kỳ không gọi lại khi tab đang ẩn", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const spy = vi
      .spyOn(coreApiAdapter, "getAIUsageSlo")
      .mockResolvedValue(payload([row()]));

    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    // Bấm qua 3 khoảng 60s — tab ẩn ⇒ không được gọi thêm lần nào.
    await vi.advanceTimersByTimeAsync(180_000);
    expect(spy).toHaveBeenCalledTimes(1);
    hidden.mockRestore();
  });

  it("AC6: tab hiện ⇒ poll sau 60 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const spy = vi
      .spyOn(coreApiAdapter, "getAIUsageSlo")
      .mockResolvedValue(payload([row()]));

    renderPage();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    // Dưới 60s ⇒ cache, chưa gọi lại.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(spy).toHaveBeenCalledTimes(1);
    // Qua 60s ⇒ có gọi lại.
    await vi.advanceTimersByTimeAsync(40_000);
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(1));
  });

  it("AC7: lỗi ⇒ thông báo + nút Thử lại gọi lại API", async () => {
    const spy = vi
      .spyOn(coreApiAdapter, "getAIUsageSlo")
      .mockRejectedValueOnce(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("slo-error")).toBeTruthy());
    spy.mockResolvedValue(payload([]));
    fireEvent.click(screen.getByTestId("slo-retry"));
    await waitFor(() => expect(screen.getByTestId("slo-empty")).toBeTruthy());
  });

  it("AC4: chart dùng token của R1.6, không khai báo màu thứ hai", async () => {
    // jsdom đo container 0×0 ⇒ recharts không vẽ SVG, nên **không** assert DOM
    // cho chart. Cách repo đã dùng cho AC này (và cùng cách `check-ai-cc` gate
    // kiểm) là **quét mã nguồn**: trang không được tự khai báo hex/rgba.
    const src = readFileSync(PAGE_SRC, "utf8");
    expect(src).toContain('from "../components/AIUsageDashboard.tsx"');
    expect(src).toMatch(/chartToken\(/);
    expect(src).not.toContain("CHART_TOKEN_FALLBACK");

    const offending = src
      .split("\n")
      .filter((ln) => /#[0-9a-fA-F]{3,6}\b|rgba?\(/.test(ln))
      .filter((ln) => !ln.includes("chartToken("));
    expect(offending, `mau hex/rgba hardcode trong trang: ${offending}`).toEqual([]);

    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(
      payload([row({ model: "gpt-4o-mini" }), row({ model: "gemini-3.8-flash" })]),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId("slo-chart")).toBeTruthy());
    expect(screen.getAllByTestId("slo-row").length).toBe(2);
  });

  it("tab SLO có trong AiHubNav và đánh dấu trang hiện tại", async () => {
    vi.spyOn(coreApiAdapter, "getAIUsageSlo").mockResolvedValue(payload([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("ai-slo-page")).toBeTruthy());
    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")
      .map((a) => a.getAttribute("href"));
    expect(current).toEqual(["/settings/ai/slo"]);
  });
});