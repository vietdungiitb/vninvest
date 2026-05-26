import { useRef } from "react";

// CE21: Long-press detector for mobile context menu.
// Fires `callback` after `delay` ms if the pointer has not moved more than
// `moveThreshold` pixels since pointerdown.
// Skips pointerType="mouse" — desktop right-click is handled by onContextMenu.
//
// Browser compat: Pointer Events API (iOS 13+, Chrome 55+, Firefox 59+).
// Falls back to no-op on unsupported environments.

export interface UseLongPressOptions {
	/** Delay in ms before firing. Default: 500 */
	delay?: number;
	/** Movement threshold in pixels that cancels the long-press. Default: 10 */
	moveThreshold?: number;
}

export interface LongPressHandlers {
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
	onPointerCancel: (e: React.PointerEvent) => void;
}

export function useLongPress(
	callback: (e: React.PointerEvent) => void,
	{ delay = 500, moveThreshold = 10 }: UseLongPressOptions = {},
): LongPressHandlers {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startPosRef = useRef<{ x: number; y: number } | null>(null);
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

	const onPointerDown = (e: React.PointerEvent) => {
		// Only handle touch / pen; mouse context menu is handled by onContextMenu
		if (e.pointerType === "mouse") return;
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

	const onPointerMove = (e: React.PointerEvent) => {
		if (e.pointerType === "mouse") return;
		if (!startPosRef.current) return;
		const dx = e.clientX - startPosRef.current.x;
		const dy = e.clientY - startPosRef.current.y;
		if (Math.hypot(dx, dy) > moveThreshold) {
			clearTimer();
		}
	};

	const onPointerUp = (_e: React.PointerEvent) => {
		clearTimer();
	};

	const onPointerCancel = (_e: React.PointerEvent) => {
		clearTimer();
	};

	return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
