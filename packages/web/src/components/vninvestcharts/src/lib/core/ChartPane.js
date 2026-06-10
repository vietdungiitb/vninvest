import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef } from "react";
import { ChartSyncProvider } from "./context/ChartSyncContext.js";
import { useDataContext } from "./context/DataContext.js";
import { useCanvasResize } from "./hooks/useCanvasResize.js";
import { computeScales } from "./scales/computeScales.js";
export function ChartPane({ pane, children, className, style, ...rest }) {
    const { data } = useDataContext();
    const mainCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const { ref: containerRef, size } = useCanvasResize();
    const resolvedHeight = Math.max(size.height, pane.heightPx ?? 240, pane.minHeightPx ?? 40);
    const resolvedWidth = Math.max(size.width, 1);
    const chartScales = useMemo(() => computeScales(pane, data, resolvedHeight), [data, pane, resolvedHeight]);
    const syncValue = {
        pane,
        data,
        visibleData: data,
        width: resolvedWidth,
        height: resolvedHeight,
        leftScale: chartScales.leftScale,
        rightScale: chartScales.rightScale,
    };
    const mergedStyle = {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: pane.minHeightPx ?? 40,
        height: pane.heightPx ? pane.heightPx : pane.heightPercent ? `${Math.round(pane.heightPercent * 100)}%` : undefined,
        overflow: "hidden",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: 8,
        border: "1px solid rgba(148, 163, 184, 0.18)",
        ...style,
    };
    return (_jsx("section", { ...rest, ref: containerRef, className: className, style: mergedStyle, "data-pane-id": pane.id, children: _jsxs("div", { style: { position: "relative", flex: "1 1 auto", minHeight: 0 }, children: [_jsx("canvas", { ref: mainCanvasRef, width: resolvedWidth, height: resolvedHeight, "aria-hidden": "true", style: { position: "absolute", inset: 0, width: "100%", height: "100%" } }), _jsx("canvas", { ref: overlayCanvasRef, width: resolvedWidth, height: resolvedHeight, "aria-hidden": "true", style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" } }), _jsx(ChartSyncProvider, { value: syncValue, children: children })] }) }));
}
