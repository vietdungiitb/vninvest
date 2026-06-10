// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DrawingContextMenu } from "./contextMenu";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let container = null;
let root = null;
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
describe("DrawingContextMenu", () => {
    it("renders actions, fires item callbacks, and closes on escape", () => {
        const onClose = vi.fn();
        const onSelect = vi.fn();
        act(() => {
            root?.render(createElement(DrawingContextMenu, {
                ariaLabel: "Drawing actions",
                position: { x: 24, y: 32 },
                title: "Drawing menu",
                isDark: false,
                onClose,
                items: [
                    { key: "copy", label: "Copy", onSelect },
                ],
            }));
        });
        expect(container?.textContent).toContain("Drawing menu");
        expect(container?.textContent).toContain("Copy");
        const button = container?.querySelector("button[role='menuitem']");
        button?.click();
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
    it("uses a bottom-sheet layout on compact viewports", () => {
        const onClose = vi.fn();
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
        act(() => {
            window.dispatchEvent(new Event("resize"));
        });
        act(() => {
            root?.render(createElement(DrawingContextMenu, {
                ariaLabel: "Drawing actions",
                position: { x: 24, y: 32 },
                isDark: false,
                onClose,
                items: [
                    { key: "copy", label: "Copy", onSelect: vi.fn() },
                ],
            }));
        });
        const menu = container?.querySelector('[role="menu"]');
        expect(menu?.style.bottom).toBe("8px");
        expect(menu?.style.left).toBe("8px");
        expect(menu?.style.right).toBe("8px");
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
        act(() => {
            window.dispatchEvent(new Event("resize"));
        });
    });
});
