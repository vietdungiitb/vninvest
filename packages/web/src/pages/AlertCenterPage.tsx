import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VariableSizeList } from "react-window";
const VirtualFeedList = VariableSizeList as any;
import { useI18n } from "../context/LangContext.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";
import { ShellSkeleton } from "../components/ShellSkeleton.js";
import styles from "./AlertCenterPage.module.css";
import { ShellPageChrome, ShellPanel, ShellMetric } from "../components/ShellPageTemplate.js";
import soc from "../components/soc/soc.module.css";
import { formatAgo, formatDateTimeICT, formatVnd } from "../utils/alertCenterFormat.js";
import { useAlertCenterData } from "../hooks/useAlertCenterData.js";
import { useAlertCenterStream, type AlertCenterStreamItem } from "../hooks/useAlertCenterStream.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useAlertCenterFilters } from "../hooks/useAlertCenterFilters.ts";
import { useAlertCenterActions } from "../hooks/useAlertCenterActions.ts";
import { FilterBar } from "../components/alert-center/FilterBar.js";
import { AlertCard } from "../components/alert-center/AlertCard.js";
import { StatsPanel } from "../components/alert-center/StatsPanel.js";
import { DetailDrawer } from "../components/alert-center/DetailDrawer.js";
import { MuteModal } from "../components/alert-center/MuteModal.js";

const DEFAULT_ENV: Record<string, unknown> = {};

interface AlertItem {
  matched_value?: unknown;
  alert_id?: string | number;
  event_id?: string | number;
  ts?: string;
  symbol?: string;
  value?: unknown;
  triggered_at?: string;
  alert_family?: string;
  alert_type?: string;
  severity?: string;
  whale_detail?: {
    price?: unknown;
    volume?: unknown;
    matched_value?: unknown;
    side?: string;
    executed_at?: string;
  } | null;
  [key: string]: unknown;
}

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

interface AlertCenterPageProps {
  env?: Record<string, unknown>;
  className?: string;
}

function formatAlertValue(value: unknown): string {
  return formatVnd(value);
}

function formatAlertTimestamp(value: unknown): string {
  if (!value) return "—";
  return formatDateTimeICT(value);
}

function normalizeSymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }: AlertCenterPageProps) {
  const { t, locale } = useI18n();
  const filters = useAlertCenterFilters();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const lane = sp.get("lane");
      if (lane === "main" || lane === "ai") filters.setLane(lane);
      const symbol = (sp.get("symbol") || "").trim().toUpperCase();
      if (symbol) {
        filters.setSymbolDraft(symbol);
        filters.setAppliedSymbol(symbol);
      }
      const sev = (sp.get("severity") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const s of sev) filters.toggleSeverity(s);
      const fam = (sp.get("family") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const f of fam) filters.toggleFamily(f);
      const tf = sp.get("timeframe");
      if (tf === "5m" || tf === "15m" || tf === "1h" || tf === "session" || tf === "5d") filters.setTimeframe(tf);
      const sd = sp.get("session_date");
      if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) filters.setSessionDate(sd);
    } catch {
      // ignore malformed share URLs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams();
      if (filters.lane) sp.set("lane", filters.lane);
      if (filters.appliedSymbol) sp.set("symbol", filters.appliedSymbol);
      if (filters.severityFilter.length) sp.set("severity", filters.severityFilter.join(","));
      if (filters.familyFilter.length) sp.set("family", filters.familyFilter.join(","));
      if (filters.timeframe) sp.set("timeframe", filters.timeframe);
      if (filters.sessionDate) sp.set("session_date", filters.sessionDate);
      const qs = sp.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    } catch {
      // ignore history errors (non-browser env)
    }
  }, [filters.lane, filters.appliedSymbol, filters.severityFilter, filters.familyFilter, filters.timeframe, filters.sessionDate]);

  const {
    error, payload, summary, symbolStats, refetch,
    isInitialLoading, isBackgroundFetching, feedError, summaryError, statsError,
  } = useAlertCenterData({
    env,
    lane: filters.lane,
    symbol: filters.appliedSymbol,
    sessionDate: filters.sessionDate,
    timeframe: filters.timeframe,
    severity: filters.severityFilter,
    alertFamily: filters.familyFilter,
    autoRefresh,
  });

  const actions = useAlertCenterActions(refetch, filters.lane);

  // S7: SSE user-scoped thay WS global — cùng key alert_id với REST nên merge an toàn.
  // (useAlertCenterRealtime vẫn giữ cho DashboardPage dùng.)
  const [sseAlerts, setSseAlerts] = useState<AlertItem[]>([]);
  // S3.4: alert mới vào buffer + pill, không đẩy list khi user đang đọc.
  const [pendingAlerts, setPendingAlerts] = useState<AlertItem[]>([]);
  const [isDocVisible, setIsDocVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setIsDocVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  const handleStreamItem = useCallback((incoming: AlertCenterStreamItem) => {
    const item = incoming as unknown as AlertItem;
    setPendingAlerts((prev) => {
      if (prev.some((p) => String(p.alert_id) === String(item.alert_id))) return prev;
      return [...prev, item].slice(-50);
    });
    setSseAlerts((prev) => {
      if (prev.some((p) => String(p.alert_id) === String(item.alert_id))) return prev;
      return prev;
    });
  }, []);
  const mergePendingAlerts = useCallback(() => {
    if (!pendingAlerts.length) return;
    setSseAlerts((prev) => {
      const seen = new Set(prev.map((p) => String(p.alert_id)));
      const fresh = pendingAlerts.filter((p) => !seen.has(String(p.alert_id)));
      return [...fresh, ...prev].slice(0, 50);
    });
    setPendingAlerts([]);
  }, [pendingAlerts]);
  const streamQuery = useMemo(() => ({
    lane: filters.lane || undefined,
    symbol: filters.appliedSymbol || undefined,
  }), [filters.lane, filters.appliedSymbol]);
  const streamEnabled = autoRefresh && isDocVisible
    && typeof window !== "undefined"
    && typeof (window as unknown as { EventSource?: unknown }).EventSource !== "undefined";
  const { status: streamStatus } = useAlertCenterStream({
    enabled: streamEnabled,
    query: streamQuery,
    onItem: handleStreamItem,
  });
  const realtimeStatus = streamStatus === "open" ? "live" : "polling";

  const [extraAlerts, setExtraAlerts] = useState<AlertItem[]>([]);
  const [feedNextUrl, setFeedNextUrl] = useState<string | null>(null);
  const [muteTarget, setMuteTarget] = useState<AlertItem | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // S1.6: cache chiều cao thật từng card cho VariableSizeList.
  const listRef = useRef<any>(null);
  const rowHeights = useRef(new Map<number, number>());
  // Polish: feed co giãn theo nội dung để cân với cột stats, không để panel rỗng.
  const [heightTick, setHeightTick] = useState(0);

  // S7: feed = REST (+ load-more) + SSE prepend, dedupe cùng key alert_id.
  // WS lane S2 đã gỡ (SSE cùng shape serializer nên merge an toàn).
  const alerts = useMemo(() => {
    const rawAlerts = (payload as Record<string, unknown>)?.results ?? [];
    const restAlerts = Array.isArray(rawAlerts) ? rawAlerts : [];
    const base = [...restAlerts, ...extraAlerts];
    if (!sseAlerts.length) return base;
    const byId = new Map<string, AlertItem>();
    for (const item of base) {
      const key = (item as AlertItem)?.alert_id ?? (item as AlertItem)?.event_id;
      if (key != null) byId.set(String(key), item as AlertItem);
    }
    for (const item of sseAlerts) {
      const key = (item as AlertItem)?.alert_id;
      if (key != null && !byId.has(String(key))) byId.set(String(key), item as AlertItem);
    }
    return Array.from(byId.values());
  }, [payload, extraAlerts, sseAlerts]);

  // S2: phân biệt NO_SCOPE (không lọc + tổng bằng 0) vs NO_MATCH (có lọc).
  // NO_DATA gộp vào NO_SCOPE vì FE không có endpoint đếm ngoài scope để phân biệt.
  const hasActiveFilters = Boolean(
    filters.appliedSymbol || filters.sessionDate || filters.timeframe !== "session"
    || filters.severityFilter.length || filters.familyFilter.length,
  );
  const scopeTotalsZero = Number((summary as unknown as AlertSummary)?.total ?? 0) === 0
    && Number(((symbolStats as unknown as SymbolStatsPayload)?.pagination?.total_symbols) ?? 0) === 0;
  const feedEmptyKey = hasActiveFilters ? "alertCenter.emptyNoMatch"
    : scopeTotalsZero ? "alertCenter.emptyNoScope" : "alertCenter.empty";

  function extractFeedCursor(next: unknown): string | null {
    if (typeof next !== "string" || !next) return null;
    if (next.indexOf("cursor=") < 0) return next;
    try {
      return new URL(next, window.location.origin).searchParams.get("cursor");
    } catch {
      return null;
    }
  }

  useEffect(() => {
    setExtraAlerts([]);
    setFeedNextUrl(null);
    setPendingAlerts([]);
  }, [filters.lane, filters.appliedSymbol, filters.sessionDate, filters.timeframe, filters.severityFilter, filters.familyFilter]);

  const handleLoadMore = useCallback(async () => {
    const cursor = extractFeedCursor(feedNextUrl ?? (payload as Record<string, unknown>)?.next);
    if (!cursor) return;
    const params: Record<string, unknown> = {
      symbol: filters.appliedSymbol || undefined,
      session_date: filters.sessionDate || undefined,
      timeframe: filters.timeframe || undefined,
      ...(filters.severityFilter.length ? { severity: filters.severityFilter.join(",") } : {}),
      ...(filters.familyFilter.length ? { alert_family: filters.familyFilter.join(",") } : {}),
      cursor,
    };
    const res = (filters.lane === "ai"
      ? await coreApiAdapter.getAIAlertsFeed(params)
      : await coreApiAdapter.getAlertCenterFeed(params)) as unknown as { results?: unknown[]; next?: string | null };
    const more = Array.isArray(res?.results) ? (res.results as AlertItem[]) : [];
    if (more.length) setExtraAlerts((prev) => [...prev, ...more]);
    setFeedNextUrl(typeof res?.next === "string" ? res.next : null);
  }, [feedNextUrl, payload, filters.lane, filters.appliedSymbol, filters.sessionDate, filters.timeframe, filters.severityFilter, filters.familyFilter]);

  const sortedAlerts = useMemo(() => {
    const sorted = [...alerts].sort((a: AlertItem, b: AlertItem) => {
      if (filters.sorting === "largestValue") {
        const diff = Number(b?.value ?? b?.matched_value ?? 0) - Number(a?.value ?? a?.matched_value ?? 0);
        if (diff !== 0) return diff;
      } else {
        const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : (a?.ts ? new Date(a.ts).getTime() : 0);
        const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : (b?.ts ? new Date(b.ts).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
      }
      // S1: tie-break ổn định để poll nền không đảo thứ tự card bằng nhau
      return String(b?.alert_id ?? b?.event_id ?? "").localeCompare(String(a?.alert_id ?? a?.event_id ?? ""));
    });
    return sorted;
  }, [alerts, filters.sorting]);

  const displayAlerts = useMemo(() => {
    if (!Object.keys(actions.optimisticAck).length && !Object.keys(actions.optimisticMuted).length) {
      return sortedAlerts;
    }
    return sortedAlerts.map((alert: AlertItem) => {
      const id = String(alert.alert_id);
      const sym = normalizeSymbol(alert.symbol);
      if (actions.optimisticAck[id]) {
        return { ...alert, acknowledged: true, _optimistic: true };
      }
      if (actions.optimisticMuted[sym]) {
        return { ...alert, muted: true, _optimistic: true };
      }
      return alert;
    });
  }, [sortedAlerts, actions.optimisticAck, actions.optimisticMuted]);

  const getRowHeight = useCallback(
    (index: number) => rowHeights.current.get(index) ?? 170,
    [],
  );
  const handleCardHeight = useCallback((index: number, height: number) => {
    if (height > 0 && rowHeights.current.get(index) !== height) {
      rowHeights.current.set(index, height);
      listRef.current?.resetAfterIndex(index);
      setHeightTick((tick) => tick + 1);
    }
  }, []);

  // Polish: chiều cao feed = nội dung thật, kẹp 220–640px để cân cột stats (8 dòng).
  const feedListHeight = useMemo(() => {
    void heightTick;
    let total = 0;
    for (let i = 0; i < displayAlerts.length; i++) {
      total += rowHeights.current.get(i) ?? 160;
    }
    return Math.max(220, Math.min(640, total));
  }, [displayAlerts, heightTick]);

  // S3.1: đánh dấu đã xem toàn bộ alert đang hiển thị (batch ack, tối đa 50).
  const handleMarkAllRead = useCallback(async () => {
    const targets = displayAlerts
      .filter((a: AlertItem) => !a.acknowledged && (a.alert_id ?? a.event_id))
      .slice(0, 50);
    if (!targets.length || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.allSettled(
        targets.map((a: AlertItem) => {
          const id = (a.alert_id ?? a.event_id) as string | number;
          return coreApiAdapter.acknowledgeAlertCenterEvent(id, { lane: filters.lane });
        }),
      );
      await refetch();
    } finally {
      setMarkingAll(false);
    }
  }, [displayAlerts, filters.lane, markingAll, refetch]);

  // S3.4: banner dữ liệu chậm — alert mới nhất quá 60 phút.
  const latestAlertTs = useMemo(() => displayAlerts.reduce((m: number, a: AlertItem) => {
    const ts = a?.triggered_at ? new Date(a.triggered_at).getTime() : 0;
    return Number.isFinite(ts) ? Math.max(m, ts) : m;
  }, 0), [displayAlerts]);
  const isDataStale = latestAlertTs > 0 && Date.now() - latestAlertTs > 60 * 60 * 1000;

  const aggregatedSymbols = useMemo(() => {
    const symbolStatsPayload = symbolStats as unknown as SymbolStatsPayload;
    const rawSymbolRows = Array.isArray(symbolStatsPayload?.symbols) ? symbolStatsPayload.symbols : [];
    return rawSymbolRows
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
        // S4: freq lưu enum key (không lưu chuỗi Việt) để StatsTable map đúng cả 2 locale
        let freq = "low";
        const c = mapped.count as number;
        if (c >= 8) freq = "explosive";
        else if (c >= 4) freq = "high";
        else if (c >= 2) freq = "medium";
        return { ...mapped, freq };
      })
      .filter((item: Record<string, unknown>) => {
        if (!filters.searchTermStats) return true;
        return (item.symbol as string).includes(filters.searchTermStats.trim().toUpperCase());
      });
  }, [symbolStats, filters.searchTermStats]);

  const summaryData = summary as unknown as AlertSummary;
  const totalSymbolsInScope = Number(
    (symbolStats as unknown as SymbolStatsPayload)?.pagination?.total_symbols
    ?? aggregatedSymbols.length,
  );
  const highSeverityCount =
    Number(summaryData?.by_severity?.high || 0) +
    Number(summaryData?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter(
    (alert: AlertItem) => alert?.alert_family === "ai_suggest" || alert?.alert_type === "ai_suggest",
  ).length;

  const ITEMS_PER_PAGE_STATS = 8;
  const totalPagesStats = Math.ceil(aggregatedSymbols.length / ITEMS_PER_PAGE_STATS) || 1;
  const activePageStats = Math.min(filters.pageStats, totalPagesStats);
  const sortedSymbols = useMemo(() => {
    const arr = [...aggregatedSymbols];
    const dir = filters.statsSort.dir === "desc" ? -1 : 1;
    const val = (r: Record<string, unknown>) => {
      if (filters.statsSort.key === "value") return Number(r.totalValue || 0);
      if (filters.statsSort.key === "time") return Number(r.latestTime || 0);
      return Number(r.count || 0);
    };
    arr.sort((a, b) => {
      const diff = (val(a as unknown as Record<string, unknown>) - val(b as unknown as Record<string, unknown>)) * dir;
      if (diff !== 0) return diff;
      return String((a as unknown as Record<string, unknown>).symbol || "").localeCompare(
        String((b as unknown as Record<string, unknown>).symbol || ""),
      );
    });
    return arr;
  }, [aggregatedSymbols, filters.statsSort]);
  const paginatedSymbols = useMemo(() => sortedSymbols.slice(
    (activePageStats - 1) * ITEMS_PER_PAGE_STATS,
    activePageStats * ITEMS_PER_PAGE_STATS,
  ), [sortedSymbols, activePageStats]);

  const handleExportCsv = useCallback(() => {
    // S5: BOM UTF-8 (Excel đọc đúng dấu) + cắt 5000 dòng, đồng chuẩn Signals
    const cols = ["alert_id", "alert_type", "alert_family", "lane", "symbol", "severity", "direction", "value", "session_date", "triggered_at", "title", "body"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    for (const a of (displayAlerts as AlertItem[]).slice(0, 5000)) {
      lines.push(cols.map((c) => {
        if (c === "lane") return esc(filters.lane);
        if (c === "alert_family") return esc(a.alert_family ?? a.alert_type ?? "");
        return esc((a as Record<string, unknown>)[c]);
      }).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
      + `-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
    link.href = url;
    link.download = `alert-center-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [displayAlerts, filters.lane]);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.resolve(refetch()).finally(() => setIsRefreshing(false));
  }, [refetch]);

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const openMuteModal = useCallback((alert: AlertItem) => setMuteTarget(alert), []);
  const confirmMuteModal = useCallback((opts: { mute_minutes: number; reason: string }) => {
    if (!muteTarget) return;
    void actions.handleMuteWithOptions(muteTarget, opts).then(() => setMuteTarget(null));
  }, [muteTarget, actions]);

  const liveBadge = (
    <div
      className={`${soc.heroBadge}`}
      style={{ cursor: "pointer" }}
      onClick={() => setAutoRefresh(!autoRefresh)}
      title={autoRefresh ? t("alertCenter.liveBadgePauseTitle") : t("alertCenter.liveBadgeResumeTitle")}
    >
      <span className={`${autoRefresh ? soc.overviewHeroBadgePulse : `${soc.pulsingDot} ${soc.dotYellow}`}`} />
      {!autoRefresh
        ? t("alertCenter.paused")
        : realtimeStatus === "live"
          ? t("alertCenter.liveWs")
          : t("alertCenter.livePolling")
      }
    </div>
  );

  interface MetricDef {
    key: string;
    label: string;
    value: string;
    onClick?: () => void;
    hint: string;
  }
  const metrics: MetricDef[] = [
    {
      key: "total",
      label: t("alertCenter.summary.total"),
      value: String(summaryData?.total ?? alerts.length),
      onClick: () => { filters.setSeverityFilter([]); filters.resetStatsPage(); },
      hint: t("alertCenter.metricTotalHint"),
    },
    {
      key: "highCritical",
      label: t("alertCenter.summary.highCritical"),
      value: String(highSeverityCount),
      onClick: () => {
        const hc = ["high", "critical"];
        if (hc.every((s) => filters.severityFilter.includes(s))) {
          filters.setSeverityFilter(filters.severityFilter.filter((s) => !hc.includes(s)));
        } else {
          filters.setSeverityFilter(Array.from(new Set([...filters.severityFilter, ...hc])));
        }
        filters.resetStatsPage();
      },
      hint: t("alertCenter.metricFilterHint"),
    },
    ...(filters.lane === "ai"
      ? [{
        key: "aiSuggest",
        label: t("alertCenter.summary.aiSuggest"),
        value: String(aiSuggestCount),
        hint: t("alertCenter.metricStaticHint"),
      }]
      : []),
    {
      key: "unseen",
      label: t("alertCenter.summary.unseen"),
      value: String(summaryData?.unseen ?? 0),
      hint: t("alertCenter.metricStaticHint"),
    },
    {
      key: "symbols",
      label: t("alertCenter.metricSymbols"),
      value: String(totalSymbolsInScope),
      onClick: () => {
        filters.setSymbolDraft("");
        filters.setAppliedSymbol("");
        filters.resetStatsPage();
      },
      hint: t("alertCenter.metricSymbolHint"),
    },
  ];

  const renderMetric = (m: MetricDef) => {
    if (!m.onClick) {
      return <ShellMetric key={m.label} label={m.label} value={m.value} />;
    }
    return (
      <div
        key={m.label}
        role="button"
        tabIndex={0}
        title={String(m.hint)}
        aria-label={`${m.label}: ${m.value}. ${m.hint}`}
        className={styles.acClickableMetric}
        onClick={m.onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onClick?.(); }
        }}
      >
        <ShellMetric label={m.label} value={m.value} />
      </div>
    );
  };

  return (
    <ShellPageChrome
      eyebrow={t("alertCenter.eyebrow")}
      title={t("alertCenter.title")}
      description={t("alertCenter.subtitle")}
      badge={liveBadge}
      metrics={metrics.map((m) => renderMetric(m))}
      notice={!autoRefresh ? t("alertCenter.paused") : undefined}
      error={error && displayAlerts.length === 0 && !isInitialLoading ? error : undefined}
      className={`${className} ${styles.acPageTokens}`.trim()}
    >
      <FilterBar
        lane={filters.lane}
        onLaneChange={(val) => { filters.setLane(val); filters.resetStatsPage(); filters.setSessionDate(""); actions.closeDetail(); }}
        timeframe={filters.timeframe}
        onTimeframeChange={(val) => { filters.setTimeframe(val); filters.resetStatsPage(); }}
        sessionDate={filters.sessionDate}
        onSessionDateChange={(val) => {
          filters.setSessionDate(val);
          // S2.2: ngày cụ thể thắng preset — ép timeframe về session để backend
          // chỉ lọc theo session_date, tránh AND nhầm với cutoff preset.
          if (val) filters.setTimeframe("session");
          filters.resetStatsPage();
        }}
        symbolDraft={filters.symbolDraft}
        onSymbolDraftChange={filters.setSymbolDraft}
        onSymbolApply={filters.applySymbol}
        severityFilter={filters.severityFilter}
        severityCounts={{
          critical: Number(summaryData?.by_severity?.critical || 0),
          high: Number(summaryData?.by_severity?.high || 0),
          medium: Number(summaryData?.by_severity?.medium || 0),
          low: Number(summaryData?.by_severity?.low || 0),
        }}
        onToggleSeverity={filters.toggleSeverity}
        familyFilter={filters.familyFilter}
        onToggleFamily={filters.toggleFamily}
        onClearFilters={filters.clearFilters}
        isRefreshing={isRefreshing || Boolean(isBackgroundFetching)}
        onRefresh={triggerRefresh}
      />

      {actions.actionError && (
        <div className={`${soc.bannerError}`} role="alert">
          <span>{actions.actionError}</span>
        </div>
      )}
      {(summaryError || statsError) && (
        <div className={`${soc.bannerError}`} role="alert" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>{summaryError || statsError}</span>
          <button type="button" className={`${soc.filterBtn} ${soc.filterBtnInactive}`} onClick={triggerRefresh}>
            {t("alertCenter.retry")}
          </button>
        </div>
      )}
      {isDataStale && (
        <div className={`${soc.bannerError}`} role="status" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>{t("alertCenter.staleBanner", {
            time: formatDateTimeICT(latestAlertTs),
            ago: formatAgo(latestAlertTs, locale),
          })}</span>
        </div>
      )}

      <div className={`${styles.acOpsLayout}`}>
        <div className={`${soc.opsLeftCol}`}>
        <ShellPanel
          title={t("alertCenter.feedTitle")}
          subtitle={t("alertCenter.feedShowingTotal", {
            count: displayAlerts.length,
            total: Number(summaryData?.total ?? displayAlerts.length),
          })}
          actions={
            <div className={`${soc.signalFeedFilterBar}`} style={{ marginBottom: 0 }}>
              <button
                type="button"
                className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
                disabled={markingAll || !displayAlerts.some((a: AlertItem) => !a.acknowledged)}
                onClick={handleMarkAllRead}
                title={t("alertCenter.markAllRead")}
              >
                {markingAll ? t("alertCenter.pendingAck") : t("alertCenter.markAllRead")}
              </button>
              <button
                type="button"
                className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
                disabled={!feedNextUrl && !(payload as Record<string, unknown>)?.next}
                onClick={handleLoadMore}
              >
                {t("alertCenter.loadMore")}
              </button>
              <button
                type="button"
                className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
                onClick={handleExportCsv}
              >
                {t("alertCenter.exportCsv")}
              </button>
              {[
                { value: "latest", labelKey: "alertCenter.sortLatest" },
                { value: "largestValue", labelKey: "alertCenter.sortLargest" },
              ].map(s => (
                <button
                  key={s.value}
                  type="button"
                  className={`${soc.filterBtn} ${filters.sorting === s.value ? soc.filterBtnActive : soc.filterBtnInactive}`.trim()}
                  onClick={() => filters.setSorting(s.value as "latest" | "largestValue")}
                >
                  {t(s.labelKey)}
                </button>
              ))}
            </div>
          }
        >
          <PageErrorBoundary
            errorMessage={t("alertCenter.feedError")}
            retryLabel={t("alertCenter.retry")}
            onRetry={triggerRefresh}
          >
            {isInitialLoading && displayAlerts.length === 0 ? (
              <ShellSkeleton variant="card" count={5} anim="shimmer" />
            ) : feedError && displayAlerts.length === 0 ? (
              <div className={`${soc.emptyState}`} role="alert">
                <p>{feedError}</p>
                <button
                  type="button"
                  className={`${soc.filterBtn} ${soc.filterBtnInactive}`}
                  onClick={triggerRefresh}
                >
                  {t("alertCenter.retry")}
                </button>
              </div>
            ) : displayAlerts.length === 0 ? (
              <div className={`${soc.emptyState}`}>{t(feedEmptyKey as any)}</div>
            ) : (
              <div aria-live="polite" aria-busy={Boolean(isBackgroundFetching) || isRefreshing}>
              {feedError && (
                <div className={`${soc.bannerError}`} role="alert" style={{ marginBottom: 8 }}>
                  <span>{feedError}</span>
                </div>
              )}
              {pendingAlerts.length > 0 && (
                <button
                  type="button"
                  className={styles.acNewPill}
                  onClick={mergePendingAlerts}
                >
                  {t("alertCenter.newAlerts", { count: pendingAlerts.length })}
                </button>
              )}
              <VirtualFeedList
                ref={listRef}
                height={feedListHeight}
                width="100%"
                itemCount={displayAlerts.length}
                itemSize={getRowHeight}
                className={`${styles.acScrollable}`}
              >
                {({ index, style }: { index: number; style: React.CSSProperties }) => (
                  <AlertCard
                    key={displayAlerts[index].alert_id ?? displayAlerts[index].event_id}
                    alert={displayAlerts[index] as any}
                    lane={filters.lane}
                    busyAlertId={actions.busyAlertId}
                    isEvidenceExpanded={!!expandedEvidence[String(displayAlerts[index].alert_id)]}
                    toggleEvidence={toggleEvidence}
                    handleLoadDetail={actions.handleLoadDetail as any}
                    handleAcknowledge={actions.handleAcknowledge as any}
                    handleMuteSymbol={actions.handleMute as any}
                    handleMuteRequest={openMuteModal as any}
                    formatAlertValue={formatAlertValue}
                    formatAlertTimestamp={formatAlertTimestamp}
                    index={index}
                    onHeight={handleCardHeight}
                    style={{ ...style, overflow: "hidden", animationDelay: `${(index % 20) * 50}ms` }}
                  />
                )}
              </VirtualFeedList>
              </div>
            )}
          </PageErrorBoundary>
        </ShellPanel>
        </div>

        <div className={`${soc.opsRightCol}`}>
          <StatsPanel
            rows={paginatedSymbols as any}
            totalSymbols={totalSymbolsInScope}
            searchTerm={filters.searchTermStats}
            onSearchChange={filters.setSearchTermStats}
            formatAlertValue={formatAlertValue}
            page={activePageStats}
            pageSize={ITEMS_PER_PAGE_STATS}
            totalPages={totalPagesStats}
            onPageChange={filters.setPageStats}
            sortKey={filters.statsSort.key}
            sortDir={filters.statsSort.dir}
            onSortChange={filters.cycleStatsSort}
          />
        </div>
      </div>

      <DetailDrawer
        activeAlertId={actions.activeAlertId}
        activeDetail={actions.activeDetail as Record<string, unknown> | null}
        activeContext={actions.activeContext as Record<string, unknown> | null}
        appliedSymbol={filters.appliedSymbol}
        seen={Boolean(actions.seenAlerts[String(actions.activeAlertId)])}
        onClose={actions.closeDetail}
      />
      <MuteModal
        alert={muteTarget as any}
        busy={Boolean(actions.busyAlertId)}
        onConfirm={confirmMuteModal}
        onClose={() => setMuteTarget(null)}
      />
    </ShellPageChrome>
  );
}
