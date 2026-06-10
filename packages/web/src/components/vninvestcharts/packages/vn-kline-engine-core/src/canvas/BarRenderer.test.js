import { describe, expect, it, vi } from "vitest";
import { BarRenderer } from "./BarRenderer";
function createContextMock() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        set globalAlpha(_value) {
            void _value;
        },
        set fillStyle(_value) {
            void _value;
        },
    };
}
const data = [
    { x: 10, value: 8 },
    { x: 20, value: -4 },
    { x: 30, value: 12 },
];
describe("BarRenderer", () => {
    it("draws bars around zero baseline", () => {
        const renderer = new BarRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, data, {
            yScale: (value) => 100 - value,
            baselineValue: 0,
            barWidth: 8,
        });
        expect(ctx.fillRect).toHaveBeenCalledTimes(3);
        expect(ctx.fillRect).toHaveBeenCalledWith(6, 92, 8, 8);
        expect(ctx.fillRect).toHaveBeenCalledWith(16, 100, 8, 4);
        expect(ctx.fillRect).toHaveBeenCalledWith(26, 88, 8, 12);
    });
    it("skips hidden bars and invalid values", () => {
        const renderer = new BarRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, [
            { x: 10, value: 5, visible: false },
            { x: 20, value: Number.NaN },
        ], {
            yScale: (value) => 100 - value,
        });
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });
});
