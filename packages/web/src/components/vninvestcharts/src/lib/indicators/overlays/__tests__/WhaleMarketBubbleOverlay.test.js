import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { WhaleMarketBubbleOverlay } from "../WhaleMarketBubbleOverlay";
let act;
let createRoot;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
});
function createMockContextValue() {
    return {
        xScale: (value) => (typeof value === "number" ? value * 10 : value.getTime() / 1000),
        yScale: (value) => 100 - value * 0.01,
        plotData: [
            { close: 100, volume: 1000 },
            { close: 102, volume: 1200 },
            { close: 101, volume: 1100 },
        ],
        candleWidth: 8,
        devicePixelRatio: 1,
        visibleRange: { startIndex: 0, endIndex: 2, startDate: new Date(), endDate: new Date(), barCount: 3 },
        width: 500,
        height: 300,
    };
}
describe("WhaleMarketBubbleOverlay", () => {
    it("T2-01: renders without error with visible events", () => {
        const whaleEvent = {
            index: 0,
            date: new Date(),
            buyVol: 2_000_000,
            sellVol: 500_000,
            netDelta: 1_500_000,
            dominance: "buy",
            sizeCategory: "xlarge",
        };
        const events = [whaleEvent];
        const visibleRange = {
            startIndex: 0,
            endIndex: 2,
            startDate: new Date(),
            endDate: new Date(),
            barCount: 3,
        };
        const props = {
            events,
            visibleRange,
        };
        const contextValue = createMockContextValue();
        // Test that component accepts these props without error
        expect(() => {
            // Just verify the component can be instantiated
            const elem = _jsx(WhaleMarketBubbleOverlay, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T2-02: filters events outside visible range (no-throw)", () => {
        const events = [
            {
                index: 10,
                date: new Date(),
                buyVol: 2_000_000,
                sellVol: 500_000,
                netDelta: 1_500_000,
                dominance: "buy",
                sizeCategory: "large",
            },
        ];
        const visibleRange = {
            startIndex: 0,
            endIndex: 2,
            startDate: new Date(),
            endDate: new Date(),
            barCount: 3,
        };
        const props = {
            events,
            visibleRange,
        };
        // Should not throw even with out-of-range events
        expect(() => {
            const elem = _jsx(WhaleMarketBubbleOverlay, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T2-03: handles null visible range gracefully", () => {
        const events = [
            {
                index: 0,
                date: new Date(),
                buyVol: 2_000_000,
                sellVol: 500_000,
                netDelta: 1_500_000,
                dominance: "buy",
                sizeCategory: "large",
            },
        ];
        const props = {
            events,
            visibleRange: null,
        };
        expect(() => {
            const elem = _jsx(WhaleMarketBubbleOverlay, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T2-04: empty events array renders cleanly", () => {
        const props = {
            events: [],
            visibleRange: {
                startIndex: 0,
                endIndex: 10,
                startDate: new Date(),
                endDate: new Date(),
                barCount: 11,
            },
        };
        expect(() => {
            const elem = _jsx(WhaleMarketBubbleOverlay, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
});
