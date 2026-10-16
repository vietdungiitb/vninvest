/**
 * R1.7 — useRetryableAsync: AbortController + requestId + cleanup.
 * Fail-before: AC1 (request sau bị nuốt) / AC2 (không abort) / AC3 (không cleanup)
 * / AC4 (Refresh gọi kép) RED. AC5 = consumer duy nhất (dashboard) qua hồi quy.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useRetryableAsync } from "../useRetryableAsync";

const HOOK = resolve(process.cwd(), "src/hooks/useRetryableAsync.ts");
const DASH = resolve(process.cwd(), "src/components/AIUsageDashboard.tsx");

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("R1.7: useRetryableAsync abort + requestId + cleanup", () => {
  it("AC1: 2 execute chồng nhau ⇒ kết quả CUỐI thắng (không bị nuốt)", async () => {
    const d1 = deferred<string>();
    const d2 = deferred<string>();
    const fn = vi
      .fn()
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);
    const { result } = renderHook(() => useRetryableAsync(fn, 0));
    let p1: Promise<void> | undefined;
    let p2: Promise<void> | undefined;
    await act(async () => {
      p1 = result.current.execute();
      p2 = result.current.execute();
    });
    expect(fn).toHaveBeenCalledTimes(2);
    await act(async () => {
      d1.resolve("stale");
    });
    await act(async () => {
      d2.resolve("fresh");
      await p1;
      await p2;
    });
    expect(result.current.data).toBe("fresh");
  });

  it("AC2: request cũ bị abort(), signal truyền vào fn", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    try {
      const d1 = deferred<string>();
      const d2 = deferred<string>();
      const fn = vi
        .fn()
        .mockImplementationOnce(() => d1.promise)
        .mockImplementationOnce(() => d2.promise);
      const { result } = renderHook(() => useRetryableAsync(fn, 0));
      await act(async () => {
        const p1 = result.current.execute();
        const p2 = result.current.execute();
        d1.resolve("stale");
        d2.resolve("fresh");
        await p1;
        await p2;
      });
      expect(abortSpy).toHaveBeenCalled();
      expect(fn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    } finally {
      abortSpy.mockRestore();
    }
  });

  it("AC3: unmount cleanup (mountedRef=false) + resolve sau unmount không crash", async () => {
    const src = readFileSync(HOOK, "utf8");
    expect(src.includes("mountedRef.current = false"), "thiếu cleanup unmount").toBe(true);
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result, unmount } = renderHook(() => useRetryableAsync(fn, 0));
      await act(async () => {
        const p = result.current.execute();
        unmount();
        d.resolve("late");
        await p;
      });
      expect(errSpy).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it("AC4: dashboard Refresh chỉ gọi loadData (không retryLoadData kẹp)", () => {
    const src = readFileSync(DASH, "utf8");
    expect(src.includes("retryLoadData"), "Refresh còn gọi kép").toBe(false);
  });

  it("AC-retry: retry khi lỗi vẫn hoạt động (fail 1 lần rồi thành công)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");
    const { result } = renderHook(() => useRetryableAsync(fn, 1));
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe("recovered");
    expect(result.current.retryCount).toBe(1);
  });
});
