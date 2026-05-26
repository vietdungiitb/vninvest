import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * OB-M03 — WhalePanel
 * Display shark/whale/small buy/sell money flow in tỷ VND.
 */
import { useDemoI18n } from "../i18n.js";
function formatBillion(value) {
    const billion = value / 1_000_000_000;
    return `${billion.toFixed(2)}`;
}
export function WhalePanel({ data }) {
    const { t } = useDemoI18n();
    if (!data) {
        return null;
    }
    const { summary } = data;
    const rows = [
        { label: t("vninvest.whale.whale"), buy: summary.whale_buy, sell: summary.whale_sell },
        { label: t("vninvest.whale.shark"), buy: summary.shark_buy, sell: summary.shark_sell },
        { label: t("vninvest.whale.small"), buy: summary.small_buy, sell: summary.small_sell },
    ];
    const netFlow = summary.buy_value - summary.sell_value;
    const isNetPositive = netFlow >= 0;
    return (_jsxs("div", { className: "gc-whale-panel", children: [_jsx("div", { className: "gc-whale-panel__title", children: t("vninvest.whale.summary") }), _jsxs("div", { className: "gc-whale-panel__net", "data-positive": isNetPositive, children: [_jsx("span", { className: "gc-whale-panel__net-label", children: isNetPositive ? t("vninvest.whale.buy") : t("vninvest.whale.sell") }), _jsxs("span", { className: "gc-whale-panel__net-value", children: [formatBillion(Math.abs(netFlow)), " ", t("vninvest.whale.unit")] })] }), _jsxs("table", { className: "gc-whale-panel__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", {}), _jsx("th", { children: t("vninvest.whale.buy") }), _jsx("th", { children: t("vninvest.whale.sell") })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { children: [_jsx("td", { className: "gc-whale-panel__row-label", children: row.label }), _jsxs("td", { className: "gc-whale-panel__buy", children: [formatBillion(row.buy), " ", t("vninvest.whale.unit")] }), _jsxs("td", { className: "gc-whale-panel__sell", children: [formatBillion(row.sell), " ", t("vninvest.whale.unit")] })] }, row.label))) })] })] }));
}
