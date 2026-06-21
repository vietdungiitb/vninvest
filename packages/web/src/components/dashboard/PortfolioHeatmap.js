/**
 * PortfolioHeatmap — DM-08
 * Treemap/Sunburst visualization for portfolio holdings.
 * Uses createElement (no JSX) per packages/web convention.
 */
import { createElement, useState, useMemo, useRef, useEffect } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { TreemapChart, SunburstChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { useEChartsResize } from "../../hooks/useChartResize.js";

echarts.use([TreemapChart, SunburstChart, CanvasRenderer]);

const e = createElement;

const I18N = {
  vi: {
    "heatmap.title": "Bản đồ danh mục",
    "heatmap.treemap": "Treemap",
    "heatmap.sunburst": "Sunburst",
    "heatmap.sizeCap": "Vốn hóa",
    "heatmap.sizeWeight": "Tỷ trọng",
    "heatmap.empty": "Chưa có dữ liệu để hiển thị heatmap.",
  },
  en: {
    "heatmap.title": "Portfolio Heatmap",
    "heatmap.treemap": "Treemap",
    "heatmap.sunburst": "Sunburst",
    "heatmap.sizeCap": "Market Cap",
    "heatmap.sizeWeight": "Weight",
    "heatmap.empty": "No data available for heatmap.",
  },
};

function resolveLocale() {
  const browserLang = (typeof document !== "undefined" && document.documentElement?.lang) ||
    (typeof navigator !== "undefined" ? navigator.language : "") || "vi";
  return String(browserLang).toLowerCase().startsWith("en") ? "en" : "vi";
}

function createTranslator(locale = "vi") {
  const lang = locale === "en" ? "en" : "vi";
  const dict = I18N[lang];
  return (key) => dict[key] || I18N.vi[key] || key;
}

const HEAT_COLORS = {
  upStrong: "#00FFBB",
  upSoft: "#00CC99",
  downStrong: "#FF3344",
  downSoft: "#FF6677",
  neutral: "#FFD200",
};

function getHeatColor(changePct) {
  if (changePct > 3) return HEAT_COLORS.upStrong;
  if (changePct > 0) return HEAT_COLORS.upSoft;
  if (changePct < -3) return HEAT_COLORS.downStrong;
  if (changePct < 0) return HEAT_COLORS.downSoft;
  return HEAT_COLORS.neutral;
}

export function PortfolioHeatmap({
  holdings = [],
  quotesBySymbol = {},
  technicals = {},
  analytics,
  loading = false,
  selectedSession,
  onSelectSession,
  selectedSymbol,
  onSelectSymbol,
  className = "",
}) {
  const t = createTranslator(resolveLocale());
  const [viewMode, setViewMode] = useState("treemap");
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  // Use ResizeObserver to handle sidebar collapse/expand
  useEChartsResize(chartRef, containerRef, [viewMode, holdings.length]);

  const chartData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    return holdings.map((h) => {
      const symbol = h?.symbol || "";
      const quote = quotesBySymbol?.[symbol] || {};
      const changePct = Number(quote?.change_pct || 0);
      const currentPrice = Number(quote?.current_price || h?.current_price || 0);
      const quantity = Number(h?.quantity || 0);
      const marketValue = currentPrice * quantity;

      return {
        name: symbol,
        value: Math.max(marketValue, 1),
        changePct,
        color: getHeatColor(changePct),
        currentPrice,
        quantity,
      };
    });
  }, [holdings, quotesBySymbol]);

  const option = useMemo(() => {
    if (chartData.length === 0) return {};

    if (viewMode === "treemap") {
      return {
        tooltip: {
          formatter: (info) => {
            const { name, value, data } = info;
            return `<b>${name}</b><br/>Giá trị: ${Number(value).toLocaleString("vi-VN")}<br/>Biến động: ${Number(data?.changePct || 0).toFixed(2)}%`;
          },
        },
        series: [
          {
            type: "treemap",
            width: "100%",
            height: "100%",
            data: chartData,
            itemStyle: {
              borderColor: "#0f172a",
              borderWidth: 2,
              gapWidth: 2,
            },
            levels: [
              { itemStyle: { borderWidth: 0, gapWidth: 4 } },
              { itemStyle: { borderColor: "rgba(15, 23, 42, 0.55)", borderWidth: 1.5, gapWidth: 1.5 } },
            ],
            label: {
              show: true,
              formatter: (params) => params.name,
              fontSize: 12,
              color: "#fff",
            },
            breadcrumb: { show: false },
          },
        ],
      };
    }

    return {
      tooltip: {
        formatter: (info) => {
          const { name, value, data } = info;
          return `<b>${name}</b><br/>Giá trị: ${Number(value).toLocaleString("vi-VN")}<br/>Biến động: ${Number(data?.changePct || 0).toFixed(2)}%`;
        },
      },
      series: [
        {
          type: "sunburst",
          data: chartData,
          radius: [0, "90%"],
          itemStyle: {
            borderColor: "#0f172a",
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (params) => params.name,
            fontSize: 11,
            color: "#fff",
          },
        },
      ],
    };
  }, [chartData, viewMode]);

  const handleClick = (params) => {
    if (params?.name && onSelectSymbol) {
      onSelectSymbol(params.name);
    }
  };

  if (loading) {
    return e("div", { className: "core-heatmap-loading " + className }, e("p", null, "Đang tải heatmap..."));
  }

  if (chartData.length === 0) {
    return e("div", { className: "core-heatmap-empty " + className }, e("p", null, t("heatmap.empty")));
  }

  return e(
    "div",
    { ref: containerRef, className: "core-heatmap " + className },
    e(
      "div",
      { className: "core-heatmap-header flex items-center justify-between mb-2" },
      e("h3", { className: "text-sm font-bold text-slate-100" }, t("heatmap.title")),
      e(
        "div",
        { className: "flex gap-1" },
        e(
          "button",
          {
            onClick: () => setViewMode("treemap"),
            className: `px-2 py-1 rounded text-xs font-medium transition-all ${
              viewMode === "treemap" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
            }`,
          },
          t("heatmap.treemap")
        ),
        e(
          "button",
          {
            onClick: () => setViewMode("sunburst"),
            className: `px-2 py-1 rounded text-xs font-medium transition-all ${
              viewMode === "sunburst" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
            }`,
          },
          t("heatmap.sunburst")
        )
      )
    ),
    e(ReactEChartsCore, {
      echarts,
      option,
      style: { height: "400px", width: "100%" },
      onEvents: { click: handleClick },
      ref: chartRef,
    })
  );
}