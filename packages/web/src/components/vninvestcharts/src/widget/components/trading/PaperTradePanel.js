import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WE2 P2-07: PaperTradePanel
 *
 * Panel showing paper trading positions, journal, and performance stats.
 * Uses .vnsc- CSS classes for theme inheritance from .vnsc-root.
 */
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
export function PaperTradePanel({ positions, journal, onReset, onClose, }) {
    const { t } = useWidgetI18n();
    const totalTrades = journal.length;
    const wins = journal.filter((e) => e.pnl > 0).length;
    const losses = journal.filter((e) => e.pnl <= 0).length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
    const totalPnl = journal.reduce((sum, e) => sum + e.pnl, 0);
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
    const currentPosition = positions.find((p) => p);
    const unrealizedPnl = currentPosition
        ? (currentPosition.side === "long"
            ? currentPosition.currentPrice - currentPosition.entryPrice
            : currentPosition.entryPrice - currentPosition.currentPrice) * currentPosition.quantity
        : 0;
    return (_jsxs("div", { className: "vnsc-paper-trade-panel", "data-testid": "paper-trade-panel", children: [_jsxs("div", { className: "vnsc-paper-trade-panel__header", children: [_jsx("strong", { className: "vnsc-paper-trade-panel__title", children: t("paperTrading.title", { defaultValue: "Paper Trading" }) }), _jsxs("div", { className: "vnsc-paper-trade-panel__header-actions", style: { display: "flex", alignItems: "center", gap: "6px" }, children: [onReset && (_jsx("button", { type: "button", className: "vnsc-paper-trade-panel__reset-btn", onClick: onReset, title: t("paperTrading.reset", { defaultValue: "Reset" }), children: t("paperTrading.reset", { defaultValue: "Reset" }) })), onClose && (_jsx("button", { type: "button", className: "vnsc-paper-trade-panel__close-btn", onClick: onClose, "aria-label": "Close", children: "x" }))] })] }), _jsx("div", { className: "vnsc-paper-trade-panel__stats", children: _jsxs("div", { className: "vnsc-paper-trade-panel__stats-grid", children: [_jsx(Stat, { label: t("paperTrading.total", { defaultValue: "Total" }), value: totalTrades.toString() }), _jsx(Stat, { label: t("paperTrading.winRate", { defaultValue: "Win %" }), value: `${winRate}%` }), _jsx(Stat, { label: t("paperTrading.realized", { defaultValue: "Realized PnL" }), value: formatPnl(totalPnl) }), _jsx(Stat, { label: t("paperTrading.unrealized", { defaultValue: "Unrealized" }), value: formatPnl(unrealizedPnl) })] }) }), _jsxs("div", { className: "vnsc-paper-trade-panel__position", children: [_jsx("div", { className: "vnsc-paper-trade-panel__position-title", children: t("paperTrading.position", { defaultValue: "Position" }) }), currentPosition ? (_jsxs("div", { children: [_jsx("span", { className: `vnsc-paper-trade-panel__position-side vnsc-paper-trade-panel__position-side--${currentPosition.side}`, children: currentPosition.side.toUpperCase() }), _jsxs("div", { className: "vnsc-paper-trade-panel__position-entry", children: [t("paperTrading.entry", { defaultValue: "Entry" }), ": ", currentPosition.entryPrice.toLocaleString()] })] })) : (_jsx("div", { className: "vnsc-paper-trade-panel__position-empty", children: t("paperTrading.empty", { defaultValue: "No open positions" }) }))] }), _jsxs("div", { className: "vnsc-paper-trade-panel__journal", children: [_jsx("div", { className: "vnsc-paper-trade-panel__journal-title", children: t("paperTrading.journal", { defaultValue: "Journal" }) }), journal.length === 0 ? (_jsx("div", { className: "vnsc-paper-trade-panel__journal-empty", children: t("paperTrading.empty", { defaultValue: "No trades yet" }) })) : ([...journal].reverse().slice(0, 50).map((entry) => (_jsxs("div", { className: `vnsc-paper-trade-panel__journal-item vnsc-paper-trade-panel__journal-item--${entry.pnl >= 0 ? "positive" : "negative"}`, children: [_jsx("span", { className: "vnsc-paper-trade-panel__journal-side", children: entry.side.toUpperCase() }), _jsx("span", { className: "vnsc-paper-trade-panel__journal-pnl", children: formatPnl(entry.pnl) })] }, entry.id))))] })] }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "vnsc-paper-trade-panel__stat-label", children: label }), _jsx("div", { className: "vnsc-paper-trade-panel__stat-value", children: value })] }));
}
function formatPnl(value) {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}`;
}
