import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
const STORAGE_KEY = "rsc-drawing-list-collapsed-groups";
const TOOL_LABELS = {
    trendLine: "Đường xu hướng",
    ray: "Tia",
    extendedLine: "Đường kéo dài",
    hLine: "Đường ngang",
    vLine: "Đường dọc",
    channel: "Kênh giá",
    parallelChannel: "Kênh song song",
    arrow: "Mũi tên",
    text: "Văn bản",
    fibonacci: "Fibonacci",
    fibExtension: "Fib mở rộng",
    fibArc: "Cung Fibonacci",
    fibTimeZone: "Vùng thời gian Fib",
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
    rectangle: "Hình chữ nhật",
    polyline: "Đa tuyến",
    dateAndPriceRange: "Vùng giá-ngày",
    longPosition: "Vị thế mua",
    shortPosition: "Vị thế bán",
    pitchfork: "Pitchfork",
    abcdPattern: "Mẫu ABCD",
    regressionChannel: "Kênh hồi quy",
};
export function generateDrawingLabel(drawing) {
    if (drawing.label?.trim()) {
        return drawing.label.trim();
    }
    return TOOL_LABELS[drawing.type] ?? drawing.type;
}
function formatTimestamp(timestamp) {
    try {
        return new Intl.DateTimeFormat(undefined, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(timestamp));
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
export default function DrawingListPanel({ drawings, selectedId, labels, position, onSelect, onToggleVisible, onToggleLocked, onDelete }) {
    const left = position?.x ?? 16;
    const top = position?.y ?? 120;
    const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
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
    return (_jsxs("div", { className: "rsc-drawing-list-panel", style: { left, top }, children: [_jsxs("div", { className: "rsc-drawing-list-panel__header", children: [_jsx("strong", { children: labels.title }), _jsx("span", { className: "rsc-drawing-list-panel__count", children: drawings.length })] }), drawings.length === 0 ? (_jsx("div", { className: "rsc-drawing-list-panel__empty", children: labels.empty })) : (_jsx("div", { className: "rsc-drawing-list-panel__items", children: [...grouped.entries()].map(([toolType, groupDrawings]) => {
                    const isCollapsed = collapsedGroups.has(toolType);
                    const groupLabel = TOOL_LABELS[toolType] ?? toolType;
                    return (_jsxs("div", { className: "rsc-drawing-list-panel__group", children: [_jsxs("button", { type: "button", className: "rsc-drawing-list-panel__group-header", onClick: () => toggleGroup(toolType), "aria-expanded": !isCollapsed, children: [_jsx("span", { className: "rsc-drawing-list-panel__group-caret", children: isCollapsed ? "▶" : "▼" }), _jsx("span", { className: "rsc-drawing-list-panel__group-name", children: groupLabel }), _jsx("span", { className: "rsc-drawing-list-panel__group-count", children: groupDrawings.length })] }), !isCollapsed && groupDrawings.map((drawing) => {
                                const isSelected = drawing.id === selectedId;
                                const isHidden = drawing.visible === false;
                                const isLocked = drawing.locked === true;
                                return (_jsxs("div", { className: `rsc-drawing-list-panel__item${isSelected ? " rsc-drawing-list-panel__item--selected" : ""}${isHidden ? " rsc-drawing-list-panel__item--hidden" : ""}`, children: [_jsxs("button", { type: "button", className: "rsc-drawing-list-panel__select", onClick: () => onSelect(drawing.id), children: [_jsx("span", { className: "rsc-drawing-list-panel__label", children: generateDrawingLabel(drawing) }), _jsx("span", { className: "rsc-drawing-list-panel__meta", children: formatTimestamp(drawing.createdAt) })] }), _jsxs("div", { className: "rsc-drawing-list-panel__actions", children: [isSelected && _jsx("span", { className: "rsc-drawing-list-panel__badge rsc-drawing-list-panel__badge--selected", children: labels.selected }), _jsx("button", { type: "button", className: `rsc-drawing-list-panel__icon${isHidden ? " rsc-drawing-list-panel__icon--active" : ""}`, title: isHidden ? labels.visible : labels.hidden, onClick: () => onToggleVisible(drawing.id), children: isHidden ? "👁️" : "◉" }), _jsx("button", { type: "button", className: `rsc-drawing-list-panel__icon${isLocked ? " rsc-drawing-list-panel__icon--active" : ""}`, title: isLocked ? labels.unlocked : labels.locked, onClick: () => onToggleLocked(drawing.id), children: isLocked ? "🔒" : "🔓" }), _jsx("button", { type: "button", className: "rsc-drawing-list-panel__icon rsc-drawing-list-panel__icon--delete", title: labels.delete, onClick: () => onDelete(drawing.id), disabled: isLocked, children: "\u00D7" })] })] }, drawing.id));
                            })] }, toolType));
                }) }))] }));
}
