import { describe, expect, it } from "vitest";
import { createPaneSpecFromDescriptor } from "./paneDescriptorBridge";
describe("createPaneSpecFromDescriptor", () => {
    it("derives left and right scale slots from visible series without fake pane splitting", () => {
        const paneSpec = createPaneSpecFromDescriptor({
            id: "momentum",
            label: "RSI+MACD",
            pinned: false,
            visible: true,
            heightRatio: 0.28,
            splitScale: false,
            tooltip: "value",
            series: [
                { type: "RSI", yAxis: "left", params: { period: 14 } },
                { type: "MACD", yAxis: "right", params: { fast: 12, slow: 26, signal: 9 } },
            ],
        });
        expect(paneSpec.kind).toBe("indicator");
        expect(paneSpec.scaleSlots.map((slot) => slot.id)).toEqual(["momentum-left", "momentum-right"]);
        expect(paneSpec.series[0]?.scaleSlotId).toBe("momentum-left");
        expect(paneSpec.series[1]?.scaleSlotId).toBe("momentum-right");
    });
    it("keeps single-axis panes on one scale slot", () => {
        const paneSpec = createPaneSpecFromDescriptor({
            id: "volume",
            label: "Volume",
            pinned: false,
            visible: true,
            heightRatio: 0.22,
            splitScale: false,
            tooltip: "value",
            series: [{ type: "Volume", yAxis: "right" }],
        });
        expect(paneSpec.kind).toBe("volume");
        expect(paneSpec.scaleSlots).toHaveLength(1);
        expect(paneSpec.scaleSlots[0]?.id).toBe("volume-right");
        expect(paneSpec.series[0]?.scaleSlotId).toBe("volume-right");
    });
    it("preserves explicit series line widths in engine style metadata", () => {
        const paneSpec = createPaneSpecFromDescriptor({
            id: "momentum",
            label: "RSI+MACD",
            pinned: false,
            visible: true,
            heightRatio: 0.28,
            splitScale: false,
            tooltip: "value",
            series: [
                { type: "RSI", yAxis: "left", lineWidth: 3.5 },
            ],
        });
        expect(paneSpec.series[0]?.style).toMatchObject({ lineWidth: 3.5 });
    });
});
