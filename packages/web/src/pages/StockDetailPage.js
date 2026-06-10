/**
 * SM-P4.5 — StockDetailPage (SaaS Native Rebuild)
 * ===================================================
 * Trang chi tiết cổ phiếu cao cấp:
 *   - VNStockChartPanel: biểu đồ D3 hybrid (giá + CVD + Sức mạnh)
 *   - OrderFlowRadarPanel: radar dòng tiền đặt bên dưới biểu đồ
 *   - Advisory Card: đồng bộ theo session được chọn trên biểu đồ
 *
 * Quy định: KHÔNG dùng JSX trong file này — tuân theo convention
 * packages/web (createElement). Mọi component con có thể dùng JSX.
 *
 * Kiến trúc: SaaS Native OpenAPI — packages/core + packages/web ONLY.
 */
import "./StockDetailPage.css";
import { createElement, useCallback, useState } from "react";

import { useStockDetailPageModel } from "../features/stock-detail/hooks/useStockDetailPageModel.js";
import { StockDetailHeader } from "../features/stock-detail/components/StockDetailHeader.js";
import { StockSessionWitness } from "../features/stock-detail/components/StockSessionWitness.js";
import VNStockChartPanel from "../components/VNStockChartPanel.js";
import { OrderFlowRadarPanel } from "../components/OrderFlowRadarPanel.js";
import { StockContextDeck } from "../features/stock-detail/components/StockContextDeck.js";
import { StockInsightDeck } from "../features/stock-detail/components/StockInsightDeck.js";

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

// ─── Sub-components (createElement) ──────────────────────────────────────────

// ─── Helper definitions ───────────────────────────────────────────────────────

// ─── Main Page Export ─────────────────────────────────────────────────────────

export function StockDetailPage({ env = DEFAULT_ENV, symbol, className = "" }) {
  const [isWatched, setIsWatched] = useState(false);
  const [toast, setToast] = useState(null);

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
    whaleFeed,
    news,
    financials,
    loadingNews,
    loadingFinancials
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

  const handleAlertTrigger = useCallback(() => {
    showToast(`Cảnh báo cho mã ${symbol} sẽ được tích hợp với Unified Alert Center.`);
  }, [symbol, showToast]);

  const handleTradeTrigger = useCallback(() => {
    showToast(`Chức năng giao dịch cho mã ${symbol} đang kết nối qua cổng bảo mật.`);
  }, [symbol, showToast]);

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

  // ── Main layout ────────────────────────────────────────────────────────────
  return e(
    "div",
    { className: `sdp-page ${className}` },

    // ── Ambient glow background decorations ──
    e("div", { className: "sdp-bg-glow sdp-bg-glow-1", "aria-hidden": "true" }),
    e("div", { className: "sdp-bg-glow sdp-bg-glow-2", "aria-hidden": "true" }),

    // ── Header ────────────────────────────────
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

    // ── Session Witness Strip ──────────────────
    e(StockSessionWitness, {
      selectedSession,
      onClearSession: () => setSelectedSession(null),
      loading: loadingDeferred
    }),

    // ── Hero Workstation Chart Wrapper ─────────
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

    // ── OrderFlowRadarPanel (strictly full-width underneath) ──
    e(
      "div",
      { className: "sdp-radar-wrapper" },
      e(OrderFlowRadarPanel, {
        symbol,
        loading: loadingBlocking,
        orderFlowData,
        latestRealtimeAlert: null,
      })
    ),

    // ── StockContextDeck (CVD, depth, strength) ──
    e(StockContextDeck, {
      symbol,
      selectedSession,
      snapshot,
      orderFlowData,
      whaleFeed,
      loading: loadingDeferred
    }),

    // ── StockInsightDeck (Advisory, news, financials) ──
    e(StockInsightDeck, {
      advisory,
      selectedSession,
      loadingDeferred,
      news,
      financials,
      loadingNews,
      loadingFinancials
    }),

    // ── Toast Notification (Truthful UX) ──
    toast && e(
      "div",
      { className: "sdp-toast-container" },
      e("div", { className: "sdp-toast" }, `✨ ${toast}`)
    )
  );
}
