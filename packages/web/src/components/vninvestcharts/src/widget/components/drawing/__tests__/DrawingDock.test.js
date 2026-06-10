// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import DrawingDock from "../DrawingDock";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let container = null;
let root = null;
const labels = {
    title: "Dock",
    close: "Close",
    properties: "Properties",
    objects: "Objects",
    templates: "Templates",
    emptyProperties: "No properties",
    emptyObjects: "No objects",
    emptyTemplates: "No templates",
};
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    if (root) {
        act(() => {
            root?.unmount();
        });
    }
    root = null;
    container?.remove();
    container = null;
});
describe("DrawingDock", () => {
    it("switches tabs and renders the matching content", () => {
        const onTabChange = vi.fn();
        act(() => {
            root?.render(createElement(DrawingDock, {
                isOpen: true,
                activeTab: "properties",
                labels,
                onClose: vi.fn(),
                onTabChange,
                propertiesContent: createElement("div", null, "Inspector body"),
                objectsContent: createElement("div", null, "Objects body"),
            }));
        });
        expect(container?.textContent).toContain("Inspector body");
        const objectsButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Objects");
        act(() => {
            objectsButton?.click();
        });
        expect(onTabChange).toHaveBeenCalledWith("objects");
    });
    it("renders the empty-state fallback for templates when no content is provided", () => {
        act(() => {
            root?.render(createElement(DrawingDock, {
                isOpen: true,
                activeTab: "templates",
                labels,
                onClose: vi.fn(),
                onTabChange: vi.fn(),
            }));
        });
        expect(container?.textContent).toContain("No templates");
    });
});
