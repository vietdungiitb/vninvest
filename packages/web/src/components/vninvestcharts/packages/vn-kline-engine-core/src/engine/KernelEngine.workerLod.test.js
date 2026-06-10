// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createEngine } from "../index";
function createCanvasContextMock() {
    return {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        translate: vi.fn(),
        setLineDash: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        closePath: vi.fn(),
        createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
        set lineWidth(_value) {
            void _value;
        },
        set globalAlpha(_value) {
            void _value;
        },
        set strokeStyle(_value) {
            void _value;
        },
        set fillStyle(_value) {
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
describe("KernelEngine worker LOD integration", () => {
    it("BU-30-03-01: renders cached worker LOD output when the worker lane resolves a slice", () => {
        const candlePanes = [
            {
                id: "price",
                kind: "price",
                labelKey: "pane.price",
                visible: true,
                heightRatio: 3,
                scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
                series: [{ id: "candle-main", type: "Candlestick", scaleSlotId: "price-right", visible: true }],
                tooltipMode: "ohlc",
            },
        ];
        const engine = createEngine();
        const bars = Array.from({ length: 64 }, (_, index) => ({
            open: 100 + index,
            high: 102 + index,
            low: 99 + index,
            close: 101 + index,
            volume: 1000 + index,
        }));
        const container = document.createElement("div");
        container.style.width = "900px";
        container.style.height = "320px";
        document.body.appendChild(container);
        const contextMock = createCanvasContextMock();
        const getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockImplementation((contextId) => (contextId === "2d" ? contextMock : null));
        const workerLodData = [
            { x: 0, open: 100, high: 120, low: 95, close: 118 },
            { x: 32, open: 118, high: 140, low: 110, close: 135 },
        ];
        const resolveSpy = vi.spyOn(engine.candlestickLodWorkerLane, "resolve").mockReturnValue({
            requestKey: "worker-cache-key",
            lodData: workerLodData,
            fromWorker: true,
        });
        engine.setEnrichedData(bars);
        engine.zoomToRange({ from: 0, to: 64 });
        engine.setPaneSpecs(candlePanes);
        engine.mount(container);
        expect(resolveSpy).toHaveBeenCalled();
        expect(contextMock.fillRect.mock.calls).toHaveLength(workerLodData.length);
        expect(engine.lastCandlestickRenderCache.get("price:candle-main:price-right")).toMatchObject({
            requestKey: "worker-cache-key",
            lodSource: "worker",
            lodData: workerLodData,
        });
        resolveSpy.mockRestore();
        getContextSpy.mockRestore();
        container.remove();
    });
});
