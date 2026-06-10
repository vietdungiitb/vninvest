import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WP-05: WhalePanel — moved from src/demo/components/
 * Display shark/whale/small buy/sell money flow.
 * Widget-scoped: uses useWidgetI18n(), .vnsc- prefix.
 */
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
function formatBillion(value) {
    const billion = value / 1_000_000_000;
    return `${billion.toFixed(2)}`;
}
export function WhalePanel({ data }) {
    const { t } = useWidgetI18n();
    if (!data) {
        return null;
    }
    const { summary } = data;
    const rows = [
        { label: t("whale.whale", { defaultValue: "Whale" }), buy: summary.whale_buy, sell: summary.whale_sell },
        { label: t("whale.shark", { defaultValue: "Shark" }), buy: summary.shark_buy, sell: summary.shark_sell },
        { label: t("whale.small", { defaultValue: "Small" }), buy: summary.small_buy, sell: summary.small_sell },
    ];
    const net = summary.buy_value - summary.sell_value;
    return (_jsxs("div", { className: "vnsc-whale-panel", "data-testid": "whale-panel", children: [_jsx("div", { className: "vnsc-whale-panel__title", children: t("whale.title", { defaultValue: "Whale Flow" }) }), _jsxs("div", { className: "vnsc-whale-panel__net", "data-positive": net >= 0, children: [net >= 0 ? "+" : "", formatBillion(net), " t\u1EF7"] }), _jsxs("table", { className: "vnsc-whale-panel__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", {}), _jsx("th", { children: t("whale.buy", { defaultValue: "Buy" }) }), _jsx("th", { children: t("whale.sell", { defaultValue: "Sell" }) })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { children: [_jsx("td", { className: "vnsc-whale-panel__row-label", children: row.label }), _jsx("td", { className: "vnsc-whale-panel__buy", children: formatBillion(row.buy) }), _jsx("td", { className: "vnsc-whale-panel__sell", children: formatBillion(row.sell) })] }, row.label))) })] })] }));
}
