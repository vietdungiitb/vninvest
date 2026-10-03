import { describe, it, expect } from "vitest";
import {
  formatVNDCompact,
  formatFullVND,
  formatSessionDate,
  formatUpdateTime,
  signOf,
  formatTimeAgo,
} from "./formatMarket.js";

describe("formatMarket (L7 — vi-VN dùng chung)", () => {
  it("compact tỷ dùng dấu phẩy VI — 1,5 tỷ", () => {
    expect(formatVNDCompact(1523938140)).toBe("1,5 tỷ ₫");
  });
  it("compact tỷ dấu phẩy — 1 tỷ tròn", () => {
    expect(formatVNDCompact(1000000000)).toBe("1 tỷ ₫");
  });
  it("compact triệu dùng dấu phẩy VI — 660,5 triệu", () => {
    expect(formatVNDCompact(660489030)).toBe("660,5 triệu ₫");
  });
  it("compact triệu 12,3 triệu", () => {
    expect(formatVNDCompact(12345678)).toBe("12,3 triệu ₫");
  });
  it("compact nghìn", () => {
    expect(formatVNDCompact(55000)).toBe("55 nghìn ₫");
  });
  it("compact số nhỏ giữ nguyên + ₫", () => {
    expect(formatVNDCompact(900)).toBe("900 ₫");
  });
  it("compact null/NaN/undefined → —", () => {
    expect(formatVNDCompact(null)).toBe("—");
    expect(formatVNDCompact(Number.NaN)).toBe("—");
    expect(formatVNDCompact(undefined)).toBe("—");
  });
  it("compact số âm giữ dấu phẩy", () => {
    expect(formatVNDCompact(-1500000000)).toBe("-1,5 tỷ ₫");
    expect(formatVNDCompact(-660489030)).toBe("-660,5 triệu ₫");
  });
  it("full tooltip số đầy đủ vi-VN (1.523.938.140 ₫)", () => {
    expect(formatFullVND(1523938140)).toBe("1.523.938.140 ₫");
    expect(formatFullVND(660489030)).toBe("660.489.030 ₫");
  });
  it("full tooltip zero và null", () => {
    expect(formatFullVND(0)).toBe("0 ₫");
    expect(formatFullVND(null)).toBe("—");
  });
  it("session date dd/MM/yyyy — 21/09/2026", () => {
    expect(formatSessionDate("2026-09-21")).toBe("21/09/2026");
  });
  it("session date dd/MM/yyyy — 14/12/2024 stale-artifact pattern", () => {
    expect(formatSessionDate("2024-12-14")).toBe("14/12/2024");
    expect(formatSessionDate("2024-12-14T00:00:00Z")).toMatch(/14\/12\/2024/);
  });
  it("session date invalid → —", () => {
    expect(formatSessionDate("not-a-date")).toBe("—");
    expect(formatSessionDate("")).toBeTruthy(); // defaults to today, not —
  });
  it("update time HH:mm vi-VN", () => {
    expect(formatUpdateTime("2026-09-21T15:04:00")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatUpdateTime("2026-09-21T09:05:00")).toMatch(/^\d{2}:\d{2}$/);
  });
  it("formatTimeAgo — vừa xong / phút trước", () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe("Vừa xong");
    expect(formatTimeAgo(new Date(Date.now() - 2 * 60000).toISOString())).toBe("2 phút trước");
  });
  it("signOf: 0 trung tính (audit #10 pill xám)", () => {
    expect(signOf(0)).toBe(0);
    expect(signOf("0")).toBe(0);
    expect(signOf(null)).toBe(0);
    expect(signOf(Number.NaN)).toBe(0);
  });
  it("signOf: dương/âm", () => {
    expect(signOf(0.01)).toBe(1);
    expect(signOf(-0.01)).toBe(-1);
    expect(signOf(123)).toBe(1);
    expect(signOf(-3)).toBe(-1);
  });
});
