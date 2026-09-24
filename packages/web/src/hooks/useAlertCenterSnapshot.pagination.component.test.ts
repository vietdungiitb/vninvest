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

function mockResponse(results: any[], next: string | null) {
  return { results, next, previous: null };
}

describe("useAlertCenterSnapshot pagination (F06 verification)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("đi 3 trang rồi quay lại đúng thứ tự (không off-by-one)", async () => {
    // Trang 1: next=c2, Trang 2: next=c3, Trang 3: next=null
    mockFeed.getAlertCenterFeed
      .mockResolvedValueOnce(mockResponse([{ id: "1" }], "c2"))
      .mockResolvedValueOnce(mockResponse([{ id: "2" }], "c3"))
      .mockResolvedValueOnce(mockResponse([{ id: "3" }], null))
      .mockResolvedValueOnce(mockResponse([{ id: "2" }], "c3")) // quay về trang 2
      .mockResolvedValueOnce(mockResponse([{ id: "1" }], "c2")); // quay về trang 1

    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 1 }));

    // loadInitial -> trang 1
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(1));
    // cursor undefined sẽ bị filter khỏi query (market.js:53), nên call không có key cursor
    expect((mockFeed.getAlertCenterFeed.mock.calls[0] as any)[0].cursor).toBeUndefined();
    await waitFor(() => expect(result.current.hasPrevPage).toBe(false));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    // next -> trang 2 (cursor c2)
    act(() => {
      result.current.goToNextPage();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(2));
    expect(mockFeed.getAlertCenterFeed).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c2" }));
    await waitFor(() => expect(result.current.hasPrevPage).toBe(true));

    // next -> trang 3 (cursor c3)
    act(() => {
      result.current.goToNextPage();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(3));
    expect(mockFeed.getAlertCenterFeed).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c3" }));

    // prev -> trang 2 (cursor c2) — trace: history ["c2","c3"] -> pop -> ["c2"] -> fetch c2
    act(() => {
      result.current.goToPrevPage();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(4));
    expect(mockFeed.getAlertCenterFeed).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c2" }));

    // prev -> trang 1 (cursor undefined) — history ["c2"] -> pop -> [] -> fetch undefined
    act(() => {
      result.current.goToPrevPage();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(5));
    expect((mockFeed.getAlertCenterFeed.mock.calls[4] as any)[0].cursor).toBeUndefined();
    await waitFor(() => expect(result.current.hasPrevPage).toBe(false));
  });

  it("bóc token cursor từ next URL đầy đủ của BE (fix 404 Invalid cursor)", async () => {
    // BE trả next là URL đầy đủ (?cursor=...), hook phải gửi token trần
    mockFeed.getAlertCenterFeed
      .mockResolvedValueOnce(mockResponse([{ id: "1" }], "https://localhost/core/v1/signals/alert-center/feed?page_size=20&cursor=c2abc"))
      .mockResolvedValueOnce(mockResponse([{ id: "2" }], null));

    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 20 }));
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.goToNextPage();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(2));
    expect(mockFeed.getAlertCenterFeed).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c2abc" }));
  });

  it("không gọi fetch khi history rỗng", async () => {
    mockFeed.getAlertCenterFeed.mockResolvedValue(mockResponse([], null));
    const { result } = renderHook(() => useAlertCenterSnapshot({ page_size: 10 }));
    act(() => {
      result.current.loadInitial();
    });
    await waitFor(() => expect(mockFeed.getAlertCenterFeed).toHaveBeenCalledTimes(1));
    const callsBefore = mockFeed.getAlertCenterFeed.mock.calls.length;
    act(() => {
      result.current.goToPrevPage();
    });
    expect(mockFeed.getAlertCenterFeed.mock.calls.length).toBe(callsBefore);
  });
});
