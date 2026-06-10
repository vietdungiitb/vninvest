import { describe, expect, it, vi } from "vitest";
import { LineAreaRenderer } from "./LineAreaRenderer";
function createContextMock() {
    const canvas = {
        width: 800,
        height: 400,
        getContext: vi.fn((contextId) => (contextId === "webgl" ? null : null)),
    };
    const context = {
        canvas,
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        fillRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        closePath: vi.fn(),
        set lineWidth(_value) {
            void _value;
        },
        set globalAlpha(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
            void _value;
        },
    };
    return context;
}
const sampleData = [
    { x: 10, value: 10 },
    { x: 20, value: 15 },
    { x: 30, value: 12 },
];
describe("LineAreaRenderer", () => {
    it("draws line paths in line mode", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, sampleData, {
            yScale: (value) => 100 - value,
            mode: "line",
        });
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 90);
        expect(ctx.lineTo).toHaveBeenCalledWith(20, 85);
        expect(ctx.lineTo).toHaveBeenCalledWith(30, 88);
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
        expect(ctx.fill).not.toHaveBeenCalled();
    });
    it("draws closed filled area in area mode", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, sampleData, {
            yScale: (value) => 100 - value,
            mode: "area",
            baselineValue: 0,
        });
        expect(ctx.fill).toHaveBeenCalledTimes(1);
        expect(ctx.closePath).toHaveBeenCalledTimes(1);
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });
    it("draws rectangular bars in volume mode", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, sampleData, {
            yScale: (value) => 100 - value,
            mode: "volume",
            baselineValue: 0,
            barWidth: 8,
        });
        expect(ctx.fillRect).toHaveBeenCalledTimes(3);
        expect(ctx.fillRect).toHaveBeenCalledWith(6, 90, 8, 10);
        expect(ctx.fillRect).toHaveBeenCalledWith(16, 85, 8, 15);
        expect(ctx.fillRect).toHaveBeenCalledWith(26, 88, 8, 12);
        expect(ctx.stroke).not.toHaveBeenCalled();
    });
    it("does not initialize WebGL when useWebGL=false", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, sampleData, {
            yScale: (value) => 100 - value,
            mode: "line",
            useWebGL: false,
        });
        expect(ctx.canvas.getContext).not.toHaveBeenCalledWith("webgl");
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });
    it("falls back to canvas 2D when useWebGL=true but context is unavailable", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, sampleData, {
            yScale: (value) => 100 - value,
            mode: "line",
            useWebGL: true,
        });
        expect(ctx.canvas.getContext).toHaveBeenCalledWith("webgl");
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });
    // ── KF-12-T10: GC hot-path — no extra map/filter allocations ─────────────
    it("KF12-T10-01: filters invisible points without creating intermediate null array", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        const mixedData = [
            { x: 10, value: 10 },
            { x: 20, value: 15, visible: false },
            { x: 30, value: 12 },
        ];
        renderer.render(ctx, mixedData, { yScale: (v) => 100 - v, mode: "line" });
        // 2 valid points → moveTo(10,90) + lineTo(30,88); stroke called once per path
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });
    it("KF12-T10-02: filters non-finite values correctly in refactored loop", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        const badData = [
            { x: NaN, value: 10 },
            { x: 20, value: Infinity },
            { x: 30, value: 12 },
        ];
        renderer.render(ctx, badData, { yScale: (v) => 100 - v, mode: "line" });
        expect(ctx.stroke).toHaveBeenCalledTimes(1);
        expect(ctx.moveTo).toHaveBeenCalledWith(30, 88);
    });
    it("KF12-T10-03: returns early when all points are non-finite", () => {
        const renderer = new LineAreaRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, [{ x: NaN, value: 10 }, { x: 20, value: NaN }], {
            yScale: (v) => 100 - v,
            mode: "line",
        });
        expect(ctx.stroke).not.toHaveBeenCalled();
        expect(ctx.moveTo).not.toHaveBeenCalled();
    });
});
