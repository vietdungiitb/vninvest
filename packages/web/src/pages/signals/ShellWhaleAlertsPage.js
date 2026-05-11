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
const DEFAULT_WHALE_SYMBOL = "HPG";

function normalizeWhaleSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeWhaleTradeDate(value) {
  const normalized = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
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

function resolveWhaleTradeDateFromSearch(whaleSearch) {
  const search = resolveWhaleSearch(whaleSearch);

  if (!search) {
    return "";
  }

  try {
    const searchParams = new URLSearchParams(search);
    return normalizeWhaleTradeDate(searchParams.get("trade_date") || searchParams.get("tradeDate"));
  } catch {
    return "";
  }
}

function resolveWhaleSymbolState(whaleSymbol, whaleSearch) {
  const explicitSymbol = normalizeWhaleSymbol(
    whaleSymbol
      || resolveWhaleSymbolFromSearch(whaleSearch),
  );

  if (explicitSymbol) {
    return {
      symbol: explicitSymbol,
      isExplicit: true,
    };
  }

  return {
    symbol: DEFAULT_WHALE_SYMBOL,
    isExplicit: false,
  };
}

function resolveWhaleTradeDate(env = {}, whaleTradeDate, whaleSearch) {
  return normalizeWhaleTradeDate(
    whaleTradeDate
      || resolveWhaleTradeDateFromSearch(whaleSearch)
      || env.VNINVEST_WHALE_ALERTS_TRADE_DATE
      || env.REACT_APP_WHALE_ALERTS_TRADE_DATE
      || "",
  );
}

function syncWhaleSearch(symbol, tradeDate, whaleSearch) {
  if (typeof whaleSearch === "string") {
    return;
  }

  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") {
    return;
  }

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

function buildWhaleSnapshotRows(whaleSnapshot, whaleSymbol, whaleTradeDate) {
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
    { label: "Ngày yêu cầu", value: whaleTradeDate || whaleSnapshot.session_context?.selected_trade_date || "Mới nhất" },
    { label: "Ngày phiên trả về", value: whaleSnapshot.trade_date || "Chưa có" },
    { label: "Nguồn phiên", value: whaleSnapshot.session?.resolved_from || "n/a" },
    { label: "Chất lượng", value: whaleSnapshot.session_summary?.quality_state || whaleSnapshot.session_context?.quality_state || "UNKNOWN" },
    { label: "Luồng đọc", value: whaleSnapshot.materialization?.read_path || "n/a" },
    { label: "Lệnh whale", value: String(whaleSnapshot.summary?.whale_order_count ?? 0) },
    { label: "Số bucket facts", value: String(whaleSnapshot.materialization?.bucket_fact_count ?? 0) },
  ];
}

function buildWhaleSnapshotContextItems(whaleSnapshot) {
  const sessionContext = whaleSnapshot?.session_context;
  if (!sessionContext) {
    return [];
  }

  return [
    `Ngày yêu cầu: ${sessionContext.selected_trade_date || "n/a"}`,
    `Ngày hợp lệ gần nhất: ${sessionContext.latest_valid_trade_date || "n/a"}`,
    `Chất lượng phiên: ${sessionContext.quality_state || "UNKNOWN"}`,
    `Nguồn phiên: ${whaleSnapshot?.session?.resolved_from || "n/a"}`,
  ];
}

function buildWhaleSnapshotMaterializationItems(whaleSnapshot) {
  const materialization = whaleSnapshot?.materialization;
  const qualityFlags = whaleSnapshot?.quality_flags;
  if (!materialization && !qualityFlags) {
    return [];
  }

  return [
    `Độ tươi dữ liệu: ${materialization?.freshness_state || "n/a"}`,
    `Độ đầy đủ: ${materialization?.completeness_state || "n/a"}`,
    `Ưu tiên facts-first: ${qualityFlags?.facts_first_primary_path ? "BẬT" : "TẮT"}`,
    `Có session summary: ${qualityFlags?.has_session_summary ? "BẬT" : "TẮT"}`,
    `Phiên bản contract: ${qualityFlags?.contract_version || "n/a"}`,
  ];
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
  const whaleSnapshotRows = buildWhaleSnapshotRows(whaleSnapshotState.data, activeWhaleSymbol, activeWhaleTradeDate);
  const whaleSnapshotContextItems = buildWhaleSnapshotContextItems(whaleSnapshotState.data);
  const whaleSnapshotMaterializationItems = buildWhaleSnapshotMaterializationItems(whaleSnapshotState.data);
  const latestValidWhaleTradeDate = normalizeWhaleTradeDate(whaleSnapshotState.data?.session_context?.latest_valid_trade_date);
  const canJumpToLatestValidTradeDate = Boolean(
    latestValidWhaleTradeDate
      && latestValidWhaleTradeDate !== activeWhaleTradeDate,
  );

  useEffect(() => {
    // Only synchronize symbol from URL/props when it is explicitly provided.
    // This avoids resetting symbol on trade_date-only URL updates.
    if (resolvedWhaleSymbolState.isExplicit) {
      setActiveWhaleSymbol((previous) => (previous === resolvedWhaleSymbol ? previous : resolvedWhaleSymbol));
      setWhaleSymbolDraft((previous) => (previous === resolvedWhaleSymbol ? previous : resolvedWhaleSymbol));
    }

    setActiveWhaleTradeDate((previous) => (previous === resolvedWhaleTradeDate ? previous : resolvedWhaleTradeDate));
    setWhaleTradeDateDraft((previous) => (previous === resolvedWhaleTradeDate ? previous : resolvedWhaleTradeDate));
  }, [resolvedWhaleSymbol, resolvedWhaleTradeDate, resolvedWhaleSymbolState.isExplicit]);

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
        const whaleSnapshot = await whaleLoaderRef.current({
          symbol: activeWhaleSymbol,
          tradeDate: activeWhaleTradeDate || undefined,
        });
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
  }, [activeWhaleSymbol, activeWhaleTradeDate, autoLoad]);

  async function refreshWhaleSnapshot() {
    try {
      const whaleSnapshot = await whaleLoaderRef.current({
        symbol: activeWhaleSymbol,
        tradeDate: activeWhaleTradeDate || undefined,
      });
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

  function handleWhaleTradeDateChange(event) {
    setWhaleTradeDateDraft(normalizeWhaleTradeDate(event.target.value));
  }

  function handleWhaleSnapshotSubmit(event) {
    event.preventDefault();

    const nextSymbol = normalizeWhaleSymbol(whaleSymbolDraft) || resolvedWhaleSymbol;
    const nextTradeDate = normalizeWhaleTradeDate(whaleTradeDateDraft);
    if (!nextSymbol || (nextSymbol === activeWhaleSymbol && nextTradeDate === activeWhaleTradeDate)) {
      return;
    }

    setActiveWhaleSymbol(nextSymbol);
    setActiveWhaleTradeDate(nextTradeDate);
    setWhaleSymbolDraft(nextSymbol);
    setWhaleTradeDateDraft(nextTradeDate);
    syncWhaleSearch(nextSymbol, nextTradeDate, whaleSearch);
  }

  function handleJumpToLatestValidTradeDate() {
    if (!canJumpToLatestValidTradeDate) {
      return;
    }

    setActiveWhaleTradeDate(latestValidWhaleTradeDate);
    setWhaleTradeDateDraft(latestValidWhaleTradeDate);
    syncWhaleSearch(activeWhaleSymbol, latestValidWhaleTradeDate, whaleSearch);
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Whale symbol", activeWhaleSymbol || "n/a"),
    renderShellMetric("Ngày mục tiêu", activeWhaleTradeDate || "Mới nhất"),
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
              onSubmit: handleWhaleSnapshotSubmit,
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
              renderShellField({
                label: "Ngày giao dịch yêu cầu",
                name: "whale-alerts-trade-date",
                type: "date",
                value: whaleTradeDateDraft,
                onChange: handleWhaleTradeDateChange,
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
                "Tải snapshot whale",
              ),
              canJumpToLatestValidTradeDate
                ? renderElement(
                  "button",
                  {
                    type: "button",
                    className: "shellPage__button shellPage__button--secondary",
                    disabled: whaleSnapshotState.loading,
                    onClick: handleJumpToLatestValidTradeDate,
                  },
                  "Dùng phiên hợp lệ gần nhất",
                )
                : null,
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
            renderElement("h3", { className: "shellPage__itemTitle" }, "Ngữ cảnh phiên"),
            renderValueList(whaleSnapshotContextItems, "Whale snapshot hiện chưa trả session context nào.", "whale-alerts-session-context"),
          ),
          renderElement(
            "div",
            { key: "whale-alerts-materialization" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Trạng thái materialization"),
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