import { jsx as _jsx } from "react/jsx-runtime";
export function PaneLabel({ label, top, height, className }) {
    const style = {
        top,
        height,
    };
    return (_jsx("div", { className: `rsc-pane-label${className ? ` ${className}` : ""}`, style: style, "aria-hidden": "true", children: label }));
}
