import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export default function ChartPaneSplitter({ splitterIndex, available, applyDragDelta, onDoubleClick, style, }) {
    const [isDragging, setIsDragging] = useState(false);
    const [visualOffset, setVisualOffset] = useState(0);
    const rootRef = useRef(null);
    const dragRef = useRef(null);
    const applyDragDeltaRef = useRef(applyDragDelta);
    const availableRef = useRef(available);
    useEffect(() => {
        applyDragDeltaRef.current = applyDragDelta;
    }, [applyDragDelta]);
    useEffect(() => {
        availableRef.current = available;
    }, [available]);
    const handlePointerDown = (event) => {
        event.preventDefault();
        const node = rootRef.current;
        if (node)
            node.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
        setIsDragging(true);
        setVisualOffset(0);
    };
    const handlePointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        // Only update CSS visual — do NOT touch React state during drag to avoid
        // triggering ChartCanvas redraws on every pixel (causes heavy flicker).
        setVisualOffset(event.clientY - drag.startY);
    };
    const stopDragging = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const node = rootRef.current;
        if (node?.hasPointerCapture(event.pointerId)) {
            node.releasePointerCapture(event.pointerId);
        }
        const totalDelta = event.clientY - drag.startY;
        dragRef.current = null;
        setIsDragging(false);
        setVisualOffset(0);
        // Commit the full drag delta once on release → triggers clean ChartCanvas remount.
        if (totalDelta !== 0) {
            applyDragDeltaRef.current(splitterIndex, totalDelta, availableRef.current);
        }
    };
    return (_jsx("div", { ref: rootRef, className: `gc-pane-splitter${isDragging ? " gc-pane-splitter--dragging" : ""}`, style: {
            ...style,
            transform: visualOffset !== 0 ? `translateY(${visualOffset}px)` : undefined,
        }, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: stopDragging, onPointerCancel: stopDragging, onDoubleClick: onDoubleClick, title: "K\u00E9o \u0111\u1EC3 thay \u0111\u1ED5i chi\u1EC1u cao pane \u2022 Double-click \u0111\u1EC3 reset", children: _jsx("div", { className: "gc-pane-splitter__handle" }) }));
}
