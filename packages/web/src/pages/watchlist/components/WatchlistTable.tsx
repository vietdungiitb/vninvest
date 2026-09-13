import { createElement, MouseEvent, useState, useMemo, useEffect, ChangeEvent, FormEvent, useCallback } from "react";
import { useWatchlist } from "./WatchlistContext";
import { MergedData } from "../WatchlistTypes";
import { useI18n } from "../../../context/LangContext.js";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { createColumnHelper, useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from "@tanstack/react-table";
import { FixedSizeList as List } from "react-window";

const PAGE_SIZE_OPTIONS = [50, 100, 200];

export function WatchlistTable({ density }: { density: "compact" | "comfortable" }) {
  const { 
    activeItems, selectedType, selectedId,
    technicalsMap, realtimeFeed, priceHistoryRef, priceFlashMap,
    activeSymbolDetail, setActiveSymbolDetail, visibleColumns,
    holdings, trackedSymbols, portfolioNav,
    removeSymbol, setSuccessMsg, setVisibleSymbols
  } = useWatchlist();

  const { t } = useI18n();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [priceAlertDialog, setPriceAlertDialog] = useState<{ open: boolean; symbol: string; condition: "ABOVE" | "BELOW"; target_price: string; cooldown_seconds: string; error: string; submitting: boolean }>({ open: false, symbol: "", condition: "ABOVE", target_price: "", cooldown_seconds: "300", error: "", submitting: false });
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<{ id: string; desc: boolean } | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Reset to first page whenever the active list changes.
  const listKey = `${selectedType}:${selectedId}`;
  useEffect(() => {
    setPage(0);
  }, [listKey]);

  useEffect(() => { setPage(0); }, [globalFilter]);

  // P2-2 TanStack derives filteredSortedItems/pagedItems below

  const getMergedData = useCallback((symbol: string): MergedData => {
    const staticData = technicalsMap[symbol] || {};
    const streamingData = (realtimeFeed?.quotesBySymbol?.[symbol] || {}) as any;

    const price = streamingData.current_price ?? streamingData.price ?? staticData.price;
    const change = streamingData.change ?? streamingData.price_change ?? staticData.price_change;
    const changePct = streamingData.change_pct ?? streamingData.price_change_pct ?? staticData.price_change_pct;
    const volume = streamingData.volume ?? staticData.volume;

    return {
      ...staticData,
      price,
      price_change: change,
      price_change_pct: changePct,
      volume,
    };
  }, [technicalsMap, realtimeFeed]);

  const api = coreApiAdapter as unknown as {
    createPriceAlert: (payload: Record<string, unknown>) => Promise<unknown>;
  };

  const handlePriceAlertSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const tp = Number(priceAlertDialog.target_price);
    if (!Number.isFinite(tp) || tp <= 0) {
      setPriceAlertDialog(prev => ({ ...prev, error: t("watchlist.dialog.target_required", { defaultValue: "Giá mục tiêu là bắt buộc và phải > 0." }) }));
      return;
    }
    setPriceAlertDialog(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      await api.createPriceAlert({
        symbol: priceAlertDialog.symbol,
        condition: priceAlertDialog.condition,
        target_price: tp,
        cooldown_seconds: Number(priceAlertDialog.cooldown_seconds) || 300,
        is_active: true,
      });
      setPriceAlertDialog({ open: false, symbol: "", condition: "ABOVE", target_price: "", cooldown_seconds: "300", error: "", submitting: false });
      setSuccessMsg(t("watchlist.dialog.create_success", { defaultValue: "Đã tạo cảnh báo giá." }));
    } catch (err) {
      setPriceAlertDialog(prev => ({ ...prev, error: (err as Error).message || t("watchlist.dialog.create_error", { defaultValue: "Không thể tạo cảnh báo." }), submitting: false }));
    }
  };

  const renderSparkline = (symbol: string) => {
    const history = priceHistoryRef.current[symbol] || [];
    
    // Not enough history → show placeholder instead of fake path (W-01)
    if (history.length < 2) {
      return createElement(
        "span",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "30px",
            fontSize: "0.7rem",
            color: "var(--text-muted, #94a3b8)",
            background: "rgba(148,163,184,0.06)",
            borderRadius: "6px",
            border: "1px dashed rgba(148,163,184,0.15)"
          },
          "aria-label": t("watchlist.table.trend_no_data", { defaultValue: "Chưa đủ dữ liệu xu hướng" }),
          title: history.join(" → ")
        },
        "—"
      );
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const floor = max * 0.002; // 0.2% floor to avoid flat-line zigzag (W-10)
    const range = Math.max(max - min, floor) || 1;

    let pathD = `M 5,${20 - ((history[0] - min) / range) * 15}`;
    for (let i = 1; i < history.length; i++) {
      const x = 5 + (i / (history.length - 1)) * 80;
      const y = 20 - ((history[i] - min) / range) * 15;
      pathD += ` L ${x},${y}`;
    }

    const areaPath = `${pathD} L 85,25 L 5,25 Z`;
    
    const lastPrice = history[history.length - 1];
    const prevPrice = history[0];
    const isUp = lastPrice >= prevPrice;
    
    const color = isUp ? "#10b981" : "#f43f5e";
    const strokeColor = isUp ? "#34d399" : "#fb7185";

    return createElement(
      "svg",
      { className: "watchlistPage__sparklineSvg", viewBox: "0 0 90 25", preserveAspectRatio: "none", style: { display: "block", width: "100%", height: "30px" }, role: "img", "aria-label": `${symbol} ${history.join(" → ")}` },
      createElement("title", null, history.join(" → ")),
      createElement(
        "defs",
        null,
        createElement(
          "linearGradient",
          { id: `grad-dyn-${symbol}`, x1: "0", x2: "0", y1: "0", y2: "1" },
          createElement("stop", { offset: "0%", stopColor: color, stopOpacity: 0.4 }),
          createElement("stop", { offset: "100%", stopColor: color, stopOpacity: 0.0 })
        )
      ),
      createElement("path", { d: areaPath, fill: `url(#grad-dyn-${symbol})` }),
      createElement("path", { d: pathD, fill: "none", stroke: strokeColor, strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
    );
  };

  const renderActions = (symbol: string) => {
    const handleChart = (ev: MouseEvent) => {
      ev.stopPropagation();
      setActiveSymbolDetail(symbol);
    };
    const handleAlert = (ev: MouseEvent) => {
      ev.stopPropagation();
      setPriceAlertDialog({ open: true, symbol, condition: "ABOVE", target_price: "", cooldown_seconds: "300", error: "", submitting: false });
    };
    const handleTrade = (ev: MouseEvent) => {
      ev.stopPropagation();
      window.location.href = `/stocks/${symbol}`;
    };
    const handleRemove = (ev: MouseEvent) => {
      ev.stopPropagation();
      setRemoveConfirm(symbol);
    };

    return createElement(
      "div",
      { className: "watchlistPage__rowActions" },
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--chart",
        title: t("watchlist.table.view_chart", { defaultValue: "Biểu đồ" }),
        "aria-label": `${t("watchlist.table.view_chart", { defaultValue: "Biểu đồ" })} ${symbol}`,
        onClick: handleChart
      }, "\uD83D\uDCCA"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--alert",
        title: t("watchlist.table.set_alert", { defaultValue: "Tạo cảnh báo giá" }),
        "aria-label": `${t("watchlist.table.set_alert", { defaultValue: "Tạo cảnh báo giá" })} ${symbol}`,
        onClick: handleAlert
      }, "\u26A0\uFE0F"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--trade",
        title: t("watchlist.table.view_detail", { defaultValue: "Xem chi tiết" }),
        "aria-label": `${t("watchlist.table.view_detail", { defaultValue: "Xem chi tiết" })} ${symbol}`,
        onClick: handleTrade
      }, "\uD83D\uDCC8"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--remove",
        title: t("watchlist.table.delete", { defaultValue: "Xóa" }),
        "aria-label": `${t("watchlist.table.delete", { defaultValue: "Xóa" })} ${symbol}`,
        onClick: handleRemove,
        "data-testid": `watchlist-remove-${symbol}`
      }, "\u2715")
    );
  };

  // P2-2 TanStack wiring thật — 1 PR (getRowModel + FixedSizeList khi rows>100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tanStackColumns = useMemo(() => {
    const helper = createColumnHelper<any>();
    const cols: any[] = [];
    cols.push(helper.display({
      id: "select",
      header: ({ table }: any) => createElement("input", { type: "checkbox", checked: table.getIsAllPageRowsSelected(), indeterminate: table.getIsSomePageRowsSelected(), onChange: table.getToggleAllPageRowsSelectedHandler(), "data-testid": "watchlist-select-all", "aria-label": t("watchlist.table.select_all", { defaultValue: "Chọn tất cả" }) }),
      cell: ({ row }: any) => createElement("input", { type: "checkbox", checked: row.getIsSelected(), onChange: row.getToggleSelectedHandler(), "data-testid": `watchlist-select-${row.original.symbol}`, "aria-label": `Chọn ${row.original.symbol}`, onClick: (e: any) => e.stopPropagation() }),
      enableSorting: false,
    }));
    cols.push(helper.accessor("symbol" as any, {
      header: () => t("watchlist.table.symbol", { defaultValue: "Mã" }),
      cell: (info: any) => {
        const sym = info.getValue();
        const isActive = sym === activeSymbolDetail;
        return createElement("span", { style: { fontFamily: "monospace", fontWeight: 700, color: isActive ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" } }, sym);
      },
      enableSorting: true,
    }));
    cols.push(helper.accessor((row: any) => {
      const m = getMergedData(row.symbol);
      return m.price ?? 0;
    }, {
      id: "price",
      header: () => t("watchlist.table.price", { defaultValue: "Giá hiện tại" }),
      cell: ({ row }: any) => {
        const m = getMergedData(row.original.symbol);
        const pct = Number(m.price_change_pct || 0);
        const isUp = pct > 0, isDown = pct < 0;
        const flash = priceFlashMap[row.original.symbol] ? `watchlistPage__priceCell--${priceFlashMap[row.original.symbol]}` : "";
        return createElement("span", { className: `watchlistPage__priceCell ${flash}`, style: { fontFamily: "monospace", fontWeight: 600, color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-primary, #f1f5f9)" } }, m.price !== undefined ? Number(m.price).toLocaleString() : "—");
      },
      enableSorting: true,
    }));
    cols.push(helper.accessor((row: any) => Number(getMergedData(row.symbol).price_change_pct || 0), {
      id: "change",
      header: () => t("watchlist.table.change", { defaultValue: "% Thay đổi" }),
      cell: ({ row }: any) => {
        const m = getMergedData(row.original.symbol);
        const pct = Number(m.price_change_pct || 0);
        const isUp = pct > 0, isDown = pct < 0;
        const showWarn = Math.abs(pct) > 15;
        return createElement("span", { style: { fontFamily: "monospace", color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-muted, #94a3b8)" }, title: showWarn ? "Biến động vượt trần — kiểm tra nguồn" : undefined }, pct !== 0 ? `${isUp ? "+" : ""}${pct.toFixed(2)}%${showWarn ? " ⚠️" : ""}` : "0.00%");
      },
      enableSorting: true,
    }));
    if (selectedType === "watchlist") {
      if (visibleColumns.rsi) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.rsi_14 ?? -999, { id: "rsi", header: () => t("watchlist.column.rsi", { defaultValue: "RSI(14)" }), cell: ({ row }: any) => { const v = technicalsMap[row.original.symbol]?.rsi_14; return v !== undefined && v !== null ? Number(v).toFixed(1) : "—"; }, enableSorting: true }));
      if (visibleColumns.rvol) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.rvol ?? -999, { id: "rvol", header: () => t("watchlist.column.rvol", { defaultValue: "RVOL" }), cell: ({ row }: any) => { const v = technicalsMap[row.original.symbol]?.rvol; return v !== undefined && v !== null ? Number(v).toFixed(2) : "—"; }, enableSorting: true }));
      if (visibleColumns.ma20Dist) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.ma20_distance_pct ?? -999, { id: "ma20", header: () => t("watchlist.column.ma20_dist", { defaultValue: "% Cách MA20" }), cell: ({ row }: any) => { const v = technicalsMap[row.original.symbol]?.ma20_distance_pct; if (v === undefined || v === null) return "—"; return createElement("span", { style: { fontFamily: "monospace", color: Number(v) >= 0 ? "#10b981" : "#f43f5e" } }, `${Number(v).toFixed(1)}%`); }, enableSorting: true }));
      if (visibleColumns.bias) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.bias_label ?? "", { id: "bias", header: () => t("watchlist.column.bias", { defaultValue: "Định hướng" }), cell: ({ row }: any) => technicalsMap[row.original.symbol]?.bias_label || t("watchlist.table.neutral", { defaultValue: "Trung tính" }), enableSorting: true }));
    } else if (selectedType === "holds") {
      cols.push(helper.accessor((row: any) => Number(row.quantity || 0), { id: "quantity", header: () => t("watchlist.table.quantity", { defaultValue: "Số lượng" }), cell: ({ row }: any) => Number(row.original.quantity || 0).toLocaleString(), enableSorting: true }));
      cols.push(helper.accessor((row: any) => Number(row.avg_cost || 0), { id: "avg_cost", header: () => t("watchlist.table.avg_cost", { defaultValue: "Giá vốn TB" }), cell: ({ row }: any) => Math.round(Number(row.original.avg_cost || 0)).toLocaleString(), enableSorting: true }));
      cols.push(helper.accessor((row: any) => Number(row.market_value || 0), { id: "market_value", header: () => t("watchlist.table.market_value", { defaultValue: "Giá trị TT" }), cell: ({ row }: any) => Math.round(Number(row.original.market_value || 0)).toLocaleString(), enableSorting: true }));
      cols.push(helper.display({ id: "weight", header: () => t("watchlist.table.weight", { defaultValue: "Tỷ trọng" }), cell: ({ row }: any) => { const nav = portfolioNav ?? holdings.reduce((acc: number, h: any) => acc + Number(h.market_value || 0), 0); const mv = Number(row.original.market_value || 0); return nav > 0 ? `${((mv / nav) * 100).toFixed(1)}%` : "—"; } }));
      cols.push(helper.accessor((row: any) => Number(row.unrealized_pnl || 0), { id: "pnl", header: () => t("watchlist.table.pnl", { defaultValue: "Lãi / Lỗ" }), cell: ({ row }: any) => { const pnl = Number(row.original.unrealized_pnl || 0); return createElement("span", { style: { fontFamily: "monospace", color: pnl > 0 ? "#10b981" : pnl < 0 ? "#f43f5e" : "var(--text-muted, #94a3b8)" } }, pnl !== 0 ? `${pnl > 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}` : "0"); }, enableSorting: true }));
      cols.push(helper.accessor((row: any) => Number(row.unrealized_pnl_pct || 0), { id: "pnl_pct", header: () => t("watchlist.table.pnl_pct", { defaultValue: "% Lãi / Lỗ" }), cell: ({ row }: any) => { const pct = Number(row.original.unrealized_pnl_pct || 0); return createElement("span", { style: { fontFamily: "monospace", color: pct > 0 ? "#10b981" : pct < 0 ? "#f43f5e" : "var(--text-muted, #94a3b8)" } }, pct !== 0 ? `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%` : "0.00%"); }, enableSorting: true }));
    } else if (selectedType === "tracked") {
      cols.push(helper.accessor("company_name" as any, { header: () => t("watchlist.table.company_name", { defaultValue: "Tên doanh nghiệp" }), cell: ({ row }: any) => { const r = row.original; const m = technicalsMap[r.symbol] || {}; const name = m.company_name || r.company_name || "—"; const ind = m.industry || r.industry || ""; const indDisplay = ind && ind !== "Khác" ? ind : ""; return createElement("div", { style: { display: "flex", flexDirection: "column" } }, createElement("span", { style: { fontWeight: 700, color: "var(--text-primary, #f1f5f9)", fontSize: "0.85rem", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" } }, name), indDisplay ? createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" } }, indDisplay) : null); } }));
      cols.push(helper.display({ id: "limit", header: () => t("watchlist.table.limit", { defaultValue: "Ngưỡng giám sát" }) + " (tr/tỷ)", cell: ({ row }: any) => { const sym = row.original.symbol; const raw = row.original.whale_alert_threshold_million ?? trackedSymbols.find((t: any) => t.symbol === sym)?.whale_alert_threshold_million; if (raw == null) return t("watchlist.table.default_threshold", { defaultValue: "Mặc định" }); const v = Number(raw); if (v >= 1000) return `${(v/1000).toLocaleString("vi-VN", {minimumFractionDigits:1, maximumFractionDigits:1})} tỷ`; return `${v.toLocaleString("vi-VN", {minimumFractionDigits:1, maximumFractionDigits:1})} tr`; } }));
    } else {
      cols.push(helper.accessor("company_name" as any, { header: () => t("watchlist.table.company_name", { defaultValue: "Tên doanh nghiệp" }), cell: ({ row }: any) => { const r = row.original; const m = technicalsMap[r.symbol] || {}; const name = m.company_name || r.company_name || "—"; const ind = m.industry || r.industry || ""; const indDisplay = ind && ind !== "Khác" ? ind : ""; return createElement("div", { style: { display: "flex", flexDirection: "column" } }, createElement("span", { style: { fontWeight: 700, color: "var(--text-primary, #f1f5f9)", fontSize: "0.85rem", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" } }, name), indDisplay ? createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" } }, indDisplay) : null); } }));
      if (visibleColumns.rsi) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.rsi_14 ?? -999, { id: "rsi", header: () => t("watchlist.column.rsi"), cell: ({ row }: any) => { const v = technicalsMap[row.original.symbol]?.rsi_14; return v !== undefined && v !== null ? Number(v).toFixed(1) : "—"; } }));
      if (visibleColumns.rvol) cols.push(helper.accessor((row: any) => technicalsMap[row.symbol]?.rvol ?? -999, { id: "rvol", header: () => t("watchlist.column.rvol"), cell: ({ row }: any) => { const v = technicalsMap[row.original.symbol]?.rvol; return v !== undefined && v !== null ? Number(v).toFixed(2) : "—"; } }));
    }
    cols.push(helper.display({ id: "action", header: () => t("watchlist.table.quick_action", { defaultValue: "Hành động" }), cell: ({ row }: any) => renderActions(row.original.symbol), enableSorting: false }));
    cols.push(helper.display({ id: "trend", header: () => t("watchlist.table.trend", { defaultValue: "Xu hướng" }), cell: ({ row }: any) => renderSparkline(row.original.symbol), enableSorting: false }));
    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, visibleColumns, t, technicalsMap, realtimeFeed, priceHistoryRef, priceFlashMap, activeSymbolDetail, holdings, trackedSymbols, density]);

  const tanStackTable = useReactTable({
    data: activeItems as any[],
    columns: tanStackColumns as any,
    state: {
      sorting: sorting ? ([sorting] as any) : [],
      globalFilter,
      pagination: { pageIndex: page, pageSize },
      rowSelection,
    } as any,
    onSortingChange: (updater: any) => {
      const next = typeof updater === "function" ? updater(sorting ? [sorting] : []) : updater;
      setSorting(next[0] ?? null);
    },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater: any) => {
      const next = typeof updater === "function" ? updater({ pageIndex: page, pageSize }) : updater;
      setPage(next.pageIndex);
      setPageSize(next.pageSize);
    },
    onRowSelectionChange: setRowSelection as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row: any) => row.symbol,
    globalFilterFn: (row: any, _columnId: string, filterValue: string) => {
      const q = String(filterValue).toLowerCase();
      const sym = String(row.original.symbol ?? "").toLowerCase();
      const name = String(technicalsMap[row.original.symbol]?.company_name ?? row.original.company_name ?? "").toLowerCase();
      const ind = String(technicalsMap[row.original.symbol]?.industry ?? row.original.industry ?? "").toLowerCase();
      return sym.includes(q) || name.includes(q) || ind.includes(q);
    },
  });

  const selectedCount = tanStackTable.getSelectedRowModel().rows.length;
  const handleBulkDelete = () => {
    if (selectedCount === 0 || !selectedId) return;
    setBulkDeleteConfirmOpen(true);
  };
  const confirmBulkDelete = async () => {
    const rows = tanStackTable.getSelectedRowModel().rows;
    if (rows.length === 0 || !selectedId) return;
    setBulkDeleteConfirmOpen(false);
    for (const r of rows) {
      const sym = (r.original as any).symbol;
      try { await removeSymbol(selectedId, sym); } catch {}
    }
    setRowSelection({});
  };

  // Derived from TanStack for visible-subs and pagination (P2-1, P2-2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredSortedItems = useMemo(() => tanStackTable.getFilteredRowModel().rows.map((r: any) => r.original), [tanStackTable.getFilteredRowModel().rows]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pagedItems = useMemo(() => tanStackTable.getPaginationRowModel().rows.map((r: any) => r.original), [tanStackTable.getPaginationRowModel().rows]);
  const totalPages = tanStackTable.getPageCount() || 1;
  useEffect(() => {
    const syms = pagedItems.map((item: unknown) => String((item as Record<string, unknown>).symbol ?? "")).filter(Boolean);
    setVisibleSymbols(syms);
  }, [pagedItems, setVisibleSymbols]);

  const renderTableHeader = () => {
    const thStyle = {
      padding: density === "compact" ? "8px 12px" : "12px 16px",
      color: "var(--text-muted, #94a3b8)",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      fontSize: "0.7rem",
      letterSpacing: "0.05em",
      borderBottom: "1px solid rgba(80, 120, 168, 0.15)"
    };
    return tanStackTable.getHeaderGroups().map(headerGroup =>
      createElement("tr", { key: headerGroup.id },
        headerGroup.headers.map(header => {
          const canSort = header.column.getCanSort();
          const sorted = header.column.getIsSorted();
          const isSelect = header.id === "select";
          return createElement("th", {
            key: header.id,
            colSpan: header.colSpan,
            style: {
              ...thStyle,
              cursor: canSort ? "pointer" : undefined,
              userSelect: canSort ? "none" as const : undefined,
              width: isSelect ? "40px" : header.id === "trend" ? "100px" : header.id === "action" ? "90px" : undefined,
              textAlign: isSelect || header.id === "action" || header.id === "trend" ? "center" as const : undefined,
            },
            onClick: header.column.getToggleSortingHandler(),
            title: canSort ? t("watchlist.table.sort", { defaultValue: "Sắp xếp" }) : undefined,
          }, header.isPlaceholder ? null : createElement("div", { style: { display: "flex", alignItems: "center", gap: "4px", justifyContent: isSelect ? "center" : "flex-start" } }, flexRender(header.column.columnDef.header, header.getContext()), sorted ? (sorted === "asc" ? " ↑" : " ↓") : null));
        })
      )
    );
  };

  const handleRowClick = (symbol: string) => {
    setActiveSymbolDetail(symbol === activeSymbolDetail ? null : symbol);
  };

  const renderTableBody = () => {
    const rows = tanStackTable.getPaginationRowModel().rows;
    const tdPadding = density === "compact" ? "6px 12px" : "12px 16px";
    if (rows.length === 0) {
      return createElement("tr", null, createElement("td", {colSpan: tanStackTable.getAllColumns().length, style:{padding:"2rem", textAlign:"center", color:"var(--text-muted, #94a3b8)"}}, t("watchlist.table.empty",{defaultValue:"Danh sách trống."})));
    }
    if (rows.length >100) {
      const rowHeight = density==="compact"?36:48;
      const height = Math.min(400, rows.length * rowHeight);
      return createElement(List as any, {
        height,
        itemCount: rows.length,
        itemSize: rowHeight,
        width: "100%",
        itemData: rows,
        outerElementType: (props: any) => createElement("tbody", {...props, style:{...props.style, background:"transparent"}}),
        children: ({index, style, data}: any) => {
        const row: any = data[index];
        const symbol = row.original.symbol;
        const isActive = symbol === activeSymbolDetail;
        const isSelected = row.getIsSelected();
        const rowStyle = {
          display: "table",
          tableLayout: "fixed" as const,
          width: "100%",
          background: isActive ? "rgba(0, 180, 216, 0.08)" : isSelected ? "rgba(34,211,238,0.06)" : "transparent",
          borderLeft: isActive ? "2px solid var(--accent-cyan, #22d3ee)" : "2px solid transparent",
          borderBottom: "1px solid rgba(80, 120, 168, 0.15)",
          cursor: "pointer",
          ...style,
        };
        return createElement("tr", {key: row.id, style: rowStyle, onClick:()=>handleRowClick(symbol), className: isActive ? "watchlistPage__row--active" : "", "data-testid":`watchlist-row-${symbol}`}, row.getVisibleCells().map((cell:any)=> createElement("td", {key: cell.id, style:{padding: tdPadding}}, flexRender(cell.column.columnDef.cell, cell.getContext()))));
        },
      });
    }
    return rows.map((row: any) => {
      const symbol = row.original.symbol;
      const isActive = symbol === activeSymbolDetail;
      const isSelected = row.getIsSelected();
      const rowStyle = {
        background: isActive ? "rgba(0, 180, 216, 0.08)" : isSelected ? "rgba(34,211,238,0.06)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent-cyan, #22d3ee)" : "2px solid transparent",
        borderBottom: "1px solid rgba(80, 120, 168, 0.15)",
        cursor: "pointer",
        transition: "all 0.15s ease"
      };
      return createElement("tr", {key: row.id, style: rowStyle, onClick:()=>handleRowClick(symbol), className: `hover:bg-slate-800/20${isActive ? " watchlistPage__row--active" : isSelected ? " watchlistPage__row--selected" : ""}`, "data-testid":`watchlist-row-${symbol}`}, row.getVisibleCells().map((cell:any)=> createElement("td", {key: cell.id, style:{padding: tdPadding}}, flexRender(cell.column.columnDef.cell, cell.getContext()))));
    });
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "10px", width: "100%", minWidth: 0, overflowX: "hidden" } },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" } },
      createElement("input", {
        type: "search",
        placeholder: t("watchlist.table.search_placeholder", { defaultValue: "Tìm mã, tên DN..." }),
        value: globalFilter,
        onChange: (e: ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value),
        style: {
          padding: "8px 12px", fontSize: "0.8rem", width: "240px",
          background: "rgba(2,11,35,0.4)", border: "1px solid rgba(80,120,168,0.15)",
          borderRadius: "8px", color: "#f1f5f9"
        },
        "data-testid": "watchlist-search",
        "aria-label": t("watchlist.table.search_placeholder", { defaultValue: "Tìm mã, tên DN..." })
      }),
      filteredSortedItems.length !== activeItems.length && createElement(
        "span",
        { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" } },
        `${filteredSortedItems.length} / ${activeItems.length}`
      )
    ),
    selectedCount > 0 && createElement(
      "div",
      {
        style: {
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", border: "1px solid rgba(34,211,238,0.25)",
          borderRadius: "8px", background: "rgba(34,211,238,0.08)"
        },
        "data-testid": "watchlist-bulk-bar"
      },
      createElement("span", { style: { fontSize: "0.8rem", fontWeight: 600, color: "#22d3ee" } }, t("watchlist.table.bulk_selected", { defaultValue: `Đã chọn ${selectedCount} mã` })),
      createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
        createElement("button", {
          type: "button",
          onClick: handleBulkDelete,
          style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" },
          "data-testid": "watchlist-bulk-delete"
        }, t("watchlist.table.bulk_delete", { defaultValue: `Xóa ${selectedCount} mã` })),
        createElement("button", {
          type: "button",
          onClick: () => setRowSelection({}),
          style: { padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(80,120,168,0.25)", background: "rgba(255,255,255,0.06)", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }
        }, t("common.clear", { defaultValue: "Bỏ chọn" }))
      )
    ),
    createElement(
      "div",
      { 
        className: "watchlistPage__tableWrapper", 
        style: { 
          overflowX: "auto", 
          border: "1px solid rgba(80, 120, 168, 0.15)", 
          borderRadius: "8px", 
          background: "rgba(15, 23, 42, 0.15)",
          width: "100%"
        } 
      },
      createElement(
        "table",
        { 
          className: `watchlistPage__table w-full ${density === "compact" ? "watchlistPage__table--compact" : ""}`,
          style: { width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "left", tableLayout: "fixed" as const },
          role: "grid",
          "aria-label": t("watchlist.table.aria_grid", { defaultValue: "Bảng danh mục theo dõi" })
        },
        createElement(
          "thead",
          { style: { background: "rgba(8, 23, 52, 0.5)", position: "sticky", top: 0, zIndex: 10 } },
          renderTableHeader()
        ),
      createElement(
        "tbody",
        { style: { background: "transparent" } },
        renderTableBody()
      )
      ),
      createElement(WatchlistTablePager, {
        page, pageSize, totalPages, totalItems: filteredSortedItems.length,
        onPageChange: setPage, onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
      })
    ),
    // Remove confirm dialog (W-03)
    removeConfirm && createElement(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
        onClick: () => setRemoveConfirm(null),
        role: "presentation",
        "data-testid": "watchlist-remove-dialog"
      },
      createElement(
        "div",
        {
          style: { background: "rgba(15,23,42,0.98)", border: "1px solid rgba(80,120,168,0.3)", borderRadius: "12px", padding: "20px", minWidth: "320px", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "16px" },
          onClick: (e: MouseEvent) => e.stopPropagation(),
          role: "dialog", "aria-modal": "true", "aria-label": t("watchlist.table.delete_confirm_title", { defaultValue: "Xác nhận xóa" })
        },
        createElement("h3", { style: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" } }, t("watchlist.table.delete_confirm_title", { defaultValue: "Xác nhận xóa" })),
        createElement("p", { style: { margin: 0, fontSize: "0.85rem", color: "#94a3b8" } }, t("watchlist.table.delete_confirm", { defaultValue: `Xóa mã ${removeConfirm} khỏi danh sách?` })),
        createElement(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: "10px" } },
          createElement("button", { type: "button", onClick: () => setRemoveConfirm(null), style: { padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", cursor: "pointer", fontWeight: 600 }, "data-testid": "watchlist-remove-cancel" }, t("common.cancel", { defaultValue: "Hủy" })),
          createElement("button", { type: "button", onClick: () => { const s = removeConfirm; setRemoveConfirm(null); if (s && selectedId) removeSymbol(selectedId, s); }, style: { padding: "8px 16px", borderRadius: "8px", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 700 }, "data-testid": "watchlist-remove-confirm" }, t("common.delete", { defaultValue: "Xóa" }))
        )
      )
    ),
    // Bulk delete confirm — F1 fix (Dialog, not window.confirm)
    bulkDeleteConfirmOpen && createElement(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
        onClick: () => setBulkDeleteConfirmOpen(false),
        role: "presentation",
        "data-testid": "watchlist-bulk-delete-dialog"
      },
      createElement(
        "div",
        {
          style: { background: "rgba(15,23,42,0.98)", border: "1px solid rgba(80,120,168,0.3)", borderRadius: "12px", padding: "20px", minWidth: "320px", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "16px" },
          onClick: (e: MouseEvent) => e.stopPropagation(),
          role: "dialog", "aria-modal": "true", "aria-label": t("watchlist.table.bulk_delete_confirm_title", { defaultValue: "Xác nhận xóa hàng loạt" })
        },
        createElement("h3", { style: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" } }, t("watchlist.table.bulk_delete_confirm_title", { defaultValue: "Xác nhận xóa hàng loạt" })),
        createElement("p", { style: { margin: 0, fontSize: "0.85rem", color: "#94a3b8" } }, t("watchlist.table.bulk_delete_confirm", { defaultValue: `Xóa ${selectedCount} mã đã chọn?` })),
        createElement(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: "10px" } },
          createElement("button", { type: "button", onClick: () => setBulkDeleteConfirmOpen(false), style: { padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", cursor: "pointer", fontWeight: 600 }, "data-testid": "watchlist-bulk-delete-cancel" }, t("common.cancel", { defaultValue: "Hủy" })),
          createElement("button", { type: "button", onClick: confirmBulkDelete, style: { padding: "8px 16px", borderRadius: "8px", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 700 }, "data-testid": "watchlist-bulk-delete-confirm" }, t("common.delete", { defaultValue: "Xóa" }))
        )
      )
    ),
    // Price alert inline dialog (V-06)
    priceAlertDialog.open && createElement(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" },
        onClick: () => setPriceAlertDialog(prev => ({ ...prev, open: false, error: "" })),
        role: "presentation",
        "data-testid": "watchlist-pricealert-dialog"
      },
      createElement(
        "form",
        {
          style: { background: "rgba(15,23,42,0.98)", border: "1px solid rgba(80,120,168,0.3)", borderRadius: "12px", padding: "20px", minWidth: "340px", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "14px" },
          onClick: (e: MouseEvent) => e.stopPropagation(),
          onSubmit: handlePriceAlertSubmit,
          role: "dialog", "aria-modal": "true", "aria-label": t("watchlist.dialog.create_title", { defaultValue: "Tạo cảnh báo giá" })
        },
        createElement("h3", { style: { margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" } }, `${t("watchlist.dialog.create_title", { defaultValue: "Tạo cảnh báo giá" })} — ${priceAlertDialog.symbol}`),
        priceAlertDialog.error && createElement("div", { style: { padding: "8px 12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#f87171", fontSize: "0.8rem" } }, priceAlertDialog.error),
        createElement(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 } },
          t("watchlist.table.condition", { defaultValue: "Điều kiện" }),
          createElement(
            "select",
            {
              value: priceAlertDialog.condition,
              onChange: (e: ChangeEvent<HTMLSelectElement>) => setPriceAlertDialog(prev => ({ ...prev, condition: e.target.value as "ABOVE" | "BELOW" })),
              style: { padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(2,11,35,0.6)", color: "#f1f5f9", fontSize: "0.85rem" }
            },
            createElement("option", { value: "ABOVE" }, t("watchlist.dialog.condition_above", { defaultValue: "Vượt lên trên" })),
            createElement("option", { value: "BELOW" }, t("watchlist.dialog.condition_below", { defaultValue: "Rơi xuống dưới" }))
          )
        ),
        createElement(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 } },
          t("watchlist.dialog.target_price", { defaultValue: "Giá mục tiêu" }),
          createElement("input", {
            type: "number", step: "100", min: "1000",
            value: priceAlertDialog.target_price,
            onChange: (e: ChangeEvent<HTMLInputElement>) => setPriceAlertDialog(prev => ({ ...prev, target_price: e.target.value })),
            placeholder: "15000",
            style: { padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(2,11,35,0.6)", color: "#f1f5f9", fontSize: "0.85rem" },
            "data-testid": "watchlist-pricealert-target",
            autoFocus: true
          })
        ),
        createElement(
          "label",
          { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 } },
          t("watchlist.table.cooldown", { defaultValue: "Cooldown (giây)" }),
          createElement("input", {
            type: "number", step: "60", min: "0",
            value: priceAlertDialog.cooldown_seconds,
            onChange: (e: ChangeEvent<HTMLInputElement>) => setPriceAlertDialog(prev => ({ ...prev, cooldown_seconds: e.target.value })),
            style: { padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(2,11,35,0.6)", color: "#f1f5f9", fontSize: "0.85rem" }
          })
        ),
        createElement(
          "div",
          { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" } },
          createElement("button", { type: "button", onClick: () => setPriceAlertDialog(prev => ({ ...prev, open: false, error: "" })), style: { padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.3)", background: "rgba(255,255,255,0.06)", color: "#f1f5f9", cursor: "pointer", fontWeight: 600 }, "data-testid": "watchlist-pricealert-cancel" }, t("common.cancel", { defaultValue: "Hủy" })),
          createElement("button", { type: "submit", disabled: priceAlertDialog.submitting, style: { padding: "8px 16px", borderRadius: "8px", border: "none", background: priceAlertDialog.submitting ? "#64748b" : "#0ea5e9", color: "#fff", cursor: priceAlertDialog.submitting ? "not-allowed" : "pointer", fontWeight: 700, opacity: priceAlertDialog.submitting ? 0.7 : 1 }, "data-testid": "watchlist-pricealert-submit" }, priceAlertDialog.submitting ? t("common.saving", { defaultValue: "Đang lưu..." }) : t("watchlist.dialog.save", { defaultValue: "Tạo cảnh báo" }))
        )
      )
    )
  );
}

function WatchlistTablePager({
  page, pageSize, totalPages, totalItems, onPageChange, onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const { t } = useI18n();
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalItems);

  const pagerBtn = (label: string, targetPage: number, disabled: boolean, key: string) =>
    createElement(
      "button",
      {
        key,
        type: "button",
        disabled,
        onClick: () => onPageChange(targetPage),
        style: {
          padding: "6px 12px",
          fontSize: "0.8rem",
          fontWeight: 600,
          borderRadius: "6px",
          border: "1px solid rgba(80, 120, 168, 0.25)",
          background: disabled ? "rgba(15, 23, 42, 0.4)" : "rgba(0, 180, 216, 0.12)",
          color: disabled ? "var(--text-muted, #64748b)" : "var(--accent-cyan, #22d3ee)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        },
      },
      label
    );

  return createElement(
    "div",
    {
      className: "watchlistPage__pager",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
        padding: "12px 16px",
        borderTop: "1px solid rgba(80, 120, 168, 0.15)",
        position: "sticky" as const,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(8px)",
        zIndex: 5,
      },
    },
    createElement(
      "span",
      { style: { fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" } },
      t("watchlist.table.pager_range", {
        defaultValue: `Hiển thị ${from}–${to} / ${totalItems} mã`,
      })
    ),
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
      pagerBtn("‹", Math.max(0, page - 1), page <= 0, "prev"),
      createElement(
        "span",
        { style: { fontSize: "0.8rem", color: "var(--text-primary, #f1f5f9)", minWidth: "90px", textAlign: "center" } },
        t("watchlist.table.pager_page", { defaultValue: `Trang ${page + 1} / ${totalPages}` })
      ),
      pagerBtn("›", Math.min(totalPages - 1, page + 1), page >= totalPages - 1, "next"),
      createElement(
        "select",
        {
          value: pageSize,
          onChange: (ev: any) => onPageSizeChange(Number(ev.target.value)),
          style: {
            padding: "6px 8px",
            fontSize: "0.8rem",
            borderRadius: "6px",
            border: "1px solid rgba(80, 120, 168, 0.25)",
            background: "rgba(2, 11, 35, 0.6)",
            color: "var(--text-primary, #f1f5f9)",
            cursor: "pointer",
          },
        },
        PAGE_SIZE_OPTIONS.map((opt: number) =>
          createElement("option", { key: opt, value: opt }, `${opt} / trang`)
        )
      )
    )
  );
}
