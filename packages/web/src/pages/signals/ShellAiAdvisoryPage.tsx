import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createCoreAdvisorySessionClient } from "../../adapters/core/index.js";
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

function normalizeAdvisorySymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function resolveAdvisorySearch(advisorySearch: unknown): string {
  if (typeof advisorySearch === "string") {
    return advisorySearch;
  }
  if (typeof globalThis.location?.search === "string") {
    return globalThis.location.search;
  }
  return "";
}

function resolveAdvisorySymbolFromSearch(advisorySearch: unknown): string {
  const search = resolveAdvisorySearch(advisorySearch);
  if (!search) return "";
  try {
    return normalizeAdvisorySymbol(new URLSearchParams(search).get("symbol"));
  } catch {
    return "";
  }
}

function resolveAdvisorySymbol(env: Record<string, unknown> = {}, advisorySymbol?: unknown, advisorySearch?: unknown): string {
  return normalizeAdvisorySymbol(
    advisorySymbol
      || resolveAdvisorySymbolFromSearch(advisorySearch)
      || env.VNINVEST_AI_ADVISORY_SYMBOL
      || env.REACT_APP_AI_ADVISORY_SYMBOL
      || "BCM",
  );
}

function syncAdvisorySymbolSearch(symbol: string, advisorySearch: unknown): void {
  if (typeof advisorySearch === "string") return;
  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") return;
  try {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.searchParams.set("symbol", symbol);
    globalThis.history.replaceState(globalThis.history.state, "", nextUrl.toString());
  } catch {
    // Ignore URL sync failures.
  }
}

function createInitialAdvisoryState(initialAdvisorySession: unknown = null) {
  return {
    loading: !initialAdvisorySession,
    error: "",
    data: initialAdvisorySession as Record<string, unknown> | null,
  };
}

function normalizeAdvisoryError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Không thể tải advisory session thật từ stock workspace runtime.";
}

interface AdvisorySessionData {
  symbol?: string;
  contract_version?: string;
  selected_trade_date?: string;
  aggregate?: {
    decision?: Record<string, unknown>;
    observability?: {
      aggregate_quality?: Record<string, unknown>;
    };
    benchmarks?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

function buildAdvisoryRows(advisorySession: AdvisorySessionData | null, advisorySymbol: string) {
  if (!advisorySession) {
    return [
      { label: "Symbol", value: advisorySymbol || "n/a" },
      { label: "Contract", value: "Chưa nạp" },
      { label: "Trạng thái", value: "Chưa có advisory session thật" },
    ];
  }
  const decision = advisorySession.aggregate?.decision || {};
  const quality = advisorySession.aggregate?.observability?.aggregate_quality || {};
  return [
    { label: "Symbol", value: advisorySession.symbol || advisorySymbol || "n/a" },
    { label: "Contract", value: advisorySession.contract_version || "v1" },
    { label: "Trade date", value: advisorySession.selected_trade_date || "Mới nhất" },
    { label: "Action", value: (decision.action as string) || "watch" },
    { label: "Risk", value: (decision.risk as string) || "medium" },
    {
      label: "Quality",
      value: quality.score !== undefined && quality.score !== null
        ? `${quality.score} (${quality.label || "n/a"})`
        : "Chưa có",
    },
  ];
}

function buildBenchmarkItems(advisorySession: AdvisorySessionData | null): string[] {
  const benchmarks = advisorySession?.aggregate?.benchmarks;
  if (!benchmarks) return [];
  return [
    `RVOL: ${benchmarks.rvol ?? "n/a"} (${benchmarks.rvol_regime || "unknown"})`,
    `Relative strength 20D: ${benchmarks.relative_strength_20d_pct ?? "n/a"}%`,
    `MTF confirmation: ${benchmarks.mtf_confirmation_score ?? "n/a"} (${benchmarks.mtf_confirmation_label || "unknown"})`,
  ];
}

interface ShellAiAdvisoryPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
  advisorySymbol?: string;
  advisorySearch?: string;
  advisorySessionLoader?: (opts?: Record<string, unknown>) => Promise<AdvisorySessionData>;
  initialAdvisorySession?: AdvisorySessionData | null;
}

export function ShellAiAdvisoryPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
  advisorySymbol,
  advisorySearch,
  advisorySessionLoader,
  initialAdvisorySession = null,
}: ShellAiAdvisoryPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: "Không thể tải snapshot AI advisory từ core runtime.",
    refreshNotice: "Đã làm mới snapshot AI advisory từ core runtime.",
  });

  const advisoryLoaderRef = useRef<(opts?: Record<string, unknown>) => Promise<AdvisorySessionData> | null>(null) as { current: ((opts?: Record<string, unknown>) => Promise<AdvisorySessionData> | null) | null };
  const advisoryEnvRef = useRef(env);
  const advisoryFetchRef = useRef(fetchImpl);

  advisoryEnvRef.current = env;
  advisoryFetchRef.current = fetchImpl;
  advisoryLoaderRef.current = advisorySessionLoader || ((requestOptions = {}) =>
    createCoreAdvisorySessionClient({
      env: advisoryEnvRef.current,
      fetchImpl: advisoryFetchRef.current,
    }).getAiAdvisorySession({
      contract: "v2",
      includeBenchmarks: true,
      ...requestOptions,
    }));

  const resolvedAdvisorySymbol = resolveAdvisorySymbol(env, advisorySymbol, advisorySearch);
  const [activeAdvisorySymbol, setActiveAdvisorySymbol] = useState(() => resolvedAdvisorySymbol);
  const [advisorySymbolDraft, setAdvisorySymbolDraft] = useState(() => resolvedAdvisorySymbol);
  const [advisoryState, setAdvisoryState] = useState(() => createInitialAdvisoryState(initialAdvisorySession));

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
  const advisoryAbilities = filterAbilitiesBySubject(abilities, "whaleadvisory");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const advisoryQuality = (advisoryState.data as AdvisorySessionData)?.aggregate?.observability?.aggregate_quality || {};
  const advisoryRows = buildAdvisoryRows(advisoryState.data as AdvisorySessionData | null, activeAdvisorySymbol);
  const benchmarkItems = buildBenchmarkItems(advisoryState.data as AdvisorySessionData | null);

  useEffect(() => {
    setActiveAdvisorySymbol(resolvedAdvisorySymbol);
    setAdvisorySymbolDraft(resolvedAdvisorySymbol);
  }, [resolvedAdvisorySymbol]);

  useEffect(() => {
    if (!autoLoad || !activeAdvisorySymbol) return;

    let active = true;

    async function runAdvisoryLoad() {
      setAdvisoryState(prev => ({ ...prev, loading: true, error: "" }));
      try {
        const advisorySession = await advisoryLoaderRef.current!({ symbol: activeAdvisorySymbol });
        if (!active) return;
        setAdvisoryState({ loading: false, error: "", data: advisorySession });
      } catch (error) {
        if (!active) return;
        setAdvisoryState(prev => ({ ...prev, loading: false, error: normalizeAdvisoryError(error) }));
      }
    }

    runAdvisoryLoad();
    return () => { active = false; };
  }, [activeAdvisorySymbol, autoLoad]);

  async function refreshAdvisorySession() {
    try {
      const advisorySession = await advisoryLoaderRef.current!({ symbol: activeAdvisorySymbol });
      setAdvisoryState({ loading: false, error: "", data: advisorySession });
    } catch (error) {
      setAdvisoryState(prev => ({ ...prev, loading: false, error: normalizeAdvisoryError(error) }));
    }
  }

  async function handleRefreshAll() {
    await Promise.all([handleRefresh(), refreshAdvisorySession()]);
  }

  function handleAdvisorySymbolChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAdvisorySymbolDraft(normalizeAdvisorySymbol(event.target.value));
  }

  function handleAdvisorySymbolSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextSymbol = normalizeAdvisorySymbol(advisorySymbolDraft) || resolvedAdvisorySymbol;
    if (!nextSymbol || nextSymbol === activeAdvisorySymbol) return;
    setActiveAdvisorySymbol(nextSymbol);
    setAdvisorySymbolDraft(nextSymbol);
    syncAdvisorySymbolSearch(nextSymbol, advisorySearch);
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Advisory symbol", activeAdvisorySymbol || "n/a"),
    renderShellMetric("Advisory abilities", String(advisoryAbilities.length)),
    renderShellMetric(
      "Advisory quality",
      advisoryQuality.score !== undefined && advisoryQuality.score !== null
        ? String(advisoryQuality.score)
        : "n/a",
    ),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-advisory-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || (session?.principal?.username as string) || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: (session?.session_id as string) || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "ai-advisory-runtime",
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
    activeDetail: "Đây là group gating chính cho lane AI advisory trong signals shell.",
    visibleDetail: "Group này vẫn đi cùng session signals hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(signalRoutes, {
    activeItem: "ai-advisory",
    activeDetail: "Đây là route AI advisory chính mà shell signals cần mở cho session hiện tại.",
    visibleDetail: "Route signals liên quan đang được runtime cho phép hiển thị.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core AI advisory signals"
      title="Trung tâm AI advisory và tín hiệu"
      description="Trang này xác nhận lane AI advisory của core shell đã có route-level page thật, bám đúng signals routes, advisory ability và bootstrap session mà chỉ cần chỉnh rất hẹp ở bootstrap contract hiện có."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane AI advisory" : "Lane AI advisory sẵn sàng cho kiểm tra"}
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
            subtitle="Đọc nhanh session, runtime health và build meta trước khi nối advisory experience thật vào signals shell này."
            actions={renderRefreshAction({ onClick: handleRefreshAll, disabled: viewState.loading || advisoryState.loading })}
          >
            <section className="shellPage__summaryGrid">{summaryCards}</section>
          </ShellPanel>

          <ShellPanel
            title="Signals groups và advisory routes"
            subtitle="Kiểm tra group `signals` cùng route `ai-advisory` đã được runtime mở đúng theo bootstrap hiện tại hay chưa."
          >
            <div key="ai-advisory-groups">
              <h3 className="shellPage__itemTitle">Visible groups</h3>
              {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-advisory-groups")}
            </div>
            <div key="ai-advisory-routes">
              <h3 className="shellPage__itemTitle">Signals routes</h3>
              {renderFlagList(routeFlags, "Runtime hiện chưa expose route advisory nào cho session này.", "ai-advisory-routes")}
            </div>
          </ShellPanel>
        </div>

        <ShellPanel
          title="Advisory data và build metadata"
          subtitle="Giữ cùng một viewport cho auditor đọc signal reach, advisory session thật, benchmark aggregate và ability map của lane AI advisory."
          actions={renderHealthStatusPill(health)}
        >
          <form className="shellPage__form" key="ai-advisory-symbol-form" onSubmit={handleAdvisorySymbolSubmit}>
            <div className="shellPage__formGrid">
              {renderShellField({
                label: "Mã advisory",
                name: "ai-advisory-symbol",
                value: advisorySymbolDraft,
                onChange: handleAdvisorySymbolChange,
                placeholder: "Ví dụ: FPT",
                autoComplete: "off",
              })}
            </div>
            <div className="shellPage__actions">
              <button type="submit" className="shellPage__button shellPage__button--primary" disabled={advisoryState.loading || !advisorySymbolDraft}>
                Đổi mã advisory
              </button>
            </div>
          </form>

          {renderSummaryCard({
            key: "ai-advisory-runtime-session",
            title: `Advisory session thật (${activeAdvisorySymbol})`,
            rows: advisoryRows,
          })}

          {advisoryState.error ? (
            <div className="shellPage__empty" key="ai-advisory-runtime-error">{advisoryState.error}</div>
          ) : null}
          {advisoryState.loading && !advisoryState.data ? (
            <div className="shellPage__empty" key="ai-advisory-runtime-loading">Đang nạp advisory session thật từ stock workspace runtime.</div>
          ) : null}

          {renderBuildMetaCard({ key: "ai-advisory-build-meta", buildMeta })}

          <div key="ai-advisory-signal-routes">
            <h3 className="shellPage__itemTitle">Signals routes</h3>
            {renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "ai-advisory-signal-routes")}
          </div>
          <div key="ai-advisory-surfaces">
            <h3 className="shellPage__itemTitle">Enabled surfaces</h3>
            {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "ai-advisory-surfaces")}
          </div>
          <div key="ai-advisory-benchmarks">
            <h3 className="shellPage__itemTitle">Advisory benchmarks</h3>
            {renderValueList(benchmarkItems, "Advisory session hiện chưa trả benchmark aggregate nào.", "ai-advisory-benchmarks")}
          </div>

          {renderAbilityList({
            abilities: advisoryAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI advisory nào cho route này.",
            keyPrefix: "ai-advisory-ability",
          })}

          <article className="shellPage__surfaceCard" key="ai-advisory-summary-card">
            <h3 className="shellPage__itemTitle">Signals summary</h3>
            <p className="shellPage__itemMeta">Signals routes visible: {signalRoutes.length}</p>
            <p className="shellPage__itemMeta">Advisory routes active: {countFlagsByState(routeFlags, "ACTIVE")}</p>
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
