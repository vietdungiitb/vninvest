import { describe, expect, it } from "vitest";
import { calculateRegressionChannelMetrics } from "./regressionChannel";
function createDrawing() {
    return {
        id: "regression-channel-test",
        type: "regressionChannel",
        points: [
            { x: 0, y: 10 },
            { x: 4, y: 18 },
        ],
        style: {
            stroke: "#2962ff",
            strokeWidth: 1,
            strokeDasharray: "solid",
            fill: "transparent",
            opacity: 1,
        },
        visible: true,
        createdAt: 0,
        updatedAt: 0,
    };
}
describe("fork regressionChannel geometry", () => {
    it("prefers xScaleByIndex for X projection", () => {
        const metrics = calculateRegressionChannelMetrics(createDrawing(), {
            xScale: () => -1,
            xScaleByIndex: (index) => 100 + index * 25,
            xScaleInvert: (px) => new Date(px),
            yScale: (price) => price,
            yScaleInvert: (px) => px,
        }, [
            { date: 0, open: 0, high: 0, low: 0, close: 10, volume: 0 },
            { date: 1, open: 0, high: 0, low: 0, close: 12, volume: 0 },
            { date: 2, open: 0, high: 0, low: 0, close: 14, volume: 0 },
            { date: 3, open: 0, high: 0, low: 0, close: 16, volume: 0 },
            { date: 4, open: 0, high: 0, low: 0, close: 18, volume: 0 },
        ]);
        expect(metrics?.startX).toBe(100);
        expect(metrics?.endX).toBe(200);
    });
});
