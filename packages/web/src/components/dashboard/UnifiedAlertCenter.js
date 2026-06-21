/**
 * UnifiedAlertCenter — DM-09
 * Alert lane component for dashboard triad layout.
 * Uses createElement (no JSX) per packages/web convention.
 * Updated with Bento Card styling and commercial-grade spacing.
 */
import { createElement, useMemo, useState } from "react";
import { Bell, Filter, X } from "lucide-react";

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
    "alert.clearFilters": "Xóa bộ lọc",
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
    "alert.clearFilters": "Clear filters",
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

  const hasActiveFilters = severityFilter !== "all" || sourceFilter !== "all";

  return e(
    "div",
    { className: `dashboard-triad-lane flex flex-col ${className}` },
    // Header with title, unread count, and filter controls
    e(
      "div",
      { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-800/50" },
      e(
        "div",
        { className: "flex items-center gap-3" },
        e("h3", { className: "text-base font-bold text-slate-100 flex items-center gap-2" },
          e(Bell, { className: "h-5 w-5 text-cyan-400" }),
          t("alert.title")
        ),
        unreadAlertCount > 0 &&
          e("span", { className: "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30" }, unreadAlertCount)
      ),
      e(
        "div",
        { className: "flex flex-wrap items-center gap-2" },
        // Severity filter pills
        e(
          "div",
          { className: "flex flex-wrap gap-1.5" },
          severityFilters.map((f) =>
            e(
              "button",
              {
                key: f.value,
                onClick: () => {
                  setSeverityFilter?.(f.value);
                  onSeverityFilterChange?.(f.value);
                },
                className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  severityFilter === f.value
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800/50"
                }`,
                "aria-pressed": severityFilter === f.value,
              },
              f.label
            )
          )
        ),
        // Clear filters button
        hasActiveFilters && e(
          "button",
          {
            onClick: () => {
              setSeverityFilter?.("all");
              onSeverityFilterChange?.("all");
              setSourceFilter?.("all");
            },
            className: "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/50 transition-all whitespace-nowrap",
            "aria-label": t("alert.clearFilters"),
          },
          e(X, { className: "h-3.5 w-3.5" }),
          e("span", { className: "hidden sm:inline" }, t("alert.clearFilters"))
        )
      )
    ),
    // Alert list
    e(
      "div",
      { className: "flex-1 overflow-y-auto core-alert-list space-y-2 panel-scrollbar" },
      filteredAlerts.length === 0
        ? e(
            "div",
            { className: "flex flex-col items-center justify-center h-full text-center px-4 py-8" },
            e(Bell, { className: "h-12 w-12 text-slate-700/50 mb-3" }),
            e("p", { className: "text-slate-500 text-sm" }, t("alert.empty"))
          )
        : filteredAlerts.map((alert) =>
            e(
              "div",
              {
                key: alert.id || `${alert.symbol}-${alert.ts}`,
                onClick: () => {
                  if (alert.symbol) onSelectSymbol?.(alert.symbol);
                  if (alert.id && markAlertAsRead) markAlertAsRead(alert.id);
                },
                className: `p-4 rounded-xl border cursor-pointer transition-all hover:bg-slate-800/50 hover:border-slate-700/50 ${
                  readAlertIds.has(alert.id)
                    ? "border-slate-700/30 bg-slate-900/30"
                    : `border-slate-700/50 bg-slate-800/40 ${severityColor(alert.severity)}`
                }`,
              },
              e(
                "div",
                { className: "flex items-start justify-between gap-3 mb-2" },
                e(
                  "div",
                  { className: "flex items-center gap-2.5 flex-1 min-w-0" },
                  e("span", { className: "font-semibold text-slate-100 text-sm truncate" }, alert.symbol || "—"),
                  e("span", { className: `text-xs px-2 py-0.5 rounded border ${severityColor(alert.severity)} whitespace-nowrap flex-shrink-0` }, sourceLabel(alert.source, t))
                ),
                e("span", { className: "text-xs text-slate-500 whitespace-nowrap flex-shrink-0" }, timeAgo(alert.ts || alert.timestamp))
              ),
              alert.message && e("p", { className: "text-xs text-slate-300 line-clamp-2 mb-2" }, alert.message),
              alert.severity &&
                e("span", { className: `text-xs inline-block px-2 py-0.5 rounded ${severityColor(alert.severity)}` }, t(`alert.severity.${alert.severity}`))
            )
          )
    )
  );
}