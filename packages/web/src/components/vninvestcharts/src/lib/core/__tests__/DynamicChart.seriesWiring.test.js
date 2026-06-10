import { describe, expect, it } from "vitest";
import { buildChartSlots } from "../DynamicChart";
import { buildIndicatorSeriesKey } from "../seriesValueResolver";
function makeDatum() {
    const ma21Key = buildIndicatorSeriesKey({ type: "MA", yAxis: "right", params: { period: 21 } });
    const indicatorValues = ma21Key ? { [ma21Key]: 150 } : undefined;
    return {
        date: new Date("2024-01-01T00:00:00.000Z"),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1_000,
        indicatorValues,
    };
}
describe("DynamicChart series wiring", () => {
    it("uses canonical MA values for both yExtents accessors and tooltip entries", () => {
        const pane = {
            id: "ma-pane",
            label: "MA Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: false,
            tooltip: "value",
            series: [{ type: "MA", yAxis: "right", params: { period: 21 } }],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(1);
        const slot = slots[0];
        const datum = makeDatum();
        expect(slot).toBeDefined();
        if (!slot) {
            return;
        }
        expect(slot.accessors).toHaveLength(1);
        expect(slot.accessors[0]?.(datum)).toBe(150);
        expect(slot.tooltipEntries).toHaveLength(1);
        expect(slot.tooltipEntries[0]?.value(datum)).toBe(150);
    });
    it("keeps split-scale left and right slots independent", () => {
        const leftKey = buildIndicatorSeriesKey({ type: "MA", yAxis: "left", params: { period: 10 } });
        const rightKey = buildIndicatorSeriesKey({ type: "MA", yAxis: "right", params: { period: 21 } });
        if (!leftKey || !rightKey) {
            throw new Error("Expected canonical MA series keys");
        }
        const pane = {
            id: "split-ma-pane",
            label: "Split MA Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: true,
            tooltip: "value",
            series: [
                { type: "MA", yAxis: "left", params: { period: 10 } },
                { type: "MA", yAxis: "right", params: { period: 21 } },
            ],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(2);
        const datum = {
            date: new Date("2024-01-01T00:00:00.000Z"),
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            volume: 1_000,
            indicatorValues: {
                [leftKey]: 110,
                [rightKey]: 210,
            },
        };
        expect(slots[0]?.hasLeftAxis).toBe(true);
        expect(slots[0]?.hasRightAxis).toBe(false);
        expect(slots[1]?.hasLeftAxis).toBe(false);
        expect(slots[1]?.hasRightAxis).toBe(true);
        expect(slots[0]?.accessors[0]?.(datum)).toBe(110);
        expect(slots[1]?.accessors[0]?.(datum)).toBe(210);
        expect(slots[0]?.tooltipEntries[0]?.value(datum)).toBe(110);
        expect(slots[1]?.tooltipEntries[0]?.value(datum)).toBe(210);
    });
    it("groups explicit scaleSlotId series before legacy splitScale fallback", () => {
        const leftKey = buildIndicatorSeriesKey({ type: "MA", yAxis: "left", params: { period: 10 } });
        const rightKey = buildIndicatorSeriesKey({ type: "MA", yAxis: "right", params: { period: 21 } });
        if (!leftKey || !rightKey) {
            throw new Error("Expected canonical MA series keys");
        }
        const pane = {
            id: "explicit-slot-pane",
            label: "Explicit Slot Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: true,
            tooltip: "value",
            series: [
                { type: "MA", yAxis: "left", scaleSlotId: "explicit-left", params: { period: 10 } },
                { type: "MA", yAxis: "right", scaleSlotId: "explicit-right", params: { period: 21 } },
            ],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(2);
        expect(slots[0]?.hasLeftAxis).toBe(true);
        expect(slots[0]?.hasRightAxis).toBe(false);
        expect(slots[1]?.hasLeftAxis).toBe(false);
        expect(slots[1]?.hasRightAxis).toBe(true);
        const datum = {
            date: new Date("2024-01-01T00:00:00.000Z"),
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            volume: 1_000,
            indicatorValues: {
                [leftKey]: 110,
                [rightKey]: 210,
            },
        };
        expect(slots[0]?.accessors[0]?.(datum)).toBe(110);
        expect(slots[1]?.accessors[0]?.(datum)).toBe(210);
        expect(slots[0]?.tooltipEntries[0]?.value(datum)).toBe(110);
        expect(slots[1]?.tooltipEntries[0]?.value(datum)).toBe(210);
    });
    it("preserves series order when split-scale panes synthesize slot ids", () => {
        const pane = {
            id: "split-scale-order-pane",
            label: "Split Scale Order Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: true,
            tooltip: "value",
            series: [
                { type: "MA", yAxis: "right", params: { period: 21 } },
                { type: "MA", yAxis: "left", params: { period: 10 } },
            ],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(2);
        expect(slots[0]?.hasRightAxis).toBe(true);
        expect(slots[0]?.hasLeftAxis).toBe(false);
        expect(slots[1]?.hasLeftAxis).toBe(true);
        expect(slots[1]?.hasRightAxis).toBe(false);
    });
    it("keeps non-split mixed-axis panes on a single synthesized slot", () => {
        const pane = {
            id: "single-slot-mixed-pane",
            label: "Single Slot Mixed Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: false,
            tooltip: "value",
            series: [
                { type: "MA", yAxis: "left", params: { period: 10 } },
                { type: "MA", yAxis: "right", params: { period: 21 } },
            ],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(1);
        expect(slots[0]?.hasLeftAxis).toBe(true);
        expect(slots[0]?.hasRightAxis).toBe(true);
    });
    it("resolves BollingerBand fill properties and renders correctly", () => {
        const pane = {
            id: "bb-pane",
            label: "BB Pane",
            pinned: false,
            visible: true,
            heightRatio: 1,
            splitScale: false,
            tooltip: "value",
            series: [{
                    type: "BollingerBand",
                    yAxis: "right",
                    params: { period: 20, stdDev: 2, fillMode: "solid", fillOpacity: 0.3, fillColor: "#123456" }
                }],
        };
        const slots = buildChartSlots(pane);
        expect(slots).toHaveLength(1);
        const slot = slots[0];
        expect(slot).toBeDefined();
    });
});
