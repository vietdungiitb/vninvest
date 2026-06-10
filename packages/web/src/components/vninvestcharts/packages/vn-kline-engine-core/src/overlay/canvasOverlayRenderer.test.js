import { describe, expect, it, vi } from "vitest";
import { renderOverlayPrimitiveToCanvas } from "./canvasOverlayRenderer";
function createContextMock() {
    const context = {
        measureText: vi.fn(() => ({ width: 42 })),
        roundRect: vi.fn(),
        ellipse: vi.fn(),
        setLineDash: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        closePath: vi.fn(),
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
            void _value;
        },
        set lineWidth(_value) {
            void _value;
        },
        set lineCap(_value) {
            void _value;
        },
        set lineJoin(_value) {
            void _value;
        },
        set globalAlpha(_value) {
            void _value;
        },
        set font(_value) {
            void _value;
        },
        set textAlign(_value) {
            void _value;
        },
        set textBaseline(_value) {
            void _value;
        },
    };
    return context;
}
function primitive(type) {
    return {
        type,
        points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
        style: {
            stroke: "#2962ff",
            strokeWidth: 2,
            strokeDasharray: "solid",
            opacity: 1,
            fill: "rgba(41,98,255,0.2)",
            fillOpacity: 0.3,
        },
    };
}
describe("canvasOverlayRenderer", () => {
    it("draws trend line primitives with line commands", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, primitive("trendLine"), {
            chartWidth: 800,
            chartHeight: 400,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
    });
    it("draws horizontal line using chart width bounds", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, primitive("hLine"), {
            chartWidth: 500,
            chartHeight: 300,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(500, 20);
    });
    it("skips rendering when primitive is hidden", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("rectangle"),
            visible: false,
        }, {
            chartWidth: 800,
            chartHeight: 400,
            isSelected: true,
        });
        expect(ctx.fillRect).not.toHaveBeenCalled();
        expect(ctx.strokeRect).not.toHaveBeenCalled();
    });
    it("extends ray primitives to the chart boundary", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("ray"),
            points: [{ x: 20, y: 20 }, { x: 30, y: 20 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(20, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 20);
    });
    it("draws polyline primitives with every segment", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("polyline"),
            points: [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 60, y: 25 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(30, 40);
        expect(ctx.lineTo).toHaveBeenCalledWith(60, 25);
    });
    it("renders dateAndPriceRange badges inside the range box", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("dateAndPriceRange"),
            points: [{ x: 20, y: 30 }, { x: 120, y: 90 }],
            text: "Δ +4.50% · 15 bars",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.fillRect).toHaveBeenCalledWith(20, 30, 100, 60);
        expect(ctx.fillText).toHaveBeenCalledWith("Δ +4.50% · 15 bars", 28, 46);
    });
    it("draws circle primitives with arc geometry", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("circle"),
            points: [{ x: 40, y: 50 }, { x: 70, y: 50 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.arc).toHaveBeenCalledWith(40, 50, 30, 0, Math.PI * 2);
    });
    it("draws ellipse primitives with ellipse geometry", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("ellipse"),
            points: [{ x: 20, y: 30 }, { x: 80, y: 70 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.ellipse).toHaveBeenCalledWith(50, 50, 30, 20, 0, 0, Math.PI * 2);
    });
    it("draws triangle primitives as a closed polygon", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("triangle"),
            points: [{ x: 20, y: 80 }, { x: 80, y: 80 }, { x: 50, y: 20 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(20, 80);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 80);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 20);
        expect(ctx.closePath).toHaveBeenCalled();
    });
    it("draws callout primitives with a label box and tail", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("callout"),
            points: [{ x: 60, y: 40 }, { x: 100, y: 90 }],
            text: "Label",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.roundRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith("Label", 60, 40.5);
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 90);
    });
    it("draws priceLabel primitives with a right-edge tag", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("priceLabel"),
            points: [{ x: 80, y: 50 }],
            text: "Price",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 50);
        expect(ctx.lineTo).toHaveBeenCalled();
        expect(ctx.roundRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith("Price", expect.any(Number), 50.5);
    });
    it("draws priceRange primitives as a horizontal band", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("priceRange"),
            points: [{ x: 20, y: 40 }, { x: 80, y: 70 }],
            text: "Δ",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 40, 200, 30);
        expect(ctx.fillText).toHaveBeenCalledWith("Δ", expect.any(Number), 55);
    });
    it("draws dateRange primitives as a vertical band", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("dateRange"),
            points: [{ x: 30, y: 40 }, { x: 90, y: 80 }],
            text: "Δt",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.fillRect).toHaveBeenCalledWith(30, 0, 60, 120);
        expect(ctx.fillText).toHaveBeenCalledWith("Δt", 60, 34);
    });
    it("draws barsCount primitives with the span label", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("barsCount"),
            points: [{ x: 40, y: 40 }, { x: 140, y: 60 }],
            text: "12",
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(40, 50);
        expect(ctx.lineTo).toHaveBeenCalledWith(140, 50);
        expect(ctx.fillText).toHaveBeenCalledWith("12", 90, 32);
    });
    it("draws fibonacci primitives from normalized horizontal level lines", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibonacci",
            points: [{ x: 20, y: 20 }, { x: 80, y: 60 }],
            levelLines: [{ y: 40, label: "50.0% — 30.00", color: "#2962ff" }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 40);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 40);
        expect(ctx.fillText).toHaveBeenCalledWith("50.0% — 30.00", 194, 36);
    });
    it("draws fibExtension primitives using extension level payloads", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibExtension",
            points: [{ x: 20, y: 20 }, { x: 80, y: 60 }],
            levelLines: [{ y: 100, label: "100.0% — 100.00", color: "#f23645" }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 100);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 100);
        expect(ctx.fillText).toHaveBeenCalledWith("100.0% — 100.00", 194, 96);
    });
    it("draws fibArc primitives from normalized arc levels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibArc",
            points: [{ x: 60, y: 80 }, { x: 90, y: 50 }],
            arcLevels: [{ radius: 30, label: "38.2%" }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.arc).toHaveBeenCalledWith(60, 80, 30, Math.PI, 0);
        expect(ctx.fillText).toHaveBeenCalledWith("38.2%", 94, 46);
    });
    it("draws fibTimeZone primitives from normalized vertical markers", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibTimeZone",
            points: [{ x: 20, y: 40 }, { x: 50, y: 40 }],
            verticalMarkers: [{ x: 50, label: "1" }, { x: 80, label: "2" }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(50, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 120);
        expect(ctx.fillText).toHaveBeenCalledWith("1", 54, 12);
    });
    it("draws fibCircles primitives from normalized circular arc levels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibCircles",
            points: [{ x: 50, y: 60 }, { x: 80, y: 60 }],
            arcLevels: [{ radius: 7.08, label: "0.236", startAngle: 0, endAngle: Math.PI * 2 }],
            pointMarkers: [{ point: { x: 50, y: 60 }, radius: 3 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.arc).toHaveBeenCalledWith(50, 60, 7.08, 0, Math.PI * 2);
        expect(ctx.fillText).toHaveBeenCalledWith("0.236", expect.any(Number), expect.any(Number));
    });
    it("draws fibSpeedResistanceArcs primitives from normalized semi-circle arc levels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibSpeedResistanceArcs",
            points: [{ x: 50, y: 60 }, { x: 80, y: 60 }],
            arcLevels: [{ radius: 7.08, label: "0.236", startAngle: Math.PI, endAngle: Math.PI * 2 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.arc).toHaveBeenCalledWith(50, 60, 7.08, Math.PI, Math.PI * 2);
    });
    it("draws fibSpiral primitives from normalized path points", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibSpiral",
            points: [{ x: 50, y: 60 }, { x: 80, y: 90 }],
            paths: [{ points: [{ x: 50, y: 60 }, { x: 55, y: 58 }, { x: 63, y: 62 }] }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(50, 60);
        expect(ctx.lineTo).toHaveBeenCalledWith(55, 58);
        expect(ctx.lineTo).toHaveBeenCalledWith(63, 62);
    });
    it("draws fibSpeedResistanceFan primitives from normalized line segments", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "fibSpeedResistanceFan",
            points: [{ x: 40, y: 100 }, { x: 120, y: 0 }],
            segments: [{
                    start: { x: 40, y: 100 },
                    end: { x: 120, y: 38.2 },
                    label: "0.618",
                    labelPosition: { x: 124, y: 38.2 },
                }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(40, 100);
        expect(ctx.lineTo).toHaveBeenCalledWith(120, 38.2);
        expect(ctx.fillText).toHaveBeenCalledWith("0.618", 124, 38.2);
    });
    it("draws trendBasedFibTime primitives from normalized vertical markers with custom label positions", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "trendBasedFibTime",
            points: [{ x: 20, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 40 }],
            segments: [{ start: { x: 50, y: 0 }, end: { x: 50, y: 2000 }, label: "1", labelPosition: { x: 53, y: 32 } }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(50, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 2000);
        expect(ctx.fillText).toHaveBeenCalledWith("1", 53, 32);
    });
    it("draws channel primitives from normalized segment and label payloads", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "channel",
            points: [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 20, y: 50 }],
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 80, y: 20 } },
                { start: { x: 20, y: 50 }, end: { x: 80, y: 50 } },
            ],
            labels: [{ text: "Δ +0.00 (+0.00%) · 10 bars", position: { x: 50, y: 10 } }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 50);
        expect(ctx.fillText).toHaveBeenCalledWith("Δ +0.00 (+0.00%) · 10 bars", 50, 10);
    });
    it("draws parallelChannel primitives from normalized segment payloads", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "parallelChannel",
            points: [{ x: 20, y: 30 }, { x: 80, y: 30 }, { x: 20, y: 45 }],
            segments: [
                { start: { x: 20, y: 45 }, end: { x: 80, y: 45 } },
                { start: { x: 20, y: 30 }, end: { x: 80, y: 30 } },
                { start: { x: 20, y: 15 }, end: { x: 80, y: 15 } },
            ],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 45);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 30);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 15);
    });
    it("draws pitchfork primitives from normalized segment and anchor label payloads", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "pitchfork",
            points: [{ x: 50, y: 20 }, { x: 20, y: 80 }, { x: 80, y: 80 }],
            segments: [
                { start: { x: 50, y: 0 }, end: { x: 50, y: 120 } },
                { start: { x: 20, y: 0 }, end: { x: 20, y: 120 } },
                { start: { x: 80, y: 0 }, end: { x: 80, y: 120 } },
            ],
            labels: [
                { text: "A", position: { x: 56, y: 14 } },
                { text: "B", position: { x: 26, y: 74 } },
                { text: "C", position: { x: 86, y: 74 } },
            ],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 120);
        expect(ctx.fillText).toHaveBeenCalledWith("A", 56, 14);
        expect(ctx.fillText).toHaveBeenCalledWith("B", 26, 74);
        expect(ctx.fillText).toHaveBeenCalledWith("C", 86, 74);
    });
    it("draws regressionChannel primitives from normalized polygon fill and label payloads", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "regressionChannel",
            points: [{ x: 20, y: 10 }, { x: 80, y: 18 }],
            polygons: [{
                    points: [
                        { x: 20, y: 10 },
                        { x: 80, y: 18 },
                        { x: 80, y: 30 },
                        { x: 20, y: 22 },
                    ],
                    fill: "rgba(100,149,237,0.08)",
                    opacity: 0.08,
                }],
            segments: [
                { start: { x: 20, y: 10 }, end: { x: 80, y: 18 }, color: "#2962ff" },
                { start: { x: 20, y: 22 }, end: { x: 80, y: 30 }, color: "#2962ff", strokeDasharray: "dashed" },
                { start: { x: 20, y: 16 }, end: { x: 80, y: 24 }, color: "#2962ff", strokeDasharray: "dashed" },
            ],
            labels: [{ text: "R² 0.95", position: { x: 76, y: 4 } }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 30);
        expect(ctx.fillText).toHaveBeenCalledWith("R² 0.95", 76, 4);
    });
    it("draws abcdPattern primitives from normalized segments and labels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "abcdPattern",
            points: [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 40 }],
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 40 } },
            ],
            labels: [
                { text: "A", position: { x: 26, y: 14 }, baseline: "alphabetic", weight: 700, fontSize: 11 },
                { text: "B", position: { x: 56, y: 34 }, baseline: "alphabetic", weight: 700, fontSize: 11 },
                { text: "C", position: { x: 86, y: 14 }, baseline: "alphabetic", weight: 700, fontSize: 11 },
                { text: "D", position: { x: 116, y: 34 }, baseline: "alphabetic", weight: 700, fontSize: 11 },
                { text: "BC/AB 0.75", position: { x: 65, y: 20 }, align: "center", baseline: "alphabetic", weight: 700, fontSize: 11 },
            ],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(110, 40);
        expect(ctx.fillText).toHaveBeenCalledWith("A", 26, 14);
        expect(ctx.fillText).toHaveBeenCalledWith("BC/AB 0.75", 65, 20);
    });
    it("draws harmonic-pattern primitives from polygons, segments, semantic badges, and dashed closing lines", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "xabcdPattern",
            points: [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 40 }, { x: 140, y: 20 }],
            polygons: [{
                    points: [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 40 }, { x: 140, y: 20 }],
                    fill: "transparent",
                    opacity: 0.1,
                }],
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 40 } },
                { start: { x: 110, y: 40 }, end: { x: 140, y: 20 } },
                { start: { x: 20, y: 20 }, end: { x: 140, y: 20 }, strokeDasharray: "dashed", dashPattern: [5, 3], hitTestable: false },
            ],
            semanticBadges: [{ label: "X", position: { x: 20, y: 20 } }],
            labels: [{ text: "XA/AB: 1.000", position: { x: 35, y: 20 }, align: "center", baseline: "alphabetic", weight: 700, fontSize: 11 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
        expect(ctx.fillText).toHaveBeenCalledWith("X", 56, 2);
    });
    it("draws headAndShoulders primitives with dashed neckline decorations", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "headAndShoulders",
            points: [{ x: 20, y: 40 }, { x: 40, y: 50 }, { x: 60, y: 20 }, { x: 80, y: 50 }, { x: 100, y: 40 }, { x: 40, y: 70 }, { x: 100, y: 70 }],
            segments: [
                { start: { x: 20, y: 40 }, end: { x: 40, y: 50 } },
                { start: { x: 40, y: 50 }, end: { x: 60, y: 20 } },
                { start: { x: 60, y: 20 }, end: { x: 80, y: 50 } },
                { start: { x: 80, y: 50 }, end: { x: 100, y: 40 } },
                { start: { x: 28, y: 70 }, end: { x: 112, y: 70 }, strokeDasharray: "dashed", dashPattern: [6, 3], color: "#faad14", hitTestable: false },
            ],
            semanticBadges: [{ label: "LS", position: { x: 20, y: 40 } }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
        expect(ctx.fillText).toHaveBeenCalledWith("LS", 56, 22);
    });
    it("draws elliottImpulse primitives from normalized segments and semantic badges", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "elliottImpulse",
            points: [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 50 }, { x: 140, y: 30 }, { x: 170, y: 60 }],
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 50, y: 40 } },
                { start: { x: 50, y: 40 }, end: { x: 80, y: 20 } },
                { start: { x: 80, y: 20 }, end: { x: 110, y: 50 } },
                { start: { x: 110, y: 50 }, end: { x: 140, y: 30 } },
                { start: { x: 140, y: 30 }, end: { x: 170, y: 60 } },
            ],
            semanticBadges: [
                { label: "(0)", position: { x: 20, y: 20 } },
                { label: "(1)", position: { x: 50, y: 40 } },
                { label: "(2)", position: { x: 80, y: 20 } },
                { label: "(3)", position: { x: 110, y: 50 } },
                { label: "(4)", position: { x: 140, y: 30 } },
                { label: "(5)", position: { x: 170, y: 60 } },
            ],
        }, {
            chartWidth: 240,
            chartHeight: 140,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(170, 60);
        expect(ctx.fillText).toHaveBeenCalledWith("(0)", 56, 2);
        expect(ctx.fillText).toHaveBeenCalledWith("(5)", 206, 42);
    });
    it("draws gannFan primitives from normalized segments and labels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "gannFan",
            points: [{ x: 20, y: 100 }, { x: 120, y: 20 }],
            segments: [
                { start: { x: 20, y: 100 }, end: { x: 145, y: 0 }, strokeWidth: 3 },
                { start: { x: 20, y: 100 }, end: { x: 200, y: 82 } },
            ],
            labels: [
                { text: "1×1", position: { x: 149, y: 12 }, baseline: "alphabetic", weight: 700, fontSize: 10 },
                { text: "1×8", position: { x: 170, y: 78 }, baseline: "alphabetic", weight: 400, fontSize: 10 },
            ],
        }, {
            chartWidth: 240,
            chartHeight: 140,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(145, 0);
        expect(ctx.fillText).toHaveBeenCalledWith("1×1", 149, 12);
    });
    it("draws gannBox primitives from normalized outer bounds and guide segments", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "gannBox",
            points: [{ x: 20, y: 20 }, { x: 100, y: 80 }],
            segments: [
                { start: { x: 20, y: 20 }, end: { x: 100, y: 20 } },
                { start: { x: 100, y: 20 }, end: { x: 100, y: 80 } },
                { start: { x: 100, y: 80 }, end: { x: 20, y: 80 } },
                { start: { x: 20, y: 80 }, end: { x: 20, y: 20 } },
                { start: { x: 20, y: 20 }, end: { x: 100, y: 80 }, color: "#ff4d4f", hitTestable: false },
            ],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 80);
    });
    it("draws longPosition primitives from normalized polygons, segments, and labels", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "longPosition",
            points: [{ x: 20, y: 20 }, { x: 100, y: 80 }],
            polygons: [
                { points: [{ x: 20, y: 40 }, { x: 100, y: 40 }, { x: 100, y: 80 }, { x: 20, y: 80 }], fill: "rgba(34, 171, 92, 0.18)" },
                { points: [{ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 40 }, { x: 20, y: 40 }], fill: "rgba(215, 50, 75, 0.18)" },
            ],
            segments: [
                { start: { x: 20, y: 40 }, end: { x: 100, y: 40 } },
                { start: { x: 20, y: 80 }, end: { x: 100, y: 80 } },
                { start: { x: 20, y: 20 }, end: { x: 100, y: 20 } },
            ],
            labels: [{ text: "R/R 1:2.0", position: { x: 96, y: 14 }, align: "right", baseline: "alphabetic", weight: 700, fontSize: 11 }],
        }, {
            chartWidth: 200,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 80);
        expect(ctx.fillText).toHaveBeenCalledWith("R/R 1:2.0", 96, 14);
    });
    it("draws cyclicLines primitives from normalized decorative segments", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "cyclicLines",
            points: [{ x: 20, y: 60 }, { x: 100, y: 60 }],
            segments: [
                { start: { x: 20, y: 60 }, end: { x: 100, y: 60 }, opacity: 0 },
                { start: { x: 20, y: 40 }, end: { x: 20, y: 80 }, opacity: 0.8, hitTestable: false },
                { start: { x: 40, y: 40 }, end: { x: 40, y: 80 }, opacity: 0.4, hitTestable: false },
                { start: { x: 60, y: 40 }, end: { x: 60, y: 80 }, opacity: 0.8, hitTestable: false },
            ],
        }, {
            chartWidth: 140,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 80);
    });
    it("draws timeCycles primitives from normalized arc paths", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "timeCycles",
            points: [{ x: 20, y: 40 }, { x: 100, y: 40 }],
            segments: [{ start: { x: 20, y: 40 }, end: { x: 100, y: 40 }, opacity: 0 }],
            paths: [
                { points: [{ x: 20, y: 40 }, { x: 30, y: 50 }, { x: 40, y: 40 }] },
                { points: [{ x: 40, y: 40 }, { x: 50, y: 50 }, { x: 60, y: 40 }] },
            ],
        }, {
            chartWidth: 140,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(30, 50);
        expect(ctx.lineTo).toHaveBeenCalledWith(60, 40);
    });
    it("draws sineLine primitives from normalized paths", () => {
        const ctx = createContextMock();
        renderOverlayPrimitiveToCanvas(ctx, {
            ...primitive("trendLine"),
            type: "sineLine",
            points: [{ x: 20, y: 60 }, { x: 100, y: 60 }],
            segments: [{ start: { x: 20, y: 60 }, end: { x: 100, y: 60 }, opacity: 0 }],
            paths: [{ points: [{ x: 20, y: 60 }, { x: 40, y: 30 }, { x: 60, y: 60 }, { x: 80, y: 90 }, { x: 100, y: 60 }] }],
        }, {
            chartWidth: 140,
            chartHeight: 120,
            isSelected: false,
        });
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 30);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 90);
    });
});
