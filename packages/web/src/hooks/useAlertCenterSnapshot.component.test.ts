import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAlertCenterSnapshot } from "./useAlertCenterSnapshot.js";

vi.mock("../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getAlertCenterFeed: vi.fn(),
  },
}));

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const mockFeed = coreApiAdapter as any;

const ok = (results: any[], next: string | null = null) => ({ results, next, previous: null });

// Hook này từng có cursor pagination (goToNextPage/goToPrevPage/hasNextPage/
// hasPrevPage/cursorHistory). Đã xoá ở Wave 2 vì không còn consumer — xem
// `useAlertCenterSnapshot.ts`. Test này bảo vệ phần CÒN LẠI.
describe("useAlertCenterSnapshot (không phân trang)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("không còn expose API phân trang", () => {
    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 5 }));
    expect(result.current).not.toHaveProperty("goToNextPage");
    expect(result.current).not.toHaveProperty("goToPrevPage");
    expect(result.current).not.toHaveProperty("hasNextPage");
    expect(result.current).not.toHaveProperty("hasPrevPage");
    expect(Object.keys(result.current).sort()).toEqual(["alerts", "error", "loadInitial", "loading"]);
  });

  it("loadInitial map đúng param xuống adapter", async () => {
    mockFeed.getAlertCenterFeed.mockResolvedValue(ok([{ id: "a" }]));
    const { result } = renderHook(() =>
      useAlertCenterSnapshot({ symbol: "VCB", severity: "critical", timeframe: "session", page_size: 40 })
    );
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(1));
    expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledWith({
      symbol: "VCB",
      severity: "critical",
      alert_family: undefined,
      session_date: undefined,
      timeframe: "session",
      page_size: 40,
    });
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("lỗi adapter → error + danh sách rỗng, không throw", async () => {
    mockFeed.getAlertCenterFeed.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 5 }));
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.alerts).toEqual([]);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("response thiếu `results` không làm vỡ", async () => {
    mockFeed.getAlertCenterFeed.mockResolvedValue({ next: null, previous: null });
    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 5 }));
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(result.current.alerts).toEqual([]));
    expect(result.current.error).toBeNull();
  });
});
