import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { resolveSemanticPointLabels } from "../../../lib/drawing/renderCanvas.js";
export default function DrawingSemanticPointLegend({ drawing, labels, activePointIndex, onPointFocusChange }) {
    const pointLabels = useMemo(() => {
        if (!drawing) {
            return [];
        }
        return resolveSemanticPointLabels(drawing) ?? [];
    }, [drawing]);
    if (!drawing || pointLabels.length === 0) {
        return _jsx("div", { className: "vnsc-drawing-point-legend vnsc-drawing-point-legend--empty", children: labels.empty });
    }
    return (_jsxs("section", { className: "vnsc-drawing-point-legend", children: [_jsxs("div", { className: "vnsc-drawing-point-legend__header", children: [_jsx("strong", { children: labels.title }), _jsx("button", { type: "button", className: "vnsc-drawing-point-legend__clear", onClick: () => onPointFocusChange(null), children: labels.clear })] }), _jsx("div", { className: "vnsc-drawing-point-legend__hint", children: labels.hint }), _jsx("div", { className: "vnsc-drawing-point-legend__items", children: pointLabels.map((label, index) => {
                    const isActive = activePointIndex === index;
                    return (_jsxs("button", { type: "button", className: `vnsc-drawing-point-legend__item${isActive ? " vnsc-drawing-point-legend__item--active" : ""}`, onMouseEnter: () => onPointFocusChange(index), onFocus: () => onPointFocusChange(index), onMouseLeave: () => onPointFocusChange(null), onBlur: () => onPointFocusChange(null), children: [_jsx("span", { className: "vnsc-drawing-point-legend__index", children: index + 1 }), _jsx("span", { className: "vnsc-drawing-point-legend__label", children: label })] }, `${label}-${index}`));
                }) })] }));
}
