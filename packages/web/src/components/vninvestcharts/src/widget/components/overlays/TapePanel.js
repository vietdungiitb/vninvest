import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * WE2 P3a-02: TapePanel (moved from src/lib/tape/TapePanel.tsx)
 *
 * Pure-presentational Time-and-Sales (tape) panel.
 * Data is fetched externally (demo shell) and passed via props.
 * All text goes through useWidgetI18n().t() — no hardcoded Vietnamese.
 *
 * Layout: vertical scrollable list — each row is 22px:
 *   [time] [price] [volume] [value] [side badge]
 * Whale rows get a yellow background.
 * Auto-scrolls to the bottom when new entries arrive.
 */
import { useEffect, useRef } from "react";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
// ── Constants ─────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 22;
const WHALE_BG = "#2a2300"; // dark yellow tint for whale rows
const WHALE_BORDER = "#b8860b";
// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso) {
    try {
        const d = new Date(iso);
        const h = d.getHours().toString().padStart(2, "0");
        const m = d.getMinutes().toString().padStart(2, "0");
        const s = d.getSeconds().toString().padStart(2, "0");
        return `${h}:${m}:${s}`;
    }
    catch {
        return iso.slice(11, 19) || "--:--:--";
    }
}
function formatPrice(p) {
    return p.toLocaleString("vi-VN");
}
function formatVolume(v) {
    if (v >= 1_000_000)
        return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)
        return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
}
function formatValue(v, t) {
    const billions = v / 1_000_000_000;
    if (billions >= 1)
        return `${billions.toFixed(1)}${t("tape.billions")}`;
    const millions = v / 1_000_000;
    if (millions >= 1)
        return `${millions.toFixed(0)}tr`;
    return v.toString();
}
export function TapePanel({ show, entries, isLoading, symbol, filterBillions, onFilterChange, onClose, }) {
    const { t } = useWidgetI18n();
    const scrollRef = useRef(null);
    const prevLengthRef = useRef(0);
    const userScrolledRef = useRef(false);
    const SIDE_COLORS = {
        buy: { bg: "#0d6b2e", text: "#ffffff", label: t("tape.sideBuy") },
        sell: { bg: "#c0392b", text: "#ffffff", label: t("tape.sideSell") },
        unknown: { bg: "#4a4a4a", text: "#aaaaaa", label: t("tape.sideUnknown") },
    };
    // Auto-scroll to bottom only when new entries arrive and user hasn't manually scrolled up
    useEffect(() => {
        if (!show)
            return;
        if (entries.length > prevLengthRef.current) {
            prevLengthRef.current = entries.length;
            if (!userScrolledRef.current) {
                const el = scrollRef.current;
                if (el)
                    el.scrollTop = el.scrollHeight;
            }
        }
    }, [entries.length, show]);
    if (!show)
        return null;
    const threshold = filterBillions * 1_000_000_000;
    const filtered = threshold > 0
        ? entries.filter((e) => e.value >= threshold)
        : entries;
    return (_jsxs("div", { className: "vnsc-tape-panel", style: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "240px",
            zIndex: 51,
            background: "#111",
            borderLeft: "1px solid #2a2a2a",
            display: "flex",
            flexDirection: "column",
            fontSize: "11px",
            color: "#d0d0d0",
            overflow: "hidden",
        }, "data-testid": "tape-panel", children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px 5px",
                    borderBottom: "1px solid #2a2a2a",
                    background: "#1a1a1a",
                    flexShrink: 0,
                }, children: [_jsxs("span", { style: { fontWeight: 700, fontSize: "12px" }, children: [t("tape.title"), symbol ? ` — ${symbol}` : ""] }), onClose ? (_jsx("button", { onClick: onClose, title: t("tape.close"), style: { background: "none", border: "none", color: "#707070", cursor: "pointer", fontSize: "14px", padding: "0 4px" }, children: "\u00D7" })) : null] }), _jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 8px",
                    borderBottom: "1px solid #1e1e1e",
                    flexShrink: 0,
                }, children: [_jsx("span", { style: { color: "#808080", whiteSpace: "nowrap" }, children: "\u2265" }), _jsx("input", { type: "range", min: 0, max: 50, step: 0.5, value: filterBillions, onChange: (e) => onFilterChange?.(Number(e.target.value)), style: { flex: 1, cursor: "pointer" }, "aria-label": t("tape.filterLabel"), title: `≥ ${filterBillions} ${t("tape.billions")}` }), _jsx("span", { style: { width: "38px", textAlign: "right", color: "#c0c0c0", flexShrink: 0 }, "data-testid": "tape-filter-label", children: filterBillions > 0 ? `${filterBillions}${t("tape.billions")}` : t("tape.all") })] }), _jsxs("div", { style: {
                    display: "grid",
                    gridTemplateColumns: "52px 70px 52px 44px 22px",
                    padding: "2px 4px",
                    color: "#606060",
                    fontSize: "10px",
                    borderBottom: "1px solid #1e1e1e",
                    flexShrink: 0,
                }, children: [_jsx("span", { children: t("tape.colTime") }), _jsx("span", { style: { textAlign: "right" }, children: t("tape.colPrice") }), _jsx("span", { style: { textAlign: "right" }, children: t("tape.colVolume") }), _jsx("span", { style: { textAlign: "right" }, children: t("tape.colValue") }), _jsx("span", { style: { textAlign: "center" } })] }), _jsx("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", overflowX: "hidden" }, onScroll: () => {
                    const el = scrollRef.current;
                    if (!el)
                        return;
                    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
                    userScrolledRef.current = !atBottom;
                }, children: isLoading && filtered.length === 0 ? (_jsx("div", { style: { textAlign: "center", color: "#505050", paddingTop: "20px" }, "data-testid": "tape-loading", children: t("tape.loading") })) : filtered.length === 0 ? (_jsx("div", { style: { textAlign: "center", color: "#505050", paddingTop: "20px" }, "data-testid": "tape-empty", children: t("tape.empty") })) : (filtered.map((entry) => {
                    const sideStyle = SIDE_COLORS[entry.side] ?? SIDE_COLORS.unknown;
                    return (_jsxs("div", { "data-testid": "tape-row", style: {
                            display: "grid",
                            gridTemplateColumns: "52px 70px 52px 44px 22px",
                            height: `${ROW_HEIGHT}px`,
                            alignItems: "center",
                            padding: "0 4px",
                            background: entry.is_whale ? WHALE_BG : "transparent",
                            borderBottom: entry.is_whale
                                ? `1px solid ${WHALE_BORDER}`
                                : "1px solid #1a1a1a",
                        }, children: [_jsx("span", { style: { color: "#707070", fontSize: "10px" }, children: formatTime(entry.ts) }), _jsx("span", { style: {
                                    textAlign: "right",
                                    color: entry.side === "buy" ? "#22a85e" : entry.side === "sell" ? "#e05555" : "#c0c0c0",
                                    fontWeight: entry.is_whale ? 700 : 400,
                                }, children: formatPrice(entry.price) }), _jsx("span", { style: { textAlign: "right", color: "#a0a0a0" }, children: formatVolume(entry.volume) }), _jsx("span", { style: { textAlign: "right", color: entry.is_whale ? "#f0c040" : "#888" }, children: formatValue(entry.value, t) }), _jsx("span", { style: {
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "14px",
                                    width: "16px",
                                    borderRadius: "2px",
                                    background: sideStyle.bg,
                                    color: sideStyle.text,
                                    fontSize: "9px",
                                    fontWeight: 700,
                                }, "data-side": entry.side, children: sideStyle.label })] }, entry.id));
                })) }), _jsxs("div", { style: {
                    padding: "3px 8px",
                    borderTop: "1px solid #1e1e1e",
                    color: "#555",
                    fontSize: "10px",
                    flexShrink: 0,
                }, children: [filtered.length, " ", t("tape.orderCount"), filterBillions > 0 ? ` (≥${filterBillions}${t("tape.billions")})` : ""] })] }));
}
