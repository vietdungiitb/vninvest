import { describe, expect, it } from "vitest";
import { resolvePaneDataIndexAtPixel, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, resolvePaneValueAtPixel, } from "./coordinateBridge";
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
describe("coordinateBridge", () => {
    it("maps plot pixels to visible data indexes and back", () => {
        expect(resolvePaneDataIndexAtPixel(snapshot, visibleRange, 48, 50)).toBe(10);
        expect(resolvePaneDataIndexAtPixel(snapshot, visibleRange, 48 + snapshot.plotBounds.width, 50)).toBe(19);
        expect(resolvePaneDataIndexAtPixel(snapshot, visibleRange, 48 + snapshot.plotBounds.width / 2, 50)).toBe(15);
        expect(resolvePanePixelAtDataIndex(snapshot, visibleRange, 10, 50)).toBe(48);
        expect(resolvePanePixelAtDataIndex(snapshot, visibleRange, 19, 50)).toBe(48 + snapshot.plotBounds.width);
    });
    it("keeps fractional data indexes when mapping to pane pixels", () => {
        const xFromFractionalIndex = resolvePanePixelAtDataIndex(snapshot, visibleRange, 14.5, 50);
        expect(xFromFractionalIndex).toBeCloseTo(48 + (4.5 / 9) * snapshot.plotBounds.width, 6);
    });
    it("keeps data indexes outside the visible range outside the plot bounds", () => {
        const leftOffscreenPixel = resolvePanePixelAtDataIndex(snapshot, visibleRange, 8, 50);
        const rightOffscreenPixel = resolvePanePixelAtDataIndex(snapshot, visibleRange, 21, 50);
        expect(leftOffscreenPixel).toBeLessThan(snapshot.plotBounds.left);
        expect(rightOffscreenPixel).toBeGreaterThan(snapshot.plotBounds.left + snapshot.plotBounds.width);
    });
    it("maps plot pixels to pane values and back using scale-slot domains", () => {
        expect(resolvePaneValueAtPixel(snapshot, "price-right", snapshot.plotBounds.top)).toBe(122);
        expect(resolvePaneValueAtPixel(snapshot, "price-right", snapshot.plotBounds.top + snapshot.plotBounds.height)).toBe(98);
        expect(resolvePanePixelAtValue(snapshot, "price-right", 122)).toBe(snapshot.plotBounds.top);
        expect(resolvePanePixelAtValue(snapshot, "price-right", 98)).toBe(snapshot.plotBounds.top + snapshot.plotBounds.height);
        expect(resolvePaneValueAtPixel(snapshot, "missing", snapshot.plotBounds.top + 10)).toBeNull();
    });
    it("handles out-of-bounds indexes by projecting them un-clamped and hit-testing with clamps", () => {
        const rangeWithNegative = { from: -10, to: 10 };
        // Negative index projection (index-to-pixel map API) should NOT clamp:
        // Index -5 is 5 units from -10, total span is 20.
        // Ratio is 5 / 20 = 0.25. Screen X = 48 + 0.25 * 1104 = 324.
        const projectedPixel = resolvePanePixelAtDataIndex(snapshot, rangeWithNegative, -5, 50);
        expect(projectedPixel).toBe(48 + 0.25 * snapshot.plotBounds.width);
        // Hit-test pixel corresponding to index -5 (pixel X = 324) should clamp to 0 (pixel-to-index map API)
        const hitTestedIndex = resolvePaneDataIndexAtPixel(snapshot, rangeWithNegative, 324, 50);
        expect(hitTestedIndex).toBe(0);
    });
});
