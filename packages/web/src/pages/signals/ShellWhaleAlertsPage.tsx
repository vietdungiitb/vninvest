import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createCoreWhaleAnalyticsSnapshotClient } from "../../adapters/core/index.js";
import {
  ShellPageChrome,
  ShellPanel,
  renderShellField,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import {
  buildVisibilityFlags,
  countFlagsByState,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  getEnabledSurfaceKeys,
  renderAbilityList,
  renderBuildMetaCard,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const SIGNAL_ROUTE_IDS = ["ai-advisory", "whale-alerts"];
const DEFAULT_WHALE_SYMBOL = "HPG";

function normalizeWhaleSymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeWhaleTradeDate(value: unknown): string {
  const normalized = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function resolveWhaleSearch(whaleSearch: unknown): string {
  if (typeof whaleSearch === "string") return whaleSearch;
  if (typeof globalThis.location?.search === "string") return globalThis.location.search;
  return "";
}

function resolveWhaleSymbolFromSearch(whaleSearch: unknown): string {
  const search = resolveWhaleSearch(whaleSearch);
  if (!search) return "";
  try {
    return normalizeWhaleSymbol(new URLSearchParams(search).get("symbol"));
  } catch {
    return "";
  }
}

function resolveWhaleTradeDateFromSearch(whaleSearch: unknown): string {
  const search = resolveWhaleSearch(whaleSearch);
  if (!search) return "";
  try {
    const searchParams = new URLSearchParams(search);
    return normalizeWhaleTradeDate(searchParams.get("trade_date") || searchParams.get("tradeDate"));
  } catch {
    return "";
  }
}

function resolveWhaleSymbolState(whaleSymbol: unknown, whaleSearch: unknown): { symbol: string; isExplicit: boolean } {
  const explicitSymbol = normalizeWhaleSymbol(
    whaleSymbol || resolveWhaleSymbolFromSearch(whaleSearch),
  );
  if (explicitSymbol) {
    return { symbol: explicitSymbol, isExplicit: true };
  }
  return { symbol: DEFAULT_WHALE_SYMBOL, isExplicit: false };
}

function resolveWhaleTradeDate(env: Record<string, unknown> = {}, whaleTradeDate?: unknown, whaleSearch?: unknown): string {
  return normalizeWhaleTradeDate(
    whaleTradeDate
      || resolveWhaleTradeDateFromSearch(whaleSearch)
      || env.VNINVEST_WHALE_ALERTS_TRADE_DATE
      || env.REACT_APP_WHALE_ALERTS_TRADE_DATE
      || "",
  );
}

function syncWhaleSearch(symbol: string, tradeDate: string, whaleSearch: unknown): void {
  if (typeof whaleSearch === "string") return;
  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") return;
  try {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.searchParams.set("symbol", symbol);
    if (tradeDate) {
      nextUrl.searchParams.set("trade_date", tradeDate);
    } else {
      nextUrl.searchParams.delete("trade_date");
    }
    globalThis.history.replaceState(globalThis.history.state, "", nextUrl.toString());
  } catch {
    // Keep local page state working even if URL sync is unavailable.
  }
}

function createInitialWhaleSnapshotState(initialWhaleSnapshot: unknown = null) {
  return {
    loading: !initialWhaleSnapshot,
    error: "",
    data: initialWhaleSnapshot as Record<string, unknown> | null,
  };
}

function normalizeWhaleSnapshotError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Không thể tải whale analytics snapshot thật từ portfolio runtime.";
}

interface WhaleSnapshotData {
  symbol?: string;
  trade_date?: string;
  session_context?: Record<string, unknown>;
  session?: Record<string, unknown>;
  session_summary?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  materialization?: Record<string, unknown>;
  quality_flags?: Record<string, unknown>;
  [key: string]: unknown;
}

function buildWhaleSnapshotRows(whaleSnapshot: WhaleSnapshotData | null, whaleSymbol: string, whaleTradeDate: string) {
  if (!whaleSnapshot) {
    return [
      { label: "Mã", value: whaleSymbol || "n/a" },
      { label: "Ngày yêu cầu", value: whaleTradeDate || "Mới nhất" },
      { label: "Ngày phiên trả về", value: "Chưa nạp" },
      { label: "Chất lượng", value: "Chưa có whale snapshot thật" },
    ];
  }
  return [
    { label: "Mã", value: whaleSnapshot.symbol || whaleSymbol || "n/a" },
    { label: "Ngày yêu cầu", value: whaleTradeDate || (whaleSnapshot.session_context?.selected_trade_date as string) || "Mới nhất" },
    { label: "Ngày phiên trả về", value: whaleSnapshot.trade_date || "Chưa có" },
    { label: "Nguồn phiên", value: (whaleSnapshot.session?.resolved_from as string) || "n/a" },
    { label: "Chất lượng", value: (whaleSnapshot.session_summary?.quality_state as string) || (whaleSnapshot.session_context?.quality_state as string) || "UNKNOWN" },
    { label: "Luồng đọc", value: (whaleSnapshot.materialization?.read_path as string) || "n/a" },
    { label: "Lệnh whale", value: String(whaleSnapshot.summary?.whale_order_count ?? 0) },
    { label: "Số bucket facts", value: String(whaleSnapshot.materialization?.bucket_fact_count ?? 0) },
  ];
}

function buildWhaleSnapshotContextItems(whaleSnapshot: WhaleSnapshotData | null): string[] {
  const sessionContext = whaleSnapshot?.session_context;
  if (!sessionContext) return [];
  return [
    `Ngày yêu cầu: ${sessionContext.selected_trade_date || "n/a"}`,
    `Ngày hợp lệ gần nhất: ${sessionContext.latest_valid_trade_date || "n/a"}`,
    `Chất lượng phiên: ${sessionContext.quality_state || "UNKNOWN"}`,
    `Nguồn phiên: ${(whaleSnapshot?.session?.resolved_from as string) || "n/a"}`,
  ];
}

function buildWhaleSnapshotMaterializationItems(whaleSnapshot: WhaleSnapshotData | null): string[] {
  const materialization = whaleSnapshot?.materialization;
  const qualityFlags = whaleSnapshot?.quality_flags;
  if (!materialization && !qualityFlags) return [];
  return [
    `Độ tươi dữ liệu: ${(materialization?.freshness_state as string) || "n/a"}`,
    `Độ đầy đủ: ${(materialization?.completeness_state as string) || "n/a"}`,
    `Ưu tiên facts-first: ${qualityFlags?.facts_first_primary_path ? "BẬT" : "TẮT"}`,
    `Có session summary: ${qualityFlags?.has_session_summary ? "BẬT" : "TẮT"}`,
    `Phiên bản contract: ${(qualityFlags?.contract_version as string) || "n/a"}`,
  ];
}

interface ShellWhaleAlertsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
  whaleSymbol?: string;
  whaleTradeDate?: string;
  whaleSearch?: string;
  whaleSnapshotLoader?: (opts?: Record<string, unknown>) => Promise<WhaleSnapshotData>;
  initialWhaleSnapshot?: WhaleSnapshotData | null;
}

export function ShellWhaleAlertsPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
  whaleSymbol,
  whaleTradeDate,
  whaleSearch,
  whaleSnapshotLoader,
  initialWhaleSnapshot = null,
}: ShellWhaleAlertsPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: "Không thể tải snapshot whale alerts từ core runtime.",
    refreshNotice: "Đã làm mới snapshot whale alerts từ core runtime.",
  });

  const whaleLoaderRef = useRef<(opts?: Record<string, unknown>) => Promise<WhaleSnapshotData> | null>(null) as { current: ((opts?: Record<string, unknown>) => Promise<WhaleSnapshotData> | null) | null };
  const whaleEnvRef = useRef(env);
  const whaleFetchRef = useRef(fetchImpl);

  whaleEnvRef.current = env;
  whaleFetchRef.current = fetchImpl;

  const resolvedWhaleSymbolState = resolveWhaleSymbolState(whaleSymbol, whaleSearch);
  const resolvedWhaleSymbol = resolvedWhaleSymbolState.symbol;
  const resolvedWhaleTradeDate = resolveWhaleTradeDate(env, whaleTradeDate, whaleSearch);
  const [activeWhaleSymbol, setActiveWhaleSymbol] = useState(() => resolvedWhaleSymbol);
  const [activeWhaleTradeDate, setActiveWhaleTradeDate] = useState(() => resolvedWhaleTradeDate);
  const [whaleSymbolDraft, setWhaleSymbolDraft] = useState(() => resolvedWhaleSymbol);
  const [whaleTradeDateDraft, setWhaleTradeDateDraft] = useState(() => resolvedWhaleTradeDate);
  const [whaleSnapshotState, setWhaleSnapshotState] = useState(() => createInitialWhaleSnapshotState(initialWhaleSnapshot));

  whaleLoaderRef.current = whaleSnapshotLoader || ((requestOptions = {}) =>
    createCoreWhaleAnalyticsSnapshotClient({
      env: whaleEnvRef.current,
      fetchImpl: whaleFetchRef.current,
    }).getWhaleAnalyticsSnapshot({
      symbol: activeWhaleSymbol,
      timeframe: "session",
      compact: true,
      includeBaseline: false,
      tradeDate: activeWhaleTradeDate || undefined,
      ...requestOptions,
    }));

  const {
    buildMeta,
    health,
    capabilities,
    session,
    identity,
    surfaces,
    visibleGroups,
    visibleRoutes,
    abilities,
  } = deriveCoreShellSnapshot(viewState);

  const signalRoutes = filterVisibleRoutes(visibleRoutes, SIGNAL_ROUTE_IDS);
  const whaleAbilities = filterAbilitiesBySubject(abilities, "whaleadvisory");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);
  const whaleSnapshotRows = buildWhaleSnapshotRows(whaleSnapshotState.data as WhaleSnapshotData | null, activeWhaleSymbol, activeWhaleTradeDate);
  const whaleSnapshotContextItems = buildWhaleSnapshotContextItems(whaleSnapshotState.data as WhaleSnapshotData | null);
  const whaleSnapshotMaterializationItems = buildWhaleSnapshotMaterializationItems(whaleSnapshotState.data as WhaleSnapshotData | null);
  const latestValidWhaleTradeDate = normalizeWhaleTradeDate((whaleSnapshotState.data as WhaleSnapshotData)?.session_context?.latest_valid_trade_date);
  const canJumpToLatestValidTradeDate = Boolean(
    latestValidWhaleTradeDate && latestValidWhaleTradeDate !== activeWhaleTradeDate,
  );

  useEffect(() => {
    if (resolvedWhaleSymbolState.isExplicit) {
      setActiveWhaleSymbol(prev => (prev === resolvedWhaleSymbol ? prev : resolvedWhaleSymbol));
      setWhaleSymbolDraft(prev => (prev === resolvedWhaleSymbol ? prev : resolvedWhaleSymbol));
    }
    setActiveWhaleTradeDate(prev => (prev === resolvedWhaleTradeDate ? prev : resolvedWhaleTradeDate));
    setWhaleTradeDateDraft(prev => (prev === resolvedWhaleTradeDate ? prev : resolvedWhaleTradeDate));
  }, [resolvedWhaleSymbol, resolvedWhaleTradeDate, resolvedWhaleSymbolState.isExplicit]);

  useEffect(() => {
    if (!autoLoad || !activeWhaleSymbol) return;
    let active = true;

    async function runWhaleSnapshotLoad() {
      setWhaleSnapshotState(prev => ({ ...prev, loading: true, error: "" }));
      try {
        const whaleSnapshot = await whaleLoaderRef.current!({
          symbol: activeWhaleSymbol,
          tradeDate: activeWhaleTradeDate || undefined,
        });
        if (!active) return;
        setWhaleSnapshotState({ loading: false, error: "", data: whaleSnapshot });
      } catch (error) {
        if (!active) return;
        setWhaleSnapshotState(prev => ({ ...prev, loading: false, error: normalizeWhaleSnapshotError(error) }));
      }
    }

    runWhaleSnapshotLoad();
    return () => { active = false; };
  }, [activeWhaleSymbol, activeWhaleTradeDate, autoLoad]);

  async function refreshWhaleSnapshot() {
    try {
      const whaleSnapshot = await whaleLoaderRef.current!({
        symbol: activeWhaleSymbol,
        tradeDate: activeWhaleTradeDate || undefined,
      });
      setWhaleSnapshotState({ loading: false, error: "", data: whaleSnapshot });
    } catch (error) {
      setWhaleSnapshotState(prev => ({ ...prev, loading: false, error: normalizeWhaleSnapshotError(error) }));
    }
  }

  async function handleRefreshAll() {
    await Promise.all([handleRefresh(), refreshWhaleSnapshot()]);
  }

  function handleWhaleSymbolChange(event: React.ChangeEvent<HTMLInputElement>) {
    setWhaleSymbolDraft(normalizeWhaleSymbol(event.target.value));
  }

  function handleWhaleTradeDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    setWhaleTradeDateDraft(normalizeWhaleTradeDate(event.target.value));
  }

  function handleWhaleSnapshotSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextSymbol = normalizeWhaleSymbol(whaleSymbolDraft) || resolvedWhaleSymbol;
    const nextTradeDate = normalizeWhaleTradeDate(whaleTradeDateDraft);
    if (!nextSymbol || (nextSymbol === activeWhaleSymbol && nextTradeDate === activeWhaleTradeDate)) return;
    setActiveWhaleSymbol(nextSymbol);
    setActiveWhaleTradeDate(nextTradeDate);
    setWhaleSymbolDraft(nextSymbol);
    setWhaleTradeDateDraft(nextTradeDate);
    syncWhaleSearch(nextSymbol, nextTradeDate, whaleSearch);
  }

  function handleJumpToLatestValidTradeDate() {
    if (!canJumpToLatestValidTradeDate) return;
    setActiveWhaleTradeDate(latestValidWhaleTradeDate);
    setWhaleTradeDateDraft(latestValidWhaleTradeDate);
    syncWhaleSearch(activeWhaleSymbol, latestValidWhaleTradeDate, whaleSearch);
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Whale symbol", activeWhaleSymbol || "n/a"),
    renderShellMetric("Ngày mục tiêu", activeWhaleTradeDate || "Mới nhất"),
    renderShellMetric("Quality state", (whaleSnapshotState.data as WhaleSnapshotData)?.session_summary?.quality_state as string || (whaleSnapshotState.data as WhaleSnapshotData)?.session_context?.quality_state as string || "n/a"),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "whale-alerts-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || (session?.principal?.username as string) || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: (session?.session_id as string) || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "whale-alerts-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "signals",
    activeDetail: "Đây là group gating chính cho lane whale alerts trong signals shell.",
    visibleDetail: "Group này vẫn đi cùng session signals hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(signalRoutes, {
    activeItem: "whale-alerts",
    activeDetail: "Đây là route whale alerts chính mà shell signals cần mở cho session hiện tại.",
    visibleDetail: "Route signals liên quan đang được runtime cho phép hiển thị.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core whale alerts signals"
      title="Trung tâm whale alerts và tín hiệu"
      description="Trang này xác nhận lane whale alerts của core shell đã có route-level audit surface thật, bám đúng signals routes, whale ability naming và bootstrap session mà không chạm vào KLine intelligence workspace thật của feature pack whale."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane whale alerts" : "Lane whale alerts sẵn sàng cho kiểm tra"}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <ShellPanel
            title="Snapshot operator và runtime"
            subtitle="Đọc nhanh session, runtime health và build meta trước khi nối whale workspace thật vào shell signals này."
            actions={renderRefreshAction({ onClick: handleRefreshAll, disabled: viewState.loading || whaleSnapshotState.loading })}
          >
            <section className="shellPage__summaryGrid">{summaryCards}</section>
          </ShellPanel>

          <ShellPanel
            title="Signals groups và whale routes"
            subtitle="Kiểm tra group `signals` cùng route `whale-alerts` đã được runtime mở đúng theo bootstrap hiện tại hay chưa."
          >
            <div key="whale-alerts-groups">
              <h3 className="shellPage__itemTitle">Visible groups</h3>
              {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "whale-alerts-groups")}
            </div>
            <div key="whale-alerts-routes">
              <h3 className="shellPage__itemTitle">Signals routes</h3>
              {renderFlagList(routeFlags, "Runtime hiện chưa expose route whale alerts nào cho session này.", "whale-alerts-routes")}
            </div>
          </ShellPanel>
        </div>

        <ShellPanel
          title="Whale snapshot facts và build metadata"
          subtitle="Giữ cùng một viewport cho auditor đọc signal reach, facts-first snapshot state, selected trade-date context và ability map của lane whale alerts trước khi nối UI whale intelligence thật."
          actions={renderHealthStatusPill(health)}
        >
          <form className="shellPage__form" key="whale-alerts-symbol-form" onSubmit={handleWhaleSnapshotSubmit}>
            <div className="shellPage__formGrid">
              {renderShellField({
                label: "Mã whale alerts",
                name: "whale-alerts-symbol",
                value: whaleSymbolDraft,
                onChange: handleWhaleSymbolChange,
                placeholder: "Ví dụ: SSI",
                autoComplete: "off",
              })}
              {renderShellField({
                label: "Ngày giao dịch yêu cầu",
                name: "whale-alerts-trade-date",
                type: "date",
                value: whaleTradeDateDraft,
                onChange: handleWhaleTradeDateChange,
                autoComplete: "off",
              })}
            </div>
            <div className="shellPage__actions">
              <button type="submit" className="shellPage__button shellPage__button--primary" disabled={whaleSnapshotState.loading || !whaleSymbolDraft}>
                Tải snapshot whale
              </button>
              {canJumpToLatestValidTradeDate ? (
                <button type="button" className="shellPage__button shellPage__button--secondary" disabled={whaleSnapshotState.loading} onClick={handleJumpToLatestValidTradeDate}>
                  Dùng phiên hợp lệ gần nhất
                </button>
              ) : null}
            </div>
          </form>

          {renderSummaryCard({
            key: "whale-alerts-runtime-snapshot",
            title: `Whale snapshot thật (${activeWhaleSymbol})`,
            rows: whaleSnapshotRows,
          })}

          {whaleSnapshotState.error ? (
            <div className="shellPage__empty" key="whale-alerts-runtime-error">{whaleSnapshotState.error}</div>
          ) : null}
          {whaleSnapshotState.loading && !whaleSnapshotState.data ? (
            <div className="shellPage__empty" key="whale-alerts-runtime-loading">Đang nạp whale analytics snapshot thật từ portfolio runtime.</div>
          ) : null}

          {renderBuildMetaCard({ key: "whale-alerts-build-meta", buildMeta })}

          <div key="whale-alerts-signal-routes">
            <h3 className="shellPage__itemTitle">Signals routes</h3>
            {renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "whale-alerts-signal-routes")}
          </div>
          <div key="whale-alerts-surfaces">
            <h3 className="shellPage__itemTitle">Enabled surfaces</h3>
            {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "whale-alerts-surfaces")}
          </div>
          <div key="whale-alerts-session-context">
            <h3 className="shellPage__itemTitle">Ngữ cảnh phiên</h3>
            {renderValueList(whaleSnapshotContextItems, "Whale snapshot hiện chưa trả session context nào.", "whale-alerts-session-context")}
          </div>
          <div key="whale-alerts-materialization">
            <h3 className="shellPage__itemTitle">Trạng thái materialization</h3>
            {renderValueList(whaleSnapshotMaterializationItems, "Whale snapshot hiện chưa trả materialization facts nào.", "whale-alerts-materialization")}
          </div>

          {renderAbilityList({
            abilities: whaleAbilities,
            emptyText: "Runtime hiện chưa trả về ability whale lane nào cho route này.",
            keyPrefix: "whale-alerts-ability",
          })}

          <article className="shellPage__surfaceCard" key="whale-alerts-summary-card">
            <h3 className="shellPage__itemTitle">Signals summary</h3>
            <p className="shellPage__itemMeta">Signals routes visible: {signalRoutes.length}</p>
            <p className="shellPage__itemMeta">Whale routes active: {countFlagsByState(routeFlags, "ACTIVE")}</p>
            <p className="shellPage__itemMeta">Facts-first read path: {(whaleSnapshotState.data as WhaleSnapshotData)?.materialization?.read_path as string || "n/a"}</p>
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
