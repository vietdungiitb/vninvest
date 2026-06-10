import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ForkXAxisOverlay({ ticks, hoverLabel, top, isDark, }) {
    if (ticks.length === 0 && !hoverLabel) {
        return null;
    }
    const textColor = isDark ? "#d1d4dc" : "#475569";
    const backgroundColor = isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.96)";
    const tickColor = isDark ? "rgba(148, 163, 184, 0.65)" : "rgba(100, 116, 139, 0.65)";
    return (_jsxs("div", { "data-rsc-fork-x-axis": "true", style: { position: "absolute", inset: 0, zIndex: 32, pointerEvents: "none" }, children: [hoverLabel ? (_jsxs("div", { style: { position: "absolute", left: hoverLabel.x, top, transform: "translateX(-50%)", zIndex: 2 }, children: [_jsx("div", { style: { width: 1, height: 8, margin: "0 auto 2px", backgroundColor: tickColor } }), _jsx("div", { "data-rsc-fork-x-axis": "hover-label", style: {
                            color: textColor,
                            fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: "14px",
                            whiteSpace: "nowrap",
                            padding: "1px 6px",
                            borderRadius: 4,
                            backgroundColor,
                            boxShadow: isDark ? "0 1px 2px rgba(15, 23, 42, 0.45)" : "0 1px 2px rgba(15, 23, 42, 0.12)",
                        }, children: hoverLabel.label })] })) : null, ticks.map((tick) => (_jsxs("div", { style: { position: "absolute", left: tick.x, top, transform: "translateX(-50%)", zIndex: 1 }, children: [_jsx("div", { style: { width: 1, height: 6, margin: "0 auto 2px", backgroundColor: tickColor } }), _jsx("div", { "data-rsc-fork-x-axis": "label", style: {
                            color: textColor,
                            fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            lineHeight: "14px",
                            whiteSpace: "nowrap",
                            padding: "0 3px",
                            borderRadius: 3,
                            backgroundColor,
                            boxShadow: isDark ? "0 1px 2px rgba(15, 23, 42, 0.45)" : "0 1px 2px rgba(15, 23, 42, 0.12)",
                        }, children: tick.label })] }, tick.key)))] }));
}
