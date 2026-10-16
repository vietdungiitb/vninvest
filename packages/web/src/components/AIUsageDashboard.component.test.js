import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
// WAVE 11 / NAV-1 — `AIUsageDashboard` doc `useUrlState` → `useSearchParams` →
// `useLocation()` **throw** ngoai `<Router>`. `main.tsx:125` bo `BrowserRouter`
// quanh ca app nen day la moi truong san co, thieu trong test thoi.
import { MemoryRouter } from "react-router-dom";
import { AIUsageDashboard } from "./AIUsageDashboard";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const aggregate = {
  total_requests: 10,
  total_tokens_in: 100,
  total_tokens_out: 50,
  total_cost: "1.5",
  avg_latency: 200,
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
  vi.spyOn(coreApiAdapter, "getAIUsageAggregate").mockResolvedValue(aggregate);
  vi.spyOn(coreApiAdapter, "getAIUsageSummary").mockResolvedValue({
    results: [
      {
        date: "2024-01-01",
        action: "chat",
        total_requests: 1,
        total_tokens_in: 100,
        total_tokens_out: 50,
        total_cost: "0.01",
        avg_latency_ms: 200,
      },
    ],
  });
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
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AIUsageDashboard", () => {
  it("renders title and summary cards after load (Slice 3)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByText("aiUsageAnalytics.title")).toBeTruthy();
    });
    expect(screen.getByText("aiUsageAnalytics.totalRequests")).toBeTruthy();
    expect(coreApiAdapter.getAIUsageRecords).toHaveBeenCalled();
  });

  it("renders the table with no rows when there are no records (Slice 3)", async () => {
    coreApiAdapter.getAIUsageRecords.mockResolvedValue({ results: [], total: 0 });
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByText("aiUsageAnalytics.showing")).toBeTruthy();
    });
    expect(coreApiAdapter.getAIUsageRecords).toHaveBeenCalled();
  });

  it("exports CSV via a full fetch when the export button is clicked (Slice 3)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByText("aiUsageAnalytics.title")).toBeTruthy();
    });

    const callsBefore = coreApiAdapter.getAIUsageRecords.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText("aiUsageAnalytics.exportCsv"));
    });

    await waitFor(() => {
      expect(coreApiAdapter.getAIUsageRecords.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("passes model/status filter params to records API (F2)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByTestId("filter-model")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "success" } });
    });

    await waitFor(() => {
      const lastCall = coreApiAdapter.getAIUsageRecords.mock.calls.at(-1);
      expect(lastCall[0]).toMatchObject({ status: "success" });
    });
  });

  it("renders usage chart from summary API (F1)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByTestId("usage-chart")).toBeTruthy();
    });
    expect(coreApiAdapter.getAIUsageSummary).toHaveBeenCalled();
  });
  it("passes model/status filter params to summary + aggregate APIs (R1.5 AC6)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByTestId("filter-model")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "error" } });
    });

    await waitFor(() => {
      const lastSummary = coreApiAdapter.getAIUsageSummary.mock.calls.at(-1);
      expect(lastSummary[0]).toMatchObject({ status: "error" });
    });
    await waitFor(() => {
      const lastAgg = coreApiAdapter.getAIUsageAggregate.mock.calls.at(-1);
      expect(lastAgg[0]).toMatchObject({ status: "error" });
    });
  });

});
