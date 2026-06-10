/**
 * TDM-C: Unit tests for measurement tools — priceRange, dateRange, barsCount
 */
import { describe, it, expect } from "vitest";
import PriceRange, { hitTestPriceRange } from "./priceRange";
import DateRange, { hitTestDateRange } from "./dateRange";
import BarsCount, { hitTestBarsCount } from "./barsCount";
// ── priceRange ──────────────────────────────────────────────────────────────
describe("PriceRange", () => {
    it("createDraft produces 2 points", () => {
        const draft = PriceRange.createDraft({ x: 100, y: 200 });
        expect(draft.points).toHaveLength(2);
        expect(draft.type).toBe("priceRange");
    });
    it("updateDraft moves second point", () => {
        const draft = PriceRange.createDraft({ x: 100, y: 200 });
        const updated = PriceRange.updateDraft(draft, { x: 150, y: 220 });
        expect(updated.points[1]).toEqual({ x: 150, y: 220 });
        expect(updated.points[0]).toEqual({ x: 100, y: 200 });
    });
    it("hitTest: hits top boundary line", () => {
        expect(hitTestPriceRange({ x: 0, y: 100 }, { x: 0, y: 200 }, { x: 50, y: 101 }, 5, 400)).toBe(true);
    });
    it("hitTest: hits bottom boundary line", () => {
        expect(hitTestPriceRange({ x: 0, y: 100 }, { x: 0, y: 200 }, { x: 50, y: 198 }, 5, 400)).toBe(true);
    });
    it("hitTest: hits interior band", () => {
        expect(hitTestPriceRange({ x: 0, y: 100 }, { x: 0, y: 200 }, { x: 200, y: 150 }, 5, 400)).toBe(true);
    });
    it("hitTest: misses outside vertically", () => {
        expect(hitTestPriceRange({ x: 0, y: 100 }, { x: 0, y: 200 }, { x: 200, y: 250 }, 5, 400)).toBe(false);
    });
});
// ── dateRange ──────────────────────────────────────────────────────────────
describe("DateRange", () => {
    it("createDraft produces 2 points", () => {
        const draft = DateRange.createDraft({ x: 50, y: 100 });
        expect(draft.points).toHaveLength(2);
        expect(draft.type).toBe("dateRange");
    });
    it("updateDraft moves second point", () => {
        const draft = DateRange.createDraft({ x: 50, y: 100 });
        const updated = DateRange.updateDraft(draft, { x: 150, y: 100 });
        expect(updated.points[1]?.x).toBe(150);
    });
    it("hitTest: hits left boundary", () => {
        expect(hitTestDateRange({ x: 100, y: 50 }, { x: 200, y: 50 }, { x: 101, y: 200 }, 5, 400)).toBe(true);
    });
    it("hitTest: hits right boundary", () => {
        expect(hitTestDateRange({ x: 100, y: 50 }, { x: 200, y: 50 }, { x: 199, y: 100 }, 5, 400)).toBe(true);
    });
    it("hitTest: hits interior band", () => {
        expect(hitTestDateRange({ x: 100, y: 50 }, { x: 200, y: 50 }, { x: 150, y: 100 }, 5, 400)).toBe(true);
    });
    it("hitTest: misses outside horizontally", () => {
        expect(hitTestDateRange({ x: 100, y: 50 }, { x: 200, y: 50 }, { x: 50, y: 100 }, 5, 400)).toBe(false);
    });
});
// ── barsCount ──────────────────────────────────────────────────────────────
describe("BarsCount", () => {
    it("createDraft produces 2 points", () => {
        const draft = BarsCount.createDraft({ x: 100, y: 100 });
        expect(draft.points).toHaveLength(2);
        expect(draft.type).toBe("barsCount");
    });
    it("updateDraft moves second point", () => {
        const draft = BarsCount.createDraft({ x: 100, y: 100 });
        const updated = BarsCount.updateDraft(draft, { x: 200, y: 100 });
        expect(updated.points[1]?.x).toBe(200);
    });
    it("hitTest: hits horizontal line", () => {
        const p0 = { x: 100, y: 150 };
        const p1 = { x: 200, y: 150 };
        expect(hitTestBarsCount(p0, p1, { x: 150, y: 151 }, 5)).toBe(true);
    });
    it("hitTest: hits anchor point", () => {
        const p0 = { x: 100, y: 150 };
        const p1 = { x: 200, y: 150 };
        expect(hitTestBarsCount(p0, p1, { x: 101, y: 151 }, 5)).toBe(true);
    });
    it("hitTest: misses far from line", () => {
        const p0 = { x: 100, y: 150 };
        const p1 = { x: 200, y: 150 };
        expect(hitTestBarsCount(p0, p1, { x: 150, y: 200 }, 5)).toBe(false);
    });
});
