import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { buildForkTooltipTokens, dateFormat, } from "../utils/widgetHelpers.js";
export function ForkPaneTooltips({ hoveredDatum, isDark, paneSnapshots, panes, }) {
    if (!hoveredDatum) {
        return null;
    }
    const labelColor = isDark ? "#d1d4dc" : "#64748b";
    const textColor = isDark ? "#f8fafc" : "#1e2a3b";
    const snapshotMap = new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot]));
    return panes.map((pane) => {
        if (pane.tooltip === "none") {
            return null;
        }
        const snapshot = snapshotMap.get(pane.id);
        if (!snapshot) {
            return null;
        }
        const tokens = buildForkTooltipTokens(pane, hoveredDatum, textColor);
        return (_jsxs("div", { "data-rsc-fork-tooltip-pane": pane.id, style: {
                position: "absolute",
                left: 8,
                top: snapshot.plotBounds.top + 28,
                zIndex: 18,
                pointerEvents: "none",
                fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
                fontSize: 11,
                lineHeight: "16px",
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 8px",
                maxWidth: Math.max(120, snapshot.plotBounds.width - 16),
            }, children: [_jsx("span", { style: { color: labelColor }, children: "Date: " }), _jsx("span", { style: { color: textColor }, children: dateFormat(hoveredDatum.date) }), tokens.map((token) => (_jsxs("span", { children: [_jsx("span", { style: { color: token.color }, children: ` ${token.label}: ` }), _jsx("span", { style: { color: token.color }, children: token.value })] }, token.key)))] }, `fork-tooltip-${pane.id}`));
    });
}
