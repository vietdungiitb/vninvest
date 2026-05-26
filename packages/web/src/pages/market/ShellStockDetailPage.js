import {
  useEffect,
  useState,
} from "react";

import {
  renderShellField,
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import { StockDetailPage } from "../StockDetailPage.js";
import {
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  getEnabledSurfaceKeys,
  renderAbilityList,
  renderBuildMetaCard,
  renderElement,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const STOCK_ROUTE_IDS = ["core-stock-detail"];
const DEFAULT_STOCK_SYMBOL = "HPG";

function normalizeStockSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function resolveStockSearch(stockSearch) {
  if (typeof stockSearch === "string") {
    return stockSearch;
  }

  if (typeof globalThis.location?.search === "string") {
    return globalThis.location.search;
  }

  return "";
}

function resolveStockPathname(stockPathname) {
  if (typeof stockPathname === "string") {
    return stockPathname;
  }

  if (typeof globalThis.location?.pathname === "string") {
    return globalThis.location.pathname;
  }

  return "";
}

function resolveStockSymbolFromSearch(stockSearch) {
  const search = resolveStockSearch(stockSearch);
  if (!search) {
    return "";
  }

  try {
    return normalizeStockSymbol(new URLSearchParams(search).get("symbol"));
  } catch {
    return "";
  }
}

function resolveStockSymbolFromPathname(stockPathname) {
  const pathname = resolveStockPathname(stockPathname);
  if (!pathname) {
    return "";
  }

  const match = pathname.match(/\/stocks\/([^/?#]+)/i);
  if (!match?.[1]) {
    return "";
  }

  try {
    return normalizeStockSymbol(decodeURIComponent(match[1]));
  } catch {
    return normalizeStockSymbol(match[1]);
  }
}

function resolveRouteParamSymbol(routeParams, params) {
  return normalizeStockSymbol(routeParams?.symbol || params?.symbol || "");
}

function resolveStockSymbolState({ env = {}, stockSymbol, symbol, stockSearch, stockPathname, routeParams, params }) {
  const explicitSymbol = normalizeStockSymbol(
    stockSymbol
      || symbol
      || resolveRouteParamSymbol(routeParams, params)
      || resolveStockSymbolFromPathname(stockPathname)
      || resolveStockSymbolFromSearch(stockSearch)
      || env.VNINVEST_STOCK_DETAIL_SYMBOL
      || env.REACT_APP_STOCK_DETAIL_SYMBOL
      || "",
  );

  if (explicitSymbol) {
    return {
      symbol: explicitSymbol,
      isExplicit: true,
    };
  }

  return {
    symbol: DEFAULT_STOCK_SYMBOL,
    isExplicit: false,
  };
}

function syncStockLocation(nextSymbol, { stockSearch, stockPathname, stockSymbol, symbol, routeParams, params }) {
  if (
    typeof stockSearch === "string"
    || typeof stockPathname === "string"
    || normalizeStockSymbol(stockSymbol)
    || normalizeStockSymbol(symbol)
    || resolveRouteParamSymbol(routeParams, params)
  ) {
    return;
  }

  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") {
    return;
  }

  try {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.pathname = `/stocks/${encodeURIComponent(nextSymbol)}`;
    nextUrl.searchParams.delete("symbol");
    globalThis.history.replaceState(globalThis.history.state, "", nextUrl.toString());
  } catch {
    // Keep local symbol state working even if URL sync is unavailable.
  }
}

export function ShellStockDetailPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
  stockSymbol,
  symbol,
  stockSearch,
  stockPathname,
  routeParams,
  params,
}) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot stock detail từ core runtime.",
    refreshNotice: "Đã làm mới snapshot stock detail từ core runtime.",
  });

  const resolvedStockSymbolState = resolveStockSymbolState({
    env,
    stockSymbol,
    symbol,
    stockSearch,
    stockPathname,
    routeParams,
    params,
  });
  const resolvedStockSymbol = resolvedStockSymbolState.symbol;
  const [activeStockSymbol, setActiveStockSymbol] = useState(() => resolvedStockSymbol);
  const [stockSymbolDraft, setStockSymbolDraft] = useState(() => resolvedStockSymbol);

  const {
    buildMeta,
    health,
    capabilities,
    session,
    identity,
    surfaces,
    visibleRoutes,
    abilities,
  } = deriveCoreShellSnapshot(viewState);
  const stockRoutes = filterVisibleRoutes(visibleRoutes, STOCK_ROUTE_IDS);
  const stockAbilities = filterAbilitiesBySubject(abilities, ["stock_detail", "market.stock_detail"]);
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  useEffect(() => {
    if (!resolvedStockSymbolState.isExplicit) {
      return;
    }

    setActiveStockSymbol((previous) => (previous === resolvedStockSymbol ? previous : resolvedStockSymbol));
    setStockSymbolDraft((previous) => (previous === resolvedStockSymbol ? previous : resolvedStockSymbol));
  }, [resolvedStockSymbol, resolvedStockSymbolState.isExplicit]);

  function handleStockSymbolChange(event) {
    setStockSymbolDraft(normalizeStockSymbol(event.target.value));
  }

  function handleStockSymbolSubmit(event) {
    event.preventDefault();

    const nextSymbol = normalizeStockSymbol(stockSymbolDraft) || resolvedStockSymbol;
    if (!nextSymbol || nextSymbol === activeStockSymbol) {
      return;
    }

    setActiveStockSymbol(nextSymbol);
    setStockSymbolDraft(nextSymbol);
    syncStockLocation(nextSymbol, { stockSearch, stockPathname, stockSymbol, symbol, routeParams, params });
  }

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Mã cổ phiếu", activeStockSymbol || "n/a"),
    renderShellMetric("Market routes", String(stockRoutes.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "stock-detail-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "stock-detail-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  return renderShellPageChrome({
    eyebrow: "Core stock detail market",
    title: `Trang chi tiết cổ phiếu SaaS${activeStockSymbol ? ` • ${activeStockSymbol}` : ""}`,
    description:
      "Route /stocks/:symbol giờ được host hoàn toàn trong packages/web, tự resolve symbol từ path/search/props và chỉ mount SaaS stock detail surface từ core runtime, không phụ thuộc frontend hay backend cũ.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane stock detail" : "Lane stock detail sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi mount stock detail surface thật của SaaS shell.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Market route và abilities",
          subtitle: "Kiểm tra route stock detail đã được runtime expose đúng lane market và shell hiện tại nhận đúng symbol từ URL hay props chưa.",
          children: [
            renderBuildMetaCard({ key: "stock-detail-build-meta", buildMeta }),
            renderElement(
              "div",
              { key: "stock-detail-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible market routes"),
              renderValueList(stockRoutes, "Runtime hiện chưa expose route stock detail nào cho shell này.", "stock-detail-routes"),
            ),
            renderElement(
              "div",
              { key: "stock-detail-surfaces" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
              renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "stock-detail-surfaces"),
            ),
            renderAbilityList({
              abilities: stockAbilities,
              emptyText: "Runtime hiện chưa trả về ability stock detail nào cho route này.",
              keyPrefix: "stock-detail-ability",
            }),
          ],
        }),
      ),
      renderShellPanel({
        title: `SaaS stock detail surface (${activeStockSymbol})`,
        subtitle: "Surface này dùng đúng page mới trong packages/web và deep-link bằng /stocks/:symbol giống lane whale-alerts dùng shell host ở route-level.",
        actions: renderHealthStatusPill(health),
        children: [
          renderElement(
            "form",
            {
              className: "shellPage__form",
              key: "stock-detail-symbol-form",
              onSubmit: handleStockSymbolSubmit,
            },
            renderElement(
              "div",
              { className: "shellPage__formGrid" },
              renderShellField({
                label: "Mã cổ phiếu",
                name: "stock-detail-symbol",
                value: stockSymbolDraft,
                onChange: handleStockSymbolChange,
                placeholder: "Ví dụ: HPG",
                autoComplete: "off",
              }),
              renderElement(
                "div",
                { className: "shellPage__field" },
                renderElement("span", { className: "shellPage__fieldLabel" }, "Route hiện tại"),
                renderElement("div", { className: "shellPage__input" }, `/stocks/${activeStockSymbol || DEFAULT_STOCK_SYMBOL}`),
              ),
            ),
            renderElement(
              "div",
              { className: "shellPage__actions" },
              renderElement(
                "button",
                {
                  type: "submit",
                  className: "shellPage__button shellPage__button--primary",
                  disabled: !stockSymbolDraft,
                },
                "Mở stock detail",
              ),
            ),
          ),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "stock-detail-surface" },
            renderElement(StockDetailPage, {
              env,
              symbol: activeStockSymbol,
            }),
          ),
        ],
      }),
    ),
  });
}