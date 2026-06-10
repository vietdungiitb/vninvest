/**
 * harmonicRatioValidation.test.ts — Unit tests for harmonic ratio label computation.
 * GAP-11 / TASK-13
 */
import { describe, expect, it } from "vitest";
import { classifyHarmonicDeviation, computeHarmonicRatioLabels, formatHarmonicRatioLabel, } from "./harmonicRatioValidation";
function makeHarmonicDrawing(yPoints, targetRatios) {
    return {
        id: "test",
        type: "xabcdPattern",
        points: yPoints.map((y, i) => ({ x: i * 100, y })),
        style: { stroke: "#2962ff", strokeWidth: 1, opacity: 1 },
        harmonicRatios: {
            ratioLabels: targetRatios
                ? targetRatios.map((_, i) => `seg${i}`)
                : Array.from({ length: yPoints.length - 2 }, (_, i) => `seg${i}`),
            targetRatios,
        },
        createdAt: 0,
        updatedAt: 0,
    };
}
// ──────────────────────────────────────────────────────────────────────────────
// classifyHarmonicDeviation
// ──────────────────────────────────────────────────────────────────────────────
describe("classifyHarmonicDeviation", () => {
    it("HRV-T01: returns green for deviation ≤5%", () => {
        expect(classifyHarmonicDeviation(0, true)).toBe("#26a69a");
        expect(classifyHarmonicDeviation(4.9, true)).toBe("#26a69a");
        expect(classifyHarmonicDeviation(5, true)).toBe("#26a69a");
    });
    it("HRV-T02: returns yellow for 5% < deviation ≤ 15%", () => {
        expect(classifyHarmonicDeviation(5.1, true)).toBe("#ffb300");
        expect(classifyHarmonicDeviation(15, true)).toBe("#ffb300");
    });
    it("HRV-T03: returns red for deviation > 15%", () => {
        expect(classifyHarmonicDeviation(15.1, true)).toBe("#ef5350");
        expect(classifyHarmonicDeviation(100, true)).toBe("#ef5350");
    });
    it("HRV-T04: returns neutral grey when no target", () => {
        expect(classifyHarmonicDeviation(0, false)).toBe("#888888");
        expect(classifyHarmonicDeviation(50, false)).toBe("#888888");
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// computeHarmonicRatioLabels — no harmonicRatios
// ──────────────────────────────────────────────────────────────────────────────
describe("computeHarmonicRatioLabels — no config", () => {
    it("HRV-T05: returns empty array when harmonicRatios is undefined", () => {
        const drawing = {
            id: "x",
            type: "trendLine",
            points: [{ x: 0, y: 100 }, { x: 100, y: 200 }],
            style: { stroke: "#fff", strokeWidth: 1, opacity: 1 },
            createdAt: 0,
            updatedAt: 0,
        };
        expect(computeHarmonicRatioLabels(drawing)).toEqual([]);
    });
    it("HRV-T06: returns empty array when ratioLabels is empty", () => {
        const drawing = makeHarmonicDrawing([100, 200, 100]);
        drawing.harmonicRatios = { ratioLabels: [] };
        expect(computeHarmonicRatioLabels(drawing)).toEqual([]);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// computeHarmonicRatioLabels — actual ratio computation
// ──────────────────────────────────────────────────────────────────────────────
describe("computeHarmonicRatioLabels — ratio computation", () => {
    it("HRV-T07: computes correct ratio with no target (neutral color)", () => {
        // Legs: AB=100, BC=62.
        // BC/AB = 62/100 = 0.62
        const drawing = makeHarmonicDrawing([0, 100, 38]); // y: A=0, B=100, C=38 → |AB|=100, |BC|=62
        drawing.harmonicRatios = { ratioLabels: ["BC/AB"] }; // no targetRatios
        const labels = computeHarmonicRatioLabels(drawing);
        expect(labels).toHaveLength(1);
        expect(labels[0].segment).toBe("BC/AB");
        expect(labels[0].actual).toBeCloseTo(0.62, 2);
        expect(labels[0].target).toBeNull();
        expect(labels[0].color).toBe("#888888");
    });
    it("HRV-T08: computes deviation from target range center (within ±5%)", () => {
        // Legs: AB=100, BC=61.8 → ratio=0.618
        // Target range: [0.60, 0.64] → center=0.62
        // Deviation = |0.618 - 0.62| / 0.62 * 100 ≈ 0.32% → green
        const drawing = makeHarmonicDrawing([0, 100, 38.2]);
        drawing.harmonicRatios = {
            ratioLabels: ["BC/AB"],
            targetRatios: [[0.60, 0.64]],
        };
        const labels = computeHarmonicRatioLabels(drawing);
        expect(labels[0].target).toBeCloseTo(0.62, 2);
        expect(labels[0].deviationPct).toBeLessThan(5);
        expect(labels[0].color).toBe("#26a69a");
    });
    it("HRV-T09: returns yellow when deviation 5%–15%", () => {
        // Legs: AB=100, BC=55 → ratio=0.55
        // Target: [0.618, 0.618] → center=0.618
        // Deviation = |0.55-0.618|/0.618 * 100 ≈ 11% → yellow
        const drawing = makeHarmonicDrawing([0, 100, 45]);
        drawing.harmonicRatios = {
            ratioLabels: ["BC/AB"],
            targetRatios: [[0.618, 0.618]],
        };
        const labels = computeHarmonicRatioLabels(drawing);
        expect(labels[0].deviationPct).toBeGreaterThan(5);
        expect(labels[0].deviationPct).toBeLessThanOrEqual(15);
        expect(labels[0].color).toBe("#ffb300");
    });
    it("HRV-T10: returns red when deviation > 15%", () => {
        // Legs: AB=100, BC=30 → ratio=0.30
        // Target: [0.618, 0.618] → center=0.618
        // Deviation = |0.30-0.618|/0.618*100 ≈ 51.5% → red
        const drawing = makeHarmonicDrawing([0, 100, 70]);
        drawing.harmonicRatios = {
            ratioLabels: ["BC/AB"],
            targetRatios: [[0.618, 0.618]],
        };
        const labels = computeHarmonicRatioLabels(drawing);
        expect(labels[0].deviationPct).toBeGreaterThan(15);
        expect(labels[0].color).toBe("#ef5350");
    });
    it("HRV-T11: handles multiple ratio labels for 5-point pattern", () => {
        // Points: X=0, A=100, B=38.2, C=88.2, D=26.2
        // Legs: XA=100, AB=61.8, BC=50, CD=62
        // Ratios: AB/XA=0.618, BC/AB≈0.809, CD/BC≈1.24
        const drawing = makeHarmonicDrawing([0, 100, 38.2, 88.2, 26.2]);
        drawing.harmonicRatios = {
            ratioLabels: ["AB/XA", "BC/AB", "CD/BC"],
        };
        const labels = computeHarmonicRatioLabels(drawing);
        expect(labels).toHaveLength(3);
        expect(labels[0].segment).toBe("AB/XA");
        expect(labels[0].actual).toBeCloseTo(0.618, 2);
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// formatHarmonicRatioLabel
// ──────────────────────────────────────────────────────────────────────────────
describe("formatHarmonicRatioLabel", () => {
    it("HRV-T12: formats label without target", () => {
        const label = { segment: "BC/AB", actual: 0.618, target: null, deviationPct: 0, color: "#888" };
        expect(formatHarmonicRatioLabel(label)).toBe("BC/AB: 0.618");
    });
    it("HRV-T13: formats label with positive deviation", () => {
        const label = { segment: "BC/AB", actual: 0.65, target: 0.618, deviationPct: 5.18, color: "#26a69a" };
        const text = formatHarmonicRatioLabel(label);
        expect(text).toMatch(/BC\/AB: 0\.650/);
        expect(text).toMatch(/\+/); // positive deviation
    });
    it("HRV-T14: formats label with negative deviation", () => {
        const label = { segment: "CD/BC", actual: 0.50, target: 0.618, deviationPct: 19.1, color: "#ef5350" };
        const text = formatHarmonicRatioLabel(label);
        expect(text).toMatch(/CD\/BC: 0\.500/);
        expect(text).not.toMatch(/\+/); // negative deviation has no "+" sign
    });
});
