import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args) => { };
let act;
let createRoot;
let DemoI18nBoundary;
let useDemoI18n;
beforeAll(async () => {
    ({ act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ DemoI18nBoundary, useDemoI18n } = await import("../i18n"));
});
let setLanguageForTest = null;
function DemoI18nProbe() {
    const { language, setLanguage, t } = useDemoI18n();
    setLanguageForTest = setLanguage;
    return (_jsx("div", { "data-language": language, "data-restore-label": t("library.restorePane"), children: language }));
}
describe("DemoI18nBoundary", () => {
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
    });
    afterAll(() => {
        console.error = originalConsoleError;
    });
    it("falls back to the document language and keeps DOM lang and storage in sync", async () => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root?.render(_jsx(DemoI18nBoundary, { children: _jsx(DemoI18nProbe, {}) }));
        });
        const probe = container.querySelector("div");
        expect(probe?.getAttribute("data-language")).toBe("en");
        expect(probe?.getAttribute("data-restore-label")).toBe("Show pane again");
        expect(document.documentElement.lang).toBe("en");
        expect(window.localStorage.getItem("rsc-demo-language-v1")).toBe("en");
        await act(async () => {
            setLanguageForTest?.("vi");
            await Promise.resolve();
        });
        expect(probe?.getAttribute("data-language")).toBe("vi");
        expect(probe?.getAttribute("data-restore-label")).toBe("Hiện lại pane");
        expect(document.documentElement.lang).toBe("vi");
        expect(window.localStorage.getItem("rsc-demo-language-v1")).toBe("vi");
    });
});
