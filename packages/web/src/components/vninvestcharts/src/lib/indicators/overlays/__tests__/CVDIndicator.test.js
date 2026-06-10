import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CVDIndicator } from "../CVDIndicator";
describe("CVDIndicator", () => {
    it("T5-01: renders without error with valid data", () => {
        const data = [
            {
                date: new Date(),
                open: 100,
                high: 105,
                low: 95,
                close: 102,
                volume: 1000,
                cvdApprox: 200,
            },
        ];
        const visibleRange = {
            startIndex: 0,
            endIndex: 0,
            startDate: new Date(),
            endDate: new Date(),
            barCount: 1,
        };
        const props = {
            data,
            visibleRange,
            mode: "oscillator",
        };
        expect(() => {
            const elem = _jsx(CVDIndicator, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T5-02: handles null visible range gracefully", () => {
        const data = [
            {
                date: new Date(),
                open: 100,
                high: 105,
                low: 95,
                close: 102,
                volume: 1000,
                cvdApprox: 200,
            },
        ];
        const props = {
            data,
            visibleRange: null,
            mode: "oscillator",
        };
        expect(() => {
            const elem = _jsx(CVDIndicator, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T5-03: handles empty data gracefully", () => {
        const props = {
            data: [],
            visibleRange: {
                startIndex: 0,
                endIndex: 10,
                startDate: new Date(),
                endDate: new Date(),
                barCount: 11,
            },
            mode: "oscillator",
        };
        expect(() => {
            const elem = _jsx(CVDIndicator, { ...props });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
    it("T5-04: renders with different modes", () => {
        const data = [
            {
                date: new Date(),
                open: 100,
                high: 105,
                low: 95,
                close: 102,
                volume: 1000,
                cvdApprox: 200,
            },
        ];
        const visibleRange = {
            startIndex: 0,
            endIndex: 0,
            startDate: new Date(),
            endDate: new Date(),
            barCount: 1,
        };
        // Oscillator mode
        expect(() => {
            const elem = _jsx(CVDIndicator, { data: data, visibleRange: visibleRange, mode: "oscillator" });
            expect(elem).toBeDefined();
        }).not.toThrow();
        // Histogram mode
        expect(() => {
            const elem = _jsx(CVDIndicator, { data: data, visibleRange: visibleRange, mode: "histogram" });
            expect(elem).toBeDefined();
        }).not.toThrow();
    });
});
