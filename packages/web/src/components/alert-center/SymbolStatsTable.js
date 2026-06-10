import React from "react";

const { createElement } = React;
const e = createElement;

export function SymbolStatsTable({ paginatedSymbols, searchTermModule2, setSearchTermModule2, formatAlertValue }) {
  return e("div", { className: "core-dashboard-panel" }, [
    e("h2", { key: "title", className: "core-section-title", style: { borderLeftColor: "var(--neon-green)" } }, "THỐNG KÊ THEO MÃ CỔ PHIẾU"),
    
    // Search in stats panel
    e("div", { key: "search-box", className: "core-symbol-stats-search" }, [
      e("input", {
        type: "text",
        value: searchTermModule2,
        maxLength: 10,
        placeholder: "Tìm nhanh mã (ví dụ: VNM)...",
        onChange: (event) => setSearchTermModule2(event.target.value.toUpperCase()),
      }),
    ]),

    e("div", { key: "table-container", className: "core-scrollable-container" }, [
      paginatedSymbols.length === 0
        ? e("p", { key: "empty", className: "core-empty", style: { padding: "20px" } }, "Không có mã thống kê phù hợp.")
        : e("table", { key: "table", className: "core-symbol-stats-table" }, [
            e("thead", { key: "thead" }, e("tr", null, [
              e("th", null, "Mã CP"),
              e("th", null, "Số Alert"),
              e("th", null, "Mua / Bán"),
              e("th", null, "Tần Suất"),
              e("th", null, "Tổng Giá Trị"),
            ])),
            e("tbody", { key: "tbody" }, paginatedSymbols.map((item) => {
              const buyPercent = item.count > 0 ? (item.buyCount / item.count) * 100 : 0;
              const sellPercent = item.count > 0 ? (item.sellCount / item.count) * 100 : 0;
              const neutralPercent = item.count > 0 ? (item.neutralCount / item.count) * 100 : 0;
              
              let freqClass = "freq-low";
              if (item.freq === "Bùng nổ") freqClass = "freq-explosive";
              else if (item.freq === "Cao") freqClass = "freq-high";
              else if (item.freq === "Trung bình") freqClass = "freq-medium";

              return e("tr", { key: item.symbol, className: "core-symbol-stats-row" }, [
                // Ticker badge with link
                e("td", null, 
                  e("a", { 
                    href: `/stocks/${item.symbol}`, 
                    className: "core-stats-symbol-badge",
                    title: "Mở Stock workspace chi tiết cho mã này"
                  }, [
                    item.symbol,
                    e("svg", {
                      width: "8",
                      height: "8",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "3"
                    }, [
                      e("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" })
                    ])
                  ])
                ),
                // Count of occurrences
                e("td", { style: { fontWeight: "800", fontFamily: "monospace", fontSize: "0.9rem" } }, `${item.count} lần`),
                // Buy/Sell strength bar
                e("td", null, 
                  e("div", { className: "core-stats-strength-container" }, [
                    e("div", { className: "core-stats-strength-bar" }, [
                      buyPercent > 0 ? e("div", { className: "core-stats-strength-buy", style: { width: `${buyPercent}%` }, title: `Mua: ${item.buyCount} lần` }) : null,
                      sellPercent > 0 ? e("div", { className: "core-stats-strength-sell", style: { width: `${sellPercent}%` }, title: `Bán: ${item.sellCount} lần` }) : null,
                      neutralPercent > 0 ? e("div", { className: "core-stats-strength-neutral", style: { width: `${neutralPercent}%` }, title: `Khác: ${item.neutralCount} lần` }) : null,
                    ]),
                    e("div", { className: "core-stats-strength-text" }, [
                      e("span", { className: "direction-buy" }, `B:${item.buyCount}`),
                      e("span", { className: "direction-sell" }, `S:${item.sellCount}`),
                    ])
                  ])
                ),
                // Frequency level
                e("td", null, 
                  e("span", { className: `core-stats-frequency-badge ${freqClass}` }, item.freq)
                ),
                // Matched Value
                e("td", { style: { fontFamily: "monospace", color: "var(--neon-blue)", fontWeight: "600" } }, 
                  `${formatAlertValue(item.totalValue)}`
                ),
              ]);
            }))
          ])
    ])
  ]);
}
