import { describe, expect, it } from "vitest";
import { computePaneScaleSlotDomains } from "./paneScaleSlotDomains";
function createDatum(index, close = index + 100) {
    return {
        date: new Date(Date.UTC(2024, 0, 1, index)),
        open: close - 1,
        high: close + 2,
        low: close - 3,
        close,
        volume: index * 10 + 100,
    };
}
describe("computePaneScaleSlotDomains", () => {
    it("computes left/right domains for visible pane series", () => {
        const panes = [
            {
                id: "price",
                label: "Price",
                pinned: true,
                visible: true,
                heightRatio: 0.6,
                splitScale: false,
                tooltip: "ohlc",
                series: [
                    { type: "Candlestick", yAxis: "right" },
                ],
            },
            {
                id: "volume",
                label: "Volume",
                pinned: false,
                visible: true,
                heightRatio: 0.4,
                splitScale: false,
                tooltip: "value",
                series: [
                    { type: "Volume", yAxis: "left" },
                ],
            },
        ];
        const data = [createDatum(0, 100), createDatum(1, 110), createDatum(2, 105)];
        expect(computePaneScaleSlotDomains(panes, data)).toEqual({
            "price-right": [97, 112],
            "volume-left": [0, 120],
        });
    });
    it("handles large datasets without overflowing the call stack", () => {
        const panes = [
            {
                id: "price",
                label: "Price",
                pinned: true,
                visible: true,
                heightRatio: 1,
                splitScale: false,
                tooltip: "ohlc",
                series: [
                    { type: "Line", yAxis: "right" },
                ],
            },
        ];
        const data = Array.from({ length: 50_000 }, (_, index) => createDatum(index, index + 1));
        expect(() => computePaneScaleSlotDomains(panes, data)).not.toThrow();
        expect(computePaneScaleSlotDomains(panes, data)["price-right"]).toEqual([1, 50_000]);
    });
});
