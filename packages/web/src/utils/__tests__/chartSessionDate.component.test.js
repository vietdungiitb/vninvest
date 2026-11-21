import { describe, it, expect } from "vitest";
import { resolveSessionFromChartItem } from "../chartSessionDate.js";

describe("S2 — resolveSessionFromChartItem (phiên VN, guard invalid)", () => {
  it("AC1 — Date hợp lệ → tradeDate YYYY-MM-DD + timestamp gốc", () => {
    const at = new Date("2026-11-20T00:00:00Z"); // 07:00 VN 20/11
    expect(resolveSessionFromChartItem({ date: at })).toEqual({
      tradeDate: "2026-11-20",
      timestamp: at.getTime(),
    });
  });

  it("AC2 — biên timezone: 01:00 VN vẫn là ngày mới (local-UTC sẽ sai)", () => {
    // 2026-11-19T18:00:00Z = 20/11 01:00 VN. Code cũ dùng getFullYear/getMonth
    // trên máy UTC sẽ ra 19 (sai phiên); resolve đúng phải ra 20.
    expect(resolveSessionFromChartItem({ date: new Date("2026-11-19T18:00:00Z") })?.tradeDate).toBe(
      "2026-11-20",
    );
    // 23:00 VN vẫn là ngày cũ.
    expect(resolveSessionFromChartItem({ date: new Date("2026-11-19T16:00:00Z") })?.tradeDate).toBe(
      "2026-11-19",
    );
  });

  it("AC2b — chấp nhận date dạng string ISO", () => {
    expect(resolveSessionFromChartItem({ date: "2026-11-20T09:00:00+07:00" })?.tradeDate).toBe(
      "2026-11-20",
    );
  });

  it("AC1b — thiếu/invalid → null (không set session rác)", () => {
    expect(resolveSessionFromChartItem(undefined)).toBeNull();
    expect(resolveSessionFromChartItem(null)).toBeNull();
    expect(resolveSessionFromChartItem({})).toBeNull();
    expect(resolveSessionFromChartItem({ date: "khong-phai-date" })).toBeNull();
    expect(resolveSessionFromChartItem({ date: new Date("invalid") })).toBeNull();
  });
});
