import { describe, expect, it } from "vitest";
import { collectFibLevelSnapCandidates, findSnapPoint, MAGNET_TOLERANCE } from "./snap";
function makeScales() {
    const xScale = Object.assign((value) => value * 10, { invert: (pixel) => pixel / 10 });
    const yScale = Object.assign((value) => 400 - value * 4, { invert: (pixel) => (400 - pixel) / 4 });
    return {
        xScale,
        xScaleInvert: xScale.invert,
        yScale,
        yScaleInvert: yScale.invert,
        xAccessor: (datum) => datum.date,
        plotData: [],
    };
}
function makeTrendLine() {
    return {
        id: "snap-trend",
        type: "trendLine",
        points: [
            { x: 5, y: 50 },
            { x: 6, y: 51 },
        ],
        style: {
            stroke: "#2962ff",
            strokeWidth: 2,
        },
        visible: true,
    };
}
describe("drawing snap bridge", () => {
    it("keeps magnet tolerance levels in sync with core exports", () => {
        expect(MAGNET_TOLERANCE.weak).toBe(5);
        expect(MAGNET_TOLERANCE.normal).toBe(10);
        expect(MAGNET_TOLERANCE.strong).toBe(20);
    });
    it("findSnapPoint resolves endpoint snaps without needing OHLC data", () => {
        const scales = makeScales();
        const drawing = makeTrendLine();
        const snap = findSnapPoint(50, 200, scales, [], [drawing], 8);
        expect(snap).toMatchObject({
            chartPoint: { x: 5, y: 50 },
            snapType: "endpoint",
        });
    });
});
function makeFibScales() {
    const xScale = Object.assign((v) => v, { invert: (px) => px });
    const yScale = Object.assign((v) => 400 - v * 4, { invert: (px) => (400 - px) / 4 });
    return {
        xScale,
        xScaleInvert: (px) => new Date(px),
        yScale,
        yScaleInvert: yScale.invert,
        xAccessor: (datum) => datum.date,
        plotData: [],
    };
}
function makeFibDrawing() {
    return {
        id: "fib-snap",
        type: "fibonacci",
        points: [
            { x: 1000, y: 100 }, // high
            { x: 2000, y: 50 }, // low
        ],
        style: { stroke: "#f00", strokeWidth: 1 },
        visible: true,
        fibLevelConfigs: [
            { ratio: 0, visible: true }, // price = 100
            { ratio: 0.382, visible: true }, // price ≈ 80.9
            { ratio: 0.5, visible: false }, // hidden — price = 75
            { ratio: 1, visible: true }, // price = 50
        ],
    };
}
describe("GAP-7: Fibonacci level snap", () => {
    it("GAP7-T01: collectFibLevelSnapCandidates returns only visible fib level prices", () => {
        const drawing = makeFibDrawing();
        const candidates = collectFibLevelSnapCandidates([drawing]);
        // 3 visible levels (ratio 0, 0.382, 1); ratio 0.5 is hidden
        expect(candidates).toHaveLength(3);
        expect(candidates.map((c) => c.price)).toContain(100);
        expect(candidates.map((c) => c.price)).toContain(50);
    });
    it("GAP7-T02: collectFibLevelSnapCandidates skips hidden fib levels", () => {
        const drawing = makeFibDrawing();
        const candidates = collectFibLevelSnapCandidates([drawing]);
        // ratio 0.5 is hidden → price 75 should NOT be a snap candidate
        const price75 = 100 + (50 - 100) * 0.5;
        expect(candidates.map((c) => c.price)).not.toContain(price75);
    });
    it("GAP7-T03: findSnapPoint returns fib snap when near fib level with no OHLC bar", () => {
        const scales = makeFibScales();
        const drawing = makeFibDrawing();
        // price 100 → pixelY = 400 - 100*4 = 0; mouseY = 2 (within tolerance 8)
        const snap = findSnapPoint(50, 2, scales, [], [drawing], 8);
        expect(snap).not.toBeNull();
        expect(snap.snapType).toBe("fib");
        expect(snap.chartPoint.y).toBeCloseTo(100, 5);
    });
});
