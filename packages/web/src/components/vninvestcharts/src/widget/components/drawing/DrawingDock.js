import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export default function DrawingDock({ isOpen, activeTab, labels, position, onClose, onTabChange, headerActions, propertiesContent, objectsContent, templatesContent, }) {
    const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const rootRef = useRef(null);
    const dragStartRef = useRef(null);
    useEffect(() => {
        if (!isDragging)
            return;
        const handlePointerMove = (e) => {
            if (!dragStartRef.current)
                return;
            if (e.pointerId !== dragStartRef.current.pointerId)
                return;
            const nextX = dragStartRef.current.baseX + (e.clientX - dragStartRef.current.startX);
            const nextY = dragStartRef.current.baseY + (e.clientY - dragStartRef.current.startY);
            const baseLeft = position?.x ?? 16;
            const baseTop = position?.y ?? 16;
            const node = rootRef.current;
            const width = node?.offsetWidth ?? 360;
            const height = node?.offsetHeight ?? 420;
            const maxOffsetX = Math.max(0, window.innerWidth - width - 8) - baseLeft;
            const maxOffsetY = Math.max(0, window.innerHeight - height - 8) - baseTop;
            const minOffsetX = 8 - baseLeft;
            const minOffsetY = 8 - baseTop;
            setDragDelta({
                x: Math.min(maxOffsetX, Math.max(minOffsetX, nextX)),
                y: Math.min(maxOffsetY, Math.max(minOffsetY, nextY)),
            });
        };
        const handlePointerUp = (e) => {
            if (!dragStartRef.current)
                return;
            if (e.pointerId !== dragStartRef.current.pointerId)
                return;
            dragStartRef.current = null;
            setIsDragging(false);
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
        document.addEventListener("pointercancel", handlePointerUp);
        return () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
            document.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [isDragging, position?.x, position?.y]);
    if (!isOpen) {
        return null;
    }
    const left = (position?.x ?? 16) + dragDelta.x;
    const top = (position?.y ?? 16) + dragDelta.y;
    const handleHeaderPointerDown = (e) => {
        // Ignore clicks on buttons inside the header
        if (e.target.closest("button"))
            return;
        if (e.button !== 0)
            return;
        e.preventDefault();
        dragStartRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            baseX: dragDelta.x,
            baseY: dragDelta.y,
        };
        setIsDragging(true);
    };
    const resolvedContent = activeTab === "properties"
        ? (propertiesContent ?? _jsx("div", { className: "vnsc-drawing-dock__empty", children: labels.emptyProperties }))
        : activeTab === "objects"
            ? (objectsContent ?? _jsx("div", { className: "vnsc-drawing-dock__empty", children: labels.emptyObjects }))
            : (templatesContent ?? _jsx("div", { className: "vnsc-drawing-dock__empty", children: labels.emptyTemplates }));
    return (_jsxs("section", { ref: rootRef, className: "vnsc-drawing-dock", style: { left, top }, "aria-label": labels.title, children: [_jsxs("header", { className: "vnsc-drawing-dock__header", style: { cursor: isDragging ? "grabbing" : "grab" }, onPointerDown: handleHeaderPointerDown, children: [_jsxs("div", { className: "vnsc-drawing-dock__title-block", children: [_jsx("strong", { children: labels.title }), _jsx("span", { children: activeTab === "properties" ? labels.properties : activeTab === "objects" ? labels.objects : labels.templates })] }), _jsxs("div", { className: "vnsc-drawing-dock__header-actions", children: [headerActions, _jsx("button", { type: "button", className: "vnsc-drawing-dock__icon", onClick: onClose, "aria-label": labels.close, children: "x" })] })] }), _jsx("nav", { className: "vnsc-drawing-dock__tabs", "aria-label": labels.title, children: [
                    ["properties", labels.properties],
                    ["objects", labels.objects],
                    ["templates", labels.templates],
                ].map(([tab, label]) => (_jsx("button", { type: "button", className: `vnsc-drawing-dock__tab ${activeTab === tab ? "vnsc-drawing-dock__tab--active" : ""}`, "aria-pressed": activeTab === tab, onClick: () => onTabChange(tab), children: label }, tab))) }), _jsx("div", { className: "vnsc-drawing-dock__body", children: resolvedContent })] }));
}
