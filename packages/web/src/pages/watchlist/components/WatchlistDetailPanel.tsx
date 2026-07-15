import { createElement, useEffect, useCallback } from "react";
import { useWatchlist } from "./WatchlistContext";
import { VNInvestCharts } from "../../../components/vninvestcharts/src/widget/VNInvestCharts.js";

const Chart = VNInvestCharts as any;

export function WatchlistDetailPanel() {
  const { activeSymbolDetail, setActiveSymbolDetail } = useWatchlist();

  const handleClose = useCallback(() => {
    setActiveSymbolDetail(null);
  }, [setActiveSymbolDetail]);

  useEffect(() => {
    if (!activeSymbolDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSymbolDetail, handleClose]);

  if (!activeSymbolDetail) return null;

  return createElement(
    "div",
    { className: "watchlistPage__slideOverOverlay", onClick: handleClose },
    createElement(
      "div",
      {
        className: "watchlistPage__slideOver",
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      },
      // Header
      createElement(
        "div",
        { className: "watchlistPage__slideOverHeader" },
        createElement(
          "h2",
          { className: "watchlistPage__slideOverTitle" },
          activeSymbolDetail,
          createElement(
            "span",
            { className: "watchlistPage__slideOverBadge" },
            "Realtime"
          )
        ),
        createElement(
          "button",
          { className: "watchlistPage__slideOverClose", onClick: handleClose },
          "\u2715"
        )
      ),

      // Chart
      createElement(
        "div",
        { className: "watchlistPage__slideOverChart" },
        createElement(Chart, {
          symbol: activeSymbolDetail,
          theme: "dark",
          hideToolbar: true,
          hideFooter: true
        })
      ),

      // AI Advisor
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection watchlistPage__slideOverSection--ai" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83E\uDDE0 AI Advisor"
        ),
        createElement(
          "p",
          { className: "watchlistPage__slideOverSectionText" },
          createElement("strong", null, "Nh\u1EADn \u0111\u1ECBnh nhanh:"),
          ` D\u00F4ng ti\u1EC1n hi\u1EC7n t\u1EA1i v\u00E0o m\u00E3 ${activeSymbolDetail} \u0111ang duy tr\u00EC s\u1EE9c m\u1EA1nh. MACD Histogram m\u1EDF r\u1ED9ng cho th\u1EA5y xu h\u01B0\u1EDBng Bullish trong ng\u1EAFn h\u1EA1n.`
        )
      ),

      // Whale Flow
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83D\uDC0B Whale Order Flow"
        ),
        createElement(
          "ul",
          { className: "watchlistPage__slideOverFlowList" },
          createElement(
            "li",
            { className: "watchlistPage__slideOverFlowItem" },
            createElement("span", { className: "watchlistPage__slideOverFlowTime" }, "14:28:10"),
            createElement("span", { className: "watchlistPage__slideOverFlowBuy" }, "MUA 150,000")
          ),
          createElement(
            "li",
            { className: "watchlistPage__slideOverFlowItem" },
            createElement("span", { className: "watchlistPage__slideOverFlowTime" }, "14:15:05"),
            createElement("span", { className: "watchlistPage__slideOverFlowSell" }, "B\u00C1N 80,000")
          ),
          createElement(
            "li",
            { className: "watchlistPage__slideOverFlowItem" },
            createElement("span", { className: "watchlistPage__slideOverFlowTime" }, "13:50:22"),
            createElement("span", { className: "watchlistPage__slideOverFlowBuy" }, "MUA 220,000")
          )
        )
      ),

      // News
      createElement(
        "div",
        { className: "watchlistPage__slideOverSection watchlistPage__slideOverSection--news" },
        createElement(
          "h3",
          { className: "watchlistPage__slideOverSectionTitle" },
          "\uD83D\uDCF0 Tin t\u1EE9c li\u00EAn quan"
        ),
        createElement(
          "div",
          { className: "watchlistPage__slideOverNewsList" },
          createElement(
            "article",
            { className: "watchlistPage__slideOverNewsItem" },
            createElement(
              "a",
              { href: "#", className: "watchlistPage__slideOverNewsLink" },
              `Kh\u1ED1i ngo\u1EA1i mua r\u00F2ng ${activeSymbolDetail} phi\u00EAn th\u1EE9 3 li\u00EAn ti\u1EBFp.`
            ),
            createElement(
              "span",
              { className: "watchlistPage__slideOverNewsMeta" },
              "15 ph\u00FAt tr\u01B0\u1EDBc - CafeF"
            )
          ),
          createElement(
            "article",
            { className: "watchlistPage__slideOverNewsItem" },
            createElement(
              "a",
              { href: "#", className: "watchlistPage__slideOverNewsLink" },
              `Ph\u00E2n t\u00EDch k\u1EF9 thu\u1EADt ${activeSymbolDetail}: V\u01B0\u1EE3t c\u1EADn ch\u00E9o trung h\u1EA1n.`
            ),
            createElement(
              "span",
              { className: "watchlistPage__slideOverNewsMeta" },
              "2 gi\u1EDD tr\u01B0\u1EDBc - FireAnt"
            )
          )
        )
      )
    )
  );
}
