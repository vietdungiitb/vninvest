import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SaveChartAsImage from "../../lib/helper/SaveChartAsImage";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
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
describe("VNInvestCharts menu actions", () => {
    let VNInvestCharts;
    let container = null;
    let root = null;
    let restoreGetContext = null;
    beforeEach(async () => {
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
        vi.restoreAllMocks();
    });
    it("renders all four menu buttons in the OHLC header", async () => {
        const data = Array.from({ length: 5 }, (_, index) => createBar(`2026-06-01T${String(index).padStart(2, "0")}:00:00Z`, 100 + index, index));
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(data),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "legacy", locale: "vi", data: data, symbol: "BTCUSDT", timeframe: "1h", showHeader: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        const searchBtn = container?.querySelector('[data-testid="menu-search-btn"]');
        const settingsBtn = container?.querySelector('[data-testid="menu-settings-btn"]');
        const fullscreenBtn = container?.querySelector('[data-testid="menu-fullscreen-btn"]');
        const snapshotBtn = container?.querySelector('[data-testid="menu-snapshot-btn"]');
        expect(searchBtn).not.toBeNull();
        expect(settingsBtn).not.toBeNull();
        expect(fullscreenBtn).not.toBeNull();
        expect(snapshotBtn).not.toBeNull();
    });
    it("toggles search overlay and triggers settings open", async () => {
        const data = Array.from({ length: 5 }, (_, index) => createBar(`2026-06-01T${String(index).padStart(2, "0")}:00:00Z`, 100 + index, index));
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(data),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "legacy", locale: "vi", data: data, symbol: "BTCUSDT", timeframe: "1h", showHeader: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // 1. Check Search toggle
        const searchBtn = container?.querySelector('[data-testid="menu-search-btn"]');
        expect(container?.querySelector(".vnsc-symbol-search-dropdown-container")).toBeNull();
        await act(async () => {
            searchBtn.click();
            await flushMicrotasks();
        });
        expect(container?.querySelector(".vnsc-symbol-search-dropdown-container")).not.toBeNull();
        await act(async () => {
            searchBtn.click();
            await flushMicrotasks();
        });
        expect(container?.querySelector(".vnsc-symbol-search-dropdown-container")).toBeNull();
        // 2. Check Settings open
        const settingsBtn = container?.querySelector('[data-testid="menu-settings-btn"]');
        expect(document.body.querySelector('[data-testid="settings-modal"]')).toBeNull();
        await act(async () => {
            settingsBtn.click();
            await flushMicrotasks();
        });
        expect(document.body.querySelector('[data-testid="settings-modal"]')).not.toBeNull();
    });
    it("opens snapshot preview modal on camera button click and allows saving or cancelling", async () => {
        const data = Array.from({ length: 5 }, (_, index) => createBar(`2026-06-01T${String(index).padStart(2, "0")}:00:00Z`, 100 + index, index));
        const adapter = {
            fetchBarsInRange: vi.fn().mockResolvedValue(data),
            fetchBarsBefore: vi.fn().mockResolvedValue([]),
            subscribeToBar: vi.fn().mockReturnValue(() => undefined),
            subscribeToTrades: vi.fn().mockReturnValue(() => undefined),
            subscribeToOrderbook: vi.fn().mockReturnValue(() => undefined),
            searchSymbols: vi.fn().mockResolvedValue([]),
        };
        const mockDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        const saveSpy = vi.spyOn(SaveChartAsImage, "save").mockImplementation((doc, containerElement, bg, isDark, cb) => {
            cb(mockDataUrl);
        });
        await act(async () => {
            root?.render(_jsx(VNInvestCharts, { adapter: adapter, engineRuntime: "legacy", locale: "vi", data: data, symbol: "BTCUSDT", timeframe: "1h", showHeader: true }));
            for (let iteration = 0; iteration < 6; iteration += 1) {
                await flushMicrotasks();
            }
        });
        // 1. Initial State: No preview modal
        expect(document.body.querySelector('[data-testid="snapshot-preview-modal"]')).toBeNull();
        // 2. Click camera button to capture
        const snapshotBtn = container?.querySelector('[data-testid="menu-snapshot-btn"]');
        await act(async () => {
            snapshotBtn.click();
            await flushMicrotasks();
        });
        expect(saveSpy).toHaveBeenCalledTimes(1);
        // 3. Preview modal is displayed with correct image source
        const previewModal = document.body.querySelector('[data-testid="snapshot-preview-modal"]');
        expect(previewModal).not.toBeNull();
        const img = previewModal?.querySelector("img");
        expect(img?.getAttribute("src")).toBe(mockDataUrl);
        // 4. Click Save
        const saveBtn = document.body.querySelector('[data-testid="snapshot-preview-save"]');
        expect(saveBtn).not.toBeNull();
        // Spy on createElement to make sure it triggers download
        const createElementSpy = vi.spyOn(document, "createElement");
        await act(async () => {
            saveBtn.click();
            await flushMicrotasks();
        });
        // Modal should close
        expect(document.body.querySelector('[data-testid="snapshot-preview-modal"]')).toBeNull();
        expect(createElementSpy).toHaveBeenCalledWith("a");
        createElementSpy.mockRestore();
        // 5. Open again and test Cancel
        await act(async () => {
            snapshotBtn.click();
            await flushMicrotasks();
        });
        expect(document.body.querySelector('[data-testid="snapshot-preview-modal"]')).not.toBeNull();
        const cancelBtn = document.body.querySelector('[data-testid="snapshot-preview-cancel"]');
        expect(cancelBtn).not.toBeNull();
        await act(async () => {
            cancelBtn.click();
            await flushMicrotasks();
        });
        // Modal should close
        expect(document.body.querySelector('[data-testid="snapshot-preview-modal"]')).toBeNull();
    });
});
