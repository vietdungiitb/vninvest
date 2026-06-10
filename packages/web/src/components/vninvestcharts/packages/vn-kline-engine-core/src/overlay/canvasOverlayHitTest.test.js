import { describe, expect, it } from "vitest";
import { hitTestOverlayPrimitive, isOverlayPrimitiveHitTestSupported } from "./canvasOverlayHitTest";
function primitive(type) {
    return {
        type,
        points: [{ x: 10, y: 20 }, { x: 110, y: 20 }],
        style: {
            stroke: "#2962ff",
            strokeWidth: 2,
            fontSize: 12,
        },
    };
}
const options = { chartWidth: 400, chartHeight: 200, tolerance: 6 };
describe("canvasOverlayHitTest", () => {
    it("supports primitive types ported in KF-04-T01/T02", () => {
        expect(isOverlayPrimitiveHitTestSupported("trendLine")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("hLine")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("vLine")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("rectangle")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("text")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("arrow")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("ray")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("extendedLine")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("polyline")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("dateAndPriceRange")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("circle")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("ellipse")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("triangle")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("callout")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("priceLabel")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("priceRange")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("dateRange")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("barsCount")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibonacci")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibExtension")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibArc")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibTimeZone")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibCircles")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibSpeedResistanceArcs")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibSpiral")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibSpeedResistanceFan")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibChannel")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("trendBasedFibTime")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("fibWedge")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("pitchfan")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("channel")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("parallelChannel")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("pitchfork")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("regressionChannel")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("abcdPattern")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("xabcdPattern")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("cypherPattern")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("headAndShoulders")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("trianglePattern")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("threeDrivesPattern")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("elliottImpulse")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("elliottCorrection")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("elliottTriangle")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("elliottDoubleCombo")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("elliottTripleCombo")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("gannFan")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("gannBox")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("gannSquareFixed")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("gannSquare")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("longPosition")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("shortPosition")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("cyclicLines")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("timeCycles")).toBe(true);
        expect(isOverlayPrimitiveHitTestSupported("sineLine")).toBe(true);
    });
    it("detects trendLine hit near the segment", () => {
        const hit = hitTestOverlayPrimitive(primitive("trendLine"), 50, 24, options);
        expect(hit).toBe(true);
    });
    it("detects rectangle hit inside bounds", () => {
        const rect = {
            ...primitive("rectangle"),
            points: [{ x: 20, y: 20 }, { x: 120, y: 70 }],
        };
        expect(hitTestOverlayPrimitive(rect, 60, 45, options)).toBe(true);
    });
    it("detects text hit using text bounds", () => {
        const text = {
            ...primitive("text"),
            points: [{ x: 80, y: 60 }],
            text: "Hello",
        };
        expect(hitTestOverlayPrimitive(text, 90, 60, options)).toBe(true);
    });
    it("detects ray hits beyond the anchor endpoint", () => {
        const ray = {
            ...primitive("ray"),
            points: [{ x: 20, y: 20 }, { x: 40, y: 20 }],
        };
        expect(hitTestOverlayPrimitive(ray, 150, 20, options)).toBe(true);
    });
    it("detects extendedLine hits on both sides of the anchors", () => {
        const extendedLine = {
            ...primitive("extendedLine"),
            points: [{ x: 60, y: 30 }, { x: 110, y: 30 }],
        };
        expect(hitTestOverlayPrimitive(extendedLine, 10, 30, options)).toBe(true);
    });
    it("detects polyline hits near any segment", () => {
        const polyline = {
            ...primitive("polyline"),
            points: [{ x: 10, y: 20 }, { x: 60, y: 60 }, { x: 110, y: 20 }],
        };
        expect(hitTestOverlayPrimitive(polyline, 83, 41, options)).toBe(true);
    });
    it("detects circle hits on the boundary", () => {
        const circle = {
            ...primitive("circle"),
            points: [{ x: 50, y: 50 }, { x: 80, y: 50 }],
        };
        expect(hitTestOverlayPrimitive(circle, 80, 50, options)).toBe(true);
    });
    it("detects filled ellipse hits inside the body", () => {
        const ellipse = {
            ...primitive("ellipse"),
            points: [{ x: 20, y: 30 }, { x: 80, y: 70 }],
            style: {
                ...primitive("ellipse").style,
                fill: "rgba(41,98,255,0.2)",
            },
        };
        expect(hitTestOverlayPrimitive(ellipse, 50, 50, options)).toBe(true);
    });
    it("detects triangle hits inside the polygon", () => {
        const triangle = {
            ...primitive("triangle"),
            points: [{ x: 20, y: 80 }, { x: 80, y: 80 }, { x: 50, y: 20 }],
        };
        expect(hitTestOverlayPrimitive(triangle, 50, 60, options)).toBe(true);
    });
    it("detects callout hits inside the label box", () => {
        const callout = {
            ...primitive("callout"),
            points: [{ x: 60, y: 40 }, { x: 100, y: 90 }],
            text: "Label",
        };
        expect(hitTestOverlayPrimitive(callout, 60, 40, options)).toBe(true);
    });
    it("detects priceLabel hits inside the right-edge tag", () => {
        const priceLabel = {
            ...primitive("priceLabel"),
            points: [{ x: 80, y: 50 }],
            text: "Price",
        };
        expect(hitTestOverlayPrimitive(priceLabel, 180, 50, options)).toBe(true);
    });
    it("detects priceRange hits inside the band", () => {
        const priceRange = {
            ...primitive("priceRange"),
            points: [{ x: 20, y: 40 }, { x: 80, y: 70 }],
        };
        expect(hitTestOverlayPrimitive(priceRange, 100, 55, options)).toBe(true);
    });
    it("detects dateRange hits inside the band", () => {
        const dateRange = {
            ...primitive("dateRange"),
            points: [{ x: 30, y: 40 }, { x: 90, y: 80 }],
        };
        expect(hitTestOverlayPrimitive(dateRange, 60, 60, options)).toBe(true);
    });
    it("detects barsCount hits on the span line", () => {
        const barsCount = {
            ...primitive("barsCount"),
            points: [{ x: 40, y: 40 }, { x: 140, y: 60 }],
        };
        expect(hitTestOverlayPrimitive(barsCount, 90, 50, options)).toBe(true);
    });
    it("detects fibonacci hits on normalized horizontal levels", () => {
        const fibonacci = {
            ...primitive("trendLine"),
            type: "fibonacci",
            levelLines: [{ y: 40, label: "50.0% — 30.00", color: "#2962ff" }],
        };
        expect(hitTestOverlayPrimitive(fibonacci, 150, 40, options)).toBe(true);
    });
    it("detects fibExtension hits on normalized extension levels", () => {
        const fibExtension = {
            ...primitive("trendLine"),
            type: "fibExtension",
            levelLines: [{ y: 100, label: "100.0% — 100.00", color: "#f23645" }],
        };
        expect(hitTestOverlayPrimitive(fibExtension, 150, 100, options)).toBe(true);
    });
    it("detects fibArc hits on normalized arc levels", () => {
        const fibArc = {
            ...primitive("trendLine"),
            type: "fibArc",
            points: [{ x: 60, y: 80 }, { x: 90, y: 50 }],
            arcLevels: [{ radius: 30, label: "38.2%" }],
        };
        expect(hitTestOverlayPrimitive(fibArc, 90, 80, options)).toBe(true);
    });
    it("detects fibTimeZone hits on normalized vertical markers", () => {
        const fibTimeZone = {
            ...primitive("trendLine"),
            type: "fibTimeZone",
            verticalMarkers: [{ x: 50, label: "1" }, { x: 80, label: "2" }],
        };
        expect(hitTestOverlayPrimitive(fibTimeZone, 50, 80, options)).toBe(true);
    });
    it("detects fibCircles hits on normalized circular levels", () => {
        const fibCircles = {
            ...primitive("trendLine"),
            type: "fibCircles",
            points: [{ x: 50, y: 60 }, { x: 80, y: 60 }],
            arcLevels: [{ radius: 20, label: "0.618", startAngle: 0, endAngle: Math.PI * 2 }],
        };
        expect(hitTestOverlayPrimitive(fibCircles, 70, 60, options)).toBe(true);
    });
    it("detects fibSpeedResistanceArcs hits on normalized semi-circle levels", () => {
        const fibArcs = {
            ...primitive("trendLine"),
            type: "fibSpeedResistanceArcs",
            points: [{ x: 50, y: 60 }, { x: 80, y: 60 }],
            arcLevels: [{ radius: 20, label: "0.618", startAngle: Math.PI, endAngle: Math.PI * 2 }],
        };
        expect(hitTestOverlayPrimitive(fibArcs, 50, 40, options)).toBe(true);
    });
    it("detects fibSpiral hits on normalized path geometry", () => {
        const fibSpiral = {
            ...primitive("trendLine"),
            type: "fibSpiral",
            paths: [{ points: [{ x: 50, y: 60 }, { x: 55, y: 58 }, { x: 63, y: 62 }] }],
        };
        expect(hitTestOverlayPrimitive(fibSpiral, 55, 58, options)).toBe(true);
    });
    it("detects fibSpeedResistanceFan hits on normalized fan segments", () => {
        const fibFan = {
            ...primitive("trendLine"),
            type: "fibSpeedResistanceFan",
            segments: [{
                    start: { x: 40, y: 100 },
                    end: { x: 120, y: 38.2 },
                }],
        };
        expect(hitTestOverlayPrimitive(fibFan, 80, 69.1, options)).toBe(true);
    });
    it("detects trendBasedFibTime hits on normalized time markers", () => {
        const fibTime = {
            ...primitive("trendLine"),
            type: "trendBasedFibTime",
            segments: [{ start: { x: 50, y: 0 }, end: { x: 50, y: 2000 }, label: "1", labelPosition: { x: 53, y: 32 } }],
        };
        expect(hitTestOverlayPrimitive(fibTime, 50, 80, options)).toBe(true);
    });
    it("detects channel hits on normalized secondary segments", () => {
        const channel = {
            ...primitive("trendLine"),
            type: "channel",
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 80, y: 20 } },
                { start: { x: 20, y: 50 }, end: { x: 80, y: 50 } },
            ],
        };
        expect(hitTestOverlayPrimitive(channel, 50, 50, options)).toBe(true);
    });
    it("detects parallelChannel hits on normalized upper segments", () => {
        const parallelChannel = {
            ...primitive("trendLine"),
            type: "parallelChannel",
            segments: [
                { start: { x: 20, y: 45 }, end: { x: 80, y: 45 } },
                { start: { x: 20, y: 30 }, end: { x: 80, y: 30 } },
                { start: { x: 20, y: 15 }, end: { x: 80, y: 15 } },
            ],
        };
        expect(hitTestOverlayPrimitive(parallelChannel, 50, 45, options)).toBe(true);
    });
    it("detects pitchfork hits on normalized fork segments", () => {
        const pitchfork = {
            ...primitive("trendLine"),
            type: "pitchfork",
            segments: [
                { start: { x: 50, y: 0 }, end: { x: 50, y: 120 } },
                { start: { x: 20, y: 0 }, end: { x: 20, y: 120 } },
                { start: { x: 80, y: 0 }, end: { x: 80, y: 120 } },
            ],
        };
        expect(hitTestOverlayPrimitive(pitchfork, 80, 80, options)).toBe(true);
    });
    it("detects regressionChannel hits inside normalized fill polygons", () => {
        const regressionChannel = {
            ...primitive("trendLine"),
            type: "regressionChannel",
            polygons: [{
                    points: [
                        { x: 20, y: 10 },
                        { x: 80, y: 18 },
                        { x: 80, y: 30 },
                        { x: 20, y: 22 },
                    ],
                    fill: "rgba(100,149,237,0.08)",
                }],
        };
        expect(hitTestOverlayPrimitive(regressionChannel, 50, 20, options)).toBe(true);
    });
    it("detects abcdPattern hits on normalized body segments", () => {
        const abcdPattern = {
            ...primitive("trendLine"),
            type: "abcdPattern",
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 40 } },
            ],
        };
        expect(hitTestOverlayPrimitive(abcdPattern, 65, 30, options)).toBe(true);
    });
    it("detects harmonic-pattern hits on normalized body segments but ignores decorative closing lines", () => {
        const xabcdPattern = {
            ...primitive("trendLine"),
            type: "xabcdPattern",
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 40 } },
                { start: { x: 110, y: 40 }, end: { x: 140, y: 20 } },
                { start: { x: 20, y: 20 }, end: { x: 140, y: 20 }, strokeDasharray: "dashed", dashPattern: [5, 3], hitTestable: false },
            ],
        };
        expect(hitTestOverlayPrimitive(xabcdPattern, 65, 30, options)).toBe(true);
        expect(hitTestOverlayPrimitive(xabcdPattern, 100, 20, options)).toBe(false);
    });
    it("detects headAndShoulders hits on normalized body segments but ignores neckline decorations", () => {
        const headAndShoulders = {
            ...primitive("trendLine"),
            type: "headAndShoulders",
            segments: [
                { start: { x: 20, y: 40 }, end: { x: 40, y: 50 } },
                { start: { x: 40, y: 50 }, end: { x: 60, y: 20 } },
                { start: { x: 60, y: 20 }, end: { x: 80, y: 50 } },
                { start: { x: 80, y: 50 }, end: { x: 100, y: 40 } },
                { start: { x: 28, y: 70 }, end: { x: 112, y: 70 }, strokeDasharray: "dashed", dashPattern: [6, 3], color: "#faad14", hitTestable: false },
            ],
        };
        expect(hitTestOverlayPrimitive(headAndShoulders, 30, 45, options)).toBe(true);
        expect(hitTestOverlayPrimitive(headAndShoulders, 70, 70, options)).toBe(false);
    });
    it("detects elliottImpulse hits on normalized body segments", () => {
        const elliottImpulse = {
            ...primitive("trendLine"),
            type: "elliottImpulse",
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 50 } },
                { start: { x: 110, y: 50 }, end: { x: 140, y: 30 } },
                { start: { x: 140, y: 30 }, end: { x: 170, y: 60 } },
            ],
        };
        expect(hitTestOverlayPrimitive(elliottImpulse, 95, 35, options)).toBe(true);
    });
    it("detects gannFan hits on normalized fan segments", () => {
        const gannFan = {
            ...primitive("trendLine"),
            type: "gannFan",
            segments: [
                { start: { x: 20, y: 100 }, end: { x: 145, y: 0 }, strokeWidth: 3 },
                { start: { x: 20, y: 100 }, end: { x: 200, y: 82 } },
            ],
        };
        expect(hitTestOverlayPrimitive(gannFan, 82.5, 50, options)).toBe(true);
    });
    it("detects gannBox hits on normalized outer segments but ignores guide lines", () => {
        const gannBox = {
            ...primitive("trendLine"),
            type: "gannBox",
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 100, y: 20 } },
                { start: { x: 100, y: 20 }, end: { x: 100, y: 80 } },
                { start: { x: 100, y: 80 }, end: { x: 20, y: 80 } },
                { start: { x: 20, y: 80 }, end: { x: 20, y: 20 } },
                { start: { x: 20, y: 20 }, end: { x: 100, y: 80 }, color: "#ff4d4f", hitTestable: false },
            ],
        };
        expect(hitTestOverlayPrimitive(gannBox, 60, 20, options)).toBe(true);
        expect(hitTestOverlayPrimitive(gannBox, 60, 50, options)).toBe(false);
    });
    it("detects longPosition hits inside normalized risk-reward polygons", () => {
        const longPosition = {
            ...primitive("trendLine"),
            type: "longPosition",
            segments: [
                { start: { x: 20, y: 40 }, end: { x: 100, y: 40 } },
                { start: { x: 20, y: 80 }, end: { x: 100, y: 80 } },
                { start: { x: 20, y: 20 }, end: { x: 100, y: 20 } },
            ],
            polygons: [
                { points: [{ x: 20, y: 40 }, { x: 100, y: 40 }, { x: 100, y: 80 }, { x: 20, y: 80 }], fill: "rgba(34, 171, 92, 0.18)" },
                { points: [{ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 40 }, { x: 20, y: 40 }], fill: "rgba(215, 50, 75, 0.18)" },
            ],
        };
        expect(hitTestOverlayPrimitive(longPosition, 60, 30, options)).toBe(true);
        expect(hitTestOverlayPrimitive(longPosition, 60, 60, options)).toBe(true);
    });
    it("detects cycle family hits through normalized anchor segments only", () => {
        const cyclicLines = {
            ...primitive("trendLine"),
            type: "cyclicLines",
            segments: [
                { start: { x: 20, y: 60 }, end: { x: 100, y: 60 }, opacity: 0 },
                { start: { x: 20, y: 40 }, end: { x: 20, y: 80 }, opacity: 0.8, hitTestable: false },
                { start: { x: 40, y: 40 }, end: { x: 40, y: 80 }, opacity: 0.4, hitTestable: false },
                { start: { x: 60, y: 40 }, end: { x: 60, y: 80 }, opacity: 0.8, hitTestable: false },
            ],
        };
        expect(hitTestOverlayPrimitive(cyclicLines, 60, 60, options)).toBe(true);
        expect(hitTestOverlayPrimitive(cyclicLines, 40, 10, options)).toBe(false);
    });
});
