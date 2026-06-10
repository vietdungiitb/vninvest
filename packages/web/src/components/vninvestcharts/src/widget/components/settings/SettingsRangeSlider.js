import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function areValuesClose(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}
export function SettingsRangeSlider({ value, min, max, step, onChange, marks, formatValue = (next) => `${next}`, inputAriaLabel, inputAriaValueText, showCurrentIndicator = true, }) {
    const clampedValue = clamp(value, min, max);
    const percent = max > min ? ((clampedValue - min) / (max - min)) * 100 : 0;
    const activeTolerance = Math.max(step / 2, Number.EPSILON * 10);
    const hasMarks = Boolean(marks && marks.length > 0);
    const hasActiveMark = Boolean(marks?.some((mark) => areValuesClose(mark.value, clampedValue, activeTolerance)));
    return (_jsxs("div", { className: "gc-settings-slider-shell", children: [_jsx("input", { type: "range", className: "gc-settings-range", min: min, max: max, step: step, value: clampedValue, "aria-label": inputAriaLabel, "aria-valuetext": inputAriaValueText, onChange: (event) => {
                    const nextValue = Number(event.target.value);
                    onChange(clamp(Number.isFinite(nextValue) ? nextValue : clampedValue, min, max));
                } }), hasMarks ? (_jsxs("div", { className: "gc-settings-slider-steps", "aria-hidden": "true", children: [(marks ?? []).map((mark) => (_jsx("span", { className: areValuesClose(mark.value, clampedValue, activeTolerance) ? "gc-settings-slider-steps__label gc-settings-slider-steps__label--active" : "gc-settings-slider-steps__label", style: { left: `${max > min ? ((mark.value - min) / (max - min)) * 100 : 0}%` }, children: mark.label }, mark.value))), showCurrentIndicator && !hasActiveMark ? (_jsx("span", { className: "gc-settings-slider-steps__current", style: { left: `${percent}%` }, children: formatValue(clampedValue) })) : null] })) : (_jsxs("div", { className: "gc-settings-slider-readout", "aria-hidden": "true", children: [_jsx("span", { className: areValuesClose(clampedValue, min, activeTolerance) ? "gc-settings-slider-readout__edge gc-settings-slider-readout__edge--active" : "gc-settings-slider-readout__edge", children: formatValue(min) }), _jsx("span", { className: areValuesClose(clampedValue, max, activeTolerance) ? "gc-settings-slider-readout__edge gc-settings-slider-readout__edge--active" : "gc-settings-slider-readout__edge", children: formatValue(max) }), _jsx("span", { className: "gc-settings-slider-readout__current", style: { left: `${percent}%` }, children: formatValue(clampedValue) })] }))] }));
}
