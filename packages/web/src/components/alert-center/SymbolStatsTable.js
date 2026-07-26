import React from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "../../pages/AlertCenterPage.module.css";
import soc from "../../components/soc/soc.module.css";

const { createElement } = React;
const e = createElement;

const FREQ_KEY_MAP = {
  "Bùng nổ": "alertCenter.freqExplosive",
  "Cao": "alertCenter.freqHigh",
  "Trung bình": "alertCenter.freqMedium",
  "Thấp": "alertCenter.freqLow",
};

const FREQ_CLASS = {
  "Bùng nổ": styles.acFreqExplosive,
  "Cao": styles.acFreqHigh,
  "Trung bình": styles.acFreqMedium,
  "Thấp": styles.acFreqLow,
};

export function SymbolStatsTable({ paginatedSymbols, searchTermModule2, setSearchTermModule2, formatAlertValue }) {
  const { t } = useI18n();
  return e("div", { className: `${soc.panel}` }, [
    e("div", { key: "header", className: `${soc.panelHeader} ${styles.acStatsHeader}` }, [
      e("h2", { key: "title", className: soc.panelTitle }, t("alertCenter.statsTitle")),
    ]),

    e("div", { key: "search-box", className: soc.searchWrapper }, [
      e("span", { className: soc.searchIcon }, "⌕"),
      e("input", {
        type: "text",
        value: searchTermModule2,
        maxLength: 10,
        placeholder: t("alertCenter.statsSearch"),
        onChange: (event) => setSearchTermModule2(event.target.value.toUpperCase()),
        className: soc.searchInputWithIcon,
      }),
    ]),

    e("div", { key: "table-container", className: styles.acScrollable }, [
      paginatedSymbols.length === 0
        ? e("p", { key: "empty", className: `${soc.emptyState}` }, t("alertCenter.statsEmpty"))
        : e("table", { key: "table", className: soc.coverageTable }, [
            e("thead", { key: "thead" }, e("tr", null, [
              e("th", { key: "sym" }, t("alertCenter.colSymbol")),
              e("th", { key: "cnt" }, t("alertCenter.colCount")),
              e("th", { key: "bs" }, t("alertCenter.colBuySell")),
              e("th", { key: "freq" }, t("alertCenter.colFreq")),
              e("th", { key: "val" }, t("alertCenter.colValue")),
            ])),
            e("tbody", { key: "tbody" }, paginatedSymbols.map((item) => {
              const buyPercent = item.count > 0 ? (item.buyCount / item.count) * 100 : 0;
              const sellPercent = item.count > 0 ? (item.sellCount / item.count) * 100 : 0;
              const neutralPercent = item.count > 0 ? (item.neutralCount / item.count) * 100 : 0;

              const freqClass = FREQ_CLASS[item.freq] || styles.acFreqLow;

              return e("tr", { key: item.symbol, className: styles.acStatsRow }, [
                e("td", { key: "sym" },
                  e("a", {
                    href: `/stocks/${item.symbol}`,
                    className: `${soc.statusBadge} ${styles.acStatsSymbolBadge}`,
                    title: t("alertCenter.openStockWorkspace", { symbol: item.symbol }),
                  }, [
                    item.symbol,
                    e("svg", {
                      key: "ico",
                      width: "8", height: "8", viewBox: "0 0 24 24", fill: "none",
                      stroke: "currentColor", strokeWidth: "3",
                    }, e("path", { key: "p", d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" })),
                  ])
                ),
                e("td", { key: "cnt", className: styles.acCountCell }, t("alertCenter.times", { count: item.count })),
                e("td", { key: "bs" },
                  e("div", { className: styles.acStrengthContainer }, [
                    e("div", { className: styles.acStrengthBar }, [
                      buyPercent > 0 ? e("div", { className: styles.acStrengthBuy, style: { width: `${buyPercent}%` }, title: `${t("alertCenter.labelBuy")}: ${item.buyCount} ${t("alertCenter.timesShort")}` }) : null,
                      sellPercent > 0 ? e("div", { className: styles.acStrengthSell, style: { width: `${sellPercent}%` }, title: `${t("alertCenter.labelSell")}: ${item.sellCount} ${t("alertCenter.timesShort")}` }) : null,
                      neutralPercent > 0 ? e("div", { className: styles.acStrengthNeutral, style: { width: `${neutralPercent}%` }, title: `${t("alertCenter.labelOther")}: ${item.neutralCount} ${t("alertCenter.timesShort")}` }) : null,
                    ]),
                    e("div", { className: styles.acStrengthText }, [
                      e("span", { className: styles.acDirectionBuy }, `${t("alertCenter.buyShort")}:${item.buyCount}`),
                      e("span", { className: styles.acDirectionSell }, `${t("alertCenter.sellShort")}:${item.sellCount}`),
                    ]),
                  ])
                ),
                e("td", { key: "freq" },
                  e("span", { className: `${styles.acFrequencyBadge} ${freqClass}` }, t(FREQ_KEY_MAP[item.freq] || "alertCenter.freqLow"))
                ),
                e("td", { key: "val", className: styles.acValueCell }, `${formatAlertValue(item.totalValue)}`),
              ]);
            })),
          ]),
    ]),
  ]);
}
