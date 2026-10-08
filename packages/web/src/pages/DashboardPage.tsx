import React, { createElement, useEffect, useRef, useState, useCallback } from "react";

import { useCoreDashboardData } from "../features/dashboard/useCoreDashboardData.js";
import { AIAdvisorAlertPanel } from "../features/dashboard/AIAdvisorAlertPanel.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";
import { useAlertCenterRealtime } from "../hooks/useAlertCenterRealtime.js";
import { SmartStatsHeader } from "../components/dashboard/SmartStatsHeader.js";
import { PortfolioHeatmap } from "../components/dashboard/PortfolioHeatmap.js";
import { UnifiedAlertCenter } from "../components/dashboard/UnifiedAlertCenter.js";
import { CoreDashboardPositionDeck } from "../components/dashboard/CoreDashboardPositionDeck.js";
import { usePortfolio } from "../context/PortfolioContext.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useAlertCenterSnapshot } from "../hooks/useAlertCenterSnapshot.js";
import { dedupAndSortAlerts } from "../utils/alertDedup.js";
import { collectUniqueSortedSymbols } from "../utils/dashboardSymbols.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";

const e = createElement;

interface Holding {
  symbol: string;
  quantity?: number;
  current_price?: number;
  [key: string]: unknown;
}

interface TrackedSymbol {
  symbol: string;
  [key: string]: unknown;
}

interface WatchlistItem {
  symbol: string;
  [key: string]: unknown;
}

interface Watchlist {
  items?: WatchlistItem[];
  [key: string]: unknown;
}

interface WatchlistGroup {
  items?: WatchlistItem[];
  [key: string]: unknown;
}

interface QuoteData {
  change_value?: number;
  change_pct?: number;
  change?: number;
  current_price?: number;
  [key: string]: unknown;
}

interface AlertItem {
  id?: string;
  symbol?: string;
  ts?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface BreadthData {
  up: number;
  down: number;
  flat: number;
}

interface DashboardPageProps {
  portfolioId?: string | number | null;
  enabled?: boolean;
  quotesBySymbol?: Record<string, QuoteData>;
  alerts?: AlertItem[];
  realtimeBreadth?: BreadthData;
  onDataReady?: (data: {
    holdings: Holding[];
    trackedSymbols: TrackedSymbol[];
    watchlistGroups: WatchlistGroup[];
    watchlists: Watchlist[];
  }) => void;
  t?: (key: string, defaultText: string) => string;
  className?: string;
}


interface LoadingSkeletonProps {
  rows?: number;
}

function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps) {
  return e(
    "div",
    { className: "core-dashboard-skeleton" },
    ...Array.from({ length: rows }, (_, i) =>
      e("div", { key: i, className: "core-dashboard-skeleton-row" })
    )
  );
}

interface ErrorBannerProps {
  message?: string;
  t?: (key: string, defaultText: string) => string;
}

/**
 * FU-02c: DashboardPage co 3 nhanh `return` (empty / error / main). Chi them
 * `<h1>` o nhanh main se lam mat heading luc chua co danh muc hoac bi loi =>
 * phai dung o CA 3. Dung helper de khong quyen mot nhanh nao.
 */
function DashboardHeading({ t }: { t: (key: string, defaultText: string) => string }) {
  return e(
    "h1",
    { className: "core-dashboard-title" },
    t("dashboard.title", "Tổng quan"),
  );
}

function ErrorBanner({ message, t = (_key: string, defaultText: string) => defaultText }: ErrorBannerProps) {
  return e(
    "div",
    { className: "core-dashboard-error" },
    e("span", { className: "core-dashboard-error-icon" }, "⚠"),
    e("span", null, message || t("dashboard.errorLoad", "Không thể tải dữ liệu tổng quan."))
  );
}

export function DashboardPage({
  portfolioId,
  enabled = true,
  quotesBySymbol = {},
  alerts = [],
  realtimeBreadth = { up: 0, down: 0, flat: 0 },
  onDataReady = undefined,
  t = (_key: string, defaultText: string) => defaultText,
  className = "",
}: DashboardPageProps) {
  const portfolioContext = usePortfolio();
  const resolvedPortfolioId = portfolioId !== undefined && portfolioId !== null ? portfolioId : portfolioContext.activePortfolioId;

  const {
    loading,
    error,
    holdings,
    summary,
    analytics,
    technicals,
    trackedSymbols,
    watchlistGroups,
    watchlists,
    hasHydrated,
    refresh,
  } = useCoreDashboardData({ portfolioId: resolvedPortfolioId, enabled }) as any;

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [digest, setDigest] = useState<unknown>(null);

  const fetchDigest = useCallback(async () => {
    if (!resolvedPortfolioId) return;
    try {
      const res = await (coreApiAdapter as any).getPortfolioNewsDigest({ portfolio_id: resolvedPortfolioId } as any).catch(() => (coreApiAdapter as any).getPortfolioNewsDigest());
      setDigest(res);
    } catch (e) {
      console.warn("Failed to fetch news digest", e);
    }
  }, [resolvedPortfolioId]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  // --- Historical Alert Snapshot ---
  // F3: scope cùng phiên mới nhất như Alert Center (trước đây không timeframe
  // nên whale đa phiên lấn hết 20 slot, đẩy cảnh báo mới nhất ra ngoài).
  //
  // Pagination is deliberately NOT wired into the alert lane any more: the lane
  // curates to the top 5 by priority and links out to Alert Center, which owns
  // the paged list. The page size is raised to 40 so curation has something to
  // choose from — at 20 it could show at most half the feed.
  const {
    alerts: snapshotAlerts,
    loading: snapshotLoading,
    error: snapshotError,
    loadInitial,
  } = useAlertCenterSnapshot({ page_size: 40, timeframe: "session" });

  useEffect(() => {
    if (resolvedPortfolioId && enabled) {
      loadInitial();
    }
  }, [resolvedPortfolioId, enabled, loadInitial]);

  // --- Real-time Feed Integration ---
  const symbolString = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, []);
  const symbols = React.useMemo(() => {
    const parsed = symbolString ? symbolString.split("|") : [];
    return parsed.length > 0 ? parsed : ["market_discovery"];
  }, [symbolString]);
  const realtimeFeed = useRealtimeFeedFromManager({ symbols, pollInterval: 10000 });
  const { realtimeAlerts: globalRealtimeAlerts } = useAlertCenterRealtime({ enabled: true });

  const mergedQuotes = React.useMemo(() => {
    return { ...quotesBySymbol, ...(realtimeFeed?.quotesBySymbol || {}) };
  }, [quotesBySymbol, realtimeFeed?.quotesBySymbol]);

  const calculatedBreadth = React.useMemo(() => {
    let up = 0;
    let down = 0;
    let flat = 0;
    Object.values(mergedQuotes).forEach((q) => {
      const change = Number(q?.change_value ?? q?.change_pct ?? q?.change ?? 0);
      if (change > 0) {
        up++;
      } else if (change < 0) {
        down++;
      } else {
        flat++;
      }
    });
    return { up, down, flat };
  }, [mergedQuotes]);

  const hasRealtimeBreadth = realtimeBreadth && (realtimeBreadth.up > 0 || realtimeBreadth.down > 0 || realtimeBreadth.flat > 0);
  const resolvedBreadth = hasRealtimeBreadth ? realtimeBreadth : calculatedBreadth;

  // Build merged heatmap data: holdings + trackedSymbols + watchlists of individual user
  const heatmapSymbols = React.useMemo(() => {
    const s = new Set<string>();
    const add = (sym?: string) => { if (sym) s.add(sym.toUpperCase().trim()); };
    (holdings || []).forEach((h: Holding) => add(h.symbol));
    (trackedSymbols || []).forEach((t: TrackedSymbol) => add(t.symbol));
    (watchlists || []).forEach((w: Watchlist) => {
      (w.items || []).forEach((i: WatchlistItem) => add(i.symbol));
    });
    return Array.from(s);
  }, [holdings, trackedSymbols, watchlists]);

  const heatmapData = React.useMemo(() => {
    const hMap = new Map((holdings || []).map((h: Holding) => [(h.symbol || '').toUpperCase().trim(), h]));
    const tMap = new Map((trackedSymbols || []).map((t: TrackedSymbol) => [(t.symbol || '').toUpperCase().trim(), t]));
    return heatmapSymbols.map((sym) => {
      const held = hMap.get(sym) as any;
      const quote = (mergedQuotes[sym] || {}) as any;
      if (held) {
        return {
          ...held,
          in_holdings: true,
          market_cap_bn: Number(held.market_cap_bn || quote?.market_cap_bn || quote?.market_cap || 0),
        };
      }
      const tracked = tMap.get(sym) as any;
      return {
        symbol: sym,
        quantity: 0,
        current_price: Number(quote.current_price || tracked?.current_price || 0),
        market_cap_bn: Number(tracked?.market_cap_bn || quote?.market_cap_bn || quote?.market_cap || 0),
        in_holdings: false,
      };
    });
  }, [heatmapSymbols, holdings, trackedSymbols, mergedQuotes]);

  // Merge realtime alerts + prop alerts + historical snapshot alerts.
  // F2: dedup + sort mới-nhất-trước bằng util dùng chung (trước đây giữ nguyên
  // thứ tự merge nên whale cũ nằm trên shock mới).
  const mergedAlerts = React.useMemo(() => {
    const feedAlerts = realtimeFeed?.alerts || [];
    const feedDarkFlow = realtimeFeed?.darkFlowAlerts || [];
    const allAlerts: AlertItem[] = [...feedAlerts, ...feedDarkFlow, ...(globalRealtimeAlerts || []), ...(alerts || []), ...snapshotAlerts];
    return dedupAndSortAlerts(allAlerts) as AlertItem[];
  }, [alerts, realtimeFeed?.alerts, realtimeFeed?.darkFlowAlerts, globalRealtimeAlerts, snapshotAlerts]);

  // Severity filter state for UnifiedAlertCenter.
  //
  // The component applies this filter itself and computes its per-severity pill
  // counts from the UNFILTERED list. Filtering here as well meant the component
  // received an already-filtered array, so clicking "Cao" collapsed `Tất cả`
  // to (1) and every other pill to (0) — the counts a user relies on to decide
  // what to click. Pass the merged list and let the component filter once.
  const [severityFilter, setSeverityFilter] = React.useState<string>("all");

  // ----------------------------------

  const showSkeleton = loading && !hasHydrated;

  const prevReadyTokenRef = useRef("");
  useEffect(() => {
    const token = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, []);
    if (!loading && !error && onDataReady && token !== prevReadyTokenRef.current) {
      prevReadyTokenRef.current = token;
      onDataReady({ holdings, trackedSymbols, watchlistGroups, watchlists });
    }
  }, [loading, error, holdings, trackedSymbols, watchlists, watchlistGroups, onDataReady]);

  // Auto-select first tracked symbol (fallback to first universe symbol) so the
  // detail panel renders instead of the "Vui lòng chọn mã cổ phiếu" empty state.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    autoSelectedRef.current = false;
  }, [resolvedPortfolioId]);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (loading || error) return;
    if (selectedSymbol) {
      autoSelectedRef.current = true;
      return;
    }
    const firstTracked = (trackedSymbols || [])[0]?.symbol;
    const firstUniverse = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, [])[0];
    const target = firstTracked || firstUniverse;
    if (target) {
      setSelectedSymbol(String(target).toUpperCase().trim());
      autoSelectedRef.current = true;
    }
  }, [loading, error, selectedSymbol, trackedSymbols, holdings, watchlists]);

  if (!enabled || !resolvedPortfolioId) {
    return (
      <div className={"core-dashboard-page core-dashboard-page--empty " + className}>
        <DashboardHeading t={t} />
        <p className="core-dashboard-empty-hint">{t("dashboard.empty", "Chọn danh mục để xem tổng quan.")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={"core-dashboard-page " + className}>
        <DashboardHeading t={t} />
        <ErrorBanner message={error} t={t} />
      </div>
    );
  }

  return (
    <div className={"core-dashboard-page " + className}>
      <DashboardHeading t={t} />

      <div className="core-dashboard-slot core-dashboard-slot--stats">
        <PageErrorBoundary>
          {showSkeleton
            ? <LoadingSkeleton rows={1} />
              : <SmartStatsHeader
                summary={summary}
                analytics={analytics}
                holdings={holdings}
                loading={loading}
                realtimeBreadth={resolvedBreadth}
                updatedAt={(summary as any)?.updated_at ?? null}
              asOf={(summary as any)?.as_of ?? null}
                onRefresh={refresh}
              />
          }
        </PageErrorBoundary>
      </div>

      <div className="dashboard-triad-grid core-dashboard-slot core-dashboard-slot--triad">

        <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--alert-lane">
          <PageErrorBoundary>
            {showSkeleton
              ? <LoadingSkeleton rows={3} />
                : <UnifiedAlertCenter {...{
                    alerts: mergedAlerts as any,
                    loading: loading || snapshotLoading,
                    error: snapshotError,
                    selectedSession,
                    onSelectSession: setSelectedSession,
                    selectedSymbol,
                    onSelectSymbol: setSelectedSymbol,
                    severityFilter,
                    onSeverityFilterChange: setSeverityFilter,
                  } as any} />
            }
          </PageErrorBoundary>
        </div>

        <div className="dashboard-triad-lane dashboard-triad-lane--center core-dashboard-slot core-dashboard-slot--heatmap">
          <PageErrorBoundary>
            {showSkeleton
              ? <LoadingSkeleton rows={3} />
              : <PortfolioHeatmap
                  holdings={heatmapData as any}
                  quotesBySymbol={mergedQuotes}
                  technicals={technicals}
                  analytics={analytics}
                  loading={loading}
                  selectedSession={selectedSession}
                  onSelectSession={setSelectedSession}
                  selectedSymbol={selectedSymbol}
                  onSelectSymbol={setSelectedSymbol}
                  scopeCount={heatmapSymbols.length}
                  scopeUpdatedAt={(summary as any)?.updated_at ?? null}
                />
            }
          </PageErrorBoundary>
        </div>

        <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--ai">
          <PageErrorBoundary>
            {showSkeleton
              ? <LoadingSkeleton rows={3} />
              : <AIAdvisorAlertPanel {...{
                  holdings,
                  technicals,
                  analytics,
                  alerts: mergedAlerts,
                  loading,
                  selectedSession,
                  onSelectSession: setSelectedSession,
                  selectedSymbol,
                  onSelectSymbol: setSelectedSymbol,
                } as any} />
            }
          </PageErrorBoundary>
        </div>
      </div>

      <div className="dashboard-full-width-deck core-dashboard-slot core-dashboard-slot--deck">
        <PageErrorBoundary>
          {showSkeleton
            ? <LoadingSkeleton rows={4} />
            : <CoreDashboardPositionDeck
                holdings={holdings}
                trackedSymbols={trackedSymbols}
                watchlistGroups={watchlists}
                technicals={technicals}
                analytics={analytics}
                quotesBySymbol={mergedQuotes}
                alerts={mergedAlerts as any}
                loading={loading}
                selectedSession={selectedSession as any}
                onSelectSession={setSelectedSession as any}
                selectedSymbol={selectedSymbol as any}
                onSelectSymbol={setSelectedSymbol as any}
                digest={digest as any}
                onRequestDigest={fetchDigest as any}
              />
          }
        </PageErrorBoundary>
      </div>
    </div>
  );
}

export default DashboardPage;
