// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { FloatingSelectionToolbar } from "./FloatingSelectionToolbar";
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
describe("FloatingSelectionToolbar", () => {
    it("switches to a bottom-sheet layout on compact viewports", () => {
        const originalInnerWidth = window.innerWidth;
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
        act(() => {
            window.dispatchEvent(new Event("resize"));
        });
        act(() => {
            root?.render(createElement(FloatingSelectionToolbar, {
                ariaLabel: "Selection actions",
                position: { x: 24, y: 32 },
                isDark: false,
                model: {
                    primaryActions: [{ id: "clone", label: "Clone", active: false, tone: "primary" }],
                    secondaryActions: [{ id: "toggleVisibility", label: "Hide", active: true, tone: "secondary" }],
                    dangerAction: { id: "delete", label: "Delete", tone: "danger", active: false },
                },
                onAction: vi.fn(),
            }));
        });
        const toolbar = container?.querySelector('[role="toolbar"]');
        expect(toolbar?.style.bottom).toBe("8px");
        expect(toolbar?.style.left).toBe("8px");
        expect(toolbar?.style.right).toBe("8px");
        expect(toolbar?.style.flexWrap).toBe("wrap");
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
        act(() => {
            window.dispatchEvent(new Event("resize"));
        });
    });
    it("resets its custom drag position when drawing ID changes", () => {
        let drawing = { id: "draw1", type: "line" };
        const mockModel = {
            primaryActions: [{ id: "clone", label: "Clone", active: false, tone: "primary" }],
            secondaryActions: [{ id: "toggleVisibility", label: "Hide", active: true, tone: "secondary" }],
            dangerAction: { id: "delete", label: "Delete", tone: "danger", active: false },
        };
        act(() => {
            root?.render(createElement(FloatingSelectionToolbar, {
                ariaLabel: "Selection actions",
                position: { x: 24, y: 32 },
                isDark: false,
                model: mockModel,
                onAction: vi.fn(),
                drawing,
            }));
        });
        const dragHandle = container?.querySelector('[title="Kéo để di chuyển thanh công cụ"]');
        expect(dragHandle).not.toBeNull();
        // Simulate drag start and move
        act(() => {
            dragHandle?.dispatchEvent(new MouseEvent("mousedown", { clientX: 0, clientY: 0, bubbles: true }));
        });
        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 60 }));
        });
        act(() => {
            window.dispatchEvent(new MouseEvent("mouseup"));
        });
        // Now change drawing ID
        drawing = { id: "draw2", type: "line" };
        act(() => {
            root?.render(createElement(FloatingSelectionToolbar, {
                ariaLabel: "Selection actions",
                position: { x: 24, y: 32 },
                isDark: false,
                model: mockModel,
                onAction: vi.fn(),
                drawing,
            }));
        });
        // Check if it reset. The container toolbar position style should go back to using the default position (24px, 32px)
        const toolbar = container?.querySelector('[role="toolbar"]');
        expect(toolbar?.style.left).toBe("24px");
        expect(toolbar?.style.top).toBe("32px");
    });
    it("moves position when touch dragged", () => {
        const drawing = { id: "draw1", type: "line" };
        const mockModel = {
            primaryActions: [{ id: "clone", label: "Clone", active: false, tone: "primary" }],
            secondaryActions: [{ id: "toggleVisibility", label: "Hide", active: true, tone: "secondary" }],
            dangerAction: { id: "delete", label: "Delete", tone: "danger", active: false },
        };
        act(() => {
            root?.render(createElement(FloatingSelectionToolbar, {
                ariaLabel: "Selection actions",
                position: { x: 24, y: 32 },
                isDark: false,
                model: mockModel,
                onAction: vi.fn(),
                drawing,
            }));
        });
        const dragHandle = container?.querySelector('[title="Kéo để di chuyển thanh công cụ"]');
        expect(dragHandle).not.toBeNull();
        // Simulate touch start
        const touchStartEvent = new TouchEvent("touchstart", {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 10, clientY: 20 }],
        });
        act(() => {
            dragHandle?.dispatchEvent(touchStartEvent);
        });
        // Simulate touch move on window
        const touchMoveEvent = new TouchEvent("touchmove", {
            bubbles: true,
            cancelable: true,
            touches: [{ clientX: 30, clientY: 50 }],
        });
        act(() => {
            window.dispatchEvent(touchMoveEvent);
        });
        // Simulate touch end on window
        const touchEndEvent = new TouchEvent("touchend", {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            window.dispatchEvent(touchEndEvent);
        });
        // Check if toolbar moved: base (24, 32) + delta (20, 30) = (44, 62)
        const toolbar = container?.querySelector('[role="toolbar"]');
        expect(toolbar?.style.left).toBe("44px");
        expect(toolbar?.style.top).toBe("62px");
    });
});
