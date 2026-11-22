// C2: CSS widget tách khỏi bundle chính; tải cùng lúc với widget JS khi vào viewport (xem effect bên dưới).
import React, { createElement, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChartStockDataAdapter } from '../adapters/chartAdapter.js';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { mapToWhaleOrders, mapToCvdSeries, mapTapeTradesToEntries, mapAdvisorySessionToResult } from '../utils/VNInvestSignalAdapter.js';
import { mapComparisonOverlaysToSymbols } from '../utils/comparisonOverlayAdapter.js';
import { useRealtimeFeedFromManager } from '../context/RealtimeContext.js';
import { useI18n } from '../context/LangContext.js';
import { useTenantTier } from '../adapters/useTenantTier.js';
import { useTrustTelemetry } from '../hooks/useTrustTelemetry.js';
import { ensureLicenseTrustAnchor } from '../lib/licenseTrustAnchor.js';
import { readPreloadedChartTier } from '../lib/chartDemoEntitlement.js';
import { createChartEnterpriseBinding } from '../lib/chartEnterpriseBinding.js';
import { resolveSessionFromChartItem } from '../utils/chartSessionDate.js';

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
  // ⚠ Các chuỗi của panel-chart đang VI-only (pattern sẵn có: `vninvest.loading`,
  // `vninvest.load_error`, `stockDetail.chart*` cũng không có trong vi.js/en.js) —
  // vì `t` short-circuit CHART_I18N_DEFAULTS trước globalT. Tách slice "EN
  // parity chuỗi chart" sau (không mở rộng W-K).
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
  // D1 Path A: server-side entitlement resolved before first render wins so the
  // always-on enterprise demo never falls back to `free` when billing is 404.
  const preloadedTier = readPreloadedChartTier();
  const tier = verifiedTier
    ?? preloadedTier
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
        // OB-2 (B8r3): chuan hoa Error object (chartBody doc .message ca hai nhanh).
        if (active) setWidgetError(err instanceof Error ? err : new Error(String(err?.message ?? err ?? 'Widget load failed')));
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

  // S2(b): dem so lan widget THAT SU goi fetch (zero-call = chua tung hoi du lieu).
  // Single identity (R1): 1 object `adapter` cho ca prop widget lan pushRealtimeBar —
  // delegate het ve base de khong tach doi `this._barCallbacks` registry.
  // Ref (khong phai state) de tranh re-render vo ich moi lan fetch; render doc qua stall timer.
  const fetchCallsRef = useRef(0);
  const adapter = useMemo(() => {
    const base = createChartStockDataAdapter({ env });
    const noteFetch = () => { fetchCallsRef.current += 1; };
    return {
      ...base,
      fetchBarsInRange: (...args) => { noteFetch(); return base.fetchBarsInRange(...args); },
      fetchBarsBefore: (...args) => { noteFetch(); return base.fetchBarsBefore(...args); },
      subscribeToBar: (...args) => base.subscribeToBar(...args),
      pushRealtimeBar: (...args) => base.pushRealtimeBar(...args),
      subscribeToTrades: (...args) => base.subscribeToTrades(...args),
      subscribeToOrderbook: (...args) => base.subscribeToOrderbook(...args),
      getSourceSemantics: (...args) => base.getSourceSemantics(...args),
      searchSymbols: (...args) => base.searchSymbols(...args),
    };
  }, [env]);

  // Enterprise dock binding: the widget renders the six tabs; we only provide
  // a host adapter backed by the existing core API adapter (honest notes).
  const enterpriseBinding = useMemo(
    () => (isEnterprise ? createChartEnterpriseBinding(symbol, { baseAdapter: adapter }) : null),
    [isEnterprise, symbol, adapter]
  );

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
    setWidgetError(null);
    setFetchStalled(false);
    fetchCallsRef.current = 0;
  }, [symbol, activeTimeframe, activePeriod]);

  // S2(b): stall detector — widget da mount, het loading, nhung sau STALL_GRACE_MS
  // van 0 fetch + 0 bars + khong loi => hien chan doan (khong phai "khong co du lieu").
  const [fetchStalled, setFetchStalled] = useState(false);

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
    onVisibleRangeChange?.(range);
  }, [onVisibleRangeChange]);

  const handleWidgetError = useCallback((err) => {
    // S2(a): loi runtime tu widget (fetch fail, enrich fail...) — hien that, khong nuot.
    setWidgetError(err instanceof Error ? err : new Error(String(err?.message ?? err ?? 'Unknown widget error')));
  }, []);

  const handleClick = useCallback((moreProps) => {
    // S2: resolve phiên theo múi Asia/Ho_Chi_Minh + guard date invalid
    // (click vùng trống → null → bỏ qua, không set session rác).
    const session = resolveSessionFromChartItem(moreProps?.currentItem);
    if (!session) return;
    onSessionChange?.({
      tradeDate: session.tradeDate,
      timestamp: session.timestamp,
    });
  }, [onSessionChange]);

  const handleBarsChange = useCallback((bars) => {
    setInternalBars(bars);
    if (Array.isArray(bars) && bars.length > 0) {
      // Co du lieu that -> xoa trang thai loi/stall cu (tranh banner doi).
      setWidgetError(null);
      setFetchStalled(false);
    }
    onBarsChange?.(bars);
  }, [onBarsChange]);

  const chartRef = useRef(null);

  // W-K: overlay so sanh (widget gui qua prop `onComparisonChange`).
  // Widget DA co UI them/remove overlay (nut compare trong toolbar -> CompareModal
  // co symbol search) — phan app lam la chi CHI QUAN SAT: hien chip "dang so sanh"
  // + nut bo. KHONG tier-gate: widget khong gate compare nen free cung thay nut.
  // ⚠ `symbolId` phai giu NGUYEN (widget so khop chinh xac) — chi `label` moi
  // uppercase; xoá overlay phai goi `removeCompareSymbol(symbolId)` nguyen ban.
  const [comparedSymbols, setComparedSymbols] = useState([]);
  const handleComparisonChange = useCallback((overlays) => {
    setComparedSymbols(mapComparisonOverlaysToSymbols(overlays));
  }, []);
  const handleRemoveComparison = useCallback((comparedSymbolId) => {
    chartRef.current?.removeCompareSymbol?.(comparedSymbolId);
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
          // D2b widget @ ddc947dd: enterprise dock tabs come from the widget.
          enterpriseBinding,
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
          // S2(a): widget bao loi runtime ve host (fetch fail, enrich fail...).
          onError: handleWidgetError,
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
  // S2: retry tren empty-state — import fail thi nap lai module, runtime thi remount content.
  const handleEmptyRetry = useCallback(() => {
    setWidgetError(null);
    // OB-1 (B8r3): retry tu banner stall phai reset stall + dem fetch,
    // neu khong bump retryKey la vo hinh (effect khong re-run, banner ket vinh vien).
    setFetchStalled(false);
    fetchCallsRef.current = 0;
    if (!chartComponent) {
      handleImportRetry();
    } else {
      // Remount content (widget refetch) — giu module da load.
      setRetryKey((k) => k + 1);
    }
  }, [chartComponent, handleImportRetry]);

  // S2(b): stall detector — widget da mount + het loading, nhung sau grace van
  // 0 fetch + 0 bars + khong loi => hien chan doan rieng (khong phai "khong co du lieu" chung).
  // Deps gom bars/error de reset timer + danh gia lai moi khi trang thai doi.
  useEffect(() => {
    setFetchStalled(false);
    if (!chartComponent || loading) return undefined;
    if (internalBars.length > 0 || widgetError) return undefined;
    const timer = setTimeout(() => {
      if (internalBars.length === 0 && !widgetError && fetchCallsRef.current === 0) {
        setFetchStalled(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartComponent, loading, symbol, activeTimeframe, activePeriod, internalBars, widgetError, retryKey]);

  const chartWithBoundary = WidgetErrorBoundary
    ? e(WidgetErrorBoundary, { key: retryKey, onRetry: handleBoundaryRetry }, chartElement)
    : chartElement;

  // S2-fix deadlock mount (W-C cu): widget CHI render khi da co bars, nhung bars
  // chi den tu onBarsChange cua widget -> khong bao gio fetch. Bay gio LUON mount
  // widget khi module load xong (widget tu quan ly loading/empty noi bo);
  // panel chi chen khi: chua co module, dang loading blocking, widget bao loi,
  // hoac stall (mount xong qua grace ma chua tung fetch).
  const chartBody = !chartComponent
    ? (widgetError
      ? e('div', { 'data-testid': 'vnsc-widget-error' }, emptyStateNode(false, widgetError.message || t('vninvest.chart_load_error', { defaultValue: 'Không thể tải biểu đồ' }), handleImportRetry))
      : emptyStateNode(true, null, null))
    : loading
      ? emptyStateNode(true, null, null)
      : widgetError
        // S2(a): loi that tu widget — hien message + retry (fail-visible).
        ? e('div', { 'data-testid': 'vnsc-widget-error' }, emptyStateNode(false, widgetError.message || t('vninvest.chart_load_error', { defaultValue: 'Không thể tải biểu đồ' }), handleEmptyRetry))
        : fetchStalled
          // S2(b): widget mount xong qua grace ma chua tung goi fetch.
          ? e('div', { 'data-testid': 'vnsc-no-fetch' }, emptyStateNode(false, t('vninvest.no_fetch_attempt', { defaultValue: 'Biểu đồ chưa yêu cầu dữ liệu — bấm thử lại hoặc mở console kiểm tra.' }), handleEmptyRetry))
          : chartWithBoundary;

  const panels = [];
  // W-I: bo mount `<DrawingDock>` standalone (luon render null — thieu `isOpen`).
  // Drawing dock that render THAT do widget qua prop `showDrawingDock` ben tren.
  // Paper trading is owned by the widget (dock tab gated by tier). Mounting a
  // second standalone <PaperTradePanel> with only `symbol` crashes the widget:
  // it requires `journal`/`positions` arrays. Do not duplicate widget UI.
  void showPaperTrade;
  void PaperTradePanel;
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
    // W-K: chip "đang so sánh" (chỉ hiện khi có overlay ĐANG ĐƯỢC VẼ — widget
    // không vẽ series khi `visible === false`) + nút bỏ mã.
    // Đặt TRÊN chart (flex-col => DOM order = thứ tự hiển thị) để user thấy
    // ngay mình đang so sánh mã nào; không có overlay => không render, không
    // chen layout.
    comparedSymbols.length > 0
      ? e(
          'div',
          {
            className: 'flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/40 px-3 py-2 shrink-0',
            'data-testid': 'vnsc-compare-chips',
            role: 'group',
            'aria-label': t('vninvest.compare_title'),
          },
          e('span', { className: 'text-xs text-slate-400' }, t('vninvest.compare_title')),
          ...comparedSymbols
            .filter((comparedSymbol) => comparedSymbol.visible)
            .map((comparedSymbol) => e(
              'span',
              {
                key: comparedSymbol.symbolId,
                className: 'inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200',
              },
              comparedSymbol.label,
              e(
                'button',
                {
                  type: 'button',
                  className: 'ml-1 text-slate-400 hover:text-rose-400',
                  'aria-label': `${t('vninvest.compare_remove')} ${comparedSymbol.label}`,
                  title: `${t('vninvest.compare_remove')} ${comparedSymbol.label}`,
                  onClick: () => handleRemoveComparison(comparedSymbol.symbolId),
                },
                e('span', { 'aria-hidden': 'true' }, '×'),
              ),
            )),
        )
      : null,
    e('div', { className: 'flex-1 h-full relative' }, chartTree),
    ...panels,
  );
}
