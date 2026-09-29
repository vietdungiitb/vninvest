import { createElement, useMemo } from "react";
import { RotateCw } from "lucide-react";
import { useI18n } from "../../context/LangContext.js";
import { signOf, formatUpdateTime, formatTimeAgo } from "../../utils/formatMarket.js";
import "./SmartStatsHeader.css";

const e = createElement;

// Quá 15 phút không có updatedAt mới thì gắn badge "Dữ liệu cũ".
const STALE_AFTER_MS = 15 * 60 * 1000;

export function SmartStatsHeader({
  summary,
  analytics,
  holdings,
  loading,
  realtimeBreadth,
  onRefresh,
  // Giờ đồng bộ giá gần nhất. API KHÔNG có `updated_at`; chỉ có `as_of`
  // (ngày) — xem khối tính updatedTs bên dưới. Không có giá trị nào thì hiện
  // "—" thay vì giờ render.
  updatedAt = null,
  asOf = null,
  className = "",
}) {
  const { t } = useI18n();
  const analyticsData = analytics;

  // `total_market_value` / `total_unrealized_pnl` arrive from the API as
  // formatted strings (e.g. "0.00"), not numbers. Using them directly made
  // `!"0.00"` false, so the empty-portfolio CTA could never appear, and
  // `"0.00" > 0` false, so the currency suffix was dropped for a zero value.
  //
  // `Number(null) === 0` nên KHÔNG được dùng `|| 0` ở đây. Backend trả `null`
  // khi chưa đủ dữ liệu (ví dụ mã chưa có giá phiên hôm nay — xem
  // `PortfolioSummaryView.unpriced_symbols`). Biến `null` thành `0` sẽ khiến
  // một danh mục có vị thế thật bị hiển thị thành danh mục TRỐNG, tức đúng
  // cái lỗi "0 giả" mà backend vừa sửa xong. Phân biệt ba trạng thái:
  //   - `null`  → chưa biết: dùng `marketValueKnown = false`
  //   - số      → biết
  //   - rỗng    → chưa có số liệu
  const rawMarketValue = summary?.total_market_value;
  const marketValueKnown = rawMarketValue !== null && rawMarketValue !== undefined
    && rawMarketValue !== "";
  const marketValue = marketValueKnown ? Number(rawMarketValue) : 0;
  // BE phát `total_unrealized_pnl`; bản cũ đọc `total_unrealized_pl` nên ô
  // lãi/lỗ hôm nay luôn hiện 0 — một "0 giả" khác, do đọc sai tên field.
  const rawDayPL = summary?.total_unrealized_pnl;
  const dayPLKnown = rawDayPL !== null && rawDayPL !== undefined && rawDayPL !== "";
  const dayPL = dayPLKnown ? Number(rawDayPL) : 0;
  const dayPLPctKnown = summary?.total_unrealized_pnl_pct !== null
    && summary?.total_unrealized_pnl_pct !== undefined
    && summary?.total_unrealized_pnl_pct !== "";
  const dayPLPct = dayPLPctKnown ? Number(summary.total_unrealized_pnl_pct) : 0;
  const plSign = signOf(dayPL);

  const hasAnalytics = analyticsData && [
    analyticsData.alpha_annual_pct,
    analyticsData.beta,
    analyticsData.sharpe_ratio,
    analyticsData.max_drawdown_pct,
  ].some((v) => v !== null && v !== undefined);
  // Chỉ coi là TRỐNG khi backend thực sự trả 0. `null` là "chưa biết", không
  // phải "không có gì".
  const isEmptyPortfolio = !loading && marketValueKnown && marketValue === 0 && !hasAnalytics;

  // Honesty rule: the API exposes no `updated_at`; the only real freshness
  // signal is `as_of`, and that is a DATE, not an instant. Rendering a date as
  // "20 hours ago" would be its own lie (today's date parses to local
  // midnight), so the two are kept apart:
  //   - updatedAt (a real timestamp) -> relative "Xs ago"
  //   - asOf      (a YYYY-MM-DD date) -> the date itself
  //   - neither                     -> an em dash, never the render time
  const updatedTs = useMemo(() => {
    if (!updatedAt) return null;
    const ts = new Date(updatedAt).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [updatedAt]);
  const asOfDate = useMemo(() => {
    if (updatedTs !== null) return null;
    if (!asOf) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(asOf));
    if (!m) return null;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }, [asOf, updatedTs]);
  const isStale = updatedTs !== null && Date.now() - updatedTs > STALE_AFTER_MS;
  const absoluteTime = updatedTs !== null ? formatUpdateTime(updatedTs) : asOfDate || "";
  const updatedLabel = updatedTs !== null
    ? `${t("smartStats.updatedAt")} ${formatTimeAgo(updatedTs)}`
    : asOfDate
      ? `${t("smartStats.asOf")} ${asOfDate}`
      : t("smartStats.updatedAtUnknown", { defaultValue: "Chưa có giờ cập nhật" });

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
            // Chưa biết thì hiện "—" chứ không phải "0 đ". Xem `marketValueKnown`.
            loading ? "--" : (marketValueKnown ? marketValue.toLocaleString("vi-VN") : "—"),
            !loading && marketValueKnown
              ? e("span", { className: "text-[10px] font-normal text-slate-600 ml-1" }, "đ")
              : null
          )
        ),
        e(
          "div",
          { className: "flex flex-col" },
          e("span", { className: "text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-1" }, t("smartStats.unrealizedPL")),
          e(
            "div",
            { className: `flex items-center gap-1.5 leading-none ${plSign > 0 ? "text-emerald-400" : plSign < 0 ? "text-rose-400" : "text-slate-400"}` },
            e("span", { className: "text-sm font-black" }, loading ? "..." : (dayPLKnown ? (plSign > 0 ? "+" : "") + Number(dayPL).toLocaleString("vi-VN") : "—")),
            e(
              "span",
              {
                className: "pill text-[10px] font-bold px-2 py-0.5 rounded-full",
                "data-sign": String(plSign),
              },
              dayPLPctKnown ? Number(dayPLPct).toFixed(2) + "%" : "—"
            )
          )
        ),
        e(
          "div",
          { className: "hidden min-w-0 flex-1 lg:block" },
          isEmptyPortfolio
            ? e(
              "div",
              { className: "flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 py-2 text-xs text-slate-400" },
              e("span", null, t("smartStats.emptyCta")),
              e(
                "button",
                {
                  onClick: () => onRefresh?.(),
                  className: "rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300 transition-all hover:bg-cyan-500/20",
                },
                t("smartStats.createPortfolio")
              ),
              e(
                "button",
                {
                  onClick: () => onRefresh?.(),
                  className: "rounded-lg border border-slate-700/60 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-800",
                },
                t("smartStats.connectPaper")
              )
            )
            : e(
              "div",
              { className: "grid grid-cols-4 gap-3 rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 py-2" },
              compactMetrics.map((metric) =>
                e(
                  "div",
                  { key: metric.key, className: "min-w-0" },
                  e("div", { className: "truncate text-[12px] font-medium text-slate-500" }, metric.label),
                  e("div", { className: `mt-1 truncate text-xs font-black tabular-nums ${metric.color}` }, loading || metric.value === null || metric.value === undefined ? "--" : metric.format(metric.value))
                )
              )
            )
        )
      ),
      e(
        "div",
        { className: "flex items-center gap-4" },
        e(
          "div",
          { className: "flex flex-col items-end" },
          e("span", { className: "text-[10px] text-slate-500 uppercase tracking-wider leading-none mb-1" }, t("smartStats.breadthLabel")),
          e(
            "div",
            { className: "flex items-center gap-1" },
            e(
              "div",
              {
                className: "flex h-1.5 w-32 rounded-full overflow-hidden bg-slate-800",
                role: "img",
                "aria-label": `${t("smartStats.breadthUpTip", { count: realtimeBreadth?.up || 0 })} · ${t("smartStats.breadthFlatTip", { count: realtimeBreadth?.flat || 0 })} · ${t("smartStats.breadthDownTip", { count: realtimeBreadth?.down || 0 })}`,
              },
              e("div", { className: "bg-emerald-500 h-full transition-all duration-500", title: t("smartStats.breadthUpTip", { count: realtimeBreadth?.up || 0 }), style: { width: `${((realtimeBreadth?.up || 0) / (breadthTotal || 1)) * 100}%` } }),
              e("div", { className: "bg-slate-600 h-full transition-all duration-500", title: t("smartStats.breadthFlatTip", { count: realtimeBreadth?.flat || 0 }), style: { width: `${((realtimeBreadth?.flat || 0) / (breadthTotal || 1)) * 100}%` } }),
              e("div", { className: "bg-rose-500 h-full transition-all duration-500", title: t("smartStats.breadthDownTip", { count: realtimeBreadth?.down || 0 }), style: { width: `${((realtimeBreadth?.down || 0) / (breadthTotal || 1)) * 100}%` } })
            ),
            e("span", { className: "text-[10px] font-bold text-slate-300 ml-1 tabular-nums", title: `${t("smartStats.breadthUpTip", { count: realtimeBreadth?.up || 0 })} · ${t("smartStats.breadthFlatTip", { count: realtimeBreadth?.flat || 0 })} · ${t("smartStats.breadthDownTip", { count: realtimeBreadth?.down || 0 })}` }, `▲ ${realtimeBreadth?.up || 0} · ■ ${realtimeBreadth?.flat || 0} · ▼ ${realtimeBreadth?.down || 0}`)
          ),
          e(
            "div",
            { className: "mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-500" },
            e("span", { className: "tabular-nums", title: `${t("smartStats.updatedAt")}: ${absoluteTime}` }, updatedLabel),
            isStale && e(
              "span",
              { className: "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-px font-bold text-amber-300" },
              t("smartStats.stale")
            )
          )
        ),
        e(
          "div",
          { className: "flex items-center border-l border-slate-800 pl-4" },
          e(
            "button",
            {
              onClick: () => onRefresh?.(),
              className: "rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
              title: `${t("smartStats.refreshBtn")} · ${updatedLabel} (${absoluteTime})`,
              "aria-label": t("smartStats.refreshBtn"),
            },
            e(RotateCw, { className: "h-5 w-5" })
          )
        )
      )
    )
  );
}