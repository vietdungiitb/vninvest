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
import { useI18n } from "../../context/LangContext.js";
import { formatUpdateTime } from "../../utils/formatMarket.js";

echarts.use([TreemapChart, SunburstChart, CanvasRenderer]);

const e = createElement;



// Thang màu liên tục đối xứng, kẹp ±7% (biên HOSE) — audit S3, bản tươi sáng.
// User feedback 2026-09-22: bản trầm "mờ" → dùng stops vivid, chữ có viền đen
// (textBorder) để giữ contrast trên nền sáng; 0% vàng amber vivid + chữ đậm.
// ECharts-only (không thêm d3): màu tính sẵn trong chartData map.
const HEAT_STOPS = [
  { at: -7, color: "#991b1b" },
  { at: -4, color: "#dc2626" },
  { at: -1.5, color: "#f87171" },
  { at: 0, color: "#f59e0b" },
  { at: 1.5, color: "#4ade80" },
  { at: 4, color: "#22c55e" },
  { at: 7, color: "#15803d" },
];
const HEAT_ZERO_BORDER = "#92400e";

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixHex(a, b, k) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const m = (x, y) => Math.round(x + (y - x) * k);
  return `#${((1 << 24) + (m(ca.r, cb.r) << 16) + (m(ca.g, cb.g) << 8) + m(ca.b, cb.b)).toString(16).slice(1)}`;
}

export function heatColorContinuous(changePct) {
  const p = Math.max(-7, Math.min(7, Number(changePct) || 0));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const lo = HEAT_STOPS[i];
    const hi = HEAT_STOPS[i + 1];
    if (p >= lo.at && p <= hi.at) {
      const k = hi.at === lo.at ? 0 : (p - lo.at) / (hi.at - lo.at);
      return mixHex(lo.color, hi.color, k);
    }
  }
  return HEAT_STOPS[2].color;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function textOnHeat(bg) {
  return luminance(bg) > 0.35 ? "#0b0f17" : "#fff";
}

// Giữ tên cũ cho tương thích test/call-site ngoài (nếu có): map về thang liên tục.
export function getHeatColor(changePct) {
  return heatColorContinuous(changePct);
}

/**
 * Gom tile vụn share<2% (quá 8 mã) thành 1 node "Khác".
 * Pure helper để test độc lập — logic 1:1 với displayData trước đây.
 * @returns {{tiles: object[], groupedCount: number}}
 */
export function groupTinyTiles(annotated, total) {
  const list = Array.isArray(annotated) ? annotated : [];
  const sum = Number(total) > 0 ? Number(total) : (list.reduce((s, d) => s + Number(d.value || 0), 0) || 1);
  const tiny = list.filter((d) => d.share < 0.02);
  if (tiny.length <= 8) return { tiles: list, groupedCount: 0 };
  const tiles = list.filter((d) => d.share >= 0.02);
  const tinyValue = tiny.reduce((s, d) => s + Number(d.value || 0), 0);
  const wavg = tiny.reduce((s, d) => s + Number(d.changePct || 0) * Number(d.value || 0), 0) / (tinyValue || 1);
  const bg = heatColorContinuous(wavg);
  tiles.push({
    name: `__other_${tiny.length}`,
    value: Math.max(tinyValue, 1),
    changePct: wavg,
    itemStyle: { color: bg, borderColor: "#0f172a", borderWidth: 0.5 },
    labelColor: textOnHeat(bg),
    isOther: true,
    otherCount: tiny.length,
    otherSymbols: tiny.slice(0, 3).map((d) => d.name),
    share: tinyValue / sum,
    showName: true,
    showPct: true,
    fontSize: 11,
  });
  return { tiles, groupedCount: tiny.length };
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
  scopeCount = 0,
  scopeUpdatedAt = null,
  className = "",
}) {
  const navigate = useNavigate();
  const { t } = useI18n();
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
        sizeValue = marketCap > 0 ? marketCap : 1; // Fallback to 1 (was 1000B, distorted treemap)
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

      const bg = heatColorContinuous(changePct);
      const isZero = Number(changePct) === 0;
      return {
        name: symbol,
        value: Math.max(sizeValue, 1),
        changePct,
        itemStyle: {
          color: bg,
          // Tile 0% viền vàng trầm thay vì fill vàng (audit #24)
          borderColor: isZero ? HEAT_ZERO_BORDER : "#0f172a",
          borderWidth: isZero ? 1.5 : 0.5,
        },
        labelColor: textOnHeat(bg),
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

  // Mở rộng node "Khác": hiện toàn bộ tile nhỏ (mặc định gom để khỏi tràn chữ).
  const [showAllTiles, setShowAllTiles] = useState(false);

  // Gating nhãn theo tỷ trọng + gom tile vụn (audit #21):
  // ECharts treemap formatter không expose pixel rect ổn định nên dùng share
  // làm proxy: share>=3% hiện mã+%, 1–3% chỉ mã, <1% chỉ tooltip.
  // Tile <2% quá 8 mã → gom node "Khác (n mã)" để không tràn chữ.
  const displayData = useMemo(() => {
    const total = chartData.reduce((s, d) => s + Number(d.value || 0), 0) || 1;
    const annotated = chartData.map((d) => {
      const share = Number(d.value || 0) / total;
      const showName = share >= 0.01;
      const showPct = share >= 0.03;
      const fontSize = share >= 0.1 ? 16 : share >= 0.03 ? 12 : 10;
      return { ...d, share, showName, showPct, fontSize };
    });
    if (showAllTiles) return { tiles: annotated, groupedCount: 0 };
    return groupTinyTiles(annotated, total);
  }, [chartData, showAllTiles]);

  const option = useMemo(() => {
    if (displayData.tiles.length === 0) return {};
    const renderData = displayData.tiles.map((d) => {
      if (d.isOther) {
        const label = t("heatmap.other", { count: d.otherCount, n: d.otherCount });
        return { ...d, name: label === "heatmap.other" ? `Khác (${d.otherCount} mã)` : label };
      }
      return d;
    });

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
            const signColor = data?.changePct > 0 ? '#4ade80' : data?.changePct < 0 ? '#f87171' : '#94a3b8';
            if (data?.isOther) {
              const syms = (data?.otherSymbols || []).join(", ");
              return `<strong style="color: #06b6d4;">${name}</strong><br/>${syms}${data?.otherCount > 3 ? ` +${data.otherCount - 3} mã khác` : ""}<br/>Biến động bq: <span style="color: ${signColor};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
            }
            if (isMarketCap) {
              return `<strong style="color: #06b6d4;">${name}</strong><br/>Vốn hóa: ${Number(value).toLocaleString("vi-VN")} tỷ VND<br/>Biến động: <span style="color: ${signColor};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
            }
            const displayVal = data?.quantity > 0 ? `${Number(data.marketValue).toLocaleString("vi-VN")} VND` : `Lọc tỷ trọng (Mẫu thử)`;
            return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị vị thế: ${displayVal}<br/>Biến động: <span style="color: ${signColor};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
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
            data: renderData,
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
                const d = params.data || {};
                if (!d.showName) return "";
                const changePct = d.changePct;
                const sign = changePct > 0 ? "+" : "";
                return d.showPct ? `${params.name}\n${sign}${Number(changePct || 0).toFixed(2)}%` : `${params.name}`;
              },
              fontSize: 11,
              fontWeight: 800,
              color: (params) => params.data?.labelColor || "#fff",
              textBorderColor: "rgba(0,0,0,0.45)",
              textBorderWidth: 2,
              overflow: "truncate",
            },
            labelLayout: { hideOverlap: true },
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
            const signColor = data?.changePct > 0 ? '#4ade80' : data?.changePct < 0 ? '#f87171' : '#94a3b8';
            if (isMarketCap) {
              return `<strong style="color: #06b6d4;">${name}</strong><br/>Vốn hóa: ${Number(value).toLocaleString("vi-VN")} tỷ VND<br/>Biến động: <span style="color: ${signColor};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
            }
            const displayVal = data?.quantity > 0 ? `${Number(data.marketValue).toLocaleString("vi-VN")} VND` : `Lọc tỷ trọng (Mẫu thử)`;
            return `<strong style="color: #06b6d4;">${name}</strong><br/>Giá trị vị thế: ${displayVal}<br/>Biến động: <span style="color: ${signColor};">${Number(data?.changePct || 0).toFixed(2)}%</span>`;
          },
        },
        series: [
          {
            type: "sunburst",
            nodeClick: false,
            data: renderData,
            radius: [0, "95%"],
            itemStyle: {
              borderColor: "#0f172a",
              borderWidth: 1,
            },
            label: {
              show: true,
              formatter: (params) => {
                const d = params.data || {};
                if (!d.showName) return "";
                const changePct = d.changePct;
                const sign = changePct > 0 ? "+" : "";
                return d.showPct ? `${params.name}\n${sign}${Number(changePct || 0).toFixed(2)}%` : `${params.name}`;
              },
              fontSize: 10,
              fontWeight: 800,
              color: (params) => params.data?.labelColor || "#fff",
              textBorderColor: "rgba(0,0,0,0.45)",
              textBorderWidth: 2,
              overflow: "truncate",
            },
            labelLayout: { hideOverlap: true },
          },
        ],
      };
  }, [displayData, viewMode, sizeMode, t]);

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
    // Click node "Khác" → mở rộng xem toàn bộ tile nhỏ (thay vì im lặng như trước).
    if (params?.data?.isOther) {
      setShowAllTiles(true);
      return;
    }
    const symbol = params?.data?.name || params?.name;
    if (!symbol) return;
    handleNavigateToStock(symbol);
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
      { className: "core-heatmap-header flex items-center justify-between mb-1" },
      e(
        "div",
        { className: "min-w-0" },
        e("h3", { className: "panel-title text-base font-semibold text-slate-100" }, t("heatmap.title")),
        e("p", { className: "mt-0.5 truncate text-[12px] font-medium text-slate-500 tabular-nums" },
          t("heatmap.scopeLine", { count: scopeCount, time: scopeUpdatedAt ? formatUpdateTime(scopeUpdatedAt) : "—" }) +
          (displayData.groupedCount > 0 && !showAllTiles ? ` ${t("heatmap.scopeGrouped", { grouped: displayData.groupedCount })}` : ""))
      ),
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
        ),
        // Nút Mở rộng/Thu gọn tile vụn — chỉ hiện khi đang gom nhóm "Khác"
        displayData.groupedCount > 0 &&
          e(
            "button",
            {
              onClick: () => setShowAllTiles((v) => !v),
              className: `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all border ${
                showAllTiles ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "text-slate-400 hover:text-slate-200 border-slate-800"
              }`,
              title: t("heatmap.scopeGrouped", { grouped: displayData.groupedCount }),
              "aria-pressed": showAllTiles,
            },
            e("span", { className: "hidden sm:inline" }, t(showAllTiles ? "heatmap.collapse" : "heatmap.expand"))
          )
      )
    ),
    e(
      "div",
      { className: "panel-body flex-1 min-h-0" },
      e(ReactEChartsCore, {
        echarts,
        option,
        // notMerge: ép setOption toàn phần mỗi khi thang màu/data đổi,
        // tránh merge giữ màu cũ khi HMR hoặc universe thay đổi.
        notMerge: true,
        lazyUpdate: false,
        style: { height: "100%", width: "100%" },
        onEvents: { click: handleClick },
        ref: chartRef,
      })
    ),
    e(
      "div",
      { className: "mt-2 flex items-center gap-2 text-[10px] font-medium text-slate-500" },
      e("span", { className: "tabular-nums" }, "-7%"),
      e("div", {
        className: "h-1.5 flex-1 rounded-full",
        style: { background: "linear-gradient(to right, #991b1b, #dc2626, #f87171, #f59e0b, #4ade80, #22c55e, #15803d)" },
        role: "img",
        title: t("heatmap.legendLabel"),
        "aria-label": t("heatmap.legendLabel"),
      }),
      e("span", { className: "tabular-nums" }, "+7%")
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