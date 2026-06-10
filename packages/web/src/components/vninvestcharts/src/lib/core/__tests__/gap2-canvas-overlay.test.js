import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Component } from "react";
import { ChartRenderContext, useChartRenderContext } from "../canvas/ChartRenderContext";
import { OverlayCanvas } from "../canvas/OverlayCanvas";
import { WhaleBubbleOverlay } from "../../indicators/overlays/WhaleBubbleOverlay";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let act;
let createRoot;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
});
function createBars(count, startDate = new Date("2026-01-01T00:00:00.000Z")) {
    return Array.from({ length: count }, (_unused, index) => {
        const date = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);
        const open = 100 + index;
        const close = open + (index % 2 === 0 ? 3 : -2);
        return {
            date,
            open,
            high: Math.max(open, close) + 2,
            low: Math.min(open, close) - 2,
            close,
            volume: 1_000 + index * 10,
        };
    });
}
function createCanvasContextMock() {
    return {
        canvas: { width: 0, height: 0 },
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        scale: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        setLineDash: vi.fn(),
        closePath: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        set fillStyle(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set lineWidth(_value) {
            void _value;
        },
        set font(_value) {
            void _value;
        },
        set textAlign(_value) {
            void _value;
        },
        set textBaseline(_value) {
            void _value;
        },
    };
}
function createRenderContext(overrides = {}) {
    const bars = createBars(3);
    return {
        xScale: (value) => value instanceof Date ? value.getTime() / 1000 : value,
        yScale: (value) => value * 2,
        plotData: bars,
        candleWidth: 12,
        devicePixelRatio: 2,
        visibleRange: {
            startIndex: 0,
            endIndex: 2,
            startDate: bars[0]?.date ?? new Date(0),
            endDate: bars[2]?.date ?? new Date(0),
            barCount: 3,
        },
        width: 480,
        height: 280,
        ...overrides,
    };
}
describe("Gap 2 — canvas overlay system", () => {
    let container = null;
    let root = null;
    let getContextSpy = null;
    let canvasContext;
    let consoleErrorSpy;
    beforeEach(() => {
        canvasContext = createCanvasContextMock();
        getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => canvasContext);
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
        getContextSpy?.mockRestore();
        getContextSpy = null;
        consoleErrorSpy.mockRestore();
    });
    afterAll(() => {
        void 0;
    });
    it("renders inside the chart render context and calls draw", async () => {
        const draw = vi.fn();
        const contextValue = createRenderContext();
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(OverlayCanvas, { draw: draw }) }));
        });
        expect(draw).toHaveBeenCalledTimes(1);
        expect(draw).toHaveBeenCalledWith(expect.objectContaining({
            ctx: canvasContext,
            width: 480,
            height: 280,
            candleWidth: 12,
            devicePixelRatio: 2,
        }));
    });
    it("throws when useChartRenderContext is used outside the provider", async () => {
        let caughtError = null;
        class Boundary extends Component {
            state = { hasError: false };
            static getDerivedStateFromError() {
                return { hasError: true };
            }
            componentDidCatch(error) {
                caughtError = error;
            }
            render() {
                return this.state.hasError ? _jsx("div", { children: "fallback" }) : this.props.children;
            }
        }
        function Probe() {
            useChartRenderContext();
            return _jsx("div", {});
        }
        await act(async () => {
            root?.render(_jsx(Boundary, { children: _jsx(Probe, {}) }));
        });
        expect(caughtError).not.toBeNull();
        if (!caughtError) {
            throw new Error("Expected useChartRenderContext to throw outside the provider");
        }
        expect(caughtError.message).toMatch(/useChartRenderContext/);
    });
    it("keeps the overlay canvas pointer-events disabled", async () => {
        const draw = vi.fn();
        const contextValue = createRenderContext();
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(OverlayCanvas, { draw: draw, zIndex: 7 }) }));
        });
        const canvas = container?.querySelector("canvas");
        expect(canvas?.style.pointerEvents).toBe("none");
    });
    it("logs draw errors without rethrowing them", async () => {
        const draw = vi.fn(() => {
            throw new Error("draw boom");
        });
        const contextValue = createRenderContext();
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(OverlayCanvas, { draw: draw }) }));
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith("OverlayCanvas draw failed:", expect.any(Error));
    });
    it("renders whale bubbles for matching events", async () => {
        const contextValue = createRenderContext();
        const events = [
            { ts: new Date("2026-01-01T00:00:00.000Z"), price: 101, side: "BUY", matchedValue: 8_000_000_000, severity: "HIGH" },
            { ts: new Date("2026-01-03T00:00:00.000Z"), price: 103, side: "SELL", matchedValue: 15_000_000_000, severity: "EXTREME" },
        ];
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(WhaleBubbleOverlay, { events: events }) }));
        });
        expect(canvasContext.arc).toHaveBeenCalledTimes(2);
        expect(canvasContext.fillText).toHaveBeenCalledWith("▼", expect.any(Number), expect.any(Number));
    });
    it("skips whale events without matching bars", async () => {
        const contextValue = createRenderContext();
        const events = [
            { ts: new Date("1900-01-01T00:00:00.000Z"), price: 50, side: "BUY", matchedValue: 9_000_000_000, severity: "HIGH" },
        ];
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(WhaleBubbleOverlay, { events: events }) }));
        });
        expect(canvasContext.arc).not.toHaveBeenCalled();
    });
    it("scales extreme whale bubbles and labels them", async () => {
        const contextValue = createRenderContext();
        const events = [
            { ts: new Date("2026-01-02T00:00:00.000Z"), price: 102, side: "BUY", matchedValue: 20_000_000_000, severity: "EXTREME" },
        ];
        await act(async () => {
            root?.render(_jsx(ChartRenderContext.Provider, { value: contextValue, children: _jsx(WhaleBubbleOverlay, { events: events }) }));
        });
        expect(canvasContext.arc).toHaveBeenCalledTimes(1);
        expect(canvasContext.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), 0, Math.PI * 2);
        expect(canvasContext.fillText).toHaveBeenCalledWith("▲", expect.any(Number), expect.any(Number));
    });
});
