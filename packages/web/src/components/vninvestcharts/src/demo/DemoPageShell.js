import { jsx as _jsx } from "react/jsx-runtime";
export default function DemoPageShell({ children, className = "", frameClassName = "" }) {
    const pageClassName = ["demo-page", className].filter(Boolean).join(" ");
    const frameClassNameValue = ["demo-frame", frameClassName].filter(Boolean).join(" ");
    return (_jsx("main", { className: pageClassName, children: _jsx("div", { className: frameClassNameValue, children: children }) }));
}
