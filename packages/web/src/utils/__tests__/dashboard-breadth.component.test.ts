import { describe, it, expect } from "vitest";
import { calculateBreadth, formatRealtimeStatus } from "../dashboardBreadth.js";

describe("P2-4 — breadth & status", () => {
  it("change_value = 0 nhung change_pct = 2.1 van tinh UP", () => {
    const r = calculateBreadth({ VCB: { change_value: 0, change_pct: 2.1 } });
    expect(r).toEqual({ up: 1, down: 0, flat: 0 });
  });

  it("bo qua placeholder chua co gia", () => {
    expect(calculateBreadth({ VCB: {} })).toEqual({ up: 0, down: 0, flat: 0 });
  });

  it("am/dung duoc tinh dung", () => {
    expect(calculateBreadth({ A: { change_pct: -1 }, B: { change_value: 0, change_pct: 0 } }))
      .toEqual({ up: 0, down: 1, flat: 1 });
  });

  it("status enum duoc dich, khong nhill vao cau Viet", () => {
    expect(formatRealtimeStatus("connecting")).toBe("đang kết nối");
    expect(formatRealtimeStatus("idle")).toBe("đang chờ");
    expect(formatRealtimeStatus("live")).toBe("đồng bộ");
  });
});
