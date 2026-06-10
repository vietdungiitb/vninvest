import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WP-04: VNSymbolSearch — moved from src/demo/components/
 * Search box with debounce and keyboard navigation.
 * Widget-scoped: uses useWidgetI18n(), .vnsc- prefix.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
const RECENT_SYMBOLS_KEY = "vni_recent_symbols";
const MAX_RECENT = 10;
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
    catch { /* ignore */ }
    return deduped;
}
export function VNSymbolSearch({ adapter, client, value, onChange, onItemSelect, onFocusGuard }) {
    const { t } = useWidgetI18n();
    const [query, setQuery] = useState(value);
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [exchangeFilter, setExchangeFilter] = useState("ALL");
    const [recentItems, setRecentItems] = useState(() => readRecentItems());
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);
    useEffect(() => { setQuery(value); }, [value]);
    useEffect(() => {
        function handleClick(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
        };
    }, []);
    const effectiveClient = client;
    const effectiveAdapter = adapter;
    const searchSymbols = useCallback(async (q, exFilter) => {
        if (!q) {
            setResults([]);
            return;
        }
        try {
            const exchange = exFilter !== "ALL" ? exFilter : undefined;
            let mapped = [];
            if (effectiveClient) {
                // Legacy path: direct VNInvestClient
                const stocks = await effectiveClient.getStocks(q, exchange);
                mapped = stocks.map((s) => ({ symbol: s.symbol, company_name: s.company_name, exchange: s.exchange }));
            }
            else if (effectiveAdapter) {
                // New path: StockDataAdapter
                const symbols = await effectiveAdapter.searchSymbols(q);
                mapped = symbols
                    .filter((s) => !exchange || s.exchange?.toUpperCase() === exchange)
                    .map((s) => ({ symbol: s.symbol, company_name: s.name ?? "", exchange: s.exchange ?? "" }));
            }
            setResults(mapped);
            setHighlightIndex(0);
            setOpen(mapped.length > 0);
        }
        catch {
            setResults([]);
            setOpen(false);
        }
    }, [effectiveClient, effectiveAdapter]);
    useEffect(() => {
        if (!query)
            return;
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void searchSymbols(query, exchangeFilter), 150);
    }, [exchangeFilter, query, searchSymbols]);
    function handleInputChange(e) {
        const q = e.target.value;
        setQuery(q);
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        if (!q) {
            setResults([]);
            setOpen(true);
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
    function commitRawQuery() {
        const symbol = query.trim().toUpperCase();
        if (!symbol)
            return;
        setQuery(symbol);
        setOpen(false);
        onChange(symbol);
    }
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
    return (_jsxs("div", { ref: wrapperRef, className: "vnsc-symbol-search", children: [_jsx("input", { className: "vnsc-form-input vnsc-symbol-search__input", type: "text", value: query, placeholder: t("symbolSearch.placeholder", { defaultValue: "Search symbol..." }), onChange: handleInputChange, onKeyDown: handleKeyDown, onFocus: handleFocus, "aria-autocomplete": "list", "aria-haspopup": "listbox", role: "combobox", "aria-expanded": open }), showResultsPanel && (_jsxs("div", { className: "vnsc-symbol-search__dropdown", children: [_jsx("div", { className: "vnsc-symbol-search__exchange-bar", children: EXCHANGE_OPTIONS.map((ex) => (_jsx("button", { type: "button", className: `vnsc-symbol-search__ex-btn${exchangeFilter === ex ? " vnsc-symbol-search__ex-btn--active" : ""}`, onMouseDown: (e) => { e.preventDefault(); setExchangeFilter(ex); }, children: ex === "ALL" ? "All" : ex }, ex))) }), _jsx("ul", { role: "listbox", children: results.map((item, idx) => (_jsxs("li", { role: "option", "aria-selected": idx === highlightIndex, className: `vnsc-symbol-search__item${idx === highlightIndex ? " vnsc-symbol-search__item--highlighted" : ""}`, onMouseDown: () => handleSelect(item), children: [_jsx("span", { className: "vnsc-symbol-search__symbol", children: item.symbol }), item.exchange && (_jsx("span", { className: `vnsc-symbol-search__ex-badge vnsc-symbol-search__ex-badge--${item.exchange.toLowerCase()}`, children: item.exchange })), item.company_name && (_jsx("span", { className: "vnsc-symbol-search__name", children: item.company_name }))] }, item.symbol))) })] })), showEmptyPanel && (_jsxs("div", { className: "vnsc-symbol-search__dropdown", children: [recentItems.length > 0 && (_jsxs("div", { className: "vnsc-symbol-search__section", children: [_jsx("div", { className: "vnsc-symbol-search__section-label", children: "Recent" }), _jsx("div", { className: "vnsc-symbol-search__chip-row", children: recentItems.map((item) => (_jsx("button", { type: "button", className: "vnsc-symbol-search__chip", onMouseDown: () => handleSelect(item), children: item.symbol }, item.symbol))) })] })), _jsxs("div", { className: "vnsc-symbol-search__section", children: [_jsx("div", { className: "vnsc-symbol-search__section-label", children: "VN30" }), _jsx("div", { className: "vnsc-symbol-search__chip-row", children: VN30_SYMBOLS.map((sym) => (_jsx("button", { type: "button", className: "vnsc-symbol-search__chip vnsc-symbol-search__chip--vn30", onMouseDown: () => handleSelect({ symbol: sym, company_name: "", exchange: "HOSE" }), children: sym }, sym))) })] })] }))] }));
}
