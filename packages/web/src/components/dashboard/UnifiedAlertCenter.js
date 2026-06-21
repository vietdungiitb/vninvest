/**
 * UnifiedAlertCenter — DM-09
 * Alert lane component for dashboard triad layout.
 * Uses createElement (no JSX) per packages/web convention.
 */
import { createElement, useMemo, useState } from "react";

const e = createElement;

const I18N = {
  vi: {
    "alert.title": "Cảnh báo",
    "alert.empty": "Không có cảnh báo nào.",
    "alert.unread": "chưa đọc",
    "alert.source.whale": "Cá mập",
    "alert.source.dark_flow": "Dòng tối",
    "alert.source.price_shock": "Sốc giá",
    "alert.source.stale_quote": "Báo giá cũ",
    "alert.source.system": "Hệ thống",
    "alert.severity.critical": "Nghiêm trọng",
    "alert.severity.high": "Cao",
    "alert.severity.medium": "Trung bình",
    "alert.severity.low": "Thấp",
    "alert.severity.all": "Tất cả",
    "alert.markRead": "Đánh dấu đã đọc",
  },
  en: {
    "alert.title": "Alerts",
    "alert.empty": "No alerts.",
    "alert.unread": "unread",
    "alert.source.whale": "Whale",
    "alert.source.dark_flow": "Dark Flow",
    "alert.source.price_shock": "Price Shock",
    "alert.source.stale_quote": "Stale Quote",
    "alert.source.system": "System",
    "alert.severity.critical": "Critical",
    "alert.severity.high": "High",
    "alert.severity.medium": "Medium",
    "alert.severity.low": "Low",
    "alert.severity.all": "All",
    "alert.markRead": "Mark as read",
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

function sourceLabel(source, t) {
  const map = {
    whale: "alert.source.whale",
    dark_flow: "alert.source.dark_flow",
    price_shock: "alert.source.price_shock",
    stale_quote: "alert.source.stale_quote",
    system: "alert.source.system",
  };
  return t(map[source] || source || "alert.source.system");
}

function severityColor(severity) {
  switch (severity) {
    case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function UnifiedAlertCenter({
  alerts = [],
  alertSummary,
  readAlertIds = new Set(),
  markAlertAsRead,
  muteSymbolFor30m,
  severityFilter = "all",
  setSeverityFilter,
  onSeverityFilterChange,
  currentUnifiedPage = 1,
  hasPreviousUnifiedPage = false,
  backendUnifiedHasMore = false,
  loadingMoreUnified = false,
  goToFirstUnifiedPage,
  goToPreviousUnifiedPage,
  goToNextUnifiedPage,
  goToLastUnifiedPage,
  hasLastUnifiedPage = false,
  pageSize = 10,
  setPageSize,
  sourceFilter = "all",
  setSourceFilter,
  audienceFilter = "all",
  setAudienceFilter,
  unreadCount,
  showSummaryChips = false,
  minHeightClass = "min-h-[580px]",
  className = "",
  selectedSession,
  onSelectSession,
  selectedSymbol,
  onSelectSymbol,
}) {
  const t = createTranslator(resolveLocale());
  const [activeTab, setActiveTab] = useState("alerts");

  const safeAlerts = useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts]);
  const unreadAlertCount = unreadCount ?? safeAlerts.filter((item) => !readAlertIds.has(item.id)).length;

  const filteredAlerts = useMemo(() => {
    let result = safeAlerts;
    if (severityFilter !== "all") {
      result = result.filter((a) => a?.severity === severityFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((a) => a?.source === sourceFilter);
    }
    return result;
  }, [safeAlerts, severityFilter, sourceFilter]);

  const severityFilters = [
    { value: "all", label: t("alert.severity.all") },
    { value: "critical", label: t("alert.severity.critical") },
    { value: "high", label: t("alert.severity.high") },
    { value: "medium", label: t("alert.severity.medium") },
    { value: "low", label: t("alert.severity.low") },
  ];

  return e(
    "div",
    { className: `core-alert-center ${minHeightClass} ${className}` },
    e(
      "div",
      { className: "core-alert-header flex items-center justify-between mb-3" },
      e(
        "div",
        { className: "flex items-center gap-2" },
        e("h3", { className: "text-sm font-bold text-slate-100" }, t("alert.title")),
        unreadAlertCount > 0 &&
          e("span", { className: "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30" }, unreadAlertCount)
      ),
      e(
        "div",
        { className: "flex flex-wrap gap-1 items-center justify-end" },
        severityFilters.map((f) =>
          e(
            "button",
            {
              key: f.value,
              onClick: () => {
                setSeverityFilter?.(f.value);
                onSeverityFilterChange?.(f.value);
              },
              className: `px-2 py-1 rounded text-xs font-medium transition-all ${
                severityFilter === f.value
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`,
            },
            f.label
          )
        )
      )
    ),
    e(
      "div",
      { className: "core-alert-list space-y-2 max-h-[480px] overflow-y-auto" },
      filteredAlerts.length === 0
        ? e("p", { className: "text-slate-500 text-sm text-center py-8" }, t("alert.empty"))
        : filteredAlerts.map((alert) =>
            e(
              "div",
              {
                key: alert.id || `${alert.symbol}-${alert.ts}`,
                onClick: () => {
                  if (alert.symbol) onSelectSymbol?.(alert.symbol);
                  if (alert.id && markAlertAsRead) markAlertAsRead(alert.id);
                },
                className: `p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-800/50 ${
                  readAlertIds.has(alert.id) ? "border-slate-700/30 bg-slate-900/30" : `border-slate-700/50 bg-slate-800/40 ${severityColor(alert.severity)}`
                }`,
              },
              e(
                "div",
                { className: "flex items-center justify-between mb-1" },
                e(
                  "div",
                  { className: "flex items-center gap-2" },
                  e("span", { className: "font-semibold text-slate-100 text-sm" }, alert.symbol || "—"),
                  e("span", { className: `text-xs px-1.5 py-0.5 rounded border ${severityColor(alert.severity)}` }, sourceLabel(alert.source, t))
                ),
                e("span", { className: "text-xs text-slate-500" }, timeAgo(alert.ts || alert.timestamp))
              ),
              alert.message && e("p", { className: "text-xs text-slate-300 mt-1 line-clamp-2" }, alert.message),
              alert.severity &&
                e("span", { className: `text-xs mt-1 inline-block px-1.5 py-0.5 rounded ${severityColor(alert.severity)}` }, t(`alert.severity.${alert.severity}`))
            )
          )
    )
  );
}