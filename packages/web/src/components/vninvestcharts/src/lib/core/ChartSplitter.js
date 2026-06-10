import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export function ChartSplitter({ splitterIndex, available, onCommitDelta, onDoubleClick, className, style, title, }) {
    const [isDragging, setIsDragging] = useState(false);
    const [visualOffset, setVisualOffset] = useState(0);
    const rootRef = useRef(null);
    const dragRef = useRef(null);
    // Keep refs in sync with the latest props so callbacks are always current.
    const commitRef = useRef(onCommitDelta);
    const availableRef = useRef(available);
    useEffect(() => { commitRef.current = onCommitDelta; }, [onCommitDelta]);
    useEffect(() => { availableRef.current = available; }, [available]);
    const handlePointerDown = (event) => {
        event.preventDefault();
        rootRef.current?.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
        setIsDragging(true);
        setVisualOffset(0);
    };
    const handlePointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        // Preview position via CSS only — avoids triggering ChartCanvas redraws on every pixel.
        setVisualOffset(event.clientY - drag.startY);
    };
    const stopDragging = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId)
            return;
        const node = rootRef.current;
        if (node?.hasPointerCapture(event.pointerId))
            node.releasePointerCapture(event.pointerId);
        const totalDelta = event.clientY - drag.startY;
        dragRef.current = null;
        setIsDragging(false);
        setVisualOffset(0);
        // Single commit on release → parent updates heights → ChartCanvas remounts with new key.
        if (totalDelta !== 0) {
            commitRef.current(splitterIndex, totalDelta, availableRef.current);
        }
    };
    const cls = [
        "rsc-splitter",
        isDragging ? "rsc-splitter--dragging" : "",
        className ?? "",
    ].filter(Boolean).join(" ");
    return (_jsx("div", { ref: rootRef, className: cls, style: {
            ...style,
            transform: visualOffset !== 0 ? `translateY(${visualOffset}px)` : undefined,
        }, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: stopDragging, onPointerCancel: stopDragging, onDoubleClick: onDoubleClick, title: title ?? "Drag to resize pane • Double-click to reset", children: _jsx("div", { className: "rsc-splitter__handle" }) }));
}
