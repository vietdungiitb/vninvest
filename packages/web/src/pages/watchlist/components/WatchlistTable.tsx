import { createElement, MouseEvent } from "react";
import { useWatchlist } from "./WatchlistContext";
import { WatchlistItem, Holding, MergedData } from "../WatchlistTypes";
import { useI18n } from "../../../context/LangContext.js";

export function WatchlistTable({ density }: { density: "compact" | "comfortable" }) {
  const { 
    activeItems, selectedType, selectedId,
    technicalsMap, realtimeFeed, priceHistoryRef, priceFlashMap,
    activeSymbolDetail, setActiveSymbolDetail, visibleColumns,
    removeSymbol
  } = useWatchlist();

  const { t } = useI18n();

  const getMergedData = (symbol: string): MergedData => {
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
  };

  const renderSparkline = (symbol: string) => {
    const history = priceHistoryRef.current[symbol] || [];
    
    // Gradient Sparkline with area fill
    if (history.length < 2) {
      const merged = getMergedData(symbol);
      const change = Number(merged.price_change_pct || 0);
      const isUp = change >= 0;
      const color = isUp ? "#10b981" : "#f43f5e";
      const strokeColor = isUp ? "#34d399" : "#fb7185";
      const path = isUp ? "M 5,20 Q 25,12 45,18 T 85,5" : "M 5,5 Q 25,18 45,12 T 85,20";
      const areaPath = `${path} L 85,25 L 5,25 Z`;

      return createElement(
        "svg",
        { className: "watchlistPage__sparklineSvg", viewBox: "0 0 90 25", preserveAspectRatio: "none", style: { display: "block", width: "100%", height: "30px" } },
        createElement(
          "defs",
          null,
          createElement(
            "linearGradient",
            { id: `grad-${symbol}`, x1: "0", x2: "0", y1: "0", y2: "1" },
            createElement("stop", { offset: "0%", stopColor: color, stopOpacity: 0.4 }),
            createElement("stop", { offset: "100%", stopColor: color, stopOpacity: 0.0 })
          )
        ),
        createElement("path", { d: areaPath, fill: `url(#grad-${symbol})` }),
        createElement("path", { className: "fill-none stroke-[1.5]", d: path, stroke: strokeColor })
      );
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;

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
      { className: "watchlistPage__sparklineSvg", viewBox: "0 0 90 25", preserveAspectRatio: "none", style: { display: "block", width: "100%", height: "30px" } },
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
    };
    const handleTrade = (ev: MouseEvent) => {
      ev.stopPropagation();
      window.location.href = `/stocks/${symbol}`;
    };
    const handleRemove = (ev: MouseEvent) => {
      ev.stopPropagation();
      if (selectedId) removeSymbol(selectedId, symbol);
    };

    return createElement(
      "div",
      { className: "watchlistPage__rowActions" },
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--chart",
        title: t("watchlist.table.view_chart", { defaultValue: "Bi\u1EBFu \u0111\u1ED3" }),
        onClick: handleChart
      }, "\uD83D\uDCCA"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--alert",
        title: t("watchlist.table.set_alert", { defaultValue: "T\u1EA1o c\u1EA3nh b\u00E1o gi\u00E1" }),
        onClick: handleAlert
      }, "\u26A0\uFE0F"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--trade",
        title: t("watchlist.table.view_detail", { defaultValue: "Xem chi ti\u1EBFt" }),
        onClick: handleTrade
      }, "\uD83D\uDCC8"),
      createElement("button", {
        className: "watchlistPage__rowActionBtn watchlistPage__rowActionBtn--remove",
        title: t("watchlist.table.delete", { defaultValue: "X\u00F3a" }),
        onClick: handleRemove
      }, "\u2715")
    );
  };

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

    if (selectedType === "holds") {
      return createElement(
        "tr",
        null,
        createElement("th", { style: thStyle }, t("watchlist.table.symbol", { defaultValue: "Mã" })),
        createElement("th", { style: thStyle }, t("watchlist.table.price", { defaultValue: "Giá hiện tại" })),
        createElement("th", { style: thStyle }, t("watchlist.table.change", { defaultValue: "% Thay đổi" })),
        createElement("th", { style: { ...thStyle, textAlign: "right" } }, t("watchlist.table.quantity", { defaultValue: "Số lượng" })),
        createElement("th", { style: { ...thStyle, textAlign: "right" } }, t("watchlist.table.avg_cost", { defaultValue: "Giá vốn TB" })),
        createElement("th", { style: { ...thStyle, textAlign: "right" } }, t("watchlist.table.market_value", { defaultValue: "Giá trị TT" })),
        createElement("th", { style: { ...thStyle, textAlign: "right" } }, t("watchlist.table.pnl", { defaultValue: "Lãi / Lỗ" })),
        createElement("th", { style: { ...thStyle, textAlign: "right" } }, t("watchlist.table.pnl_pct", { defaultValue: "% Lãi / Lỗ" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "90px" } }, t("watchlist.table.quick_action", { defaultValue: "Hành động" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "100px" } }, t("watchlist.table.trend", { defaultValue: "Xu hướng" }))
      );
    } else if (selectedType === "tracked") {
      return createElement(
        "tr",
        null,
        createElement("th", { style: thStyle }, t("watchlist.table.symbol", { defaultValue: "Mã" })),
        createElement("th", { style: thStyle }, t("watchlist.table.company_name", { defaultValue: "Tên doanh nghiệp" })),
        createElement("th", { style: thStyle }, t("watchlist.table.price", { defaultValue: "Giá hiện tại" })),
        createElement("th", { style: thStyle }, t("watchlist.table.change", { defaultValue: "% Thay đổi" })),
        createElement("th", { style: { ...thStyle, textAlign: "right", paddingRight: "32px" } }, t("watchlist.table.limit", { defaultValue: "Ngưỡng giám sát" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "90px" } }, t("watchlist.table.quick_action", { defaultValue: "Hành động" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "100px" } }, t("watchlist.table.trend", { defaultValue: "Xu hướng" }))
      );
    } else if (selectedType === "watchlist") {
      return createElement(
        "tr",
        null,
        createElement("th", { style: thStyle }, t("watchlist.table.symbol", { defaultValue: "Mã" })),
        createElement("th", { style: thStyle }, t("watchlist.table.price", { defaultValue: "Giá hiện tại" })),
        createElement("th", { style: thStyle }, t("watchlist.table.change", { defaultValue: "% Thay đổi" })),
        visibleColumns.rsi && createElement("th", { style: thStyle }, t("watchlist.column.rsi", { defaultValue: "RSI(14)" })),
        visibleColumns.rvol && createElement("th", { style: thStyle }, t("watchlist.column.rvol", { defaultValue: "RVOL" })),
        visibleColumns.ma20Dist && createElement("th", { style: thStyle }, t("watchlist.column.ma20_dist", { defaultValue: "% Cách MA20" })),
        visibleColumns.bias && createElement("th", { style: thStyle }, t("watchlist.column.bias", { defaultValue: "Định hướng" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "90px" } }, t("watchlist.table.quick_action", { defaultValue: "Hành động" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "100px" } }, t("watchlist.table.trend", { defaultValue: "Xu hướng" }))
      );
    } else {
      return createElement(
        "tr",
        null,
        createElement("th", { style: thStyle }, t("watchlist.table.symbol", { defaultValue: "Mã" })),
        createElement("th", { style: thStyle }, t("watchlist.table.company_name", { defaultValue: "Tên doanh nghiệp" })),
        createElement("th", { style: thStyle }, t("watchlist.table.price", { defaultValue: "Giá hiện tại" })),
        createElement("th", { style: thStyle }, t("watchlist.table.change", { defaultValue: "% Thay đổi" })),
        createElement("th", { style: thStyle }, t("watchlist.column.rsi", { defaultValue: "RSI(14)" })),
        createElement("th", { style: thStyle }, t("watchlist.column.rvol", { defaultValue: "RVOL" })),
        createElement("th", { style: { ...thStyle, textAlign: "center" } }, t("watchlist.table.quick_action", { defaultValue: "Hành động nhanh" })),
        createElement("th", { style: { ...thStyle, textAlign: "center", width: "100px" } }, t("watchlist.table.trend", { defaultValue: "Xu hướng" }))
      );
    }
  };

  const handleRowClick = (symbol: string) => {
    setActiveSymbolDetail(symbol === activeSymbolDetail ? null : symbol);
  };

  const renderTableBody = () => {
    const tdPadding = density === "compact" ? "6px 12px" : "12px 16px";

    return activeItems.map(item => {
      const symbol = (item as WatchlistItem).symbol;
      const merged = getMergedData(symbol);
      const changePct = Number(merged.price_change_pct || 0);
      const isUp = changePct > 0;
      const isDown = changePct < 0;

      const flashState = priceFlashMap[symbol];
      const flashClass = flashState ? `watchlistPage__priceCell--${flashState}` : "";
      
      const isActiveRow = symbol === activeSymbolDetail;
      const rowStyle = {
        background: isActiveRow ? "rgba(0, 180, 216, 0.08)" : "transparent",
        borderLeft: isActiveRow ? "2px solid var(--accent-cyan, #22d3ee)" : "2px solid transparent",
        borderBottom: "1px solid rgba(80, 120, 168, 0.15)",
        cursor: "pointer",
        transition: "all 0.15s ease"
      };
      const rowClass = `hover:bg-slate-800/20${isActiveRow ? " watchlistPage__row--active" : ""}`;

      if (selectedType === "holds") {
        const h = item as Holding;
        const qty = Number(h.quantity || 0);
        const avgCost = Number(h.avg_cost || 0);
        const marketValue = Number(h.market_value || 0);
        const pnl = Number(h.unrealized_pnl || 0);
        const pnlPct = Number(h.unrealized_pnl_pct || 0);

        return createElement(
          "tr",
          { key: symbol, style: rowStyle, onClick: () => handleRowClick(symbol), className: rowClass },
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", fontWeight: 700, color: isActiveRow ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" } },
            symbol
          ),
          createElement(
            "td",
            { 
              className: `watchlistPage__priceCell ${flashClass}`, 
              style: { 
                padding: tdPadding, 
                fontFamily: "monospace", 
                fontWeight: 600, 
                color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-primary, #f1f5f9)" 
              } 
            },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-muted, #94a3b8)" } },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          createElement("td", { style: { padding: tdPadding, fontFamily: "monospace", textAlign: "right", color: "var(--text-primary, #f1f5f9)" } }, qty.toLocaleString()),
          createElement("td", { style: { padding: tdPadding, fontFamily: "monospace", textAlign: "right", color: "var(--text-primary, #f1f5f9)" } }, Math.round(avgCost).toLocaleString()),
          createElement("td", { style: { padding: tdPadding, fontFamily: "monospace", textAlign: "right", color: "var(--text-primary, #f1f5f9)" } }, Math.round(marketValue).toLocaleString()),
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", textAlign: "right", color: pnl > 0 ? "#10b981" : pnl < 0 ? "#f43f5e" : "var(--text-muted, #94a3b8)" } },
            pnl !== 0 ? `${pnl > 0 ? "+" : ""}${Math.round(pnl).toLocaleString()}` : "0"
          ),
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", textAlign: "right", color: pnlPct > 0 ? "#10b981" : pnlPct < 0 ? "#f43f5e" : "var(--text-muted, #94a3b8)" } },
            pnlPct !== 0 ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "0.00%"
          ),
          createElement(
            "td",
            { style: { padding: tdPadding, textAlign: "center" } },
            renderActions(symbol)
          ),
          createElement(
            "td",
            { style: { padding: "4px", textAlign: "center", verticalAlign: "middle" } },
            renderSparkline(symbol)
          )
        );

      } else if (selectedType === "watchlist") {
        const rsiValue = merged.rsi_14 !== undefined && merged.rsi_14 !== null ? Number(merged.rsi_14).toFixed(1) : "—";
        const rvolValue = merged.rvol !== undefined && merged.rvol !== null ? Number(merged.rvol).toFixed(2) : "—";
        const ma20Dist = merged.ma20_distance_pct !== undefined && merged.ma20_distance_pct !== null ? `${Number(merged.ma20_distance_pct).toFixed(1)}%` : "—";

        return createElement(
          "tr",
          { key: symbol, style: rowStyle, onClick: () => handleRowClick(symbol), className: rowClass },
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", fontWeight: 700, color: isActiveRow ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" } },
            symbol
          ),
          createElement(
            "td",
            { 
              className: `watchlistPage__priceCell ${flashClass}`, 
              style: { 
                padding: tdPadding, 
                fontFamily: "monospace", 
                fontWeight: 600, 
                color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-primary, #f1f5f9)" 
              } 
            },
            merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
          ),
          createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-muted, #94a3b8)" } },
            changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
          ),
          visibleColumns.rsi && createElement("td", { style: { padding: tdPadding, fontFamily: "monospace", color: "var(--text-primary, #f1f5f9)" } }, rsiValue),
          visibleColumns.rvol && createElement("td", { style: { padding: tdPadding, fontFamily: "monospace", color: "var(--text-primary, #f1f5f9)" } }, rvolValue),
          visibleColumns.ma20Dist && createElement(
            "td",
            { style: { padding: tdPadding, fontFamily: "monospace", color: Number(merged.ma20_distance_pct) >= 0 ? "#10b981" : "#f43f5e" } },
            ma20Dist
          ),
          visibleColumns.bias && createElement(
            "td",
            { style: { padding: tdPadding, fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" } },
            merged.bias_label || t("watchlist.table.neutral", { defaultValue: "Trung tính" })
          ),
          createElement(
            "td",
            { style: { padding: tdPadding, textAlign: "center" } },
            renderActions(symbol)
          ),
          createElement(
            "td",
            { style: { padding: "4px", textAlign: "center", verticalAlign: "middle" } },
            renderSparkline(symbol)
          )
        );
      }
      
      // Fallback for group and tracked
      return createElement(
        "tr",
        { key: symbol, style: rowStyle, onClick: () => handleRowClick(symbol), className: rowClass },
        createElement(
          "td",
          { style: { padding: tdPadding, fontFamily: "monospace", fontWeight: 700, color: isActiveRow ? "var(--accent-cyan, #22d3ee)" : "var(--text-primary, #f1f5f9)" } },
          symbol
        ),
        createElement(
          "td",
          { style: { padding: tdPadding } },
          createElement(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            createElement("span", { style: { fontWeight: 700, color: "var(--text-primary, #f1f5f9)", fontSize: "0.85rem" } }, merged.company_name || (item as any).company_name || "—"),
            createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" } }, merged.industry || (item as any).industry || "—")
          )
        ),
        createElement(
          "td",
          { 
            className: `watchlistPage__priceCell ${flashClass}`, 
            style: { 
              padding: tdPadding, 
              fontFamily: "monospace", 
              fontWeight: 600, 
              color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-primary, #f1f5f9)" 
            } 
          },
          merged.price !== undefined ? Number(merged.price).toLocaleString() : "—"
        ),
        createElement(
          "td",
          { style: { padding: tdPadding, fontFamily: "monospace", color: isUp ? "#10b981" : isDown ? "#f43f5e" : "var(--text-muted, #94a3b8)" } },
          changePct !== 0 ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%` : "0.00%"
        ),
        createElement(
          "td",
          { 
            style: { padding: tdPadding, color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }, 
            colSpan: selectedType === "tracked" ? 1 : 2 
          },
          "—"
        ),
        createElement(
          "td",
          { style: { padding: tdPadding, textAlign: "center" } },
          renderActions(symbol)
        ),
        createElement(
          "td",
          { style: { padding: "4px", textAlign: "center", verticalAlign: "middle" } },
          renderSparkline(symbol)
        )
      );
    });
  };

  return createElement(
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
        style: { width: "100%", borderCollapse: "collapse", textAlign: "left" }
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
    )
  );
}
