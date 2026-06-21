/**
 * SM-P4.5 — StockDetailPage (SaaS Native Rebuild) — Workstation Upgrade
 * ======================================================================
 * Trang chi tiết cổ phiếu cao cấp với layout Workstation 2 cột (SSI iBoard Style):
 *   - Left (65%): VNStockChartPanel + OrderFlowRadarPanel
 *   - Right (35%): StockOrderBookWidget + StockExecutionLogWidget
 *   - Mobile (<768px): Tab switcher [Biểu đồ | Sổ lệnh | Khớp lệnh]
 *   - Feature flag: WORKSTATION_LAYOUT_V2
 *
 * Quy định: KHÔNG dùng JSX trong file này — tuân theo convention
 * packages/web (createElement). Mọi component con có thể dùng JSX.
 *
 * Kiến trúc: SaaS Native OpenAPI — packages/core + packages/web ONLY.
 */
import "./StockDetailPage.css";
import { createElement, useCallback, useState, useEffect, useMemo } from "react";

import { useStockDetailPageModel } from "../features/stock-detail/hooks/useStockDetailPageModel.js";
import { StockDetailHeader } from "../features/stock-detail/components/StockDetailHeader.js";
import { StockSessionWitness } from "../features/stock-detail/components/StockSessionWitness.js";
import VNStockChartPanel from "../components/VNStockChartPanel.js";
import WhaleBubbleChart from "../components/WhaleBubbleChart.jsx";
import { StockDetailTabs } from "../features/stock-detail/components/StockDetailTabs.js";
import { WorkstationLayout, StockOrderBookWidget, StockExecutionLogWidget } from "../components/workstation/index.js";
import { useOrderBook, useTradeLog } from "../components/workstation/hooks/index.js";
import { AIAdvisoryPromptConfigDrawer } from "../components/AIAdvisoryPromptConfigDrawer.js";

const DEFAULT_ENV = {};
const e = createElement;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(v, locale = "vi-VN") {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}N`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Tr`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("vi-VN");
}

function signalColorClass(signal) {
  const s = String(signal || "").toLowerCase();
  if (s === "buy" || s === "strong_buy") return "sdp-signal-buy";
  if (s === "sell" || s === "strong_sell") return "sdp-signal-sell";
  return "sdp-signal-neutral";
}

function signalLabel(signal) {
  const map = {
    buy: "Mua",
    strong_buy: "Mua Mạnh",
    sell: "Bán",
    strong_sell: "Bán Mạnh",
    neutral: "Trung lập",
    hold: "Giữ",
    watch: "Theo dõi",
  };
  return map[String(signal || "").toLowerCase()] || signal || "—";
}

// ─── Main Page Export ─────────────────────────────────────────────────────────

export function StockDetailPage({ env = DEFAULT_ENV, symbol, className = "" }) {
  const [isWatched, setIsWatched] = useState(false);
  const [toast, setToast] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(`ai_advisory_prompt_config:${symbol}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse prompt config", e);
    }
    return {
      version: 2,
      sources: {
        whale: { enabled: true, lookback: 30 },
        dark_flow: { enabled: true, lookback: 30 },
        technical: { enabled: true, lookback: 20, indicators: ["rsi", "bollinger", "vols", "prices", "ma20", "ma50", "snapshot", "cdms"] },
        news: { enabled: true, lookback: 14 },
        market: { enabled: true, lookback: 7 },
        fundamental: { enabled: true, lookback: 90 },
        ownership: { enabled: true, lookback: 365 },
        sector: { enabled: true, lookback: 20 }
      }
    };
  });

  const showToast = useCallback((message) => {
    setToast(message);
    const timer = setTimeout(() => {
      setToast((curr) => curr === message ? null : curr);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const {
    activeTimeframe,
    setActiveTimeframe,
    activePeriod,
    setActivePeriod,
    selectedSession,
    setSelectedSession,
    visibleRange,
    setVisibleRange,
    loadingBlocking,
    loadingDeferred,
    error,
    profile,
    snapshot,
    chartBars,
    setChartBars,
    orderFlowData,
    advisory,
    advisoryFallbackFlags,
    whaleFeed,
    news,
    financials,
    loadingNews,
    loadingFinancials,
    activeTab,
    setActiveTab,
    loadingProfile,
    refreshAdvisoryData
  } = useStockDetailPageModel({ env, initialSymbol: symbol });

  const handleSessionChange = useCallback((session) => {
    setSelectedSession(session);
  }, [setSelectedSession]);

  const handleVisibleRangeChange = useCallback((range) => {
    setVisibleRange(range);
  }, [setVisibleRange]);

  const handleWatch = useCallback(() => {
    setIsWatched((w) => !w);
  }, []);

  const handleConfigChange = useCallback((nextConfig) => {
    setPromptConfig(nextConfig);
    try {
      localStorage.setItem(`ai_advisory_prompt_config:${symbol}`, JSON.stringify(nextConfig));
    } catch (e) {
      console.error("Failed to save prompt config", e);
    }
  }, [symbol]);

  const handleRefreshAdvisory = useCallback(() => {
    refreshAdvisoryData(promptConfig);
  }, [refreshAdvisoryData, promptConfig]);

  const handleAlertTrigger = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleTradeTrigger = useCallback(() => {
    showToast(`Chức năng giao dịch cho mã ${symbol} đang kết nối qua cổng bảo mật.`);
  }, [symbol, showToast]);

  const isFeatureEnabled = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.__ENV__?.WORKSTATION_LAYOUT_V2 === true ||
             localStorage.getItem("workstation_v2") === "true";
    }
    return false;
  }, []);

  // ── Workstation Data Hooks ──────────────────────────────────────────────────
  const { orderBook, loading: loadingOrderBook, error: errorOrderBook, refresh: refreshOrderBook } = useOrderBook({
    symbol,
    env,
    getToken: env.getToken,
    intervalMs: 5000,
    enabled: isFeatureEnabled && !!symbol,
  });

  const { trades, loading: loadingTradeLog, error: errorTradeLog, refresh: refreshTradeLog } = useTradeLog({
    symbol,
    env,
    getToken: env.getToken,
    intervalMs: 5000,
    maxItems: 100,
    enabled: isFeatureEnabled && !!symbol,
  });

  // Get previous close for trade log change calculation
  const prevClose = useMemo(() => {
    return snapshot?.prev_price ?? snapshot?.reference_price ?? null;
  }, [snapshot]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!symbol) {
    return e(
      "div",
      { className: `sdp-page ${className}` },
      e(
        "div",
        { className: "sdp-empty-state" },
        e("div", { className: "sdp-empty-icon" }, "📊"),
        e("p", { className: "sdp-empty-text" }, "Vui lòng chọn mã cổ phiếu để xem chi tiết.")
      )
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (!loadingBlocking && error) {
    return e(
      "div",
      { className: `sdp-page ${className}` },
      e(
        "div",
        { className: "sdp-error-state" },
        e("div", { className: "sdp-error-icon" }, "⚠️"),
        e("p", { className: "sdp-error-text" }, error),
        e(
          "button",
          {
            className: "sdp-retry-btn",
            type: "button",
            onClick: () => setSelectedSession(null),
          },
          "Thử lại"
        )
      )
    );
  }

  // ── Left Column: Chart + Radar ─────────────────────────────────────────────
  const leftColumn = e(
    "div",
    { className: "sdp-left-workspace" },
    // Chart Wrapper
    e(
      "div",
      { className: "sdp-chart-wrapper" },
      e(VNStockChartPanel, {
        symbol,
        env,
        onBarsChange: setChartBars,
        loading: loadingBlocking,
        activePeriod,
        activeTimeframe,
        onPeriodChange: setActivePeriod,
        onTimeframeChange: setActiveTimeframe,
        onVisibleRangeChange: handleVisibleRangeChange,
        onSessionChange: handleSessionChange,
        flowData: orderFlowData,
        orderFlowData,
        whaleSignals: whaleFeed,
      })
    ),
    // Whale Bubble Chart Panel
    e(
      "div",
      { className: "sdp-radar-wrapper" },
      e(WhaleBubbleChart, {
        selectedSymbol: symbol,
        env,
        isEmbedded: false,
      })
    )
  );

  // ── Right Column: Order Book + Trade Log ───────────────────────────────────
  const rightColumn = e(
    "div",
    { className: "sdp-right-workspace" },
    e(StockOrderBookWidget, {
      orderBook,
      loading: loadingOrderBook,
      error: errorOrderBook,
      onRefresh: refreshOrderBook,
    }),
    e(StockExecutionLogWidget, {
      trades,
      loading: loadingTradeLog,
      error: errorTradeLog,
      onRefresh: refreshTradeLog,
      prevClose,
    })
  );

  // ── Main layout with WorkstationLayout ─────────────────────────────────────
  return e(
    "div",
    { className: `sdp-page ${className}` },

    // Ambient glow background decorations
    e("div", { className: "sdp-bg-glow sdp-bg-glow-1", "aria-hidden": "true" }),
    e("div", { className: "sdp-bg-glow sdp-bg-glow-2", "aria-hidden": "true" }),

    // Header
    e(StockDetailHeader, {
      symbol,
      profile,
      snapshot: loadingBlocking ? null : snapshot,
      loading: loadingBlocking,
      isWatched,
      onWatch: handleWatch,
      onAlertTrigger: handleAlertTrigger,
      onTradeTrigger: handleTradeTrigger
    }),

    // Session Witness Strip
    e(StockSessionWitness, {
      selectedSession,
      onClearSession: () => setSelectedSession(null),
      loading: loadingDeferred
    }),

    // Workstation Layout (Split-screen or Mobile tabs)
    isFeatureEnabled
      ? e(WorkstationLayout, {
          enabled: true,
          children: {
            left: leftColumn,
            right: rightColumn,
          },
        })
      : leftColumn,

    // StockDetailTabs (Unified 8-tab panel structure)
    e(StockDetailTabs, {
      symbol,
      activeTab,
      setActiveTab,
      profile,
      loadingProfile,
      snapshot,
      orderFlowData,
      whaleFeed,
      advisory: {
        ...(advisory || {}),
        ...(advisoryFallbackFlags || {}),
      },
      selectedSession,
      loadingDeferred,
      news,
      loadingNews,
      financials,
      loadingFinancials,
      onRefreshAdvisory: handleRefreshAdvisory,
      onOpenConfigDrawer: () => setDrawerOpen(true)
    }),

    // AI Advisory Prompt Config Drawer
    drawerOpen && e(AIAdvisoryPromptConfigDrawer, {
      isOpen: drawerOpen,
      onClose: () => setDrawerOpen(false),
      config: promptConfig,
      onConfigChange: handleConfigChange
    }),

    // Toast Notification
    toast && e(
      "div",
      { className: "sdp-toast-container" },
      e("div", { className: "sdp-toast" }, `✨ ${toast}`)
    )
  );
}