// C2: CSS widget tách khỏi bundle chính; tải cùng lúc với widget JS khi vào viewport (xem effect bên dưới).
import React, { createElement, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChartStockDataAdapter } from '../adapters/chartAdapter.js';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries, mapTapeTradesToEntries, mapAdvisorySessionToResult } from '../utils/VNInvestSignalAdapter.js';
import { mapComparisonOverlaysToSymbols } from '../utils/comparisonOverlayAdapter.js';
import { useViewportWhaleMarkers } from '../features/stock-detail/hooks/useViewportWhaleMarkers.js';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext.js';
import { useI18n } from '../context/LangContext.js';
import { useTenantTier } from '../adapters/useTenantTier.js';
import { useTrustTelemetry } from '../hooks/useTrustTelemetry.js';
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
  // W-K: chip "đang so sánh" + nút bỏ mã so sánh.
  'vninvest.compare_title': 'Đang so sánh:',
  'vninvest.compare_remove': 'Bỏ so sánh',
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

  // Tier gating (free / pro / enterprise). P3.4 + staging-pro: uu tien tier da
  // xac minh tu license offline (manh nhat), roi den `tier` prop neu caller truyen,
  // cuoi cung la Subscription.plan (fail-closed free).
  // Pro+ features: paper trade, settings, drawing dock (W-I: dock do WIDGET
  // render qua prop `showDrawingDock` — xem comment ben prop). Enterprise: + multi.
  // (state verifiedTier KHAI O DAY, truoc moi cho doc — tranh TDZ ReferenceError.)
  const [verifiedTier, setVerifiedTier] = useState(null);
  const { tier: serverTier } = useTenantTier();
  const tier = verifiedTier
    ?? (tierProp && tierProp !== 'free' ? tierProp : null)
    ?? serverTier;
  const isPro = tier === 'pro' || tier === 'enterprise';
  const isEnterprise = tier === 'enterprise';
  const showPaperTrade = enablePaperTrade || isEnterprise;
  const showSettings = enableSettings || isPro;

  const [widgetModule, setWidgetModule] = useState(null);
  const [widgetError, setWidgetError] = useState(null);
  // W-C: retryKey remount boundary sau retry (key tren Boundary, M-1);
  // importKey chay lai dynamic import khi retry import fail.
  // (Khai O DAY, truoc moi effect — TDZ ReferenceError neu khai sau.)
  const [retryKey, setRetryKey] = useState(0);
  const [importKey, setImportKey] = useState(0);
  // P34.4-license (staging Pro): tier xac minh tu license offline (ECDSA verify
  // qua engine-core + trust anchor da nap o module scope). Reset ve null khi
  // mat key / verify khong ra pro (khong giu tier cu — tranh keo dai quyen).
  useEffect(() => {
    if (!licenseKey) { setVerifiedTier(null); return; }
    let cancelled = false;
    ensureLicenseTrustAnchor();
    import('@vninvestcharts/engine-core')
      .then(({ verifyLicenseKey }) => verifyLicenseKey(licenseKey))
      .then((v) => {
        if (cancelled) return;
        setVerifiedTier(v && (v.tier === 'pro' || v.tier === 'enterprise') ? v.tier : null);
      })
      .catch(() => { if (!cancelled) setVerifiedTier(null); });
    return () => { cancelled = true; };
  }, [licenseKey]);
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
  }, [inView, importKey]);

  const handleBoundaryRetry = useCallback(() => {
    // Boundary tu reset hasError roi goi onRetry — bump key de remount
    // sach content (du phong khi loi con dinh).
    setRetryKey((k) => k + 1);
  }, []);

  const handleImportRetry = useCallback(() => {
    setWidgetError(null);
    setWidgetModule(null);
    setImportKey((k) => k + 1);
  }, []);

  const VNInvestCharts = widgetModule?.VNInvestCharts;
  const VNInvestMultiCharts = widgetModule?.VNInvestMultiCharts;
  const widgetMessagesVi = widgetModule?.widgetMessagesVi;
  const WidgetI18nProvider = widgetModule?.WidgetI18nProvider;
  const PaperTradePanel = widgetModule?.PaperTradePanel;
  const SettingsModal = widgetModule?.SettingsModal;
  // W-I: KHONG destructure `DrawingDock` standalone nua. Widget 0.4.4 render
  // drawing dock qua prop `showDrawingDock` (dts VNInvestChartsProps.d.ts:256);
  // bundle `jg()` tra null khi `!showDrawingDock && !forceOpen` VA chi render
  // khi `dock.isOpen` = true. Ban dau panel mount <DrawingDock workspaceId=...>
  // truc tiep nhung DrawingDockProps yeu cau isOpen/activeTab/labels/onClose/
  // onTabChange -> thieu isOpen => component render null => pro user KHONG
  // co drawing dock.
  // W-C: graceful degradation (dts widget 0.4.4). Lay qua optional-chain —
  // module null (import fail) thi undefined, re nhanh显式 ben duoi
  // (KHONG render bien co the-undefined — element chi tao o nhanh cuoi).
  const WidgetErrorBoundary = widgetModule?.WidgetErrorBoundary;
  const WidgetEmptyState = widgetModule?.WidgetEmptyState;

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
  // W-A: advisory session V2 (BE native) + loading; chi fetch khi pro
  // (dock tab advisory cua widget bi tier-gate dock_pro — free fetch la thua).
  const [advisorySession, setAdvisorySession] = useState(null);
  const [isAdvisoryLoading, setIsAdvisoryLoading] = useState(false);

  useEffect(() => {
    if (!isPro || !symbol) {
      setAdvisorySession(null);
      setIsAdvisoryLoading(false);
      return;
    }
    let cancelled = false;
    // E4 (B8): xoa session ma cu truoc fetch — tranh flash advisory ma cu
    // trong luc cho payload moi khi doi symbol pro->pro.
    setAdvisorySession(null);
    setIsAdvisoryLoading(true);
    coreApiAdapter.getStockAIAdvisorySession(symbol, { contract: 'v2' })
      .then((payload) => { if (!cancelled) setAdvisorySession(payload ?? null); })
      .catch(() => { if (!cancelled) setAdvisorySession(null); })
      .finally(() => { if (!cancelled) setIsAdvisoryLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, isPro]);

  const advisoryResult = useMemo(() => mapAdvisorySessionToResult(advisorySession), [advisorySession]);

  // W-B: tape (time & sales) tu BE IntradayTapeView; chi fetch khi pro
  // (dock tab tape tier-gate dock_pro — free fetch la thua). Filter ty VND
  // la local state (widget loc client-side theo value).
  const [tapeEntries, setTapeEntries] = useState([]);
  const [isTapeLoading, setIsTapeLoading] = useState(false);
  const [tapeFilterBillions, setTapeFilterBillions] = useState(0);

  useEffect(() => {
    if (!isPro || !symbol) {
      setTapeEntries([]);
      setIsTapeLoading(false);
      return;
    }
    let cancelled = false;
    // E4 (B8 W-A): xoa du lieu ma cu truoc fetch — tranh flash tape ma cu.
    setTapeEntries([]);
    setIsTapeLoading(true);
    coreApiAdapter.getIntradayTape(symbol, { page_size: 100 })
      .then((payload) => {
        if (cancelled) return;
        const trades = Array.isArray(payload?.trades) ? payload.trades : [];
        setTapeEntries(mapTapeTradesToEntries(trades));
      })
      .catch(() => { if (!cancelled) setTapeEntries([]); })
      .finally(() => { if (!cancelled) setIsTapeLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, isPro]);

  const handleTapeFilterChange = useCallback((value) => {
    setTapeFilterBillions(Number(value) || 0);
  }, []);

  // W-F: sink cho widget onTelemetry (BL-18, no-op khi absent phia widget).
  // Enrich symbol + timestamp qua hook nha (localStorage cap 200 entries).
  const { trackWidgetEvent } = useTrustTelemetry();
  const handleWidgetTelemetry = useCallback((event) => {
    if (!event || typeof event !== 'object') return;
    trackWidgetEvent({ symbol, kind: event.kind, code: event.code, message: event.message, context: event.context });
  }, [trackWidgetEvent, symbol]);

  const handleAdvisoryRefresh = useCallback(async () => {
    if (!symbol) return;
    setIsAdvisoryLoading(true);
    try {
      await coreApiAdapter.refreshStockAIAdvisorySession(symbol);
      const fresh = await coreApiAdapter.getStockAIAdvisorySession(symbol, { contract: 'v2' });
      setAdvisorySession(fresh ?? null);
    } catch {
      // Giu session cu (fail-closed) — khong xoa du lieu dang hien.
    } finally {
      setIsAdvisoryLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    // M-2 (B3 W-C): xoa bars ma cu khi doi symbol/timeframe/period (E4) —
    // tranh flash bars cu + nhanh empty co co hoi kich dung.
    setInternalBars([]);
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

  // W-K: overlay so sanh (widget gui qua prop `onComparisonChange`).
  // Widget DA co UI them/remove overlay (nut compare trong toolbar -> CompareModal
  // co symbol search) — phan app lam la chi CHI QUAN SAT: hien chip "dang so sanh"
  // + nut bo. KHONG tier-gate: widget khong gate compare nen free cung thay nut.
  const [comparedSymbols, setComparedSymbols] = useState([]);
  const handleComparisonChange = useCallback((overlays) => {
    setComparedSymbols(mapComparisonOverlaysToSymbols(overlays));
  }, []);
  const handleRemoveComparison = useCallback((comparedSymbol) => {
    chartRef.current?.removeCompareSymbol?.(comparedSymbol);
  }, []);

  const chartComponent = VNInvestCharts;

  // W-C: fallback cu (div tu viet) giu cho nhap module-null + truong hop
  // widget chua load xong component EmptyState. Nam trong chartTree nen
  // co i18n context khi dung WidgetEmptyState.
  const legacyFallback = (isLoadingState, errorMessage) => e(
    'div',
    { className: 'absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm text-slate-500' },
    e(
      'div',
      { className: 'flex flex-col items-center gap-2' },
      errorMessage
        ? e('span', { className: 'text-rose-400' }, t('vninvest.load_error', { defaultValue: 'Không thể tải biểu đồ' }))
        : e('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500' }),
      e('span', null, errorMessage || t('vninvest.loading', { defaultValue: 'Đang tải dữ liệu biểu đồ...' })),
    ),
  );

  const emptyStateNode = (isLoadingState, errorMessage, onRetryAction) => WidgetEmptyState
    ? e(WidgetEmptyState, {
      loading: isLoadingState,
      error: errorMessage ? new Error(errorMessage) : null,
      onRetry: onRetryAction,
    })
    : legacyFallback(isLoadingState, errorMessage);

  // Element chi tao khi module da load (chartComponent truthy) — nhanh
  // !module/loading/bars-rong o duoi khong bao gio cham vao bien nay.
  const chartElement = chartComponent ? e(
    chartComponent,
    {
      adapter,
          symbol,
          timeframe: activeTimeframe?.toLowerCase() === 'd' ? '1d' : activeTimeframe?.toLowerCase() === '1h' ? '1h' : activeTimeframe?.toLowerCase(),
          range: activePeriod,
          onRangeChange: onPeriodChange,
          drawingUiEnabled: true,
          // W-I: KHONG truyen `drawings`/`defaultDrawings` — widget chi bat storage
          // khi instance UNCONTROLLED (controlled-mode se TAT persistence). Mac dinh
          // luu drawing o localStorage key `rsc-drawings-v1-<symbol>-<timeframe>`
          // nen drawings con nguyen sau khi reload trang.
          // W-I: drawing dock (properties/objects/templates cua drawing) do WIDGET
          // render. `showDrawingDock` chi mo QUYEN mo dock (noi dung dock nam
          // trong RIGHT dock — widget render no o `showDock !== false`) nen gate
          // that la `showDock: isPro` ben duoi. Prop nay de pro mo duoc dock khi
          // toolbar toggle; free giu false. (Nut toggle van hien cho free la
          // pre-existing, xem docs/AUDIT_HANDOFF_WAVE1_20261112.md §4 W-I.)
          showDrawingDock: isPro,
          // W-K: widget gui overlay so sanh khi thay doi -> host hien chip.
          onComparisonChange: handleComparisonChange,
          showToolbar: true,
          showHeader: true,
          showFooter: true,
          // Right dock mo theo tier: pro thay duoc DataWindow (HLOC hover inspector)
          // + Watchlist + tinh nang dock; free giu an de tranh upsell lock "Nang cap Pro".
          // (Widget gate: showDock === false thi khong render.)
          showDock: isPro,
          showNonTradingDays: false,
          workspaceId: workspaceId ?? `stock-${symbol}`,
          // W-B: tape dock tab (pro-only). Data THAT tu BE IntradayTapeView
          // (map sang TapeEntry truoc khi truyen); empty -> panel hien
          // empty state. Free giu tat (dock tier-gate + tiet kiem fetch).
          showTapePanel: isPro,
          tapeEntries,
          isTapeLoading,
          tapeFilterBillions,
          onTapeFilterChange: handleTapeFilterChange,
          // W-A: advisory dock tab (pro-only). Widget 0.4.4 khong forward
          // advisorySession V2 -> bottom panel nen app map V2 sang legacy
          // AdvisoryResult truoc khi truyen (xem VNInvestSignalAdapter).
          // Empty/queued -> advisoryResult null -> panel hien empty state.
          showAdvisoryPanel: isPro,
          advisoryResult,
          isAdvisoryLoading,
          onAdvisoryRefresh: handleAdvisoryRefresh,
          // W-D: measurement overlay (thuoc do khoang gia/thoi gian, pro-only).
          // Thuan client, khong can data/adapter/i18n moi.
          measurementEnabled: isPro,
          // W-F: upsell CTA (free thay nudge -> ve /upgrade) + telemetry sink.
          upgradeUrl: '/upgrade',
          onTelemetry: handleWidgetTelemetry,
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
          // W-E: CVD render histogram (chuan CVD bars; oscillator la line) +
          // timezone mac dinh VN (uncontrolled — user van doi duoc trong widget).
          cvdMode: 'histogram',
          defaultTimezone: 'Asia/Ho_Chi_Minh',
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
      ) : null;

  // W-C: thu tu nhanh bat buoc (M-3) — Provider > Boundary > content:
  // !module -> loading prop -> bars rong -> boundary(chart). Chart chi
  // render o nhanh cuoi nen throw luc loading la impossible.
  const chartWithBoundary = WidgetErrorBoundary
    ? e(WidgetErrorBoundary, { key: retryKey, onRetry: handleBoundaryRetry }, chartElement)
    : chartElement;

  const chartBody = !chartComponent
    ? (widgetError
      ? emptyStateNode(false, widgetError, handleImportRetry)
      : emptyStateNode(true, null, null))
    : loading
      ? emptyStateNode(true, null, null)
      : internalBars.length === 0
        ? emptyStateNode(false, null, null)
        : chartWithBoundary;

  const panels = [];
  // W-I: bo mount `<DrawingDock>` standalone (luon render null — thieu `isOpen`).
  // Drawing dock that render THAT do widget qua prop `showDrawingDock` ben tren.
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
    {
      ref: chartContainerRef,
      // Quan sat runtime: expose tier len DOM (chi chuoi tier, khong secret)
      // de E2E/Playwright doc duoc ma khong can React DevTools.
      'data-tier': tier,
      className: 'vnstock-chart-panel flex flex-col h-full bg-[#0a0f1d] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative',
    },
    e('div', { className: 'flex-1 h-full relative' }, chartTree),
    // W-K: chip "đang so sánh" (chỉ hiện khi có overlay) + nút bỏ mã.
    comparedSymbols.length > 0
      ? e(
          'div',
          {
            className: 'flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/40 px-3 py-2',
            'data-testid': 'vnsc-compare-chips',
          },
          e('span', { className: 'text-xs text-slate-400' }, t('vninvest.compare_title')),
          ...comparedSymbols.map((comparedSymbol) => e(
            'span',
            {
              key: comparedSymbol,
              className: 'inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200',
            },
            comparedSymbol,
            e(
              'button',
              {
                type: 'button',
                className: 'ml-1 text-slate-400 hover:text-rose-400',
                'aria-label': `${t('vninvest.compare_remove')} ${comparedSymbol}`,
                title: t('vninvest.compare_remove'),
                onClick: () => handleRemoveComparison(comparedSymbol),
              },
              '×',
            ),
          )),
        )
      : null,
    ...panels,
  );
}
