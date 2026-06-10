import { describe, it, expect } from "vitest";
import { HIT_TOLERANCE, hitTestDrawing } from "./hitTest";
const STATIC_NOW = 1716000000000;
// Minimal scales for a 800×400 canvas
function makeScales() {
    const now = STATIC_NOW;
    // xScale maps [now, now+100] → [0, 800]
    const xScale = Object.assign((v) => ((v - now) / 100) * 800, { invert: (px) => now + (px / 800) * 100 });
    // yScale maps [0, 100] → [400, 0] (inverted — price 0 is at bottom)
    const yScale = Object.assign((v) => 400 - v * 4, { invert: (px) => (400 - px) / 4 });
    return {
        xScale,
        xScaleInvert: xScale.invert,
        yScale,
        yScaleInvert: yScale.invert,
        xAccessor: (d) => d.date,
        plotData: [],
    };
}
function makeTrendLine(x1Date, y1, x2Date, y2) {
    return {
        id: "test-tl",
        type: "trendLine",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeHLine(xDate, y) {
    return {
        id: "test-hl",
        type: "hLine",
        points: [{ x: xDate, y }],
        style: {},
        visible: true,
    };
}
function makeVLine(xDate, y) {
    return {
        id: "test-vl",
        type: "vLine",
        points: [{ x: xDate, y }, { x: xDate + 10, y }],
        style: {},
        visible: true,
    };
}
function makeRectangle(x1Date, y1, x2Date, y2) {
    return {
        id: "test-rect",
        type: "rectangle",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeText(xDate, y, text = "Hello") {
    return {
        id: "test-text",
        type: "text",
        points: [{ x: xDate, y }],
        style: { fontSize: 12, stroke: "#2962ff", strokeWidth: 1 },
        text,
        visible: true,
    };
}
function makeRay(x1Date, y1, x2Date, y2) {
    return {
        id: "test-ray",
        type: "ray",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeExtendedLine(x1Date, y1, x2Date, y2) {
    return {
        id: "test-extended-line",
        type: "extendedLine",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makePolyline(points) {
    return {
        id: "test-polyline",
        type: "polyline",
        points,
        style: {},
        visible: true,
    };
}
function makeDateAndPriceRange(x1Date, y1, x2Date, y2) {
    return {
        id: "test-date-and-price-range",
        type: "dateAndPriceRange",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeCircle(centerDate, centerY, edgeDate, edgeY, filled = false) {
    return {
        id: "test-circle",
        type: "circle",
        points: [
            { x: centerDate, y: centerY },
            { x: edgeDate, y: edgeY },
        ],
        style: filled ? { fill: "rgba(41,98,255,0.2)" } : {},
        visible: true,
    };
}
function makeEllipse(x1Date, y1, x2Date, y2, filled = false) {
    return {
        id: "test-ellipse",
        type: "ellipse",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: filled ? { fill: "rgba(41,98,255,0.2)" } : {},
        visible: true,
    };
}
function makeTriangle(points) {
    return {
        id: "test-triangle",
        type: "triangle",
        points,
        style: {},
        visible: true,
    };
}
function makeCallout(points, text = "Label") {
    return {
        id: "test-callout",
        type: "callout",
        points,
        text,
        style: { fontSize: 12 },
        visible: true,
    };
}
function makePriceLabel(xDate, y, text = "Price") {
    return {
        id: "test-price-label",
        type: "priceLabel",
        points: [{ x: xDate, y }],
        text,
        style: { fontSize: 11 },
        visible: true,
    };
}
function makePriceRange(x1Date, y1, x2Date, y2) {
    return {
        id: "test-price-range",
        type: "priceRange",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeDateRange(x1Date, y1, x2Date, y2) {
    return {
        id: "test-date-range",
        type: "dateRange",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: {},
        visible: true,
    };
}
function makeBarsCount(x1Date, y1, x2Date, y2, text = "12") {
    return {
        id: "test-bars-count",
        type: "barsCount",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        text,
        style: {},
        visible: true,
    };
}
function makeFibonacci(x1Date, y1, x2Date, y2, fibLevels = [0.5]) {
    return {
        id: "test-fibonacci",
        type: "fibonacci",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        fibLevels,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibExtension(x1Date, y1, x2Date, y2, fibLevels = [1]) {
    return {
        id: "test-fib-extension",
        type: "fibExtension",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        fibLevels,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibArc(x1Date, y1, x2Date, y2, fibLevels = [0.382]) {
    return {
        id: "test-fib-arc",
        type: "fibArc",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        fibLevels,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibTimeZone(x1Date, y1, x2Date, y2, fibLevels = [1, 2]) {
    return {
        id: "test-fib-time-zone",
        type: "fibTimeZone",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        fibLevels,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibCircles(x1Date, y1, x2Date, y2) {
    return {
        id: "test-fib-circles",
        type: "fibCircles",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibSpeedResistanceArcs(x1Date, y1, x2Date, y2) {
    return {
        id: "test-fib-speed-arcs",
        type: "fibSpeedResistanceArcs",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibSpiral(x1Date, y1, x2Date, y2) {
    return {
        id: "test-fib-spiral",
        type: "fibSpiral",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibSpeedResistanceFan(x1Date, y1, x2Date, y2) {
    return {
        id: "test-fib-speed-fan",
        type: "fibSpeedResistanceFan",
        points: [
            { x: x1Date, y: y1 },
            { x: x2Date, y: y2 },
        ],
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibChannel(points) {
    return {
        id: "test-fib-channel",
        type: "fibChannel",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeTrendBasedFibTime(points) {
    return {
        id: "test-trend-fib-time",
        type: "trendBasedFibTime",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeFibWedge(points) {
    return {
        id: "test-fib-wedge",
        type: "fibWedge",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makePitchfan(points) {
    return {
        id: "test-pitchfan",
        type: "pitchfan",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeChannel(points) {
    return {
        id: "test-channel",
        type: "channel",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeParallelChannel(points) {
    return {
        id: "test-parallel-channel",
        type: "parallelChannel",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makePitchfork(points) {
    return {
        id: "test-pitchfork",
        type: "pitchfork",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeRegressionChannel(points) {
    return {
        id: "test-regression-channel",
        type: "regressionChannel",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeAbcdPattern(points) {
    return {
        id: "test-abcd-pattern",
        type: "abcdPattern",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeXabcdPattern(points) {
    return {
        id: "test-xabcd-pattern",
        type: "xabcdPattern",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1, fill: "transparent" },
        visible: true,
    };
}
function makeHeadAndShoulders(points) {
    return {
        id: "test-head-shoulders",
        type: "headAndShoulders",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeElliottImpulse(points) {
    return {
        id: "test-elliott-impulse",
        type: "elliottImpulse",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeElliottCorrection(points, waveLabels) {
    return {
        id: "test-elliott-correction",
        type: "elliottCorrection",
        points,
        waveLabels,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeGannFan(points) {
    return {
        id: "test-gann-fan",
        type: "gannFan",
        points,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeGannSquareFixed(points, gannSquareSize = 20) {
    return {
        id: "test-gann-square-fixed",
        type: "gannSquareFixed",
        points,
        gannSquareSize,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeLongPosition(points, riskReward) {
    return {
        id: "test-long-position",
        type: "longPosition",
        points,
        riskReward,
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
function makeCyclicLines(points, count = 4) {
    return {
        id: "test-cyclic-lines",
        type: "cyclicLines",
        points,
        cycleParams: { count },
        style: { stroke: "#2962ff", strokeWidth: 1 },
        visible: true,
    };
}
// ----------------------------------------------------------------
// HIT_TOLERANCE constants
// ----------------------------------------------------------------
describe("HIT_TOLERANCE", () => {
    it("mouse tolerance is 6", () => {
        expect(HIT_TOLERANCE.mouse).toBe(6);
    });
    it("touch tolerance is 16", () => {
        expect(HIT_TOLERANCE.touch).toBe(16);
    });
    it("pen tolerance is 8", () => {
        expect(HIT_TOLERANCE.pen).toBe(8);
    });
    it("touch tolerance is greater than mouse tolerance", () => {
        expect(HIT_TOLERANCE.touch).toBeGreaterThan(HIT_TOLERANCE.mouse);
    });
});
// ----------------------------------------------------------------
// hitTestDrawing — tolerance dispatch
// ----------------------------------------------------------------
describe("hitTestDrawing tolerance dispatch", () => {
    const now = STATIC_NOW;
    const scales = makeScales();
    // Vertical trendline at x=now, y from 50→50 (horizontal → pixel Y = 400 - 50*4 = 200)
    // Pixel: start = (0, 200), end = (400, 200) (x=now+50 maps to px 400)
    const drawing = makeTrendLine(now, 50, now + 50, 50);
    const options = { chartWidth: 800, chartHeight: 400 };
    it("hit with default (mouse) tolerance at 4px away returns true", () => {
        // Point at pixel (200, 204) — 4px below the line, within mouse tolerance (6)
        const mouseX = 200;
        const mouseY = 204;
        expect(hitTestDrawing(drawing, mouseX, mouseY, scales, options)).toBe(true);
    });
    it("miss with default (mouse) tolerance at 8px away returns false", () => {
        // 8px away — outside mouse tolerance (6)
        expect(hitTestDrawing(drawing, 200, 208, scales, options)).toBe(false);
    });
    it("hit with touch tolerance at 14px away returns true", () => {
        // 14px below line — within touch tolerance (16)
        expect(hitTestDrawing(drawing, 200, 214, scales, options, "touch")).toBe(true);
    });
    it("miss with touch tolerance at 18px away returns false", () => {
        // 18px — outside touch tolerance (16)
        expect(hitTestDrawing(drawing, 200, 218, scales, options, "touch")).toBe(false);
    });
    it("hit with pen tolerance at 7px away returns true", () => {
        // 7px — within pen tolerance (8)
        expect(hitTestDrawing(drawing, 200, 207, scales, options, "pen")).toBe(true);
    });
    it("backward-compat: numeric tolerance argument still works", () => {
        // Pass numeric 12 directly
        expect(hitTestDrawing(drawing, 200, 211, scales, options, 12)).toBe(true);
        expect(hitTestDrawing(drawing, 200, 213, scales, options, 12)).toBe(false);
    });
    it("bridge: hLine hits through engine-core overlay hit-test", () => {
        const hLine = makeHLine(now, 50);
        expect(hitTestDrawing(hLine, 200, 204, scales, options)).toBe(true);
        expect(hitTestDrawing(hLine, 200, 220, scales, options)).toBe(false);
    });
    it("bridge: vLine hits through engine-core overlay hit-test", () => {
        const vLine = makeVLine(now, 50);
        expect(hitTestDrawing(vLine, 4, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(vLine, 30, 200, scales, options)).toBe(false);
    });
    it("bridge: rectangle and text hit through engine-core overlay hit-test", () => {
        const rectangle = makeRectangle(now, 40, now + 40, 60);
        const text = makeText(now + 25, 60, "Hello");
        expect(hitTestDrawing(rectangle, 160, 160, scales, options)).toBe(true);
        expect(hitTestDrawing(rectangle, 20, 20, scales, options)).toBe(false);
        expect(hitTestDrawing(text, 200, 160, scales, options)).toBe(true);
        expect(hitTestDrawing(text, 260, 160, scales, options)).toBe(false);
    });
    it("bridge: ray, extendedLine, polyline, and dateAndPriceRange hit through engine-core overlay hit-test", () => {
        const ray = makeRay(now, 50, now + 10, 50);
        const extendedLine = makeExtendedLine(now + 20, 40, now + 40, 40);
        const polyline = makePolyline([
            { x: now, y: 60 },
            { x: now + 30, y: 70 },
            { x: now + 50, y: 60 },
        ]);
        const range = makeDateAndPriceRange(now + 10, 40, now + 40, 60);
        expect(hitTestDrawing(ray, 700, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(extendedLine, 20, 240, scales, options)).toBe(true);
        expect(hitTestDrawing(polyline, 320, 140, scales, options)).toBe(true);
        expect(hitTestDrawing(range, 200, 160, scales, options)).toBe(true);
    });
    it("bridge: circle, ellipse, triangle, and callout hit through engine-core overlay hit-test", () => {
        const circle = makeCircle(now + 25, 50, now + 35, 50);
        const ellipse = makeEllipse(now + 10, 40, now + 40, 60, true);
        const triangle = makeTriangle([
            { x: now + 10, y: 40 },
            { x: now + 40, y: 40 },
            { x: now + 25, y: 60 },
        ]);
        const callout = makeCallout([
            { x: now + 25, y: 50 },
            { x: now + 35, y: 65 },
        ]);
        expect(hitTestDrawing(circle, 280, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(ellipse, 200, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(triangle, 200, 190, scales, options)).toBe(true);
        expect(hitTestDrawing(callout, 200, 200, scales, options)).toBe(true);
    });
    it("bridge: priceLabel, priceRange, dateRange, and barsCount hit through engine-core overlay hit-test", () => {
        const priceLabel = makePriceLabel(now + 25, 50);
        const priceRange = makePriceRange(now + 10, 40, now + 40, 60);
        const dateRange = makeDateRange(now + 10, 40, now + 40, 60);
        const barsCount = makeBarsCount(now + 10, 40, now + 40, 60);
        expect(hitTestDrawing(priceLabel, 770, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(priceRange, 200, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(dateRange, 200, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(barsCount, 200, 200, scales, options)).toBe(true);
    });
    it("bridge: fibonacci, fibExtension, fibArc, and fibTimeZone hit through engine-core overlay hit-test", () => {
        const fibonacci = makeFibonacci(now + 10, 20, now + 40, 60);
        const fibExtension = makeFibExtension(now + 10, 20, now + 40, 60, [0.5]);
        const fibArc = makeFibArc(now + 20, 20, now + 35, 50);
        const fibTimeZone = makeFibTimeZone(now + 10, 40, now + 20, 40);
        expect(hitTestDrawing(fibonacci, 200, 240, scales, options)).toBe(true);
        expect(hitTestDrawing(fibExtension, 200, 80, scales, options)).toBe(true);
        expect(hitTestDrawing(fibArc, 225, 320, scales, options)).toBe(true);
        expect(hitTestDrawing(fibTimeZone, 160, 120, scales, options)).toBe(true);
    });
    it("bridge: fibExtended family hits through engine-core overlay hit-test", () => {
        const fibCircles = makeFibCircles(now + 20, 50, now + 30, 50);
        const fibSpeedResistanceArcs = makeFibSpeedResistanceArcs(now + 20, 50, now + 30, 50);
        const fibSpiral = makeFibSpiral(now + 20, 50, now + 30, 40);
        const fibSpeedResistanceFan = makeFibSpeedResistanceFan(now + 20, 25, now + 30, 50);
        const fibChannel = makeFibChannel([{ x: now + 20, y: 25 }, { x: now + 30, y: 25 }, { x: now + 20, y: 50 }]);
        const trendBasedFibTime = makeTrendBasedFibTime([{ x: now + 20, y: 40 }, { x: now + 30, y: 40 }, { x: now + 30, y: 40 }]);
        const fibWedge = makeFibWedge([{ x: now + 20, y: 20 }, { x: now + 30, y: 20 }, { x: now + 25, y: 50 }]);
        const pitchfan = makePitchfan([{ x: now + 20, y: 20 }, { x: now + 30, y: 20 }, { x: now + 40, y: 50 }]);
        expect(hitTestDrawing(fibCircles, 179, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(fibSpeedResistanceArcs, 160, 181, scales, options)).toBe(true);
        expect(hitTestDrawing(fibSpiral, 143, 191, scales, options)).toBe(true);
        expect(hitTestDrawing(fibSpeedResistanceFan, 200, 269.1, scales, options)).toBe(true);
        expect(hitTestDrawing(fibChannel, 200, 238.2, scales, options)).toBe(true);
        expect(hitTestDrawing(trendBasedFibTime, 240, 120, scales, options)).toBe(true);
        expect(hitTestDrawing(fibWedge, 180, 260, scales, options)).toBe(true);
        expect(hitTestDrawing(pitchfan, 280, 240, scales, options)).toBe(true);
    });
    it("bridge: channel and projection family hits through engine-core overlay hit-test", () => {
        const channel = makeChannel([{ x: now + 20, y: 25 }, { x: now + 30, y: 25 }, { x: now + 20, y: 50 }]);
        const parallelChannel = makeParallelChannel([{ x: now + 20, y: 25 }, { x: now + 30, y: 25 }, { x: now + 20, y: 37.5 }]);
        const pitchfork = makePitchfork([{ x: now + 25, y: 80 }, { x: now + 20, y: 20 }, { x: now + 30, y: 20 }]);
        const regressionChannel = makeRegressionChannel([{ x: now + 20, y: 20 }, { x: now + 24, y: 28 }]);
        const regressionPlotData = [20, 21, 22, 23, 24].map((offset, index) => ({
            date: now + offset,
            open: 0,
            high: 0,
            low: 0,
            close: 20 + index * 2,
            volume: 0,
        }));
        expect(hitTestDrawing(channel, 200, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(parallelChannel, 200, 250, scales, options)).toBe(true);
        expect(hitTestDrawing(pitchfork, 240, 200, scales, options)).toBe(true);
        expect(hitTestDrawing(regressionChannel, 176, 304, scales, { ...options, plotData: regressionPlotData })).toBe(true);
    });
    it("bridge: pattern and harmonic family hits through engine-core overlay hit-test", () => {
        const abcdPattern = makeAbcdPattern([{ x: now + 20, y: 20 }, { x: now + 30, y: 40 }, { x: now + 40, y: 25 }, { x: now + 50, y: 45 }]);
        const xabcdPattern = makeXabcdPattern([{ x: now + 20, y: 20 }, { x: now + 25, y: 40 }, { x: now + 30, y: 25 }, { x: now + 35, y: 45 }, { x: now + 40, y: 30 }]);
        const headAndShoulders = makeHeadAndShoulders([{ x: now + 20, y: 35 }, { x: now + 25, y: 30 }, { x: now + 30, y: 50 }, { x: now + 35, y: 30 }, { x: now + 40, y: 35 }, { x: now + 25, y: 20 }, { x: now + 40, y: 20 }]);
        expect(hitTestDrawing(abcdPattern, 280, 270, scales, options)).toBe(true);
        expect(hitTestDrawing(xabcdPattern, 220, 270, scales, options)).toBe(true);
        expect(hitTestDrawing(headAndShoulders, 180, 270, scales, options)).toBe(true);
    });
    it("bridge: elliott family hits through engine-core overlay hit-test", () => {
        const elliottImpulse = makeElliottImpulse([{ x: now + 20, y: 35 }, { x: now + 25, y: 35 }, { x: now + 30, y: 45 }, { x: now + 35, y: 25 }, { x: now + 40, y: 45 }, { x: now + 45, y: 35 }]);
        const elliottCorrection = makeElliottCorrection([{ x: now + 20, y: 30 }, { x: now + 25, y: 25 }, { x: now + 30, y: 40 }, { x: now + 35, y: 35 }], ["A", "B", "C", "D"]);
        expect(hitTestDrawing(elliottImpulse, 180, 260, scales, options)).toBe(true);
        expect(hitTestDrawing(elliottCorrection, 220, 270, scales, options)).toBe(true);
    });
    it("bridge: gann family hits through engine-core overlay hit-test", () => {
        const gannFan = makeGannFan([{ x: now + 20, y: 75 }, { x: now + 40, y: 25 }]);
        const gannSquareFixed = makeGannSquareFixed([{ x: now + 20, y: 70 }], 20);
        expect(hitTestDrawing(gannFan, 280, 250, scales, options)).toBe(true);
        expect(hitTestDrawing(gannSquareFixed, 200, 120, scales, options)).toBe(true);
    });
    it("bridge: position and cycle families preserve engine-core hit semantics", () => {
        const longPosition = makeLongPosition([{ x: now + 20, y: 50 }, { x: now + 40, y: 20 }], { entry: 40, stop: 20, target: 80 });
        const cyclicLines = makeCyclicLines([{ x: now + 20, y: 60 }, { x: now + 40, y: 60 }], 4);
        expect(hitTestDrawing(longPosition, 200, 280, scales, options)).toBe(true);
        expect(hitTestDrawing(cyclicLines, 240, 160, scales, options)).toBe(true);
        expect(hitTestDrawing(cyclicLines, 160, 40, scales, options)).toBe(false);
    });
    it("invisible drawing always misses regardless of tolerance", () => {
        const invisible = { ...drawing, visible: false };
        expect(hitTestDrawing(invisible, 200, 200, scales, options, "touch")).toBe(false);
    });
    // Verify all pointerType values are accepted
    const allTypes = ["mouse", "touch", "pen"];
    for (const pt of allTypes) {
        it(`accepts pointerType="${pt}" without error`, () => {
            expect(() => hitTestDrawing(drawing, 200, 200, scales, options, pt)).not.toThrow();
        });
    }
});
