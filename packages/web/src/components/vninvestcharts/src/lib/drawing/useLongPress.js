import { useRef } from "react";
export function useLongPress(callback, { delay = 500, moveThreshold = 10 } = {}) {
    const timerRef = useRef(null);
    const startPosRef = useRef(null);
    // Keep latest callback in ref so callers can update without re-registering handlers
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    function clearTimer() {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        startPosRef.current = null;
    }
    const onPointerDown = (e) => {
        // Only handle touch / pen; mouse context menu is handled by onContextMenu
        if (e.pointerType === "mouse")
            return;
        clearTimer();
        startPosRef.current = { x: e.clientX, y: e.clientY };
        const captured = e; // close over event snapshot for callback
        timerRef.current = setTimeout(() => {
            if (startPosRef.current !== null) {
                callbackRef.current(captured);
            }
            startPosRef.current = null;
            timerRef.current = null;
        }, delay);
    };
    const onPointerMove = (e) => {
        if (e.pointerType === "mouse")
            return;
        if (!startPosRef.current)
            return;
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.hypot(dx, dy) > moveThreshold) {
            clearTimer();
        }
    };
    const onPointerUp = (_e) => {
        clearTimer();
    };
    const onPointerCancel = (_e) => {
        clearTimer();
    };
    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
