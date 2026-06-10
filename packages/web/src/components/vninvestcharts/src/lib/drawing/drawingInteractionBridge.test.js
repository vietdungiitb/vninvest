import { describe, expect, it } from "vitest";
import { scaleLinear, scaleTime } from "d3-scale";
import { createDrawingFrameSnapshot, createDrawingInteractionCommand, findSnapPointWithContext, hitTestDrawingWithContext, resolveDrawingManipulationIntentWithContext, resolveDrawingInteractionContext, resolveDrawingPointWithContext, } from "./drawingInteractionBridge";
import { createDrawingObject } from "./shared";
const plotData = [
    { date: new Date("2026-01-01T00:00:00.000Z"), open: 45, high: 55, low: 40, close: 50, volume: 1_000 },
    { date: new Date("2026-01-02T00:00:00.000Z"), open: 55, high: 65, low: 50, close: 60, volume: 1_200 },
];
function createBridge() {
    const xScale = scaleTime()
        .domain([plotData[0].date, plotData[1].date])
        .range([100, 300]);
    const yScale = scaleLinear()
        .domain([0, 100])
        .range([220, 120]);
    const bridge = {
        resolveChartPoint: ({ x, y }) => ({
            x: xScale.invert(x).getTime(),
            y: yScale.invert(y),
        }),
        chartPointToPixel: ({ point }) => ({
            x: xScale(new Date(point.x)),
            y: yScale(point.y),
        }),
    };
    return { bridge, xScale, yScale };
}
describe("drawingInteractionBridge", () => {
    it("converts bridge pixel coordinates into local drawing interaction context", () => {
        const { bridge } = createBridge();
        const context = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 200,
            y: 170,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(context).toMatchObject({
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            mousePosition: [100, 50],
            chartPoint: {
                x: plotData[0].date.getTime() + (plotData[1].date.getTime() - plotData[0].date.getTime()) / 2,
                y: 50,
            },
        });
        expect(context?.renderScales.yScale(50)).toBeCloseTo(50, 6);
    });
    it("creates a stable drawing frame snapshot and command envelope from bridge context", () => {
        const { bridge } = createBridge();
        const context = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 200,
            y: 170,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(context).toBeDefined();
        const pointer = {
            clientX: 200,
            clientY: 170,
            localX: 100,
            localY: 50,
            pointerType: "pen",
            buttons: 1,
            altKey: false,
            ctrlKey: true,
            metaKey: false,
            shiftKey: true,
        };
        const frame = createDrawingFrameSnapshot(context, pointer);
        const command = createDrawingInteractionCommand("pointerdown", context, pointer);
        expect(frame).toMatchObject({
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            mousePosition: [100, 50],
            plotDataLength: 2,
            pointer: {
                clientX: 200,
                clientY: 170,
                localX: 100,
                localY: 50,
                buttons: 1,
                pointerType: "pen",
                modifiers: {
                    ctrlKey: true,
                    shiftKey: true,
                },
            },
        });
        expect(command).toMatchObject({
            type: "pointerdown",
            frame,
            pointer,
        });
        expect(command.pointer).not.toBe(pointer);
    });
    it("hit-tests and snaps drawings using the shared bridge context", () => {
        const { bridge } = createBridge();
        const line = createDrawingObject("hLine", [
            { x: plotData[0].date.getTime(), y: 50 },
            { x: plotData[1].date.getTime(), y: 50 },
        ], { id: "line-1", paneId: "momentum", yScaleId: "momentum-right" });
        const trend = createDrawingObject("trendLine", [
            { x: plotData[0].date.getTime(), y: 50 },
            { x: plotData[1].date.getTime(), y: 60 },
        ], { id: "trend-1", paneId: "momentum", yScaleId: "momentum-right" });
        const hoverContext = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 200,
            y: 170,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(hoverContext).toBeDefined();
        expect(hitTestDrawingWithContext(line, hoverContext)).toBe(true);
        const snapContext = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 102,
            y: 170,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(snapContext).toBeDefined();
        const snap = findSnapPointWithContext([trend], snapContext, "weak");
        expect(snap).toMatchObject({
            snapType: "ohlc",
            chartPoint: { x: plotData[0].date.getTime(), y: 50 },
        });
        const resolved = resolveDrawingPointWithContext([trend], snapContext, "weak");
        expect(resolved).toMatchObject({
            point: { x: plotData[0].date.getTime(), y: 50 },
            snap: { snapType: "ohlc" },
        });
    });
    it("resolves manipulation intent (resize/move/miss) from interaction context", () => {
        const { bridge } = createBridge();
        const trend = createDrawingObject("trendLine", [
            { x: plotData[0].date.getTime(), y: 50 },
            { x: plotData[1].date.getTime(), y: 60 },
        ], { id: "trend-intent", paneId: "momentum", yScaleId: "momentum-right" });
        const resizeContext = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 100,
            y: 170,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(resizeContext).toBeDefined();
        expect(resolveDrawingManipulationIntentWithContext(trend, resizeContext)).toMatchObject({
            mode: "resize",
            handleIndex: 0,
        });
        const moveContext = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 200,
            y: 165,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(moveContext).toBeDefined();
        expect(resolveDrawingManipulationIntentWithContext(trend, moveContext)).toEqual({ mode: "move" });
        const missContext = resolveDrawingInteractionContext({
            bridge,
            paneId: "momentum",
            scaleSlotId: "momentum-right",
            chartWidth: 200,
            chartHeight: 100,
            x: 340,
            y: 230,
            plotData,
            xAccessor: (datum) => datum.date,
            yDomain: [0, 100],
            pixelOffset: { x: 100, y: 120 },
        });
        expect(missContext).toBeDefined();
        expect(resolveDrawingManipulationIntentWithContext(trend, missContext)).toBeNull();
    });
});
