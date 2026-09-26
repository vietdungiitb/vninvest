import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  ADVISORY_FALLBACK_MAX_SYMBOLS,
  ADVISORY_STATUS_POLL_INTERVAL_MS,
  ADVISORY_STATUS_TIMEOUT_MS,
  loadAdvisoryFallback,
  normalizeAdvisoryItem,
  normalizeAdvisorySide,
  pollAdvisoryStatus,
  useWhaleAdvisoryData,
} from "./useWhaleAdvisoryData.js";

const mocks = vi.hoisted(() => ({
  getWhaleAdvisorySymbolStats: vi.fn(async () => ({ stats: [] })),
  getPortfolioHoldings: vi.fn(async () => ({ results: [] })),
  getTrackedSymbols: vi.fn(async () => ({ results: [] })),
  getWhaleAdvisories: vi.fn(async () => ({ items: [] })),
  getAdvisoryHistory: vi.fn(async () => ({ results: [] })),
  getAdvisoryStatus: vi.fn(async () => ({ status: "pending" })),
  getAdvisoryAutoRefreshInfo: vi.fn(async () => ({})),
  refreshAdvisory: vi.fn(async () => ({ advisory_id: "advisory-1" })),
  deleteCurrentWhaleAdvisory: vi.fn(async () => ({})),
}));

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: mocks,
}));

describe("S15 advisory status polling", () => {
  it("stops on generated without blind full-snapshot polls", async () => {
    const statuses = [
      { status: "pending" },
      { status: "generated", generated_at: "2026-09-25T10:00:00Z" },
    ];
    const getStatus = vi.fn(async () => statuses.shift());
    let now = 0;
    const result = await pollAdvisoryStatus({
      advisoryId: "advisory-1",
      getStatus,
      now: () => now,
      sleep: async (ms) => { now += ms; },
    });
    expect(result.status).toBe("generated");
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(ADVISORY_STATUS_POLL_INTERVAL_MS).toBe(4000);
    expect(ADVISORY_STATUS_TIMEOUT_MS).toBe(60000);
  });

  it("stops on failed and times out with no terminal state", async () => {
    const failed = await pollAdvisoryStatus({
      advisoryId: "advisory-1",
      getStatus: vi.fn(async () => ({ status: "failed" })),
      sleep: vi.fn(),
    });
    expect(failed.status).toBe("failed");

    let now = 0;
    const timeout = await pollAdvisoryStatus({
      advisoryId: "advisory-1",
      getStatus: vi.fn(async () => ({ status: "pending" })),
      now: () => now,
      sleep: async (ms) => { now += ms; },
      timeoutMs: 8000,
      intervalMs: 4000,
    });
    expect(timeout.status).toBe("timeout");
  });
});

describe("S15 bounded advisory fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caps canonical/history fan-out at 20 symbols", async () => {
    const symbols = Array.from({ length: 35 }, (_, index) => `S${index}`);
    const items = await loadAdvisoryFallback(symbols, {
      getAdvisoryHistory: vi.fn(async (symbol) => ({ results: [{ advisory_id: symbol, symbol, status: "generated" }] })),
    });
    expect(items).toHaveLength(ADVISORY_FALLBACK_MAX_SYMBOLS);
    expect(ADVISORY_FALLBACK_MAX_SYMBOLS).toBe(20);
  });

  it("uses live advisory history adapter", async () => {
    const getAdvisoryHistory = vi.fn(async () => ({ results: [{ advisory_id: "a1", symbol: "FPT", summary: "ok" }] }));
    const items = await loadAdvisoryFallback(["fpt"], { getAdvisoryHistory });
    expect(getAdvisoryHistory).toHaveBeenCalledWith("FPT", { page_size: 1 });
    expect(items[0].symbol).toBe("FPT");
  });
});

describe("S15 advisory contract mapping", () => {
  it("maps the real serializer contract (signal, confidence_score, matched_value)", () => {
    const item = normalizeAdvisoryItem({
      advisory_id: "a1",
      symbol: "FPT",
      signal: "SELL",
      confidence_score: 0.82,
      summary: "Giảm",
      structured_output: { signal: "SELL", matched_value: 91.5 },
    });
    expect(item.side).toBe("SELL");
    expect(item.confidence).toBe(82);
    expect(item.matched_value).toBe(91.5);
    expect(item.ai_summary).toBe("Giảm");
  });

  it("never invents a direction from missing or prose signals", () => {
    expect(normalizeAdvisorySide(undefined)).toBe("UNKNOWN");
    expect(normalizeAdvisorySide("nên tránh mua")).toBe("UNKNOWN");
    expect(normalizeAdvisorySide("")).toBe("UNKNOWN");
    expect(normalizeAdvisorySide("HOLD")).toBe("HOLD");
    expect(normalizeAdvisorySide("sell")).toBe("SELL");
    expect(normalizeAdvisoryItem({ symbol: "FPT" }).side).toBe("UNKNOWN");
  });
});

describe("S15 refresh uses targeted live route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refreshes then polls status and fetches snapshot once on generated", async () => {
    const { result } = renderHook(() => useWhaleAdvisoryData(false, false, { activePortfolioId: null }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mocks.refreshAdvisory.mockResolvedValueOnce({ advisory_id: "advisory-1" });
    mocks.getAdvisoryStatus
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "generated" });
    mocks.getWhaleAdvisories.mockResolvedValue({ items: [{ advisory_id: "advisory-1", symbol: "FPT", created_at: "2026-09-25T11:00:00Z" }] });

    await act(async () => {
      await result.current.handleRefreshAdvisory("FPT");
    });

    expect(mocks.refreshAdvisory).toHaveBeenCalledWith("FPT");
    expect(mocks.getAdvisoryStatus).toHaveBeenCalledWith("advisory-1");
    expect(result.current.rowMessages.FPT).toBe("Thành công");
  }, 30000);
});
