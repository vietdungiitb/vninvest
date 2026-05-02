import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createCoreAdvisorySessionClient } from "../../adapters/core/index.js";
import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
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
  renderElement,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const SIGNAL_ROUTE_IDS = ["ai-advisory", "whale-alerts"];

function resolveAdvisorySymbol(env = {}, advisorySymbol) {
  return String(
    advisorySymbol
      || env.VNINVEST_AI_ADVISORY_SYMBOL
      || env.REACT_APP_AI_ADVISORY_SYMBOL
      || "BCM",
  ).trim().toUpperCase();
}

function createInitialAdvisoryState(initialAdvisorySession = null) {
  return {
    loading: !initialAdvisorySession,
    error: "",
    data: initialAdvisorySession,
  };
}

function normalizeAdvisoryError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không thể tải advisory session thật từ stock workspace runtime.";
}

function buildAdvisoryRows(advisorySession, advisorySymbol) {
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
    { label: "Action", value: decision.action || "watch" },
    { label: "Risk", value: decision.risk || "medium" },
    {
      label: "Quality",
      value: quality.score !== undefined && quality.score !== null
        ? `${quality.score} (${quality.label || "n/a"})`
        : "Chưa có",
    },
  ];
}

function buildBenchmarkItems(advisorySession) {
  const benchmarks = advisorySession?.aggregate?.benchmarks;
  if (!benchmarks) {
    return [];
  }

  return [
    `RVOL: ${benchmarks.rvol ?? "n/a"} (${benchmarks.rvol_regime || "unknown"})`,
    `Relative strength 20D: ${benchmarks.relative_strength_20d_pct ?? "n/a"}%`,
    `MTF confirmation: ${benchmarks.mtf_confirmation_score ?? "n/a"} (${benchmarks.mtf_confirmation_label || "unknown"})`,
  ];
}

export function ShellAiAdvisoryPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
  advisorySymbol,
  advisorySessionLoader,
  initialAdvisorySession = null,
}) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot AI advisory từ core runtime.",
    refreshNotice: "Đã làm mới snapshot AI advisory từ core runtime.",
  });
  const advisoryLoaderRef = useRef(null);
  const advisoryEnvRef = useRef(null);
  const advisoryFetchRef = useRef(null);
  const advisorySymbolRef = useRef(null);

  advisoryEnvRef.current = env;
  advisoryFetchRef.current = fetchImpl;
  advisorySymbolRef.current = resolveAdvisorySymbol(env, advisorySymbol);
  advisoryLoaderRef.current = advisorySessionLoader || ((requestOptions = {}) =>
    createCoreAdvisorySessionClient({
      env: advisoryEnvRef.current,
      fetchImpl: advisoryFetchRef.current,
    }).getAiAdvisorySession({
      symbol: advisorySymbolRef.current,
      contract: "v2",
      includeBenchmarks: true,
      ...requestOptions,
    }));

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
  const advisoryQuality = advisoryState.data?.aggregate?.observability?.aggregate_quality || {};
  const advisoryRows = buildAdvisoryRows(advisoryState.data, advisorySymbolRef.current);
  const benchmarkItems = buildBenchmarkItems(advisoryState.data);

  useEffect(() => {
    if (!autoLoad || !advisorySymbolRef.current) {
      return undefined;
    }

    let active = true;

    async function runAdvisoryLoad() {
      setAdvisoryState((previous) => ({
        ...previous,
        loading: true,
        error: "",
      }));

      try {
        const advisorySession = await advisoryLoaderRef.current({ symbol: advisorySymbolRef.current });
        if (!active) {
          return;
        }

        setAdvisoryState({
          loading: false,
          error: "",
          data: advisorySession,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setAdvisoryState((previous) => ({
          ...previous,
          loading: false,
          error: normalizeAdvisoryError(error),
        }));
      }
    }

    void runAdvisoryLoad();

    return () => {
      active = false;
    };
  }, [autoLoad, advisorySymbolRef.current]);

  async function refreshAdvisorySession() {
    try {
      const advisorySession = await advisoryLoaderRef.current({ symbol: advisorySymbolRef.current });
      setAdvisoryState({
        loading: false,
        error: "",
        data: advisorySession,
      });
    } catch (error) {
      setAdvisoryState((previous) => ({
        ...previous,
        loading: false,
        error: normalizeAdvisoryError(error),
      }));
    }
  }

  async function handleRefreshAll() {
    await Promise.all([
      handleRefresh(),
      refreshAdvisorySession(),
    ]);
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Signals routes", String(signalRoutes.length)),
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
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
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

  return renderShellPageChrome({
    eyebrow: "Core AI advisory signals",
    title: "Trung tâm AI advisory và tín hiệu",
    description:
      "Trang này xác nhận lane AI advisory của core shell đã có route-level page thật, bám đúng signals routes, advisory ability và bootstrap session mà chỉ cần chỉnh rất hẹp ở bootstrap contract hiện có.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane AI advisory" : "Lane AI advisory sẵn sàng cho kiểm tra",
    ),
    metrics,
    notice: viewState.notice,
    error: viewState.error,
    children: renderElement(
      "section",
      { className: "shellPage__bodyGrid" },
      renderElement(
        "div",
        { className: "shellPage__stack" },
        renderShellPanel({
          title: "Snapshot operator và runtime",
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi nối advisory experience thật vào signals shell này.",
          actions: renderRefreshAction({ onClick: handleRefreshAll, disabled: viewState.loading || advisoryState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Signals groups và advisory routes",
          subtitle: "Kiểm tra group `signals` cùng route `ai-advisory` đã được runtime mở đúng theo bootstrap hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "ai-advisory-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-advisory-groups"),
            ),
            renderElement(
              "div",
              { key: "ai-advisory-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route advisory nào cho session này.", "ai-advisory-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Advisory data và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc signal reach, advisory session thật, benchmark aggregate và ability map của lane AI advisory.",
        actions: renderHealthStatusPill(health),
        children: [
          renderSummaryCard({
            key: "ai-advisory-runtime-session",
            title: `Advisory session thật (${advisorySymbolRef.current})`,
            rows: advisoryRows,
          }),
          advisoryState.error
            ? renderElement(
              "div",
              { className: "shellPage__empty", key: "ai-advisory-runtime-error" },
              advisoryState.error,
            )
            : null,
          advisoryState.loading && !advisoryState.data
            ? renderElement(
              "div",
              { className: "shellPage__empty", key: "ai-advisory-runtime-loading" },
              "Đang nạp advisory session thật từ stock workspace runtime.",
            )
            : null,
          renderBuildMetaCard({ key: "ai-advisory-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "ai-advisory-signal-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
            renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "ai-advisory-signal-routes"),
          ),
          renderElement(
            "div",
            { key: "ai-advisory-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "ai-advisory-surfaces"),
          ),
          renderElement(
            "div",
            { key: "ai-advisory-benchmarks" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Advisory benchmarks"),
            renderValueList(benchmarkItems, "Advisory session hiện chưa trả benchmark aggregate nào.", "ai-advisory-benchmarks"),
          ),
          renderAbilityList({
            abilities: advisoryAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI advisory nào cho route này.",
            keyPrefix: "ai-advisory-ability",
          }),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "ai-advisory-summary-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals summary"),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Signals routes visible: ${signalRoutes.length}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Advisory routes active: ${countFlagsByState(routeFlags, "ACTIVE")}`,
            ),
          ),
        ],
      }),
    ),
  });
}