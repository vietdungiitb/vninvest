import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function strengthTier(v) {
    if (v >= 80)
        return { label: "Mạnh", cssClass: "gc-darkflow-badge--strong" };
    if (v >= 60)
        return { label: "Vừa", cssClass: "gc-darkflow-badge--mid" };
    if (v >= 30)
        return { label: "Thấp", cssClass: "gc-darkflow-badge--low" };
    return { label: "Yếu", cssClass: "gc-darkflow-badge--none" };
}
const SIGNAL_LABELS = {
    none: "–",
    absorption: "HẤP THỤ",
    iceberg: "ICEBERG",
    twap_bot: "TWAP",
    mixed: "HỖN HỢP",
};
export function DarkFlowBadge({ strength, signalType = "none" }) {
    const tier = strengthTier(strength);
    const sigLabel = SIGNAL_LABELS[signalType] ?? signalType.toUpperCase();
    return (_jsxs("div", { className: `gc-darkflow-badge ${tier.cssClass}`, title: `Dark Flow Strength: ${strength.toFixed(0)}`, children: [_jsx("span", { className: "gc-darkflow-badge__label", children: "Dark Flow" }), _jsx("span", { className: "gc-darkflow-badge__strength", children: strength.toFixed(0) }), _jsx("span", { className: "gc-darkflow-badge__tier", children: tier.label }), signalType !== "none" && (_jsx("span", { className: "gc-darkflow-badge__sig", children: sigLabel }))] }));
}
