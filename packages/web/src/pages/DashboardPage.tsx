/**
 * DashboardPage — DM-03 (SaaS Native)
 *
 * Trang tổng quan SaaS native sử dụng trực tiếp các component dashboard nội bộ.
 * Không còn phụ thuộc vào render-prop slots từ legacy PackageDashboardHost.
 * Chuyển đổi sang TypeScript/TSX với type safety đầy đủ.
 */
import React, { createElement, useEffect, useRef, useState, useCallback } from "react";

import { useCoreDashboardData } from "../features/dashboard/useCoreDashboardData.js";
import { AIAdvisorAlertPanel } from "../features/dashboard/AIAdvisorAlertPanel.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";
import { SmartStatsHeader } from "../components/dashboard/SmartStatsHeader.js";
import { PortfolioHeatmap } from "../components/dashboard/PortfolioHeatmap.js";
import { UnifiedAlertCenter } from "../components/dashboard/UnifiedAlertCenter.js";
import { FactsFirstModularPositionDeck } from "../components/dashboard/FactsFirstModularPositionDeck.js";
import { usePortfolio } from "../context/PortfolioContext.js";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;

// Type definitions
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
  darkFlowAlerts?: AlertItem[];
  realtimeBreadth?: BreadthData;
  alertProps?: Record<string, unknown>;
  onDataReady?: (data: {
    holdings: Holding[];
    trackedSymbols: TrackedSymbol[];
    watchlistGroups: WatchlistGroup[];
    watchlists: Watchlist[];
  }) => void;
  t?: (key: string, defaultText: string) => string;
  className?: string;
}

export function collectUniqueSortedSymbols(
  holdings: Holding[],
  trackedSymbols: TrackedSymbol[],
  watchlists: Watchlist[],
  watchlistGroups: WatchlistGroup[]
): string {
  const rawList = [
    ...(holdings || []).map((h) => h?.symbol),
    ...(trackedSymbols || []).map((s) => s?.symbol),
    ...(watchlists || []).flatMap((w) => (w?.items || []).map((i) => i?.symbol)),
    ...(watchlistGroups || []).flatMap((g) => (g?.items || []).map((i) => i?.symbol)),
  ];

  const uniqueSorted = Array.from(
    new Set(rawList.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean))
  ).sort();

  return uniqueSorted.join("|");
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
  alertProps = {},
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
      const res = await (coreApiAdapter as any).getPortfolioNewsDigest();
      setDigest(res);
    } catch (e) {
      console.warn("Failed to fetch news digest", e);
    }
  }, [resolvedPortfolioId]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  // --- Real-time Feed Integration ---
  const symbolString = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, watchlistGroups);
  const symbols = React.useMemo(() => (symbolString ? symbolString.split("|") : []), [symbolString]);
  const realtimeFeed = useRealtimeFeedFromManager({ symbols, pollInterval: 10000 });

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

  const mergedAlerts = React.useMemo(() => {
    const feedAlerts = realtimeFeed?.alerts || [];
    const allAlerts = [...feedAlerts, ...(alerts || [])];
    const unique: AlertItem[] = [];
    const seen = new Set<string>();
    allAlerts.forEach((a) => {
      const key = a?.id || `${a?.symbol}-${a?.ts || a?.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
    });
    return unique;
  }, [alerts, realtimeFeed?.alerts]);

  // ----------------------------------

  const showSkeleton = loading && !hasHydrated;

  // Notify parent when core data is ready using stable readyToken
  const prevReadyTokenRef = useRef("");
  useEffect(() => {
    const token = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, watchlistGroups);
    if (!loading && !error && onDataReady && token !== prevReadyTokenRef.current) {
      prevReadyTokenRef.current = token;
      onDataReady({ holdings, trackedSymbols, watchlistGroups, watchlists });
    }
  }, [loading, error, holdings, trackedSymbols, watchlists, watchlistGroups, onDataReady]);

  if (!enabled || !resolvedPortfolioId) {
    return (
      <div className={"core-dashboard-page core-dashboard-page--empty " + className}>
        <p className="core-dashboard-empty-hint">{t("dashboard.empty", "Chọn danh mục để xem tổng quan.")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={"core-dashboard-page " + className}>
        <ErrorBanner message={error} t={t} />
      </div>
    );
  }

  return (
    <div className={"core-dashboard-page " + className}>

      <div className="core-dashboard-slot core-dashboard-slot--stats">
        {showSkeleton
          ? <LoadingSkeleton rows={1} />
          : <SmartStatsHeader
              summary={summary}
              analytics={analytics}
              holdings={holdings}
              loading={loading}
              realtimeBreadth={resolvedBreadth}
              onRefresh={refresh}
            />
        }
      </div>

      <div className="dashboard-triad-grid core-dashboard-slot core-dashboard-slot--triad">

        <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--alert-lane">
          {showSkeleton
            ? <LoadingSkeleton rows={3} />
            : <UnifiedAlertCenter {...{
                alerts: mergedAlerts as any,
                alertSummary: (alertProps as any)?.alertSummary ?? null,
                loading,
                selectedSession,
                onSelectSession: setSelectedSession,
                selectedSymbol,
                onSelectSymbol: setSelectedSymbol,
              } as any} />
          }
        </div>

        <div className="dashboard-triad-lane dashboard-triad-lane--center core-dashboard-slot core-dashboard-slot--heatmap">
          {showSkeleton
            ? <LoadingSkeleton rows={3} />
            : <PortfolioHeatmap
                holdings={holdings}
                quotesBySymbol={mergedQuotes}
                technicals={technicals}
                analytics={analytics}
                loading={loading}
                selectedSession={selectedSession}
                onSelectSession={setSelectedSession}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
              />
          }
        </div>

        <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--ai">
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
        </div>
      </div>

      <div className="dashboard-full-width-deck core-dashboard-slot core-dashboard-slot--deck">
        {showSkeleton
          ? <LoadingSkeleton rows={4} />
          : <FactsFirstModularPositionDeck
              holdings={holdings}
              trackedSymbols={trackedSymbols}
              watchlistGroups={watchlistGroups}
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
      </div>
    </div>
  );
}

export default DashboardPage;