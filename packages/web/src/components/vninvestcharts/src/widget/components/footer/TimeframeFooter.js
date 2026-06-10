import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WE2 P2-04: TimeframeFooter
 *
 * Bottom bar with timeframe chips and range selectors.
 * Uses .vnsc- CSS prefix.
 */
import { useCallback } from "react";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
const TIMEFRAMES = [
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
    { value: "1D", label: "1D" },
    { value: "1W", label: "1W" },
];
const RANGES = ["1D", "5D", "1M", "3M", "YTD", "1Y", "All"];
export function TimeframeFooter({ timeframe, onTimeframeChange, range, onRangeChange, supportedTimeframes, }) {
    const { t } = useWidgetI18n();
    const handleTimeframeClick = useCallback((tf) => {
        onTimeframeChange?.(tf);
    }, [onTimeframeChange]);
    const handleRangeClick = useCallback((r) => {
        onRangeChange?.(r);
    }, [onRangeChange]);
    return (_jsxs("div", { className: "vnsc-timeframe-footer", "data-testid": "timeframe-footer", style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "4px 12px",
            background: "var(--vnsc-bg-secondary, #111820)",
            borderTop: "1px solid var(--vnsc-border, #2a2a2a)",
            zIndex: 30,
            flexWrap: "wrap",
        }, children: [_jsx("div", { style: { display: "flex", gap: "4px" }, children: TIMEFRAMES.map((tf) => {
                    const isActive = timeframe === tf.value;
                    const isDisabled = supportedTimeframes && !supportedTimeframes.map(v => v.toLowerCase()).includes(tf.value.toLowerCase());
                    return (_jsx("button", { type: "button", className: `vnsc-tf-chip${isActive ? " vnsc-tf-chip--active" : ""}${isDisabled ? " vnsc-tf-chip--disabled" : ""}`, onClick: isDisabled ? undefined : () => handleTimeframeClick(tf.value), disabled: isDisabled, style: {
                            padding: "3px 8px",
                            border: "none",
                            borderRadius: "4px",
                            background: isActive ? "var(--vnsc-accent, #2962ff)" : "transparent",
                            color: isActive ? "#fff" : "var(--vnsc-text-secondary, #a0a0a0)",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.25 : 1,
                            fontSize: "11px",
                            fontWeight: 600,
                        }, "data-timeframe": tf.value, children: tf.label }, tf.value));
                }) }), _jsx("div", { style: { width: "1px", height: "16px", background: "var(--vnsc-border, #2a2a2a)" } }), _jsx("div", { style: { display: "flex", gap: "4px" }, children: RANGES.map((r) => {
                    const isActive = range === r;
                    return (_jsx("button", { type: "button", className: `vnsc-range-chip${isActive ? " vnsc-range-chip--active" : ""}`, onClick: () => handleRangeClick(r), style: {
                            padding: "3px 8px",
                            border: "none",
                            borderRadius: "4px",
                            background: isActive ? "var(--vnsc-accent, #2962ff)" : "transparent",
                            color: isActive ? "#fff" : "var(--vnsc-text-secondary, #a0a0a0)",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 600,
                        }, "data-range": r, children: t(`library.range.${r.toLowerCase()}`, { defaultValue: r }) }, r));
                }) })] }));
}
