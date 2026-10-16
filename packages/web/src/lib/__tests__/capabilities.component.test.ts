/**
 * R1.11 AC3 — parseCapabilities("a, b ,,c") → ["a","b","c"].
 */
import { describe, it, expect } from "vitest";
import { parseCapabilities, formatCapabilities } from "../capabilities";

describe("R1.11 AC3: parseCapabilities", () => {
  it('chuỗi "a, b ,,c" → ["a","b","c"]', () => {
    expect(parseCapabilities("a, b ,,c")).toEqual(["a", "b", "c"]);
  });

  it("rỗng / thiếu → []", () => {
    expect(parseCapabilities("")).toEqual([]);
    expect(parseCapabilities("   ")).toEqual([]);
    expect(parseCapabilities(null)).toEqual([]);
    expect(parseCapabilities(undefined)).toEqual([]);
    expect(parseCapabilities(42)).toEqual([]);
  });

  it("mảng vào → trim + bỏ rỗng", () => {
    expect(parseCapabilities([" a ", "", "b"])).toEqual(["a", "b"]);
  });

  it("formatCapabilities nối lại", () => {
    expect(formatCapabilities(["a", "b"])).toBe("a, b");
    expect(formatCapabilities("a,,b")).toBe("a, b");
  });
});
