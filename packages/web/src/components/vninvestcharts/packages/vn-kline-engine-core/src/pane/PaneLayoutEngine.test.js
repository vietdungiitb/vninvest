import { describe, expect, it } from "vitest";
import { PaneLayoutEngine } from "./PaneLayoutEngine";
describe("PaneLayoutEngine", () => {
    it("keeps dual-axis bounds inside one logical pane and normalizes pane heights", () => {
        const layout = new PaneLayoutEngine();
        const panes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [
                    { id: "price-left", side: "left", mode: "auto", visible: true },
                    { id: "price-right", side: "right", mode: "auto", visible: true },
                ],
                series: [],
                tooltipMode: "ohlc",
            },
            {
                id: "volume",
                kind: "volume",
                labelKey: "pane.volume",
                visible: true,
                heightRatio: 1,
                scaleSlots: [{ id: "volume-right", side: "right", mode: "auto", visible: true }],
                series: [],
                tooltipMode: "value",
            },
        ];
        const snapshots = layout.layout(panes, 1000, 400);
        expect(snapshots).toHaveLength(2);
        expect(snapshots[0]?.bounds.height).toBe(300);
        expect(snapshots[1]?.bounds.height).toBe(100);
        expect(snapshots[0]?.axisBounds.left?.width).toBe(48);
        expect(snapshots[0]?.axisBounds.right?.width).toBe(48);
        expect(snapshots[0]?.plotBounds.left).toBe(48);
        expect(snapshots[0]?.scaleSlotBounds["price-left"]?.width).toBe(48);
        expect(snapshots[0]?.scaleSlotBounds["price-right"]?.width).toBe(48);
        expect(snapshots[0]?.scaleSlotStates["price-left"]).toMatchObject({ side: "left", mode: "auto", visible: true });
        expect(snapshots[0]?.scaleSlotStates["price-right"]).toMatchObject({ side: "right", mode: "auto", visible: true });
    });
    it("uses shared plot X-bounds across panes when any pane enables left+right scales", () => {
        const layout = new PaneLayoutEngine();
        const panes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [],
                tooltipMode: "ohlc",
            },
            {
                id: "momentum",
                kind: "indicator",
                labelKey: "pane.momentum",
                visible: true,
                heightRatio: 1,
                scaleSlots: [
                    { id: "momentum-left", side: "left", mode: "auto", visible: true },
                    { id: "momentum-right", side: "right", mode: "auto", visible: true },
                ],
                series: [],
                tooltipMode: "value",
            },
        ];
        const snapshots = layout.layout(panes, 900, 360);
        expect(snapshots).toHaveLength(2);
        expect(snapshots[0]?.plotBounds.left).toBe(48);
        expect(snapshots[1]?.plotBounds.left).toBe(48);
        expect(snapshots[0]?.plotBounds.width).toBe(804);
        expect(snapshots[1]?.plotBounds.width).toBe(804);
    });
});
