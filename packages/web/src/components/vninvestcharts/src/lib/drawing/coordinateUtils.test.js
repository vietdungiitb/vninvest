import { describe, expect, it } from "vitest";
import { chartPointToPixel, pixelToChartPoint } from "./coordinateUtils";
describe("coordinateUtils", () => {
    it("round-trips pixel coordinates through chart space without drift", () => {
        const scales = {
            xScale: (date) => date.getTime() / 1000,
            xScaleInvert: (px) => new Date(px * 1000),
            yScale: (price) => price * 2,
            yScaleInvert: (px) => px / 2,
        };
        const containerRect = { left: 30, top: 20 };
        const point = pixelToChartPoint(130, 90, containerRect, scales);
        const pixel = chartPointToPixel(point, scales);
        expect(point).toEqual({ x: 100_000, y: 35 });
        expect(pixel).toEqual({ x: 100, y: 70, xIndexFloat: undefined, yPrice: 35 });
    });
    it("prefers canonical anchor metadata when available", () => {
        const scales = {
            xScale: (date) => date.getTime() / 1000,
            xScaleInvert: (px) => new Date(px * 1000),
            yScale: (price) => price * 2,
            yScaleInvert: (px) => px / 2,
        };
        const pixel = chartPointToPixel({
            x: 999_999,
            y: 999,
            timeMsHint: 120_000,
            yPrice: 12.5,
        }, scales);
        expect(pixel).toEqual({ x: 120, y: 25, xIndexFloat: undefined, yPrice: 12.5 });
    });
});
