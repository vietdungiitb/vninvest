import { describe, expect, it, vi } from "vitest";
import { renderDrawingToCanvas } from "./renderCanvas";
import { createDrawingObject } from "./shared";
const scales = {
    xScale: (value) => value.getTime(),
    xScaleInvert: (value) => new Date(value),
    yScale: (value) => value,
    yScaleInvert: (value) => value,
    plotData: [],
};
function makeContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        ellipse: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        measureText: vi.fn((label) => ({ width: label.length * 6 })),
    };
}
describe("renderCanvas primitive bridge", () => {
    it("extends ray drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("ray", [{ x: 20, y: 20 }, { x: 40, y: 20 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(20, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 20);
    });
    it("renders dateAndPriceRange badges through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("dateAndPriceRange", [{ x: 20, y: 30 }, { x: 120, y: 90 }], {
            style: {
                stroke: "#2962ff",
                strokeWidth: 2,
                fill: "rgba(41,98,255,0.2)",
                fillOpacity: 0.3,
                opacity: 1,
            },
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.fillRect).toHaveBeenCalledWith(20, 30, 100, 60);
        expect(ctx.fillText).toHaveBeenCalledWith("Δ +200.00% · 17 bars", 28, 46);
    });
    it("renders circle drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("circle", [{ x: 40, y: 50 }, { x: 70, y: 50 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.arc).toHaveBeenCalledWith(40, 50, 30, 0, Math.PI * 2);
    });
    it("renders callout drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("callout", [{ x: 60, y: 40 }, { x: 100, y: 90 }], {
            text: "Label",
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.roundRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith("Label", 60, 40.5);
    });
    it("renders priceLabel drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("priceLabel", [{ x: 80, y: 50 }], {
            text: "Price",
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.roundRect).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith("Price", expect.any(Number), 50.5);
    });
    it("renders barsCount drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("barsCount", [{ x: 40, y: 40 }, { x: 140, y: 60 }], {
            text: "12",
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(40, 50);
        expect(ctx.lineTo).toHaveBeenCalledWith(140, 50);
        expect(ctx.fillText).toHaveBeenCalledWith("12", 90, 32);
    });
    it("renders fibonacci drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibonacci", [{ x: 20, y: 20 }, { x: 80, y: 60 }], {
            fibLevels: [0.5],
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 40);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 40);
        expect(ctx.fillText).toHaveBeenCalledWith("50.0% — 40.00", 194, 36);
    });
    it("renders fibExtension drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibExtension", [{ x: 20, y: 20 }, { x: 80, y: 60 }], {
            fibLevels: [1],
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(0, 100);
        expect(ctx.lineTo).toHaveBeenCalledWith(200, 100);
        expect(ctx.fillText).toHaveBeenCalledWith("100.0% — 100.00", 194, 96);
    });
    it("renders fibArc drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibArc", [{ x: 60, y: 80 }, { x: 90, y: 50 }], {
            fibLevels: [0.382],
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.arc).toHaveBeenCalledWith(60, 80, expect.any(Number), Math.PI, 0);
        expect(ctx.fillText).toHaveBeenCalledWith("38.2%", expect.any(Number), expect.any(Number));
    });
    it("renders fibTimeZone drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibTimeZone", [{ x: 20, y: 40 }, { x: 50, y: 40 }], {
            fibLevels: [1, 2],
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(50, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 120);
        expect(ctx.fillText).toHaveBeenCalledWith("1", 54, 12);
    });
    it("renders fibCircles drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibCircles", [{ x: 50, y: 60 }, { x: 80, y: 60 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.arc).toHaveBeenCalledWith(50, 60, 7.08, 0, Math.PI * 2);
        expect(ctx.fillText).toHaveBeenCalledWith("0.236", expect.any(Number), expect.any(Number));
    });
    it("renders fibSpeedResistanceArcs drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibSpeedResistanceArcs", [{ x: 50, y: 60 }, { x: 80, y: 60 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.arc).toHaveBeenCalledWith(50, 60, 7.08, Math.PI, Math.PI * 2);
    });
    it("renders fibSpiral drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibSpiral", [{ x: 50, y: 60 }, { x: 80, y: 90 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalled();
    });
    it("renders fibSpeedResistanceFan drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibSpeedResistanceFan", [{ x: 40, y: 100 }, { x: 120, y: 0 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(120, 38.2);
        expect(ctx.fillText).toHaveBeenCalledWith("0.618", 124, 38.2);
    });
    it("renders fibChannel drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibChannel", [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 20, y: 50 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 38.54);
        expect(ctx.fillText).toHaveBeenCalledWith("0.618", 84, 38.54);
    });
    it("renders trendBasedFibTime drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("trendBasedFibTime", [{ x: 20, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 40 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.moveTo).toHaveBeenCalledWith(50, 0);
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 2000);
        expect(ctx.fillText).toHaveBeenCalledWith("1", 53, 32);
    });
    it("renders fibWedge drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("fibWedge", [{ x: 20, y: 80 }, { x: 80, y: 80 }, { x: 50, y: 20 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(50, 20);
        expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    });
    it("renders pitchfan drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("pitchfan", [{ x: 20, y: 80 }, { x: 80, y: 80 }, { x: 120, y: 20 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.fillText).toHaveBeenCalledWith("0.5", 240, -10);
        expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    });
    it("renders channel drawings through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("channel", [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 20, y: 50 }]),
            showMeasurement: true,
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 50);
        expect(ctx.fillText).toHaveBeenCalledWith("Δ +0.00 (+0.00%) · 10 bars", 50, 10);
    });
    it("renders parallelChannel drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("parallelChannel", [{ x: 20, y: 30 }, { x: 80, y: 30 }, { x: 20, y: 45 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 45);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 30);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 15);
    });
    it("renders pitchfork drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("pitchfork", [{ x: 50, y: 20 }, { x: 20, y: 80 }, { x: 80, y: 80 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.fillText).toHaveBeenCalledWith("A", 56, 14);
        expect(ctx.fillText).toHaveBeenCalledWith("B", 26, 74);
        expect(ctx.fillText).toHaveBeenCalledWith("C", 86, 74);
    });
    it("renders regressionChannel drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("regressionChannel", [{ x: 20, y: 10 }, { x: 80, y: 18 }]);
        const ctx = makeContext();
        const plotData = [20, 35, 50, 65, 80].map((date, index) => ({
            date,
            open: 0,
            high: 0,
            low: 0,
            close: 10 + index * 2,
            volume: 0,
        }));
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false, plotData });
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith("R² 1.00", 76, 12);
    });
    it("renders abcdPattern drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("abcdPattern", [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 40 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(110, 40);
        expect(ctx.fillText).toHaveBeenCalledWith("A", 26, 14);
        expect(ctx.fillText).toHaveBeenCalledWith("BC/AB 1.00", 65, 20);
    });
    it("renders harmonic pattern drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("xabcdPattern", [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 40 }, { x: 140, y: 20 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.setLineDash).toHaveBeenCalledWith([5, 3]);
        expect(ctx.fillText).toHaveBeenCalledWith("X", 40, 2);
    });
    it("renders headAndShoulders drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("headAndShoulders", [{ x: 20, y: 40 }, { x: 40, y: 50 }, { x: 60, y: 20 }, { x: 80, y: 50 }, { x: 100, y: 40 }, { x: 40, y: 70 }, { x: 100, y: 70 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
        expect(ctx.fillText).toHaveBeenCalledWith("LS", 41, 22);
    });
    it("renders elliottImpulse drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("elliottImpulse", [{ x: 20, y: 20 }, { x: 50, y: 40 }, { x: 80, y: 20 }, { x: 110, y: 50 }, { x: 140, y: 30 }, { x: 170, y: 60 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 240, chartHeight: 140, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(170, 60);
        expect(ctx.fillText).toHaveBeenCalledWith("(0)", 44, 2);
        expect(ctx.fillText).toHaveBeenCalledWith("(5)", 194, 42);
    });
    it("renders elliottCorrection custom wave labels through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("elliottCorrection", [{ x: 20, y: 40 }, { x: 50, y: 20 }, { x: 80, y: 50 }, { x: 110, y: 30 }]),
            waveLabels: ["A", "B", "C", "D"],
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.fillText).toHaveBeenCalledWith("A", 40, 22);
        expect(ctx.fillText).toHaveBeenCalledWith("D", 130, 12);
    });
    it("renders gannFan drawings through the overlay primitive bridge", () => {
        const drawing = createDrawingObject("gannFan", [{ x: 20, y: 100 }, { x: 120, y: 20 }]);
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(145, 0);
        expect(ctx.fillText).toHaveBeenCalledWith("1×1", 149, 12);
    });
    it("renders gannSquareFixed drawings through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("gannSquareFixed", [{ x: 20, y: 20 }]),
            gannSquareSize: 20,
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 40);
    });
    it("renders longPosition drawings through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("longPosition", [{ x: 20, y: 50 }, { x: 100, y: 20 }]),
            riskReward: { entry: 40, stop: 20, target: 80 },
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 200, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(100, 80);
        expect(ctx.fillText).toHaveBeenCalledWith("R/R 1:2.0", 96, 14);
    });
    it("renders cyclicLines drawings through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("cyclicLines", [{ x: 20, y: 60 }, { x: 100, y: 60 }]),
            cycleParams: { count: 4 },
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 140, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 80);
    });
    it("renders sineLine drawings through the overlay primitive bridge", () => {
        const drawing = {
            ...createDrawingObject("sineLine", [{ x: 20, y: 60 }, { x: 100, y: 60 }]),
            cycleParams: { count: 2, amplitude: 30 },
        };
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 140, chartHeight: 120, isSelected: false });
        expect(ctx.lineTo).toHaveBeenCalledWith(40, 30);
        expect(ctx.lineTo).toHaveBeenCalledWith(80, 90);
    });
});
