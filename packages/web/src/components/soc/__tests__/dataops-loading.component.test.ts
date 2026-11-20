import { describe, it, expect } from "vitest";
import { shouldShowDataOpsSkeleton } from "../dataopsLoading.js";

const loading = { inventory: true, runs: true, coverage: true };

describe("shouldShowDataOpsSkeleton — polling khong duoc flash skeleton", () => {
  it("chua co du lieu + dang loading => hien skeleton", () => {
    expect(shouldShowDataOpsSkeleton(null, loading)).toBe(true);
  });

  it("da co du lieu + dang loading (poll 15s) => GIU du lieu, khong skeleton", () => {
    expect(shouldShowDataOpsSkeleton({ summary: { total_rows: 4582503 } }, loading)).toBe(false);
  });

  it("da co du lieu + khong loading => khong skeleton", () => {
    expect(shouldShowDataOpsSkeleton({ summary: {} }, { inventory: false, runs: false, coverage: false })).toBe(false);
  });

  it("chua co du lieu + khong loading => khong skeleton", () => {
    expect(shouldShowDataOpsSkeleton(null, { inventory: false, runs: false, coverage: false })).toBe(false);
  });
});
