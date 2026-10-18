import { render, screen, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
// WAVE 11 / NAV-1 — xem `AIUsageDashboard.component.test.js`: `useUrlState` ->
// `useSearchParams` -> `useLocation()` throw ngoai `<Router>`.
import { MemoryRouter } from "react-router-dom";
import { AIUsageDashboard } from "./AIUsageDashboard";
import { AIAdvisoryPromptConfigDrawer } from "./AIAdvisoryPromptConfigDrawer.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

vi.mock("./ConfirmModal.js", () => ({
  ConfirmProvider: ({ children }) => children,
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

const EN = {
  locale: "en",
  localeTag: "en-US",
  t: (key) => EN_KEYS[key] ?? key,
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

const EN_KEYS = {
  "aiUsageAnalytics.title": "AI Usage Analytics",
  "aiUsageAnalytics.description": "Track usage, costs, and performance of AI services.",
  "aiUsageAnalytics.totalRequests": "Total Requests",
  "aiUsageAnalytics.totalTokens": "Total Tokens",
  "aiUsageAnalytics.totalCost": "Total Cost",
  "aiUsageAnalytics.avgLatency": "Avg Latency",
  "aiUsageAnalytics.last7Days": "Last 7 days",
  "aiUsageAnalytics.last30Days": "Last 30 days",
  "aiUsageAnalytics.last90Days": "Last 90 days",
  "aiUsageAnalytics.createdAt": "Time",
  "aiUsageAnalytics.action": "Action",
  "aiUsageAnalytics.provider": "Provider",
  "aiUsageAnalytics.model": "Model",
  "aiUsageAnalytics.tokensIn": "Tokens In",
  "aiUsageAnalytics.tokensOut": "Tokens Out",
  "aiUsageAnalytics.cost": "Cost",
  "aiUsageAnalytics.latency": "Latency",
  "aiUsageAnalytics.status": "Status",
  "aiUsageAnalytics.refresh": "Refresh",
  "aiUsageAnalytics.exportCsv": "Export CSV",
  "aiUsageAnalytics.exporting": "Exporting...",
  "aiUsageAnalytics.loading": "Loading usage data...",
  "aiUsageAnalytics.empty": "No usage records yet.",
  "aiUsageAnalytics.showing": "Showing {shown} / {total} records.",
  "aiUsageAnalytics.prev": "← Previous",
  "aiUsageAnalytics.next": "Next →",
  "aiUsageAnalytics.pageOf": "Page {page} / {total}",
  "aiUsageAnalytics.perPage": "Show:",
  "aiUsageAnalytics.filterModel": "Model",
  "aiUsageAnalytics.filterStatus": "Status",
  "aiUsageAnalytics.filterAll": "All",
  "aiUsageAnalytics.chartTitle": "Tokens by day",
  "aiUsageAnalytics.chartTokensIn": "Tokens in",
  "aiUsageAnalytics.chartEmpty": "No chart data yet.",
  "promptConfig.close": "Close",
  "aiCommandCenter.promptDrawerFooter":
    "Config syncs automatically and applies on the next refresh.",
  "aiCommandCenter.action": "Action",
  "aiCommandCenter.actor": "Actor",
  "aiCommandCenter.fromDate": "From Date",
  "aiCommandCenter.toDate": "To Date",
  "aiCommandCenter.applyFilter": "Apply Filter",
  "aiCommandCenter.resetFilter": "Reset Filter",
  "aiCommandCenter.noLogs": "No audit logs yet.",
  "aiCommandCenter.loading": "Loading audit logs...",
  "aiCommandCenter.loadError": "Could not load audit logs.",
  "aiCommandCenter.actionAll": "All actions",
  "aiCommandCenter.actionUpdateSettings": "Update settings",
  "aiCommandCenter.actionTestSuccess": "Connection test succeeded",
  "aiCommandCenter.actionTestFailed": "Connection test failed",
  "aiCommandCenter.actorPlaceholder": "e.g. admin",
  "aiCommandCenter.before": "Before",
  "aiCommandCenter.after": "After",
  "aiCommandCenter.reasonPrefix": "Reason:",
  "aiCommandCenter.auditShowing": "{total} records — Page {page}/{totalPages}",
  "aiCommandCenter.previous": "Previous",
  "aiCommandCenter.next": "Next",
};

const VI_HARDCODE = [
  "Thời gian",
  "Hành động",
  "Token vào",
  "Token ra",
  "Chi phí",
  "Độ trễ",
  "Trạng thái",
  "7 ngày",
  "← Trước",
  "Sau →",
  "Hiển thị:",
  "VD: Phân tích ngành",
  "phân_tích_ngành",
  '"Có"',
  '"Không"',
  "Cấu hình được đồng bộ",
  "Tất cả hành động",
  "Người thực hiện",
  "VD: admin",
  "Từ ngày",
  "Đến ngày",
  "Áp dụng bộ lọc",
  "Xóa bộ lọc",
  "Đang tải audit logs",
  "Chưa có bản ghi audit",
  "Lý do:",
  "bản ghi — Trang",
];

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getAIUsageAggregate").mockResolvedValue({
    total_requests: 10,
    total_tokens_in: 100,
    total_tokens_out: 50,
    total_cost: "1.5",
    avg_latency: 200,
  });
  vi.spyOn(coreApiAdapter, "getAIUsageSummary").mockResolvedValue({ results: [] });
  vi.spyOn(coreApiAdapter, "getAIUsageRecords").mockResolvedValue({
    results: [
      {
        id: "1",
        created_at: "2024-01-01T00:00:00Z",
        action: "chat",
        provider: "openai",
        model: "gpt-4",
        tokens_in: 100,
        tokens_out: 50,
        cost: "0.01",
        latency_ms: 200,
        status: "success",
      },
    ],
    total: 1,
  });
  vi.spyOn(coreApiAdapter, "getAIAgents").mockResolvedValue({
    results: [
      {
        id: 1,
        name: "Sector Analyst",
        agent_type: "analyst",
        provider: "openai",
        model: "gpt-4o-mini",
        capabilities: ["analysis"],
        system_prompt: "sys",
        is_active: true,
      },
      {
        id: 2,
        name: "Screener Bot",
        agent_type: "screener",
        provider: "openai",
        model: "gpt-4o-mini",
        capabilities: ["screen"],
        system_prompt: "sys",
        is_active: false,
      },
    ],
  });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(EN);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Slice E — EN locale i18n (E-AC1/E-AC2/E-AC3)", () => {
  it("E-AC1: Usage table renders English headers, periods, pagination — no VI hardcode", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByText("AI Usage Analytics")).toBeTruthy();
    });

    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
    expect(screen.getByText("Tokens In")).toBeTruthy();
    expect(screen.getByText("Tokens Out")).toBeTruthy();
    expect(screen.getByText("Last 7 days")).toBeTruthy();
    expect(screen.getByText("Last 30 days")).toBeTruthy();
    expect(screen.getByText("Last 90 days")).toBeTruthy();
    expect(screen.getByText("← Previous")).toBeTruthy();
    expect(screen.getByText("Next →")).toBeTruthy();
    expect(screen.getByText("Page 1 / 1")).toBeTruthy();
    expect(screen.getByText("Show:")).toBeTruthy();

    const html = document.body.innerHTML;
    for (const hard of VI_HARDCODE) {
      expect(html.includes(hard)).toBe(false);
    }
  });

  it("E-AC3: Prompt drawer footer uses EN key — no VI sync sentence", async () => {
    await act(async () => {
      render(
        createElement(AIAdvisoryPromptConfigDrawer, {
          isOpen: true,
          onClose: () => {},
          onConfigChange: () => {},
          config: {},
        })
      );
    });
    const html = document.body.innerHTML;
    expect(
      html.includes(
        "Config syncs automatically and applies on the next refresh."
      )
    ).toBe(true);
    expect(html.includes("Cấu hình được đồng bộ tự động")).toBe(false);
  });
});
