import { jsx as _jsx } from "react/jsx-runtime";
import { MAX_VISIBLE_BARS_OPTIONS } from "./demoSettings.js";
import { SettingsRangeSlider } from "./SettingsRangeSlider.js";
function formatMaxVisibleBarsLabel(value) {
    return value >= 1000 ? `${value / 1000}k` : `${value}`;
}
export function MaxVisibleBarsSlider({ value, onChange, ariaLabel }) {
    const selectedIndex = Math.max(0, MAX_VISIBLE_BARS_OPTIONS.indexOf(value));
    const selectedValue = MAX_VISIBLE_BARS_OPTIONS[selectedIndex] ?? MAX_VISIBLE_BARS_OPTIONS[0];
    return (_jsx(SettingsRangeSlider, { value: selectedIndex, min: 0, max: MAX_VISIBLE_BARS_OPTIONS.length - 1, step: 1, onChange: (nextIndex) => onChange(MAX_VISIBLE_BARS_OPTIONS[nextIndex] ?? selectedValue), marks: MAX_VISIBLE_BARS_OPTIONS.map((option, index) => ({ value: index, label: formatMaxVisibleBarsLabel(option) })), inputAriaLabel: ariaLabel, inputAriaValueText: formatMaxVisibleBarsLabel(selectedValue), showCurrentIndicator: false }));
}
