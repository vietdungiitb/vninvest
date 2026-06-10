import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
const pointerMock = vi.hoisted(() => vi.fn(() => [318, 271]));
vi.mock("d3-selection", async () => {
    const actual = await vi.importActual("d3-selection");
    return {
        ...actual,
        pointer: pointerMock,
    };
});
let EventCapture;
beforeAll(async () => {
    ({ default: EventCapture } = await import("./EventCapture"));
});
afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
});
describe("EventCapture click handling", () => {
    it("uses pointer coordinates from the capture node for clicks", () => {
        vi.useFakeTimers();
        const onClick = vi.fn();
        const onDoubleClick = vi.fn();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(_jsx("svg", { children: _jsx(EventCapture, { onClick: onClick, onDoubleClick: onDoubleClick, pan: false, zoom: false, mouseMove: false, panSpeedMultiplier: 1, focus: false, useCrossHairStyleCursor: false, width: 640, height: 320, xScale: vi.fn(), xAccessor: vi.fn(), disableInteraction: false, getAllPanConditions: vi.fn(() => ({ panEnabled: false, somethingSelected: false })), onPinchZoomEnd: vi.fn() }) }));
        });
        const rect = container.querySelector("rect");
        expect(rect).not.toBeNull();
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            rect.dispatchEvent(event);
        });
        expect(pointerMock).toHaveBeenCalledTimes(1);
        expect(pointerMock).toHaveBeenCalledWith(expect.objectContaining({ nativeEvent: event }), rect);
        expect(onClick).toHaveBeenCalledWith([318, 271], expect.objectContaining({ nativeEvent: event }));
        expect(onDoubleClick).not.toHaveBeenCalled();
        act(() => {
            root.unmount();
        });
        document.body.removeChild(container);
        vi.runAllTimers();
    });
    it("suppresses pan on mousedown when a subscriber vetoes pan for the current event", () => {
        const onMouseDown = vi.fn();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(_jsx("svg", { children: _jsx(EventCapture, { onMouseDown: onMouseDown, pan: true, zoom: false, mouseMove: false, panSpeedMultiplier: 1, focus: false, useCrossHairStyleCursor: true, width: 640, height: 320, xScale: vi.fn(), xAccessor: vi.fn(), chartConfig: [{ id: 1, origin: [0, 0], height: 320 }], disableInteraction: false, getAllPanConditions: vi.fn(() => [{
                            panEnabled: true,
                            draggable: false,
                            shouldDisablePanOnMouseDown: (event) => event.ctrlKey,
                        }]), onPinchZoomEnd: vi.fn() }) }));
        });
        const rect = container.querySelector("rect");
        expect(rect).not.toBeNull();
        const event = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            ctrlKey: true,
        });
        Object.defineProperty(event, "currentTarget", { value: rect });
        act(() => {
            rect.dispatchEvent(event);
        });
        expect(rect.getAttribute("class")).toBe("vninvestcharts-crosshair-cursor");
        expect(onMouseDown).toHaveBeenCalledTimes(1);
        act(() => {
            root.unmount();
        });
        document.body.removeChild(container);
    });
});
