import { describe, expect, it, vi } from "vitest";
import { CrosshairRenderer } from "./CrosshairRenderer";
function createContextMock() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        set lineWidth(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
    };
}
describe("CrosshairRenderer", () => {
    it("T03-01: position = null renders nothing", () => {
        const renderer = new CrosshairRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, {
            plotBounds: { left: 10, top: 20, width: 100, height: 50 },
            position: null,
            themeMode: "light",
        });
        expect(ctx.stroke).not.toHaveBeenCalled();
    });
    it("T03-02: valid position renders 2 dashed lines", () => {
        const renderer = new CrosshairRenderer();
        const ctx = createContextMock();
        renderer.render(ctx, {
            plotBounds: { left: 10, top: 20, width: 100, height: 50 },
            position: { x: 60, y: 40 },
            themeMode: "dark",
        });
        expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
        expect(ctx.stroke).toHaveBeenCalledTimes(2);
        expect(ctx.moveTo).toHaveBeenCalledWith(60, 20);
        expect(ctx.lineTo).toHaveBeenCalledWith(60, 70);
        expect(ctx.moveTo).toHaveBeenCalledWith(10, 40);
        expect(ctx.lineTo).toHaveBeenCalledWith(110, 40);
    });
});
