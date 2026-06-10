import { describe, expect, it } from "vitest";
import { findNearestOverlayEndpointSnap, MAGNET_TOLERANCE } from "./canvasOverlaySnap";
describe("canvasOverlaySnap", () => {
    it("exposes the expected magnet tolerance levels", () => {
        expect(MAGNET_TOLERANCE.weak).toBe(5);
        expect(MAGNET_TOLERANCE.normal).toBe(10);
        expect(MAGNET_TOLERANCE.strong).toBe(20);
    });
    it("selects the nearest endpoint within tolerance", () => {
        const snap = findNearestOverlayEndpointSnap(100, 100, [
            { chartPoint: { x: 1, y: 1 }, pixelPoint: { x: 96, y: 101 } },
            { chartPoint: { x: 2, y: 2 }, pixelPoint: { x: 104, y: 98 } },
        ], 10);
        expect(snap).toMatchObject({
            chartPoint: { x: 1, y: 1 },
            pixelPoint: { x: 96, y: 101 },
            snapType: "endpoint",
        });
    });
    it("returns null when no point is in range", () => {
        expect(findNearestOverlayEndpointSnap(100, 100, [{ chartPoint: { x: 1, y: 1 }, pixelPoint: { x: 140, y: 140 } }], 10)).toBeNull();
    });
});
