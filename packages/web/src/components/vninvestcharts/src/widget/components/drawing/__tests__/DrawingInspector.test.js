// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createDrawingObject } from "../../../../lib/drawing/shared";
import DrawingInspector from "../DrawingInspector";
import { clearDrawingStyleOverrides, overrideDrawingStyle } from "../../../../lib/drawing/drawingStyleRegistry";
import { isLineFamilyType, lineTypeFlagsFor, LINE_FAMILY_TYPES } from "../../../../lib/drawing/stateMachine";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let container = null;
let root = null;
const labels = {
    title: "Inspector",
    stroke: "Stroke",
    fill: "Fill",
    strokeWidth: "Stroke width",
    lineStyle: "Line style",
    opacity: "Opacity",
    solid: "Solid",
    dashed: "Dashed",
    dotted: "Dotted",
    lock: "Lock",
    unlock: "Unlock",
    clone: "Clone",
    hide: "Hide",
    show: "Show",
    bringToFront: "Bring to front",
    sendToBack: "Send to back",
    delete: "Delete",
    close: "Close",
};
const textLabels = {
    title: "Text",
    label: "Content",
    placeholder: "Enter text",
    edit: "Edit text",
    save: "Save",
    cancel: "Cancel",
    empty: "No text yet",
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
    clearDrawingStyleOverrides();
});
describe("DrawingInspector text editing", () => {
    it("renders the text editor controls in active mode", () => {
        const drawing = createDrawingObject("text", [{ x: 120, y: 40 }], { id: "drawing-1", text: "Ghi chú" });
        const onChange = vi.fn();
        const onCommit = vi.fn();
        const onCancel = vi.fn();
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels,
                textEditor: {
                    active: true,
                    value: "Ghi chú",
                    labels: textLabels,
                    onChange,
                    onStartEdit: vi.fn(),
                    onCommit,
                    onCancel,
                },
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const textarea = container?.querySelector("textarea");
        expect(textarea?.value).toBe("Ghi chú");
        const buttons = Array.from(container?.querySelectorAll("button") ?? []);
        const saveButton = buttons.find((button) => button.textContent === "Save");
        const cancelButton = buttons.find((button) => button.textContent === "Cancel");
        act(() => {
            saveButton?.click();
            cancelButton?.click();
        });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
    it("exposes the edit trigger when the editor is idle", () => {
        const drawing = createDrawingObject("text", [{ x: 120, y: 40 }], { id: "drawing-2", text: "Ghi chú" });
        const onStartEdit = vi.fn();
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels,
                textEditor: {
                    active: false,
                    value: "Ghi chú",
                    labels: textLabels,
                    onChange: vi.fn(),
                    onStartEdit,
                    onCommit: vi.fn(),
                    onCancel: vi.fn(),
                },
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const editButton = Array.from(container?.querySelectorAll("button") ?? []).find((button) => button.textContent === "Edit text");
        act(() => {
            editButton?.click();
        });
        expect(onStartEdit).toHaveBeenCalledTimes(1);
    });
    it("reflects registry updates through the override subscription", () => {
        const drawing = createDrawingObject("trendLine", [{ x: 120, y: 40 }, { x: 160, y: 60 }], {
            id: "drawing-override",
            style: { stroke: "#111111", strokeWidth: 1 },
        });
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels,
                textEditor: undefined,
                position: undefined,
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const strokeInput = container?.querySelector('input[type="color"]');
        expect(strokeInput?.value).toBe("#111111");
        act(() => {
            overrideDrawingStyle("drawing-override", { color: "#ff00ff" });
        });
        expect(strokeInput?.value).toBe("#ff00ff");
    });
    it("persists stroke width, line style, and opacity through onUpdate", () => {
        const onUpdate = vi.fn();
        const drawing = createDrawingObject("trendLine", [{ x: 120, y: 40 }, { x: 160, y: 60 }], {
            id: "drawing-style-persist",
            style: { stroke: "#111111", strokeWidth: 1, strokeDasharray: "solid", opacity: 1 },
        });
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels,
                textEditor: undefined,
                position: undefined,
                onUpdate,
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const inputs = container?.querySelectorAll('input[type="range"]') ?? [];
        const strokeWidthInput = inputs[0];
        const opacityInput = inputs[1];
        const lineStyleSelect = container?.querySelector("select");
        const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        act(() => {
            setInputValue?.call(strokeWidthInput, "4");
            strokeWidthInput.dispatchEvent(new Event("input", { bubbles: true }));
            strokeWidthInput.dispatchEvent(new Event("change", { bubbles: true }));
            setSelectValue?.call(lineStyleSelect, "dashed");
            lineStyleSelect.dispatchEvent(new Event("change", { bubbles: true }));
            setInputValue?.call(opacityInput, "0.45");
            opacityInput.dispatchEvent(new Event("input", { bubbles: true }));
            opacityInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(onUpdate.mock.calls).toEqual(expect.arrayContaining([
            [{
                    style: expect.objectContaining({
                        strokeWidth: 4,
                    }),
                }],
            [{
                    style: expect.objectContaining({
                        strokeDasharray: "dashed",
                    }),
                }],
            [{
                    style: expect.objectContaining({
                        opacity: 0.45,
                    }),
                }],
        ]));
    });
});
describe("lineTypeFlagsFor + isLineFamilyType helpers", () => {
    it("DT3-01: lineTypeFlagsFor(trendLine) returns no extension", () => {
        // Arrange / Act
        const flags = lineTypeFlagsFor("trendLine");
        // Assert
        expect(flags).toEqual({ type: "trendLine", extendLeft: false, extendRight: false });
    });
    it("DT3-02: lineTypeFlagsFor(ray) extends right only", () => {
        const flags = lineTypeFlagsFor("ray");
        expect(flags).toEqual({ type: "ray", extendLeft: false, extendRight: true });
    });
    it("DT3-03: lineTypeFlagsFor(extendedLine) extends both sides", () => {
        const flags = lineTypeFlagsFor("extendedLine");
        expect(flags).toEqual({ type: "extendedLine", extendLeft: true, extendRight: true });
    });
    it("DT3-04: LINE_FAMILY_TYPES contains exactly three members", () => {
        expect(LINE_FAMILY_TYPES).toHaveLength(3);
        expect(LINE_FAMILY_TYPES).toContain("trendLine");
        expect(LINE_FAMILY_TYPES).toContain("ray");
        expect(LINE_FAMILY_TYPES).toContain("extendedLine");
    });
    it("DT3-05: isLineFamilyType returns true for all family members", () => {
        for (const lt of LINE_FAMILY_TYPES) {
            expect(isLineFamilyType(lt)).toBe(true);
        }
    });
    it("DT3-06: isLineFamilyType returns false for non-family types", () => {
        expect(isLineFamilyType("fibonacci")).toBe(false);
        expect(isLineFamilyType("hLine")).toBe(false);
        expect(isLineFamilyType("text")).toBe(false);
        expect(isLineFamilyType("rectangle")).toBe(false);
    });
});
describe("DrawingInspector line type radio group", () => {
    const lineTypeLabels = {
        ...{
            title: "Inspector",
            stroke: "Stroke",
            fill: "Fill",
            strokeWidth: "Stroke width",
            lineStyle: "Line style",
            opacity: "Opacity",
            solid: "Solid",
            dashed: "Dashed",
            dotted: "Dotted",
            lock: "Lock",
            unlock: "Unlock",
            clone: "Clone",
            hide: "Hide",
            show: "Show",
            bringToFront: "Bring to front",
            sendToBack: "Send to back",
            delete: "Delete",
            close: "Close",
        },
        lineTypeLabel: "Line type",
        lineTypeTrendLine: "Segment",
        lineTypeRay: "Ray",
        lineTypeExtendedLine: "Extended line",
    };
    it("DT3-07: shows radio group for trendLine drawing", () => {
        // Arrange
        const drawing = createDrawingObject("trendLine", [{ x: 100, y: 50 }, { x: 200, y: 100 }], { id: "dt3-a" });
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels: lineTypeLabels,
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        // Assert
        const radios = container?.querySelectorAll('input[type="radio"]');
        expect(radios?.length).toBe(3);
        const checkedRadio = container?.querySelector('input[type="radio"]:checked');
        expect(checkedRadio?.value).toBe("trendLine");
    });
    it("DT3-08: shows radio group for ray drawing with ray selected", () => {
        const drawing = createDrawingObject("ray", [{ x: 100, y: 50 }, { x: 200, y: 100 }], { id: "dt3-b" });
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels: lineTypeLabels,
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const checkedRadio = container?.querySelector('input[type="radio"]:checked');
        expect(checkedRadio?.value).toBe("ray");
    });
    it("DT3-09: does NOT show radio group for fibonacci drawing", () => {
        const drawing = createDrawingObject("fibonacci", [{ x: 100, y: 50 }, { x: 200, y: 100 }], { id: "dt3-c" });
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels: lineTypeLabels,
                onUpdate: vi.fn(),
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        const radios = container?.querySelectorAll('input[type="radio"]');
        expect(radios?.length).toBe(0);
    });
    it("DT3-10: onUpdate called with lineTypeFlagsFor(extendedLine) when radio changes", () => {
        const drawing = createDrawingObject("trendLine", [{ x: 100, y: 50 }, { x: 200, y: 100 }], { id: "dt3-d" });
        const onUpdate = vi.fn();
        act(() => {
            root?.render(createElement(DrawingInspector, {
                drawing,
                labels: lineTypeLabels,
                onUpdate,
                onDelete: vi.fn(),
                onClone: vi.fn(),
                onToggleLock: vi.fn(),
                onToggleVisible: vi.fn(),
                onBringToFront: vi.fn(),
                onSendToBack: vi.fn(),
                onClose: vi.fn(),
            }));
        });
        // Act: click the extendedLine radio
        const extendedRadio = container?.querySelector('input[value="extendedLine"]');
        act(() => {
            extendedRadio?.click();
        });
        expect(onUpdate).toHaveBeenCalledWith({ type: "extendedLine", extendLeft: true, extendRight: true });
    });
});
