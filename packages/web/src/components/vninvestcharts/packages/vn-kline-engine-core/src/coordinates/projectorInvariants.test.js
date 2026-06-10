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
describe("projector invariants (LP-03)", () => {
    it("INV-01: same xIndexFloat maps to same xPixel for candle/indicator/drawing lanes", () => {
        const visibleRange = { from: -2.5, to: 1.5 };
        const projector = createPaneProjector(snapshot, visibleRange, "price-right");
        const index = 0.75;
        const candleX = projector.indexToPixelX(index);
        const indicatorX = projector.indexToPixelX(index);
        const drawingX = projector.indexToPixelX(index);
        expect(candleX).not.toBeNull();
        expect(indicatorX).toBeCloseTo(candleX, 9);
        expect(drawingX).toBeCloseTo(candleX, 9);
    });
    it("INV-03 + INV-04: offscreen anchors keep index identity under index->pixel->index round-trip", () => {
        const visibleRange = { from: 10, to: 19 };
        const projector = createPaneProjector(snapshot, visibleRange, "price-right");
        const offscreenIndices = [8, 21, 25.5];
        for (const index of offscreenIndices) {
            const pixel = projector.indexToPixelX(index);
            expect(pixel).not.toBeNull();
            const roundTrip = projector.pixelXToIndex(pixel);
            expect(roundTrip).toBeCloseTo(index, 9);
        }
    });
    it("handles reversed and non-finite visible ranges with stable finite output", () => {
        const reversedProjector = createPaneProjector(snapshot, { from: 30, to: 10 }, "price-right");
        const invalidProjector = createPaneProjector(snapshot, { from: Number.NaN, to: Number.POSITIVE_INFINITY }, "price-right");
        expect(reversedProjector.indexToPixelX(20)).not.toBeNull();
        expect(reversedProjector.pixelXToIndex(snapshot.plotBounds.left + snapshot.plotBounds.width / 2)).not.toBeNull();
        expect(invalidProjector.indexToPixelX(0)).toBeCloseTo(snapshot.plotBounds.left + snapshot.plotBounds.width / 2, 9);
        expect(invalidProjector.pixelXToIndex(snapshot.plotBounds.left + snapshot.plotBounds.width / 2)).toBe(0);
    });
    it("keeps extreme shared-envelope ranges finite and reversible near center", () => {
        const projector = createPaneProjector(snapshot, { from: -5_000_000, to: 5_000_000 }, "price-right");
        const centerPixel = snapshot.plotBounds.left + snapshot.plotBounds.width / 2;
        const centerIndex = projector.pixelXToIndex(centerPixel);
        expect(centerIndex).not.toBeNull();
        expect(centerIndex).toBeCloseTo(0, 6);
        const roundTripPixel = projector.indexToPixelX(centerIndex);
        expect(roundTripPixel).not.toBeNull();
        expect(roundTripPixel).toBeCloseTo(centerPixel, 6);
    });
});
