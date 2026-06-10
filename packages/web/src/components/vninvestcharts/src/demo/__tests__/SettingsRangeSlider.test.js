import { jsx as _jsx } from "react/jsx-runtime";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsRangeSlider } from "../SettingsRangeSlider";
describe("SettingsRangeSlider", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });
    it("passes zero through onChange for min-zero sliders", async () => {
        const onChange = vi.fn();
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => {
            root.render(_jsx(SettingsRangeSlider, { value: 0.15, min: 0, max: 0.8, step: 0.01, onChange: onChange, formatValue: (value) => value.toFixed(2), marks: [
                    { value: 0, label: "0.00" },
                    { value: 0.2, label: "0.20" },
                    { value: 0.4, label: "0.40" },
                    { value: 0.6, label: "0.60" },
                    { value: 0.8, label: "0.80" },
                ] }));
        });
        const range = container.querySelector('input[type="range"]');
        expect(range).toBeTruthy();
        const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        await act(async () => {
            setInputValue?.call(range, "0");
            range?.dispatchEvent(new Event("input", { bubbles: true }));
            range?.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(onChange).toHaveBeenCalledWith(0);
        await act(async () => {
            root.unmount();
        });
    });
    it("positions non-uniform marks by their numeric values", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => {
            root.render(_jsx(SettingsRangeSlider, { value: 10, min: 0, max: 100, step: 1, onChange: () => undefined, marks: [
                    { value: 0, label: "0" },
                    { value: 10, label: "10" },
                    { value: 100, label: "100" },
                ] }));
        });
        const labels = Array.from(container.querySelectorAll(".gc-settings-slider-steps__label"));
        expect(labels.map((label) => label.style.left)).toEqual(["0%", "10%", "100%"]);
        await act(async () => {
            root.unmount();
        });
    });
});
