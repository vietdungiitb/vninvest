import { describe, expect, it } from "vitest";
import { resolveDemoRuntimeStatusBadge, resolveDemoTopbarStatusBadge } from "../topbarStatusBadge";
describe("resolveDemoTopbarStatusBadge", () => {
    const t = (key) => key;
    it("returns the offline fallback badge for Binance fallback mode", () => {
        const badge = resolveDemoTopbarStatusBadge({
            activeSource: "binance",
            dataStatus: "offline",
            dataError: "network unavailable",
            vniError: null,
            t,
        });
        expect(badge).toEqual({
            className: "gc-offline-badge",
            label: "common.offlineFallback",
            title: "network unavailable",
        });
    });
    it("returns the loading badge for VNI loading state", () => {
        const badge = resolveDemoTopbarStatusBadge({
            activeSource: "vninvest",
            dataStatus: "loading",
            dataError: "",
            vniError: null,
            t,
        });
        expect(badge).toEqual({
            className: "gc-loading-badge",
            label: "vninvest.loading",
        });
    });
    it("returns an auto canary runtime badge with the resolved runtime in the label", () => {
        const badge = resolveDemoRuntimeStatusBadge({
            requestedLane: "auto",
            resolvedRuntime: "fork",
            chartCanvasOverlays: true,
            drawingOverlays: false,
            t,
        });
        expect(badge).toEqual({
            className: "gc-loading-badge",
            label: "library.runtimeLane.autoToFork",
            title: "library.runtimeLane.chartCanvasReady",
        });
    });
});
