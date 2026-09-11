import { useCallback, useEffect, useMemo, useState } from "react";
import { FixedSizeList } from "react-window";
const VirtualFeedList = FixedSizeList as any;
import { useI18n } from "../context/LangContext.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";
import { ShellSkeleton } from "../components/ShellSkeleton.js";
import styles from "./AlertCenterPage.module.css";
import { ShellPageChrome, ShellPanel, ShellMetric } from "../components/ShellPageTemplate.js";
import soc from "../components/soc/soc.module.css";
import { useAlertCenterData } from "../hooks/useAlertCenterData.js";
import { useAlertCenterRealtime } from "../hooks/useAlertCenterRealtime.js";
import { useAlertCenterFilters } from "../hooks/useAlertCenterFilters.ts";
import { useAlertCenterActions } from "../hooks/useAlertCenterActions.ts";
import { FilterBar } from "../components/alert-center/FilterBar.js";
import { AlertCard } from "../components/alert-center/AlertCard.js";
import { StatsPanel } from "../components/alert-center/StatsPanel.js";
import { DetailDrawer } from "../components/alert-center/DetailDrawer.js";

const DEFAULT_ENV: Record<string, unknown> = {};

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

export function AlertCenterPage({ env = DEFAULT_ENV, className = "" }: AlertCenterPageProps) {
  const { t } = useI18n();
  const filters = useAlertCenterFilters();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const { loading, error, payload, summary, symbolStats, refetch } = useAlertCenterData({
    env,
    lane: filters.lane,
    symbol: filters.appliedSymbol,
    sessionDate: filters.sessionDate,
    timeframe: filters.timeframe,
    severity: filters.severityFilter,
    alertFamily: filters.familyFilter,
    autoRefresh,
  });

  const { realtimeAlerts, realtimeStatus } = useAlertCenterRealtime({ enabled: autoRefresh });
  const actions = useAlertCenterActions(refetch);

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

  const sortedAlerts = useMemo(() => {
    const sorted = [...alerts].sort((a: AlertItem, b: AlertItem) => {
      if (filters.sorting === "largestValue") {
        return Number(b?.value || 0) - Number(a?.value || 0);
      }
      const timeA = a?.triggered_at ? new Date(a.triggered_at).getTime() : 0;
      const timeB = b?.triggered_at ? new Date(b.triggered_at).getTime() : 0;
      return timeB - timeA;
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
        let freq = t("alertCenter.freqLow");
        const c = mapped.count as number;
        if (c >= 8) freq = t("alertCenter.freqExplosive");
        else if (c >= 4) freq = t("alertCenter.freqHigh");
        else if (c >= 2) freq = t("alertCenter.freqMedium");
        return { ...mapped, freq };
      })
      .filter((item: Record<string, unknown>) => {
        if (!filters.searchTermStats) return true;
        return (item.symbol as string).includes(filters.searchTermStats.trim().toUpperCase());
      });
  }, [symbolStats, filters.searchTermStats, t]);

  const summaryData = summary as unknown as AlertSummary;
  const highSeverityCount =
    Number(summaryData?.by_severity?.high || 0) +
    Number(summaryData?.by_severity?.critical || 0);
  const aiSuggestCount = alerts.filter(
    (alert: AlertItem) => alert?.alert_family === "ai_suggest" || alert?.alert_type === "ai_suggest",
  ).length;

  const ITEMS_PER_PAGE_STATS = 8;
  const totalPagesStats = Math.ceil(aggregatedSymbols.length / ITEMS_PER_PAGE_STATS) || 1;
  const activePageStats = Math.min(filters.pageStats, totalPagesStats);
  const paginatedSymbols = useMemo(() => aggregatedSymbols.slice(
    (activePageStats - 1) * ITEMS_PER_PAGE_STATS,
    activePageStats * ITEMS_PER_PAGE_STATS,
  ), [aggregatedSymbols, activePageStats]);

  useEffect(() => {
    filters.setPageStats(1);
  }, [filters]);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch();
    setTimeout(() => setIsRefreshing(false), 800);
  }, [refetch]);

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  const metrics = [
    { label: t("alertCenter.summary.total"), value: String(summaryData?.total ?? alerts.length) },
    { label: t("alertCenter.summary.highCritical"), value: String(highSeverityCount) },
    { label: t("alertCenter.summary.aiSuggest"), value: String(aiSuggestCount) },
    { label: t("alertCenter.summary.unseen"), value: String(summaryData?.unseen ?? 0) },
  ];

  return (
    <ShellPageChrome
      eyebrow={t("alertCenter.eyebrow")}
      title={t("alertCenter.title")}
      description={t("alertCenter.subtitle")}
      badge={liveBadge}
      metrics={metrics.map((m) => (
        <ShellMetric key={m.label} label={m.label} value={m.value} />
      ))}
      notice={!autoRefresh ? t("alertCenter.paused") : undefined}
      error={error && !loading ? error : undefined}
      className={className}
    >
      <FilterBar
        lane={filters.lane}
        onLaneChange={(val) => { filters.setLane(val); actions.closeDetail(); }}
        timeframe={filters.timeframe}
        onTimeframeChange={filters.setTimeframe}
        symbolDraft={filters.symbolDraft}
        onSymbolDraftChange={filters.setSymbolDraft}
        onSymbolApply={filters.applySymbol}
        severityFilter={filters.severityFilter}
        onToggleSeverity={filters.toggleSeverity}
        familyFilter={filters.familyFilter}
        onToggleFamily={filters.toggleFamily}
        onClearFilters={filters.clearFilters}
        isRefreshing={isRefreshing}
        onRefresh={triggerRefresh}
      />

      {actions.actionError && (
        <div className={`${soc.bannerError}`} role="alert">
          <span>{actions.actionError}</span>
        </div>
      )}

      <div className={`${soc.opsLayoutContainer}`}>
        <ShellPanel
          title={t("alertCenter.feedTitle")}
          subtitle={t("alertCenter.feedShowing", { count: alerts.length })}
          actions={
            <div className={`${soc.signalFeedFilterBar}`} style={{ marginBottom: 0 }}>
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
            {loading && !isRefreshing ? (
              <ShellSkeleton variant="card" count={5} anim="shimmer" />
            ) : displayAlerts.length === 0 ? (
              <div className={`${soc.emptyState}`}>{t("alertCenter.empty")}</div>
            ) : (
              <VirtualFeedList
                height={460}
                width="100%"
                itemCount={displayAlerts.length}
                itemSize={280}
                className={`${styles.acScrollable}`}
              >
                {({ index, style }: { index: number; style: React.CSSProperties }) => (
                  <AlertCard
                    key={displayAlerts[index].alert_id}
                    alert={displayAlerts[index] as any}
                    lane={filters.lane}
                    busyAlertId={actions.busyAlertId}
                    isEvidenceExpanded={!!expandedEvidence[String(displayAlerts[index].alert_id)]}
                    toggleEvidence={toggleEvidence}
                    handleLoadDetail={actions.handleLoadDetail as any}
                    handleAcknowledge={actions.handleAcknowledge as any}
                    handleMuteSymbol={actions.handleMute as any}
                    formatAlertValue={formatAlertValue}
                    formatAlertTimestamp={formatAlertTimestamp}
                    style={{ ...style, overflow: "hidden", animationDelay: `${(index % 20) * 50}ms` }}
                  />
                )}
              </VirtualFeedList>
            )}
          </PageErrorBoundary>
        </ShellPanel>

        <div className={`${soc.opsRightCol}`}>
          <StatsPanel
            rows={paginatedSymbols as any}
            searchTerm={filters.searchTermStats}
            onSearchChange={filters.setSearchTermStats}
            formatAlertValue={formatAlertValue}
            page={activePageStats}
            totalPages={totalPagesStats}
            onPageChange={filters.setPageStats}
          />
        </div>
      </div>

      <DetailDrawer
        activeAlertId={actions.activeAlertId}
        activeDetail={actions.activeDetail as Record<string, unknown> | null}
        activeContext={actions.activeContext as Record<string, unknown> | null}
        appliedSymbol={filters.appliedSymbol}
        onClose={actions.closeDetail}
      />
    </ShellPageChrome>
  );
}
