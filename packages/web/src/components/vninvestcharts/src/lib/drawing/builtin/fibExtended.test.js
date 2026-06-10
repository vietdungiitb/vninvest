import { describe, expect, it } from "vitest";
import { calculateFibExtendedGeometry, FIB_EXTENDED_LEVELS, FIB_FAN_RATIOS, FIB_EXTENDED_TWO_POINT, FIB_EXTENDED_THREE_POINT, FibChannel, FibSpeedResistanceFan, FibCircles, FibSpiral, FibSpeedResistanceArcs, TrendBasedFibTime, FibWedge, Pitchfan, } from "./fibExtended";
const scales = {
    xScale: (date) => date.getTime() / 1000,
    xScaleInvert: (px) => new Date(px * 1000),
    yScale: (price) => price * 10,
    yScaleInvert: (px) => px / 10,
};
function makeDrawing(type, nPoints) {
    const points = Array.from({ length: nPoints }, (_, i) => ({ x: i * 1000, y: i * 5 }));
    return {
        id: "test",
        type,
        points,
        style: { stroke: "#00bcd4", strokeWidth: 1 },
        createdAt: 0,
        updatedAt: 0,
    };
}
describe("FIB_EXTENDED_LEVELS", () => {
    it("contains 10 levels starting with 0.236", () => {
        expect(FIB_EXTENDED_LEVELS).toHaveLength(10);
        expect(FIB_EXTENDED_LEVELS[0]).toBe(0.236);
    });
});
describe("FIB_FAN_RATIOS", () => {
    it("starts with 0 and ends with 1.0", () => {
        expect(FIB_FAN_RATIOS[0]).toBe(0);
        expect(FIB_FAN_RATIOS[FIB_FAN_RATIOS.length - 1]).toBe(1.0);
    });
});
describe("FIB_EXTENDED_TWO_POINT / THREE_POINT", () => {
    it("two-point set contains fibCircles", () => {
        expect(FIB_EXTENDED_TWO_POINT).toContain("fibCircles");
    });
    it("three-point set contains fibChannel", () => {
        expect(FIB_EXTENDED_THREE_POINT).toContain("fibChannel");
    });
});
describe("calculateFibExtendedGeometry", () => {
    it("returns null for fewer than 2 points", () => {
        const d = makeDrawing("fibCircles", 1);
        expect(calculateFibExtendedGeometry(d, scales)).toBeNull();
    });
    it("returns p1 and p2 for 2-point tool", () => {
        const d = makeDrawing("fibCircles", 2);
        const geo = calculateFibExtendedGeometry(d, scales);
        expect(geo).not.toBeNull();
        expect(geo.p1).toBeDefined();
        expect(geo.p2).toBeDefined();
        expect(geo.p3).toBeUndefined();
    });
    it("returns p3 for 3-point tool", () => {
        const d = makeDrawing("fibChannel", 3);
        const geo = calculateFibExtendedGeometry(d, scales);
        expect(geo.p3).toBeDefined();
    });
});
describe("FibChannel tool", () => {
    it("createDraft creates 3 points all equal", () => {
        const start = { x: 10, y: 20 };
        const draft = FibChannel.createDraft(start);
        expect(draft.points).toHaveLength(3);
        for (const p of draft.points)
            expect(p).toEqual(start);
    });
    it("updateDraft replaces only the last point (DT-20 fix)", () => {
        const draft = FibChannel.createDraft({ x: 0, y: 0 });
        const updated = FibChannel.updateDraft(draft, { x: 5, y: 5 });
        // updateDraft tracks cursor at LAST point only; points[1] stays as placeholder
        expect(updated.points[2]).toEqual({ x: 5, y: 5 });
        expect(updated.points[1]).toEqual({ x: 0, y: 0 });
    });
});
describe("FibSpeedResistanceFan tool", () => {
    it("createDraft creates 2 points", () => {
        expect(FibSpeedResistanceFan.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
    });
});
describe("FibCircles tool", () => {
    it("createDraft creates 2 points", () => {
        expect(FibCircles.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
    });
});
describe("FibSpiral tool", () => {
    it("createDraft creates 2 points", () => {
        expect(FibSpiral.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
    });
});
describe("FibSpeedResistanceArcs tool", () => {
    it("createDraft creates 2 points", () => {
        expect(FibSpeedResistanceArcs.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
    });
});
describe("TrendBasedFibTime tool", () => {
    it("createDraft creates 3 points", () => {
        expect(TrendBasedFibTime.createDraft({ x: 0, y: 0 }).points).toHaveLength(3);
    });
});
describe("FibWedge tool", () => {
    it("createDraft creates 3 points", () => {
        expect(FibWedge.createDraft({ x: 0, y: 0 }).points).toHaveLength(3);
    });
});
describe("Pitchfan tool", () => {
    it("createDraft creates 3 points", () => {
        expect(Pitchfan.createDraft({ x: 0, y: 0 }).points).toHaveLength(3);
    });
});
