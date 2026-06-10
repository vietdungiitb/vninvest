/**
 * InteractionController — canvas event → callback bridge.
 *
 * State machine:
 *   IDLE       → pointerdown    → PRESSING
 *   PRESSING   → pointermove    → DRAGGING once drag threshold is crossed
 *   IDLE       → wheel          → onZoom(delta, pivotX)
 *   IDLE       → pointermove    → onCrosshairMove(x, y)
 *   IDLE       → pointerleave   → onCrosshairLeave()
 *   DRAGGING   → pointermove    → onPan(deltaX)
 *   DRAGGING   → pointerup      → IDLE
 *   DRAGGING   → pointercancel  → IDLE
 *   DRAGGING   → pointerleave   → IDLE
 *
 * Keeps DOM interaction logic local and framework-agnostic.
 */
export function createInteractionCommand(type, context) {
    return {
        type,
        context: { ...context },
    };
}
const DRAG_START_THRESHOLD_PX = 4;
export class InteractionController {
    canvas;
    callbacks;
    state = "IDLE";
    pressStartX = 0;
    lastDragX = 0;
    pressStartY = 0;
    lastDragY = 0;
    isPinching = false;
    pinchDistance = 0;
    pinchPivotLocalX = 0;
    pinchPivotLocalY = 0;
    activeTouchPointers = new Map();
    // Bound handler references kept for removeEventListener
    _onPointerDown;
    _onPointerMove;
    _onPointerUp;
    _onPointerCancel;
    _onPointerLeave;
    _onLostPointerCapture;
    _onClick;
    _onDoubleClick;
    _onContextMenu;
    _onWheel;
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this._onPointerDown = this.handlePointerDown.bind(this);
        this._onPointerMove = this.handlePointerMove.bind(this);
        this._onPointerUp = this.handlePointerUp.bind(this);
        this._onPointerCancel = this.handlePointerCancel.bind(this);
        this._onPointerLeave = this.handlePointerLeave.bind(this);
        this._onLostPointerCapture = this.handleLostPointerCapture.bind(this);
        this._onClick = this.handleClick.bind(this);
        this._onDoubleClick = this.handleDoubleClick.bind(this);
        this._onContextMenu = this.handleContextMenu.bind(this);
        this._onWheel = this.handleWheel.bind(this);
        this.canvas.addEventListener("pointerdown", this._onPointerDown);
        this.canvas.addEventListener("pointermove", this._onPointerMove);
        this.canvas.addEventListener("pointerup", this._onPointerUp);
        this.canvas.addEventListener("pointercancel", this._onPointerCancel);
        this.canvas.addEventListener("pointerleave", this._onPointerLeave);
        this.canvas.addEventListener("lostpointercapture", this._onLostPointerCapture);
        this.canvas.addEventListener("click", this._onClick);
        this.canvas.addEventListener("dblclick", this._onDoubleClick);
        this.canvas.addEventListener("contextmenu", this._onContextMenu);
        this.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    }
    dispose() {
        this.canvas.removeEventListener("pointerdown", this._onPointerDown);
        this.canvas.removeEventListener("pointermove", this._onPointerMove);
        this.canvas.removeEventListener("pointerup", this._onPointerUp);
        this.canvas.removeEventListener("pointercancel", this._onPointerCancel);
        this.canvas.removeEventListener("pointerleave", this._onPointerLeave);
        this.canvas.removeEventListener("lostpointercapture", this._onLostPointerCapture);
        this.canvas.removeEventListener("click", this._onClick);
        this.canvas.removeEventListener("dblclick", this._onDoubleClick);
        this.canvas.removeEventListener("contextmenu", this._onContextMenu);
        this.canvas.removeEventListener("wheel", this._onWheel);
    }
    createPointerContext(e) {
        const eventWithOffsets = e;
        return {
            clientX: e.clientX,
            clientY: e.clientY,
            localX: eventWithOffsets.offsetX ?? 0,
            localY: eventWithOffsets.offsetY ?? 0,
            pointerType: "pointerType" in e ? e.pointerType || "mouse" : "mouse",
            buttons: e.buttons,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
        };
    }
    resetState() {
        this.state = "IDLE";
        this.pressStartX = 0;
        this.lastDragX = 0;
        this.pressStartY = 0;
        this.lastDragY = 0;
    }
    getLocalXFromClient(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        return clientX - rect.left;
    }
    getLocalYFromClient(clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return clientY - rect.top;
    }
    beginPinchIfReady() {
        if (this.activeTouchPointers.size < 2) {
            return;
        }
        const pinchPair = [...this.activeTouchPointers.entries()]
            .sort((left, right) => left[0] - right[0])
            .slice(0, 2)
            .map((entry) => entry[1]);
        const [first, second] = pinchPair;
        if (!first || !second) {
            return;
        }
        const deltaX = second.clientX - first.clientX;
        const deltaY = second.clientY - first.clientY;
        this.pinchDistance = Math.hypot(deltaX, deltaY);
        const midpointClientX = (first.clientX + second.clientX) / 2;
        const midpointClientY = (first.clientY + second.clientY) / 2;
        this.pinchPivotLocalX = this.getLocalXFromClient(midpointClientX);
        this.pinchPivotLocalY = this.getLocalYFromClient(midpointClientY);
        this.isPinching = true;
        this.resetState();
    }
    updatePinch(e) {
        if (e.pointerType !== "touch") {
            return false;
        }
        this.activeTouchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        if (!this.isPinching) {
            this.beginPinchIfReady();
            return this.isPinching;
        }
        if (this.activeTouchPointers.size < 2) {
            this.isPinching = false;
            this.pinchDistance = 0;
            return false;
        }
        const pinchPair = [...this.activeTouchPointers.entries()]
            .sort((left, right) => left[0] - right[0])
            .slice(0, 2)
            .map((entry) => entry[1]);
        const [first, second] = pinchPair;
        if (!first || !second) {
            return false;
        }
        const deltaX = second.clientX - first.clientX;
        const deltaY = second.clientY - first.clientY;
        const nextDistance = Math.hypot(deltaX, deltaY);
        if (this.pinchDistance > 0 && nextDistance > 0) {
            const scaleRatio = nextDistance / this.pinchDistance;
            const delta = (scaleRatio - 1) * 8;
            if (Number.isFinite(delta) && Math.abs(delta) > 0.001) {
                this.callbacks.onZoom(delta, this.pinchPivotLocalX, this.pinchPivotLocalY);
            }
        }
        this.pinchDistance = nextDistance;
        const midpointClientX = (first.clientX + second.clientX) / 2;
        const midpointClientY = (first.clientY + second.clientY) / 2;
        this.pinchPivotLocalX = this.getLocalXFromClient(midpointClientX);
        this.pinchPivotLocalY = this.getLocalYFromClient(midpointClientY);
        return true;
    }
    releaseTouchPointer(pointerId) {
        this.activeTouchPointers.delete(pointerId);
        if (this.activeTouchPointers.size < 2) {
            this.isPinching = false;
            this.pinchDistance = 0;
        }
    }
    handlePointerDown(e) {
        if (e.pointerType === "touch") {
            this.activeTouchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            this.beginPinchIfReady();
            if (this.isPinching) {
                this.callbacks.onPointerDown?.(this.createPointerContext(e));
                return;
            }
        }
        this.state = "PRESSING";
        this.pressStartX = e.clientX;
        this.lastDragX = e.clientX;
        this.pressStartY = e.clientY;
        this.lastDragY = e.clientY;
        this.callbacks.onPointerDown?.(this.createPointerContext(e));
    }
    handlePointerMove(e) {
        const context = this.createPointerContext(e);
        this.callbacks.onPointerMove?.(context);
        if (this.updatePinch(e)) {
            return;
        }
        if (this.state === "PRESSING") {
            const deltaFromPress = e.clientX - this.pressStartX;
            const deltaFromPressY = e.clientY - this.pressStartY;
            // Allow drag to start if EITHER horizontal OR vertical threshold is crossed
            // Use || to enable vertical-only or horizontal-only dragging
            if (Math.abs(deltaFromPress) < DRAG_START_THRESHOLD_PX && Math.abs(deltaFromPressY) < DRAG_START_THRESHOLD_PX) {
                return;
            }
            this.state = "DRAGGING";
            this.callbacks.onDragStart?.(context);
        }
        if (this.state === "DRAGGING") {
            const deltaX = e.clientX - this.lastDragX;
            const deltaY = e.clientY - this.lastDragY;
            this.lastDragX = e.clientX;
            this.lastDragY = e.clientY;
            this.callbacks.onDragMove?.(context);
            this.callbacks.onPan(deltaX, deltaY);
        }
        else {
            this.callbacks.onCrosshairMove(context.localX, context.localY);
        }
    }
    handlePointerUp(e) {
        if (e.pointerType === "touch") {
            this.releaseTouchPointer(e.pointerId);
            if (this.isPinching) {
                this.callbacks.onPointerUp?.(this.createPointerContext(e));
                return;
            }
        }
        const context = this.createPointerContext(e);
        if (this.state === "DRAGGING") {
            this.callbacks.onDragEnd?.(context);
        }
        this.callbacks.onPointerUp?.(context);
        this.resetState();
    }
    handlePointerCancel(e) {
        if (e.pointerType === "touch") {
            this.releaseTouchPointer(e.pointerId);
        }
        const context = this.createPointerContext(e);
        if (this.state === "DRAGGING") {
            this.callbacks.onDragEnd?.(context);
        }
        this.callbacks.onPointerCancel?.(context);
        this.resetState();
        this.callbacks.onCrosshairLeave();
    }
    handlePointerLeave(e) {
        if (e.pointerType === "touch") {
            this.releaseTouchPointer(e.pointerId);
        }
        const context = this.createPointerContext(e);
        if (this.state === "DRAGGING") {
            this.callbacks.onDragEnd?.(context);
        }
        this.callbacks.onPointerLeave?.(context);
        this.resetState();
        this.callbacks.onCrosshairLeave();
    }
    handleLostPointerCapture(e) {
        if (e.pointerType === "touch") {
            this.releaseTouchPointer(e.pointerId);
        }
        this.resetState();
    }
    handleClick(e) {
        this.callbacks.onClick?.(this.createPointerContext(e));
    }
    handleDoubleClick(e) {
        this.callbacks.onDoubleClick?.(this.createPointerContext(e));
    }
    handleContextMenu(e) {
        e.preventDefault();
        this.callbacks.onContextMenu?.(this.createPointerContext(e));
    }
    handleWheel(e) {
        e.preventDefault();
        const delta = -e.deltaY / 100;
        const eventWithOffsets = e;
        const pivotX = eventWithOffsets.offsetX ?? 0;
        const pivotY = eventWithOffsets.offsetY ?? 0;
        this.callbacks.onZoom(delta, pivotX, pivotY);
    }
}
