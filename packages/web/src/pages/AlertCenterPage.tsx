import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { FixedSizeList } from "react-window";
// react-window's render-prop `children` typing conflicts with createElement's overloads;
// cast to any since AlertCard is a JS module (untyped) and props are dynamic.
const VirtualFeedList = FixedSizeList as any;
import { useI18n } from "../context/LangContext.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { AlertCard } from "../components/alert-center/AlertCard.js";
const FeedCard = AlertCard as any;
import { SymbolStatsTable } from "../components/alert-center/SymbolStatsTable.js";
import { DetailDrawer } from "../components/alert-center/DetailDrawer.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";
import { ShellSkeleton } from "../components/ShellSkeleton.js";
import styles from "./AlertCenterPage.module.css";
import { ShellPageChrome, ShellPanel, ShellMetric } from "../components/ShellPageTemplate.js";
import shell from "../components/ShellPageTemplate.module.css";
import soc from "../components/soc/soc.module.css";
import { useAlertCenterData } from "../hooks/useAlertCenterData.js";
import { useAlertCenterRealtime } from "../hooks/useAlertCenterRealtime.js";

const e = createElement;
const DEFAULT_ENV: Record<string, unknown> = {};

interface AlertSeverityBreakdown {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}
interface AlertSummary {
  total?: number;
  unseen?: number;
  by_severity?: AlertSeverityBreakdown;
}
interface SymbolStatRow {
  symbol?: string;
  count?: number;
  buy_count?: number;
  sell_count?: number;
  neutral_count?: number;
  total_value?: number;
  by_severity?: Record<string, number>;
  latest_triggered_at?: string;
}
interface SymbolStatsPayload {
  symbols?: SymbolStatRow[];
  pagination?: { total_symbols?: number };
}

const LANE_OPTIONS = Object.freeze([
  { value: "main", label: "alertCenter.laneMain" },
  { value: "ai", label: "alertCenter.laneAi" },
]);

const WINDOW_OPTIONS = Object.freeze([
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "session", label: "alertCenter.timeSession" },
  { value: "5d", label: "5d" },
]);

const SORT_OPTIONS = Object.freeze([
  { value: "latest", labelKey: "alertCenter.sortLatest" },
  { value: "largestValue", labelKey: "alertCenter.sortLargest" },
]);

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

function formatAlertValue(value: unknown): string {
  if (value == null || value === "") return "—";
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toLocaleString("vi-VN") : String(value);
}

function formatAlertTimestamp(value: unknown): string {
  if (!value) return "—";
  const timestamp = new Date(String(value));
  if (Number.isNaN(timestamp.getTime())) return String(value);
  return (
    timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    " " +
    timestamp.toLocaleDateString("vi-VN")
  );
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | number>("");
  const [activeDetail, setActiveDetail] = useState<unknown>(null);
  const [activeContext, setActiveContext] = useState<unknown>(null);
  const [actionError, setActionError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState<string | number>("");
  const [optimisticAck, setOptimisticAck] = useState<Record<string, boolean>>({});
  const [optimisticMuted, setOptimisticMuted] = useState<Record<string, boolean>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
  const [searchTermModule2, setSearchTermModule2] = useState("");
  const [pageStats, setPageStats] = useState(1);

  const { loading, error, payload, summary, symbolStats, refetch } = useAlertCenterData({
    env,
    lane,
    symbol: appliedSymbol,
    sessionDate,
    timeframe,
    severity: severityFilter,
    alertFamily: familyFilter,
    autoRefresh,
  });

  const { realtimeAlerts, realtimeStatus } = useAlertCenterRealtime({ enabled: autoRefresh });

  const alerts = useMemo(() => {
    const rawAlerts = (payload as Record<string, unknown>)?.results ?? [];
    const restAlerts = Array.isArray(rawAlerts) ? rawAlerts : [];
    if (!realtimeAlerts.length) return restAlerts;
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
    setPageStats(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermModule2, symbolStats?.pagination?.total_symbols, lane, appliedSymbol, sessionDate, timeframe]);

  const triggerManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  }, [refetch]);

  const sortedAlerts = [...alerts].sort((a: AlertItem, b: AlertItem) => {
    if (sorting === "largestValue") {
      return Number(b?.value || 0) - Number(a?.value || 0);
    }
    const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : 0;
    const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : 0;
    return timeB - timeA;
  });

  const displayAlerts = useMemo(() => {
    if (!Object.keys(optimisticAck).length && !Object.keys(optimisticMuted).length) {
      return sortedAlerts;
    }
    return sortedAlerts.map((alert: AlertItem) => {
      const id = String(alert.alert_id);
      const sym = normalizeSymbol(alert.symbol);
      if (optimisticAck[id]) {
        return { ...alert, acknowledged: true, _optimistic: true };
      }
      if (optimisticMuted[sym]) {
        return { ...alert, muted: true, _optimistic: true };
      }
      return alert;
    });
  }, [sortedAlerts, optimisticAck, optimisticMuted]);

  const symbolStatsPayload = symbolStats as unknown as SymbolStatsPayload;
  const rawSymbolRows = Array.isArray(symbolStatsPayload?.symbols) ? symbolStatsPayload.symbols : [];
  const aggregatedSymbols = rawSymbolRows
  .map((item: SymbolStatRow) => {
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
    let freq = t("alertCenter.freqLow");
    const c = mapped.count as number;
    if (c >= 8) freq = t("alertCenter.freqExplosive");
    else if (c >= 4) freq = t("alertCenter.freqHigh");
    else if (c >= 2) freq = t("alertCenter.freqMedium");
    return { ...mapped, freq };
  }).filter((item: Record<string, unknown>) => {
    if (!searchTermModule2) return true;
    return (item.symbol as string).includes(searchTermModule2.trim().toUpperCase());
  });

  function handleApply(event: React.FormEvent) {
    event.preventDefault();
    setAppliedSymbol(normalizeSymbol(symbolDraft));
  }

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
        coreApiAdapter.getAlertCenterEventDetail(alert.alert_id),
        coreApiAdapter.getAlertCenterSymbolContext(alert.symbol),
      ]);
      setActiveAlertId(alert.alert_id);
      setActiveDetail(detail || null);
      setActiveContext(context || null);
    } catch (actionErr: unknown) {
      setActionError(
        (actionErr && typeof actionErr === "object" && "message" in actionErr
          ? (actionErr as Error).message
          : "") || "Không thể tải chi tiết alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleAcknowledge(alert: AlertItem) {
    if (!alert?.alert_id) return;
    const id = String(alert.alert_id);
    setActionError("");
    setBusyAlertId(alert.alert_id);
    setOptimisticAck((prev) => ({ ...prev, [id]: true }));
    try {
      await coreApiAdapter.acknowledgeAlertCenterEvent(alert.alert_id);
      refetch();
    } catch (actionErr: unknown) {
      setOptimisticAck((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActionError(
        (actionErr && typeof actionErr === "object" && "message" in actionErr
          ? (actionErr as Error).message
          : "") || "Không thể xác nhận alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }

  async function handleMuteSymbol(alert: AlertItem) {
    if (!alert?.symbol) return;
    const sym = normalizeSymbol(alert.symbol);
    setActionError("");
    setBusyAlertId(alert.alert_id || alert.symbol);
    setOptimisticMuted((prev) => ({ ...prev, [sym]: true }));
    try {
      await coreApiAdapter.muteAlertCenterPreference({
        symbol: alert.symbol,
        alert_family: alert.alert_family || alert.alert_type || "",
        mute_minutes: 30,
      });
      refetch();
    } catch (actionErr: unknown) {
      setOptimisticMuted((prev) => {
        const next = { ...prev };
        delete next[sym];
        return next;
      });
      setActionError(
        (actionErr && typeof actionErr === "object" && "message" in actionErr
          ? (actionErr as Error).message
          : "") || "Không thể tắt tiếng cảnh báo mã.",
      );
    } finally {
      setBusyAlertId("");
    }
  }

  const toggleEvidence = (alertId: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [alertId]: !prev[alertId] }));
  };

  const summaryData = summary as unknown as AlertSummary;
  const highSeverityCount =
    Number(summaryData?.by_severity?.high || 0) +
    Number(summaryData?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter(
    (alert: AlertItem) => alert?.alert_family === "ai_suggest" || alert?.alert_type === "ai_suggest",
  ).length;

  const ITEMS_PER_PAGE_STATS = 8;
  const totalPagesStats = Math.ceil(aggregatedSymbols.length / ITEMS_PER_PAGE_STATS) || 1;
  const activePageStats = Math.min(pageStats, totalPagesStats);
  const paginatedSymbols = aggregatedSymbols.slice(
    (activePageStats - 1) * ITEMS_PER_PAGE_STATS,
    activePageStats * ITEMS_PER_PAGE_STATS,
  );

  function renderPagination(currentPage: number, totalPages: number, setCurrentPage: (page: number) => void) {
    if (totalPages <= 1) return null;
    return e("div", { className: styles.acPagination }, [
      e("button", {
        key: "first",
        type: "button",
        className: styles.acPageBtn,
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(1),
        title: t("alertCenter.pageFirst"),
      }, "«"),
      e("button", {
        key: "prev",
        type: "button",
        className: styles.acPageBtn,
        disabled: currentPage === 1,
        onClick: () => setCurrentPage(Math.max(1, currentPage - 1)),
        title: t("alertCenter.pagePrev"),
      }, "‹"),
      e("span", { key: "info", className: styles.acPageInfo }, `Trang ${currentPage} / ${totalPages}`),
      e("button", {
        key: "next",
        type: "button",
        className: styles.acPageBtn,
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(Math.min(totalPages, currentPage + 1)),
        title: t("alertCenter.pageNext"),
      }, "›"),
      e("button", {
        key: "last",
        type: "button",
        className: styles.acPageBtn,
        disabled: currentPage === totalPages,
        onClick: () => setCurrentPage(totalPages),
        title: t("alertCenter.pageLast"),
      }, "»"),
    ]);
  }

  const liveBadge = e(
    "div",
    {
      className: `${soc.heroBadge}`,
      style: { cursor: "pointer" } as React.CSSProperties,
      onClick: () => setAutoRefresh(!autoRefresh),
      title: autoRefresh ? t("alertCenter.pauseHint") : t("alertCenter.resumeHint"),
    },
    [
      e("span", {
        className: `${autoRefresh ? soc.statusDot : styles.acLiveDotPaused} ${styles.acLiveDot}`,
      }),
      !autoRefresh ? t("alertCenter.paused") : realtimeStatus === "live" ? t("alertCenter.liveWs") : t("alertCenter.livePolling"),
    ],
  );

  const metrics = [
    e(ShellMetric, { key: "m-total", label: t("alertCenter.summary.total"), value: String(summaryData?.total ?? alerts.length) }),
    e(ShellMetric, { key: "m-high", label: t("alertCenter.summary.highCritical"), value: String(highSeverityCount) }),
    e(ShellMetric, { key: "m-ai", label: t("alertCenter.summary.aiSuggest"), value: String(aiSuggestCount) }),
    e(ShellMetric, { key: "m-unseen", label: t("alertCenter.summary.unseen"), value: String(summaryData?.unseen ?? 0) }),
  ];

  return e(
    ShellPageChrome,
    {
      eyebrow: t("alertCenter.eyebrow"),
      title: t("alertCenter.title"),
      description: t("alertCenter.subtitle"),
      badge: liveBadge,
      metrics,
      className,
    },
    [
      /* ── Controls bar ── */
      e("div", { key: "controls", className: `${soc.toolbar}` }, [
        /* Lane + timeframe as segmented sub-tabs */
        e("div", { key: "seg", className: `${soc.subTabBar}` }, [
          ...LANE_OPTIONS.map((option: { value: string; label: string }) =>
            e(
              "button",
              {
                key: option.value,
                type: "button",
                className: `${soc.subTabBtn} ${lane === option.value ? soc.subTabBtnActive : ""}`.trim(),
                onClick: () => {
                  setLane(option.value);
                  setActiveDetail(null);
                },
              },
              t(option.label),
            ),
          ),
          e("span", { key: "divider", style: { width: 1, alignSelf: "stretch", background: "rgba(80,120,168,0.2)", margin: "0 4px" } as React.CSSProperties }),
          ...WINDOW_OPTIONS.map((w: { value: string; label: string }) =>
            e(
              "button",
              {
                key: w.value,
                type: "button",
                className: `${soc.subTabBtn} ${timeframe === w.value ? soc.subTabBtnActive : ""}`.trim(),
                onClick: () => setTimeframe(w.value),
              },
              w.label,
            ),
          ),
        ]),
        /* Symbol filter + refresh */
        e(
          "form",
          { key: "filters", className: `${soc.searchWrapper}`, onSubmit: handleApply },
          [
            e("span", { className: soc.searchIcon }, "⌕"),
            e("input", {
              key: "symbol-input",
              type: "text",
              className: soc.searchInputWithIcon,
              value: symbolDraft,
              maxLength: 10,
              placeholder: t("alertCenter.filterSymbol"),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSymbolDraft(normalizeSymbol(event.target.value)),
            }),
          ],
        ),
        e(
          "button",
          {
            key: "refresh",
            type: "button",
            className: `${shell.button} ${shell.buttonSecondary}`,
            onClick: triggerManualRefresh,
            style: { display: "inline-flex", alignItems: "center", gap: "6px" } as React.CSSProperties,
          },
          [
            e("svg", {
              key: "refresh-svg",
              className: isRefreshing ? styles.acSpin : "",
              width: "14", height: "14", viewBox: "0 0 24 24", fill: "none",
              stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round", strokeLinejoin: "round",
            }, e("path", { key: "p1", d: "M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" })),
            t("alertCenter.refresh"),
          ],
        ),
      ]),

      /* ── Severity + family filter chips ── */
      e("div", { key: "filter-strip", className: `${soc.feedCardFilterBar}` }, [
        e("span", { key: "sev", className: soc.filterBtnInactive, style: { pointerEvents: "none", background: "transparent", border: "none" } as React.CSSProperties }, t("alertCenter.severity")),
        ...SEVERITY_OPTIONS.map((s: { value: string; labelKey: string }) =>
          e(
            "button",
            {
              key: `sev-${s.value}`,
              type: "button",
              className: `${soc.filterBtn} ${severityFilter.includes(s.value) ? soc.filterBtnActive : soc.filterBtnInactive}`.trim(),
              onClick: () => toggleSeverity(s.value),
            },
            t(s.labelKey),
          ),
        ),
        e("span", { key: "fam", className: soc.filterBtnInactive, style: { pointerEvents: "none", background: "transparent", border: "none" } as React.CSSProperties }, t("alertCenter.family")),
        ...FAMILY_OPTIONS.map((f: { value: string; labelKey: string }) =>
          e(
            "button",
            {
              key: `fam-${f.value}`,
              type: "button",
              className: `${soc.filterBtn} ${familyFilter.includes(f.value) ? soc.filterBtnActive : soc.filterBtnInactive}`.trim(),
              onClick: () => toggleFamily(f.value),
            },
            t(f.labelKey),
          ),
        ),
        (severityFilter.length > 0 || familyFilter.length > 0)
          ? e(
              "button",
              {
                key: "clear",
                type: "button",
                className: `${soc.filterBtn} ${soc.filterBtnInactive}`.trim(),
                style: { color: "var(--accent-amber, #f59e0b)", borderColor: "rgba(245,158,11,0.4)" } as React.CSSProperties,
                onClick: () => {
                  setSeverityFilter([]);
                  setFamilyFilter([]);
                },
              },
              t("alertCenter.clearFilter"),
            )
          : null,
      ]),

      error && !loading
        ? e(
            "div",
            { key: "error-banner", className: `${styles.acBannerError}` },
            [
              e("span", { key: "msg" }, error),
              e(
                "button",
                { key: "retry", type: "button", className: `${shell.buttonPrimary} ${styles.acBtnInline}`, onClick: triggerManualRefresh },
                t("alertCenter.retry"),
              ),
            ],
          )
        : null,
      actionError ? e("div", { key: "action-error", className: `${styles.acBannerError}` }, actionError) : null,

      e("div", { key: "dashboard-container", className: `${soc.opsLayoutContainer}` }, [
            /* Feed column */
            e(
              ShellPanel,
              {
                key: "feed-panel",
                title: t("alertCenter.feedTitle"),
                subtitle: t("alertCenter.feedShowing", { count: alerts.length }),
                actions: e(
                  "div",
                  { className: `${soc.signalFeedFilterBar}`, style: { marginBottom: 0 } as React.CSSProperties },
                  SORT_OPTIONS.map((s: { value: string; labelKey: string }) =>
                    e(
                      "button",
                      {
                        key: s.value,
                        type: "button",
                        className: `${soc.filterBtn} ${sorting === s.value ? soc.filterBtnActive : soc.filterBtnInactive}`.trim(),
                        onClick: () => setSorting(s.value),
                      },
                      t(s.labelKey),
                    ),
                  ),
                ),
              },
              e(
                PageErrorBoundary,
                {
                  key: "feed-boundary",
                  errorMessage: t("alertCenter.feedError"),
                  retryLabel: t("alertCenter.retry"),
                  onRetry: triggerManualRefresh,
                },
                loading && !isRefreshing
                  ? e(ShellSkeleton, { key: "feed-skeleton", variant: "card", count: 5, anim: "shimmer" })
                  : displayAlerts.length === 0
                    ? e("div", { key: "empty", className: `${soc.emptyState}` }, t("alertCenter.empty"))
                    : e(
                      VirtualFeedList,
                      {
                        key: "feed-list",
                        height: 460,
                        width: "100%",
                        itemCount: displayAlerts.length,
                        itemSize: 230,
                        className: `${styles.acScrollable}`,
                        children: ({ index, style }: { index: number; style: React.CSSProperties }) =>
                          e(FeedCard, {
                            key: displayAlerts[index].alert_id,
                            style,
                            alert: displayAlerts[index],
                            lane,
                            busyAlertId,
                            isEvidenceExpanded: !!expandedEvidence[String(displayAlerts[index].alert_id)],
                            toggleEvidence,
                            handleLoadDetail,
                            handleAcknowledge,
                            handleMuteSymbol,
                            formatAlertValue,
                            formatAlertTimestamp,
                          }),
                      },
                    ),
              ),
            ),

            /* Stats column */
            e(
              "div",
              { key: "stats-column", className: `${soc.opsRightCol}` },
              [
                e(SymbolStatsTable, {
                  key: "stats-panel",
                  paginatedSymbols,
                  searchTermModule2,
                  setSearchTermModule2,
                  formatAlertValue,
                }),
                renderPagination(activePageStats, totalPagesStats, setPageStats),
              ],
            ),
          ]),

      e(DetailDrawer, {
        key: "detail-drawer",
        activeAlertId,
        activeDetail,
        activeContext,
        appliedSymbol,
        onClose: () => setActiveDetail(null),
      }),
    ],
  );
}
