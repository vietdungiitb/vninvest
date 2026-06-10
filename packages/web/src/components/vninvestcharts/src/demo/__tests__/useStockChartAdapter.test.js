import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStockChartAdapter } from "../useStockChartAdapter";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
function createDataAdapter(result) {
    return {
        name: "binance",
        getBars: vi.fn().mockResolvedValue(result),
    };
}
function createWidgetBar(timestamp, close, index) {
    return {
        date: new Date(timestamp),
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 1000 + index,
        index,
        dataIndex: index,
    };
}
function Harness(props) {
    const adapter = useStockChartAdapter({
        activeSource: props.activeSource,
        dataAdapter: props.dataAdapter,
        selectedSymbol: props.selectedSymbol,
        useWidgetOwnedHistory: props.useWidgetOwnedHistory,
        widgetData: props.widgetData,
        backfillPageLimit: props.backfillPageLimit,
    });
    useEffect(() => {
        props.onAdapter(adapter);
    }, [adapter, props.onAdapter]);
    return null;
}
describe("useStockChartAdapter", () => {
    let container = null;
    let root = null;
    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
        }
        root = null;
        container?.remove();
        container = null;
    });
    it("giữ nguyên adapter identity khi widget-owned history cập nhật bars", async () => {
        const dataAdapter = createDataAdapter({ bars: [], hasMore: true });
        const captureAdapter = vi.fn();
        const initialBars = [createWidgetBar("2024-01-01T09:00:00Z", 100, 0)];
        const nextBars = [...initialBars, createWidgetBar("2024-01-01T10:00:00Z", 101, 1)];
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(Harness, { activeSource: "binance", backfillPageLimit: 300, dataAdapter: dataAdapter, onAdapter: captureAdapter, selectedSymbol: "BTCUSDT", useWidgetOwnedHistory: true, widgetData: initialBars }));
        });
        const firstAdapter = captureAdapter.mock.calls[0]?.[0];
        expect(firstAdapter).toBeTruthy();
        expect(captureAdapter).toHaveBeenCalledTimes(1);
        await act(async () => {
            root?.render(_jsx(Harness, { activeSource: "binance", backfillPageLimit: 300, dataAdapter: dataAdapter, onAdapter: captureAdapter, selectedSymbol: "BTCUSDT", useWidgetOwnedHistory: true, widgetData: nextBars }));
        });
        expect(captureAdapter).toHaveBeenCalledTimes(1);
        expect(captureAdapter.mock.calls[0]?.[0]).toBe(firstAdapter);
    });
    it("đọc widgetData mới nhất qua ref mà không recreate adapter", async () => {
        const dataAdapter = createDataAdapter({ bars: [], hasMore: true });
        const captureAdapter = vi.fn();
        const initialBars = [createWidgetBar("2024-01-01T09:00:00Z", 100, 0)];
        const nextBars = [...initialBars, createWidgetBar("2024-01-01T10:00:00Z", 101, 1)];
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(Harness, { activeSource: "offline", backfillPageLimit: 300, dataAdapter: dataAdapter, onAdapter: captureAdapter, selectedSymbol: "BTCUSDT", useWidgetOwnedHistory: false, widgetData: initialBars }));
        });
        const adapter = captureAdapter.mock.calls[0]?.[0];
        expect(captureAdapter).toHaveBeenCalledTimes(1);
        await expect(adapter.fetchBarsInRange("BTCUSDT", "1h", new Date("2024-01-01T00:00:00Z"), new Date("2024-01-02T00:00:00Z"))).resolves.toHaveLength(1);
        await act(async () => {
            root?.render(_jsx(Harness, { activeSource: "offline", backfillPageLimit: 300, dataAdapter: dataAdapter, onAdapter: captureAdapter, selectedSymbol: "BTCUSDT", useWidgetOwnedHistory: false, widgetData: nextBars }));
        });
        expect(captureAdapter).toHaveBeenCalledTimes(1);
        await expect(adapter.fetchBarsInRange("BTCUSDT", "1h", new Date("2024-01-01T00:00:00Z"), new Date("2024-01-02T00:00:00Z"))).resolves.toMatchObject([
            { close: 100 },
            { close: 101 },
        ]);
        await expect(adapter.fetchBarsBefore("BTCUSDT", "1h", new Date("2024-01-01T10:30:00Z"), 5)).resolves.toMatchObject([
            { close: 100 },
            { close: 101 },
        ]);
    });
    it("exposes source semantics for the active data source", async () => {
        const dataAdapter = createDataAdapter({ bars: [], hasMore: true });
        const captureAdapter = vi.fn();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(Harness, { activeSource: "binance", backfillPageLimit: 300, dataAdapter: dataAdapter, onAdapter: captureAdapter, selectedSymbol: "BTCUSDT", useWidgetOwnedHistory: true, widgetData: [] }));
        });
        const adapter = captureAdapter.mock.calls[0]?.[0];
        expect(adapter.getSourceSemantics?.()).toMatchObject({
            sourceId: "binance",
            coverageMode: "exact-range",
            supportsExactRangeFetch: true,
            supportsBackwardAnchor: true,
        });
    });
});
