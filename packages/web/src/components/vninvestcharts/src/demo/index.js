import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LibraryShowcaseDemo from "./LibraryShowcaseDemo.js";
import StandaloneEmbedDemo from "./StandaloneEmbedDemo.js";
import { DemoI18nProvider } from "./i18n.js";
const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    // Check if '?standalone=true' or '?standalone=1' is in the URL query string
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const isStandalone = params.get("standalone") === "true" || params.get("standalone") === "1";
    root.render(_jsx(StrictMode, { children: _jsx(DemoI18nProvider, { children: isStandalone ? _jsx(StandaloneEmbedDemo, {}) : _jsx(LibraryShowcaseDemo, {}) }) }));
}
