import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createElement } from "react";
import { AIUsageDashboard } from "./AIUsageDashboard";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import * as LangContext from "../context/LangContext.js";

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
      render(createElement(AIUsageDashboard, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("usage.title")).toBeTruthy();
    });
    expect(screen.getByText("usage.requests")).toBeTruthy();
    expect(coreApiAdapter.getAIUsageRecords).toHaveBeenCalled();
  });

  it("renders the table with no rows when there are no records (Slice 3)", async () => {
    coreApiAdapter.getAIUsageRecords.mockResolvedValue({ results: [], total: 0 });
    await act(async () => {
      render(createElement(AIUsageDashboard, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("usage.showing")).toBeTruthy();
    });
    expect(coreApiAdapter.getAIUsageRecords).toHaveBeenCalled();
  });

  it("exports CSV via a full fetch when the export button is clicked (Slice 3)", async () => {
    await act(async () => {
      render(createElement(AIUsageDashboard, {}));
    });
    await waitFor(() => {
      expect(screen.getByText("usage.title")).toBeTruthy();
    });

    const callsBefore = coreApiAdapter.getAIUsageRecords.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText("usage.exportCsv"));
    });

    await waitFor(() => {
      expect(coreApiAdapter.getAIUsageRecords.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
