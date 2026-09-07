import "./StockDetailPage.css";
import { createElement, useCallback, useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";

import { useStockDetailPageModel } from "../features/stock-detail/hooks/useStockDetailPageModel.js";
import { createCoreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { StockDetailHeader } from "../features/stock-detail/components/StockDetailHeader.js";
import { StockSessionWitness } from "../features/stock-detail/components/StockSessionWitness.js";
import VNStockChartPanel from "../components/VNStockChartPanel.js";
import { PageErrorBoundary } from "../components/PageErrorBoundary.js";
import WhaleBubbleChart from "../components/WhaleBubbleChart.jsx";
import { StockDetailTabs } from "../features/stock-detail/components/StockDetailTabs.js";
import { WorkstationLayout, StockOrderBookWidget, StockExecutionLogWidget } from "../components/workstation/index.js";
import { useOrderBook, useTradeLog } from "../components/workstation/hooks/index.js";
import { AIAdvisoryPromptConfigDrawer } from "../components/AIAdvisoryPromptConfigDrawer.js";

const DEFAULT_ENV = {};
const e: (...args: any[]) => any = createElement as any;

interface PromptConfigSource {
  enabled: boolean;
  lookback: number;
  indicators?: string[];
}

interface PromptConfig {
  version: number;
  sources: Record<string, PromptConfigSource>;
}

interface EnvConfig {
  getToken?: () => string | null;
  [key: string]: unknown;
}

interface StockDetailPageProps {
  env?: EnvConfig;
  symbol?: string;
  className?: string;
}

export function StockDetailPage({ env = DEFAULT_ENV, symbol: propSymbol, className = "" }: StockDetailPageProps) {
  const { symbol: routeSymbol } = useParams<{ symbol: string }>();
  const { t } = useI18n();
  const symbol = propSymbol || routeSymbol || "";
  const [isWatched, setIsWatched] = useState(false);
  const [defaultWatchlistId, setDefaultWatchlistId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<PromptConfig>(() => {
    const fallback: PromptConfig = {
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
    try {
      const stored = localStorage.getItem(`ai_advisory_prompt_config:${symbol}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.version === "number" &&
          parsed.sources &&
          typeof parsed.sources === "object"
        ) {
          return parsed as PromptConfig;
        }
      }
    } catch {
      // ignore
    }
    return fallback;
  });

  const showToast = useCallback((message: string) => {
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
    setVisibleRange,
    loadingBlocking,
    loadingDeferred,
    error,
    profile,
    snapshot,
    setChartBars,
    orderFlowData,
    advisory,
    advisoryFallbackFlags,
    whaleFeed,
    whaleFeedMeta,
    loadMoreWhaleFeed,
    news,
    financials,
    loadingNews,
    loadingFinancials,
    activeTab,
    setActiveTab,
    loadingProfile,
    refreshAdvisoryData,
    loadBlocking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useStockDetailPageModel({ env, initialSymbol: symbol } as any) as any;

  const handleSessionChange = useCallback((session: unknown) => {
    setSelectedSession(session);
  }, [setSelectedSession]);

  // S6: Load watchlists, resolve default, sync isWatched state.
  useEffect(() => {
    if (!symbol) return;
    const adapter = createCoreApiAdapter({ env: env as Record<string, string> });
    let active = true;
    adapter
      .getWatchlists()
      .then((res: any) => {
        if (!active) return;
        const lists = res?.results ?? res ?? [];
        const defaultList = lists[0];
        if (!defaultList) {
          setDefaultWatchlistId(null);
          setIsWatched(false);
          return;
        }
        setDefaultWatchlistId(defaultList.id);
        return adapter.getWatchlistItems(defaultList.id).then((items: any) => {
          if (!active) return;
          const itemList = items?.results ?? items ?? [];
          setIsWatched(itemList.some((it: any) => String(it.symbol).toUpperCase() === symbol.toUpperCase()));
        });
      })
      .catch(() => {
        if (active) {
          setDefaultWatchlistId(null);
          setIsWatched(false);
        }
      });
    return () => {
      active = false;
    };
  }, [symbol, env]);

  const handleVisibleRangeChange = useCallback((range: unknown) => {
    setVisibleRange(range);
  }, [setVisibleRange]);

  const handleWatch = useCallback(() => {
    if (!defaultWatchlistId) {
      showToast("Chưa có danh sách theo dõi. Vui lòng tạo trước khi thêm mã.");
      return;
    }
    const next = !isWatched;
    setIsWatched(next);
    const adapter = createCoreApiAdapter({ env: env as Record<string, string> });
    const op = next
      ? adapter.addWatchlistItem(defaultWatchlistId, symbol)
      : adapter.removeWatchlistItem(defaultWatchlistId, symbol);
    op.catch(() => {
      setIsWatched(!next);
      showToast("Cập nhật danh sách theo dõi thất bại.");
    });
  }, [defaultWatchlistId, isWatched, symbol, env, showToast]);

  const handleConfigChange = useCallback((nextConfig: PromptConfig) => {
    setPromptConfig(nextConfig);
    try {
      localStorage.setItem(`ai_advisory_prompt_config:${symbol}`, JSON.stringify(nextConfig));
    } catch {
      // ignore
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
      const win = window as unknown as Record<string, Record<string, unknown>>;
      return win.__ENV__?.WORKSTATION_LAYOUT_V2 === true ||
             localStorage.getItem("workstation_v2") === "true";
    }
    return false;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useOrderBookResult: any = useOrderBook({ symbol, env, getToken: (env as EnvConfig)?.getToken, intervalMs: 5000, enabled: isFeatureEnabled && !!symbol } as any);
  const { orderBook, loading: loadingOrderBook, error: errorOrderBook, refresh: refreshOrderBook } = useOrderBookResult;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useTradeLogResult: any = useTradeLog({ symbol, env, getToken: (env as EnvConfig)?.getToken, intervalMs: 5000, maxItems: 100, enabled: isFeatureEnabled && !!symbol } as any);
  const { trades, loading: loadingTradeLog, error: errorTradeLog, refresh: refreshTradeLog } = useTradeLogResult;

  const prevClose = useMemo(() => {
    const s = snapshot as unknown as Record<string, unknown> | null;
    return s?.prev_price ?? s?.reference_price ?? null;
  }, [snapshot]);

  if (!symbol) {
    return e(
      "div",
      { className: `sdp-page ${className}` },
      e(
        "div",
        { className: "sdp-empty-state" },
        e("div", { className: "sdp-empty-icon" }, "📊"),
        e("p", { className: "sdp-empty-text" }, t("stockDetail.page.selectSymbol"))
      )
    );
  }

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
            onClick: () => loadBlocking(),
          },
          "Thử lại"
        )
      )
    );
  }

  const leftColumn = e(
    "div",
    { className: "sdp-left-workspace" },
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
        orderFlowData,
        whaleSignals: whaleFeed,
        workspaceId: `stock-${symbol}`,
      })
    ),
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

  const rightColumn = e(
    "div",
    { className: "sdp-right-workspace" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e(StockOrderBookWidget, { orderBook, loading: loadingOrderBook, error: errorOrderBook, onRefresh: refreshOrderBook } as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e(StockExecutionLogWidget, { trades, loading: loadingTradeLog, error: errorTradeLog, onRefresh: refreshTradeLog, prevClose } as any)
  );

  return e(
    PageErrorBoundary,
    {
      fallbackTitle: "Lỗi hiển thị Stock Detail",
      errorMessage: error || undefined,
      onRetry: () => {
        loadBlocking();
      },
    },
    e(
      "div",
      { className: `sdp-page ${className}` },

      e("div", { className: "sdp-bg-glow sdp-bg-glow-1", "aria-hidden": "true" }),
      e("div", { className: "sdp-bg-glow sdp-bg-glow-2", "aria-hidden": "true" }),

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

      e(StockSessionWitness, {
        selectedSession,
        onClearSession: () => setSelectedSession(null),
        loading: loadingDeferred
      }),

      isFeatureEnabled
        ? e(WorkstationLayout, {
            enabled: true,
            children: {
              left: leftColumn,
              right: rightColumn,
            },
          })
        : leftColumn,

      e(StockDetailTabs, {
        symbol,
        activeTab,
        setActiveTab,
        profile,
        loadingProfile,
        snapshot,
        orderFlowData,
        whaleFeed,
        whaleFeedMeta,
        onLoadMoreWhaleFeed: loadMoreWhaleFeed,
        advisory: {
          ...((advisory || {}) as Record<string, unknown>),
          ...((advisoryFallbackFlags || {}) as Record<string, unknown>),
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

      drawerOpen && e(AIAdvisoryPromptConfigDrawer, {
        isOpen: drawerOpen,
        onClose: () => setDrawerOpen(false),
        config: promptConfig,
        onConfigChange: handleConfigChange
      }),

      toast && e(
        "div",
        { className: "sdp-toast-container" },
        e("div", { className: "sdp-toast" }, `✨ ${toast}`)
      )
    )
  );
}
