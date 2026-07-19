import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../context/LangContext.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { SummaryMetrics } from "../components/alert-center/SummaryMetrics.js";
import { AlertCard } from "../components/alert-center/AlertCard.js";
import { SymbolStatsTable } from "../components/alert-center/SymbolStatsTable.js";
import { DetailDrawer } from "../components/alert-center/DetailDrawer.js";
import styles from "./AlertCenterPage.module.css";
import { useAlertCenterData } from "../hooks/useAlertCenterData.js";
import { useAlertCenterRealtime } from "../hooks/useAlertCenterRealtime.js";

const e = createElement;
const DEFAULT_ENV: Record<string, unknown> = {};

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
  { value: "latest", labelKey: "alertCenter.sortLatest" },
  { value: "largestValue", labelKey: "alertCenter.sortLargest" },
]);

function formatAlertValue(value: unknown): string {
  if (value == null || value === "") {
    return "—";
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString("vi-VN") : String(value);
}

function formatAlertTimestamp(value: unknown): string {
  if (!value) {
    return "—";
  }
  const timestamp = new Date(String(value));
  if (Number.isNaN(timestamp.getTime())) {
    return String(value);
  }
  return timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + timestamp.toLocaleDateString("vi-VN");
}

function normalizeSymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

interface AlertItem {
  alert_id: string | number;
  symbol?: string;
  value?: unknown;
  triggered_at?: string;
  alert_family?: string;
  alert_type?: string;
  severity?: string;
  [key: string]: unknown;
}

interface AlertCenterPageProps {
  env?: Record<string, unknown>;
  className?: string;
}

export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }: AlertCenterPageProps) {
  const { t } = useI18n();
  const [lane, setLane] = useState("main");
  const [symbolDraft, setSymbolDraft] = useState("");
  const [appliedSymbol, setAppliedSymbol] = useState("");
  const [sessionDate] = useState("");
  const [timeframe, setTimeframe] = useState("session");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [familyFilter, setFamilyFilter] = useState<string[]>([]);
  const [sorting, setSorting] = useState("latest");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | number>("");
  const [activeDetail, setActiveDetail] = useState<unknown>(null);
  const [activeContext, setActiveContext] = useState<unknown>(null);
  const [actionError, setActionError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState<string | number>("");
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [searchTermModule2, setSearchTermModule2] = useState("");
  const [pageFeed, setPageFeed] = useState(1);
  const [pageStats, setPageStats] = useState(1);

  const { loading, error, payload, summary, symbolStats } = useAlertCenterData({
    env,
    lane,
    symbol: appliedSymbol,
    sessionDate,
    timeframe,
    severity: severityFilter,
    alertFamily: familyFilter,
    refreshToken
  });

  const { realtimeAlerts, realtimeStatus } = useAlertCenterRealtime({ enabled: autoRefresh });

  // Merge REST (base) + WS (incremental). WS wins on recency for same event_id.
  const alerts = useMemo(() => {
    const rawAlerts = (payload as Record<string, unknown>)?.results ?? [];
    const restAlerts = Array.isArray(rawAlerts) ? rawAlerts : [];
    if (!realtimeAlerts.length) {
      return restAlerts;
    }
    const byId = new Map();
    for (const item of restAlerts) {
      const key = item?.alert_id ?? item?.event_id;
      if (key != null) byId.set(String(key), item);
    }
    for (const item of realtimeAlerts) {
      const key = item?.alert_id ?? item?.event_id;
      if (key != null) byId.set(String(key), item);
    }
    return Array.from(byId.values());
  }, [payload, realtimeAlerts]);

  useEffect(() => {
    setPageFeed(1);
  }, [lane, appliedSymbol, sessionDate, timeframe, sorting, severityFilter, familyFilter]);

  useEffect(() => {
    setPageStats(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermModule2, symbolStats?.pagination?.total_symbols, lane, appliedSymbol, sessionDate, timeframe]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setRefreshToken((r) => r + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const triggerManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshToken((r) => r + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const sortedAlerts = [...alerts].sort((a: AlertItem, b: AlertItem) => {
    if (sorting === "largestValue") {
      const valA = Number(a?.value || 0);
      const valB = Number(b?.value || 0);
      return valB - valA;
    }
    const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : 0;
    const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : 0;
    return timeB - timeA;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aggregatedSymbols = ((symbolStats as any)?.symbols && Array.isArray((symbolStats as any).symbols) ? (symbolStats as any).symbols : []).map((item: Record<string, unknown>) => {
    const mapped: Record<string, unknown> = {
      symbol: normalizeSymbol(item?.symbol || "UNKNOWN"),
      count: Number(item?.count || 0),
      buyCount: Number(item?.buy_count || 0),
      sellCount: Number(item?.sell_count || 0),
      neutralCount: Number(item?.neutral_count || 0),
      totalValue: Number(item?.total_value || 0),
      severities: {
        critical: Number((item?.by_severity as Record<string, unknown>)?.critical || 0),
        high: Number((item?.by_severity as Record<string, unknown>)?.high || 0),
        medium: Number((item?.by_severity as Record<string, unknown>)?.medium || 0),
        low: Number((item?.by_severity as Record<string, unknown>)?.low || 0),
      },
      latestTime: item?.latest_triggered_at ? new Date(item.latest_triggered_at as string).getTime() : 0,
      familiesList: "",
    };

    let freq = "Thấp";
    if (mapped.count as number >= 8) freq = "Bùng nổ";
    else if (mapped.count as number >= 4) freq = "Cao";
    else if (mapped.count as number >= 2) freq = "Trung bình";

    return { ...mapped, freq };
  }).filter((item: Record<string, unknown>) => {
    if (!searchTermModule2) return true;
    return (item.symbol as string).includes(searchTermModule2.trim().toUpperCase());
  });

  function handleApply(event: React.FormEvent) {
    event.preventDefault();
    setAppliedSymbol(normalizeSymbol(symbolDraft));
  }

  const SEVERITY_OPTIONS = Object.freeze([
    { value: "critical", labelKey: "alertCenter.sevCritical" },
    { value: "high", labelKey: "alertCenter.sevHigh" },
    { value: "medium", labelKey: "alertCenter.sevMedium" },
    { value: "low", labelKey: "alertCenter.sevLow" },
  ]);

  const FAMILY_OPTIONS = Object.freeze([
    { value: "whale", labelKey: "alertCenter.famWhale" },
    { value: "dark_flow", labelKey: "alertCenter.famDarkFlow" },
    { value: "price_shock", labelKey: "alertCenter.famPriceShock" },
    { value: "signal", labelKey: "alertCenter.famSignal" },
    { value: "system", labelKey: "alertCenter.famSystem" },
    { value: "ai_suggest", labelKey: "alertCenter.famAiSuggest" },
  ]);

  const toggleInArray = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const toggleSeverity = (value: string) => setSeverityFilter((prev) => toggleInArray(prev, value));
  const toggleFamily = (value: string) => setFamilyFilter((prev) => toggleInArray(prev, value));

  async function handleLoadDetail(alert: AlertItem) {
    if (!alert?.alert_id || !alert?.symbol) return;
    setActionError("");
    setBusyAlertId(alert.alert_id);
    try {
      const [detail, context] = await Promise.all([
        (coreApiAdapter as any).getAlertCenterEventDetail(alert.alert_id),
        (coreApiAdapter as any).getAlertCenterSymbolContext(alert.symbol),
      ]);
      setActiveAlertId(alert.alert_id);
      setActiveDetail(detail || null);
      setActiveContext(context || null);
    } catch (actionErr: unknown) {
      setActionError((actionErr && typeof actionErr === 'object' && 'message' in actionErr ? (actionErr as Error).message : '') || "Không thể tải chi tiết alert.");
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleAcknowledge(alert: AlertItem) {
    if (!alert?.alert_id) return;
    setActionError("");
    setBusyAlertId(alert.alert_id);
    try {
      await (coreApiAdapter as any).acknowledgeAlertCenterEvent(alert.alert_id);
      setRefreshToken((value: number) => value + 1);
    } catch (actionErr: unknown) {
      setActionError((actionErr && typeof actionErr === 'object' && 'message' in actionErr ? (actionErr as Error).message : '') || "Không thể xác nhận alert.");
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleMuteSymbol(alert: AlertItem) {
    if (!alert?.symbol) return;
    setActionError("");
    setBusyAlertId(alert.alert_id || alert.symbol);
    try {
      await (coreApiAdapter as any).muteAlertCenterPreference({
        symbol: alert.symbol,
        alert_family: alert.alert_family || alert.alert_type || "",
        mute_minutes: 30,
      });
      setRefreshToken((value: number) => value + 1);
    } catch (actionErr: unknown) {
      setActionError((actionErr && typeof actionErr === 'object' && 'message' in actionErr ? (actionErr as Error).message : '') || "Không thể tắt tiếng cảnh báo mã.");
    } finally {
      setBusyAlertId("");
    }
  }

  const toggleEvidence = (alertId: string) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [alertId]: !prev[alertId],
    }));
  };

  const highSeverityCount = Number((summary as any)?.by_severity?.high || 0) + Number((summary as any)?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter((alert: AlertItem) => alert?.alert_family === "ai_suggest" || alert?.alert_type === "ai_suggest").length;

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

  function renderPagination(currentPage: number, totalPages: number, setCurrentPage: (page: number) => void) {
    if (totalPages <= 1) return null;
    return e("div", { className: "core-pagination-controls" }, [
      e("button", {
        key: "first",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(1),
        title: t("alertCenter.paginationFirst")
      }, "«"),
      e("button", {
        key: "prev",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(Math.max(1, currentPage - 1)),
        title: t("alertCenter.paginationPrev")
      }, "‹"),
      e("span", {
        key: "info",
        className: "core-pagination-info"
      }, t("alertCenter.paginationPage", { current: currentPage, total: totalPages })),
      e("button", {
        key: "next",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(Math.min(totalPages, currentPage + 1)),
        title: t("alertCenter.paginationNext")
      }, "›"),
      e("button", {
        key: "last",
        type: "button",
        className: "core-pagination-btn",
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(totalPages),
        title: t("alertCenter.paginationLast")
      }, "»")
    ]);
  }

  return e("div", { className: `${String(styles["core-alert-center-page"])} ${className}`.trim() }, [
    e("header", { key: "header", className: styles["core-alert-center-header"] }, [
      e("div", { key: "title-container" }, [
        e("h1", { key: "title" }, t("alertCenter.title", { defaultValue: "Whale Alerts Workspace" })),
        e(
          "p",
          { key: "subtitle", className: styles["core-alert-center-subtitle"] },
          t("alertCenter.subtitle")
        ),
      ]),
      e("div", { key: "live-indicator-container", style: { display: "flex", alignItems: "center", gap: "15px" } as React.CSSProperties }, [
        e(
          "div",
          {
            key: "live-badge",
            className: `${String(styles["core-alert-live-badge"])} ${!autoRefresh ? String(styles["is-paused"]) : ""}`.trim(),
            style: { cursor: "pointer" },
            onClick: () => setAutoRefresh(!autoRefresh),
            title: autoRefresh ? t("alertCenter.liveBadgePauseTitle") : t("alertCenter.liveBadgeResumeTitle")
          },
          [
            e("div", { key: "dot", className: styles["core-alert-live-dot"] }),
            !autoRefresh
              ? "PAUSED"
              : realtimeStatus === "live"
                ? "LIVE (WS)"
                : "LIVE (polling)",
          ]
        ),
        e("form", { key: "filters", className: styles["core-alert-center-filter-bar"], onSubmit: handleApply }, [
          e("label", { key: "symbol-label", className: styles["core-alert-center-filter-field"] }, [
            e("span", { key: "symbol-text" }, t("alertCenter.filterSymbol")),
            e("input", {
              key: "symbol-input",
              type: "text",
              value: symbolDraft,
              maxLength: 10,
              placeholder: t("alertCenter.filterSymbolPlaceholder"),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSymbolDraft(normalizeSymbol(event.target.value)),
            }),
          ]),
          e("button", { key: "apply", type: "submit" }, t("alertCenter.applyFilter")),
        ]),
      ]),
    ]),

    e("section", { key: "combined-controls", className: "core-alert-combined-controls" }, [
      e("div", { key: "lane-block", className: "core-alert-lane-block" }, [
        ...LANE_OPTIONS.map((option: { value: string; label: string }) =>
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
            option.value === "ai" ? t("alertCenter.laneAi") : t("alertCenter.laneMain")
          )
        ),
      ]),
      e("div", { key: "time-strip", className: "core-alert-time-strip" }, [
        e("span", { key: "lbl", className: "core-alert-time-label" }, t("alertCenter.timeframe")),
        ...WINDOW_OPTIONS.map((w: { value: string; label: string }) =>
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
      e("div", { key: "filter-strip", className: "core-alert-filter-strip" }, [
        e("span", { key: "sev-lbl", className: "core-alert-time-label" }, t("alertCenter.severity")),
        ...SEVERITY_OPTIONS.map((s: { value: string; labelKey: string }) =>
          e(
            "button",
            {
              key: `sev-${s.value}`,
              type: "button",
              className: `core-alert-chip ${severityFilter.includes(s.value) ? "is-active" : ""}`.trim(),
              onClick: () => toggleSeverity(s.value),
            },
            t(s.labelKey)
          )
        ),
        e("span", { key: "fam-lbl", className: "core-alert-time-label" }, t("alertCenter.family")),
        ...FAMILY_OPTIONS.map((f: { value: string; labelKey: string }) =>
          e(
            "button",
            {
              key: `fam-${f.value}`,
              type: "button",
              className: `core-alert-chip ${familyFilter.includes(f.value) ? "is-active" : ""}`.trim(),
              onClick: () => toggleFamily(f.value),
            },
            t(f.labelKey)
          )
        ),
        (severityFilter.length > 0 || familyFilter.length > 0)
          ? e(
              "button",
              {
                key: "clear",
                type: "button",
                className: "core-alert-chip core-alert-chip-clear",
                onClick: () => {
                  setSeverityFilter([]);
                  setFamilyFilter([]);
                },
              },
              t("alertCenter.clearFilter")
            )
          : null,
      ]),
    ]),

    e(SummaryMetrics, {
      key: "summary-metrics",
      summary,
      alertsCount: alerts.length,
      highSeverityCount,
      aiSuggestCount,
      lane,
      appliedSymbol,
    }),

    loading && !isRefreshing ? e("p", { key: "loading", className: styles["core-loading"] as string }, "Đang tải dữ liệu cảnh báo từ Core API...") : null,
    error ? e("p", { key: "error", className: styles["core-error"] as string }, error) : null,
    actionError ? e("p", { key: "action-error", className: styles["core-error"] as string }, actionError) : null,

    !loading || isRefreshing ? e("div", { key: "dashboard-container", className: styles["core-alert-dashboard-container"] as string }, [

      e("div", { key: "feed-column", className: styles["core-alert-feed-column"] as string }, [
        e("div", { className: styles["core-dashboard-panel"] as string }, [
          e("h2", { className: styles["core-section-title"] as string }, [
            t("alertCenter.feedTitle"),
            e("span", { key: "sub", style: { fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)", fontWeight: "normal" } as React.CSSProperties }, t("alertCenter.feedShowing", { count: alerts.length }))
          ]),

          e("div", { className: styles["core-feed-control-bar"] as string }, [
            e("div", { className: styles["core-feed-control-left"] as string }, [
              ...SORT_OPTIONS.map((s: { value: string; labelKey: string }) =>
                e(
                  "button",
                  {
                    key: s.value,
                    type: "button",
                    className: `${String(styles["core-feed-sort-btn"])} ${sorting === s.value ? String(styles["is-active"]) : ""}`.trim(),
                    onClick: () => setSorting(s.value),
                  },
            t(s.labelKey)
                )
              ),
            ]),
            e("div", { className: styles["core-feed-refresh-group"] as string }, [
              e("label", { className: styles["core-feed-auto-toggle"] as string }, [
                e("input", {
                  type: "checkbox",
                  checked: autoRefresh,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => setAutoRefresh(event.target.checked),
                }),
                t("alertCenter.autoRefresh"),
              ]),
              e(
                "button",
                {
                  type: "button",
                  className: styles["core-feed-refresh-btn"] as string,
                  onClick: triggerManualRefresh,
                },
                [
                  e("svg", {
                    key: "refresh-svg",
                    className: isRefreshing ? styles["is-spinning"] as string : "",
                    width: "12",
                    height: "12",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    strokeWidth: "3",
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    style: { marginRight: "2px" } as React.CSSProperties
                  }, [
                    e("path", { key: "p1", d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })
                  ]),
                  ` ${t("alertCenter.refresh")}`,
                ]
              ),
            ]),
          ]),

          e("div", { className: styles["core-scrollable-container"] as string }, [
            paginatedAlerts.length === 0
              ? e("p", { className: styles["core-empty"] as string }, t("alertCenter.empty"))
              : e("div", { className: styles["core-alert-center-list"] as string },
                  paginatedAlerts.map((alert: AlertItem) =>
                    e(AlertCard, {
                      key: alert.alert_id,
                      alert,
                      lane,
                      busyAlertId,
                      isEvidenceExpanded: !!expandedEvidence[String(alert.alert_id)],
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

      e("div", { key: "stats-column", className: styles["core-alert-stats-column"] as string }, [
        e(SymbolStatsTable, {
          paginatedSymbols,
          searchTermModule2,
          setSearchTermModule2,
          formatAlertValue,
        }),
        renderPagination(activePageStats, totalPagesStats, setPageStats)
      ])
    ]) : null,

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
