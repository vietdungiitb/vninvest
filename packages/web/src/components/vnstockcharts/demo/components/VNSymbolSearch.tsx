/**
 * OB-M03 — VNSymbolSearch
 * Search box with 300ms debounce and keyboard navigation.
 * M-02: Exchange filter (HOSE/HNX/UPCOM)
 * M-03: VN30 quick group preset
 * M-04: Recent symbols (localStorage, max 10)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useDemoI18n } from "../i18n";
import { VNInvestClient } from "../dataSources/VNInvestClient";
import type { SymbolSearchResult } from "../dataSources/index";

const RECENT_SYMBOLS_KEY = "vni_recent_symbols";
const MAX_RECENT = 10;

/** Official VN30 constituents (HOSE large-cap index). */
const VN30_SYMBOLS: string[] = [
	"VIC", "VHM", "VCB", "BID", "GAS", "VNM", "CTG", "MBB", "TCB", "HPG",
	"ACB", "VPB", "STB", "MSN", "PLX", "GVR", "HDB", "SSB", "MWG", "REE",
	"POW", "VJC", "PNJ", "VIB", "SAB", "FPT", "BVH", "TPB", "SHB", "BCM",
];

type ExchangeFilter = "ALL" | "HOSE" | "HNX" | "UPCOM";

function readRecentItems(): SymbolSearchResult[] {
	try {
		const raw = localStorage.getItem(RECENT_SYMBOLS_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as SymbolSearchResult[];
	} catch {
		return [];
	}
}

function saveRecentItem(
	item: SymbolSearchResult,
	existing: SymbolSearchResult[],
): SymbolSearchResult[] {
	const deduped = [item, ...existing.filter((s) => s.symbol !== item.symbol)].slice(0, MAX_RECENT);
	try {
		localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(deduped));
	} catch { /* ignore storage errors */ }
	return deduped;
}

export interface VNSymbolSearchProps {
	client: VNInvestClient;
	value: string;
	onChange: (symbol: string) => void;
	/** Called with full item metadata when a result is selected (e.g. for top-bar breadcrumb). */
	onItemSelect?: (item: SymbolSearchResult) => void;
	/** Nếu được cung cấp, sẽ được gọi khi input nhận focus thay vì mở dropdown (dùng để chặn khi chưa kết nối). */
	onFocusGuard?: () => void;
}

export function VNSymbolSearch({ client, value, onChange, onItemSelect, onFocusGuard }: VNSymbolSearchProps) {
	const { t } = useDemoI18n();
	const [query, setQuery] = useState(value);
	const [results, setResults] = useState<SymbolSearchResult[]>([]);
	const [open, setOpen] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("ALL");
	const [recentItems, setRecentItems] = useState<SymbolSearchResult[]>(() => readRecentItems());
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setQuery(value);
	}, [value]);

	// Close on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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

	const searchSymbols = useCallback(
		async (q: string, exFilter: ExchangeFilter) => {
			if (!q) { setResults([]); return; }
			try {
				const exchange = exFilter !== "ALL" ? exFilter : undefined;
				const stocks = await client.getStocks(q, exchange);
				const mapped: SymbolSearchResult[] = stocks.map((s) => ({
					symbol: s.symbol,
					company_name: s.company_name,
					exchange: s.exchange,
				}));
				setResults(mapped);
				setHighlightIndex(0);
				setOpen(mapped.length > 0);
			} catch {
				setResults([]);
				setOpen(false);
			}
		},
		[client],
	);

	// Re-search when exchange filter changes and query is active
	useEffect(() => {
		if (!query) return;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => void searchSymbols(query, exchangeFilter), 150);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [exchangeFilter]);

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const q = e.target.value;
		setQuery(q);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		if (!q) {
			setResults([]);
			setOpen(true); // show empty-query panel (recent + VN30)
			return;
		}
		debounceRef.current = setTimeout(() => void searchSymbols(q, exchangeFilter), 300);
	}

	function handleSelect(item: SymbolSearchResult) {
		setQuery(item.symbol);
		setOpen(false);
		const updated = saveRecentItem(item, recentItems);
		setRecentItems(updated);
		onChange(item.symbol);
		onItemSelect?.(item);
	}

	function handleSelectSymbol(symbol: string, exchange?: string) {
		const item: SymbolSearchResult = { symbol, company_name: "", exchange: exchange ?? "" };
		handleSelect(item);
	}

	function commitRawQuery() {
		const symbol = query.trim().toUpperCase();
		if (!symbol) return;
		setQuery(symbol);
		setOpen(false);
		onChange(symbol);
	}

	/** Navigate only over active search results list (not recent/VN30 presets). */
	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			if (!open || results.length === 0) return;
			e.preventDefault();
			setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
		} else if (e.key === "ArrowUp") {
			if (!open || results.length === 0) return;
			e.preventDefault();
			setHighlightIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const selected = open && results.length > 0 ? results[highlightIndex] : null;
			if (selected) {
				handleSelect(selected);
				return;
			}
			commitRawQuery();
		} else if (e.key === "Escape") {
			setOpen(false);
		}
	}

	function handleFocus() {
		if (onFocusGuard) { onFocusGuard(); return; }
		setOpen(true);
	}

	const EXCHANGE_OPTIONS: ExchangeFilter[] = ["ALL", "HOSE", "HNX", "UPCOM"];

	const showEmptyPanel = open && !query;
	const showResultsPanel = open && query.length > 0 && results.length > 0;

	return (
		<div ref={wrapperRef} className="gc-symbol-search">
			<input
				className="gc-form-input gc-symbol-search__input"
				type="text"
				value={query}
				placeholder={t("vninvest.symbolSearch")}
				onChange={handleInputChange}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				aria-autocomplete="list"
				aria-haspopup="listbox"
				role="combobox"
				aria-expanded={open}
			/>

			{/* Results panel: exchange filter + search results */}
			{showResultsPanel && (
				<div className="gc-symbol-search__dropdown">
					{/* M-02: Exchange filter tabs */}
					<div className="gc-symbol-search__exchange-bar">
						{EXCHANGE_OPTIONS.map((ex) => (
							<button
								key={ex}
								type="button"
								className={`gc-symbol-search__ex-btn${exchangeFilter === ex ? " gc-symbol-search__ex-btn--active" : ""}`}
								onMouseDown={(e) => { e.preventDefault(); setExchangeFilter(ex); }}
							>
								{ex === "ALL" ? t("vninvest.symbolSearch.exAll") : ex}
							</button>
						))}
					</div>
					<ul role="listbox">
						{results.map((item, idx) => (
							<li
								key={item.symbol}
								role="option"
								aria-selected={idx === highlightIndex}
								className={`gc-symbol-search__item${idx === highlightIndex ? " gc-symbol-search__item--highlighted" : ""}`}
								onMouseDown={() => handleSelect(item)}
							>
								<span className="gc-symbol-search__symbol">{item.symbol}</span>
								{item.exchange && (
									<span className={`gc-symbol-search__ex-badge gc-symbol-search__ex-badge--${item.exchange.toLowerCase()}`}>
										{item.exchange}
									</span>
								)}
								{item.company_name && (
									<span className="gc-symbol-search__name">{item.company_name}</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Empty-query panel: recent symbols + VN30 quick group */}
			{showEmptyPanel && (
				<div className="gc-symbol-search__dropdown">
					{/* M-04: Recent symbols */}
					{recentItems.length > 0 && (
						<div className="gc-symbol-search__section">
							<div className="gc-symbol-search__section-label">{t("vninvest.symbolSearch.recent")}</div>
							<div className="gc-symbol-search__chip-row">
								{recentItems.map((item) => (
									<button
										key={item.symbol}
										type="button"
										className="gc-symbol-search__chip"
										onMouseDown={() => handleSelect(item)}
									>
										{item.symbol}
									</button>
								))}
							</div>
						</div>
					)}
					{/* M-03: VN30 quick group */}
					<div className="gc-symbol-search__section">
						<div className="gc-symbol-search__section-label">VN30</div>
						<div className="gc-symbol-search__chip-row">
							{VN30_SYMBOLS.map((sym) => (
								<button
									key={sym}
									type="button"
									className="gc-symbol-search__chip gc-symbol-search__chip--vn30"
									onMouseDown={() => handleSelectSymbol(sym, "HOSE")}
								>
									{sym}
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
