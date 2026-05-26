import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * OB-M03 — VNSymbolSearch
 * Search box with 300ms debounce and keyboard navigation.
 * M-02: Exchange filter (HOSE/HNX/UPCOM)
 * M-03: VN30 quick group preset
 * M-04: Recent symbols (localStorage, max 10)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useDemoI18n } from "../i18n.js";
const RECENT_SYMBOLS_KEY = "vni_recent_symbols";
const MAX_RECENT = 10;
/** Official VN30 constituents (HOSE large-cap index). */
const VN30_SYMBOLS = [
    "VIC", "VHM", "VCB", "BID", "GAS", "VNM", "CTG", "MBB", "TCB", "HPG",
    "ACB", "VPB", "STB", "MSN", "PLX", "GVR", "HDB", "SSB", "MWG", "REE",
    "POW", "VJC", "PNJ", "VIB", "SAB", "FPT", "BVH", "TPB", "SHB", "BCM",
];
function readRecentItems() {
    try {
        const raw = localStorage.getItem(RECENT_SYMBOLS_KEY);
        if (!raw)
            return [];
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
function saveRecentItem(item, existing) {
    const deduped = [item, ...existing.filter((s) => s.symbol !== item.symbol)].slice(0, MAX_RECENT);
    try {
        localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(deduped));
    }
    catch { /* ignore storage errors */ }
    return deduped;
}
export function VNSymbolSearch({ client, value, onChange, onItemSelect, onFocusGuard }) {
    const { t } = useDemoI18n();
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [exchangeFilter, setExchangeFilter] = useState("ALL");
    const [recentItems, setRecentItems] = useState(() => readRecentItems());
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);
    useEffect(() => {
        setQuery(value);
    }, [value]);
    // Close on outside click
    useEffect(() => {
        function handleClick(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);
    const searchSymbols = useCallback(async (q, exFilter) => {
        if (!q) {
            setResults([]);
            return;
        }
        try {
            const exchange = exFilter !== "ALL" ? exFilter : undefined;
            const stocks = await client.getStocks(q, exchange);
            const mapped = stocks.map((s) => ({
                symbol: s.symbol,
                company_name: s.company_name,
                exchange: s.exchange,
            }));
            setResults(mapped);
            setHighlightIndex(0);
            setOpen(mapped.length > 0);
        }
        catch {
            setResults([]);
            setOpen(false);
        }
    }, [client]);
    // Re-search when exchange filter changes and query is active
    useEffect(() => {
        if (!query)
            return;
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void searchSymbols(query, exchangeFilter), 150);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exchangeFilter]);
    function handleInputChange(e) {
        const q = e.target.value;
        setQuery(q);
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        if (!q) {
            setResults([]);
            setOpen(true); // show empty-query panel (recent + VN30)
            return;
        }
        debounceRef.current = setTimeout(() => void searchSymbols(q, exchangeFilter), 300);
    }
    function handleSelect(item) {
        setQuery(item.symbol);
        setOpen(false);
        const updated = saveRecentItem(item, recentItems);
        setRecentItems(updated);
        onChange(item.symbol);
        onItemSelect?.(item);
    }
    function handleSelectSymbol(symbol, exchange) {
        const item = { symbol, company_name: "", exchange: exchange ?? "" };
        handleSelect(item);
    }
    function commitRawQuery() {
        const symbol = query.trim().toUpperCase();
        if (!symbol)
            return;
        setQuery(symbol);
        setOpen(false);
        onChange(symbol);
    }
    /** Navigate only over active search results list (not recent/VN30 presets). */
    function handleKeyDown(e) {
        if (e.key === "ArrowDown") {
            if (!open || results.length === 0)
                return;
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
        }
        else if (e.key === "ArrowUp") {
            if (!open || results.length === 0)
                return;
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            const selected = open && results.length > 0 ? results[highlightIndex] : null;
            if (selected) {
                handleSelect(selected);
                return;
            }
            commitRawQuery();
        }
        else if (e.key === "Escape") {
            setOpen(false);
        }
    }
    function handleFocus() {
        if (onFocusGuard) {
            onFocusGuard();
            return;
        }
        setOpen(true);
    }
    const EXCHANGE_OPTIONS = ["ALL", "HOSE", "HNX", "UPCOM"];
    const showEmptyPanel = open && !query;
    const showResultsPanel = open && query.length > 0 && results.length > 0;
    return (_jsxs("div", { ref: wrapperRef, className: "gc-symbol-search", children: [_jsx("input", { className: "gc-form-input gc-symbol-search__input", type: "text", value: query, placeholder: t("vninvest.symbolSearch"), onChange: handleInputChange, onKeyDown: handleKeyDown, onFocus: handleFocus, "aria-autocomplete": "list", "aria-haspopup": "listbox", role: "combobox", "aria-expanded": open }), showResultsPanel && (_jsxs("div", { className: "gc-symbol-search__dropdown", children: [_jsx("div", { className: "gc-symbol-search__exchange-bar", children: EXCHANGE_OPTIONS.map((ex) => (_jsx("button", { type: "button", className: `gc-symbol-search__ex-btn${exchangeFilter === ex ? " gc-symbol-search__ex-btn--active" : ""}`, onMouseDown: (e) => { e.preventDefault(); setExchangeFilter(ex); }, children: ex === "ALL" ? t("vninvest.symbolSearch.exAll") : ex }, ex))) }), _jsx("ul", { role: "listbox", children: results.map((item, idx) => (_jsxs("li", { role: "option", "aria-selected": idx === highlightIndex, className: `gc-symbol-search__item${idx === highlightIndex ? " gc-symbol-search__item--highlighted" : ""}`, onMouseDown: () => handleSelect(item), children: [_jsx("span", { className: "gc-symbol-search__symbol", children: item.symbol }), item.exchange && (_jsx("span", { className: `gc-symbol-search__ex-badge gc-symbol-search__ex-badge--${item.exchange.toLowerCase()}`, children: item.exchange })), item.company_name && (_jsx("span", { className: "gc-symbol-search__name", children: item.company_name }))] }, item.symbol))) })] })), showEmptyPanel && (_jsxs("div", { className: "gc-symbol-search__dropdown", children: [recentItems.length > 0 && (_jsxs("div", { className: "gc-symbol-search__section", children: [_jsx("div", { className: "gc-symbol-search__section-label", children: t("vninvest.symbolSearch.recent") }), _jsx("div", { className: "gc-symbol-search__chip-row", children: recentItems.map((item) => (_jsx("button", { type: "button", className: "gc-symbol-search__chip", onMouseDown: () => handleSelect(item), children: item.symbol }, item.symbol))) })] })), _jsxs("div", { className: "gc-symbol-search__section", children: [_jsx("div", { className: "gc-symbol-search__section-label", children: "VN30" }), _jsx("div", { className: "gc-symbol-search__chip-row", children: VN30_SYMBOLS.map((sym) => (_jsx("button", { type: "button", className: "gc-symbol-search__chip gc-symbol-search__chip--vn30", onMouseDown: () => handleSelectSymbol(sym, "HOSE"), children: sym }, sym))) })] })] }))] }));
}
