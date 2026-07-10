/**
 * PortfolioHeatmap — DM-08
 * Treemap/Sunburst visualization for portfolio holdings.
 * Uses createElement (no JSX) per packages/web convention.
 */
import { createElement, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { TreemapChart, SunburstChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { useEChartsResize } from "../../hooks/useChartResize.js";
import { RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

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
    "heatmap.dialog.close": "Đóng",
    "heatmap.dialog.trend": "Xu hướng 24h",
    "heatmap.dialog.price": "Giá hiện tại",
    "heatmap.dialog.volume": "Khối lượng",
    "heatmap.dialog.marketCap": "Vốn hóa",
    "heatmap.dialog.volatility": "Mức biến động",
    "heatmap.dialog.loading": "Đang tải xu hướng...",
    "heatmap.dialog.noData": "Không có dữ liệu",
    "heatmap.dialog.companyDefault": "Công ty Cổ phần",
    "heatmap.dialog.industryUnknown": "Chưa phân loại",
    "heatmap.dialog.volLow": "Thấp",
    "heatmap.dialog.volMed": "Vừa",
    "heatmap.dialog.volHigh": "Cao",
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
    "heatmap.dialog.close": "Close",
    "heatmap.dialog.trend": "24h Trend",
    "heatmap.dialog.price": "Current Price",
    "heatmap.dialog.volume": "Volume",
    "heatmap.dialog.marketCap": "Market Cap",
    "heatmap.dialog.volatility": "Volatility",
    "heatmap.dialog.loading": "Loading trend...",
    "heatmap.dialog.noData": "No trend data",
    "heatmap.dialog.companyDefault": "Joint Stock Company",
    "heatmap.dialog.industryUnknown": "Unclassified",
    "heatmap.dialog.volLow": "Low",
    "heatmap.dialog.volMed": "Medium",
    "heatmap.dialog.volHigh": "High",
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
  upStrong: "#22c55e",   // green-500
  upSoft: "#4ade80",     // green-400
  downStrong: "#ef4444", // red-500
  downSoft: "#f87171",   // red-400
  neutral: "#eab308",    // yellow-500
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
  const navigate = useNavigate();
  const t = createTranslator(resolveLocale());
  const [viewMode, setViewMode] = useState("treemap");
  const [sizeMode, setSizeMode] = useState("weight"); // "weight" | "marketCap"
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [trendPoints, setTrendPoints] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  // Use ResizeObserver to handle sidebar collapse/expand
  useEChartsResize(chartRef, containerRef, [viewMode, holdings.length, sizeMode]);

  const chartData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];

    return holdings.map((h) => {
      const symbol = h?.symbol || "";
      const quote = quotesBySymbol?.[symbol] || {};
      const changePct = Number(quote?.change_pct || 0);
      const currentPrice = Number(quote?.current_price || h?.current_price || 0);
      const quantity = Number(h?.quantity || 0);
      const marketValue = currentPrice * quantity;
      
      const marketCap = Number(h?.market_cap_bn || quote?.market_cap_bn || quote?.market_cap || 0);
      const companyName = h?.company_name || quote?.company_name || null;
      const industry = h?.industry || quote?.industry || null;
      const volume = Number(quote?.volume || h?.volume || 0);

      let sizeValue = 1;
      if (sizeMode === "marketCap") {
        sizeValue = marketCap > 0 ? marketCap : 1000; // Fallback to 1000 billion if no market cap
      } else {
        if (quantity > 0) {
          sizeValue = marketValue;
        } else {
          // Fallback weight for non-holdings to prevent squishing
          const actualHoldings = holdings.filter(item => Number(item?.quantity) > 0);
          if (actualHoldings.length > 0) {
            const totalValue = actualHoldings.reduce((sum, item) => {
              const itemPrice = Number(quotesBySymbol?.[item.symbol]?.current_price || item.current_price || 0);
              const itemQty = Number(item.quantity || 0);
              return sum + (itemPrice * itemQty);
            }, 0);
            const avgValue = totalValue / actualHoldings.length;
            sizeValue = avgValue * 0.3; // 30% of average holding size
          } else {
            sizeValue = currentPrice * 100;
          }
        }
      }

      return {
        name: symbol,
        value: Math.max(sizeValue, 1),
        changePct,
        itemStyle: {
          color: getHeatColor(changePct),
        },
        currentPrice,
        quantity,
        marketValue,
        marketCap,
        company_name: companyName,
        industry,
        volume,
      };
    });
  }, [holdings, quotesBySymbol, sizeMode]);

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

    const isMarketCap = sizeMode === "marketCap";

    if (viewMode === "treemap") {
      return {
        tooltip: {
          ...darkTooltip,
          formatter: (info) => {
            const { name, value, data } = info;
            if (isMarketCap) {
              return `<strong style="color: #06b6d4;">${name}</strong><br/>Vốn hóa: ${Number(value).toLocaleString("vi-VN")} tỷ VND<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#22c55e' : data?.changePct < 0 ? '#ef4444' : '#eab308'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
            }
            const displayVal = data?.quantity > 0 ? `${Number(data.marketValue).toLocaleString("vi-VN")} VND` : `Lọc tỷ trọng (Mẫu thử)`;
            return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị vị thế: ${displayVal}<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#22c55e' : data?.changePct < 0 ? '#ef4444' : '#eab308'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
          },
        },
        series: [
          {
            type: "treemap",
            nodeClick: false,
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            data: chartData,
            itemStyle: {
              borderColor: "#0f172a",
              borderWidth: 0.5,
              gapWidth: 0.5,
            },
            levels: [
              { itemStyle: { borderWidth: 0, gapWidth: 0.5 } },
              { itemStyle: { borderColor: "#0f172a", borderWidth: 0.5, gapWidth: 0.5 } },
            ],
            label: {
              show: true,
              formatter: (params) => {
                const changePct = params.data?.changePct;
                const sign = changePct > 0 ? "+" : "";
                return `${params.name}\n${sign}${Number(changePct || 0).toFixed(2)}%`;
              },
              fontSize: 11,
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
          if (isMarketCap) {
            return `<strong style="color: #06b6d4;">${name}</strong><br/>Vốn hóa: ${Number(value).toLocaleString("vi-VN")} tỷ VND<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#22c55e' : data?.changePct < 0 ? '#ef4444' : '#eab308'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
          }
          const displayVal = data?.quantity > 0 ? `${Number(data.marketValue).toLocaleString("vi-VN")} VND` : `Lọc tỷ trọng (Mẫu thử)`;
          return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị vị thế: ${displayVal}<br/>Biến động: <span style="color: ${data?.changePct > 0 ? '#22c55e' : data?.changePct < 0 ? '#ef4444' : '#eab308'};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
        },
      },
      series: [
        {
          type: "sunburst",
          nodeClick: false,
          data: chartData,
          radius: [0, "95%"],
          itemStyle: {
            borderColor: "#0f172a",
            borderWidth: 1,
          },
          label: {
            show: true,
            formatter: (params) => {
              const changePct = params.data?.changePct;
              const sign = changePct > 0 ? "+" : "";
              return `${params.name}\n${sign}${Number(changePct || 0).toFixed(2)}%`;
            },
            fontSize: 10,
            color: "#fff",
          },
        },
      ],
    };
  }, [chartData, viewMode, sizeMode]);

  const fetchTrendData = useCallback(async (symbol) => {
    if (!symbol) return;
    setLoadingTrend(true);
    try {
      const result = await coreApiAdapter.getStockChartHistory(symbol, {
        timeframe: "1H",
        days: 1,
      });
      const data = result?.data || result?.results || [];
      const prices = data.map((p) => p.close).filter(Boolean);
      setTrendPoints(prices);
    } catch {
      setTrendPoints([]);
    } finally {
      setLoadingTrend(false);
    }
  }, []);

  const handleNavigateToStock = useCallback((symbol) => {
    if (symbol) navigate(`/stocks/${symbol}`);
  }, [navigate]);

  function renderSparkline(prices, loading) {
    if (loading) {
      return e("div", { className: "h-12 w-full flex items-center justify-center text-[10px] text-slate-500" }, t("heatmap.dialog.loading"));
    }
    if (!prices || prices.length < 2) {
      return e("div", { className: "h-12 w-full flex items-center justify-center text-[10px] text-slate-500" }, t("heatmap.dialog.noData"));
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const width = 240;
    const height = 40;

    const pts = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    });

    const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt}`).join(" ");
    const color = prices[prices.length - 1] >= prices[0] ? "#22c55e" : "#ef4444";

    return e(
      "svg",
      { width: "100%", height, viewBox: `0 0 ${width} ${height}`, className: "overflow-visible" },
      e("path", {
        d,
        fill: "none",
        stroke: color,
        strokeWidth: 2.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      })
    );
  }

  function getVolatilityLabel(changePct) {
    const abs = Math.abs(changePct || 0);
    if (abs < 1) return t("heatmap.dialog.volLow");
    if (abs < 3) return t("heatmap.dialog.volMed");
    return t("heatmap.dialog.volHigh");
  }

  const handleClick = (params) => {
    if (params?.data) {
      if (chartRef.current) {
        const instance = chartRef.current.getEchartsInstance();
        instance.dispatchAction({ type: "hideTip" });
      }
      const data = params.data;
      setSelectedDetail(data);
      fetchTrendData(data.name);
    }
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
    { ref: containerRef, className: "core-heatmap h-full flex flex-col relative " + className },
    e(
      "div",
      { className: "core-heatmap-header flex items-center justify-between mb-3" },
      e("h3", { className: "text-sm font-bold text-slate-100" }, t("heatmap.title")),
      e(
        "div",
        { className: "flex items-center gap-3" },
        // Size Mode Toggle (Vốn hóa / Tỷ trọng)
        e(
          "div",
          { className: "flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800" },
          e(
            "button",
            {
              onClick: () => setSizeMode("weight"),
              className: `px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                sizeMode === "weight"
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`,
            },
            t("heatmap.sizeWeight")
          ),
          e(
            "button",
            {
              onClick: () => setSizeMode("marketCap"),
              className: `px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                sizeMode === "marketCap"
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`,
            },
            t("heatmap.sizeCap")
          )
        ),
        // View Mode Toggle (Treemap / Sunburst)
        e(
          "div",
          { className: "flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800" },
          e(
            "button",
            {
              onClick: () => setViewMode("treemap"),
              className: `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                viewMode === "treemap" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
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
              className: `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                viewMode === "sunburst" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
              }`,
              "aria-label": t("heatmap.sunburst"),
            },
            e(Minimize2, { className: "h-3.5 w-3.5" }),
            e("span", { className: "hidden sm:inline" }, t("heatmap.sunburst"))
          )
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
    ),
    // Dialog overlay
    selectedDetail && e(
      "div",
      { className: "absolute top-12 right-4 w-72 glass-strong rounded-2xl border border-slate-800 p-5 shadow-2xl z-50 text-left animate-fade-in" },
      // Header: Symbol + % Change + Close
      e("div", { className: "flex items-start justify-between mb-1" },
        e("div", { className: "flex items-center gap-2" },
          e("button", {
            onClick: () => handleNavigateToStock(selectedDetail.name),
            className: "text-lg font-black text-slate-100 hover:text-cyan-400 hover:underline transition-all focus:outline-none",
          }, selectedDetail.name),
          e("span", {
            className: `px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
              (selectedDetail.changePct || 0) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            }`,
          }, `${(selectedDetail.changePct || 0) >= 0 ? "+" : ""}${(selectedDetail.changePct || 0).toFixed(2)}%`)
        ),
        e("button", {
          onClick: () => setSelectedDetail(null),
          className: "text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase",
        }, t("heatmap.dialog.close"))
      ),
      // Company & Industry
      e("div", { className: "text-xs text-slate-400 font-medium truncate mb-0.5" }, selectedDetail.company_name || t("heatmap.dialog.companyDefault")),
      e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, selectedDetail.industry || t("heatmap.dialog.industryUnknown")),
      // 24h Trend
      e("div", { className: "mb-4" },
        e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2" }, t("heatmap.dialog.trend")),
        renderSparkline(trendPoints, loadingTrend)
      ),
      // Details grid
      e("div", { className: "grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-800/80 pt-4 text-xs" },
        e("div", null,
          e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.price")),
          e("div", { className: "font-black text-slate-200" }, `${(selectedDetail.currentPrice || 0).toLocaleString("vi-VN")} VND`)
        ),
        e("div", null,
          e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.volume")),
          e("div", { className: "font-black text-slate-200" }, selectedDetail.volume ? selectedDetail.volume.toLocaleString("vi-VN") : "--")
        ),
        e("div", null,
          e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.marketCap")),
          e("div", { className: "font-black text-slate-200" }, selectedDetail.marketCap ? `${selectedDetail.marketCap.toLocaleString("vi-VN")} tỷ VND` : "--")
        ),
        e("div", null,
          e("div", { className: "text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5" }, t("heatmap.dialog.volatility")),
          e("div", { className: "font-black text-slate-200" }, getVolatilityLabel(selectedDetail.changePct))
        )
      )
    )
  );
}