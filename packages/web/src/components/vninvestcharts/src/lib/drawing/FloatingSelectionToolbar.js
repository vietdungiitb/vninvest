import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useRef, useState } from "react";
import { useCompactViewport } from "./useCompactViewport.js";
import { getSegmentKeys, hasSubSegments } from "./segmentRegistry.js";
function renderActionIcon(action) {
    switch (action.id) {
        case "clone":
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "5", y: "3", width: "8", height: "9", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("rect", { x: "2", y: "6", width: "8", height: "8", rx: "2", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case "toggleLock":
            return action.active ? (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "3.5", y: "7", width: "9", height: "6", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M5.5 7V5.25A2.5 2.5 0 0 1 8 2.75a2.5 2.5 0 0 1 2.5 2.5V7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) : (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "3.5", y: "7", width: "9", height: "6", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M10.5 5.25a2.5 2.5 0 0 0-5 0V7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "toggleVisibility":
            return action.active ? (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8Z", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("circle", { cx: "8", cy: "8", r: "2", stroke: "currentColor", strokeWidth: "1.2" })] })) : (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M2 2l12 12", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("path", { d: "M1.75 8S4 3.75 8 3.75c1.17 0 2.2.36 3.08.88M14.25 8S12 12.25 8 12.25c-1.19 0-2.24-.37-3.13-.9", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "editText":
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M3 12.5h3l5.5-5.5-3-3L3 9.5v3Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("path", { d: "M8 4.5l3 3", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "bringToFront":
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M8 12V4", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("path", { d: "M5.5 6.5 8 4l2.5 2.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M4 13h8", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "sendToBack":
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M8 4v8", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("path", { d: "M10.5 9.5 8 12 5.5 9.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M4 3h8", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "delete":
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M3.5 4.5h9", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("path", { d: "M6 4.5V3.75a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.75", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("path", { d: "M5 6.25v5.5M8 6.25v5.5M11 6.25v5.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "openProperties":
            // Three-dot ⋯ — opens Tier-2 detail panel
            return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "3.5", cy: "8", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "8", cy: "8", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "12.5", cy: "8", r: "1.2", fill: "currentColor" })] }));
    }
    return null;
}
function resolvePalette(isDark) {
    if (isDark) {
        return {
            panel: "rgba(15, 23, 42, 0.92)",
            border: "rgba(148, 163, 184, 0.22)",
            text: "#f8fafc",
            hover: "rgba(148, 163, 184, 0.14)",
            active: "rgba(34, 211, 238, 0.18)",
            accent: "#67e8f9",
            danger: "#fca5a5",
            dangerBg: "rgba(239, 68, 68, 0.14)",
        };
    }
    return {
        panel: "rgba(255, 255, 255, 0.96)",
        border: "rgba(15, 23, 42, 0.16)",
        text: "#0f172a",
        hover: "rgba(15, 23, 42, 0.08)",
        active: "rgba(34, 211, 238, 0.16)",
        accent: "#0891b2",
        danger: "#b91c1c",
        dangerBg: "rgba(220, 38, 38, 0.1)",
    };
}
function renderActionButton(action, palette, onAction) {
    const isDanger = action.tone === "danger";
    const baseStyle = {
        width: 30,
        height: 30,
        borderRadius: 10,
        border: `1px solid ${action.active ? palette.accent : palette.border}`,
        background: isDanger ? palette.dangerBg : action.active ? palette.active : "transparent",
        color: isDanger ? palette.danger : action.active ? palette.accent : palette.text,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        padding: 0,
        transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
    };
    return (_jsx("button", { type: "button", "aria-label": action.label, title: action.label, onClick: () => onAction(action.id), style: baseStyle, onMouseEnter: (event) => {
            event.currentTarget.style.background = isDanger ? palette.dangerBg : action.active ? palette.active : palette.hover;
            event.currentTarget.style.transform = "translateY(-1px)";
        }, onMouseLeave: (event) => {
            event.currentTarget.style.background = isDanger ? palette.dangerBg : action.active ? palette.active : "transparent";
            event.currentTarget.style.transform = "translateY(0)";
        }, children: renderActionIcon(action) }, action.id));
}
export function FloatingSelectionToolbar({ model, position, ariaLabel, isDark, onAction, semanticPoints, onSemanticPointFocus, drawing, onUpdate, selectedCount, onDeleteAll, onLockAll, onSetVisibleAll, onBatchColor, allLocked, allHidden, }) {
    const isCompactViewport = useCompactViewport();
    const [selectedSegment, setSelectedSegment] = useState("all");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showWidthPicker, setShowWidthPicker] = useState(false);
    const [showStylePicker, setShowStylePicker] = useState(false);
    // ── Drag state ───────────────────────────────────────────────────────────
    const [dragPos, setDragPos] = useState(null);
    const dragStartRef = useRef(null);
    const lastDrawingIdRef = useRef(undefined);
    if (drawing && drawing.id !== lastDrawingIdRef.current) {
        lastDrawingIdRef.current = drawing.id;
        setSelectedSegment("all");
        setDragPos(null);
    }
    const handleDragStart = useCallback((clientX, clientY) => {
        const base = dragPos ?? position ?? { x: 16, y: 80 };
        dragStartRef.current = { mouseX: clientX, mouseY: clientY, startX: base.x, startY: base.y };
    }, [dragPos, position]);
    const handleDragMove = useCallback((clientX, clientY) => {
        if (!dragStartRef.current)
            return;
        setDragPos({
            x: dragStartRef.current.startX + clientX - dragStartRef.current.mouseX,
            y: dragStartRef.current.startY + clientY - dragStartRef.current.mouseY,
        });
    }, []);
    const handleDragEnd = useCallback(() => {
        dragStartRef.current = null;
    }, []);
    const handleDragMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(e.clientX, e.clientY);
        const onMove = (mv) => {
            handleDragMove(mv.clientX, mv.clientY);
        };
        const onUp = () => {
            handleDragEnd();
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [handleDragStart, handleDragMove, handleDragEnd]);
    const handleDragTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        if (!touch)
            return;
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(touch.clientX, touch.clientY);
        const onMove = (mv) => {
            const t = mv.touches[0];
            if (!t)
                return;
            handleDragMove(t.clientX, t.clientY);
        };
        const onEnd = () => {
            handleDragEnd();
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
        };
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
    }, [handleDragStart, handleDragMove, handleDragEnd]);
    // ── GAP-4: Multi-select floating toolbar ────────────────────────────────
    // Renders when selectedCount > 1, regardless of whether a model is present.
    const [showMultiColorPicker, setShowMultiColorPicker] = useState(false);
    const [multiColor, setMultiColor] = useState("#2962ff");
    if (selectedCount !== undefined && selectedCount > 1) {
        const effectiveMultiPos = dragPos ?? position ?? { x: 16, y: 80 };
        const palette = resolvePalette(isDark);
        const multiBarStyle = {
            position: "absolute",
            left: effectiveMultiPos.x,
            top: effectiveMultiPos.y,
            zIndex: 32,
            display: "inline-flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            padding: "4px 8px",
            borderRadius: 12,
            border: `1px solid ${palette.border}`,
            background: palette.panel,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 8px 28px rgba(15, 23, 42, 0.20)",
            pointerEvents: "auto",
            userSelect: "none",
            whiteSpace: "nowrap",
        };
        const btnStyle = (active = false, danger = false) => ({
            width: 30,
            height: 30,
            borderRadius: 10,
            border: `1px solid ${active ? palette.accent : palette.border}`,
            background: danger ? palette.dangerBg : active ? palette.active : "transparent",
            color: danger ? palette.danger : active ? palette.accent : palette.text,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            padding: 0,
        });
        const divStyle = { width: 1, height: 22, background: palette.border, margin: "0 4px" };
        const countBadgeStyle = {
            fontSize: 11,
            color: palette.text,
            opacity: 0.7,
            paddingLeft: 6,
            paddingRight: 4,
            userSelect: "none",
        };
        const handleMultiColorSelect = (color) => {
            setMultiColor(color);
            setShowMultiColorPicker(false);
            onBatchColor?.(color);
        };
        return (_jsxs("div", { style: multiBarStyle, role: "toolbar", "aria-label": ariaLabel, onMouseDown: handleDragMouseDown, onTouchStart: handleDragTouchStart, children: [_jsx("button", { type: "button", "aria-label": "X\u00F3a t\u1EA5t c\u1EA3", title: "X\u00F3a t\u1EA5t c\u1EA3", style: btnStyle(false, true), onClick: onDeleteAll, onMouseEnter: (e) => { e.currentTarget.style.background = palette.dangerBg; }, onMouseLeave: (e) => { e.currentTarget.style.background = palette.dangerBg; }, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M3 4.5h10M6 4.5V3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4.5M6 7v4.5M10 7v4.5M4.5 4.5l.5 7.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), _jsx("span", { "aria-hidden": "true", style: divStyle }), _jsx("button", { type: "button", "aria-label": allLocked ? "Mở khóa tất cả" : "Khóa tất cả", title: allLocked ? "Mở khóa tất cả" : "Khóa tất cả", style: btnStyle(allLocked), onClick: () => onLockAll?.(!allLocked), children: allLocked ? (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "3.5", y: "7", width: "9", height: "6", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M5.5 7V5.25A2.5 2.5 0 0 1 8 2.75a2.5 2.5 0 0 1 2.5 2.5V7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) : (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "3.5", y: "7", width: "9", height: "6", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M10.5 5.25a2.5 2.5 0 0 0-5 0V7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) }), _jsx("button", { type: "button", "aria-label": allHidden ? "Hiện tất cả" : "Ẩn tất cả", title: allHidden ? "Hiện tất cả" : "Ẩn tất cả", style: btnStyle(allHidden), onClick: () => onSetVisibleAll?.(allHidden === true), children: allHidden ? (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M2 2l12 12M7 4.2A5.5 5.5 0 0 1 8 4c4 0 6.25 4 6.25 4s-.8 1.56-2.25 2.8M4.5 5.2C2.8 6.44 1.75 8 1.75 8S4 12.25 8 12.25a5.5 5.5 0 0 0 2.8-.75", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }) })) : (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8Z", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("circle", { cx: "8", cy: "8", r: "2", stroke: "currentColor", strokeWidth: "1.2" })] })) }), _jsx("span", { "aria-hidden": "true", style: divStyle }), _jsxs("div", { style: { position: "relative" }, children: [_jsx("button", { type: "button", "aria-label": "\u0110\u1ED5i m\u00E0u t\u1EA5t c\u1EA3", title: "\u0110\u1ED5i m\u00E0u t\u1EA5t c\u1EA3", style: btnStyle(showMultiColorPicker), onClick: () => setShowMultiColorPicker((v) => !v), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "4", fill: multiColor, opacity: "0.9" }), _jsx("circle", { cx: "8", cy: "8", r: "5.5", stroke: "currentColor", strokeWidth: "1.2" })] }) }), showMultiColorPicker && (_jsx("div", { style: {
                                position: "absolute",
                                bottom: "100%",
                                left: 0,
                                marginBottom: 6,
                                zIndex: 10001,
                                background: palette.panel,
                                border: `1px solid ${palette.border}`,
                                borderRadius: 8,
                                padding: 6,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                                width: 116,
                            }, children: ["#2962ff", "#ef5350", "#26a69a", "#ffb300", "#ab47bc", "#ff7043", "#26c6da", "#ffffff", "#888888", "#000000"].map((c) => (_jsx("button", { type: "button", "aria-label": c, style: {
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    background: c,
                                    border: c === multiColor ? `2px solid ${palette.accent}` : "1px solid transparent",
                                    cursor: "pointer",
                                    padding: 0,
                                }, onClick: () => handleMultiColorSelect(c) }, c))) }))] }), _jsxs("span", { style: countBadgeStyle, "aria-live": "polite", children: [selectedCount, " \u0111\u00E3 ch\u1ECDn"] })] }));
    }
    if (!model) {
        return null;
    }
    // Effective position: user-dragged → computed → hardcoded fallback
    const effectivePos = dragPos ?? position ?? { x: 16, y: 80 };
    const palette = resolvePalette(isDark);
    // ── Compact (mobile) bottom-sheet layout ─────────────────────────────────
    if (isCompactViewport) {
        const containerStyle = {
            position: "absolute",
            left: 8,
            right: 8,
            top: "auto",
            bottom: 8,
            zIndex: 32,
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 22,
            border: `1px solid ${palette.border}`,
            background: palette.panel,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 -16px 32px rgba(15, 23, 42, 0.18)",
            pointerEvents: "auto",
        };
        const groupStyle = {
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
            justifyContent: "center",
        };
        const dividerStyle = { display: "none" };
        return (_jsxs("div", { style: containerStyle, role: "toolbar", "aria-label": ariaLabel, children: [_jsx("div", { style: groupStyle, children: model.primaryActions.map((a) => renderActionButton(a, palette, onAction)) }), model.secondaryActions.length > 0 && (_jsx("div", { style: groupStyle, children: model.secondaryActions.map((a) => renderActionButton(a, palette, onAction)) })), _jsx("div", { style: groupStyle, children: renderActionButton(model.dangerAction, palette, onAction) }), semanticPoints && semanticPoints.labels.length > 0 && (_jsx("div", { style: { flexBasis: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 6, borderTop: `1px solid ${palette.border}` }, children: renderSemanticPointButtons(semanticPoints, palette, onSemanticPointFocus) })), _jsx("span", { "aria-hidden": "true", style: dividerStyle })] }));
    }
    // ── Desktop: single horizontal draggable bar ──────────────────────────────
    const barStyle = {
        position: "absolute",
        left: effectivePos.x,
        top: effectivePos.y,
        zIndex: 32,
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 0,
        padding: "4px 6px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.panel,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 8px 28px rgba(15, 23, 42, 0.20)",
        pointerEvents: "auto",
        userSelect: "none",
        whiteSpace: "nowrap",
    };
    const dividerStyle = {
        width: 1,
        height: 22,
        background: palette.border,
        margin: "0 4px",
        flexShrink: 0,
    };
    const groupStyle = {
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        flexShrink: 0,
    };
    // Drag handle (grip dots)
    const dragHandleStyle = {
        display: "grid",
        placeItems: "center",
        width: 20,
        height: 30,
        cursor: "grab",
        color: palette.text,
        opacity: 0.4,
        marginRight: 2,
        flexShrink: 0,
    };
    return (_jsxs("div", { style: barStyle, role: "toolbar", "aria-label": ariaLabel, children: [_jsx("div", { style: dragHandleStyle, "aria-hidden": "true", title: "K\u00E9o \u0111\u1EC3 di chuy\u1EC3n thanh c\u00F4ng c\u1EE5", onMouseDown: handleDragMouseDown, onTouchStart: handleDragTouchStart, children: _jsxs("svg", { width: "10", height: "16", viewBox: "0 0 10 16", fill: "currentColor", "aria-hidden": "true", children: [_jsx("circle", { cx: "3", cy: "3", r: "1.5" }), _jsx("circle", { cx: "7", cy: "3", r: "1.5" }), _jsx("circle", { cx: "3", cy: "8", r: "1.5" }), _jsx("circle", { cx: "7", cy: "8", r: "1.5" }), _jsx("circle", { cx: "3", cy: "13", r: "1.5" }), _jsx("circle", { cx: "7", cy: "13", r: "1.5" })] }) }), semanticPoints && semanticPoints.labels.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }, children: renderSemanticPointButtons(semanticPoints, palette, onSemanticPointFocus) }), _jsx("span", { "aria-hidden": "true", style: dividerStyle })] })), drawing && (_jsxs(_Fragment, { children: [hasSubSegments(drawing.type) && (_jsx("div", { style: { display: "inline-flex", alignItems: "center", gap: 4, marginRight: 6, flexShrink: 0 }, children: _jsxs("select", { value: selectedSegment, onChange: (e) => setSelectedSegment(e.target.value), style: {
                                fontSize: "11px",
                                background: "rgba(0, 0, 0, 0.2)",
                                border: `1px solid ${palette.border}`,
                                borderRadius: "6px",
                                color: palette.text,
                                padding: "2px 4px",
                                outline: "none",
                                cursor: "pointer"
                            }, children: [_jsx("option", { value: "all", children: "T\u1EA5t c\u1EA3" }), getSegmentKeys(drawing.type).map((key) => (_jsx("option", { value: key, children: key }, key)))] }) })), _jsxs("div", { style: { position: "relative", display: "inline-flex", alignItems: "center", marginRight: 6, flexShrink: 0 }, children: [_jsx("button", { type: "button", title: "Ch\u1ECDn m\u00E0u s\u1EAFc", onClick: () => setShowColorPicker(!showColorPicker), style: {
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    border: `1px solid ${palette.border}`,
                                    background: selectedSegment === "all"
                                        ? (drawing.style?.stroke ?? "#ffffff")
                                        : (drawing.segmentStyles?.[selectedSegment]?.stroke ?? drawing.style?.stroke ?? "#ffffff"),
                                    cursor: "pointer",
                                    padding: 0
                                } }), showColorPicker && (_jsx("div", { style: {
                                    position: "absolute",
                                    bottom: "100%",
                                    left: 0,
                                    marginBottom: 6,
                                    zIndex: 10001,
                                    background: palette.panel,
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: 8,
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                                    display: "grid",
                                    gridTemplateColumns: "repeat(4, 1fr)",
                                    gap: 4
                                }, children: ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#ffffff", "#9ca3af", "#000000"].map((c) => (_jsx("button", { type: "button", onClick: () => {
                                        if (selectedSegment === "all") {
                                            onUpdate?.({ style: { ...drawing.style, stroke: c } });
                                        }
                                        else {
                                            onUpdate?.({
                                                segmentStyles: {
                                                    ...(drawing.segmentStyles ?? {}),
                                                    [selectedSegment]: {
                                                        ...(drawing.segmentStyles?.[selectedSegment] ?? {}),
                                                        stroke: c
                                                    }
                                                }
                                            });
                                        }
                                        setShowColorPicker(false);
                                    }, style: {
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        background: c,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        cursor: "pointer",
                                        padding: 0
                                    } }, c))) }))] }), _jsxs("div", { style: { position: "relative", display: "inline-flex", alignItems: "center", marginRight: 6, flexShrink: 0 }, children: [_jsxs("button", { type: "button", title: "\u0110\u1ED9 d\u00E0y n\u00E9t", onClick: () => setShowWidthPicker(!showWidthPicker), style: {
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    border: `1px solid ${palette.border}`,
                                    background: "transparent",
                                    color: palette.text,
                                    fontSize: 10,
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    padding: 0
                                }, children: [drawing.style?.strokeWidth ?? 1, "px"] }), showWidthPicker && (_jsx("div", { style: {
                                    position: "absolute",
                                    bottom: "100%",
                                    left: 0,
                                    marginBottom: 6,
                                    zIndex: 10001,
                                    background: palette.panel,
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: 4,
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2
                                }, children: [1, 2, 3, 4, 5].map((w) => (_jsxs("button", { type: "button", onClick: () => {
                                        onUpdate?.({ style: { ...drawing.style, strokeWidth: w } });
                                        setShowWidthPicker(false);
                                    }, style: {
                                        padding: "4px 8px",
                                        fontSize: 11,
                                        background: (drawing.style?.strokeWidth ?? 1) === w ? palette.active : "transparent",
                                        color: palette.text,
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        textAlign: "left"
                                    }, children: [w, "px"] }, w))) }))] }), _jsxs("div", { style: { position: "relative", display: "inline-flex", alignItems: "center", marginRight: 6, flexShrink: 0 }, children: [_jsx("button", { type: "button", title: "Ki\u1EC3u n\u00E9t v\u1EBD", onClick: () => setShowStylePicker(!showStylePicker), style: {
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    border: `1px solid ${palette.border}`,
                                    background: "transparent",
                                    color: palette.text,
                                    cursor: "pointer",
                                    padding: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                }, children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", children: _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: drawing.style?.strokeDasharray === "dashed" ? "3 2" : drawing.style?.strokeDasharray === "dotted" ? "1 2" : undefined }) }) }), showStylePicker && (_jsx("div", { style: {
                                    position: "absolute",
                                    bottom: "100%",
                                    left: 0,
                                    marginBottom: 6,
                                    zIndex: 10001,
                                    background: palette.panel,
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: 4,
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2
                                }, children: [
                                    { id: "solid", label: "Liền" },
                                    { id: "dashed", label: "Đứt đoạn" },
                                    { id: "dotted", label: "Chấm" }
                                ].map((s) => (_jsx("button", { type: "button", onClick: () => {
                                        onUpdate?.({ style: { ...drawing.style, strokeDasharray: s.id } });
                                        setShowStylePicker(false);
                                    }, style: {
                                        padding: "4px 8px",
                                        fontSize: 11,
                                        background: (drawing.style?.strokeDasharray ?? "solid") === s.id ? palette.active : "transparent",
                                        color: palette.text,
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        textAlign: "left",
                                        whiteSpace: "nowrap"
                                    }, children: s.label }, s.id))) }))] }), _jsx("span", { "aria-hidden": "true", style: dividerStyle })] })), _jsx("div", { style: groupStyle, children: model.primaryActions.map((a) => renderActionButton(a, palette, onAction)) }), model.secondaryActions.length > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": "true", style: dividerStyle }), _jsx("div", { style: groupStyle, children: model.secondaryActions.map((a) => renderActionButton(a, palette, onAction)) })] })), _jsx("span", { "aria-hidden": "true", style: dividerStyle }), _jsx("div", { style: groupStyle, children: renderActionButton(model.dangerAction, palette, onAction) })] }));
}
// ── Semantic point buttons helper ───────────────────────────────────────────
function renderSemanticPointButtons(semanticPoints, palette, onSemanticPointFocus) {
    const activePrice = semanticPoints.activeIndex !== null
        ? semanticPoints.prices?.[semanticPoints.activeIndex]
        : undefined;
    return (_jsxs(_Fragment, { children: [_jsx("span", { style: { fontSize: 10, color: palette.text, opacity: 0.55, marginRight: 2, whiteSpace: "nowrap" }, children: "\u0110i\u1EC3m:" }), semanticPoints.labels.map((label, index) => {
                const isActive = semanticPoints.activeIndex === index;
                const btnStyle = {
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: `1.5px solid ${isActive ? palette.accent : palette.border}`,
                    background: isActive ? palette.active : "transparent",
                    color: isActive ? palette.accent : palette.text,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: "background 100ms ease, border-color 100ms ease",
                };
                return (_jsx("button", { type: "button", style: btnStyle, "aria-label": `Điểm ${label}`, "aria-pressed": isActive, title: `Điểm ${label}${semanticPoints.prices?.[index] != null ? ` — ${semanticPoints.prices[index].toFixed(2)}` : ""}`, onClick: () => onSemanticPointFocus?.(isActive ? null : index), onMouseEnter: (e) => { e.currentTarget.style.background = isActive ? palette.active : palette.hover; }, onMouseLeave: (e) => { e.currentTarget.style.background = isActive ? palette.active : "transparent"; }, children: label }, `${label}-${index}`));
            }), activePrice != null && (_jsx("span", { style: { fontSize: 10, fontWeight: 600, color: palette.accent, marginLeft: 4, whiteSpace: "nowrap" }, children: activePrice.toFixed(2) }))] }));
}
