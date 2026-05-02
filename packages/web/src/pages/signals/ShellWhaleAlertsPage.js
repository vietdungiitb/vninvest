import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createCoreWhaleAnalyticsSnapshotClient } from "../../adapters/core/index.js";
import {
  renderShellField,
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

function normalizeWhaleSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function resolveWhaleSearch(whaleSearch) {
  if (typeof whaleSearch === "string") {
    return whaleSearch;
  }

  if (typeof globalThis.location?.search === "string") {
    return globalThis.location.search;
  }

  return "";
}

function resolveWhaleSymbolFromSearch(whaleSearch) {
  const search = resolveWhaleSearch(whaleSearch);

  if (!search) {
    return "";
  }

  try {
    return normalizeWhaleSymbol(new URLSearchParams(search).get("symbol"));
  } catch {
    return "";
  }
}

function resolveWhaleSymbol(env = {}, whaleSymbol, whaleSearch) {
  return normalizeWhaleSymbol(
    whaleSymbol
      || resolveWhaleSymbolFromSearch(whaleSearch)
      || env.VNINVEST_WHALE_ALERTS_SYMBOL
      || env.REACT_APP_WHALE_ALERTS_SYMBOL
      || "HPG",
  );
}

function syncWhaleSymbolSearch(symbol, whaleSearch) {
  if (typeof whaleSearch === "string") {
    return;
  }

  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") {
    return;
  }

  try {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.searchParams.set("symbol", symbol);
    globalThis.history.replaceState(globalThis.history.state, "", nextUrl.toString());
  } catch {
    // Keep local page state working even if URL sync is not available.
  }
}

function createInitialWhaleSnapshotState(initialWhaleSnapshot = null) {
  return {
    loading: !initialWhaleSnapshot,
    error: "",
    data: initialWhaleSnapshot,
  };
}

function normalizeWhaleSnapshotError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không thể tải whale analytics snapshot thật từ portfolio runtime.";
}

function buildWhaleSnapshotRows(whaleSnapshot, whaleSymbol) {
  if (!whaleSnapshot) {
    return [
      { label: "Symbol", value: whaleSymbol || "n/a" },
      { label: "Trade date", value: "Chưa nạp" },
      { label: "Quality", value: "Chưa có whale snapshot thật" },
    ];
  }

  return [
    { label: "Symbol", value: whaleSnapshot.symbol || whaleSymbol || "n/a" },
    { label: "Trade date", value: whaleSnapshot.trade_date || "Chưa có" },
    { label: "Quality", value: whaleSnapshot.session_summary?.quality_state || whaleSnapshot.session_context?.quality_state || "UNKNOWN" },
    { label: "Read path", value: whaleSnapshot.materialization?.read_path || "n/a" },
    { label: "Whale orders", value: String(whaleSnapshot.summary?.whale_order_count ?? 0) },
    { label: "Bucket facts", value: String(whaleSnapshot.materialization?.bucket_fact_count ?? 0) },
  ];
}

function buildWhaleSnapshotContextItems(whaleSnapshot) {
  const sessionContext = whaleSnapshot?.session_context;
  if (!sessionContext) {
    return [];
  }

  return [
    `Selected trade date: ${sessionContext.selected_trade_date || "n/a"}`,
    `Latest valid trade date: ${sessionContext.latest_valid_trade_date || "n/a"}`,
    `Quality state: ${sessionContext.quality_state || "UNKNOWN"}`,
  ];
}

function buildWhaleSnapshotMaterializationItems(whaleSnapshot) {
  const materialization = whaleSnapshot?.materialization;
  const qualityFlags = whaleSnapshot?.quality_flags;
  if (!materialization && !qualityFlags) {
    return [];
  }

  return [
    `Freshness: ${materialization?.freshness_state || "n/a"}`,
    `Completeness: ${materialization?.completeness_state || "n/a"}`,
    `Facts first: ${qualityFlags?.facts_first_primary_path ? "ON" : "OFF"}`,
    `Has session summary: ${qualityFlags?.has_session_summary ? "ON" : "OFF"}`,
    `Contract version: ${qualityFlags?.contract_version || "n/a"}`,
  ];
}

export function ShellWhaleAlertsPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
  whaleSymbol,
  whaleSearch,
  whaleSnapshotLoader,
  initialWhaleSnapshot = null,
}) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot whale alerts từ core runtime.",
    refreshNotice: "Đã làm mới snapshot whale alerts từ core runtime.",
  });
  const whaleLoaderRef = useRef(null);
  const whaleEnvRef = useRef(null);
  const whaleFetchRef = useRef(null);

  whaleEnvRef.current = env;
  whaleFetchRef.current = fetchImpl;
  const resolvedWhaleSymbol = resolveWhaleSymbol(env, whaleSymbol, whaleSearch);
  const [activeWhaleSymbol, setActiveWhaleSymbol] = useState(() => resolvedWhaleSymbol);
  const [whaleSymbolDraft, setWhaleSymbolDraft] = useState(() => resolvedWhaleSymbol);
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
  const whaleSnapshotRows = buildWhaleSnapshotRows(whaleSnapshotState.data, activeWhaleSymbol);
  const whaleSnapshotContextItems = buildWhaleSnapshotContextItems(whaleSnapshotState.data);
  const whaleSnapshotMaterializationItems = buildWhaleSnapshotMaterializationItems(whaleSnapshotState.data);

  useEffect(() => {
    setActiveWhaleSymbol(resolvedWhaleSymbol);
    setWhaleSymbolDraft(resolvedWhaleSymbol);
  }, [resolvedWhaleSymbol]);

  useEffect(() => {
    if (!autoLoad || !activeWhaleSymbol) {
      return undefined;
    }

    let active = true;

    async function runWhaleSnapshotLoad() {
      setWhaleSnapshotState((previous) => ({
        ...previous,
        loading: true,
        error: "",
      }));

      try {
        const whaleSnapshot = await whaleLoaderRef.current({ symbol: activeWhaleSymbol });
        if (!active) {
          return;
        }

        setWhaleSnapshotState({
          loading: false,
          error: "",
          data: whaleSnapshot,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setWhaleSnapshotState((previous) => ({
          ...previous,
          loading: false,
          error: normalizeWhaleSnapshotError(error),
        }));
      }
    }

    void runWhaleSnapshotLoad();

    return () => {
      active = false;
    };
  }, [activeWhaleSymbol, autoLoad]);

  async function refreshWhaleSnapshot() {
    try {
      const whaleSnapshot = await whaleLoaderRef.current({ symbol: activeWhaleSymbol });
      setWhaleSnapshotState({
        loading: false,
        error: "",
        data: whaleSnapshot,
      });
    } catch (error) {
      setWhaleSnapshotState((previous) => ({
        ...previous,
        loading: false,
        error: normalizeWhaleSnapshotError(error),
      }));
    }
  }

  async function handleRefreshAll() {
    await Promise.all([
      handleRefresh(),
      refreshWhaleSnapshot(),
    ]);
  }

  function handleWhaleSymbolChange(event) {
    setWhaleSymbolDraft(normalizeWhaleSymbol(event.target.value));
  }

  function handleWhaleSymbolSubmit(event) {
    event.preventDefault();

    const nextSymbol = normalizeWhaleSymbol(whaleSymbolDraft) || resolvedWhaleSymbol;
    if (!nextSymbol || nextSymbol === activeWhaleSymbol) {
      return;
    }

    setActiveWhaleSymbol(nextSymbol);
    setWhaleSymbolDraft(nextSymbol);
    syncWhaleSymbolSearch(nextSymbol, whaleSearch);
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Whale symbol", activeWhaleSymbol || "n/a"),
    renderShellMetric("Whale abilities", String(whaleAbilities.length)),
    renderShellMetric("Quality state", whaleSnapshotState.data?.session_summary?.quality_state || whaleSnapshotState.data?.session_context?.quality_state || "n/a"),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "whale-alerts-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
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

  return renderShellPageChrome({
    eyebrow: "Core whale alerts signals",
    title: "Trung tâm whale alerts và tín hiệu",
    description:
      "Trang này xác nhận lane whale alerts của core shell đã có route-level audit surface thật, bám đúng signals routes, whale ability naming và bootstrap session mà không chạm vào KLine intelligence workspace thật của feature pack whale.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane whale alerts" : "Lane whale alerts sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi nối whale workspace thật vào shell signals này.",
          actions: renderRefreshAction({ onClick: handleRefreshAll, disabled: viewState.loading || whaleSnapshotState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Signals groups và whale routes",
          subtitle: "Kiểm tra group `signals` cùng route `whale-alerts` đã được runtime mở đúng theo bootstrap hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "whale-alerts-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "whale-alerts-groups"),
            ),
            renderElement(
              "div",
              { key: "whale-alerts-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route whale alerts nào cho session này.", "whale-alerts-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Whale snapshot facts và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc signal reach, facts-first snapshot state, selected trade-date context và ability map của lane whale alerts trước khi nối UI whale intelligence thật.",
        actions: renderHealthStatusPill(health),
        children: [
          renderElement(
            "form",
            {
              className: "shellPage__form",
              key: "whale-alerts-symbol-form",
              onSubmit: handleWhaleSymbolSubmit,
            },
            renderElement(
              "div",
              { className: "shellPage__formGrid" },
              renderShellField({
                label: "Mã whale alerts",
                name: "whale-alerts-symbol",
                value: whaleSymbolDraft,
                onChange: handleWhaleSymbolChange,
                placeholder: "Ví dụ: SSI",
                autoComplete: "off",
              }),
            ),
            renderElement(
              "div",
              { className: "shellPage__actions" },
              renderElement(
                "button",
                {
                  type: "submit",
                  className: "shellPage__button shellPage__button--primary",
                  disabled: whaleSnapshotState.loading || !whaleSymbolDraft,
                },
                "Đổi mã whale",
              ),
            ),
          ),
          renderSummaryCard({
            key: "whale-alerts-runtime-snapshot",
            title: `Whale snapshot thật (${activeWhaleSymbol})`,
            rows: whaleSnapshotRows,
          }),
          whaleSnapshotState.error
            ? renderElement(
              "div",
              { className: "shellPage__empty", key: "whale-alerts-runtime-error" },
              whaleSnapshotState.error,
            )
            : null,
          whaleSnapshotState.loading && !whaleSnapshotState.data
            ? renderElement(
              "div",
              { className: "shellPage__empty", key: "whale-alerts-runtime-loading" },
              "Đang nạp whale analytics snapshot thật từ portfolio runtime.",
            )
            : null,
          renderBuildMetaCard({ key: "whale-alerts-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "whale-alerts-signal-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
            renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "whale-alerts-signal-routes"),
          ),
          renderElement(
            "div",
            { key: "whale-alerts-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "whale-alerts-surfaces"),
          ),
          renderElement(
            "div",
            { key: "whale-alerts-session-context" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Session context"),
            renderValueList(whaleSnapshotContextItems, "Whale snapshot hiện chưa trả session context nào.", "whale-alerts-session-context"),
          ),
          renderElement(
            "div",
            { key: "whale-alerts-materialization" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Materialization facts"),
            renderValueList(whaleSnapshotMaterializationItems, "Whale snapshot hiện chưa trả materialization facts nào.", "whale-alerts-materialization"),
          ),
          renderAbilityList({
            abilities: whaleAbilities,
            emptyText: "Runtime hiện chưa trả về ability whale lane nào cho route này.",
            keyPrefix: "whale-alerts-ability",
          }),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "whale-alerts-summary-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals summary"),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Signals routes visible: ${signalRoutes.length}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Whale routes active: ${countFlagsByState(routeFlags, "ACTIVE")}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Facts-first read path: ${whaleSnapshotState.data?.materialization?.read_path || "n/a"}`,
            ),
          ),
        ],
      }),
    ),
  });
}