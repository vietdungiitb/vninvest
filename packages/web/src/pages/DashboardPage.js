/**
 * DashboardPage — DM-03
 *
 * Trang tổng quan SaaS native. Không dùng JSX.
 * Nhận 5 render-prop slot từ PackageDashboardHost (frontend/src) để hiển thị
 * các component legacy mà không import trực tiếp.
 *
 * Slots:
 *   renderStats({ summary, analytics, holdings, loading, realtimeBreadth, onRefresh })
 *   renderAlertLane({ alerts, alertSummary, alertProps, loading })
 *   renderHeatmap({ holdings, quotesBySymbol, technicals, analytics, loading })
 *   renderAiPanel({ holdings, technicals, analytics, alerts, loading })
 *   renderDeck({ holdings, technicals, analytics, quotesBySymbol, alerts, loading })
 */
import * as ReactModule from "react";
const React = ReactModule.default || ReactModule;
const { createElement, useEffect, useRef, useState } = React;

import { useCoreDashboardData } from "../features/dashboard/useCoreDashboardData.js";
import { AIAdvisorAlertPanel } from "../features/dashboard/AIAdvisorAlertPanel.js";
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";

const e = createElement;
const NOOP = () => null;

export const collectUniqueSortedSymbols = (holdings, trackedSymbols, watchlists, watchlistGroups) => {
  const rawList = [
    ...(holdings || []).map(h => h?.symbol),
    ...(trackedSymbols || []).map(s => s?.symbol),
    ...(watchlists || []).flatMap(w => (w?.items || []).map(i => i?.symbol)),
    ...(watchlistGroups || []).flatMap(g => (g?.items || []).map(i => i?.symbol))
  ];
  
  // Normalization, Deduplication và Alphabetical Sorting
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
 *   renderStats?: function,
 *   renderAlertLane?: function,
 *   renderDeck?: function,
 *   renderHeatmap?: function,
 *   renderAiPanel?: function,
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
  renderStats = NOOP,
  renderAlertLane = null,
  renderAlerts = null,
  renderDeck = NOOP,
  renderHeatmap = NOOP,
  renderAiPanel = NOOP,
  onDataReady = null,
  t = (key, defaultText) => defaultText,
  className = "",
}) {
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
  } = useCoreDashboardData({ portfolioId, enabled });

  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

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

  const resolvedRenderAlertLane = renderAlertLane || renderAlerts || NOOP;
  const showSkeleton = loading && !hasHydrated;

  // Notify parent (PackageDashboardHost) when core data is ready using stable readyToken
  const prevReadyTokenRef = useRef("");
  useEffect(() => {
    const token = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, watchlistGroups);
    if (!loading && !error && onDataReady && token !== prevReadyTokenRef.current) {
      prevReadyTokenRef.current = token;
      onDataReady({ holdings, trackedSymbols, watchlistGroups, watchlists });
    }
  }, [loading, error, holdings, trackedSymbols, watchlists, watchlistGroups, onDataReady]);

  if (!enabled || !portfolioId) {
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
        : renderStats({ summary, analytics, holdings, loading, realtimeBreadth: resolvedBreadth, onRefresh: refresh })
    ),

    // ── Top triad: alert lane | heatmap | AI lane ───────────────────────
    e(
      "div",
      { className: "dashboard-triad-grid core-dashboard-slot core-dashboard-slot--triad" },

      e(
        "div",
        { className: "dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--alert-lane" },
        resolvedRenderAlertLane({
          alerts: mergedAlerts,
          alertSummary: alertProps?.alertSummary ?? null,
          alertProps,
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
          : renderHeatmap({
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
        : renderDeck({
            holdings,
            technicals,
            analytics,
            quotesBySymbol: mergedQuotes,
            alerts: mergedAlerts,
            loading,
            selectedSession,
            onSelectSession: setSelectedSession,
            selectedSymbol,
            onSelectSymbol: setSelectedSymbol,
          })
    )
  );
}

