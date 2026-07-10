import { vi } from "vitest";
import { resolvePanePixelAtDataIndex, resolvePanePixelAtValue } from "@vninvestcharts/vn-kline-engine-core";
import { DEFAULT_PANES } from "../../lib/core";
import { computePaneScaleSlotDomains } from "../../lib/core/paneScaleSlotDomains";

export const forkEngineSnapshots = [
    {
        paneId: "price",
        bounds: { left: 0, top: 0, width: 1200, height: 420 },
        plotBounds: { left: 0, top: 28, width: 1200, height: 392 },
        axisBounds: {
            right: { left: 1152, top: 0, width: 48, height: 420 },
        },
        headerAnchor: { left: 0, top: 0, width: 1200 },
        labelAnchor: { left: 0, top: 0, height: 420 },
        scaleSlotBounds: { "price-right": { left: 1152, top: 0, width: 48, height: 420 } },
        scaleSlotStates: { "price-right": { side: "right", mode: "auto", visible: true, domain: [98, 107] } },
    },
    {
        paneId: "volume",
        bounds: { left: 0, top: 420, width: 1200, height: 180 },
        plotBounds: { left: 0, top: 448, width: 1200, height: 152 },
        axisBounds: {
            right: { left: 1152, top: 420, width: 48, height: 180 },
        },
        headerAnchor: { left: 0, top: 420, width: 1200 },
        labelAnchor: { left: 0, top: 0, height: 180 },
        scaleSlotBounds: { "volume-right": { left: 1152, top: 420, width: 48, height: 180 } },
        scaleSlotStates: { "volume-right": { side: "right", mode: "auto", visible: true, domain: [1200, 1500] } },
    },
];

export const forkRuntimeData = [
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

export function mergeTestPaneSnapshotDomains(data) {
    const scaleSlotDomains = computePaneScaleSlotDomains(DEFAULT_PANES.filter((pane) => pane.visible), data);
    return forkEngineSnapshots.map((snapshot) => {
        const scaleSlotStates = Object.fromEntries(Object.entries(snapshot.scaleSlotStates).map(([scaleSlotId, state]) => [scaleSlotId, {
                ...state,
                domain: scaleSlotDomains[scaleSlotId] ?? state.domain,
            }]));
        return {
            ...snapshot,
            scaleSlotStates,
        };
    });
}

export function resolveDrawingPointIndex(data, pointTime) {
    return data.findIndex((datum) => datum.date.getTime() === pointTime);
}

export function resolveTrendLineBodyPoint(data, drawing, visibleRange) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    const firstPoint = drawing.points[0];
    const secondPoint = drawing.points[1];
    if (!priceSnapshot || !firstPoint || !secondPoint) {
        return null;
    }
    const firstIndex = resolveDrawingPointIndex(data, firstPoint.x);
    const secondIndex = resolveDrawingPointIndex(data, secondPoint.x);
    if (firstIndex < 0 || secondIndex < 0) {
        return null;
    }
    const firstX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, firstIndex + 0.5, data.length);
    const secondX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, secondIndex + 0.5, data.length);
    const firstY = resolvePanePixelAtValue(priceSnapshot, "price-right", firstPoint.y);
    const secondY = resolvePanePixelAtValue(priceSnapshot, "price-right", secondPoint.y);
    if (firstX === null || secondX === null || firstY === null || secondY === null) {
        return null;
    }
    return {
        x: Math.round((firstX + secondX) / 2),
        y: Math.round((firstY + secondY) / 2),
    };
}

export function resolveTrendLinePointPixel(data, visibleRange, dataIndex, price) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    if (!priceSnapshot) {
        return null;
    }
    const x = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, dataIndex + 0.5, data.length);
    const y = resolvePanePixelAtValue(priceSnapshot, "price-right", price);
    if (x === null || y === null) {
        return null;
    }
    return {
        x: Math.round(x),
        y: Math.round(y),
    };
}

export function resolveTrendLineLockHandlePoint(data, drawing, visibleRange) {
    const priceSnapshot = mergeTestPaneSnapshotDomains(data).find((snapshot) => snapshot.paneId === "price");
    const firstPoint = drawing.points[0];
    const secondPoint = drawing.points[1];
    if (!priceSnapshot || !firstPoint || !secondPoint) {
        return null;
    }
    const firstIndex = resolveDrawingPointIndex(data, firstPoint.x);
    const secondIndex = resolveDrawingPointIndex(data, secondPoint.x);
    if (firstIndex < 0 || secondIndex < 0) {
        return null;
    }
    const firstX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, firstIndex + 0.5, data.length);
    const secondX = resolvePanePixelAtDataIndex(priceSnapshot, visibleRange, secondIndex + 0.5, data.length);
    const firstY = resolvePanePixelAtValue(priceSnapshot, "price-right", firstPoint.y);
    const secondY = resolvePanePixelAtValue(priceSnapshot, "price-right", secondPoint.y);
    if (firstX === null || secondX === null || firstY === null || secondY === null) {
        return null;
    }
    return {
        x: Math.round(Math.min(firstX, secondX) - 14),
        y: Math.round(Math.min(firstY, secondY) - 14),
    };
}

export function createAdapter(fetchBarsPromise, label) {
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

export function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}

export async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

export async function waitForTruthyValue(resolveValue, attempts = 6) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const value = resolveValue();
        if (value) {
            return value;
        }
        await new Promise((r) => setTimeout(r, 0));
    }
    throw new Error("Expected truthy value before timeout");
}
