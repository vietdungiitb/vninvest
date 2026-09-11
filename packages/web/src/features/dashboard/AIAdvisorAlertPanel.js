import { useState, useEffect, useCallback, createElement } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { RotateCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

const e = createElement;

const I18N = {
  vi: {
    "aiAdvisor.panel.title": "Trung Tâm Tín Hiệu AI Advisor",
    "aiAdvisor.panel.refresh": "Làm mới",
    "aiAdvisor.panel.loading": "Đang tải...",
    "aiAdvisor.panel.loadError": "Không thể tải danh sách cảnh báo AI.",
    "aiAdvisor.panel.initialLoading": "Đang phân tích dữ liệu dòng tiền và RSI...",
    "aiAdvisor.panel.empty": "Chưa ghi nhận tín hiệu cảnh báo AI nào trong phiên hiện tại.",
    "aiAdvisor.severity.critical": "Cực kỳ khẩn cấp",
    "aiAdvisor.severity.high": "Khẩn cấp",
    "aiAdvisor.severity.medium": "Trung bình",
    "aiAdvisor.severity.low": "Thấp",
    "aiAdvisor.metric.moneyFlow": "Dòng tiền:",
    "aiAdvisor.metric.trend": "Xu hướng:",
    "aiAdvisor.metric.rsi": "RSI Hiện Tại:",
    "aiAdvisor.trend.buy": "MUA",
    "aiAdvisor.trend.sell": "BÁN",
    "aiAdvisor.trend.neutral": "TRUNG LẬP",
    "aiAdvisor.unit.vnd": "VND",
    "aiAdvisor.unit.billion": "tỷ",
    "aiAdvisor.unit.million": "triệu",
  },
  en: {
    "aiAdvisor.panel.title": "AI Advisor Signal Center",
    "aiAdvisor.panel.refresh": "Refresh",
    "aiAdvisor.panel.loading": "Loading...",
    "aiAdvisor.panel.loadError": "Unable to load AI alerts.",
    "aiAdvisor.panel.initialLoading": "Analyzing money flow and RSI signals...",
    "aiAdvisor.panel.empty": "No AI alerts were detected in this trading session.",
    "aiAdvisor.severity.critical": "Critical",
    "aiAdvisor.severity.high": "High",
    "aiAdvisor.severity.medium": "Medium",
    "aiAdvisor.severity.low": "Low",
    "aiAdvisor.metric.moneyFlow": "Money flow:",
    "aiAdvisor.metric.trend": "Direction:",
    "aiAdvisor.metric.rsi": "Current RSI:",
    "aiAdvisor.trend.buy": "BUY",
    "aiAdvisor.trend.sell": "SELL",
    "aiAdvisor.trend.neutral": "NEUTRAL",
    "aiAdvisor.unit.vnd": "VND",
    "aiAdvisor.unit.billion": "billion",
    "aiAdvisor.unit.million": "million",
  },
};

export function resolveAiAdvisorLocale() {
  const browserLang =
    (typeof document !== "undefined" && document.documentElement?.lang) ||
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    "vi";
  return String(browserLang).toLowerCase().startsWith("en") ? "en" : "vi";
}

export function createAiAdvisorTranslator(locale = "vi") {
  const language = locale === "en" ? "en" : "vi";
  const dict = I18N[language];
  return {
    language,
    t: (key) => dict[key] || I18N.vi[key] || key,
  };
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
  const { t, language } = createAiAdvisorTranslator(resolveAiAdvisorLocale());
  const [alerts, setAlerts] = useState(propAlerts ?? []);
  const [loading, setLoading] = useState(propLoading ?? false);
  const [error, setError] = useState(null);

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
    } catch (err) {
      setError(err?.message || t("aiAdvisor.panel.loadError"));
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
    { className: `dashboard-triad-lane flex flex-col ${className}` },
    // Header
    e(
      "div",
      { className: "flex items-center justify-between mb-4 pb-3 border-b border-slate-800/50" },
      e("h3", { className: "text-base font-bold text-slate-100 flex items-center gap-2" },
        e(Activity, { className: "h-5 w-5 text-cyan-400" }),
        t("aiAdvisor.panel.title")
      ),
      e(
        "button",
        {
          onClick: fetchFeed,
          disabled: loading,
          className: `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
    // Empty state
    !loading && alerts.length === 0 && !error && e(
      "div",
      { className: "flex flex-col items-center justify-center flex-1 text-center px-4 py-8" },
      e(Activity, { className: "h-12 w-12 text-slate-700/50 mb-3" }),
      e("p", { className: "text-slate-500 text-sm" }, t("aiAdvisor.panel.empty"))
    ),
    // Alert list
    e(
      "div",
      { className: "flex-1 overflow-y-auto space-y-3 panel-scrollbar" },
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