import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let latestVisibleDomainHandler;
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
            latestVisibleDomainHandler = props.onVisibleDomainChange;
            return _jsx("div", { "data-testid": "dynamic-chart" });
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
async function waitForVisibleDomainHandler(attempts = 30) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        if (latestVisibleDomainHandler) {
            return latestVisibleDomainHandler;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Timed out waiting for visible-domain handler");
}
async function emitVisibleDomain(domain) {
    const visibleDomainHandler = await waitForVisibleDomainHandler();
    await act(async () => {
        visibleDomainHandler(domain);
        for (let iteration = 0; iteration < 6; iteration += 1) {
            await flushMicrotasks();
        }
    });
}
async function waitForPredicate(predicate, attempts = 30) {
    for (let iteration = 0; iteration < attempts; iteration += 1) {
        if (predicate()) {
            return;
        }
        await act(async () => {
            await flushMicrotasks();
        });
    }
    throw new Error("Timed out waiting for predicate");
}
describe("VNInvestCharts shared history sync queue", () => {
    let VNInvestCharts;
    let container = null;
    let root = null;
    let restoreGetContext = null;
    beforeEach(async () => {
        latestVisibleDomainHandler = undefined;
        const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
        restoreGetContext = () => getContextSpy.mockRestore();
        ({ VNInvestCharts } = await import("../VNInvestCharts"));
    });
    afterEach(async () => {
        latestVisibleDomainHandler = undefined;
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
    it("re-runs the shared history sync once for the same legacy visible domain while the first sync is in flight", async () => {
        const initialBars = [
            createBar("2026-05-20T00:00:00Z", 100, 0),
            createBar("2026-05-20T01:00:00Z", 101, 1),
            createBar("2026-05-20T02:00:00Z", 102, 2),
            createBar("2026-05-20T03:00:00Z", 103, 3),
            createBar("2026-05-20T04:00:00Z", 104, 4),
            createBar("2026-05-20T05:00:00Z", 105, 5),
            createBar("2026-05-20T06:00:00Z", 106, 6),
        ];
        const firstOlderBars = [
            createBar("2026-05-19T22:00:00Z", 98, 0),
            createBar("2026-05-19T23:00:00Z", 99, 1),
        ];
        const secondOlderBars = [
            createBar("2026-05-19T19:00:00Z", 95, 0),
            createBar("2026-05-19T20:00:00Z", 96, 1),
            createBar("2026-05-19T21:00:00Z", 97, 2),
        ];
        let resolveFirstOlderBars;
        const firstOlderBarsPromise = new Promise((resolve) => {
            resolveFirstOlderBars = resolve;
        });
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(initialBars),
            fetchBarsBefore: vi.fn()
                .mockImplementationOnce(() => firstOlderBarsPromise)
                .mockResolvedValueOnce(secondOlderBars)
                .mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        container = document.createElement("div");
        container.style.width = "1200px";
        container.style.height = "720px";
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, historyMinResidentBars: 0, symbol: "BTCUSDT", timeframe: "1h", engineRuntime: "legacy", showNonTradingDays: true }));
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        expect(adapter.fetchBarsBefore).not.toHaveBeenCalled();
        await emitVisibleDomain([initialBars[0].date, initialBars[5].date]);
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length === 1);
        await emitVisibleDomain([initialBars[0].date, initialBars[5].date]);
        await emitVisibleDomain([initialBars[0].date, initialBars[5].date]);
        await act(async () => {
            resolveFirstOlderBars?.(firstOlderBars);
            for (let iteration = 0; iteration < 8; iteration += 1) {
                await flushMicrotasks();
            }
        });
        await waitForPredicate(() => adapter.fetchBarsBefore.mock.calls.length === 2);
        expect(adapter.fetchBarsBefore.mock.calls.map((call) => (call[2].toISOString()))).toEqual([
            "2026-05-20T00:00:00.000Z",
            "2026-05-19T22:00:00.000Z",
        ]);
    });
});
