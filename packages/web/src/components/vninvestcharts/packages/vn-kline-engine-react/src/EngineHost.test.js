import { jsx as _jsx } from "react/jsx-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { EngineHost } from "./EngineHost";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const panes = [
    {
        id: "price",
        kind: "price",
        labelKey: "pane.price",
        visible: true,
        heightRatio: 2,
        scaleSlots: [{ id: "price-right", side: "right", mode: "auto", visible: true }],
        series: [],
        tooltipMode: "ohlc",
    },
];
const mockPaneSnapshots = [
    {
        paneId: "price",
        bounds: { left: 0, top: 0, width: 1024, height: 640 },
        plotBounds: { left: 0, top: 24, width: 1024, height: 616 },
        axisBounds: {},
        scaleSlotBounds: {},
        headerAnchor: { left: 0, top: 0, width: 1024 },
        labelAnchor: { left: 0, top: 0, height: 640 },
        scaleSlotStates: {},
    },
];
const mockVisibleRange = { from: 0, to: 300 };
const mockOverlayState = {
    crosshair: null,
    hoveredPaneId: null,
    hoveredDataIndex: null,
    xAxisTicks: [
        { key: "price-0", x: 0, dataIndex: 0 },
        { key: "price-150", x: 512, dataIndex: 150 },
        { key: "price-300", x: 1024, dataIndex: 300 },
    ],
    measurement: null,
    drawingPriceLabels: null,
    drawingPrimitives: [],
};
function createMockEngine() {
    let mountedSurface = null;
    const subscribe = vi.fn().mockReturnValue(() => { });
    return {
        mount(container) {
            const surface = container.ownerDocument.createElement("div");
            surface.setAttribute("data-vn-kline-engine", "surface");
            surface.style.position = "relative";
            surface.style.width = "100%";
            surface.style.height = "100%";
            const canvas = container.ownerDocument.createElement("canvas");
            canvas.setAttribute("data-vn-kline-engine", "canvas");
            surface.append(canvas);
            container.append(surface);
            mountedSurface = surface;
        },
        setPaneSpecs: vi.fn(),
        resize: vi.fn(),
        setDataSource: vi.fn(),
        setEnrichedData: vi.fn(),
        setHistorySnapshot: vi.fn(),
        setCameraState: vi.fn(),
        setOverlayInputs: vi.fn(),
        getCameraState: vi.fn(() => ({ barSpacePx: 8, rightOffsetBars: 0, followLatest: true, envelopeMode: "shared" })),
        getDirtyMask: vi.fn(() => 0),
        getLastFlushedMask: vi.fn(() => 0),
        getAxisGridRendererCalls: vi.fn(() => 0),
        resetAxisGridRendererCalls: vi.fn(),
        setTheme: vi.fn(),
        setLocale: vi.fn(),
        getPaneSnapshots: () => mockPaneSnapshots.map((snapshot) => ({
            ...snapshot,
            bounds: { ...snapshot.bounds },
            plotBounds: { ...snapshot.plotBounds },
            axisBounds: { ...snapshot.axisBounds },
            scaleSlotBounds: { ...snapshot.scaleSlotBounds },
            headerAnchor: { ...snapshot.headerAnchor },
            labelAnchor: { ...snapshot.labelAnchor },
            scaleSlotStates: { ...snapshot.scaleSlotStates },
        })),
        getVisibleRange: () => ({ ...mockVisibleRange }),
        getOverlayState: () => ({
            crosshair: mockOverlayState.crosshair ? { ...mockOverlayState.crosshair } : null,
            hoveredPaneId: mockOverlayState.hoveredPaneId,
            hoveredDataIndex: mockOverlayState.hoveredDataIndex,
            xAxisTicks: mockOverlayState.xAxisTicks.map((tick) => ({ ...tick })),
            measurement: null,
            drawingPriceLabels: null,
            drawingPrimitives: [],
        }),
        hitTestDrawingPrimitive: vi.fn(() => null),
        scrollToDataIndex: vi.fn(),
        zoomToRange: vi.fn(),
        subscribe,
        dispose: vi.fn().mockImplementation(() => {
            mountedSurface?.remove();
            mountedSurface = null;
        }),
        isMounted: () => mountedSurface !== null,
    };
}
describe("EngineHost", () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });
    it("mounts the engine surface and disposes it on unmount", async () => {
        const container = document.createElement("div");
        container.style.width = "1024px";
        container.style.height = "640px";
        document.body.appendChild(container);
        const root = createRoot(container);
        const onPaneSnapshotsChange = vi.fn();
        await act(async () => {
            root.render(_jsx(EngineHost, { engineFactory: createMockEngine, panes: panes, locale: "vi", dataSource: { sourceId: "KF-01" }, onPaneSnapshotsChange: onPaneSnapshotsChange }));
        });
        expect(container.querySelector('[data-vn-kline-engine="canvas"]')).not.toBeNull();
        expect(onPaneSnapshotsChange).toHaveBeenCalled();
        expect(onPaneSnapshotsChange.mock.calls.at(-1)?.[0]?.[0]?.paneId).toBe("price");
        await act(async () => {
            root.unmount();
        });
        expect(container.querySelector('[data-vn-kline-engine="canvas"]')).toBeNull();
    });
    it("emits visible range and hovered pane updates through the shared bridge", async () => {
        const container = document.createElement("div");
        container.style.width = "1024px";
        container.style.height = "640px";
        document.body.appendChild(container);
        const root = createRoot(container);
        const onPaneSnapshotsChange = vi.fn();
        const onVisibleRangeChange = vi.fn();
        const onOverlayStateChange = vi.fn();
        const onPaneHover = vi.fn();
        await act(async () => {
            root.render(_jsx(EngineHost, { engineFactory: createMockEngine, panes: panes, locale: "vi", dataSource: { sourceId: "KF-01" }, onPaneSnapshotsChange: onPaneSnapshotsChange, onOverlayStateChange: onOverlayStateChange, onVisibleRangeChange: onVisibleRangeChange, onPaneHover: onPaneHover }));
        });
        const host = container.querySelector('[data-vn-kline-engine-host="true"]');
        expect(host).not.toBeNull();
        if (host === null) {
            throw new Error("Expected engine host to be mounted");
        }
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                left: 0,
                top: 0,
                width: 1024,
                height: 640,
                right: 1024,
                bottom: 640,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        expect(onVisibleRangeChange).toHaveBeenCalledWith({ from: 0, to: 300 });
        expect(onPaneSnapshotsChange).toHaveBeenCalled();
        expect(onOverlayStateChange).toHaveBeenCalledWith(expect.objectContaining({
            xAxisTicks: expect.arrayContaining([
                expect.objectContaining({ key: "price-0", dataIndex: 0 }),
            ]),
        }));
        await act(async () => {
            host.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 128, clientY: 12 }));
        });
        expect(onPaneHover).toHaveBeenCalledWith("price");
        await act(async () => {
            host.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, clientX: 128, clientY: 12 }));
        });
        expect(onPaneHover.mock.calls.at(-1)?.[0]).toBeNull();
        await act(async () => {
            root.unmount();
        });
    });
    it("emits normalized pointer lifecycle callbacks through the host contract", async () => {
        const container = document.createElement("div");
        container.style.width = "1024px";
        container.style.height = "640px";
        document.body.appendChild(container);
        const root = createRoot(container);
        const onPointerDown = vi.fn();
        const onPointerMove = vi.fn();
        const onPointerUp = vi.fn();
        const onPointerCancel = vi.fn();
        const onPointerLeave = vi.fn();
        const onClick = vi.fn();
        const onDoubleClick = vi.fn();
        const onContextMenu = vi.fn();
        await act(async () => {
            root.render(_jsx(EngineHost, { engineFactory: createMockEngine, panes: panes, locale: "vi", dataSource: { sourceId: "KF-01" }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerCancel, onPointerLeave: onPointerLeave, onClick: onClick, onDoubleClick: onDoubleClick, onContextMenu: onContextMenu }));
        });
        const host = container.querySelector('[data-vn-kline-engine-host="true"]');
        expect(host).not.toBeNull();
        if (host === null) {
            throw new Error("Expected engine host to be mounted");
        }
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                left: 0,
                top: 0,
                width: 1024,
                height: 640,
                right: 1024,
                bottom: 640,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await act(async () => {
            host.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 128, clientY: 64, pointerType: "mouse", buttons: 1, ctrlKey: true }));
            host.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 132, clientY: 68, pointerType: "mouse", buttons: 1, shiftKey: true }));
            host.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 132, clientY: 68, pointerType: "mouse" }));
            host.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, clientX: 132, clientY: 68, pointerType: "mouse" }));
            host.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 140, clientY: 70 }));
            host.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 144, clientY: 72 }));
            host.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 148, clientY: 74, buttons: 2 }));
            host.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, clientX: 150, clientY: 76, pointerType: "mouse" }));
        });
        expect(onPointerDown).toHaveBeenCalledWith(expect.objectContaining({
            paneId: "price",
            clientX: 128,
            clientY: 64,
            localX: 128,
            localY: 64,
            buttons: 1,
            ctrlKey: true,
        }));
        expect(onPointerMove).toHaveBeenCalledWith(expect.objectContaining({
            paneId: "price",
            clientX: 132,
            clientY: 68,
            localX: 132,
            localY: 68,
            shiftKey: true,
        }));
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerCancel).toHaveBeenCalledTimes(1);
        expect(onPointerLeave).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onDoubleClick).toHaveBeenCalledTimes(1);
        expect(onContextMenu).toHaveBeenCalledWith(expect.objectContaining({
            paneId: "price",
            clientX: 148,
            clientY: 74,
            localX: 148,
            localY: 74,
            buttons: 2,
        }));
        await act(async () => {
            root.unmount();
        });
    });
    it("fires onContextMenu on touch long-press", async () => {
        vi.useFakeTimers();
        const container = document.createElement("div");
        container.style.width = "1024px";
        container.style.height = "640px";
        document.body.appendChild(container);
        const root = createRoot(container);
        const onContextMenu = vi.fn();
        await act(async () => {
            root.render(_jsx(EngineHost, { engineFactory: createMockEngine, panes: panes, locale: "vi", dataSource: { sourceId: "KF-LONG-PRESS" }, onContextMenu: onContextMenu }));
        });
        const host = container.querySelector('[data-vn-kline-engine-host="true"]');
        expect(host).not.toBeNull();
        if (host === null) {
            throw new Error("Expected engine host to be mounted");
        }
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                left: 0,
                top: 0,
                width: 1024,
                height: 640,
                right: 1024,
                bottom: 640,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await act(async () => {
            host.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 11,
                pointerType: "touch",
                clientX: 180,
                clientY: 96,
                buttons: 1,
            }));
            vi.advanceTimersByTime(500);
        });
        expect(onContextMenu).toHaveBeenCalledWith(expect.objectContaining({
            paneId: "price",
            pointerType: "touch",
            localX: 180,
            localY: 96,
        }));
        await act(async () => {
            root.unmount();
        });
    });
    it("cancels touch long-press when movement exceeds threshold", async () => {
        vi.useFakeTimers();
        const container = document.createElement("div");
        container.style.width = "1024px";
        container.style.height = "640px";
        document.body.appendChild(container);
        const root = createRoot(container);
        const onContextMenu = vi.fn();
        await act(async () => {
            root.render(_jsx(EngineHost, { engineFactory: createMockEngine, panes: panes, locale: "vi", dataSource: { sourceId: "KF-LONG-PRESS-CANCEL" }, onContextMenu: onContextMenu }));
        });
        const host = container.querySelector('[data-vn-kline-engine-host="true"]');
        expect(host).not.toBeNull();
        if (host === null) {
            throw new Error("Expected engine host to be mounted");
        }
        Object.defineProperty(host, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                left: 0,
                top: 0,
                width: 1024,
                height: 640,
                right: 1024,
                bottom: 640,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        await act(async () => {
            host.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true,
                pointerId: 12,
                pointerType: "touch",
                clientX: 180,
                clientY: 96,
                buttons: 1,
            }));
            host.dispatchEvent(new PointerEvent("pointermove", {
                bubbles: true,
                pointerId: 12,
                pointerType: "touch",
                clientX: 196,
                clientY: 96,
                buttons: 1,
            }));
            vi.advanceTimersByTime(600);
        });
        expect(onContextMenu).not.toHaveBeenCalled();
        await act(async () => {
            root.unmount();
        });
    });
});
