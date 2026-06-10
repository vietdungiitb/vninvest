import { describe, expect, it, vi } from "vitest";
import { renderDrawingToCanvas } from "./renderCanvas";
import { createDrawingObject } from "./shared";
const scales = {
    xScale: (date) => date.getTime(),
    xScaleInvert: (px) => new Date(px),
    yScale: (price) => price,
    yScaleInvert: (px) => px,
    plotData: [],
};
function makeContext() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        roundRect: vi.fn(),
        setLineDash: vi.fn(),
        measureText: vi.fn((label) => ({ width: label.length * 6 })),
    };
}
describe("semantic point affordance rendering", () => {
    it("renders semantic badges and selection rings for harmonic patterns", () => {
        const drawing = createDrawingObject("xabcdPattern", [
            { x: Date.parse("2026-01-01T00:00:00.000Z"), y: 10 },
            { x: Date.parse("2026-01-02T00:00:00.000Z"), y: 20 },
            { x: Date.parse("2026-01-03T00:00:00.000Z"), y: 15 },
            { x: Date.parse("2026-01-04T00:00:00.000Z"), y: 25 },
            { x: Date.parse("2026-01-05T00:00:00.000Z"), y: 18 },
        ], {
            style: { stroke: "#00bcd4", strokeWidth: 1, opacity: 1 },
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 800, chartHeight: 600, isSelected: true });
        expect(ctx.roundRect.mock.calls.length).toBe(5);
        expect(ctx.arc.mock.calls.length).toBe(10);
        expect(ctx.fillText.mock.calls.map((call) => call[0])).toEqual(["X", "A", "B", "C", "D"]);
    });
    it("renders override Elliott labels with selection rings", () => {
        const drawing = createDrawingObject("elliottCorrection", [
            { x: Date.parse("2026-02-01T00:00:00.000Z"), y: 30 },
            { x: Date.parse("2026-02-02T00:00:00.000Z"), y: 24 },
            { x: Date.parse("2026-02-03T00:00:00.000Z"), y: 28 },
            { x: Date.parse("2026-02-04T00:00:00.000Z"), y: 22 },
        ], {
            style: { stroke: "#ff4d4f", strokeWidth: 1, opacity: 1 },
            waveLabels: ["(0)", "(A)", "(B)", "(C)"],
        });
        const ctx = makeContext();
        renderDrawingToCanvas(ctx, drawing, scales, { chartWidth: 800, chartHeight: 600, isSelected: true });
        expect(ctx.roundRect.mock.calls.length).toBe(4);
        expect(ctx.arc.mock.calls.length).toBe(8);
        expect(ctx.fillText.mock.calls.map((call) => call[0])).toEqual(["(0)", "(A)", "(B)", "(C)"]);
    });
});
