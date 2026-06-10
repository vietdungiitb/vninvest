import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { useState, act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VNInvestCharts } from "../VNInvestCharts";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args) => { };
vi.mock("../../lib/core/hooks/useCanvasResize", () => {
    const ref = { current: null };
    return {
        useCanvasResize: () => ({
            ref,
            size: { width: 1200, height: 720 },
        }),
    };
});
function createAdapter(fetchBarsPromise, label) {
    const fetchBarsInRange = vi.fn().mockReturnValue(fetchBarsPromise);
    const fetchBarsBefore = vi.fn().mockResolvedValue([]);
    return {
        fetchBarsInRange,
        fetchBarsBefore,
        fetchBars: fetchBarsInRange,
        fetchMoreBars: fetchBarsBefore,
        subscribeToBar: vi.fn().mockReturnValue(() => { }),
        subscribeToTrades: vi.fn().mockReturnValue(() => { }),
        subscribeToOrderbook: vi.fn().mockReturnValue(() => { }),
        searchSymbols: vi.fn().mockResolvedValue([]),
        label,
    };
}
async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
async function waitForTruthyValue(resolveValue, attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const value = resolveValue();
        if (value) {
            return value;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Expected truthy value before timeout");
}
const forkRuntimeData = [
    {
        date: new Date("2024-01-01T09:00:00Z"),
        open: 100,
        high: 105,
        low: 98,
        close: 103,
        volume: 1200,
        index: 0,
        dataIndex: 0,
    },
    {
        date: new Date("2024-01-01T10:00:00Z"),
        open: 103,
        high: 107,
        low: 101,
        close: 106,
        volume: 1500,
        index: 1,
        dataIndex: 1,
    },
];
describe("VNInvestCharts legacy pane snapshots", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
    });
    afterEach(async () => {
        await act(async () => {
            await flushMicrotasks();
            root?.unmount();
            await flushMicrotasks();
        });
        root = null;
        container?.remove();
        container = null;
        window.localStorage.clear();
        document.documentElement.lang = "en";
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });
    it("exposes pane snapshots through the widget contract on the legacy runtime", async () => {
        const adapter = createAdapter(Promise.resolve([]), "legacy-snapshots");
        const handlePaneSnapshotsChange = vi.fn();
        const handlePaneHover = vi.fn();
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "legacy", locale: "vi", onPaneSnapshotsChange: handlePaneSnapshotsChange, onPaneHover: handlePaneHover }));
        });
        const snapshots = await waitForTruthyValue(() => handlePaneSnapshotsChange.mock.calls
            .map((call) => call[0])
            .findLast((value) => Array.isArray(value) && value.length > 0));
        if (!Array.isArray(snapshots)) {
            throw new Error("Expected pane snapshots");
        }
        const paneSnapshots = snapshots;
        expect(paneSnapshots.length).toBeGreaterThan(0);
        expect(paneSnapshots[0]).toMatchObject({
            paneId: expect.any(String),
            plotBounds: expect.objectContaining({ left: expect.any(Number), width: expect.any(Number) }),
        });
        const priceSnapshot = paneSnapshots.find((snapshot) => snapshot.paneId === "price");
        expect(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.length).toBe(2);
        expect(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.[0]).toBeLessThan(priceSnapshot?.scaleSlotStates["price-right"]?.domain?.[1] ?? Number.POSITIVE_INFINITY);
        const widgetRoot = container.firstElementChild;
        expect(widgetRoot).not.toBeNull();
        Object.defineProperty(widgetRoot, "getBoundingClientRect", {
            configurable: true,
            value: () => ({
                bottom: 720,
                height: 720,
                left: 0,
                right: 1200,
                top: 0,
                width: 1200,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });
        const PointerEventCtor = window.PointerEvent ?? window.MouseEvent;
        const hoveredSnapshot = paneSnapshots[Math.min(1, paneSnapshots.length - 1)];
        await act(async () => {
            const clientX = hoveredSnapshot.bounds.left + 8;
            const clientY = hoveredSnapshot.bounds.top + 8;
            widgetRoot?.dispatchEvent(new PointerEventCtor("pointermove", { bubbles: true, clientX, clientY }));
            widgetRoot?.dispatchEvent(new PointerEventCtor("pointerout", { bubbles: true }));
        });
        expect(handlePaneHover).toHaveBeenCalled();
        expect(handlePaneHover.mock.calls[0]?.[0]).toBe(hoveredSnapshot.paneId);
        expect(handlePaneHover.mock.calls.at(-1)?.[0]).toBeNull();
        expect(adapter.fetchBars).not.toHaveBeenCalled();
    });
    it("does not loop when a legacy parent stores pane snapshots and runtime capabilities", async () => {
        const adapter = createAdapter(Promise.resolve([]), "legacy-parent-state-sync");
        let renderCount = 0;
        function Harness() {
            renderCount += 1;
            const [snapshots, setSnapshots] = useState([]);
            const [capabilities, setCapabilities] = useState(null);
            return (_jsx("div", { "data-render-count": String(renderCount), "data-runtime": capabilities?.engineRuntime ?? "none", "data-snapshot-count": String(snapshots.length), children: _jsx(VNInvestCharts, { adapter: adapter, data: forkRuntimeData, engineRuntime: "legacy", onPaneSnapshotsChange: setSnapshots, onRuntimeCapabilitiesChange: setCapabilities }) }));
        }
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(Harness, {}));
            await flushMicrotasks();
        });
        const stateHost = container.firstElementChild;
        expect(stateHost?.dataset.runtime).toBe("legacy");
        expect(Number(stateHost?.dataset.snapshotCount ?? "0")).toBeGreaterThan(0);
        expect(renderCount).toBeLessThan(10);
    });
});
