/**
 * UnifiedAlertCenter — DM-09
 * Alert lane component for dashboard triad layout.
 * Uses createElement (no JSX) per packages/web convention.
 * Updated with Bento Card styling and commercial-grade spacing.
 */
import { createElement, useMemo, useState } from "react";
import { Bell, Filter, X, ChevronLeft, ChevronRight, Flame, Waves } from "lucide-react";
import { useI18n } from "../../context/LangContext.js";
import { formatVNDCompact, formatFullVND, formatSessionDate, formatTimeAgo } from "../../utils/formatMarket.js";

const e = createElement;



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
  // S5.4 — severity chỉ ở viền trái, nền trung tính (bỏ bg màu riêng trừ left border)
  if (isRead) {
    return "border-slate-800/80 bg-slate-900/30 border-l-2 border-l-slate-700 opacity-60 hover:opacity-100";
  }
  switch (severity) {
    case "critical":
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-red-500 hover:bg-slate-800/40";
    case "high":
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-orange-500 hover:bg-slate-800/40";
    case "medium":
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-yellow-600 hover:bg-slate-800/40";
    case "low":
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-emerald-600 hover:bg-slate-800/40";
    default:
      return "border-slate-700/60 bg-slate-800/30 border-l-4 border-l-slate-500 hover:bg-slate-800/40";
  }
}

// S5.1 — timeAgo chuyển vào formatMarket.js shared util (formatTimeAgo); giữ alias local để không đụng code cũ
function timeAgo(ts) {
  return formatTimeAgo(ts);
}

function formatExecutionTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
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
  loading = false,
  error = null,
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("alerts");

  const safeAlerts = useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts]);
  // Real unread count requires `unreadCount` or a populated `readAlertIds`.
  // The dashboard supplies neither, in which case this would silently degrade
  // to "everything is unread" — which is what the badge used to display while
  // its tooltip claimed "chưa đọc". The badge now shows the total, so compute
  // both and let each consumer state the truth about itself.
  const hasReadState = typeof unreadCount === "number" || readAlertIds.size > 0;
  const alertCount = safeAlerts.length;
  const unreadAlertCount = typeof unreadCount === "number"
    ? unreadCount
    : readAlertIds.size > 0
      ? safeAlerts.filter((item) => !readAlertIds.has(item.alert_id || item.id)).length
      : 0;

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
    { className: `flex flex-col h-full min-h-0 ${className}` },
    // S4.3 — One card layer: lane already is card, inner wrapper transparent (no bg/border/padding lane)
    // Header with title, unread count, and filter controls
    e(
      "div",
      { className: "panel-head flex flex-col gap-3 mb-4 pb-3 border-b border-slate-800/50" },
      // Row 1: Title & Clear Filters button
      e(
        "div",
        { className: "flex items-center justify-between w-full" },
        e(
          "div",
          { className: "flex items-center gap-3" },
          e("h3", { className: "panel-title text-base font-semibold text-slate-100 flex items-center gap-2" },
            e(Bell, { className: "h-5 w-5 text-cyan-400" }),
            t("alert.title")
          ),
          // The dashboard does not supply read state (no `readAlertIds`, no
          // `unreadCount`), so this badge is the TOTAL alert count, not the
          // unread count. The number itself is honest; only the tooltip was
          // lying ("20 chưa đọc" when nothing had been read). A red badge
          // next to the title also read as an alarm, which is wrong for a
          // plain total — hence the neutral tone.
          alertCount > 0 &&
            e("span", { className: "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700/60", title: t("alert.totalTooltip", { count: alertCount }) }, alertCount)
        ),
        e(
          "div",
          { className: "flex items-center gap-2" },
          e("a", { href: "/alert-center", className: "text-[11px] font-bold text-cyan-400 hover:text-cyan-300 whitespace-nowrap" }, `${t("alert.viewAll")} →`),
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
        )
      ),
      // Row 2: Severity pills — 1 hàng cuộn ngang, có nhãn + count (audit #14)
      e(
        "div",
        { className: "seg items-center gap-1.5 w-full", role: "group", "aria-label": t("alert.title") },
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
              }${!isActive && count === 0 ? " opacity-40" : ""}`,
              "aria-pressed": isActive,
              title: `${f.label} (${count})`,
            },
            e(f.icon, { className: `h-3.5 w-3.5 ${f.iconClass}` }),
            `${f.label} (${count})`
          );
        })
      )
    ),
    // Counter Hiển thị X/Y — khóa bất biến counts===cards khi filter=all
    e(
      "div",
      { className: "px-1 pb-1 text-[11px] text-slate-500 tabular-nums" },
      t("alert.showing", { shown: filteredAlerts.length, total: safeAlerts.length })
    ),
    // Alert list — không bao giờ trắng trơn: loading / lỗi / bị lọc hết / rỗng thật
    e(
      "div",
      { className: "panel-body core-alert-list space-y-2 panel-scrollbar px-1" },
      filteredAlerts.length === 0
        ? loading && safeAlerts.length === 0
          ? e(
            "div",
            { className: "flex flex-col items-center justify-center h-full text-center px-4 py-8" },
            e(Bell, { className: "h-8 w-8 text-slate-700/50 mb-2 animate-pulse" }),
            e("p", { className: "text-slate-400 text-sm" }, t("alert.loadingList"))
          )
          : error && safeAlerts.length === 0
            ? e(
              "div",
              { className: "flex flex-col items-center justify-center h-full text-center px-4 py-8" },
              e("p", { className: "text-rose-400 text-sm font-semibold" }, t("alert.loadError")),
              e("p", { className: "mt-1 text-xs text-slate-500" }, typeof error === "string" ? error : t("alert.retryHint"))
            )
            : safeAlerts.length > 0
              ? e(
                "div",
                { className: "flex flex-col items-center justify-center h-full text-center px-4 py-8" },
                e(Bell, { className: "h-8 w-8 text-slate-700/50 mb-2" }),
                e("p", { className: "text-slate-300 text-sm font-semibold" }, t("alert.filteredEmpty", { total: safeAlerts.length })),
                e(
                  "button",
                  {
                    onClick: () => {
                      setSeverityFilter?.("all");
                      onSeverityFilterChange?.("all");
                      setSourceFilter?.("all");
                    },
                    className: "mt-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20",
                  },
                  t("alert.clearFilters")
                )
              )
              : e(
                "div",
                { className: "flex flex-col items-center justify-center h-full text-center px-4 py-8" },
                e(Bell, { className: "h-12 w-12 text-slate-700/50 mb-3" }),
                e("p", { className: "text-slate-500 text-sm" }, t("alert.empty"))
              )
        : filteredAlerts.map((alert) => {
            const alertId = alert.alert_id || alert.id;
            // Without read state every card was implicitly "unread", which
            // happened to give the full-opacity severity border — the right
            // look, but for the wrong reason. Make it explicit so the styling
            // does not depend on an empty Set.
            const isUnread = hasReadState && !readAlertIds.has(alertId);

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
                  isUp ? `↑ ${t("alert.dirBuy")}` : `↓ ${t("alert.dirSell")}`
                )
              );
            }

            if (alert.value != null && Number(alert.value) > 0) {
              const val = Number(alert.value);
              metadataChips.push(
                e(
                  "span",
                  {
                    key: "val",
                    className: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/50",
                    title: formatFullVND(val),
                  },
                  `${t("alert.valLabel")}: ${formatVNDCompact(val)}`
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
                  `${t("alert.confLabel")}: ${confPct}%`
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
                    title: String(alert.session_date),
                  },
                  `${t("alert.sessionLabel")}: ${formatSessionDate(alert.session_date)}`
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
                  t("alert.mute30m")
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
                className: `alert-card p-3 rounded-xl border cursor-pointer transition-all ${
                  severityCardStyles(alert.severity, !isUnread)
                }`,
              },
              e(
                "div",
                { className: "alert-head flex items-start justify-between gap-3 mb-1.5" },
                e(
                  "div",
                  { className: "alert-head flex-1 items-center gap-2" },
                  e("span", { className: "alert-sym font-semibold text-slate-100 text-sm", style: { flex: "none" } }, alert.symbol || "—"),
                  e("span", { className: "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border bg-slate-800 text-slate-300 border-slate-700/50 whitespace-nowrap flex-shrink-0" }, e(Waves, { className: "h-3 w-3 text-slate-400", "aria-hidden": true }), sourceLabel(alert.alert_family || alert.alert_type || alert.source, t)),
                  alert.value != null && Number(alert.value) > 0 && e(
                    "span",
                    { className: "desc text-[11px] font-bold text-slate-200", title: formatFullVND(alert.value) },
                    `· ${formatVNDCompact(alert.value)}`
                  )
                ),
                e("span", { className: "time text-xs text-slate-500 whitespace-nowrap flex-shrink-0" },
                  alert.executed_at
                    ? formatExecutionTime(alert.executed_at) + " • " + timeAgo(alert.triggered_at || alert.ts || alert.timestamp)
                    : timeAgo(alert.triggered_at || alert.ts || alert.timestamp)
                )
              ),
              (alert.body || alert.message || alert.summary) && e("p", { className: "desc text-xs text-slate-300 leading-relaxed mb-1.5" }, alert.body || alert.message || alert.summary),
              // Metadata chips strip
              metadataChips.length > 0 && e("div", { className: "flex flex-wrap gap-1 mt-1.5" }, metadataChips),
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