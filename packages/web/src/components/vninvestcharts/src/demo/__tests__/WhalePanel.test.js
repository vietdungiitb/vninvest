import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let act;
let createRoot;
let WhalePanel;
let WidgetI18nProvider;
const sampleWhaleData = {
    symbol: "TCB",
    whale_orders: [],
    summary: {
        buy_value: 3_000_000_000,
        sell_value: 1_000_000_000,
        shark_buy: 1_200_000_000,
        shark_sell: 600_000_000,
        whale_buy: 1_500_000_000,
        whale_sell: 300_000_000,
        small_buy: 300_000_000,
        small_sell: 100_000_000,
    },
};
describe("WhalePanel", () => {
    let container = null;
    let root = null;
    let consoleErrorSpy;
    beforeAll(async () => {
        ({ act } = await import("react"));
        ({ createRoot } = await import("react-dom/client"));
        ({ WhalePanel } = await import("../components"));
        ({ WidgetI18nProvider } = await import("../../widget/context/WidgetI18nContext"));
    });
    beforeEach(() => {
        window.localStorage.clear();
        consoleErrorSpy = vi.spyOn(console, "error");
        consoleErrorSpy.mockImplementation(() => { });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
        consoleErrorSpy.mockRestore();
        window.localStorage.clear();
    });
    it("renders nothing when whale flow data is missing", async () => {
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(WhalePanel, { data: null }) }));
        });
        expect(container?.querySelector(".vnsc-whale-panel")).toBeNull();
        expect(container?.textContent?.trim()).toBe("");
    });
    it("renders the whale summary when data is available", async () => {
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(WhalePanel, { data: sampleWhaleData }) }));
        });
        expect(container?.querySelector(".vnsc-whale-panel")).not.toBeNull();
        expect(container?.textContent).toContain("2.00");
        expect(container?.textContent).not.toContain("Chưa có dữ liệu dòng tiền.");
    });
});
