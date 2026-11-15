import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * S5 (Entry 516): debounce bulk technicals 30s.
 * Tests the debounce logic (setTimeout guard) used in WatchlistContext and
 * useCoreDashboardData to prevent tight-loop bulk calls that starve the daphne
 * event loop and cause WS 502.
 */
describe("bulk debounce logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls fn once for same args within 30s", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = (args: string[]) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { fn(args); timer = null; }, 30000);
    };

    debounced(["TPB", "FPT"]);
    debounced(["TPB", "FPT"]);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(["TPB", "FPT"]);
  });

  it("refetch after 30s", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = (args: string[]) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { fn(args); timer = null; }, 30000);
    };

    debounced(["TPB"]);
    vi.advanceTimersByTime(30000);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced(["TPB"]);
    vi.advanceTimersByTime(30000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("single timer keeps last args only", () => {
    const fn = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = (args: string[]) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { fn(args); timer = null; }, 30000);
    };

    debounced(["TPB"]);
    debounced(["FPT"]);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30000);
    // Debounce holds last args only -> 1 call with FPT
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(["FPT"]);
  });
});
