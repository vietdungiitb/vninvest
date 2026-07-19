import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";

const { createElement } = React;
const e = createElement;

const FREQ_CLASS_MAP = {
  "Bùng nổ": "freqExplosive",
  "Cao": "freqHigh",
  "Trung bình": "freqMedium",
  "Thấp": "freqLow",
};

const FREQ_KEY_MAP = {
  "Bùng nổ": "alertCenter.freqExplosive",
  "Cao": "alertCenter.freqHigh",
  "Trung bình": "alertCenter.freqMedium",
  "Thấp": "alertCenter.freqLow",
};

export function SymbolStatsTable({ paginatedSymbols, searchTermModule2, setSearchTermModule2, formatAlertValue }) {
  const { t } = useI18n();
  return e("div", { className: styles.dashboardPanel }, [
    e("h2", { key: "title", className: styles.sectionTitle }, t("alertCenter.statsTitle")),
    
    // Search in stats panel
    e("div", { key: "search-box", className: styles.symbolStatsSearch }, [
      e("input", {
        type: "text",
        value: searchTermModule2,
        maxLength: 10,
        placeholder: t("alertCenter.statsSearch"),
        onChange: (event) => setSearchTermModule2(event.target.value.toUpperCase()),
        className: styles.searchInput,
      }),
    ]),

    e("div", { key: "table-container", className: styles.scrollableContainer }, [
      paginatedSymbols.length === 0
        ? e("p", { key: "empty", className: styles.emptyState }, t("alertCenter.statsEmpty"))
        : e("table", { key: "table", className: styles.symbolStatsTable }, [
            e("thead", { key: "thead" }, e("tr", null, [
              e("th", null, t("alertCenter.colSymbol")),
              e("th", null, t("alertCenter.colCount")),
              e("th", null, t("alertCenter.colBuySell")),
              e("th", null, t("alertCenter.colFreq")),
              e("th", null, t("alertCenter.colValue")),
            ])),
            e("tbody", { key: "tbody" }, paginatedSymbols.map((item) => {
              const buyPercent = item.count > 0 ? (item.buyCount / item.count) * 100 : 0;
              const sellPercent = item.count > 0 ? (item.sellCount / item.count) * 100 : 0;
              const neutralPercent = item.count > 0 ? (item.neutralCount / item.count) * 100 : 0;
              
              let freqClass = styles.freqLow;
              if (FREQ_CLASS_MAP[item.freq]) freqClass = styles[FREQ_CLASS_MAP[item.freq]];

              return e("tr", { key: item.symbol, className: styles.symbolStatsRow }, [
                // Ticker badge with link
                e("td", null, 
                  e("a", { 
                    href: `/stocks/${item.symbol}`, 
                    className: styles.statsSymbolBadge,
                    title: t("alertCenter.openStockWorkspace", { symbol: item.symbol })
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
                e("td", { className: styles.countCell }, t("alertCenter.times", { count: item.count })),
                // Buy/Sell strength bar
                e("td", null, 
                  e("div", { className: styles.strengthContainer }, [
                    e("div", { className: styles.strengthBar }, [
                      buyPercent > 0 ? e("div", { className: styles.strengthBuy, style: { width: `${buyPercent}%` }, title: `${t("alertCenter.labelBuy")}: ${item.buyCount} ${t("alertCenter.timesShort")}` }) : null,
                      sellPercent > 0 ? e("div", { className: styles.strengthSell, style: { width: `${sellPercent}%` }, title: `${t("alertCenter.labelSell")}: ${item.sellCount} ${t("alertCenter.timesShort")}` }) : null,
                      neutralPercent > 0 ? e("div", { className: styles.strengthNeutral, style: { width: `${neutralPercent}%` }, title: `${t("alertCenter.labelOther")}: ${item.neutralCount} ${t("alertCenter.timesShort")}` }) : null,
                    ]),
                    e("div", { className: styles.strengthText }, [
                      e("span", { className: styles.directionBuy }, `${t("alertCenter.buyShort")}:${item.buyCount}`),
                      e("span", { className: styles.directionSell }, `${t("alertCenter.sellShort")}:${item.sellCount}`),
                    ])
                  ])
                ),
                // Frequency level
                e("td", null, 
                  e("span", { className: `${styles.frequencyBadge} ${freqClass}` }, t(FREQ_KEY_MAP[item.freq] || "alertCenter.freqLow", item.freq))
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
