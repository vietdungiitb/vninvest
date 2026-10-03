import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Render with the REAL translator (not the defaultValue mock) so raw-key
// regressions (UE-01/UE-02) fail here.
vi.mock("../../../context/LangContext.js", async () => {
  const { createTranslator } = await import("../../../i18n/index.js");
  const tr = createTranslator("vi");
  return {
    useI18n: () => ({
      t: (key: string, opts?: any) => tr(key, opts),
      formatNumber: (n: unknown) => String(n ?? ""),
    }),
  };
});

const mocks = vi.hoisted(() => ({
  getScreenerHistory: vi.fn(),
  getScreenerHistoryBacktest: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getScreenerHistory: (...args: any[]) => mocks.getScreenerHistory(...args),
    getScreenerHistoryBacktest: (...args: any[]) =>
      mocks.getScreenerHistoryBacktest(...args),
  },
}));

import { ScreenerFilterBuilder } from "../ScreenerFilterBuilder.js";
import { ScreenerHistory, actionBadge } from "../ScreenerHistory.js";
import { createTranslator } from "../../../i18n/index.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getScreenerHistory.mockResolvedValue({ results: [] });
});

describe("screener raw-key regressions (UE-01/UE-02)", () => {
  it("UE-01: logic dropdown shows translated labels, not raw keys", () => {
    render(
      createElement(ScreenerFilterBuilder, {
        conditions: [
          { field: "rsi_14", op: "lt", value: 30, logic: "AND" },
          { field: "sma20", op: "gt", value: 0, logic: "OR" },
        ],
        onChange: () => {},
      } as any)
    );
    // Translated labels present…
    expect(screen.getByText("Hoặc")).toBeTruthy();
    // …and no raw key leaks anywhere in the builder.
    expect(document.body.textContent).not.toContain("screener.logic.and");
    expect(document.body.textContent).not.toContain("screener.logic.or");
    expect(document.body.textContent).not.toContain("screener.fieldPicker");
  });

  it("UE-02: STAND_ASIDE badge shows translated label, not raw key", async () => {
    // actionBadge is only reachable with BUY/SELL through current UI paths,
    // so cover the latent STAND_ASIDE path directly (UE-02 audit finding).
    const tVi = createTranslator("vi");
    const el = actionBadge(tVi as any, "STAND_ASIDE") as any;
    expect(el.props.children).toBe("Đứng ngoài");

    // …and the History panel still renders end-to-end with the real translator.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ScreenerHistory, {
          runs: [
            {
              id: "local-1",
              ruleId: null,
              ruleName: "R1",
              timestamp: Date.now(),
              rows: [{ symbol: "VCI", close: 10, action: "BUY", score: 20 }],
            },
          ],
        } as any)
      )
    );
    await waitFor(() => expect(screen.getByText("Lịch sử quét & Win rate")).toBeTruthy());
    expect(document.body.textContent).not.toContain("screener.ai.stand_aside");
  });
});
