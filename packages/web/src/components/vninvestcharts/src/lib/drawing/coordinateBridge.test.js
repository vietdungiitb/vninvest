import { describe, expect, it } from "vitest";
import { buildRenderScalesFromBridge } from "./coordinateBridge";
import { chartPointToPixel } from "./coordinateUtils";
describe("coordinateBridge", () => {
    it("provides xScaleByIndex so point projection can stay index-anchored", () => {
        const bridge = {
            resolveChartPoint: ({ x, y }) => ({ x: x * 1000, y: y / 2 }),
            chartPointToPixel: ({ point }) => ({
                x: typeof point.xIndexFloat === "number" ? point.xIndexFloat * 20 : point.x / 1000,
                y: point.y,
            }),
        };
        const scales = buildRenderScalesFromBridge(bridge, {
            paneId: "price",
            plotData: [{ date: new Date("2026-05-29T00:00:00.000Z"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
        });
        expect(scales).toBeDefined();
        expect(typeof scales?.xScaleByIndex).toBe("function");
        const pixel = chartPointToPixel({
            x: 123,
            y: 999,
            xIndexFloat: 7,
            timeMsHint: 123,
            yPrice: 42,
        }, scales);
        expect(pixel.x).toBe(140);
        expect(pixel.y).toBe(42);
    });
    it("applies pixelOffset consistently to xScaleByIndex", () => {
        const bridge = {
            resolveChartPoint: ({ x, y }) => ({ x: x * 1000, y: y }),
            chartPointToPixel: ({ point }) => ({
                x: typeof point.xIndexFloat === "number" ? 200 + point.xIndexFloat * 10 : 200,
                y: point.y,
            }),
        };
        const scales = buildRenderScalesFromBridge(bridge, {
            paneId: "price",
            plotData: [{ date: new Date("2026-05-29T00:00:00.000Z"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
            pixelOffset: { x: 50, y: 0 },
        });
        expect(scales).toBeDefined();
        expect(scales?.xScaleByIndex?.(3)).toBe(180);
    });
});
