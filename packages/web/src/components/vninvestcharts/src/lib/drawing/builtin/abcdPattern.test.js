import { describe, expect, it } from "vitest";
import { calculateAbcdPatternMetrics } from "./abcdPattern";
import { createDrawingObject } from "../shared";
function mockScales(yScale = (p) => p * 2) {
    return {
        xScale: (date) => date instanceof Date ? date.getTime() / 1000 : date,
        xScaleInvert: (px) => new Date(px * 1000),
        yScale,
        yScaleInvert: (px) => yScale(px),
    };
}
function makeAbcd(a, b, c, d) {
    const drawing = createDrawingObject("abcdPattern", [
        { x: 1, y: a },
        { x: 2, y: b },
        { x: 3, y: c },
        { x: 4, y: d },
    ]);
    return drawing;
}
describe("calculateAbcdPatternMetrics — DT-16-T01 price-based ratios", () => {
    it("returns null when fewer than 4 points", () => {
        const drawing = createDrawingObject("abcdPattern", [{ x: 1, y: 100 }]);
        expect(calculateAbcdPatternMetrics(drawing, mockScales())).toBeNull();
    });
    it("bcToAb is correct using price distances (not pixels)", () => {
        // A=100, B=61.8 → AB price = 38.2
        // C=76.4 → BC price = 14.6
        // bcToAb = 14.6 / 38.2 ≈ 0.382
        const drawing = makeAbcd(100, 61.8, 76.4, 38.2);
        const metrics = calculateAbcdPatternMetrics(drawing, mockScales());
        expect(metrics).not.toBeNull();
        expect(metrics.bcToAb).not.toBeNull();
        expect(metrics.bcToAb).toBeCloseTo(14.6 / 38.2, 3);
    });
    it("cdToBc is correct using price distances", () => {
        // A=100, B=61.8, C=76.4 → BC = 14.6
        // D=38.2 → CD = 38.2
        // cdToBc = 38.2 / 14.6 ≈ 2.616
        const drawing = makeAbcd(100, 61.8, 76.4, 38.2);
        const metrics = calculateAbcdPatternMetrics(drawing, mockScales());
        expect(metrics.cdToBc).not.toBeNull();
        expect(metrics.cdToBc).toBeCloseTo(38.2 / 14.6, 2);
    });
    it("bcToAb is NOT null even when B and C map to same pixel Y (same-height screen)", () => {
        // yScale maps everything to the SAME pixel (e.g. fully zoomed out so B and C collapse)
        // but price values are different — ratio should still be non-null
        const flatScale = (_p) => 100; // every price maps to pixel 100
        const drawing = makeAbcd(100, 61.8, 76.4, 38.2);
        const metrics = calculateAbcdPatternMetrics(drawing, mockScales(flatScale));
        // pixel distances are all 0, but price-based bcToAb should be valid
        expect(metrics).not.toBeNull();
        expect(metrics.bcToAb).not.toBeNull();
    });
    it("bcToAb returns null when price AB is effectively 0 (A === B)", () => {
        const drawing = makeAbcd(100, 100, 80, 60);
        const metrics = calculateAbcdPatternMetrics(drawing, mockScales());
        expect(metrics.bcToAb).toBeNull();
    });
    it("pixel-based ab/bc/cd reflect pixel heights (used for render)", () => {
        // yScale = p * 2, so pixel Y = price * 2
        // A=100→200px, B=50→100px: ab pixels = 100
        const drawing = makeAbcd(100, 50, 75, 25);
        const metrics = calculateAbcdPatternMetrics(drawing, mockScales((p) => p * 2));
        expect(metrics.ab).toBeCloseTo(100, 0); // |100*2 - 50*2| = 100
        expect(metrics.bc).toBeCloseTo(50, 0); // |75*2 - 50*2| = 50
    });
});
