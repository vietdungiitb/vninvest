import { describe, expect, it } from "vitest";
import { createDrawingObject } from "../../shared";
import { createDrawingSelectionToolbarModel, resolveDrawingSelectionToolbarPosition, } from "../selectionToolbar";
describe("selectionToolbar", () => {
    it("creates direct primary actions and text editing secondary action", () => {
        const drawing = createDrawingObject("text", [{ x: 10, y: 100 }], { style: { stroke: "#fff", strokeWidth: 1, opacity: 1 } });
        const model = createDrawingSelectionToolbarModel(drawing, {
            clone: "Clone",
            lock: "Lock",
            unlock: "Unlock",
            hide: "Hide",
            show: "Show",
            edit: "Edit",
            bringToFront: "Front",
            sendToBack: "Back",
            delete: "Delete",
        });
        expect(model?.primaryActions.map((action) => action.id)).toEqual(["clone", "toggleLock", "toggleVisibility"]);
        expect(model?.secondaryActions.map((action) => action.id)).toContain("editText");
        expect(model?.dangerAction.id).toBe("delete");
    });
    it("anchors the toolbar above the selected drawing and clamps it inside the shell", () => {
        const drawing = {
            ...createDrawingObject("trendLine", [{ x: 1_000, y: 106 }, { x: 2_000, y: 104 }], { style: { stroke: "#fff", strokeWidth: 1, opacity: 1 } }),
            paneId: "price",
            yScaleId: "price-right",
        };
        const position = resolveDrawingSelectionToolbarPosition({
            drawing,
            paneSnapshots: [{
                    paneId: "price",
                    bounds: { left: 0, top: 0, width: 1200, height: 420 },
                    plotBounds: { left: 60, top: 8, width: 1072, height: 392 },
                    axisBounds: {},
                    headerAnchor: { left: 60, top: 0, width: 1072 },
                    labelAnchor: { left: 0, top: 0, height: 420 },
                    scaleSlotBounds: { "price-right": { left: 1132, top: 0, width: 68, height: 420 } },
                    scaleSlotStates: { "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 108] } },
                }],
            plotData: [{ date: new Date(1_000) }, { date: new Date(2_000) }, { date: new Date(3_000) }],
            visibleDomain: [new Date(1_000), new Date(3_000)],
            shellSize: { width: 1200, height: 420 },
        });
        expect(position).not.toBeNull();
        expect(position?.x).toBeGreaterThanOrEqual(12);
        expect(position?.y).toBeGreaterThanOrEqual(12);
        expect(position?.y).toBeLessThan(200);
    });
    it("returns null when the selected drawing pane is no longer available", () => {
        const drawing = createDrawingObject("trendLine", [{ x: 1_000, y: 106 }, { x: 2_000, y: 104 }], {
            paneId: "volume",
            yScaleId: "volume-right",
            style: { stroke: "#fff", strokeWidth: 1, opacity: 1 },
        });
        const position = resolveDrawingSelectionToolbarPosition({
            drawing,
            paneSnapshots: [{
                    paneId: "price",
                    bounds: { left: 0, top: 0, width: 1200, height: 420 },
                    plotBounds: { left: 60, top: 8, width: 1072, height: 392 },
                    axisBounds: {},
                    headerAnchor: { left: 60, top: 0, width: 1072 },
                    labelAnchor: { left: 0, top: 0, height: 420 },
                    scaleSlotBounds: { "price-right": { left: 1132, top: 0, width: 68, height: 420 } },
                    scaleSlotStates: { "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 108] } },
                }],
            plotData: [{ date: new Date(1_000) }, { date: new Date(2_000) }, { date: new Date(3_000) }],
            visibleDomain: [new Date(1_000), new Date(3_000)],
            shellSize: { width: 1200, height: 420 },
        });
        expect(position).toBeNull();
    });
    it("returns null when the viewport does not contain visible bars for the selection", () => {
        const drawing = createDrawingObject("trendLine", [{ x: 1_000, y: 106 }, { x: 2_000, y: 104 }], {
            paneId: "price",
            yScaleId: "price-right",
            style: { stroke: "#fff", strokeWidth: 1, opacity: 1 },
        });
        const position = resolveDrawingSelectionToolbarPosition({
            drawing,
            paneSnapshots: [{
                    paneId: "price",
                    bounds: { left: 0, top: 0, width: 1200, height: 420 },
                    plotBounds: { left: 60, top: 8, width: 1072, height: 392 },
                    axisBounds: {},
                    headerAnchor: { left: 60, top: 0, width: 1072 },
                    labelAnchor: { left: 0, top: 0, height: 420 },
                    scaleSlotBounds: { "price-right": { left: 1132, top: 0, width: 68, height: 420 } },
                    scaleSlotStates: { "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 108] } },
                }],
            plotData: [{ date: new Date(10_000) }, { date: new Date(20_000) }, { date: new Date(30_000) }],
            visibleDomain: [new Date(40_000), new Date(50_000)],
            shellSize: { width: 1200, height: 420 },
        });
        expect(position).toBeNull();
    });
});
