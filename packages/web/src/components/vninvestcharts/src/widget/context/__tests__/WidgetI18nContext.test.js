import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args) => { };
let act;
let createRoot;
let WidgetI18nProvider;
let useWidgetI18n;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ WidgetI18nProvider, useWidgetI18n } = await import("../WidgetI18nContext"));
});
let setLocaleForTest = null;
function WidgetI18nProbe() {
    const { locale, setLocale, t } = useWidgetI18n();
    setLocaleForTest = setLocale;
    return (_jsx("div", { "data-locale": locale, "data-loading-label": t("widget.loading"), "data-no-data-label": t("widget.noData"), "data-measurement-title": t("measurement.title"), "data-measurement-bars": t("measurement.bars"), "data-measurement-price": t("measurement.price"), children: locale }));
}
describe("WidgetI18nProvider", () => {
    let container = null;
    let root = null;
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.lang = "en";
    });
    afterEach(() => {
        root?.unmount();
        root = null;
        container?.remove();
        container = null;
        window.localStorage.clear();
        document.documentElement.lang = "en";
        setLocaleForTest = null;
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });
    it("falls back to document language and syncs DOM lang on locale changes", async () => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("en");
        expect(probe?.getAttribute("data-loading-label")).toBe("Loading chart…");
        expect(probe?.getAttribute("data-measurement-title")).toBe("Measure");
        expect(document.documentElement.lang).toBe("en");
        await act(async () => {
            setLocaleForTest?.("vi");
            await Promise.resolve();
        });
        expect(probe?.getAttribute("data-locale")).toBe("vi");
        expect(probe?.getAttribute("data-no-data-label")).toBe("Chưa có dữ liệu");
        expect(document.documentElement.lang).toBe("vi");
    });
    it("honors an explicit locale prop over document.lang", async () => {
        document.documentElement.lang = "vi";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("en");
        expect(document.documentElement.lang).toBe("en");
    });
    it("falls back to vi when the document language is unsupported", async () => {
        document.documentElement.lang = "fr";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("vi");
        expect(probe?.getAttribute("data-measurement-bars")).toBe("Số nến");
        expect(probe?.getAttribute("data-measurement-price")).toBe("Δ giá");
        expect(document.documentElement.lang).toBe("vi");
    });
    // ── Explicit Regression Tests W-01 to W-09 ─────────────────────────────────
    it("[W-01] document.lang = 'vi', không truyền locale prop -> locale === 'vi'", async () => {
        document.documentElement.lang = "vi";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("vi");
    });
    it("[W-02] document.lang = 'en', không truyền locale prop -> locale === 'en'", async () => {
        document.documentElement.lang = "en";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("en");
    });
    it("[W-03] document.lang = 'fr', không truyền locale prop -> locale === 'vi'", async () => {
        document.documentElement.lang = "fr";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("vi");
    });
    it("[W-04] locale='en' prop + document.lang = 'vi' -> locale === 'en'", async () => {
        document.documentElement.lang = "vi";
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-locale")).toBe("en");
    });
    it("[W-05] Gọi t('widget.loading') -> String non-empty, khác key", async () => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        const val = probe?.getAttribute("data-loading-label");
        expect(val).not.toBe("widget.loading");
        expect(val).toBe("Đang tải biểu đồ…");
    });
    it("[W-06] Gọi t('widget.noData') -> String non-empty, khác key", async () => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        const val = probe?.getAttribute("data-no-data-label");
        expect(val).not.toBe("widget.noData");
        expect(val).toBe("Chưa có dữ liệu");
    });
    it("[W-07] Gọi t('widget.error') -> String non-empty, khác key", async () => {
        let tFn;
        function Probe() {
            const { t } = useWidgetI18n();
            tFn = t;
            return null;
        }
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(Probe, {}) }));
        });
        expect(tFn("widget.error")).not.toBe("widget.error");
        expect(tFn("widget.error")).toBe("Đã xảy ra lỗi trong biểu đồ");
    });
    it("[W-08] Gọi t('nonexistent.key') -> Trả lại key đó (không crash)", async () => {
        let tFn;
        function Probe() {
            const { t } = useWidgetI18n();
            tFn = t;
            return null;
        }
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "vi", children: _jsx(Probe, {}) }));
        });
        expect(tFn("nonexistent.key")).toBe("nonexistent.key");
    });
    it("[W-09] t('widget.loading') với locale = 'en' -> English string (không phải Vietnamese)", async () => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(WidgetI18nProvider, { locale: "en", children: _jsx(WidgetI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        const val = probe?.getAttribute("data-loading-label");
        expect(val).toBe("Loading chart…");
    });
});
