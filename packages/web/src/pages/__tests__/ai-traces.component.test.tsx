/**
 * R3.2 — test trang "Traces".
 *
 * AC2 waterfall có latency từng bước + tổng · AC3 click bước ⇒ metadata, **không**
 * plaintext · AC4 filter + phân trang · AC5 empty state trung thực ·
 * AC7 skeleton + nút "Thử lại" · AC1 tab trong `AiHubNav`.
 *
 * Adapter được `vi.spyOn` (mẫu của `AIUsageDashboard.component.test.js`) — không
 * mock cả module để giữ đường gọi thật.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

import { AICommandTracesPage } from "../AICommandTracesPage";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({ t: (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key, locale: "vi" }),
}));

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  trace_id: "t-1",
  advisory_id: "a-1",
  symbol: "VIC",
  session_date: "2026-10-17",
  step: "technical",
  provider: "openai",
  model: "gpt-4o-mini",
  prompt_hash: "a".repeat(64),
  response_hash: "b".repeat(64),
  tokens_in: 10,
  tokens_out: 20,
  latency_ms: 100,
  status: "ok",
  error_code: "",
  routing_decision: {},
  created_at: "2026-10-17T10:00:00+07:00",
  ...over,
});

function payload(results: unknown[], total = results.length, offset = 0) {
  return { results, total, limit: 20, offset };
}

function renderPage(): ReactElement {
  return (
    <MemoryRouter initialEntries={["/settings/ai/traces"]}>
      <AICommandTracesPage />
    </MemoryRouter>
  ) as ReactElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("R3.2 AICommandTracesPage", () => {
  it("AC5: chưa có trace ⇒ empty state trung thực, không bảng rỗng", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(payload([], 0));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("traces-empty")).toBeTruthy());
    expect(screen.queryByTestId("traces-list")).toBeNull();
    expect(screen.getByTestId("traces-empty").textContent).toContain(
      "aiCommandCenter.emptyTraces",
    );
  });

  it("AC7: đang tải ⇒ skeleton, không nhảy thẳng ra empty", async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.spyOn(coreApiAdapter, "getAITraces").mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as Promise<unknown>,
    );
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("traces-loading")).toBeTruthy());
    expect(screen.queryByTestId("traces-empty")).toBeNull();
    resolve(payload([]));
    await waitFor(() => expect(screen.getByTestId("traces-empty")).toBeTruthy());
  });

  it("AC7: lỗi ⇒ thông báo + nút Thử lại, bấm được thì gọi lại API", async () => {
    const spy = vi
      .spyOn(coreApiAdapter, "getAITraces")
      .mockRejectedValueOnce(new Error("boom"));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("traces-error")).toBeTruthy());
    expect(screen.getByTestId("traces-retry")).toBeTruthy();
    spy.mockResolvedValue(payload([]));
    fireEvent.click(screen.getByTestId("traces-retry"));
    await waitFor(() => expect(screen.getByTestId("traces-empty")).toBeTruthy());
    expect(spy.mock.calls.length).toBeGreaterThan(1);
  });

  it("AC2: waterfall 4 bước + latency từng bước + tổng", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(
      payload([
        row({ id: 1, step: "technical", latency_ms: 100 }),
        row({ id: 2, step: "flow", latency_ms: 150 }),
        row({ id: 3, step: "sentiment", latency_ms: 200 }),
        row({ id: 4, step: "synthesis", latency_ms: 250 }),
      ]),
    );
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("trace-group")).toBeTruthy());
    const steps = screen.getAllByTestId("trace-step");
    expect(steps.length).toBe(4);
    // Thứ tự phải theo luồng thật, không theo thứ tự server trả về.
    expect(steps[0].textContent).toContain("aiCommandCenter.stepTechnical");
    expect(steps[3].textContent).toContain("aiCommandCenter.stepSynthesis");
    expect(steps[0].textContent).toContain('{"ms":100}');
    // Tổng = 100+150+200+250
    expect(screen.getByTestId("trace-total-latency").textContent).toContain(
      '{"ms":700}',
    );
  });

  it("AC3: click 1 bước ⇒ hiện metadata, không có plaintext", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(payload([row()]));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("trace-step")).toBeTruthy());
    fireEvent.click(screen.getByTestId("step-details"));
    const meta = screen.getByTestId("trace-metadata");
    expect(meta.textContent).toContain("t-1");
    expect(meta.textContent).toContain("a".repeat(64));
    // Hash SHA-256 là 64 ký tự; payload không mang nội dung thô.
    expect(screen.queryByTestId("trace-prompt-plaintext")).toBeNull();
  });

  it("AC3: bước lỗi hiện error_code", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(
      payload([row({ status: "error", error_code: "provider_http_500" })]),
    );
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("trace-step")).toBeTruthy());
    fireEvent.click(screen.getByTestId("step-details"));
    expect(screen.getByTestId("trace-error-code").textContent).toBe(
      "provider_http_500",
    );
  });

  it("AC4: đổi filter ⇒ gọi API với tham số lọc", async () => {
    const spy = vi
      .spyOn(coreApiAdapter, "getAITraces")
      .mockResolvedValue(payload([row()]));
    render(renderPage());
    await waitFor(() => expect(spy).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId("filter-symbol"), {
      target: { value: "HAG" },
    });
    await waitFor(() =>
      expect(spy.mock.calls.some(([p]) => (p as { symbol?: string }).symbol === "HAG")).toBe(true),
    );
  });

  it("AC4: phân trang có prev/next và truyền offset", async () => {
    const spy = vi
      .spyOn(coreApiAdapter, "getAITraces")
      .mockResolvedValue(payload([row()], 45, 0));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("traces-pagination")).toBeTruthy());
    expect(screen.getByTestId("traces-page-info").textContent).toContain(
      '{"page":1,"total":45}',
    );
    fireEvent.click(screen.getByTestId("traces-next"));
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([p]) => (p as { offset?: number }).offset === 20),
      ).toBe(true),
    );
  });

  it("AC4: trang trước bị disable khi offset = 0", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(payload([row()], 45, 0));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("traces-pagination")).toBeTruthy());
    expect((screen.getByTestId("traces-prev") as HTMLButtonElement).disabled).toBe(true);
  });

  it("AC1: tab Traces có trong AiHubNav và đánh dấu trang hiện tại", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(payload([]));
    render(renderPage());
    await waitFor(() => expect(screen.getByTestId("ai-traces-page")).toBeTruthy());
    const tabs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(tabs).toContain("/settings/ai/traces");
    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page")
      .map((a) => a.getAttribute("href"));
    expect(current).toEqual(["/settings/ai/traces"]);
  });

  it("nhóm theo trace_id: 2 lần chạy ⇒ 2 nhóm, không gộp", async () => {
    vi.spyOn(coreApiAdapter, "getAITraces").mockResolvedValue(
      payload([
        row({ id: 1, trace_id: "t-1" }),
        row({ id: 2, trace_id: "t-2", step: "flow" }),
      ]),
    );
    render(renderPage());
    await waitFor(() => expect(screen.getAllByTestId("trace-group").length).toBe(2));
  });
});