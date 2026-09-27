import { useState, useEffect, useCallback, createElement } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { RotateCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { useI18n } from "../../context/LangContext.js";
import { createTranslator, normalizeLocale } from "../../i18n/index.js";

const e = createElement;

/**
 * Standalone translator for AIAdvisor strings (used by jest i18n tests).
 * Shares behavior with the app `t()` (vi default, fallback to key).
 */
export function createAiAdvisorTranslator(locale) {
  const language = normalizeLocale(locale);
  return { language, t: createTranslator(language) };
}



function getSeverityIcon(severity) {
  switch (severity) {
    case "critical": return AlertTriangle;
    case "high": return AlertTriangle;
    case "medium": return Activity;
    case "low": return Activity;
    default: return Activity;
  }
}

function getSeverityColor(severity) {
  switch (severity) {
    case "critical": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "low": return "text-sky-400 bg-sky-500/10 border-sky-500/20";
    default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  }
}

function getTrendIcon(direction) {
  switch (direction) {
    case "buy": return TrendingUp;
    case "sell": return TrendingDown;
    default: return Minus;
  }
}

function getTrendColor(direction) {
  switch (direction) {
    case "buy": return "text-emerald-400";
    case "sell": return "text-rose-400";
    default: return "text-slate-400";
  }
}

export function AIAdvisorAlertPanel({ className = "", holdings: _holdings, technicals: _technicals, analytics: _analytics, alerts: propAlerts, loading: propLoading, selectedSession: _selectedSession, selectedSymbol: _selectedSymbol, onSelectSession: _onSelectSession, onSelectSymbol: _onSelectSymbol }) {
  const { t, locale } = useI18n();
  const language = locale;
  const [alerts, setAlerts] = useState(propAlerts ?? []);
  const [loading, setLoading] = useState(propLoading ?? false);
  const [error, setError] = useState(null);
  const [lastScanAt, setLastScanAt] = useState(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await coreApiAdapter.getAIAlertsFeed();
      if (res && Array.isArray(res.results)) {
        setAlerts(res.results);
      } else if (Array.isArray(res)) {
        setAlerts(res);
      } else {
        setAlerts([]);
      }
      // Honesty rule: if the API does not return a real scan timestamp, report
      // "no scan yet" instead of stamping the fetch time. Previously this fell
      // back to Date.now(), which made the UI claim a scan had happened at the
      // moment of the request, and left `aiAdvisor.panel.noScan` unreachable.
      const apiLastScan = res?.last_scan_at ?? res?.meta?.last_scan_at ?? res?.latest_scan_at ?? null;
      if (apiLastScan) {
        const ts = new Date(apiLastScan).getTime();
        setLastScanAt(Number.isFinite(ts) ? ts : null);
      } else {
        setLastScanAt(null);
      }
    } catch (err) {
      setError(err?.message || t("aiAdvisor.panel.loadError"));
      // giữ lastScanAt hiện tại (null → "Chưa có lượt quét") để empty desc hiển thị noScan
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const getPulseGlowClass = (alert) => {
    const rsi = alert?.metadata?.rsi || alert?.evidence?.rsi || alert?.evidence?.rsi_at_signal;
    if (rsi != null) {
      const rsiNum = parseFloat(rsi);
      if (rsiNum <= 30) return "pulse-emerald";
      if (rsiNum >= 70) return "pulse-rose";
    }
    return "";
  };

  const formatValue = (val) => {
    if (val == null) return "—";
    const num = parseFloat(val);
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)} ${t("aiAdvisor.unit.billion")}`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(0)} ${t("aiAdvisor.unit.million")}`;
    }
    return num.toLocaleString(language === "en" ? "en-US" : "vi-VN");
  };

  const resolveSeverityLabel = (severity) => {
    if (severity === "critical") return t("aiAdvisor.severity.critical");
    if (severity === "high") return t("aiAdvisor.severity.high");
    if (severity === "medium") return t("aiAdvisor.severity.medium");
    return t("aiAdvisor.severity.low");
  };

  const resolveTrendLabel = (direction) => {
    if (direction === "buy") return t("aiAdvisor.trend.buy");
    if (direction === "sell") return t("aiAdvisor.trend.sell");
    return t("aiAdvisor.trend.neutral");
  };

  return e(
    "div",
    { className: `flex flex-col h-full min-h-0 ${className}` },
    // S4.3 — One card layer: lane already is card, inner wrapper transparent; dialog overlay keeps floating
    // Header
    e(
      "div",
      { className: "panel-head flex items-center justify-between mb-4 pb-3 border-b border-slate-800/50" },
      e("h3", { className: "panel-title text-base font-semibold text-slate-100 flex items-center gap-2" },
        e(Activity, { className: "h-5 w-5 text-cyan-400" }),
        t("aiAdvisor.panel.title")
      ),
      e(
        "button",
        {
          onClick: fetchFeed,
          disabled: loading,
          className: `btn-nowrap flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            loading
              ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
              : "bg-slate-800/50 text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 border border-slate-800/50"
          }`,
          "aria-label": t("aiAdvisor.panel.refresh"),
        },
        loading
          ? e(RotateCw, { className: "h-3.5 w-3.5 animate-spin" })
          : e(RotateCw, { className: "h-3.5 w-3.5" }),
        e("span", { className: "hidden sm:inline" }, loading ? t("aiAdvisor.panel.loading") : t("aiAdvisor.panel.refresh"))
      )
    ),
    // Error state
    error && e(
      "div",
      { className: "mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm" },
      error
    ),
    // Loading state
    loading && alerts.length === 0 && e(
      "div",
      { className: "flex items-center justify-center py-8 text-slate-500 text-sm" },
      e(RotateCw, { className: "h-5 w-5 animate-spin mr-2 text-cyan-400" }),
      t("aiAdvisor.panel.initialLoading")
    ),
    // Empty state — gọn (≤240px) + lý do + mốc quét + CTA (S5.2: icon 32px + title + desc lastScan + 2 CTA)
    !loading && alerts.length === 0 && !error && e(
      "div",
      { className: "flex flex-col items-center justify-center flex-1 text-center px-4 py-6 max-h-[240px]" },
      e(Activity, { className: "h-8 w-8 text-slate-700/50 mb-2", "aria-hidden": true }),
      e("p", { className: "text-sm font-semibold text-slate-300" }, t("aiAdvisor.panel.emptyTitle")),
      e("p", { className: "mt-1 text-xs text-slate-500 tabular-nums" }, lastScanAt ? t("aiAdvisor.panel.lastScan", { time: new Date(lastScanAt).toLocaleTimeString(language === "en" ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" }), count: alerts.length }) : t("aiAdvisor.panel.noScan")),
      e(
        "div",
        { className: "mt-3 flex items-center gap-2" },
        // BE chưa xác minh param session cho getAIAlertsFeed → disabled + tooltip, không bịa behavior
        e(
          "button",
          {
            disabled: true,
            title: t("aiAdvisor.panel.comingSoon"),
            className: "rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs font-bold text-slate-500 cursor-not-allowed",
          },
          t("aiAdvisor.panel.viewPrevSession")
        ),
        e(
          "button",
          {
            onClick: fetchFeed,
            className: "btn-nowrap rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20",
          },
          // Was labelled "Chạy phân tích" / "Run analysis" but this handler is
          // the same fetchFeed as the header refresh button — no analysis is
          // triggered. Relabelled to state the real action.
          t("aiAdvisor.panel.rescan")
        )
      )
    ),
    // S4.2 — Alert list delegated scroll: panel-body flex:1 min-h-0 overflow:auto + mask
    e(
      "div",
      { className: "panel-body space-y-3 panel-scrollbar px-1" },
      alerts.map((alert) => {
        const glowClass = getPulseGlowClass(alert);
        const rsi = alert?.metadata?.rsi || alert?.evidence?.rsi || alert?.evidence?.rsi_at_signal;
        const SeverityIcon = getSeverityIcon(alert.severity);
        const TrendIcon = getTrendIcon(alert.direction);

        return e(
          "div",
          { key: alert.alert_id, className: `rounded-xl border p-4 transition-all ${glowClass} bg-slate-900/40 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/50` },
          e(
            "div",
            { className: "flex items-start justify-between gap-3 mb-2" },
            e(
              "div",
              { className: "flex items-center gap-2.5 flex-1 min-w-0" },
              e("span", { className: "font-semibold text-slate-100 text-sm truncate" }, alert.symbol),
              e(
                "span",
                { className: `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getSeverityColor(alert.severity)} whitespace-nowrap flex-shrink-0` },
                e(SeverityIcon, { className: "h-3 w-3" }),
                resolveSeverityLabel(alert.severity)
              )
            ),
            e("span", { className: "text-xs text-slate-500 whitespace-nowrap flex-shrink-0" }, alert.session_date)
          ),
          e("h4", { className: "text-sm font-medium text-slate-200 mb-1.5 line-clamp-1" }, alert.title),
          e("p", { className: "text-xs text-slate-400 mb-3 line-clamp-2" }, alert.body || alert.summary),
          e(
            "div",
            { className: "flex flex-wrap items-center gap-3 text-xs" },
            e(
              "div",
              { className: "flex items-center gap-1.5 text-slate-400" },
              e("span", { className: "font-medium" }, t("aiAdvisor.metric.moneyFlow")),
              e("span", { className: "font-bold text-slate-200" }, `${formatValue(alert.value)} ${t("aiAdvisor.unit.vnd")}`)
            ),
            e(
              "div",
              { className: "flex items-center gap-1.5" },
              e("span", { className: "font-medium text-slate-400" }, t("aiAdvisor.metric.trend")),
              e(
                "span",
                { className: `flex items-center gap-1 font-bold ${getTrendColor(alert.direction)}` },
                e(TrendIcon, { className: "h-3 w-3" }),
                resolveTrendLabel(alert.direction)
              )
            ),
            rsi != null && e(
              "div",
              { className: "flex items-center gap-1.5 text-slate-400" },
              e("span", { className: "font-medium" }, t("aiAdvisor.metric.rsi")),
              e("span", { className: "font-bold text-slate-100" }, parseFloat(rsi).toFixed(1))
            )
          )
        );
      })
    )
  );
}
