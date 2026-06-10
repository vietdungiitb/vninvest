import { describe, expect, it } from "vitest";
import { createDrawingObject } from "./shared";
import { resizeDrawingsByIds, translateDrawingsByIds } from "./DrawingLayer";
describe("translateDrawingsByIds", () => {
    it("moves only the selected drawing by the provided chart delta", () => {
        const moved = createDrawingObject("trendLine", [
            { x: 100, y: 20 },
            { x: 200, y: 40 },
        ], { id: "drawing-1" });
        const untouched = createDrawingObject("rectangle", [
            { x: 300, y: 60 },
            { x: 380, y: 120 },
        ], { id: "drawing-2" });
        const nextDrawings = translateDrawingsByIds([moved, untouched], [moved.id], 15, -8);
        expect(nextDrawings[0]).toMatchObject({
            id: "drawing-1",
            points: [
                { x: 115, y: 12 },
                { x: 215, y: 32 },
            ],
        });
        expect(nextDrawings[1]).toBe(untouched);
        expect(moved.points).toEqual([
            { x: 100, y: 20 },
            { x: 200, y: 40 },
        ]);
        expect(nextDrawings[0]).not.toBe(moved);
    });
    it("preserves and updates canonical anchors when translating selected drawings", () => {
        const moved = createDrawingObject("trendLine", [
            { x: 1_710_000_000_000, y: 100, xIndexFloat: 10, timeMsHint: 1_710_000_000_000, yPrice: 100 },
            { x: 1_710_000_060_000, y: 105, xIndexFloat: 11, timeMsHint: 1_710_000_060_000, yPrice: 105 },
        ], { id: "drawing-anchor-1" });
        const nextDrawings = translateDrawingsByIds([moved], [moved.id], 60_000, -2, 1.5);
        expect(nextDrawings[0].points).toEqual([
            { x: 1_710_000_060_000, y: 98, xIndexFloat: 11.5, timeMsHint: 1_710_000_060_000, yPrice: 98 },
            { x: 1_710_000_120_000, y: 103, xIndexFloat: 12.5, timeMsHint: 1_710_000_120_000, yPrice: 103 },
        ]);
    });
});
describe("resizeDrawingsByIds", () => {
    it("keeps hLine horizontal when a handle is resized", () => {
        const line = createDrawingObject("hLine", [
            { x: 100, y: 20 },
            { x: 200, y: 20 },
        ], { id: "drawing-3" });
        const nextDrawings = resizeDrawingsByIds([line], [line.id], 1, { x: 260, y: 120 });
        expect(nextDrawings[0]).toMatchObject({
            id: "drawing-3",
            points: [
                { x: 100, y: 20 },
                { x: 260, y: 20 },
            ],
        });
        expect(line.points).toEqual([
            { x: 100, y: 20 },
            { x: 200, y: 20 },
        ]);
    });
    it("recomputes longPosition riskReward when a handle moves", () => {
        const position = createDrawingObject("longPosition", [
            { x: 100, y: 30 },
            { x: 200, y: 50 },
        ], { id: "drawing-4", riskReward: { entry: 30, stop: 30, target: 50 } });
        const nextDrawings = resizeDrawingsByIds([position], [position.id], 1, { x: 240, y: 70 });
        expect(nextDrawings[0]).toMatchObject({
            points: [
                { x: 100, y: 30 },
                { x: 240, y: 70 },
            ],
            riskReward: {
                entry: 30,
                stop: 30,
                target: 70,
            },
        });
        expect(position.riskReward).toEqual({
            entry: 30,
            stop: 30,
            target: 50,
        });
    });
    it("keeps constrained anchors stable when resizing hLine and vLine", () => {
        const hLine = createDrawingObject("hLine", [
            { x: 100, y: 20, timeMsHint: 100, yPrice: 20 },
            { x: 200, y: 20, timeMsHint: 200, yPrice: 20 },
        ], { id: "drawing-hline" });
        const vLine = createDrawingObject("vLine", [
            { x: 300, y: 40, xIndexFloat: 3, timeMsHint: 300, yPrice: 40 },
            { x: 300, y: 60, xIndexFloat: 3, timeMsHint: 300, yPrice: 60 },
        ], { id: "drawing-vline" });
        const [nextHLine] = resizeDrawingsByIds([hLine], [hLine.id], 1, {
            x: 260,
            y: 120,
            timeMsHint: 260,
            yPrice: 120,
        });
        expect(nextHLine.points[1]).toEqual({
            x: 260,
            y: 20,
            timeMsHint: 260,
            yPrice: 20,
        });
        const [nextVLine] = resizeDrawingsByIds([vLine], [vLine.id], 0, {
            x: 500,
            y: 90,
            timeMsHint: 500,
            yPrice: 90,
        });
        expect(nextVLine.points[0]).toEqual({
            x: 300,
            y: 90,
            xIndexFloat: 3,
            timeMsHint: 300,
            yPrice: 90,
        });
    });
    it("preserves canonical anchors on resized point when nextPoint omits anchor metadata", () => {
        const trendLine = createDrawingObject("trendLine", [
            { x: 100, y: 20, xIndexFloat: 2.5, timeMsHint: 100, yPrice: 20 },
            { x: 200, y: 40, xIndexFloat: 3.5, timeMsHint: 200, yPrice: 40 },
        ], { id: "drawing-trend-anchor" });
        const [resized] = resizeDrawingsByIds([trendLine], [trendLine.id], 1, {
            x: 260,
            y: 70,
        });
        expect(resized.points[1]).toEqual({
            x: 260,
            y: 70,
            xIndexFloat: 3.5,
            timeMsHint: 200,
            yPrice: 40,
        });
    });
});
