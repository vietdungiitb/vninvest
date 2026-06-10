import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WE2 P2-02: DrawingToolbar
 *
 * Left-side drawing toolbar with tool groups, recent tools, favorites,
 * magnet snap toggle, and search.
 *
 * Connects to VNInvestChartsStateContext for active tool state.
 * Uses .vnsc- CSS prefix for widget namespace.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
import { useVNInvestChartsState } from "../../context/VNInvestChartsStateContext.js";
import { drawingToolIcons } from "../../../lib/drawing/drawingToolIcons.js";
import { TOOL_GROUPS_V2 } from "../../config/toolGroups.js";
import { DRAWING_SHORTCUTS } from "../../../lib/drawing/index.js";
import { useFavoriteTools } from "../../../lib/drawing/hooks/useFavoriteTools.js";
import { useRecentTools } from "../../../lib/drawing/hooks/useRecentTools.js";
const TOOL_SHORTCUT_BADGE = Object.fromEntries(DRAWING_SHORTCUTS
    .filter((s) => s.action.type === "tool")
    .map((s) => [s.action.tool, s.key]));
// SVG tool icons fallback
function ToolIcon({ id }) {
    const customIcon = drawingToolIcons[id];
    if (customIcon) {
        return _jsx(_Fragment, { children: customIcon });
    }
    switch (id) {
        case "cursor":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M3 2l10 6.8-5.5 1.2-2.8 5.3L3 2z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }));
        case "crosshair":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "8", cy: "8", r: "3", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "1", x2: "8", y2: "4.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "11.5", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "1", y1: "8", x2: "4.5", y2: "8", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "11.5", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.4" })] }));
        case "trendLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "3", cy: "13", r: "1.5", fill: "currentColor" }), _jsx("circle", { cx: "13", cy: "3", r: "1.5", fill: "currentColor" }), _jsx("line", { x1: "4", y1: "12", x2: "12", y2: "4", stroke: "currentColor", strokeWidth: "1.5" })] }));
        case "ray":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "3", y1: "12", x2: "13", y2: "4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M10.5 4H13V6.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "extendedLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "2", y1: "12", x2: "14", y2: "4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "14", cy: "4", r: "1.2", fill: "currentColor" })] }));
        case "hLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" }), _jsx("circle", { cx: "3", cy: "8", r: "1.5", fill: "currentColor" })] }));
        case "vLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "8", y1: "1", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" }), _jsx("circle", { cx: "8", cy: "13", r: "1.5", fill: "currentColor" })] }));
        case "fibonacci":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "4", x2: "15", y2: "4", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "1", y1: "12", x2: "15", y2: "12", stroke: "currentColor", strokeWidth: "1" })] }));
        case "fibExtension":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "5", x2: "15", y2: "5", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("line", { x1: "1", y1: "11", x2: "15", y2: "11", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "11", y1: "3", x2: "11", y2: "13", stroke: "currentColor", strokeWidth: "1.2", strokeDasharray: "2 1" })] }));
        case "parallelChannel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "2", y1: "11", x2: "13", y2: "4", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "3", y1: "13", x2: "14", y2: "6", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" }), _jsx("line", { x1: "1", y1: "9", x2: "12", y2: "2", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" })] }));
        case "pitchfork":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "8", y1: "13", x2: "8", y2: "5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "9", x2: "3", y2: "3", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" }), _jsx("line", { x1: "8", y1: "9", x2: "13", y2: "3", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" })] }));
        case "abcdPattern":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("polyline", { points: "2,12 5,6 9,10 13,4", stroke: "currentColor", strokeWidth: "1.4", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1", fill: "currentColor" }), _jsx("circle", { cx: "13", cy: "4", r: "1", fill: "currentColor" })] }));
        case "fibArc":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M3 11A5 5 0 0 1 13 11", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("path", { d: "M4.2 11A3.8 3.8 0 0 1 11.8 11", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" })] }));
        case "fibTimeZone":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "3", y1: "2", x2: "3", y2: "14", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("line", { x1: "6", y1: "2", x2: "6", y2: "14", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("line", { x1: "10", y1: "2", x2: "10", y2: "14", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("line", { x1: "13", y1: "2", x2: "13", y2: "14", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case "regressionChannel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M2 11l11-7", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M1.5 13l11-7", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("path", { d: "M2.5 9l11-7", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" })] }));
        case "channel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "4", x2: "15", y2: "9", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "13", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" })] }));
        case "text":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", children: _jsx("text", { x: "2", y: "13", fontSize: "13", fontWeight: "700", fill: "currentColor", fontFamily: "Georgia, serif", children: "T" }) }));
        case "rectangle":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: _jsx("rect", { x: "2", y: "3", width: "12", height: "9", rx: "1.4", stroke: "currentColor", strokeWidth: "1.4" }) }));
        case "polyline":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("polyline", { points: "2,12 5,9 8,11 12,5 14,7", stroke: "currentColor", strokeWidth: "1.5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1", fill: "currentColor" }), _jsx("circle", { cx: "14", cy: "7", r: "1", fill: "currentColor" })] }));
        case "arrow":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M3 12L12 3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M8.5 3H12V6.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "dateAndPriceRange":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M4 6.5h8M4 9.5h5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "longPosition":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "4", width: "12", height: "8", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M8 11V5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M6.2 6.8L8 5l1.8 1.8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "shortPosition":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "4", width: "12", height: "8", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M8 5v6", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M6.2 9.2L8 11l1.8-1.8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "settings":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "8", cy: "8", r: "2.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }));
        default:
            return _jsx("span", { style: { fontSize: 11 }, children: "?" });
    }
}
export function DrawingToolbar({ activeTool, onToolSelect, magnetSensitivity = 0, onMagnetCycle, collapsed = false, onToggleCollapse, }) {
    const { t } = useWidgetI18n();
    const { activeTool: ctxActiveTool } = useVNInvestChartsState();
    const resolvedActiveTool = activeTool ?? ctxActiveTool.activeTool ?? "cursor";
    const { favoriteTools, toggleFavorite, isFavorite } = useFavoriteTools();
    const { recentTools, pushRecent } = useRecentTools();
    const [openGroupId, setOpenGroupId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    // Mobile tool long-press tooltip state and refs
    const [mobileToolTooltip, setMobileToolTooltip] = useState(null);
    const toolLongPressTimerRef = useRef(null);
    const toolTooltipAutoHideTimerRef = useRef(null);
    const suppressToolTapRef = useRef(false);
    const TOOL_LONG_PRESS_DELAY_MS = 800;
    const TOOL_TOOLTIP_AUTO_HIDE_MS = 1600;
    const triggerTooltipHapticFeedback = useCallback(() => {
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(10);
        }
    }, []);
    const handleToolbarToolPressStart = useCallback((toolId) => {
        suppressToolTapRef.current = false;
        if (toolLongPressTimerRef.current)
            clearTimeout(toolLongPressTimerRef.current);
        if (toolTooltipAutoHideTimerRef.current)
            clearTimeout(toolTooltipAutoHideTimerRef.current);
        toolLongPressTimerRef.current = setTimeout(() => {
            suppressToolTapRef.current = true;
            setMobileToolTooltip(t(`tool.${toolId}`) || toolId);
            triggerTooltipHapticFeedback();
            toolTooltipAutoHideTimerRef.current = setTimeout(() => {
                setMobileToolTooltip(null);
            }, TOOL_TOOLTIP_AUTO_HIDE_MS);
        }, TOOL_LONG_PRESS_DELAY_MS);
    }, [t, triggerTooltipHapticFeedback]);
    const handleToolbarToolPressEnd = useCallback(() => {
        if (toolLongPressTimerRef.current) {
            clearTimeout(toolLongPressTimerRef.current);
            toolLongPressTimerRef.current = null;
        }
    }, []);
    const getToolTouchHandlers = useCallback((toolId) => ({
        onPointerDown: () => handleToolbarToolPressStart(toolId),
        onPointerUp: handleToolbarToolPressEnd,
        onPointerCancel: handleToolbarToolPressEnd,
        onPointerLeave: handleToolbarToolPressEnd,
        onTouchStart: () => handleToolbarToolPressStart(toolId),
        onTouchEnd: handleToolbarToolPressEnd,
        onTouchCancel: handleToolbarToolPressEnd,
        onContextMenu: (event) => event.preventDefault(),
    }), [handleToolbarToolPressStart, handleToolbarToolPressEnd]);
    useEffect(() => {
        setMobileToolTooltip(null);
        return () => {
            if (toolLongPressTimerRef.current)
                clearTimeout(toolLongPressTimerRef.current);
            if (toolTooltipAutoHideTimerRef.current)
                clearTimeout(toolTooltipAutoHideTimerRef.current);
        };
    }, [resolvedActiveTool]);
    const handleToolClick = useCallback((tool) => {
        if (resolvedActiveTool === tool) {
            // Deselect if already active
            onToolSelect?.("");
            ctxActiveTool.setActiveTool("");
        }
        else {
            onToolSelect?.(tool);
            ctxActiveTool.setActiveTool(tool);
            if (tool !== "cursor" && tool !== "crosshair") {
                pushRecent(tool);
            }
        }
        setOpenGroupId(null);
        setSearchQuery("");
    }, [resolvedActiveTool, onToolSelect, ctxActiveTool, pushRecent]);
    const handleMagnetClick = useCallback(() => {
        onMagnetCycle?.();
    }, [onMagnetCycle]);
    // Close flyout on click outside
    useEffect(() => {
        if (!openGroupId)
            return;
        const handler = (e) => {
            const target = e.target;
            if (!target.closest(".vnsc-tools-flyout") && !target.closest(".vnsc-drawing-toolbar__group-container")) {
                setOpenGroupId(null);
                setSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [openGroupId]);
    const MAGNET_LABELS = ["M", "M₁", "M₂", "M₃"];
    return (_jsxs("div", { className: `vnsc-drawing-toolbar${collapsed ? " vnsc-drawing-toolbar--collapsed" : ""}`, "data-testid": "drawing-toolbar", style: {
            position: "relative",
            height: "100%",
            width: collapsed ? "0px" : "40px",
            minWidth: collapsed ? "0px" : "40px",
            flexShrink: 0,
            zIndex: 40,
            background: "var(--vnsc-bg-secondary, #111820)",
            borderRight: collapsed ? "none" : "1px solid var(--vnsc-border, #2a2a2a)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: collapsed ? "0" : "4px 0",
            gap: "2px",
            overflowX: "hidden",
            overflowY: collapsed ? "hidden" : "auto",
            scrollbarWidth: "none",
            transition: "width 0.2s ease, padding 0.2s ease, border-right-width 0.2s ease",
        }, children: [recentTools.length > 0 && (_jsxs("div", { className: "vnsc-tools-group-container", style: { position: "relative" }, children: [_jsxs("button", { type: "button", className: `vnsc-drawing-toolbar__btn vnsc-tool-btn--group`, title: t("toolbar.recent") || "Recent tools", onClick: (e) => {
                            if (openGroupId?.id === "recent") {
                                setOpenGroupId(null);
                                return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setOpenGroupId({ id: "recent", x: rect.right + 4, y: rect.top });
                        }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M8 3a5 5 0 1 1-4.24 2.34", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("path", { d: "M4 2v4h4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })] }), _jsx("span", { className: "vnsc-tools-chevron", children: "\u25BE" })] }), openGroupId?.id === "recent" && (_jsxs("div", { className: "vnsc-tools-flyout", style: {
                            position: "fixed",
                            left: openGroupId.x,
                            top: Math.max(10, Math.min(openGroupId.y, window.innerHeight - 200)),
                            zIndex: 10000,
                            background: "var(--vnsc-bg-primary, #0a0e14)",
                            border: "1px solid var(--vnsc-border, #2a2a2a)",
                            borderRadius: "6px",
                            padding: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                            minWidth: "120px",
                        }, children: [_jsx("div", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--vnsc-text-secondary, #a0a0a0)", padding: "2px 4px" }, children: t("toolbar.recent") || "Recent" }), mobileToolTooltip && (_jsx("div", { style: { padding: "4px 4px 0", fontSize: "10px", fontWeight: 600, color: "var(--vnsc-text-secondary, #a0a0a0)" }, children: mobileToolTooltip })), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }, children: recentTools.map((tool) => (_jsx("button", { type: "button", className: `vnsc-drawing-toolbar__btn ${resolvedActiveTool === tool ? "vnsc-drawing-toolbar__btn--active" : ""}`, title: t(`tool.${tool}`), ...getToolTouchHandlers(tool), onClick: () => {
                                        if (suppressToolTapRef.current) {
                                            suppressToolTapRef.current = false;
                                            return;
                                        }
                                        handleToolClick(tool);
                                    }, children: _jsx(ToolIcon, { id: tool }) }, tool))) })] }))] })), TOOL_GROUPS_V2.map((group) => {
                const activeInGroup = group.tools.includes(resolvedActiveTool) ? resolvedActiveTool : null;
                const iconId = activeInGroup ?? group.tools[0];
                const isOpen = openGroupId?.id === group.id;
                return (_jsxs("div", { className: "vnsc-tools-group-container", style: { position: "relative" }, children: [_jsxs("button", { type: "button", className: `vnsc-drawing-toolbar__btn vnsc-tool-btn--group ${activeInGroup ? "vnsc-drawing-toolbar__btn--active" : ""}`, title: t(group.labelKey), onClick: (e) => {
                                if (isOpen) {
                                    setOpenGroupId(null);
                                    return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                setOpenGroupId({ id: group.id, x: rect.right + 4, y: rect.top });
                            }, children: [_jsx(ToolIcon, { id: iconId }), _jsx("span", { className: "vnsc-tools-chevron", children: "\u25BE" })] }), isOpen && (_jsxs("div", { className: "vnsc-tools-flyout", style: {
                                position: "fixed",
                                left: openGroupId.x,
                                top: Math.max(10, Math.min(openGroupId.y, window.innerHeight - 320)),
                                zIndex: 10000,
                                background: "var(--vnsc-bg-primary, #0a0e14)",
                                border: "1px solid var(--vnsc-border, #2a2a2a)",
                                borderRadius: "6px",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                                display: "flex",
                                flexDirection: "column",
                                width: "220px",
                                overflow: "hidden",
                            }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "6px", padding: "8px 10px", borderBottom: "1px solid var(--vnsc-border, #2a2a2a)" }, children: [_jsx("div", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--vnsc-text-secondary, #a0a0a0)" }, children: t(group.labelKey) }), _jsxs("div", { style: { position: "relative", display: "flex", alignItems: "center" }, children: [_jsx("input", { type: "text", placeholder: t("drawing.searchPlaceholder") || "Search tools...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                                        width: "100%",
                                                        padding: "4px 8px 4px 24px",
                                                        fontSize: "11px",
                                                        background: "var(--vnsc-bg-secondary, #111820)",
                                                        border: "1px solid var(--vnsc-border, #2a2a2a)",
                                                        borderRadius: "4px",
                                                        color: "var(--vnsc-text-primary, #e0e0e0)",
                                                        outline: "none",
                                                    } }), _jsx("svg", { width: "10", height: "10", viewBox: "0 0 16 16", fill: "none", style: { position: "absolute", left: "8px", color: "var(--vnsc-text-secondary, #a0a0a0)" }, children: _jsx("path", { d: "M11.5 11.5L15 15M13 7C13 10.3137 10.3137 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7Z", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) })] })] }), mobileToolTooltip && (_jsx("div", { style: { padding: "6px 10px 0", fontSize: "10px", fontWeight: 600, color: "var(--vnsc-text-secondary, #a0a0a0)" }, children: mobileToolTooltip })), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "8px 10px", maxHeight: "200px", overflowY: "auto" }, children: group.tools
                                        .filter((tId) => tId.toLowerCase().includes(searchQuery.toLowerCase()) || (t(`tool.${tId}`) || "").toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((toolId) => {
                                        const active = resolvedActiveTool === toolId;
                                        const fav = isFavorite(toolId);
                                        return (_jsxs("button", { type: "button", className: `vnsc-drawing-toolbar__btn ${active ? "vnsc-drawing-toolbar__btn--active" : ""}`, title: t(`tool.${toolId}`), style: { position: "relative" }, ...getToolTouchHandlers(toolId), onClick: () => {
                                                if (suppressToolTapRef.current) {
                                                    suppressToolTapRef.current = false;
                                                    return;
                                                }
                                                handleToolClick(toolId);
                                            }, children: [_jsx(ToolIcon, { id: toolId }), TOOL_SHORTCUT_BADGE[toolId] && (_jsx("span", { style: {
                                                        position: "absolute",
                                                        bottom: 1,
                                                        right: 2,
                                                        fontSize: "8px",
                                                        color: "var(--vnsc-text-secondary, #a0a0a0)",
                                                        pointerEvents: "none",
                                                    }, children: TOOL_SHORTCUT_BADGE[toolId] })), _jsx("span", { role: "button", tabIndex: 0, title: fav ? t("toolbar.unfavorite") || "Remove Favorite" : t("toolbar.favorite") || "Add Favorite", style: {
                                                        position: "absolute",
                                                        top: 1,
                                                        left: 2,
                                                        fontSize: "8px",
                                                        lineHeight: 1,
                                                        color: fav ? "var(--vnsc-accent, #2962ff)" : "var(--vnsc-text-secondary, #a0a0a0)",
                                                        opacity: fav ? 1 : 0,
                                                        cursor: "pointer",
                                                        transition: "opacity 0.15s",
                                                    }, className: "vnsc-tool-fav-star", onClick: (e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(toolId);
                                                    }, children: "\u2605" })] }, toolId));
                                    }) })] }))] }, group.id));
            }), _jsx("div", { style: { flex: 1 } }), favoriteTools.length > 0 && (_jsxs("div", { className: "vnsc-tools-group-container", style: { position: "relative" }, children: [_jsxs("button", { type: "button", className: "vnsc-drawing-toolbar__btn", title: t("toolbar.favoriteTools") || "Favorites", onClick: (e) => {
                            if (openGroupId?.id === "favorites") {
                                setOpenGroupId(null);
                                return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setOpenGroupId({ id: "favorites", x: rect.right + 4, y: rect.top });
                        }, style: { color: "var(--vnsc-accent, #2962ff)" }, children: ["\u2605", _jsx("span", { className: "vnsc-tools-chevron", children: "\u25BE" })] }), openGroupId?.id === "favorites" && (_jsxs("div", { className: "vnsc-tools-flyout", style: {
                            position: "fixed",
                            left: openGroupId.x,
                            top: Math.max(10, Math.min(openGroupId.y, window.innerHeight - 200)),
                            zIndex: 10000,
                            background: "var(--vnsc-bg-primary, #0a0e14)",
                            border: "1px solid var(--vnsc-border, #2a2a2a)",
                            borderRadius: "6px",
                            padding: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                            minWidth: "120px",
                        }, children: [_jsx("div", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--vnsc-text-secondary, #a0a0a0)", padding: "2px 4px" }, children: t("toolbar.favoriteTools") || "Favorites" }), mobileToolTooltip && (_jsx("div", { style: { padding: "4px 4px 0", fontSize: "10px", fontWeight: 600, color: "var(--vnsc-text-secondary, #a0a0a0)" }, children: mobileToolTooltip })), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }, children: favoriteTools.map((tool) => (_jsx("button", { type: "button", className: `vnsc-drawing-toolbar__btn ${resolvedActiveTool === tool ? "vnsc-drawing-toolbar__btn--active" : ""}`, title: t(`tool.${tool}`), ...getToolTouchHandlers(tool), onClick: () => {
                                        if (suppressToolTapRef.current) {
                                            suppressToolTapRef.current = false;
                                            return;
                                        }
                                        handleToolClick(tool);
                                    }, children: _jsx(ToolIcon, { id: tool }) }, tool))) })] }))] })), _jsx("button", { type: "button", className: "vnsc-drawing-toolbar__magnet", title: `Magnet: ${MAGNET_LABELS[magnetSensitivity] ?? "Off"}`, onClick: handleMagnetClick, style: {
                    width: "32px",
                    height: "32px",
                    border: "none",
                    borderRadius: "4px",
                    background: magnetSensitivity > 0 ? "var(--vnsc-accent, #2962ff)" : "transparent",
                    color: magnetSensitivity > 0 ? "#fff" : "var(--vnsc-text-secondary, #a0a0a0)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                }, "data-testid": "magnet-toggle", children: MAGNET_LABELS[magnetSensitivity] ?? "M" }), onToggleCollapse && (_jsx("button", { type: "button", className: "vnsc-drawing-toolbar__btn vnsc-drawing-toolbar__collapse-btn", title: t("drawing.hideToolbar") || "Hide Toolbar", onClick: onToggleCollapse, style: {
                    marginTop: "4px",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "bold",
                    border: "none",
                    background: "transparent",
                    color: "var(--vnsc-text-secondary, #a0a0a0)",
                    cursor: "pointer",
                }, children: "\u00AB" }))] }));
}
