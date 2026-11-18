import { describe, it, expect, vi } from "vitest";
import { resizeEChart } from "../useChartResize.js";

describe("P2-1 — resize ECharts that qua ReactEChartsCore ref", () => {
  it("goi getEchartsInstance().resize()", () => {
    const resize = vi.fn();
    const ref = { current: { getEchartsInstance: () => ({ resize }) } };
    resizeEChart(ref);
    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("fallback khi khong co ECharts instance", () => {
    expect(() => resizeEChart({ current: {} })).not.toThrow();
    expect(() => resizeEChart({ current: null })).not.toThrow();
  });
});
