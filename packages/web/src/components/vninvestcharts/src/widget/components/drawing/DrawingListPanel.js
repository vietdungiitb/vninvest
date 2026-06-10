import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { formatWithTimezone } from "../../../lib/utils/timezoneFormatter.js";
const STORAGE_KEY = "vnsc-drawing-list-collapsed-groups";
const TOOL_LABELS = {
    trendLine: "Trend Line",
    ray: "Ray",
    extendedLine: "Extended Line",
    hLine: "Horizontal Line",
    vLine: "Vertical Line",
    channel: "Price Channel",
    parallelChannel: "Parallel Channel",
    arrow: "Arrow",
    text: "Text",
    fibonacci: "Fibonacci",
    fibExtension: "Fib Extension",
    fibArc: "Fib Arc",
    fibTimeZone: "Fib Time Zone",
    gannFan: "Gann Fan",
    elliottImpulse: "Elliott Impulse",
    elliottCorrection: "Elliott Correction",
    elliottTriangle: "Elliott Triangle",
    elliottDoubleCombo: "Elliott Double Combo",
    elliottTripleCombo: "Elliott Triple Combo",
    xabcdPattern: "XABCD Pattern",
    cypherPattern: "Cypher Pattern",
    headAndShoulders: "Head & Shoulders",
    trianglePattern: "Triangle Pattern",
    threeDrivesPattern: "Three Drives Pattern",
    // DT-13: Extended Fibonacci
    fibChannel: "Fib Channel",
    fibSpeedResistanceFan: "Fib Speed Resistance Fan",
    trendBasedFibTime: "Trend-Based Fib Time",
    fibCircles: "Fib Circles",
    fibSpiral: "Fib Spiral",
    fibSpeedResistanceArcs: "Fib Speed Resistance Arcs",
    fibWedge: "Fib Wedge",
    pitchfan: "Pitchfan",
    // DT-14: Gann Advanced
    gannBox: "Gann Box",
    gannSquareFixed: "Gann Square Fixed",
    gannSquare: "Gann Square",
    // DT-15: Cycle Tools
    cyclicLines: "Cyclic Lines",
    timeCycles: "Time Cycles",
    sineLine: "Sine Line",
    circle: "Circle",
    ellipse: "Ellipse",
    triangle: "Triangle",
    callout: "Callout",
    priceLabel: "Price Label",
    priceRange: "Price Range",
    dateRange: "Date Range",
    barsCount: "Bars Count",
    rectangle: "Rectangle",
    polyline: "Polyline",
    dateAndPriceRange: "Date and Price Range",
    longPosition: "Long Position",
    shortPosition: "Short Position",
    pitchfork: "Pitchfork",
    abcdPattern: "ABCD Pattern",
    regressionChannel: "Regression Channel",
};
export function generateDrawingLabel(drawing) {
    if (drawing.label?.trim()) {
        return drawing.label.trim();
    }
    return TOOL_LABELS[drawing.type] ?? drawing.type;
}
/** GAP-10: Filter drawings by case-insensitive match on tool label or custom label. */
export function filterDrawings(drawings, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return drawings;
    return drawings.filter((d) => {
        const toolLabel = (TOOL_LABELS[d.type] ?? d.type).toLowerCase();
        const rawType = d.type.toLowerCase();
        const customLabel = (d.label ?? "").toLowerCase();
        return toolLabel.includes(q) || rawType.includes(q) || customLabel.includes(q);
    });
}
/** GAP-10: Immutably reorder drawings by moving fromId to the position of toId. */
export function reorderDrawings(drawings, fromId, toId) {
    const fromIdx = drawings.findIndex((d) => d.id === fromId);
    const toIdx = drawings.findIndex((d) => d.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx)
        return drawings;
    const result = [...drawings];
    const [item] = result.splice(fromIdx, 1);
    result.splice(toIdx, 0, item);
    return result;
}
function formatTimestamp(timestamp) {
    try {
        return formatWithTimezone(timestamp, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    catch {
        return new Date(timestamp).toISOString();
    }
}
function loadCollapsedGroups() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return new Set();
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return new Set(parsed.filter((v) => typeof v === "string"));
        }
    }
    catch {
        // ignore
    }
    return new Set();
}
function saveCollapsedGroups(groups) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
    }
    catch {
        // ignore
    }
}
export default function DrawingListPanel({ drawings, selectedId, labels, embedded = false, position, onSelect, onToggleVisible, onToggleLocked, onDelete, onReorderDrawings }) {
    const left = position?.x ?? 16;
    const top = position?.y ?? 120;
    const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
    const [searchQuery, setSearchQuery] = useState("");
    const [dragFromId, setDragFromId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const toggleGroup = useCallback((groupType) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupType)) {
                next.delete(groupType);
            }
            else {
                next.add(groupType);
            }
            saveCollapsedGroups(next);
            return next;
        });
    }, []);
    const grouped = useMemo(() => {
        const map = new Map();
        for (const drawing of drawings) {
            const existing = map.get(drawing.type);
            if (existing) {
                existing.push(drawing);
            }
            else {
                map.set(drawing.type, [drawing]);
            }
        }
        return map;
    }, [drawings]);
    const isSearching = searchQuery.trim().length > 0;
    const filteredDrawings = useMemo(() => filterDrawings(drawings, searchQuery), [drawings, searchQuery]);
    const displayedCount = isSearching ? filteredDrawings.length : drawings.length;
    const renderDrawingItem = (drawing) => {
        const isSelected = drawing.id === selectedId;
        const isHidden = drawing.visible === false;
        const isLocked = drawing.locked === true;
        const isDragOver = dragOverId === drawing.id && dragFromId !== drawing.id;
        return (_jsxs("div", { className: `vnsc-drawing-list-panel__item${isSelected ? " vnsc-drawing-list-panel__item--selected" : ""}${isHidden ? " vnsc-drawing-list-panel__item--hidden" : ""}${isDragOver ? " vnsc-drawing-list-panel__item--drag-over" : ""}`, draggable: !!onReorderDrawings, onDragStart: onReorderDrawings ? (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drawing.id); setDragFromId(drawing.id); } : undefined, onDragOver: onReorderDrawings ? (e) => { e.preventDefault(); setDragOverId(drawing.id); } : undefined, onDrop: onReorderDrawings ? (e) => { e.preventDefault(); const fromId = e.dataTransfer.getData("text/plain"); if (fromId && fromId !== drawing.id) {
                onReorderDrawings(reorderDrawings(drawings, fromId, drawing.id));
            } setDragFromId(null); setDragOverId(null); } : undefined, onDragEnd: onReorderDrawings ? () => { setDragFromId(null); setDragOverId(null); } : undefined, children: [_jsxs("button", { type: "button", className: "vnsc-drawing-list-panel__select", onClick: () => onSelect(drawing.id), children: [_jsx("span", { className: "vnsc-drawing-list-panel__label", children: generateDrawingLabel(drawing) }), _jsx("span", { className: "vnsc-drawing-list-panel__meta", children: formatTimestamp(drawing.createdAt) })] }), _jsxs("div", { className: "vnsc-drawing-list-panel__actions", children: [isSelected && _jsx("span", { className: "vnsc-drawing-list-panel__badge vnsc-drawing-list-panel__badge--selected", children: labels.selected }), _jsx("button", { type: "button", className: `vnsc-drawing-list-panel__icon${isHidden ? " vnsc-drawing-list-panel__icon--active" : ""}`, title: isHidden ? labels.visible : labels.hidden, onClick: () => onToggleVisible(drawing.id), children: isHidden ? "👁️" : "◉" }), _jsx("button", { type: "button", className: `vnsc-drawing-list-panel__icon${isLocked ? " vnsc-drawing-list-panel__icon--active" : ""}`, title: isLocked ? labels.unlocked : labels.locked, onClick: () => onToggleLocked(drawing.id), children: isLocked ? "🔒" : "🔓" }), _jsx("button", { type: "button", className: "vnsc-drawing-list-panel__icon vnsc-drawing-list-panel__icon--delete", title: labels.delete, onClick: () => onDelete(drawing.id), disabled: isLocked, children: "\u00D7" })] })] }, drawing.id));
    };
    return (_jsxs("div", { className: `vnsc-drawing-list-panel${embedded ? " vnsc-drawing-list-panel--embedded" : ""}`, style: embedded ? undefined : { left, top }, children: [_jsxs("div", { className: "vnsc-drawing-list-panel__header", children: [_jsx("strong", { children: labels.title }), _jsx("span", { className: "vnsc-drawing-list-panel__count", children: displayedCount })] }), labels.search !== undefined && (_jsx("div", { className: "vnsc-drawing-list-panel__search", children: _jsx("input", { type: "search", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: labels.search, className: "vnsc-drawing-list-panel__search-input" }) })), displayedCount === 0 ? (_jsx("div", { className: "vnsc-drawing-list-panel__empty", children: labels.empty })) : isSearching ? (_jsx("div", { className: "vnsc-drawing-list-panel__items", children: filteredDrawings.map(renderDrawingItem) })) : (_jsx("div", { className: "vnsc-drawing-list-panel__items", children: [...grouped.entries()].map(([toolType, groupDrawings]) => {
                    const isCollapsed = collapsedGroups.has(toolType);
                    const groupLabel = TOOL_LABELS[toolType] ?? toolType;
                    return (_jsxs("div", { className: "vnsc-drawing-list-panel__group", children: [_jsxs("button", { type: "button", className: "vnsc-drawing-list-panel__group-header", onClick: () => toggleGroup(toolType), "aria-expanded": !isCollapsed, children: [_jsx("span", { className: "vnsc-drawing-list-panel__group-caret", children: isCollapsed ? "▶" : "▼" }), _jsx("span", { className: "vnsc-drawing-list-panel__group-name", children: groupLabel }), _jsx("span", { className: "vnsc-drawing-list-panel__group-count", children: groupDrawings.length })] }), !isCollapsed && groupDrawings.map(renderDrawingItem)] }, toolType));
                }) }))] }));
}
