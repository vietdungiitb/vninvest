import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LibraryShowcaseDemo from "./LibraryShowcaseDemo.js";
import { DemoI18nProvider } from "./i18n.js";
const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(_jsx(StrictMode, { children: _jsx(DemoI18nProvider, { children: _jsx(LibraryShowcaseDemo, {}) }) }));
}
