import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LibraryShowcaseDemo from "./LibraryShowcaseDemo";
import { DemoI18nProvider } from "./i18n";

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <DemoI18nProvider>
                <LibraryShowcaseDemo />
            </DemoI18nProvider>
        </StrictMode>
    );
}
