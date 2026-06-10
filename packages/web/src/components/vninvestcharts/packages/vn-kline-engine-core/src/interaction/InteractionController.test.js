// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInteractionCommand, InteractionController } from "./InteractionController";
function makeCallbacks() {
    return {
        onZoom: vi.fn(),
        onPan: vi.fn(),
        onCrosshairMove: vi.fn(),
        onCrosshairLeave: vi.fn(),
        onPointerDown: vi.fn(),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        onPointerCancel: vi.fn(),
        onPointerLeave: vi.fn(),
        onClick: vi.fn(),
        onDoubleClick: vi.fn(),
        onContextMenu: vi.fn(),
        onDragStart: vi.fn(),
        onDragMove: vi.fn(),
        onDragEnd: vi.fn(),
    };
}
function makeCanvas() {
    // jsdom canvas element with full event support
    return document.createElement("canvas");
}
function createPointerEvent(type, init = {}) {
    const event = new PointerEvent(type, { bubbles: true, pointerType: "mouse", ...init });
    if (typeof init.offsetX === "number") {
        Object.defineProperty(event, "offsetX", { value: init.offsetX });
    }
    if (typeof init.offsetY === "number") {
        Object.defineProperty(event, "offsetY", { value: init.offsetY });
    }
    return event;
}
function expectPointerContext(context, expected) {
    expect(context).toMatchObject(expected);
}
describe("InteractionController", () => {
    let canvas;
    let callbacks;
    let controller;
    beforeEach(() => {
        canvas = makeCanvas();
        callbacks = makeCallbacks();
        controller = new InteractionController(canvas, callbacks);
    });
    // T01-01: wheel event → onZoom called with correct delta and pivotX
    it("T01-01: wheel event fires onZoom with normalized delta and pivotX", () => {
        const wheelEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true });
        Object.defineProperty(wheelEvent, "offsetX", { value: 200 });
        canvas.dispatchEvent(wheelEvent);
        expect(callbacks.onZoom).toHaveBeenCalledTimes(1);
        const [delta, pivotX] = callbacks.onZoom.mock.calls[0];
        // deltaY = -100 → delta = -(-100)/100 = 1
        expect(delta).toBeCloseTo(1);
        expect(pivotX).toBe(200);
    });
    // T01-02: mousemove in IDLE state → onCrosshairMove (not onPan)
    it("T01-02: pointermove in IDLE fires onCrosshairMove not onPan", () => {
        const move = createPointerEvent("pointermove", { clientX: 50, clientY: 30, offsetX: 50, offsetY: 30 });
        canvas.dispatchEvent(move);
        expect(callbacks.onCrosshairMove).toHaveBeenCalledTimes(1);
        expect(callbacks.onCrosshairMove).toHaveBeenCalledWith(50, 30);
        expect(callbacks.onPan).not.toHaveBeenCalled();
        expect(callbacks.onPointerMove).toHaveBeenCalledTimes(1);
    });
    it("T01-03: press does not become pan until drag threshold is crossed", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 100, clientY: 40, offsetX: 100, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 102, clientY: 40, offsetX: 102, offsetY: 40, buttons: 1 }));
        expect(callbacks.onPan).not.toHaveBeenCalled();
        expect(callbacks.onDragStart).not.toHaveBeenCalled();
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 108, clientY: 40, offsetX: 108, offsetY: 40, buttons: 1 }));
        expect(callbacks.onDragStart).toHaveBeenCalledTimes(1);
        expect(callbacks.onDragMove).toHaveBeenCalledTimes(1);
        expect(callbacks.onPan).toHaveBeenCalledTimes(1);
        expect(callbacks.onPan.mock.calls[0][0]).toBe(8);
    });
    // T01-04: pointerdown → pointermove → onPan called (DRAGGING state)
    it("T01-04: drag sequence fires onPan with correct deltaX", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 100, clientY: 40, offsetX: 100, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 130, clientY: 40, offsetX: 130, offsetY: 40, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 160, clientY: 40, offsetX: 160, offsetY: 40, buttons: 1 }));
        expect(callbacks.onPan).toHaveBeenCalledTimes(2);
        expect(callbacks.onPan.mock.calls[0][0]).toBe(30);
        expect(callbacks.onPan.mock.calls[1][0]).toBe(30);
        expect(callbacks.onPointerDown).toHaveBeenCalledTimes(1);
        expect(callbacks.onDragStart).toHaveBeenCalledTimes(1);
        expect(callbacks.onDragMove).toHaveBeenCalledTimes(2);
    });
    // T01-05: pointerleave resets state → subsequent pointermove fires onCrosshairMove
    it("T01-05: pointerleave during drag resets to IDLE and fires onCrosshairLeave", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 100, clientY: 20, offsetX: 100, offsetY: 20, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 120, clientY: 20, offsetX: 120, offsetY: 20, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointerleave", { clientX: 100, clientY: 20, offsetX: 100, offsetY: 20 }));
        expect(callbacks.onCrosshairLeave).toHaveBeenCalledTimes(1);
        expect(callbacks.onPointerLeave).toHaveBeenCalledTimes(1);
        expect(callbacks.onDragEnd).toHaveBeenCalledTimes(1);
        // After leave, next pointermove should be crosshair, not pan
        const move = createPointerEvent("pointermove", { clientX: 150, clientY: 40, offsetX: 150, offsetY: 40 });
        canvas.dispatchEvent(move);
        expect(callbacks.onCrosshairMove).toHaveBeenCalledTimes(1);
        expect(callbacks.onPan).toHaveBeenCalledTimes(1);
    });
    it("T01-06: emits normalized pointer lifecycle callbacks", () => {
        const down = createPointerEvent("pointerdown", {
            clientX: 120,
            clientY: 60,
            offsetX: 20,
            offsetY: 10,
            buttons: 1,
            ctrlKey: true,
            shiftKey: true,
        });
        const up = createPointerEvent("pointerup", {
            clientX: 122,
            clientY: 62,
            offsetX: 22,
            offsetY: 12,
        });
        const cancel = createPointerEvent("pointercancel", {
            clientX: 122,
            clientY: 62,
            offsetX: 22,
            offsetY: 12,
        });
        canvas.dispatchEvent(down);
        canvas.dispatchEvent(up);
        canvas.dispatchEvent(cancel);
        expect(callbacks.onPointerDown).toHaveBeenCalledTimes(1);
        expect(callbacks.onPointerUp).toHaveBeenCalledTimes(1);
        expect(callbacks.onPointerCancel).toHaveBeenCalledTimes(1);
        expect(callbacks.onCrosshairLeave).toHaveBeenCalledTimes(1);
        expectPointerContext(callbacks.onPointerDown.mock.calls[0][0], {
            clientX: 120,
            clientY: 60,
            localX: 20,
            localY: 10,
            buttons: 1,
            ctrlKey: true,
            shiftKey: true,
            pointerType: "mouse",
        });
    });
    it("T01-07: emits click, double click, and context menu callbacks", () => {
        const click = new MouseEvent("click", { clientX: 80, clientY: 40, buttons: 0, bubbles: true });
        Object.defineProperty(click, "offsetX", { value: 18 });
        Object.defineProperty(click, "offsetY", { value: 12 });
        const doubleClick = new MouseEvent("dblclick", { clientX: 82, clientY: 42, buttons: 0, bubbles: true });
        Object.defineProperty(doubleClick, "offsetX", { value: 20 });
        Object.defineProperty(doubleClick, "offsetY", { value: 14 });
        const contextMenu = new MouseEvent("contextmenu", { clientX: 84, clientY: 44, buttons: 2, bubbles: true });
        Object.defineProperty(contextMenu, "offsetX", { value: 22 });
        Object.defineProperty(contextMenu, "offsetY", { value: 16 });
        canvas.dispatchEvent(click);
        canvas.dispatchEvent(doubleClick);
        canvas.dispatchEvent(contextMenu);
        expect(callbacks.onClick).toHaveBeenCalledTimes(1);
        expect(callbacks.onDoubleClick).toHaveBeenCalledTimes(1);
        expect(callbacks.onContextMenu).toHaveBeenCalledTimes(1);
        expectPointerContext(callbacks.onContextMenu.mock.calls[0][0], {
            clientX: 84,
            clientY: 44,
            localX: 22,
            localY: 16,
            buttons: 2,
            pointerType: "mouse",
        });
    });
    // T01-08: dispose() removes all listeners — no callbacks after dispose
    it("T01-08: dispose removes all event listeners", () => {
        controller.dispose();
        // Wheel
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
        // Drag
        canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 100, offsetX: 100, offsetY: 20, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, offsetX: 150, offsetY: 20, buttons: 1 }));
        canvas.dispatchEvent(createPointerEvent("pointerleave", { clientX: 150, offsetX: 150, offsetY: 20 }));
        canvas.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 40, bubbles: true }));
        expect(callbacks.onZoom).not.toHaveBeenCalled();
        expect(callbacks.onPan).not.toHaveBeenCalled();
        expect(callbacks.onCrosshairLeave).not.toHaveBeenCalled();
        expect(callbacks.onPointerDown).not.toHaveBeenCalled();
        expect(callbacks.onClick).not.toHaveBeenCalled();
    });
    it("T01-09: createInteractionCommand clones pointer context into a reusable command envelope", () => {
        const pointer = {
            clientX: 140,
            clientY: 90,
            localX: 40,
            localY: 30,
            pointerType: "mouse",
            buttons: 1,
            altKey: false,
            ctrlKey: true,
            metaKey: false,
            shiftKey: true,
        };
        const command = createInteractionCommand("pointermove", pointer);
        expect(command).toMatchObject({
            type: "pointermove",
            context: pointer,
        });
        expect(command.context).not.toBe(pointer);
    });
    it("T01-10: two-touch pinch emits zoom deltas with midpoint pivot", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 1,
            pointerType: "touch",
            clientX: 100,
            clientY: 100,
            offsetX: 100,
            offsetY: 100,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 200,
            clientY: 100,
            offsetX: 200,
            offsetY: 100,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointermove", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 220,
            clientY: 100,
            offsetX: 220,
            offsetY: 100,
            buttons: 1,
        }));
        expect(callbacks.onZoom).toHaveBeenCalledTimes(1);
        const [delta, pivotX] = callbacks.onZoom.mock.calls[0];
        expect(delta).toBeGreaterThan(0);
        expect(pivotX).toBeCloseTo(150, 0);
        expect(callbacks.onPan).not.toHaveBeenCalled();
    });
    it("T01-11: pinch stop restores normal pointer move crosshair behavior", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 1,
            pointerType: "touch",
            clientX: 120,
            clientY: 120,
            offsetX: 120,
            offsetY: 120,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 220,
            clientY: 120,
            offsetX: 220,
            offsetY: 120,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointermove", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 230,
            clientY: 120,
            offsetX: 230,
            offsetY: 120,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointerup", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 230,
            clientY: 120,
            offsetX: 230,
            offsetY: 120,
            buttons: 0,
        }));
        canvas.dispatchEvent(createPointerEvent("pointermove", {
            pointerId: 1,
            pointerType: "touch",
            clientX: 150,
            clientY: 110,
            offsetX: 150,
            offsetY: 110,
            buttons: 0,
        }));
        expect(callbacks.onCrosshairMove).toHaveBeenCalledWith(150, 110);
    });
    it("T01-12: pointercancel during pinch clears pinch mode for next move", () => {
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 1,
            pointerType: "touch",
            clientX: 100,
            clientY: 140,
            offsetX: 100,
            offsetY: 140,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointerdown", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 200,
            clientY: 140,
            offsetX: 200,
            offsetY: 140,
            buttons: 1,
        }));
        canvas.dispatchEvent(createPointerEvent("pointermove", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 220,
            clientY: 140,
            offsetX: 220,
            offsetY: 140,
            buttons: 1,
        }));
        expect(callbacks.onZoom).toHaveBeenCalledTimes(1);
        canvas.dispatchEvent(createPointerEvent("pointercancel", {
            pointerId: 2,
            pointerType: "touch",
            clientX: 220,
            clientY: 140,
            offsetX: 220,
            offsetY: 140,
            buttons: 0,
        }));
        canvas.dispatchEvent(createPointerEvent("pointermove", {
            pointerId: 1,
            pointerType: "touch",
            clientX: 130,
            clientY: 145,
            offsetX: 130,
            offsetY: 145,
            buttons: 0,
        }));
        expect(callbacks.onCrosshairMove).toHaveBeenCalledWith(130, 145);
    });
});
