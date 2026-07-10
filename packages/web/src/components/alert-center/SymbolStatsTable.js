import React from "react";
const styles = {
  dashboardPanel: "core-dashboard-panel",
  sectionTitle: "core-section-title",
  symbolStatsSearch: "core-symbol-stats-search",
  searchInput: "searchInput",
  scrollableContainer: "core-scrollable-container",
  emptyState: "core-empty",
  symbolStatsTable: "core-symbol-stats-table",
  symbolStatsRow: "core-symbol-stats-row",
  statsSymbolBadge: "core-stats-symbol-badge",
  countCell: "count-cell",
  strengthContainer: "core-stats-strength-container",
  strengthBar: "core-stats-strength-bar",
  strengthBuy: "core-stats-strength-buy",
  strengthSell: "core-stats-strength-sell",
  strengthNeutral: "core-stats-strength-neutral",
  strengthText: "core-stats-strength-text",
  directionBuy: "direction-buy",
  directionSell: "direction-sell",
  frequencyBadge: "core-stats-frequency-badge",
  freqExplosive: "freq-explosive",
  freqHigh: "freq-high",
  freqMedium: "freq-medium",
  freqLow: "freq-low",
  valueCell: "value-cell"
};

const { createElement } = React;
const e = createElement;

export function SymbolStatsTable({ paginatedSymbols, searchTermModule2, setSearchTermModule2, formatAlertValue }) {
  return e("div", { className: styles.dashboardPanel }, [
    e("h2", { key: "title", className: styles.sectionTitle }, "THỐNG KÊ THEO MÃ CỔ PHIẾU"),
    
    // Search in stats panel
    e("div", { key: "search-box", className: styles.symbolStatsSearch }, [
      e("input", {
        type: "text",
        value: searchTermModule2,
        maxLength: 10,
        placeholder: "Tìm nhanh mã (ví dụ: VNM)...",
        onChange: (event) => setSearchTermModule2(event.target.value.toUpperCase()),
        className: styles.searchInput,
      }),
    ]),

    e("div", { key: "table-container", className: styles.scrollableContainer }, [
      paginatedSymbols.length === 0
        ? e("p", { key: "empty", className: styles.emptyState }, "Không có mã thống kê phù hợp.")
        : e("table", { key: "table", className: styles.symbolStatsTable }, [
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
              
              let freqClass = styles.freqLow;
              if (item.freq === "Bùng nổ") freqClass = styles.freqExplosive;
              else if (item.freq === "Cao") freqClass = styles.freqHigh;
              else if (item.freq === "Trung bình") freqClass = styles.freqMedium;

              return e("tr", { key: item.symbol, className: styles.symbolStatsRow }, [
                // Ticker badge with link
                e("td", null, 
                  e("a", { 
                    href: `/stocks/${item.symbol}`, 
                    className: styles.statsSymbolBadge,
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
                e("td", { className: styles.countCell }, `${item.count} lần`),
                // Buy/Sell strength bar
                e("td", null, 
                  e("div", { className: styles.strengthContainer }, [
                    e("div", { className: styles.strengthBar }, [
                      buyPercent > 0 ? e("div", { className: styles.strengthBuy, style: { width: `${buyPercent}%` }, title: `Mua: ${item.buyCount} lần` }) : null,
                      sellPercent > 0 ? e("div", { className: styles.strengthSell, style: { width: `${sellPercent}%` }, title: `Bán: ${item.sellCount} lần` }) : null,
                      neutralPercent > 0 ? e("div", { className: styles.strengthNeutral, style: { width: `${neutralPercent}%` }, title: `Khác: ${item.neutralCount} lần` }) : null,
                    ]),
                    e("div", { className: styles.strengthText }, [
                      e("span", { className: styles.directionBuy }, `B:${item.buyCount}`),
                      e("span", { className: styles.directionSell }, `S:${item.sellCount}`),
                    ])
                  ])
                ),
                // Frequency level
                e("td", null, 
                  e("span", { className: `${styles.frequencyBadge} ${freqClass}` }, item.freq)
                ),
                // Matched Value
                e("td", { className: styles.valueCell }, 
                  `${formatAlertValue(item.totalValue)}`
                ),
              ]);
            }))
          ])
    ])
  ]);
}
