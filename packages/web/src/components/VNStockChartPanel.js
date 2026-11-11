// C2: CSS widget tách khỏi bundle chính; tải cùng lúc với widget JS khi vào viewport (xem effect bên dưới).
import React, { createElement, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChartStockDataAdapter } from '../adapters/chartAdapter.js';
import { mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries } from '../utils/VNInvestSignalAdapter.js';
import { useViewportWhaleMarkers } from '../features/stock-detail/hooks/useViewportWhaleMarkers.js';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext.js';
import { useI18n } from '../context/LangContext.js';
import { useTenantTier } from '../adapters/useTenantTier.js';
import { ensureLicenseTrustAnchor } from '../lib/licenseTrustAnchor.js';

// Trust anchor cho key license offline (JWK public kid=primary, nhung vao bundle
// la chu y — khong phai secret). Nap 1 lan luc module load, truoc khi widget verify.
ensureLicenseTrustAnchor();
import './VNStockChartPanel.css';

const e = createElement;

const CHART_I18N_DEFAULTS = {
  'stockDetail.chartPrice': 'Giá',
  'stockDetail.chartVolume': 'Khối lượng',
  'stockDetail.chartRsiMacd': 'RSI + MACD',
  'vninvest.loading': 'Đang tải dữ liệu biểu đồ...',
  'vninvest.load_error': 'Không thể tải biểu đồ',
};

export default function VNStockChartPanel({
  symbol,
  env,
  onBarsChange,
  loading = false,
  activePeriod,
  activeTimeframe,
  onPeriodChange,
  onTimeframeChange,
  onVisibleRangeChange,
  onSessionChange,
  whaleSignals = [],
  orderFlowData = null,
  enableCVD = false,
  enableInstitutionalStrength = false,
  workspaceId,
  tier: tierProp = 'free',
  enablePaperTrade = false,
  enableSettings = false,
  enableDrawingDock = false,
  // P3.4-license: offline license blob (vni1.*) do Owner cap theo tenant.
  // Widget tu verify ECDSA + unlock tier/caps (fail-closed khi thieu/sai).
  // KHONG hardcode blob o day — truyen tu caller khi co.
  licenseKey,
  // Observer co san cua widget (silent, goi sau moi lan validate) — optional.
  onLicenseDiagnostic,
}) {
  const { t: globalT, locale } = useI18n();
  const t = useCallback((key, options) => {
    if (key in CHART_I18N_DEFAULTS) return CHART_I18N_DEFAULTS[key];
    return globalT(key, options);
  }, [globalT]);

  const navigate = useNavigate();

  const theme = typeof document !== "undefined" && document.documentElement?.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";

  // Tier gating (free / pro / enterprise). P3.4: uu tien `tier` prop neu
  // caller truyen; khong thi doc Subscription.plan (fail-closed free).
  // Pro+ features: drawing dock, paper trade, settings. Enterprise: + multi.
  const { tier: serverTier } = useTenantTier();
  const tier = tierProp && tierProp !== 'free' ? tierProp : serverTier;
  const isPro = tier === 'pro' || tier === 'enterprise';
  const isEnterprise = tier === 'enterprise';
  const showPaperTrade = enablePaperTrade || isEnterprise;
  const showSettings = enableSettings || isPro;
  const showDrawingDock = enableDrawingDock || isPro;

  const [widgetModule, setWidgetModule] = useState(null);
  const [widgetError, setWidgetError] = useState(null);
  const chartContainerRef = useRef(null);
  // C2: defer widget chunk (2.1MB) cho tới khi panel gần viewport.
  // shortcut: khung giữ spinner khi chưa vào viewport; nâng cấp sau nếu cần placeholder "cuộn để tải".
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = chartContainerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    let active = true;
    Promise.all([
      import('@vninvestcharts/widget'),
      import('@vninvestcharts/widget/dist/index.css'),
    ])
      .then(([mod]) => {
        // CSS import tren dam bao style; inject la fallback khi CSS chunk chua ap dung.
        try { mod?.injectVNInvestChartsCSS?.(document); } catch (_) { /* css inject optional */ }
        if (active) setWidgetModule(mod);
      })
      .catch((err) => {
        if (active) setWidgetError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [inView]);

  const VNInvestCharts = widgetModule?.VNInvestCharts;
  const VNInvestMultiCharts = widgetModule?.VNInvestMultiCharts;
  const widgetMessagesVi = widgetModule?.widgetMessagesVi;
  const WidgetI18nProvider = widgetModule?.WidgetI18nProvider;
  const PaperTradePanel = widgetModule?.PaperTradePanel;
  const SettingsModal = widgetModule?.SettingsModal;
  const DrawingDock = widgetModule?.DrawingDock;

  const adapter = useMemo(() => createChartStockDataAdapter({ env }), [env]);

  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: symbol ? [symbol] : [],
    pollInterval: 5000,
  });

  const quote = realtimeFeed?.quotesBySymbol?.[symbol] ?? null;

  const buildBarFromQuote = useCallback((q) => {
    if (!q || !q.current_price) return null;
    const tf = (activeTimeframe || '').toLowerCase();
    const isDaily = tf === 'd' || tf === '1d';
    let barDate;
    if (isDaily) {
      const now = new Date();
      barDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      barDate = new Date(q.last_date || Date.now());
    }
    return {
      date: barDate,
      open: Number(q.open_price ?? q.current_price),
      high: Number(q.high_price ?? q.current_price),
      low: Number(q.low_price ?? q.current_price),
      close: Number(q.current_price),
      volume: Number(q.volume ?? 0),
    };
  }, [activeTimeframe]);

  const nextBar = useMemo(() => buildBarFromQuote(quote), [quote, buildBarFromQuote]);
  useEffect(() => {
    if (nextBar) {
      adapter.pushRealtimeBar(nextBar);
    }
  }, [nextBar, adapter]);

  const [internalBars, setInternalBars] = useState([]);
  const [visibleRange, setVisibleRange] = useState(null);

  useEffect(() => {
    setVisibleRange(null);
  }, [symbol, activeTimeframe, activePeriod]);

  const enrichedBars = useMemo(() => mapToOHLCVBars(internalBars), [internalBars]);

  const candlesForHook = useMemo(() => {
    return enrichedBars.map((bar) => ({
      ...bar,
      time: bar.time ?? bar.timestamp ?? (bar.date instanceof Date ? bar.date.getTime() : new Date(bar.date).getTime()) ?? bar.index,
    }));
  }, [enrichedBars]);

  const startIndex = visibleRange ? visibleRange.startIndex : 0;
  const endIndex = visibleRange ? visibleRange.endIndex : 0;
  const whaleTimes = useViewportWhaleMarkers(candlesForHook, startIndex, endIndex);

  const mappedWhaleOrders = useMemo(() => {
    // T1.4 R-1: BE trả matched_value/ts — map đầy đủ alias, skip khi thiếu price để không plot tại 0
    const signalsOrders = whaleSignals
      .map((s) => {
        const price = s.matched_value ?? s.value ?? s.price ?? s.close ?? null;
        if (price == null || !Number.isFinite(Number(price))) return null;
        const ts = s.ts ?? s.alert_at ?? s.time ?? s.timestamp ?? null;
        return {
          ts,
          price: Number(price),
          volume: s.volume ?? s.net_volume ?? 0,
          side: s.side || 'buy',
          size_class: s.size_class || 'shark',
        };
      })
      .filter(Boolean);
    return mapToWhaleOrders([...signalsOrders, ...(orderFlowData?.whale_orders || [])]);
  }, [whaleSignals, orderFlowData]);

  const mappedCvdSeries = useMemo(() => mapToCvdSeries(orderFlowData?.cvd_series || []), [orderFlowData]);

  // Demo-parity: KHONG truyen custom panes — dung DEFAULT_PANES cua widget.

  const handleVisibleRangeChange = useCallback((range) => {
    setVisibleRange(range);
    onVisibleRangeChange?.(range);
  }, [onVisibleRangeChange]);

  const handleClick = useCallback((moreProps) => {
    if (moreProps?.currentItem) {
      const item = moreProps.currentItem;
      const parsedDate = item.date instanceof Date ? item.date : new Date(item.date);
      const pad = (v) => String(v).padStart(2, '0');
      const dateStr = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
      onSessionChange?.({
        tradeDate: dateStr,
        timestamp: parsedDate.getTime(),
      });
    }
  }, [onSessionChange]);

  const handleBarsChange = useCallback((bars) => {
    setInternalBars(bars);
    onBarsChange?.(bars);
  }, [onBarsChange]);

  const chartRef = useRef(null);

  const chartComponent = VNInvestCharts;

  const chartBody = !chartComponent
    ? e(
        'div',
        { className: 'absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm text-slate-500' },
        e(
          'div',
          { className: 'flex flex-col items-center gap-2' },
          widgetError
            ? e('span', { className: 'text-rose-400' }, t('vninvest.load_error', { defaultValue: 'Không thể tải biểu đồ' }))
            : e('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500' }),
          e('span', null, widgetError ? widgetError : t('vninvest.loading', { defaultValue: 'Đang tải dữ liệu biểu đồ...' })),
        ),
      )
    : loading
      ? e(
          'div',
          { className: 'absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm text-slate-500' },
          e(
            'div',
            { className: 'flex flex-col items-center gap-2' },
            e('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500' }),
            e('span', null, t('vninvest.loading', { defaultValue: 'Đang tải dữ liệu biểu đồ...' })),
          ),
        )
      : e(
        chartComponent,
        {
          adapter,
          symbol,
          timeframe: activeTimeframe?.toLowerCase() === 'd' ? '1d' : activeTimeframe?.toLowerCase() === '1h' ? '1h' : activeTimeframe?.toLowerCase(),
          range: activePeriod,
          onRangeChange: onPeriodChange,
          drawingUiEnabled: true,
          showToolbar: true,
          showHeader: true,
          showFooter: true,
          // An right-dock rail (tier free hien upsell khoa "Nang cap Pro" —
          // thua, gay roi; widget gate: showDock === false thi khong render).
          showDock: false,
          showNonTradingDays: false,
          workspaceId: workspaceId ?? `stock-${symbol}`,
          // Demo-parity: tape side panel TAT (an chieu rong + de Ban/Mua).
          // Ban/Mua badges nam o footer nhu demo.
          showTapePanel: false,
          showAdvisoryPanel: false,
          // W0.9: KHONG bat `showCorporateEvents` — BE chua co nguon du lieu
          // corporate actions (ex-date / split / rights) nen overlay se rong;
          // bat rong = nhieu tinh, giong "noi doi" (xem roadmap §5 W5.3).
          showCorporateEvents: false,
          locale: locale,
          messages: widgetMessagesVi,
          theme: theme,
          enableWhale: true,
          whaleOrders: mappedWhaleOrders,
          enableCVD,
          externalCvdSeries: mappedCvdSeries?.length ? mappedCvdSeries : undefined,
          // KHONG truyen darkFlowStrength/SignalType — widget chi render badge
          // "Dark Flow" khi strength la finite number; bo han de UI gon
          // (quyet dinh san pham: mat badge ngay ca khi BE co dark-flow that).
          // P3.4-license: truyen licenseKey khi caller co (Owner cap theo tenant).
          // Widget tu verify offline + unlock tier/caps; undefined = giu slot cu.
          licenseKey: licenseKey ?? undefined,
          onLicenseDiagnostic,
          onClick: handleClick,
          onVisibleRangeChange: handleVisibleRangeChange,
          onBarsChange: handleBarsChange,
          onTimeframeChange: (tf) => {
            const mapped = tf === '1d' ? 'D' : tf === '1h' ? '1H' : tf;
            onTimeframeChange?.(mapped);
          },
onSymbolChange: (sym) => {
              navigate('/stocks/' + sym);
            },
            ref: chartRef,
          },
      );

  const panels = [];
  if (showDrawingDock && DrawingDock) {
    panels.push(e(DrawingDock, { key: 'drawing-dock', workspaceId: workspaceId ?? `stock-${symbol}` }));
  }
  if (showPaperTrade && PaperTradePanel) {
    panels.push(e(PaperTradePanel, { key: 'paper-trade', symbol }));
  }
  if (showSettings && SettingsModal) {
    panels.push(e(SettingsModal, { key: 'settings', open: false }));
  }

  const chartTree = WidgetI18nProvider
    ? e(WidgetI18nProvider, { locale, messages: widgetMessagesVi }, chartBody)
    : chartBody;

  return e(
    'div',
    { ref: chartContainerRef, className: 'vnstock-chart-panel flex flex-col h-full bg-[#0a0f1d] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative' },
    e('div', { className: 'flex-1 h-full relative' }, chartTree),
    ...panels,
  );
}
