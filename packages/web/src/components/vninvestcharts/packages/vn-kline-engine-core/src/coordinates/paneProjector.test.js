import { describe, expect, it } from "vitest";
import { createPaneProjector } from "./paneProjector";
const snapshot = {
    paneId: "price",
    bounds: { left: 0, top: 0, width: 1200, height: 420 },
    plotBounds: { left: 48, top: 28, width: 1104, height: 392 },
    axisBounds: {
        left: { left: 0, top: 0, width: 48, height: 420 },
        right: { left: 1152, top: 0, width: 48, height: 420 },
    },
    scaleSlotBounds: {
        "price-right": { left: 1152, top: 0, width: 48, height: 420 },
    },
    scaleSlotStates: {
        "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 122] },
    },
    headerAnchor: { left: 48, top: 0, width: 1104 },
    labelAnchor: { left: 0, top: 0, height: 420 },
};
const visibleRange = { from: 10, to: 19 };
describe("paneProjector", () => {
    it("maps visible index span to plot bounds", () => {
        const projector = createPaneProjector(snapshot, visibleRange, "price-right");
        expect(projector.indexToPixelX(10)).toBe(48);
        expect(projector.indexToPixelX(19)).toBe(48 + snapshot.plotBounds.width);
        expect(projector.pixelXToIndex(48)).toBe(10);
        expect(projector.pixelXToIndex(48 + snapshot.plotBounds.width)).toBe(19);
    });
    it("keeps offscreen coordinates outside plot bounds", () => {
        const projector = createPaneProjector(snapshot, visibleRange, "price-right");
        const leftOffscreen = projector.indexToPixelX(8);
        const rightOffscreen = projector.indexToPixelX(21);
        expect(leftOffscreen).not.toBeNull();
        expect(rightOffscreen).not.toBeNull();
        expect(leftOffscreen).toBeLessThan(snapshot.plotBounds.left);
        expect(rightOffscreen).toBeGreaterThan(snapshot.plotBounds.left + snapshot.plotBounds.width);
    });
    it("maps scale values to pixels and back", () => {
        const projector = createPaneProjector(snapshot, visibleRange, "price-right");
        expect(projector.valueToPixelY(122)).toBe(snapshot.plotBounds.top);
        expect(projector.valueToPixelY(98)).toBe(snapshot.plotBounds.top + snapshot.plotBounds.height);
        expect(projector.pixelYToValue(snapshot.plotBounds.top)).toBe(122);
        expect(projector.pixelYToValue(snapshot.plotBounds.top + snapshot.plotBounds.height)).toBe(98);
    });
    it("clamps extreme visible-range bounds into shared-envelope domain", () => {
        const projector = createPaneProjector(snapshot, { from: -9_999_999, to: 9_999_999 }, "price-right");
        expect(projector.indexToPixelX(0)).toBeCloseTo(snapshot.plotBounds.left + snapshot.plotBounds.width / 2, 6);
        expect(projector.pixelXToIndex(snapshot.plotBounds.left + snapshot.plotBounds.width / 2)).toBeCloseTo(0, 6);
    });
    it("treats near-zero spans as stable centered windows", () => {
        const projector = createPaneProjector(snapshot, { from: 120, to: 120 + 1e-8 }, "price-right");
        expect(projector.indexToPixelX(120)).toBeCloseTo(snapshot.plotBounds.left + snapshot.plotBounds.width / 2, 6);
        expect(projector.pixelXToIndex(snapshot.plotBounds.left + snapshot.plotBounds.width / 3)).toBeCloseTo(120, 9);
    });
});
