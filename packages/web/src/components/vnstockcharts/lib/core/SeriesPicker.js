import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSeries, listRegistered } from "./registry/SeriesRegistry.js";
function buildDefaultSeries(type) {
    const entry = getSeries(type);
    return {
        type,
        params: { ...entry.defaultParams },
        yAxis: entry.defaultYAxis,
    };
}
export function SeriesPicker({ pane, onAddSeries, onRemoveSeries, anchorRef, onClose }) {
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const pickerRef = useRef(null);
    const seriesTypes = useMemo(() => listRegistered(), []);
    useEffect(() => {
        const updatePosition = () => {
            const anchor = anchorRef.current;
            if (!anchor) {
                return;
            }
            const container = anchor.closest(".rsc-pane-wrap");
            const anchorRect = anchor.getBoundingClientRect();
            const containerRect = container?.getBoundingClientRect();
            setPosition({
                top: containerRect ? anchorRect.bottom - containerRect.top + 6 : anchorRect.bottom + 6,
                left: containerRect ? anchorRect.left - containerRect.left : anchorRect.left,
            });
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose?.();
            }
        };
        const handleMouseDown = (event) => {
            const target = event.target;
            const anchor = anchorRef.current;
            const picker = pickerRef.current;
            const clickInsidePicker = Boolean(picker?.contains(target));
            const clickInsideAnchor = Boolean(anchor?.contains(target));
            if (!clickInsidePicker && !clickInsideAnchor) {
                onClose?.();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleMouseDown);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [anchorRef, onClose]);
    return (_jsxs("div", { ref: pickerRef, className: "rsc-series-picker", style: { top: position.top, left: position.left }, role: "dialog", "aria-label": "Series picker", children: [_jsx("ul", { className: "rsc-series-picker__list", children: seriesTypes.map((type) => {
                    const active = pane.series.some((series) => series.type === type);
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: `rsc-series-picker__item${active ? " rsc-series-picker__item--active" : ""}`, onClick: () => {
                                if (active) {
                                    onRemoveSeries(type);
                                }
                                else {
                                    onAddSeries(buildDefaultSeries(type));
                                }
                            }, "aria-pressed": active, children: [_jsx("span", { children: type }), _jsx("span", { className: "rsc-series-picker__check", children: active ? "✓" : "" })] }) }, type));
                }) }), _jsx("div", { className: "rsc-series-picker__footer", children: "Nh\u1EA5n Esc \u0111\u1EC3 \u0111\u00F3ng. Ch\u1EA1m l\u1EA1i v\u00E0o m\u1ED9t m\u1EE5c \u0111\u1EC3 x\u00F3a series." })] }));
}
