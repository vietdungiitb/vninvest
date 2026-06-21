import { createElement, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { RotateCw } from "lucide-react";
import "./SmartStatsHeader.css";

const e = createElement;

const I18N = {
  vi: {
    "smartStats.marketValue": "Giá trị danh mục",
    "smartStats.unrealizedPL": "Lãi/Lỗ chưa thực hiện",
    "smartStats.breadthLabel": "Rộng thị trường",
    "smartStats.refreshBtn": "Làm mới dữ liệu",
    "smartStats.alpha": "Alpha",
    "smartStats.beta": "Beta",
    "smartStats.sharpe": "Sharpe",
    "smartStats.maxDrawdown": "Drawdown tối đa",
  },
  en: {
    "smartStats.marketValue": "Portfolio Value",
    "smartStats.unrealizedPL": "Unrealized P/L",
    "smartStats.breadthLabel": "Market Breadth",
    "smartStats.refreshBtn": "Refresh Data",
    "smartStats.alpha": "Alpha",
    "smartStats.beta": "Beta",
    "smartStats.sharpe": "Sharpe",
    "smartStats.maxDrawdown": "Max Drawdown",
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

export function SmartStatsHeader({
  summary,
  analytics,
  holdings,
  loading,
  realtimeBreadth,
  onRefresh,
  className = "",
}) {
  const t = createTranslator(resolveLocale());
  const [analyticsData, setAnalyticsData] = useState(analytics);

  if (!analyticsData && holdings?.length) {
    (async () => {
      try {
        const res = await coreApiAdapter.getPortfolioAnalytics({}).getPortfolioAnalytics(holdings.map(h => h.symbol).join(","));
        if (res) setAnalyticsData(res);
      } catch (_) {}
    })();
  }

  const marketValue = summary?.total_market_value || 0;
  const dayPL = summary?.total_unrealized_pl || 0;
  const dayPLPct = summary?.total_unrealized_pl_pct || 0;

  const breadthTotal = (realtimeBreadth?.up || 0) + (realtimeBreadth?.down || 0) + (realtimeBreadth?.flat || 0);

  const compactMetrics = [
    { key: "alpha", label: t("smartStats.alpha"), value: analyticsData?.alpha_annual_pct, format: (v) => `${Number(v).toFixed(2)}%`, color: Number(analyticsData?.alpha_annual_pct) >= 0 ? "text-emerald-400" : "text-rose-400" },
    { key: "beta", label: t("smartStats.beta"), value: analyticsData?.beta, format: (v) => Number(v).toFixed(2), color: "text-slate-200" },
    { key: "sharpe", label: t("smartStats.sharpe"), value: analyticsData?.sharpe_ratio, format: (v) => Number(v).toFixed(2), color: Number(analyticsData?.sharpe_ratio) >= 0 ? "text-emerald-400" : "text-rose-400" },
    { key: "maxDrawdown", label: t("smartStats.maxDrawdown"), value: analyticsData?.max_drawdown_pct, format: (v) => `${Number(v).toFixed(2)}%`, color: "text-rose-400" },
  ];

  return e(
    "div",
    { className: "smart-stats-header sticky top-0 z-30 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 py-2 " + className },
    e(
      "div",
      { className: "mx-auto flex w-full max-w-[1800px] items-center justify-between gap-6" },
      e(
        "div",
        { className: "flex items-center gap-8" },
        e(
          "div",
          { className: "flex flex-col" },
          e("span", { className: "text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1" }, t("smartStats.marketValue")),
          e(
            "span",
            { className: "text-sm font-black text-slate-100 leading-none" },
            loading || !marketValue ? "--" : Number(marketValue).toLocaleString("vi-VN"),
            marketValue > 0 && e("span", { className: "text-[10px] font-normal text-slate-600 ml-1" }, "đ")
          )
        ),
        e(
          "div",
          { className: "flex flex-col" },
          e("span", { className: "text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1" }, t("smartStats.unrealizedPL")),
          e(
            "div",
            { className: `flex items-center gap-1.5 leading-none ${dayPL >= 0 ? "text-emerald-400" : "text-rose-400"}` },
            e("span", { className: "text-sm font-black" }, loading ? "..." : (dayPL >= 0 ? "+" : "") + Number(dayPL).toLocaleString("vi-VN")),
            e(
              "span",
              {
                className: `text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  dayPL >= 0
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`
              },
              Number(dayPLPct).toFixed(2) + "%"
            )
          )
        ),
        e(
          "div",
          { className: "hidden min-w-0 flex-1 lg:block" },
          e(
            "div",
            { className: "grid grid-cols-4 gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/35 px-4 py-2" },
            compactMetrics.map((metric) =>
              e(
                "div",
                { key: metric.key, className: "min-w-0" },
                e("div", { className: "truncate text-[9px] uppercase tracking-[0.18em] text-slate-500" }, metric.label),
                e("div", { className: `mt-1 truncate text-xs font-black ${metric.color}` }, loading || metric.value === null || metric.value === undefined ? "--" : metric.format(metric.value))
              )
            )
          )
        )
      ),
      e(
        "div",
        { className: "flex items-center gap-6" },
        e(
          "div",
          { className: "flex flex-col items-end" },
          e("span", { className: "text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1" }, t("smartStats.breadthLabel")),
          e(
            "div",
            { className: "flex items-center gap-1" },
            e(
              "div",
              { className: "flex h-1.5 w-32 rounded-full overflow-hidden bg-slate-800" },
              e("div", { className: "bg-emerald-500 h-full transition-all duration-500", style: { width: `${((realtimeBreadth?.up || 0) / (breadthTotal || 1)) * 100}%` } }),
              e("div", { className: "bg-slate-600 h-full transition-all duration-500", style: { width: `${((realtimeBreadth?.flat || 0) / (breadthTotal || 1)) * 100}%` } }),
              e("div", { className: "bg-rose-500 h-full transition-all duration-500", style: { width: `${((realtimeBreadth?.down || 0) / (breadthTotal || 1)) * 100}%` } })
            ),
            e("span", { className: "text-[10px] font-bold text-slate-300 ml-1" }, `${realtimeBreadth?.up}/${realtimeBreadth?.flat}/${realtimeBreadth?.down}`)
          ),
          e(
            "div",
            { className: "flex items-center gap-3 border-l border-slate-800 pl-4" },
            e(
              "button",
              {
                onClick: () => onRefresh?.(),
                className: "rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                title: t("smartStats.refreshBtn"),
                "aria-label": t("smartStats.refreshBtn"),
              },
              e(RotateCw, { className: "h-5 w-5" })
            )
          )
        )
      )
    )
  );
}