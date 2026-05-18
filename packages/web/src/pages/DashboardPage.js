/**
 * DashboardPage — DM-03
 *
 * Trang tổng quan SaaS native. Không dùng JSX.
 * Nhận 5 render-prop slot từ PackageDashboardHost (frontend/src) để hiển thị
 * các component legacy mà không import trực tiếp.
 *
 * Slots:
 *   renderStats({ summary, holdings, loading, realtimeBreadth, onRefresh })
 *   renderDeck({ holdings, technicals, analytics, quotesBySymbol, alerts, loading })
 *   renderAlerts({ alertProps, loading })
 *   renderHeatmap({ holdings, quotesBySymbol, technicals, analytics, loading })
 *   renderBubble({ holdings, quotesBySymbol, technicals, loading })
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useCoreDashboardData } from "../features/dashboard/useCoreDashboardData.js";

const e = createElement;
const NOOP = () => null;

function LoadingSkeleton({ rows = 3 }) {
  return e(
    "div",
    { className: "core-dashboard-skeleton" },
    ...Array.from({ length: rows }, (_, i) =>
      e("div", { key: i, className: "core-dashboard-skeleton-row" })
    )
  );
}

function ErrorBanner({ message }) {
  return e(
    "div",
    { className: "core-dashboard-error" },
    e("span", { className: "core-dashboard-error-icon" }, "⚠"),
    e("span", null, message || "Không thể tải dữ liệu tổng quan.")
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
 *   renderDeck?: function,
 *   renderAlerts?: function,
 *   renderHeatmap?: function,
 *   renderBubble?: function,
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
  renderDeck = NOOP,
  renderAlerts = NOOP,
  renderHeatmap = NOOP,
  renderBubble = NOOP,
  onDataReady = null,
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
    refresh,
  } = useCoreDashboardData({ portfolioId, enabled });

  // Notify parent (PackageDashboardHost) when core data is ready
  const prevHoldingsRef = useRef(null);
  useEffect(() => {
    if (!loading && !error && onDataReady && holdings !== prevHoldingsRef.current) {
      prevHoldingsRef.current = holdings;
      onDataReady({ holdings, trackedSymbols, watchlistGroups });
    }
  }, [loading, error, holdings, trackedSymbols, watchlistGroups, onDataReady]);

  if (!enabled || !portfolioId) {
    return e(
      "div",
      { className: "core-dashboard-page core-dashboard-page--empty " + className },
      e("p", { className: "core-dashboard-empty-hint" }, "Chọn danh mục để xem tổng quan.")
    );
  }

  if (error) {
    return e(
      "div",
      { className: "core-dashboard-page " + className },
      e(ErrorBanner, { message: error })
    );
  }

  return e(
    "div",
    { className: "core-dashboard-page " + className },

    // ── Slot: Stats header ────────────────────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--stats" },
      loading
        ? e(LoadingSkeleton, { rows: 1 })
        : renderStats({ summary, holdings, loading, realtimeBreadth, onRefresh: refresh })
    ),

    // ── Slot: Position deck ───────────────────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--deck" },
      loading
        ? e(LoadingSkeleton, { rows: 4 })
        : renderDeck({ holdings, technicals, analytics, quotesBySymbol, alerts, loading })
    ),

    // ── Slot: Alert center ────────────────────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--alerts" },
      renderAlerts({ alertProps, loading })
    ),

    // ── Slot: Portfolio heatmap ───────────────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--heatmap" },
      loading
        ? e(LoadingSkeleton, { rows: 3 })
        : renderHeatmap({ holdings, quotesBySymbol, technicals, analytics, loading })
    ),

    // ── Slot: Bubble / position bubble ───────────────────────────────────
    e(
      "div",
      { className: "core-dashboard-slot core-dashboard-slot--bubble" },
      loading
        ? e(LoadingSkeleton, { rows: 2 })
        : renderBubble({ holdings, quotesBySymbol, technicals, loading })
    )
  );
}

