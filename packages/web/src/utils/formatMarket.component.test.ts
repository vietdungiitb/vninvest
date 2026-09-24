import { describe, it, expect } from "vitest";
import {
  formatVNDCompact,
  formatFullVND,
  formatSessionDate,
  formatUpdateTime,
  signOf,
} from "./formatMarket.js";

describe("formatMarket (L7 — vi-VN dùng chung)", () => {
  it("compact tỷ dùng dấu phẩy VI", () => {
    expect(formatVNDCompact(1523938140)).toBe("1,5 tỷ ₫");
  });
  it("compact triệu dùng dấu phẩy VI", () => {
    expect(formatVNDCompact(660489030)).toBe("660,5 triệu ₫");
  });
  it("compact nghìn", () => {
    expect(formatVNDCompact(55000)).toBe("55 nghìn ₫");
  });
  it("compact số nhỏ giữ nguyên", () => {
    expect(formatVNDCompact(900)).toBe("900 ₫");
  });
  it("compact null/NaN → —", () => {
    expect(formatVNDCompact(null)).toBe("—");
    expect(formatVNDCompact(Number.NaN)).toBe("—");
    expect(formatVNDCompact(undefined)).toBe("—");
  });
  it("compact số âm giữ dấu", () => {
    expect(formatVNDCompact(-1500000000)).toBe("-1,5 tỷ ₫");
  });
  it("full tooltip số đầy đủ", () => {
    expect(formatFullVND(1523938140)).toBe("1.523.938.140 ₫");
  });
  it("full null → —", () => {
    expect(formatFullVND(null)).toBe("—");
  });
  it("session date dd/MM/yyyy", () => {
    expect(formatSessionDate("2026-09-21")).toBe("21/09/2026");
  });
  it("session date invalid → —", () => {
    expect(formatSessionDate("not-a-date")).toBe("—");
  });
  it("update time HH:mm", () => {
    expect(formatUpdateTime("2026-09-21T15:04:00")).toMatch(/^\d{2}:\d{2}$/);
  });
  it("signOf: 0 trung tính", () => {
    expect(signOf(0)).toBe(0);
    expect(signOf("0")).toBe(0);
    expect(signOf(null)).toBe(0);
    expect(signOf(Number.NaN)).toBe(0);
  });
  it("signOf: dương/âm", () => {
    expect(signOf(0.01)).toBe(1);
    expect(signOf(-3)).toBe(-1);
  });
});
