import { jsx as _jsx } from "react/jsx-runtime";
import { useRef } from "react";
function clamp(value, minValue, maxValue) {
    return Math.min(Math.max(value, minValue), maxValue);
}
export function PaneSplitter({ onResize, minTopHeight = 40, minBottomHeight = 40, className, style }) {
    const dragStateRef = useRef(null);
    const handlePointerDown = (event) => {
        const splitterElement = event.currentTarget;
        const topPaneElement = splitterElement.previousElementSibling;
        const bottomPaneElement = splitterElement.nextElementSibling;
        if (!topPaneElement) {
            return;
        }
        const startTopHeight = topPaneElement.getBoundingClientRect().height;
        const availableHeight = startTopHeight + (bottomPaneElement?.getBoundingClientRect().height ?? 0);
        dragStateRef.current = {
            startY: event.clientY,
            startTopHeight,
            maxTopHeight: Math.max(minTopHeight, availableHeight - minBottomHeight),
        };
        const handleMove = (moveEvent) => {
            const dragState = dragStateRef.current;
            if (!dragState) {
                return;
            }
            const deltaY = moveEvent.clientY - dragState.startY;
            const nextHeight = clamp(dragState.startTopHeight + deltaY, minTopHeight, dragState.maxTopHeight);
            onResize(nextHeight);
        };
        const handleUp = () => {
            dragStateRef.current = null;
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp, { once: true });
        splitterElement.setPointerCapture(event.pointerId);
    };
    const mergedStyle = {
        cursor: "row-resize",
        height: 8,
        flex: "0 0 auto",
        touchAction: "none",
        background: "linear-gradient(90deg, transparent, rgba(120, 130, 150, 0.6), transparent)",
        ...style,
    };
    return (_jsx("div", { role: "separator", "aria-orientation": "horizontal", tabIndex: 0, className: className, style: mergedStyle, onPointerDown: handlePointerDown }));
}
