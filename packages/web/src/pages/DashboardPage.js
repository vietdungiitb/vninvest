/**
 * DashboardPage — DM-03 (SaaS Native)
 *
 * Trang tổng quan SaaS native sử dụng trực tiếp các component dashboard nội bộ.
 * Không còn phụ thuộc vào render-prop slots từ legacy PackageDashboardHost.
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import * as ReactModule from "react";
const React = ReactModule.default || ReactModule;
const { createElement, useEffect, useRef, useState, useMemo, useCallback } = React;

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
const NOOP = () => null;

export const collectUniqueSortedSymbols = (holdings, trackedSymbols, watchlists, watchlistGroups) => {
  const rawList = [
    ...(holdings || []).map(h => h?.symbol),
    ...(trackedSymbols || []).map(s => s?.symbol),
    ...(watchlists || []).flatMap(w => (w?.items || []).map(i => i?.symbol)),
    ...(watchlistGroups || []).flatMap(g => (g?.items || []).map(i => i?.symbol))
  ];

  const uniqueSorted = Array.from(
    new Set(rawList.map(s => String(s || "").trim().toUpperCase()).filter(Boolean))
  ).sort();

  return uniqueSorted.join("|");
};

function LoadingSkeleton({ rows = 3 }) {
  return e(
    "div",
    { className: "core-dashboard-skeleton" },
    ...Array.from({ length: rows }, (_, i) =>
      e("div", { key: i, className: "core-dashboard-skeleton-row" })
    )
  );
}

function ErrorBanner({ message, t = (key, defaultText) => defaultText }) {
  return e(
    "div",
    { className: "core-dashboard-error" },
    e("span", { className: "core-dashboard-error-icon" }, "⚠"),
    e("span", null, message || t("dashboard.errorLoad", "Không thể tải dữ liệu tổng quan."))
  );
}

/**
 * @param {{
 *   portfolioId: string|number|null,
 *   enabled?: boolean,
 *   quotesBySymbol?: object,
 *   alerts?: object[],
 *   darkFlowAlerts?: object[],
 *   realtimeBreadth?: { up: number, down: number, flat: number },
 *   alertProps?: object,
 *   onDataReady?: function,
 *   t?: function,
 *   className?: string,
 * }} props
 */
export function DashboardPage({
  portfolioId,
  enabled = true,
  quotesBySymbol = {},
  alerts = [],
  darkFlowAlerts = [],
  realtimeBreadth = { up: 0, down: 0, flat: 0 },
  alertProps = {},
  onDataReady = null,
  t = (key, defaultText) => defaultText,
  className = "",
}) {
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
  } = useCoreDashboardData({ portfolioId: resolvedPortfolioId, enabled });

  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [digest, setDigest] = useState(null);

  const fetchDigest = useCallback(async () => {
    if (!resolvedPortfolioId) return;
    try {
      const res = await coreApiAdapter.getPortfolioNewsDigest();
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
  const symbols = React.useMemo(() => symbolString ? symbolString.split("|") : [], [symbolString]);
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
    const unique = [];
    const seen = new Set();
    allAlerts.forEach(a => {
      const key = a?.id || `${a?.symbol}-${a?.ts || a?.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
    });
    return unique;
  }, [alerts, realtimeFeed?.alerts]);

  const mergedDarkFlowAlerts = React.useMemo(() => {
    const feedDark = realtimeFeed?.darkFlowAlerts || [];
    const allDark = [...feedDark, ...(darkFlowAlerts || [])];
    const unique = [];
    const seen = new Set();
    allDark.forEach(a => {
      const key = a?.id || `${a?.symbol}-${a?.ts || a?.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
    });
    return unique;
  }, [darkFlowAlerts, realtimeFeed?.darkFlowAlerts]);
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
    return e(
      "div",
      { className: "core-dashboard-page core-dashboard-page--empty " + className },
      e("p", { className: "core-dashboard-empty-hint" }, t("dashboard.empty", "Chọn danh mục để xem tổng quan."))
    );
  }

  if (error) {
    return e(
      "div",
      { className: "core-dashboard-page " + className },
      e(ErrorBanner, { message: error, t })
    );
  }

  return e(
    "div",
    { className: "core-dashboard-page " + className },

    // ── Slot: Stats header ────────────────────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--stats" },
      showSkeleton
        ? e(LoadingSkeleton, { rows: 1 })
        : e(SmartStatsHeader, {
            summary,
            analytics,
            holdings,
            loading,
            realtimeBreadth: resolvedBreadth,
            onRefresh: refresh,
          })
    ),

    // ── Top triad: alert lane | heatmap | AI lane ───────────────────────
    e(
      "div",
      { className: "dashboard-triad-grid core-dashboard-slot core-dashboard-slot--triad" },

      e(
        "div",
        { className: "dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--alert-lane" },
        showSkeleton
          ? e(LoadingSkeleton, { rows: 3 })
          : e(UnifiedAlertCenter, {
              alerts: mergedAlerts,
              alertSummary: alertProps?.alertSummary ?? null,
              loading,
              selectedSession,
              onSelectSession: setSelectedSession,
              selectedSymbol,
              onSelectSymbol: setSelectedSymbol,
            })
      ),

      e(
        "div",
        { className: "dashboard-triad-lane dashboard-triad-lane--center core-dashboard-slot core-dashboard-slot--heatmap" },
        showSkeleton
          ? e(LoadingSkeleton, { rows: 3 })
          : e(PortfolioHeatmap, {
              holdings,
              quotesBySymbol: mergedQuotes,
              technicals,
              analytics,
              loading,
              selectedSession,
              onSelectSession: setSelectedSession,
              selectedSymbol,
              onSelectSymbol: setSelectedSymbol,
            })
      ),

      e(
        "div",
        { className: "dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--ai" },
        showSkeleton
          ? e(LoadingSkeleton, { rows: 3 })
          : e(AIAdvisorAlertPanel, {
              holdings,
              technicals,
              analytics,
              alerts: mergedAlerts,
              loading,
              selectedSession,
              onSelectSession: setSelectedSession,
              selectedSymbol,
              onSelectSymbol: setSelectedSymbol,
            })
      )
    ),

    // ── Full-width deck ───────────────────────────────────────────────────
    e(
      "div",
      { className: "dashboard-full-width-deck core-dashboard-slot core-dashboard-slot--deck" },
      showSkeleton
        ? e(LoadingSkeleton, { rows: 4 })
        : e(FactsFirstModularPositionDeck, {
            holdings,
            trackedSymbols,
            watchlistGroups,
            technicals,
            analytics,
            quotesBySymbol: mergedQuotes,
            alerts: mergedAlerts,
            loading,
            selectedSession,
            onSelectSession: setSelectedSession,
            selectedSymbol,
            onSelectSymbol: setSelectedSymbol,
            digest,
            onRequestDigest: fetchDigest,
          })
    )
  );
}