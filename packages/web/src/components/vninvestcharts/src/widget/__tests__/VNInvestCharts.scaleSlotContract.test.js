// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { normalizePaneDescriptorsForExplicitScaleSlots } from "../VNInvestCharts";
describe("VNInvestCharts scale-slot contract", () => {
    it("normalizes raw panes to explicit scale-slot ids by default", () => {
        const rawPanes = [
            {
                id: "momentum",
                label: "Momentum",
                pinned: false,
                visible: true,
                heightRatio: 1,
                splitScale: false,
                tooltip: "value",
                series: [
                    { id: "rsi-series", type: "RSI", yAxis: "left", params: { period: 14 } },
                    { id: "macd-series", type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } },
                ],
            },
        ];
        const normalizedPanes = normalizePaneDescriptorsForExplicitScaleSlots(rawPanes);
        expect(normalizedPanes[0]?.splitScale).toBe(true);
        expect(normalizedPanes[0]?.series.map((series) => series.scaleSlotId)).toEqual([
            "momentum-left",
            "momentum-right",
        ]);
        const rawFirstSeries = rawPanes[0]?.series[0];
        expect(rawFirstSeries?.scaleSlotId).toBeUndefined();
    });
});
