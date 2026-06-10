import { describe, expect, it } from "vitest";
import { createPaneProjector } from "./paneProjector";
function createLegacyProjectorOracle(snapshot, visibleRange, scaleSlotId) {
    const from = Math.min(visibleRange.from, visibleRange.to);
    const to = Math.max(visibleRange.from, visibleRange.to);
    const span = Math.max(0, to - from);
    const { left, top, width, height } = snapshot.plotBounds;
    const domain = snapshot.scaleSlotStates[scaleSlotId]?.domain;
    if (!domain) {
        throw new Error(`Missing scale domain for ${scaleSlotId}`);
    }
    const minValue = domain[0];
    const maxValue = domain[1];
    return {
        indexToPixelX(index) {
            if (span === 0) {
                return left + width / 2;
            }
            return left + ((index - from) / span) * width;
        },
        pixelXToIndex(pixelX) {
            if (span === 0) {
                return from;
            }
            return from + ((pixelX - left) / width) * span;
        },
        valueToPixelY(value) {
            if (maxValue === minValue) {
                return top + height / 2;
            }
            return top + ((maxValue - value) / (maxValue - minValue)) * height;
        },
        pixelYToValue(pixelY) {
            return maxValue - ((pixelY - top) / height) * (maxValue - minValue);
        },
    };
}
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
const cameraFrames = [
    { from: 0, to: 100 },
    { from: -2.5, to: 1.5 },
    { from: 120.25, to: 130.75 },
    { from: 40, to: 10 },
];
const sampleIndices = [-4, 0, 0.5, 1, 13.25, 55, 102, 140];
const samplePixels = [48, 120, 256, 640, 930, 1152];
const sampleValues = [98, 100, 108.5, 116, 122];
const sampleYPixels = [28, 84, 196, 311, 420];
describe("legacyForkParityHarness", () => {
    it("keeps fork pane projector pixel mapping in parity with legacy oracle across camera frames", () => {
        for (const frame of cameraFrames) {
            const forkProjector = createPaneProjector(snapshot, frame, "price-right");
            const legacyProjector = createLegacyProjectorOracle(snapshot, frame, "price-right");
            for (const index of sampleIndices) {
                expect(forkProjector.indexToPixelX(index)).toBeCloseTo(legacyProjector.indexToPixelX(index), 9);
            }
            for (const pixelX of samplePixels) {
                expect(forkProjector.pixelXToIndex(pixelX)).toBeCloseTo(legacyProjector.pixelXToIndex(pixelX), 9);
            }
            for (const value of sampleValues) {
                expect(forkProjector.valueToPixelY(value)).toBeCloseTo(legacyProjector.valueToPixelY(value), 9);
            }
            for (const pixelY of sampleYPixels) {
                expect(forkProjector.pixelYToValue(pixelY)).toBeCloseTo(legacyProjector.pixelYToValue(pixelY), 9);
            }
        }
    });
    it("keeps index and value round-trip stable under fractional camera windows", () => {
        const fractionalFrame = { from: -1.25, to: 2.75 };
        const projector = createPaneProjector(snapshot, fractionalFrame, "price-right");
        for (const index of sampleIndices) {
            const pixel = projector.indexToPixelX(index);
            expect(pixel).not.toBeNull();
            const roundTripIndex = projector.pixelXToIndex(pixel);
            expect(roundTripIndex).toBeCloseTo(index, 9);
        }
        for (const value of sampleValues) {
            const pixel = projector.valueToPixelY(value);
            expect(pixel).not.toBeNull();
            const roundTripValue = projector.pixelYToValue(pixel);
            expect(roundTripValue).toBeCloseTo(value, 9);
        }
    });
});
