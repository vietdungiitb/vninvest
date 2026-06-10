import { describe, expect, it, vi } from "vitest";
import { AxisGridRenderer } from "./AxisGridRenderer";
function createCanvasContextMock() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        set lineWidth(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
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
}
describe("AxisGridRenderer", () => {
    it("renders horizontal grid lines and axis labels when domain is available", () => {
        const renderer = new AxisGridRenderer();
        const ctx = createCanvasContextMock();
        renderer.render(ctx, {
            plotBounds: { left: 48, top: 0, width: 852, height: 320 },
            rightAxis: {
                bounds: { left: 900, top: 0, width: 48, height: 320 },
                domain: [0, 100],
            },
            tickCount: 5,
        });
        expect(ctx.stroke).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalled();
    });
    it("skips grid and labels when no axis domain is provided", () => {
        const renderer = new AxisGridRenderer();
        const ctx = createCanvasContextMock();
        renderer.render(ctx, {
            plotBounds: { left: 48, top: 0, width: 852, height: 320 },
            rightAxis: {
                bounds: { left: 900, top: 0, width: 48, height: 320 },
            },
            tickCount: 5,
        });
        expect(ctx.fillText).not.toHaveBeenCalled();
    });
});
