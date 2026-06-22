/**
 * UnifiedAlertCenter — DM-09
 * Alert lane component for dashboard triad layout.
 * Uses createElement (no JSX) per packages/web convention.
 * Updated with Bento Card styling and commercial-grade spacing.
 */
import { createElement, useMemo, useState } from "react";
import { Bell, Filter, X, ChevronLeft, ChevronRight, Flame } from "lucide-react";

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
    "alert.prevPage": "Trang trước",
    "alert.nextPage": "Trang sau",
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
    "alert.prevPage": "Previous page",
    "alert.nextPage": "Next page",
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

function severityCardStyles(severity, isRead) {
  if (isRead) {
    return "border-slate-800/80 bg-slate-900/30 border-l-2 border-l-slate-700 opacity-60 hover:opacity-100";
  }
  switch (severity) {
    case "critical":
      return "border-slate-700/60 bg-red-950/10 border-l-4 border-l-red-500 hover:bg-red-950/20";
    case "high":
      return "border-slate-700/60 bg-orange-950/10 border-l-4 border-l-orange-500 hover:bg-orange-950/20";
    case "medium":
      return "border-slate-700/60 bg-yellow-950/10 border-l-4 border-l-yellow-600 hover:bg-yellow-950/20";
    case "low":
      return "border-slate-700/60 bg-emerald-950/10 border-l-4 border-l-emerald-600 hover:bg-emerald-950/20";
    default:
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-slate-500 hover:bg-slate-800/40";
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
  const unreadAlertCount = unreadCount ?? safeAlerts.filter((item) => !readAlertIds.has(item.alert_id || item.id)).length;

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

  const severityCounts = useMemo(() => {
    const counts = { all: safeAlerts.length, critical: 0, high: 0, medium: 0, low: 0 };
    safeAlerts.forEach((a) => {
      const sev = a?.severity;
      if (sev && counts[sev] !== undefined) {
        counts[sev]++;
      }
    });
    return counts;
  }, [safeAlerts]);

  const severityFilters = [
    {
      value: "all",
      label: t("alert.severity.all"),
      icon: Bell,
      activeClass: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10",
      inactiveClass: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800/50",
      iconClass: "text-cyan-400"
    },
    {
      value: "critical",
      label: t("alert.severity.critical"),
      icon: Flame,
      activeClass: "bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10",
      inactiveClass: "text-red-400/80 hover:text-red-300 hover:bg-red-950/30 border border-red-900/30",
      iconClass: "text-red-400"
    },
    {
      value: "high",
      label: t("alert.severity.high"),
      icon: Flame,
      activeClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm shadow-orange-500/10",
      inactiveClass: "text-orange-400/80 hover:text-orange-300 hover:bg-orange-950/30 border border-orange-900/30",
      iconClass: "text-orange-400"
    },
    {
      value: "medium",
      label: t("alert.severity.medium"),
      icon: Bell,
      activeClass: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-sm shadow-yellow-500/10",
      inactiveClass: "text-yellow-400/80 hover:text-yellow-300 hover:bg-yellow-950/30 border border-yellow-900/30",
      iconClass: "text-yellow-400"
    },
    {
      value: "low",
      label: t("alert.severity.low"),
      icon: Bell,
      activeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10",
      inactiveClass: "text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/30 border border-emerald-900/30",
      iconClass: "text-emerald-400"
    },
  ];

  const hasActiveFilters = severityFilter !== "all" || sourceFilter !== "all";

  return e(
    "div",
    { className: `dashboard-triad-lane flex flex-col ${className}` },
    // Header with title, unread count, and filter controls
    e(
      "div",
      { className: "flex flex-col gap-3 mb-4 pb-3 border-b border-slate-800/50" },
      // Row 1: Title & Clear Filters button
      e(
        "div",
        { className: "flex items-center justify-between w-full" },
        e(
          "div",
          { className: "flex items-center gap-3" },
          e("h3", { className: "text-base font-bold text-slate-100 flex items-center gap-2" },
            e(Bell, { className: "h-5 w-5 text-cyan-400" }),
            t("alert.title")
          ),
          unreadAlertCount > 0 &&
            e("span", { className: "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30" }, unreadAlertCount)
        ),
        hasActiveFilters && e(
          "button",
          {
            onClick: () => {
              setSeverityFilter?.("all");
              onSeverityFilterChange?.("all");
              setSourceFilter?.("all");
            },
            className: "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/50 transition-all",
            "aria-label": t("alert.clearFilters"),
          },
          e(X, { className: "h-3 w-3" }),
          t("alert.clearFilters")
        )
      ),
      // Row 2: Severity pills
      e(
        "div",
        { className: "flex flex-wrap items-center gap-1.5 w-full" },
        severityFilters.map((f) => {
          const isActive = severityFilter === f.value;
          const count = severityCounts[f.value] || 0;
          return e(
            "button",
            {
              key: f.value,
              onClick: () => {
                setSeverityFilter?.(f.value);
                onSeverityFilterChange?.(f.value);
              },
              className: `flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                isActive ? f.activeClass : f.inactiveClass
              }`,
              "aria-pressed": isActive,
              title: f.label,
            },
            e(f.icon, { className: `h-3.5 w-3.5 ${f.iconClass}` }),
            count > 0 ? `(${count})` : ""
          );
        })
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
        : filteredAlerts.map((alert) => {
            const alertId = alert.alert_id || alert.id;
            const isUnread = !readAlertIds.has(alertId);

            // Construct metadata chips
            const metadataChips = [];
            if (alert.direction) {
              const isUp = ["buy", "long", "up"].includes(alert.direction.toLowerCase());
              metadataChips.push(
                e(
                  "span",
                  {
                    key: "dir",
                    className: `inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isUp
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`,
                  },
                  isUp ? "↑ MUA" : "↓ BÁN"
                )
              );
            }

            if (alert.value != null && Number(alert.value) > 0) {
              const val = Number(alert.value);
              const formattedVal = val >= 1e9
                ? `${(val / 1e9).toFixed(1)} tỷ`
                : val >= 1e6
                ? `${(val / 1e6).toFixed(1)} triệu`
                : val.toLocaleString("vi-VN");
              metadataChips.push(
                e(
                  "span",
                  {
                    key: "val",
                    className: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/50",
                  },
                  `Giá trị: ${formattedVal}`
                )
              );
            }

            if (alert.confidence != null) {
              const confVal = Number(alert.confidence);
              const confPct = confVal <= 1 ? Math.round(confVal * 100) : Math.round(confVal);
              metadataChips.push(
                e(
                  "span",
                  {
                    key: "conf",
                    className: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-950/20 text-cyan-400 border border-cyan-500/10",
                  },
                  `Tin cậy: ${confPct}%`
                )
              );
            }

            if (alert.session_date) {
              metadataChips.push(
                e(
                  "span",
                  {
                    key: "session",
                    className: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/30",
                  },
                  `Phiên: ${alert.session_date}`
                )
              );
            }

            // Construct action buttons
            const actionButtons = [];
            if (isUnread && markAlertAsRead) {
              actionButtons.push(
                e(
                  "button",
                  {
                    key: "read",
                    onClick: (evt) => {
                      evt.stopPropagation();
                      markAlertAsRead(alertId);
                    },
                    className: "px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded transition-all",
                  },
                  t("alert.markRead")
                )
              );
            }

            if (alert.symbol && muteSymbolFor30m) {
              actionButtons.push(
                e(
                  "button",
                  {
                    key: "mute",
                    onClick: (evt) => {
                      evt.stopPropagation();
                      muteSymbolFor30m(alert.symbol);
                    },
                    className: "px-2 py-0.5 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/50 rounded transition-all",
                  },
                  `Tắt 30p`
                )
              );
            }

            const actionsRow = actionButtons.length > 0 && e("div", { className: "flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/40" }, actionButtons);

            return e(
              "div",
              {
                key: alertId || `${alert.symbol}-${alert.ts || alert.triggered_at}`,
                onClick: () => {
                  if (alert.symbol) onSelectSymbol?.(alert.symbol);
                  if (alertId && markAlertAsRead) markAlertAsRead(alertId);
                },
                className: `p-4 rounded-xl border cursor-pointer transition-all ${
                  severityCardStyles(alert.severity, !isUnread)
                }`,
              },
              e(
                "div",
                { className: "flex items-start justify-between gap-3 mb-2" },
                e(
                  "div",
                  { className: "flex items-center gap-2.5 flex-1 min-w-0" },
                  e("span", { className: "font-semibold text-slate-100 text-sm truncate" }, alert.symbol || "—"),
                  e("span", { className: `text-[10px] px-2 py-0.5 rounded border ${
                    alert.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    alert.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    alert.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  } whitespace-nowrap flex-shrink-0` }, sourceLabel(alert.alert_family || alert.alert_type || alert.source, t))
                ),
                e("span", { className: "text-xs text-slate-500 whitespace-nowrap flex-shrink-0" }, timeAgo(alert.triggered_at || alert.ts || alert.timestamp))
              ),
              (alert.body || alert.message || alert.summary) && e("p", { className: "text-xs text-slate-300 leading-relaxed mb-2" }, alert.body || alert.message || alert.summary),
              // Metadata chips strip
              metadataChips.length > 0 && e("div", { className: "flex flex-wrap gap-1.5 mt-2" }, metadataChips),
              // Actions strip
              actionsRow
            );
          })
    ),
    // Pagination controls
    e(
      "div",
      { className: "flex items-center justify-between pt-3 mt-2 border-t border-slate-800/50" },
      e(
        "div",
        { className: "flex items-center gap-1" },
        e(
          "button",
          {
            onClick: () => goToPreviousUnifiedPage?.(),
            disabled: !hasPreviousUnifiedPage,
            className: `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              hasPreviousUnifiedPage
                ? "text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 border border-slate-700/50"
                : "text-slate-600 cursor-not-allowed border border-slate-800/30"
            }`,
            "aria-label": t("alert.prevPage"),
          },
          e(ChevronLeft, { className: "h-3.5 w-3.5" }),
          t("alert.prevPage")
        )
      ),
      e(
        "div",
        { className: "flex items-center gap-1" },
        e(
          "button",
          {
            onClick: () => goToNextUnifiedPage?.(),
            disabled: !backendUnifiedHasMore,
            className: `flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              backendUnifiedHasMore
                ? "text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 border border-slate-700/50"
                : "text-slate-600 cursor-not-allowed border border-slate-800/30"
            }`,
            "aria-label": t("alert.nextPage"),
          },
          t("alert.nextPage"),
          e(ChevronRight, { className: "h-3.5 w-3.5" })
        )
      )
    )
  );
}