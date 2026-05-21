/**
 * AlertCenterPage
 * SaaS Native Hub hợp nhất cho alert-center trong packages/web.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import React from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

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

function useAlertCenterData({ env = DEFAULT_ENV, lane = "main", symbol = "", sessionDate = "", timeframe = "", refreshToken = 0 } = {}) {
  const mountedRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: { results: [], next: null, previous: null },
    summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
    symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
  });

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        setState((currentState) => ({ ...currentState, loading: currentState.payload.results.length === 0, error: "" }));
        const adapter = coreApiAdapter;
        const query = { 
          symbol: symbol || undefined,
          session_date: sessionDate || undefined,
          timeframe: timeframe || undefined
        };
        
        const [payload, summary, symbolStats] = await Promise.all([
          lane === "ai" ? adapter.getAIAlertsFeed(query) : adapter.getAlertCenterFeed(query),
          lane === "ai" ? adapter.getAIAlertsSummary(query) : adapter.getAlertCenterSummary(query),
          lane === "ai"
            ? adapter.getAIAlertsSymbolStats({ ...query, page: 1, page_size: 200 })
            : adapter.getAlertCenterSymbolStats({ ...query, page: 1, page_size: 200 }),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: "",
          payload: {
            results: payload?.results ?? payload ?? [],
            next: payload?.next ?? null,
            previous: payload?.previous ?? null,
          },
          summary: {
            total: Number(summary?.total || 0),
            unseen: Number(summary?.unseen || 0),
            by_severity: {
              critical: Number(summary?.by_severity?.critical || 0),
              high: Number(summary?.by_severity?.high || 0),
              medium: Number(summary?.by_severity?.medium || 0),
              low: Number(summary?.by_severity?.low || 0),
            },
          },
          symbolStats: {
            symbols: Array.isArray(symbolStats?.symbols) ? symbolStats.symbols : [],
            total_alerts_in_scope: Number(symbolStats?.total_alerts_in_scope || 0),
            pagination: {
              page: Number(symbolStats?.pagination?.page || 1),
              page_size: Number(symbolStats?.pagination?.page_size || 200),
              total_pages: Number(symbolStats?.pagination?.total_pages || 1),
              total_symbols: Number(symbolStats?.pagination?.total_symbols || 0),
            },
          },
        });
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: error?.message || "Không thể tải alert center từ core API.",
          payload: { results: [], next: null, previous: null },
          summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
          symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
        });
      }
    }

    load();
    return () => {
      mountedRef.current = false;
    };
  }, [env, lane, symbol, sessionDate, timeframe, refreshToken]);

  return state;
}

export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }) {
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

  // Inject style block on mount and clean up on unmount to prevent browser style-reflow flashes
  useEffect(() => {
    const styleId = "core-alert-center-page-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = CORE_STYLES;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) {
        el.remove();
      }
    };
  }, []);

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

  return e("div", { className: `core-alert-center-page ${className}`.trim() }, [
    // ── Style Block Injection (Premium aesthetics dark theme) ────────────────
    

    // ── Header Section ────────────────────────────────────────────────────────
    e("header", { key: "header", className: "core-alert-center-header" }, [
      e("div", { key: "title-container" }, [
        e("h1", { key: "title" }, "Whale Alerts Workspace"),
        e(
          "p",
          { key: "subtitle", className: "core-alert-center-subtitle" },
          "Đại bản doanh whale, dark-flow & Price Shock theo chuẩn OpenAPI."
        ),
      ]),
      e("div", { key: "live-indicator-container", style: { display: "flex", alignItems: "center", gap: "15px" } }, [
        // Blinking LIVE badge with status trigger
        e(
          "div",
          { 
            key: "live-badge", 
            className: `core-alert-live-badge ${!autoRefresh ? "is-paused" : ""}`.trim(),
            style: { cursor: "pointer" },
            onClick: () => setAutoRefresh(!autoRefresh),
            title: autoRefresh ? "Bấm để dừng tự động cập nhật" : "Bấm để bật tự động cập nhật"
          },
          [
            e("div", { key: "dot", className: "core-alert-live-dot" }),
            autoRefresh ? "LIVE (5s)" : "PAUSED",
          ]
        ),
        // Filter Form
        e("form", { key: "filters", className: "core-alert-center-filter-bar", onSubmit: handleApply }, [
          e("label", { key: "symbol-label", className: "core-alert-center-filter-field" }, [
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
      e("div", { className: "core-alert-lane-block" }, [
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
      e("div", { className: "core-alert-time-strip" }, [
        e("span", { className: "core-alert-time-label" }, "Phạm Vi Thời Gian:"),
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
    e("section", { key: "summary", className: "core-alert-center-summary-grid" }, [
      renderSummaryCard("Tổng số alert", String(summary?.total ?? alerts.length)),
      renderSummaryCard("Chưa đọc", String(summary?.unseen ?? 0)),
      renderSummaryCard("Mức Cao & Siêu Cao", String(highSeverityCount), "severity-high"),
      renderSummaryCard("AI Suggest", String(aiSuggestCount), lane === "ai" ? "is-highlighted" : ""),
      renderSummaryCard("Bộ lọc mã", appliedSymbol || "Toàn bộ"),
    ]),

    loading && !isRefreshing ? e("p", { key: "loading", className: "core-loading" }, "Đang tải dữ liệu cảnh báo từ Core API...") : null,
    error ? e("p", { key: "error", className: "core-error" }, error) : null,
    actionError ? e("p", { key: "action-error", className: "core-error" }, actionError) : null,

    // ── MAIN DUAL-COLUMN CONTAINER ──────────────────────────────────────────
    !loading || isRefreshing ? e("div", { key: "dashboard-container", className: "core-alert-dashboard-container" }, [
      
      // ════ COLUMN 1: LIVE ALERTS FEED (Module 1) ════
      e("div", { key: "feed-column", className: "core-alert-feed-column" }, [
        e("div", { className: "core-dashboard-panel" }, [
          e("h2", { className: "core-section-title" }, [
            "BẢNG TIN THỜI GIAN THỰC",
            e("span", { style: { fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal" } }, `Hiện thị ${alerts.length} sự kiện gần nhất`)
          ]),
          
          // Control Bar inside feed
          e("div", { className: "core-feed-control-bar" }, [
            e("div", { className: "core-feed-control-left" }, [
              ...SORT_OPTIONS.map((s) =>
                e(
                  "button",
                  {
                    key: s.value,
                    type: "button",
                    className: `core-feed-sort-btn ${sorting === s.value ? "is-active" : ""}`.trim(),
                    onClick: () => setSorting(s.value),
                  },
                  s.label
                )
              ),
            ]),
            e("div", { className: "core-feed-refresh-group" }, [
              e("label", { className: "core-feed-auto-toggle" }, [
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
                  className: "core-feed-refresh-btn",
                  onClick: triggerManualRefresh,
                },
                [
                  // Simple SVG refresh icon
                  e("svg", {
                    className: isRefreshing ? "is-spinning" : "",
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
                    e("path", { d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
                  ]),
                  " Làm mới",
                ]
              ),
            ]),
          ]),

          // Alerts Scrollable List Wrapper
          e("div", { className: "core-scrollable-container" }, [
            paginatedAlerts.length === 0
              ? e("p", { className: "core-empty" }, "Chưa có sự kiện cảnh báo nào phù hợp với bộ lọc hiện tại.")
              : e("div", { className: "core-alert-center-list" },
                  paginatedAlerts.map((alert) => {
                    const isEvidenceExpanded = !!expandedEvidence[alert.alert_id];
                    const directionClass = String(alert?.direction || "").toLowerCase().includes("buy") || String(alert?.direction || "") === "mua" ? "direction-buy" : 
                                           String(alert?.direction || "").toLowerCase().includes("sell") || String(alert?.direction || "") === "bán" ? "direction-sell" : "";

                    return e("article", { key: alert.alert_id, className: `core-alert-center-card severity-${alert.severity || "medium"}` }, [
                      e("div", { className: "core-alert-center-card-top" }, [
                        e("div", null, [
                          e("h3", { className: "core-alert-center-card-title" }, alert.title || "Tín hiệu giao dịch bất thường"),
                          e("p", { className: "core-alert-center-card-meta" }, [
                            e("span", { className: "core-alert-symbol-badge" }, alert.symbol || "—"),
                            e("span", null, `· ${alert.alert_family || alert.alert_type || "—"} · Lane: ${alert.lane || lane}`),
                          ]),
                        ]),
                        e(
                          "span",
                          { className: `core-alert-center-badge severity-${alert.severity || "medium"}` },
                          alert.severity || "medium"
                        ),
                      ]),
                      e("p", { className: "core-alert-center-card-summary" }, alert.summary || alert.body || "Không có nội dung tóm tắt chi tiết."),
                      
                      // Key metrics strip
                      e("div", { className: "core-alert-center-card-metrics" }, [
                        e("span", null, [
                          "Giá trị: ", 
                          e("strong", null, `${formatAlertValue(alert.value)} VND`)
                        ]),
                        e("span", null, [
                          "Chiều: ", 
                          e("strong", { className: directionClass }, alert.direction || "—")
                        ]),
                        e("span", null, [
                          "Độ tin cậy: ", 
                          e("strong", null, alert.confidence != null ? `${alert.confidence}` : "—")
                        ]),
                        e("span", null, [
                          "Độ tươi: ", 
                          e("strong", null, alert.freshness_state || "—")
                        ]),
                        e("span", null, [
                          "Phiên khớp: ", 
                          e("strong", null, alert.session_date || "—")
                        ]),
                        e("span", null, [
                          "Thời điểm: ", 
                          e("strong", null, formatAlertTimestamp(alert.triggered_at))
                        ]),
                      ]),

                      // Expandable Evidence list
                      alert.evidence && Object.keys(alert.evidence).length > 0 ? e("div", { key: "evidence-wrapper" }, [
                        e(
                          "div",
                          { className: "core-evidence-header", onClick: () => toggleEvidence(alert.alert_id) },
                          [
                            e("span", null, "Xem bằng chứng bằng dữ liệu (evidence)"),
                            e("span", null, isEvidenceExpanded ? "▲ Ẩn" : "▼ Xem thêm")
                          ]
                        ),
                        isEvidenceExpanded ? renderEvidenceList(alert.evidence) : null
                      ]) : null,

                      // Action Buttons Footer
                      e("div", { className: "core-alert-card-actions" }, [
                        e(
                          "button",
                          {
                            type: "button",
                            className: "is-primary",
                            disabled: busyAlertId === alert.alert_id,
                            onClick: () => handleLoadDetail(alert),
                          },
                          busyAlertId === alert.alert_id ? "Đang tải..." : "Chi tiết"
                        ),
                        lane === "main"
                          ? e(
                              "button",
                              {
                                type: "button",
                                disabled: busyAlertId === alert.alert_id,
                                onClick: () => handleAcknowledge(alert),
                              },
                              "Đánh dấu đã xem"
                            )
                          : null,
                        e(
                          "button",
                          {
                            type: "button",
                            disabled: busyAlertId === (alert.alert_id || alert.symbol),
                            onClick: () => handleMuteSymbol(alert),
                          },
                          "Mute 30 phút"
                        ),
                      ]),
                    ]);
                  })
                )
          ]),
          renderPagination(activePageFeed, totalPagesFeed, setPageFeed)
        ])
      ]),

      // ════ COLUMN 2: STATISTICS BY SYMBOL (Module 2) ════
      e("div", { key: "stats-column", className: "core-alert-stats-column" }, [
        e("div", { className: "core-dashboard-panel" }, [
          e("h2", { className: "core-section-title", style: { borderLeftColor: "var(--neon-green)" } }, "THỐNG KÊ THEO MÃ CỔ PHIẾU"),
          
          // Search in stats panel
          e("div", { className: "core-symbol-stats-search" }, [
            e("input", {
              type: "text",
              value: searchTermModule2,
              maxLength: 10,
              placeholder: "Tìm nhanh mã (ví dụ: VNM)...",
              onChange: (event) => setSearchTermModule2(event.target.value.toUpperCase()),
            }),
          ]),

          e("div", { className: "core-scrollable-container" }, [
            paginatedSymbols.length === 0
              ? e("p", { className: "core-empty", style: { padding: "20px" } }, "Không có mã thống kê phù hợp.")
              : e("table", { className: "core-symbol-stats-table" }, [
                  e("thead", null, e("tr", null, [
                    e("th", null, "Mã CP"),
                    e("th", null, "Số Alert"),
                    e("th", null, "Mua / Bán"),
                    e("th", null, "Tần Suất"),
                    e("th", null, "Tổng Giá Trị"),
                  ])),
                  e("tbody", null, paginatedSymbols.map((item) => {
                    const buyPercent = item.count > 0 ? (item.buyCount / item.count) * 100 : 0;
                    const sellPercent = item.count > 0 ? (item.sellCount / item.count) * 100 : 0;
                    const neutralPercent = item.count > 0 ? (item.neutralCount / item.count) * 100 : 0;
                    
                    let freqClass = "freq-low";
                    if (item.freq === "Bùng nổ") freqClass = "freq-explosive";
                    else if (item.freq === "Cao") freqClass = "freq-high";
                    else if (item.freq === "Trung bình") freqClass = "freq-medium";

                    return e("tr", { key: item.symbol, className: "core-symbol-stats-row" }, [
                      // Ticker badge with link
                      e("td", null, 
                        e("a", { 
                          href: `/stocks/${item.symbol}`, 
                          className: "core-stats-symbol-badge",
                          title: "Mở Stock workspace chi tiết cho mã này"
                        }, [
                          item.symbol,
                          e("svg", {
                            width: "8",
                            height: "8",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "3"
                          }, [
                            e("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" })
                          ])
                        ])
                      ),
                      // Count of occurrences
                      e("td", { style: { fontWeight: "800", fontFamily: "monospace", fontSize: "0.9rem" } }, `${item.count} lần`),
                      // Buy/Sell strength bar
                      e("td", null, 
                        e("div", { className: "core-stats-strength-container" }, [
                          e("div", { className: "core-stats-strength-bar" }, [
                            buyPercent > 0 ? e("div", { className: "core-stats-strength-buy", style: { width: `${buyPercent}%` }, title: `Mua: ${item.buyCount} lần` }) : null,
                            sellPercent > 0 ? e("div", { className: "core-stats-strength-sell", style: { width: `${sellPercent}%` }, title: `Bán: ${item.sellCount} lần` }) : null,
                            neutralPercent > 0 ? e("div", { className: "core-stats-strength-neutral", style: { width: `${neutralPercent}%` }, title: `Khác: ${item.neutralCount} lần` }) : null,
                          ]),
                          e("div", { className: "core-stats-strength-text" }, [
                            e("span", { className: "direction-buy" }, `B:${item.buyCount}`),
                            e("span", { className: "direction-sell" }, `S:${item.sellCount}`),
                          ])
                        ])
                      ),
                      // Frequency level
                      e("td", null, 
                        e("span", { className: `core-stats-frequency-badge ${freqClass}` }, item.freq)
                      ),
                      // Matched Value
                      e("td", { style: { fontFamily: "monospace", color: "var(--neon-blue)", fontWeight: "600" } }, 
                        `${formatAlertValue(item.totalValue)}`
                      ),
                    ]);
                  }))
                ])
          ]),
          renderPagination(activePageStats, totalPagesStats, setPageStats)
        ])
      ])
    ]) : null,

    // ── Bottom forensic drawer inspector panel ────────────────────────────────
    activeDetail
      ? e("section", { key: "detail-panel", className: "core-detail-drawer" }, [
          e("div", { className: "core-detail-title-row" }, [
            e("h3", null, `Kính lúp kiểm tra pháp y: ${activeAlertId}`),
            e("button", { className: "core-detail-close-btn", onClick: () => setActiveDetail(null) }, "✕"),
          ]),
          
          e("div", { className: "core-detail-grid" }, [
            e("div", { className: "core-detail-section" }, [
              e("h4", null, "Nội dung & Tóm tắt"),
              e("p", null, activeDetail?.title || "Không có tiêu đề"),
              e("p", { style: { marginTop: "8px", fontSize: "0.85rem", color: "var(--text-muted)" } }, activeDetail?.summary || activeDetail?.body || "Không có tóm tắt chi tiết."),
            ]),
            
            activeContext ? e("div", { className: "core-detail-section" }, [
              e("h4", null, `Bối cảnh mã ${activeContext.symbol || appliedSymbol}`),
              e("div", { style: { display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" } }, [
                e("div", null, ["Tổng cảnh báo đang hoạt động: ", e("strong", null, String(activeContext.total || 0))]),
                e("div", null, ["Cảnh báo chưa đọc: ", e("strong", { style: { color: "var(--neon-orange)" } }, String(activeContext.unseen || 0))]),
                e("div", null, ["Mức độ trung bình: ", e("strong", null, activeContext.average_severity || "medium")]),
                e("div", null, ["Cơ chế bảo mật threshold: ", e("strong", null, activeContext.threshold_strategy || "default")]),
              ])
            ]) : null,
          ])
        ])
      : null,
  ]);
}

function renderSummaryCard(label, value, modifier = "") {
  return e("div", { className: `core-alert-center-summary-card ${modifier}`.trim() }, [
    e("div", { key: "label", className: "core-alert-center-summary-label" }, label),
    e("div", { key: "value", className: "core-alert-center-summary-value" }, value),
  ]);
}

function renderEvidenceList(evidence) {
  const entries = Object.entries(evidence || {}).filter(([, value]) => value != null && value !== "");
  if (entries.length === 0) {
    return e("ul", { className: "core-alert-center-evidence-list" }, e("li", null, "Không có dữ liệu bằng chứng."));
  }

  return e(
    "ul",
    { className: "core-alert-center-evidence-list" },
    entries.map(([key, value]) =>
      e("li", { key }, `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    )
  );
}


const CORE_STYLES = `
:root {
        --neon-green: #00e676;
        --neon-red: #ff1744;
        --neon-orange: #ff9100;
        --neon-blue: #2979ff;
        --neon-grey: #8a99ad;
        --neon-purple: #cc66ff;
        
        --bg-primary: #07090e;
        --bg-surface: #0e1320;
        --bg-glass: rgba(14, 19, 32, 0.85);
        --border-glass: rgba(255, 255, 255, 0.08);
        --border-hover: rgba(255, 255, 255, 0.16);
        --text-main: #f5f6f8;
        --text-muted: #8a99ad;
        --glow-shadow: 0 0 15px rgba(41, 121, 255, 0.25);
      }

      .core-alert-center-page {
        background-color: var(--bg-primary);
        color: var(--text-main);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        min-height: 100vh;
        padding: 30px;
        box-sizing: border-box;
      }

      /* Animations */
      @keyframes pulse-live {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.8); }
        70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(0, 230, 118, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Header styling */
      .core-alert-center-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        padding-bottom: 22px;
        flex-wrap: wrap;
        gap: 20px;
      }

      .core-alert-center-header h1 {
        font-size: 2.1rem;
        font-weight: 800;
        margin: 0 0 6px 0;
        background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.5px;
      }

      .core-alert-center-subtitle {
        color: var(--text-muted);
        font-size: 0.95rem;
        margin: 0;
      }

      /* LIVE Status */
      .core-alert-live-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--neon-green);
        text-transform: uppercase;
        letter-spacing: 1px;
        background: rgba(0, 230, 118, 0.08);
        border: 1px solid rgba(0, 230, 118, 0.2);
        padding: 4px 12px;
        border-radius: 20px;
      }

      .core-alert-live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--neon-green);
        animation: pulse-live 1.8s infinite;
      }

      .core-alert-live-badge.is-paused {
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .core-alert-live-badge.is-paused .core-alert-live-dot {
        background-color: var(--text-muted);
        animation: none;
      }

      /* Filters & Switcher */
      .core-alert-center-filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .core-alert-center-filter-field {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-glass);
        padding: 6px 12px;
        border-radius: 8px;
      }

      .core-alert-center-filter-field span {
        font-size: 0.8rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }

      .core-alert-center-filter-field input {
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main);
        font-size: 0.9rem;
        width: 110px;
        font-weight: 700;
      }

      .core-alert-center-filter-field input::placeholder {
        color: rgba(255, 255, 255, 0.2);
      }

      .core-alert-center-filter-bar button {
        background: var(--neon-blue);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        padding: 8px 18px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-center-filter-bar button:hover {
        background: #1976d2;
        transform: translateY(-1px);
        box-shadow: var(--glow-shadow);
      }

      /* Combined Controls Bar */
      .core-alert-combined-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 15px;
      }

      .core-alert-lane-block {
        display: flex;
        gap: 8px;
      }

      .core-alert-center-lane-button {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        padding: 6px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: all 0.2s ease;
      }

      .core-alert-center-lane-button:hover {
        border-color: rgba(255, 255, 255, 0.15);
        color: var(--text-main);
      }

      .core-alert-center-lane-button.is-active {
        background: rgba(41, 121, 255, 0.1);
        border-color: var(--neon-blue);
        color: #82b1ff;
      }

      /* Timeframe selector strip */
      .core-alert-time-strip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.02);
        padding: 4px 12px;
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.03);
        width: fit-content;
      }

      .core-alert-time-label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        margin-right: 6px;
      }

      .core-alert-time-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-time-btn:hover {
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.05);
      }

      .core-alert-time-btn.is-active {
        background: var(--neon-blue);
        color: white;
      }

      /* Summary Dashboard Metrics */
      .core-alert-center-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }

      .core-alert-center-summary-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 12px 16px;
        backdrop-filter: blur(16px);
        transition: all 0.25s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        position: relative;
        overflow: hidden;
      }

      .core-alert-center-summary-card:hover {
        border-color: var(--border-hover);
        transform: translateY(-2px);
      }

      .core-alert-center-summary-card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: 100%;
        background-color: var(--neon-blue);
        opacity: 0.5;
      }

      .core-alert-center-summary-card.severity-high::before {
        background-color: var(--neon-orange);
      }

      .core-alert-center-summary-card.is-highlighted::before {
        background-color: var(--neon-purple);
      }

      .core-alert-center-summary-label {
        font-size: 0.7rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .core-alert-center-summary-value {
        font-size: 1.5rem;
        font-weight: 800;
        margin: 0;
        font-family: monospace;
      }

      /* Two Column Layout */
      .core-alert-dashboard-container {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 30px;
        align-items: start;
      }

      @media (max-width: 1024px) {
        .core-alert-dashboard-container {
          grid-template-columns: 1fr;
        }
      }

      /* Section Headers */
      .core-section-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 0 0 20px 0;
        font-size: 1.3rem;
        font-weight: 800;
        border-left: 4px solid var(--neon-blue);
        padding-left: 12px;
      }

      /* Module 1: Alert Feed styles */
      .core-feed-control-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-glass);
        padding: 8px 16px;
        border-radius: 8px;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      }

      .core-feed-control-left {
        display: flex;
        gap: 8px;
      }

      .core-feed-sort-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .core-feed-sort-btn:hover {
        color: var(--text-main);
      }

      .core-feed-sort-btn.is-active {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-main);
      }

      .core-feed-refresh-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .core-feed-auto-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
      }

      .core-feed-auto-toggle input {
        cursor: pointer;
      }

      .core-feed-refresh-btn {
        background: transparent;
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        border-radius: 6px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }

      .core-feed-refresh-btn:hover {
        border-color: rgba(255, 255, 255, 0.2);
        color: var(--text-main);
        background: rgba(255, 255, 255, 0.02);
      }

      .core-feed-refresh-btn svg.is-spinning {
        animation: spin 0.8s linear infinite;
      }

      .core-alert-center-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .core-alert-center-card {
        background: var(--bg-glass);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 20px;
        backdrop-filter: blur(16px);
        position: relative;
        transition: all 0.25s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      .core-alert-center-card:hover {
        border-color: var(--border-hover);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      }

      /* Card Severity Glows */
      .core-alert-center-card::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        border-top-left-radius: 12px;
        border-bottom-left-radius: 12px;
        background-color: var(--neon-blue);
      }

      .core-alert-center-card.severity-critical::after {
        background-color: var(--neon-red);
      }
      .core-alert-center-card.severity-critical {
        box-shadow: 0 4px 24px rgba(255, 23, 68, 0.06);
      }

      .core-alert-center-card.severity-high::after {
        background-color: var(--neon-orange);
      }
      .core-alert-center-card.severity-high {
        box-shadow: 0 4px 24px rgba(255, 145, 0, 0.06);
      }

      .core-alert-center-card.severity-low::after {
        background-color: var(--neon-grey);
      }

      .core-alert-center-card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        gap: 15px;
      }

      .core-alert-center-card-title {
        font-size: 1.15rem;
        font-weight: 700;
        margin: 0 0 6px 0;
        color: white;
      }

      .core-alert-center-card-meta {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .core-alert-symbol-badge {
        background: rgba(41, 121, 255, 0.15);
        color: #82b1ff;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        border: 1px solid rgba(41, 121, 255, 0.25);
      }

      .core-alert-center-badge {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: 4px;
        letter-spacing: 0.5px;
      }

      .core-alert-center-badge.severity-critical {
        background: rgba(255, 23, 68, 0.12);
        color: #ff5252;
        border: 1px solid rgba(255, 23, 68, 0.2);
      }

      .core-alert-center-badge.severity-high {
        background: rgba(255, 145, 0, 0.12);
        color: #ffab40;
        border: 1px solid rgba(255, 145, 0, 0.2);
      }

      .core-alert-center-badge.severity-medium {
        background: rgba(41, 121, 255, 0.12);
        color: #448aff;
        border: 1px solid rgba(41, 121, 255, 0.2);
      }

      .core-alert-center-badge.severity-low {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-muted);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .core-alert-center-card-summary {
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0 0 15px 0;
        color: rgba(255, 255, 255, 0.85);
      }

      .core-alert-center-card-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.03);
        padding: 12px 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-size: 0.85rem;
      }

      .core-alert-center-card-metrics span {
        color: var(--text-muted);
      }

      .core-alert-center-card-metrics strong {
        color: white;
        font-family: monospace;
      }

      /* Side / Direction Colors */
      .direction-buy {
        color: var(--neon-green) !important;
        font-weight: 700;
      }

      .direction-sell {
        color: var(--neon-red) !important;
        font-weight: 700;
      }

      /* Expandable Evidence list */
      .core-evidence-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 700;
        text-transform: uppercase;
        cursor: pointer;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }

      .core-evidence-header:hover {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-main);
      }

      .core-alert-center-evidence-list {
        margin: 0 0 15px 0;
        padding-left: 20px;
        font-size: 0.82rem;
        color: var(--text-muted);
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: rgba(0, 0, 0, 0.15);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.03);
      }

      .core-alert-center-evidence-list li {
        list-style-type: square;
        word-break: break-all;
      }

      /* Card actions row */
      .core-alert-card-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        flex-wrap: wrap;
      }

      .core-alert-card-actions button {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-muted);
        border: 1px solid var(--border-glass);
        font-size: 0.8rem;
        font-weight: 700;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .core-alert-card-actions button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-main);
        border-color: var(--border-hover);
      }

      .core-alert-card-actions button.is-primary {
        background: rgba(41, 121, 255, 0.1);
        border-color: rgba(41, 121, 255, 0.3);
        color: #82b1ff;
      }

      .core-alert-card-actions button.is-primary:hover:not(:disabled) {
        background: var(--neon-blue);
        color: white;
        box-shadow: var(--glow-shadow);
      }

      /* Symmetrical Dashboard Panel */
      .core-dashboard-panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-glass);
        border-radius: 12px;
        padding: 22px;
        backdrop-filter: blur(20px);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        height: 640px; /* Force strict equal height */
        box-sizing: border-box;
      }

      .core-symbol-stats-search {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-glass);
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 20px;
        align-items: center;
        gap: 10px;
      }

      .core-symbol-stats-search input {
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-main);
        font-size: 0.85rem;
        font-weight: 600;
        width: 100%;
      }

      .core-symbol-stats-search input::placeholder {
        color: rgba(255, 255, 255, 0.2);
      }

      .core-symbol-stats-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .core-symbol-stats-table th {
        text-align: left;
        color: var(--text-muted);
        font-weight: 700;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        text-transform: uppercase;
        font-size: 0.75rem;
      }

      .core-symbol-stats-table td {
        padding: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        vertical-align: middle;
      }

      .core-symbol-stats-row:hover {
        background: rgba(255, 255, 255, 0.01);
      }

      .core-stats-symbol-badge {
        font-weight: 800;
        color: white;
        background: rgba(255, 255, 255, 0.05);
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .core-stats-symbol-badge:hover {
        background: var(--neon-blue);
        border-color: var(--neon-blue);
        box-shadow: var(--glow-shadow);
      }

      .core-stats-frequency-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .core-stats-frequency-badge.freq-explosive {
        background: rgba(255, 23, 68, 0.12);
        color: #ff5252;
        border: 1px solid rgba(255, 23, 68, 0.2);
      }

      .core-stats-frequency-badge.freq-high {
        background: rgba(255, 145, 0, 0.12);
        color: #ffab40;
        border: 1px solid rgba(255, 145, 0, 0.2);
      }

      .core-stats-frequency-badge.freq-medium {
        background: rgba(41, 121, 255, 0.12);
        color: #448aff;
        border: 1px solid rgba(41, 121, 255, 0.2);
      }

      .core-stats-frequency-badge.freq-low {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-muted);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      /* Buy/Sell graphical Strength Meter */
      .core-stats-strength-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        max-width: 120px;
      }

      .core-stats-strength-text {
        font-size: 0.72rem;
        color: var(--text-muted);
        display: flex;
        justify-content: space-between;
      }

      .core-stats-strength-bar {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.08);
        width: 100%;
      }

      .core-stats-strength-buy {
        background-color: var(--neon-green);
        height: 100%;
      }

      .core-stats-strength-sell {
        background-color: var(--neon-red);
        height: 100%;
      }

      .core-stats-strength-neutral {
        background-color: var(--neon-grey);
        height: 100%;
      }

      /* Detail Forensic Drawer styles */
      .core-detail-drawer {
        background: var(--bg-surface);
        border: 1px solid rgba(41, 121, 255, 0.3);
        border-radius: 12px;
        padding: 22px;
        margin-top: 30px;
        box-shadow: 0 8px 32px rgba(41, 121, 255, 0.1);
        backdrop-filter: blur(20px);
        position: relative;
      }

      .core-detail-drawer::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, var(--neon-blue) 0%, var(--neon-purple) 100%);
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
      }

      .core-detail-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .core-detail-title-row h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: white;
      }

      .core-detail-close-btn {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        border-radius: 50%;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .core-detail-close-btn:hover {
        background: rgba(255, 23, 68, 0.1);
        color: var(--neon-red);
        border-color: rgba(255, 23, 68, 0.2);
      }

      .core-detail-section {
        background: rgba(0, 0, 0, 0.15);
        padding: 15px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.03);
        margin-bottom: 15px;
      }

      .core-detail-section h4 {
        margin: 0 0 10px 0;
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .core-detail-section p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
      }

      .core-detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
      }

      .core-detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .core-detail-item span {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 700;
      }

      .core-detail-item strong {
        font-size: 1rem;
        color: white;
      }

      .core-loading {
        color: var(--neon-blue);
        font-weight: 700;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 20px 0;
      }

      .core-loading::before {
        content: "";
        width: 14px;
        height: 14px;
        border: 2px solid var(--neon-blue);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
      }

      .core-error {
        background: rgba(255, 23, 68, 0.08);
        border: 1px solid rgba(255, 23, 68, 0.15);
        color: #ff5252;
        padding: 12px 18px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        margin: 20px 0;
      }

      .core-empty {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        text-align: center;
        padding: 40px 20px;
        border-radius: 12px;
        font-size: 0.95rem;
        font-weight: 600;
      }

      .core-scrollable-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 8px;
        box-sizing: border-box;
      }

      /* Custom premium scrollbars */
      .core-scrollable-container::-webkit-scrollbar {
        width: 6px;
      }
      .core-scrollable-container::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 3px;
      }
      .core-scrollable-container::-webkit-scrollbar-thumb {
        background: rgba(41, 121, 255, 0.25);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      .core-scrollable-container::-webkit-scrollbar-thumb:hover {
        background: rgba(41, 121, 255, 0.45);
      }

      /* Pagination controls styling */
      .core-pagination-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }

      .core-pagination-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-glass);
        color: var(--text-muted);
        padding: 5px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 700;
        transition: all 0.2s ease;
        min-width: 32px;
        text-align: center;
      }

      .core-pagination-btn:hover:not(:disabled) {
        background: rgba(41, 121, 255, 0.1);
        border-color: var(--neon-blue);
        color: white;
      }

      .core-pagination-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .core-pagination-info {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-muted);
        padding: 0 10px;
      }
`;
