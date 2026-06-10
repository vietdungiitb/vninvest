import { describe, expect, it } from "vitest";
import { calculateCycleGeometry, CyclicLines, TimeCycles, SineLine, } from "./cycles";
const scales = {
    xScale: (date) => date.getTime() / 1000,
    xScaleInvert: (px) => new Date(px * 1000),
    yScale: (price) => price * 2,
    yScaleInvert: (px) => px / 2,
};
function makeDrawing(type, nPoints, cycleParams) {
    const points = Array.from({ length: nPoints }, (_, i) => ({ x: i * 2000, y: 50 + i * 5 }));
    return {
        id: "t",
        type,
        points,
        style: { stroke: "#52c41a", strokeWidth: 1 },
        createdAt: 0,
        updatedAt: 0,
        ...(cycleParams ? { cycleParams } : {}),
    };
}
describe("calculateCycleGeometry", () => {
    it("returns null for fewer than 2 points", () => {
        expect(calculateCycleGeometry(makeDrawing("cyclicLines", 1), scales)).toBeNull();
    });
    it("returns correct geometry for cyclicLines", () => {
        const geo = calculateCycleGeometry(makeDrawing("cyclicLines", 2, { count: 8 }), scales);
        expect(geo).not.toBeNull();
        expect(geo.count).toBe(8);
        expect(geo.type).toBe("cyclicLines");
    });
    it("defaults count to 8 when cycleParams missing", () => {
        const geo = calculateCycleGeometry(makeDrawing("timeCycles", 2), scales);
        expect(geo.count).toBe(8);
    });
    it("uses provided amplitude for sineLine", () => {
        const geo = calculateCycleGeometry(makeDrawing("sineLine", 2, { count: 3, amplitude: 50 }), scales);
        expect(geo.amplitude).toBe(50);
    });
});
describe("CyclicLines tool", () => {
    it("createDraft creates 2 points with count=8", () => {
        const d = CyclicLines.createDraft({ x: 0, y: 0 });
        expect(d.points).toHaveLength(2);
        expect(d.cycleParams?.count).toBe(8);
    });
    it("updateDraft replaces next point", () => {
        const d = CyclicLines.createDraft({ x: 0, y: 0 });
        const updated = CyclicLines.updateDraft(d, { x: 100, y: 100 });
        expect(updated.points[1]).toEqual({ x: 100, y: 100 });
    });
});
describe("TimeCycles tool", () => {
    it("createDraft creates 2 points", () => {
        expect(TimeCycles.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
    });
});
describe("SineLine tool", () => {
    it("createDraft creates 2 points with amplitude=40", () => {
        const d = SineLine.createDraft({ x: 0, y: 0 });
        expect(d.points).toHaveLength(2);
        expect(d.cycleParams?.amplitude).toBe(40);
    });
});
