/**
 * segmentRegistry.test.ts — TASK-1 / GAP-1
 *
 * Verifies that hasSubSegments() returns true for the 12 new advanced/harmonic
 * types added to SEGMENT_KEYS_BY_TYPE and that legacy single-line tools still
 * return false (regression guard).
 */
import { describe, expect, it } from "vitest";
import { getSegmentKeys, hasSubSegments } from "./segmentRegistry";
// ── 12 new types (GAP-1) ──────────────────────────────────────────────────
describe("hasSubSegments — 12 new advanced types", () => {
    it("elliottDoubleCombo → true with 3 segment keys", () => {
        expect(hasSubSegments("elliottDoubleCombo")).toBe(true);
        expect(getSegmentKeys("elliottDoubleCombo")).toEqual(["wave-W", "wave-X", "wave-Y"]);
    });
    it("elliottTripleCombo → true with 5 segment keys", () => {
        expect(hasSubSegments("elliottTripleCombo")).toBe(true);
        expect(getSegmentKeys("elliottTripleCombo")).toEqual(["wave-W", "wave-X1", "wave-Y", "wave-X2", "wave-Z"]);
    });
    it("cypherPattern → true with 4 segment keys", () => {
        expect(hasSubSegments("cypherPattern")).toBe(true);
        expect(getSegmentKeys("cypherPattern")).toEqual(["XA", "AB", "BC", "XC"]);
    });
    it("headAndShoulders → true with 4 segment keys", () => {
        expect(hasSubSegments("headAndShoulders")).toBe(true);
        expect(getSegmentKeys("headAndShoulders")).toEqual(["leftShoulder", "neckline", "head", "rightShoulder"]);
    });
    it("trianglePattern → true with 2 segment keys", () => {
        expect(hasSubSegments("trianglePattern")).toBe(true);
        expect(getSegmentKeys("trianglePattern")).toEqual(["upper", "lower"]);
    });
    it("threeDrivesPattern → true with 3 segment keys", () => {
        expect(hasSubSegments("threeDrivesPattern")).toBe(true);
        expect(getSegmentKeys("threeDrivesPattern")).toEqual(["drive1", "drive2", "drive3"]);
    });
    it("pitchfan → true with 3 segment keys", () => {
        expect(hasSubSegments("pitchfan")).toBe(true);
        expect(getSegmentKeys("pitchfan")).toEqual(["median", "fan1", "fan2"]);
    });
    it("fibChannel → true with 2 segment keys", () => {
        expect(hasSubSegments("fibChannel")).toBe(true);
        expect(getSegmentKeys("fibChannel")).toEqual(["upper", "lower"]);
    });
    it("fibSpeedResistanceFan → true with 7 segment keys", () => {
        expect(hasSubSegments("fibSpeedResistanceFan")).toBe(true);
        expect(getSegmentKeys("fibSpeedResistanceFan")).toHaveLength(7);
    });
    it("gannBox → true with 3 segment keys", () => {
        expect(hasSubSegments("gannBox")).toBe(true);
        expect(getSegmentKeys("gannBox")).toEqual(["diagonal", "horizontal", "vertical"]);
    });
    it("gannSquare → true with 3 segment keys", () => {
        expect(hasSubSegments("gannSquare")).toBe(true);
        expect(getSegmentKeys("gannSquare")).toEqual(["diagonal", "horizontal", "vertical"]);
    });
    it("gannSquareFixed → true with 3 segment keys", () => {
        expect(hasSubSegments("gannSquareFixed")).toBe(true);
        expect(getSegmentKeys("gannSquareFixed")).toEqual(["diagonal", "horizontal", "vertical"]);
    });
});
// ── Regression guard: single-line tools must remain false ─────────────────
describe("hasSubSegments — single-line tools regression guard", () => {
    it("trendLine → false", () => {
        expect(hasSubSegments("trendLine")).toBe(false);
    });
    it("hLine → false", () => {
        expect(hasSubSegments("hLine")).toBe(false);
    });
    it("vLine → false", () => {
        expect(hasSubSegments("vLine")).toBe(false);
    });
    it("ray → false", () => {
        expect(hasSubSegments("ray")).toBe(false);
    });
    it("fibonacci → false", () => {
        expect(hasSubSegments("fibonacci")).toBe(false);
    });
});
// ── getSegmentKeys returns empty array for unknown / single-line type ──────
describe("getSegmentKeys — edge cases", () => {
    it("returns empty array for trendLine", () => {
        expect(getSegmentKeys("trendLine")).toEqual([]);
    });
    it("returns empty array for hLine", () => {
        expect(getSegmentKeys("hLine")).toEqual([]);
    });
});
