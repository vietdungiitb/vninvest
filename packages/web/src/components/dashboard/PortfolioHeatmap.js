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
import { RotateCw, Maximize2, Minimize2 } from "lucide-react";

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
    "heatmap.refresh": "Làm mới",
    "heatmap.expand": "Mở rộng",
    "heatmap.collapse": "Thu gọn",
  },
  en: {
    "heatmap.title": "Portfolio Heatmap",
    "heatmap.treemap": "Treemap",
    "heatmap.sunburst": "Sunburst",
    "heatmap.sizeCap": "Market Cap",
    "heatmap.sizeWeight": "Weight",
    "heatmap.empty": "No data available for heatmap.",
    "heatmap.refresh": "Refresh",
    "heatmap.expand": "Expand",
    "heatmap.collapse": "Collapse",
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

// Muted Professional Color Palette for Treemap
const HEAT_COLORS = {
  upStrong: "#10b981",   // emerald-500
  upSoft: "#34d399",     // emerald-400
  downStrong: "#ef4444", // red-500
  downSoft: "#f87171",   // red-400
  neutral: "#f59e0b",    // amber-500
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

    const darkTooltip = {
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(51, 65, 85, 0.8)",
      borderWidth: 1,
      borderRadius: 12,
      textStyle: {
        color: "#f1f5f9",
        fontSize: 12,
      },
      extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); padding: 12px 16px;",
    };

    if (viewMode === "treemap") {
      return {
        tooltip: {
          ...darkTooltip,
          formatter: (info) => {
            const { name, value, data } = info;
            return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị: ${Number(value).toLocaleString("vi-VN")}<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#34d399' : data?.changePct < 0 ? '#f87171' : '#f59e0b'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
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
        ...darkTooltip,
        formatter: (info) => {
          const { name, value, data } = info;
          return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị: ${Number(value).toLocaleString("vi-VN")}<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#34d399' : data?.changePct < 0 ? '#f87171' : '#f59e0b'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
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
    { ref: containerRef, className: "core-heatmap h-full flex flex-col " + className },
    e(
      "div",
      { className: "core-heatmap-header flex items-center justify-between mb-3" },
      e("h3", { className: "text-sm font-bold text-slate-100" }, t("heatmap.title")),
      e(
        "div",
        { className: "flex items-center gap-2" },
        e(
          "button",
          {
            onClick: () => setViewMode("treemap"),
            className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "treemap" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`,
            "aria-label": t("heatmap.treemap"),
          },
          e(Maximize2, { className: "h-3.5 w-3.5" }),
          e("span", { className: "hidden sm:inline" }, t("heatmap.treemap"))
        ),
        e(
          "button",
          {
            onClick: () => setViewMode("sunburst"),
            className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "sunburst" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`,
            "aria-label": t("heatmap.sunburst"),
          },
          e(Minimize2, { className: "h-3.5 w-3.5" }),
          e("span", { className: "hidden sm:inline" }, t("heatmap.sunburst"))
        )
      )
    ),
    e(
      "div",
      { className: "flex-1 min-h-0" },
      e(ReactEChartsCore, {
        echarts,
        option,
        style: { height: "100%", width: "100%" },
        onEvents: { click: handleClick },
        ref: chartRef,
      })
    )
  );
}