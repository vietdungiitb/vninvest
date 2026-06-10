import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let latestRenderedBars = [];
vi.mock("../../lib/core/hooks/useCanvasResize", () => {
    const ref = { current: null };
    return {
        useCanvasResize: () => ({
            ref,
            size: { width: 1200, height: 720 },
        }),
    };
});
vi.mock("../../lib/core", async () => {
    const React = await import("react");
    const actual = await vi.importActual("../../lib/core");
    return {
        ...actual,
        useChartTheme: () => ({
            theme: "light",
            toggleTheme: () => undefined,
            isDark: false,
        }),
        DynamicChart: (props) => {
            latestRenderedBars = props.data;
            return _jsx("div", { "data-testid": "dynamic-chart", children: props.children });
        },
    };
});
function createBar(timestamp, close, index) {
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
async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}
describe("VNInvestCharts canary rollback", () => {
    let VNInvestCharts;
    let container = null;
    let root = null;
    let restoreGetContext = null;
    beforeEach(async () => {
        latestRenderedBars = [];
        const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
        restoreGetContext = () => getContextSpy.mockRestore();
        ({ VNInvestCharts } = await import("../VNInvestCharts"));
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        latestRenderedBars = [];
        if (root) {
            await act(async () => {
                root?.unmount();
                await flushMicrotasks();
            });
        }
        root = null;
        container?.remove();
        container = null;
        restoreGetContext?.();
        restoreGetContext = null;
    });
    it("emits rollback events for 100% to 30% and 30% to 10% transitions", async () => {
        const data = Array.from({ length: 10 }, (_, index) => createBar(`2026-06-01T${String(index).padStart(2, "0")}:00:00Z`, 100 + index, index));
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(data),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        const handleRollback = vi.fn();
        const renderChart = async (canaryLevel) => {
            await act(async () => {
                root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "legacy", locale: "vi", data: data, canaryLevel: canaryLevel, onCanaryRollbackEvent: handleRollback }));
                for (let iteration = 0; iteration < 6; iteration += 1) {
                    await flushMicrotasks();
                }
            });
        };
        await renderChart(10);
        expect(latestRenderedBars).toHaveLength(1);
        await renderChart(30);
        expect(handleRollback).not.toHaveBeenCalled();
        expect(latestRenderedBars).toHaveLength(3);
        await renderChart(100);
        expect(handleRollback).not.toHaveBeenCalled();
        expect(latestRenderedBars).toHaveLength(10);
        await renderChart(30);
        expect(handleRollback).toHaveBeenCalledTimes(1);
        expect(handleRollback.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            previousLevel: 100,
            newLevel: 30,
            beforeMetrics: expect.objectContaining({ barCount: 10 }),
            afterMetrics: expect.objectContaining({ barCount: 3 }),
            validation: expect.objectContaining({ safe: true, barCountDifference: -7 }),
        }));
        expect(latestRenderedBars).toHaveLength(3);
        await renderChart(10);
        expect(handleRollback).toHaveBeenCalledTimes(2);
        expect(handleRollback.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
            previousLevel: 30,
            newLevel: 10,
            beforeMetrics: expect.objectContaining({ barCount: 3 }),
            afterMetrics: expect.objectContaining({ barCount: 1 }),
            validation: expect.objectContaining({ safe: true, barCountDifference: -2 }),
        }));
        expect(latestRenderedBars).toHaveLength(1);
    });
});
