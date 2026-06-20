/**
 * AlertCenterPage
 * SaaS Native Hub hợp nhất cho alert-center trong packages/web.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import React from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { SummaryMetrics } from "../components/alert-center/SummaryMetrics.js";
import { AlertCard } from "../components/alert-center/AlertCard.js";
import { SymbolStatsTable } from "../components/alert-center/SymbolStatsTable.js";
import { DetailDrawer } from "../components/alert-center/DetailDrawer.js";
import { CORE_STYLES } from "./AlertCenterPage.styles.js";
import { useAlertCenterData } from "../hooks/useAlertCenterData.js";

// Bypassing host webpack CSS module limitations by using a Proxy that returns class names directly,
// and injecting global styles via a dynamically rendered <style> tag.
const styles = new Proxy({}, {
  get: (target, prop) => prop
});

const { createElement, useEffect, useRef, useState, useCallback } = React;
const e = createElement;
const DEFAULT_ENV = {};

const LANE_OPTIONS = Object.freeze([
  { value: "main", label: "Luồng chính" },
  { value: "ai", label: "AI Alerts / AI Suggests" },
]);

const WINDOW_OPTIONS = Object.freeze([
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "session", label: "Phiên" },
  { value: "5d", label: "5d" },
]);

const SORT_OPTIONS = Object.freeze([
  { value: "latest", label: "Mới nhất" },
  { value: "largestValue", label: "Giá trị lớn nhất" },
]);

function formatAlertValue(value) {
  if (value == null || value === "") {
    return "—";
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString("vi-VN") : String(value);
}

function formatAlertTimestamp(value) {
  if (!value) {
    return "—";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }
  return timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + timestamp.toLocaleDateString("vi-VN");
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}


export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }) {
  const cn = (cls) => `${styles[cls]} ${className}`.trim();
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");
  const [sorting, setSorting] = useState("latest");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState("");
  const [activeDetail, setActiveDetail] = useState(null);
  const [activeContext, setActiveContext] = useState(null);
  const [actionError, setActionError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState("");
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [searchTermModule2, setSearchTermModule2] = useState("");
  const [pageFeed, setPageFeed] = useState(1);
  const [pageStats, setPageStats] = useState(1);

  const { loading, error, payload, summary, symbolStats } = useAlertCenterData({
    env,
    lane,
    symbol: appliedSymbol,
    sessionDate,
    timeframe,
    refreshToken
  });

  const rawAlerts = payload?.results ?? [];
  const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];

  // Reset pagination on filter or search updates
  useEffect(() => {
    setPageFeed(1);
  }, [lane, appliedSymbol, sessionDate, timeframe, sorting]);

  useEffect(() => {
    setPageStats(1);
  }, [searchTermModule2, symbolStats?.pagination?.total_symbols, lane, appliedSymbol, sessionDate, timeframe]);

  // Polling mechanism
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setRefreshToken((r) => r + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle spin anim on manual refresh
  const triggerManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshToken((r) => r + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  // Sort alerts dynamically
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sorting === "largestValue") {
      const valA = Number(a?.value || 0);
      const valB = Number(b?.value || 0);
      return valB - valA;
    }
    // Default: triggered_at descending
    const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : 0;
    const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : 0;
    return timeB - timeA;
  });

  // Module 2: Symbol statistics from backend truth endpoint
  const aggregatedSymbols = (Array.isArray(symbolStats?.symbols) ? symbolStats.symbols : []).map((item) => {
    const mapped = {
      symbol: normalizeSymbol(item?.symbol || "UNKNOWN"),
      count: Number(item?.count || 0),
      buyCount: Number(item?.buy_count || 0),
      sellCount: Number(item?.sell_count || 0),
      neutralCount: Number(item?.neutral_count || 0),
      totalValue: Number(item?.total_value || 0),
      severities: {
        critical: Number(item?.by_severity?.critical || 0),
        high: Number(item?.by_severity?.high || 0),
        medium: Number(item?.by_severity?.medium || 0),
        low: Number(item?.by_severity?.low || 0),
      },
      latestTime: item?.latest_triggered_at ? new Date(item.latest_triggered_at).getTime() : 0,
      familiesList: "",
    };

    let freq = "Thấp";
    if (mapped.count >= 8) freq = "Bùng nổ";
    else if (mapped.count >= 4) freq = "Cao";
    else if (mapped.count >= 2) freq = "Trung bình";

    return {
      ...mapped,
      freq,
    };
  }).filter((item) => {
    if (!searchTermModule2) return true;
    return item.symbol.includes(searchTermModule2.trim().toUpperCase());
  });

  function handleApply(event) {
    event.preventDefault();
    setAppliedSymbol(normalizeSymbol(symbolDraft));
  }

  async function handleLoadDetail(alert) {
    if (!alert?.alert_id || !alert?.symbol) return;
    setActionError("");
    setBusyAlertId(alert.alert_id);
    try {
      const adapter = coreApiAdapter;
      const [detail, context] = await Promise.all([
        adapter.getAlertCenterEventDetail(alert.alert_id),
        adapter.getAlertCenterSymbolContext(alert.symbol),
      ]);
      setActiveAlertId(alert.alert_id);
      setActiveDetail(detail || null);
      setActiveContext(context || null);
    } catch (actionErr) {
      setActionError(actionErr?.message || "Không thể tải chi tiết alert.");
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleAcknowledge(alert) {
    if (!alert?.alert_id) return;
    setActionError("");
    setBusyAlertId(alert.alert_id);
    try {
      const adapter = coreApiAdapter;
      await adapter.acknowledgeAlertCenterEvent(alert.alert_id);
      setRefreshToken((value) => value + 1);
    } catch (actionErr) {
      setActionError(actionErr?.message || "Không thể xác nhận alert.");
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleMuteSymbol(alert) {
    if (!alert?.symbol) return;
    setActionError("");
    setBusyAlertId(alert.alert_id || alert.symbol);
    try {
      const adapter = coreApiAdapter;
      await adapter.muteAlertCenterPreference({
        symbol: alert.symbol,
        alert_family: alert.alert_family || alert.alert_type || "",
        mute_minutes: 30,
      });
      setRefreshToken((value) => value + 1);
    } catch (actionErr) {
      setActionError(actionErr?.message || "Không thể tắt tiếng cảnh báo mã.");
    } finally {
      setBusyAlertId("");
    }
  }

  const toggleEvidence = (alertId) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [alertId]: !prev[alertId],
    }));
  };

  const highSeverityCount = Number(summary?.by_severity?.high || 0) + Number(summary?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter((alert) => alert?.alert_family === "ai_suggest" || alert?.alert_type === "ai_suggest").length;

  const ITEMS_PER_PAGE_FEED = 5;
  const ITEMS_PER_PAGE_STATS = 8;

  const totalPagesFeed = Math.ceil(sortedAlerts.length / ITEMS_PER_PAGE_FEED) || 1;
  const activePageFeed = Math.min(pageFeed, totalPagesFeed);
  const startIndexFeed = (activePageFeed - 1) * ITEMS_PER_PAGE_FEED;
  const paginatedAlerts = sortedAlerts.slice(startIndexFeed, startIndexFeed + ITEMS_PER_PAGE_FEED);

  const totalPagesStats = Math.ceil(aggregatedSymbols.length / ITEMS_PER_PAGE_STATS) || 1;
  const activePageStats = Math.min(pageStats, totalPagesStats);
  const startIndexStats = (activePageStats - 1) * ITEMS_PER_PAGE_STATS;
  const paginatedSymbols = aggregatedSymbols.slice(startIndexStats, startIndexStats + ITEMS_PER_PAGE_STATS);

  function renderPagination(currentPage, totalPages, setCurrentPage) {
    if (totalPages <= 1) return null;
    return e("div", { className: "core-pagination-controls" }, [
      e("button", {
        key: "first",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(1),
        title: "Đầu"
      }, "«"),
      e("button", {
        key: "prev",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(Math.max(1, currentPage - 1)),
        title: "Trước"
      }, "‹"),
      e("span", {
        key: "info",
        className: "core-pagination-info"
      }, `Trang ${currentPage} / ${totalPages}`),
      e("button", {
        key: "next",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(Math.min(totalPages, currentPage + 1)),
        title: "Sau"
      }, "›"),
      e("button", {
        key: "last",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(totalPages),
        title: "Cuối"
      }, "»")
    ]);
  }

  return e("div", { className: `${styles["core-alert-center-page"]} ${className}`.trim() }, [
    e("style", { key: "global-styles", dangerouslySetInnerHTML: { __html: CORE_STYLES } }),
    // ── Header Section ────────────────────────────────────────────────────────
    e("header", { key: "header", className: styles["core-alert-center-header"] }, [
      e("div", { key: "title-container" }, [
        e("h1", { key: "title" }, "Whale Alerts Workspace"),
        e(
          "p",
          { key: "subtitle", className: styles["core-alert-center-subtitle"] },
          "Đại bản doanh whale, dark-flow & Price Shock theo chuẩn OpenAPI."
        ),
      ]),
      e("div", { key: "live-indicator-container", style: { display: "flex", alignItems: "center", gap: "15px" } }, [
        // Blinking LIVE badge with status trigger
        e(
          "div",
          {
            key: "live-badge",
            className: `${styles["core-alert-live-badge"]} ${!autoRefresh ? styles["is-paused"] : ""}`.trim(),
            style: { cursor: "pointer" },
            onClick: () => setAutoRefresh(!autoRefresh),
            title: autoRefresh ? "Bấm để dừng tự động cập nhật" : "Bấm để bật tự động cập nhật"
          },
          [
            e("div", { key: "dot", className: styles["core-alert-live-dot"] }),
            autoRefresh ? "LIVE (5s)" : "PAUSED",
          ]
        ),
        // Filter Form
        e("form", { key: "filters", className: styles["core-alert-center-filter-bar"], onSubmit: handleApply }, [
          e("label", { key: "symbol-label", className: styles["core-alert-center-filter-field"] }, [
            e("span", { key: "symbol-text" }, "Lọc Mã"),
            e("input", {
              key: "symbol-input",
              type: "text",
              value: symbolDraft,
              maxLength: 10,
              placeholder: "Ví dụ: HPG",
              onChange: (event) => setSymbolDraft(normalizeSymbol(event.target.value)),
            }),
          ]),
          e("button", { key: "apply", type: "submit" }, "Lọc feed"),
        ]),
      ]),
    ]),

    // ── Combined Control Bar (Lane Switcher & Timeframe Strip) ────────────────
    e("section", { key: "combined-controls", className: "core-alert-combined-controls" }, [
      e("div", { key: "lane-block", className: "core-alert-lane-block" }, [
        ...LANE_OPTIONS.map((option) =>
          e(
            "button",
            {
              key: option.value,
              type: "button",
              className: `core-alert-center-lane-button ${lane === option.value ? "is-active" : ""}`.trim(),
              onClick: () => {
                setLane(option.value);
                setActiveDetail(null);
              },
            },
            option.label
          )
        ),
      ]),
      e("div", { key: "time-strip", className: "core-alert-time-strip" }, [
        e("span", { key: "lbl", className: "core-alert-time-label" }, "Phạm Vi Thời Gian:"),
        ...WINDOW_OPTIONS.map((w) =>
          e(
            "button",
            {
              key: w.value,
              type: "button",
              className: `core-alert-time-btn ${timeframe === w.value ? "is-active" : ""}`.trim(),
              onClick: () => setTimeframe(w.value),
            },
            w.label
          )
        ),
      ]),
    ]),

    // ── Summary Metrics Strip ────────────────────────────────────────────────
    e(SummaryMetrics, {
      key: "summary-metrics",
      summary,
      alertsCount: alerts.length,
      highSeverityCount,
      aiSuggestCount,
      lane,
      appliedSymbol,
    }),

    loading && !isRefreshing ? e("p", { key: "loading", className: styles["core-loading"] }, "Đang tải dữ liệu cảnh báo từ Core API...") : null,
    error ? e("p", { key: "error", className: styles["core-error"] }, error) : null,
    actionError ? e("p", { key: "action-error", className: styles["core-error"] }, actionError) : null,

    // ── MAIN DUAL-COLUMN CONTAINER ──────────────────────────────────────────
    !loading || isRefreshing ? e("div", { key: "dashboard-container", className: styles["core-alert-dashboard-container"] }, [

      // ════ COLUMN 1: LIVE ALERTS FEED (Module 1) ════
      e("div", { key: "feed-column", className: styles["core-alert-feed-column"] }, [
        e("div", { className: styles["core-dashboard-panel"] }, [
          e("h2", { className: styles["core-section-title"] }, [
            "BẢNG TIN THỜI GIAN THỰC",
            e("span", { key: "sub", style: { fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal" } }, `Hiện thị ${alerts.length} sự kiện gần nhất`)
          ]),

          // Control Bar inside feed
          e("div", { className: styles["core-feed-control-bar"] }, [
            e("div", { className: styles["core-feed-control-left"] }, [
              ...SORT_OPTIONS.map((s) =>
                e(
                  "button",
                  {
                    key: s.value,
                    type: "button",
                    className: `${styles["core-feed-sort-btn"]} ${sorting === s.value ? styles["is-active"] : ""}`.trim(),
                    onClick: () => setSorting(s.value),
                  },
                  s.label
                )
              ),
            ]),
            e("div", { className: styles["core-feed-refresh-group"] }, [
              e("label", { className: styles["core-feed-auto-toggle"] }, [
                e("input", {
                  type: "checkbox",
                  checked: autoRefresh,
                  onChange: (event) => setAutoRefresh(event.target.checked),
                }),
                "Tự động làm mới",
              ]),
              e(
                "button",
                {
                  type: "button",
                  className: styles["core-feed-refresh-btn"],
                  onClick: triggerManualRefresh,
                },
                [
                  e("svg", {
                    key: "refresh-svg",
                    className: isRefreshing ? styles["is-spinning"] : "",
                    width: "12",
                    height: "12",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "3",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    style: { marginRight: "2px" }
                  }, [
                    e("path", { key: "p1", d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
                  ]),
                  " Làm mới",
                ]
              ),
            ]),
          ]),

          // Alerts Scrollable List Wrapper
          e("div", { className: styles["core-scrollable-container"] }, [
            paginatedAlerts.length === 0
              ? e("p", { className: styles["core-empty"] }, "Chưa có sự kiện cảnh báo nào phù hợp với bộ lọc hiện tại.")
              : e("div", { className: styles["core-alert-center-list"] },
                  paginatedAlerts.map((alert) =>
                    e(AlertCard, {
                      key: alert.alert_id,
                      alert,
                      lane,
                      busyAlertId,
                      isEvidenceExpanded: !!expandedEvidence[alert.alert_id],
                      toggleEvidence,
                      handleLoadDetail,
                      handleAcknowledge,
                      handleMuteSymbol,
                      formatAlertValue,
                      formatAlertTimestamp,
                    })
                  )
                )
          ]),
          renderPagination(activePageFeed, totalPagesFeed, setPageFeed)
        ])
      ]),

      // ════ COLUMN 2: STATISTICS BY SYMBOL (Module 2) ════
      e("div", { key: "stats-column", className: styles["core-alert-stats-column"] }, [
        e(SymbolStatsTable, {
          paginatedSymbols,
          searchTermModule2,
          setSearchTermModule2,
          formatAlertValue,
        }),
        renderPagination(activePageStats, totalPagesStats, setPageStats)
      ])
    ]) : null,

    // ── Bottom forensic drawer inspector panel ────────────────────────────────
    e(DetailDrawer, {
      key: "detail-drawer",
      activeAlertId,
      activeDetail,
      activeContext,
      appliedSymbol,
      onClose: () => setActiveDetail(null),
    })
  ]);
}