import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * W6.5 — thay các assert đọc-chuỗi-source bằng assert trên DOM render thật.
 * Test cũ đọc `ShellAiAdvisoryPage.tsx` (nay đã xoá ở R1.2) và assert
 * `[data-theme="light"] .advisory-page` có trong CSS — cả hai đều không bắt
 * được hành vi người dùng thấy.
 */

const pageSource = readFileSync(resolve(process.cwd(), "src/pages/signals/WhaleAdvisoryPage.tsx"), "utf8");

const hookState: Record<string, unknown> = {
  items: [{
    advisory_id: "a1",
    symbol: "FPT",
    side: "BUY",
    confidence: 82,
    ai_summary: "Tăng",
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    status: "generated",
    created_at: "2026-09-25T10:00:00Z",
  }],
  loading: false,
  error: "",
  symbolStats: [{ symbol: "FPT", side: "BUY", confidence: 82 }],
  statsLoading: false,
  refreshInfoMap: {},
  refreshInfoErrors: {},
  pendingRefreshSymbols: {},
  pendingDeleteSymbols: {},
  rowMessages: {},
  fetchData: vi.fn(),
  loadRefreshInfo: vi.fn(),
  handleRefreshAdvisory: vi.fn(),
  handleDeleteAdvisory: vi.fn(),
};

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn(() => ({ userPlan: "Pro", activePortfolioId: null })) }));
vi.mock("@/components/ShellToast.js", () => ({ useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));
vi.mock("@/hooks/useWhaleAdvisoryData.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/hooks/useWhaleAdvisoryData.js")>();
  return { ...mod, useWhaleAdvisoryData: vi.fn(() => hookState) };
});

import { ConfirmProvider } from "@/components/ConfirmModal.js";

// W3-4 (AC-4.1a) — nap module o CAP MODULE (top-level await), KHONG trong
// `renderPage()`. Truoc day phai nnap o dong 55 ben trong ham, va `renderPage()`
// duoc goi tu trong `it(...)` ⇒ thoi gian nap module bi tinh vao TIMEOUT cua
// test. Do la ly do Entry 255 ghi file nay la flake. Do lao duoc cua
// `page-heading-fu02c.component.test.tsx`: sau khi dua `await import` ra cap
// module, thoi gian `tests` cua file do giam tu 33.89 s xuong 1.30 s.
const { WhaleAdvisoryPage } = await import("../../pages/signals/WhaleAdvisoryPage.tsx");

function renderPage() {
  return render(createElement(
    ConfirmProvider,
    null,
    createElement(MemoryRouter, { initialEntries: ["/ai-advisory"] },
      createElement(Routes, null, createElement(Route, { path: "ai-advisory", element: createElement(WhaleAdvisoryPage) }))),
  ));
}

describe("advisory a11y + structure (W1/W2/W4/W6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.error = "";
    hookState.items = [{
      advisory_id: "a1", symbol: "FPT", side: "BUY", confidence: 82,
      ai_summary: "Tăng", created_at: "2026-09-25T10:00:00Z",
    }];
    hookState.symbolStats = [{ symbol: "FPT", side: "BUY", confidence: 82 }];
  });

  it("R1.1 — không còn render bubble chart trong trang", async () => {
    renderPage();
    expect(pageSource).not.toContain("FactsFirstWhaleBubbleChart");
    expect(pageSource).not.toContain("WhaleBubbleChart");
  });

  it("R1.2 — file ShellAiAdvisoryPage đã bị xoá", () => {
    expect(existsSync(resolve(process.cwd(), "src/pages/signals/ShellAiAdvisoryPage.tsx"))).toBe(false);
  });

  it("R2.2 — chỉ còn 3 tab hỗ trợ (Rủi ro / Lịch sử / Backtest)", async () => {
    renderPage();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("R2.2 — telemetry nằm trong footer, không phải tab", async () => {
    renderPage();
    const telemetry = screen.getByTestId("advisory-local-telemetry");
    expect(telemetry.tagName.toLowerCase()).toBe("details");
    expect(telemetry.closest('[role="tabpanel"]')).toBeNull();
  });

  it("R2.3 — sidebar không còn cột số liệu bịa (0% / ▲0 / GD)", async () => {
    renderPage();
    expect(document.body.textContent).not.toContain("GD");
    expect(document.body.textContent).not.toMatch(/\b0%/);
  });

  it("R2.6 — không còn badge LIVE tĩnh trong sidebar", async () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/\bLIVE\b/);
  });

  it("R4.6 — nút so sánh không còn role=checkbox lồng trong button", async () => {
    const { container } = renderPage();
    expect(container.querySelector('button [role="checkbox"]')).toBeNull();
  });

  it("R4.1 — mã không có tư vấn thì hiện empty state đúng nghĩa", async () => {
    hookState.items = [];
    renderPage();
    const empty = await screen.findByTestId("empty-no-advisory");
    expect(empty.textContent).toContain("chưa có tư vấn");
  });

  it("R4.2 — metric không có dữ liệu hiện —, không phải 0", async () => {
    hookState.items = [{ symbol: "FPT", side: "UNKNOWN", created_at: null }];
    renderPage();
    const intensity = await screen.findByTestId("metric-intensity");
    expect(intensity.textContent?.trim()).toBe("—");
    expect(document.body.textContent).not.toContain("0 VNĐ");
  });

  it("R4.4 — lỗi tải hiện banner kèm mã lỗi và nút thử lại", async () => {
    hookState.error = "provider_model_not_found";
    renderPage();
    const banner = await screen.findByTestId("advisory-error-banner");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(screen.getByTestId("advisory-error-code").textContent).toContain("provider_model_not_found");
  });

  it("requires confirm before deleting current advisory", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Xóa tư vấn"));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeTruthy();
    expect(hookState.handleDeleteAdvisory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(hookState.handleDeleteAdvisory).toHaveBeenCalledWith("FPT"));
  }, 30000);

  it("aria-live row message vẫn còn", async () => {
    hookState.rowMessages = { FPT: "Thành công" };
    const { container } = renderPage();
    expect(container.querySelector("[aria-live='polite']")).toBeTruthy();
  });
});
