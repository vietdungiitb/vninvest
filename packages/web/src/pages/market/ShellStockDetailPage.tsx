import {
  useEffect,
  useState,
} from "react";

import {
  ShellPageChrome,
  ShellPanel,
  renderShellField,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import { StockDetailPage } from "../StockDetailPage";
import {
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  getEnabledSurfaceKeys,
  renderAbilityList,
  renderBuildMetaCard,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const STOCK_ROUTE_IDS = ["core-stock-detail"];
const DEFAULT_STOCK_SYMBOL = "HPG";

function normalizeStockSymbol(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function resolveStockSearch(stockSearch: unknown): string {
  if (typeof stockSearch === "string") return stockSearch;
  if (typeof globalThis.location?.search === "string") return globalThis.location.search;
  return "";
}

function resolveStockPathname(stockPathname: unknown): string {
  if (typeof stockPathname === "string") return stockPathname;
  if (typeof globalThis.location?.pathname === "string") return globalThis.location.pathname;
  return "";
}

function resolveStockSymbolFromSearch(stockSearch: unknown): string {
  const search = resolveStockSearch(stockSearch);
  if (!search) return "";
  try {
    return normalizeStockSymbol(new URLSearchParams(search).get("symbol"));
  } catch {
    return "";
  }
}

function resolveStockSymbolFromPathname(stockPathname: unknown): string {
  const pathname = resolveStockPathname(stockPathname);
  if (!pathname) return "";
  const match = pathname.match(/\/stocks\/([^/?#]+)/i);
  if (!match?.[1]) return "";
  try {
    return normalizeStockSymbol(decodeURIComponent(match[1]));
  } catch {
    return normalizeStockSymbol(match[1]);
  }
}

function resolveRouteParamSymbol(routeParams?: Record<string, unknown>, params?: Record<string, unknown>): string {
  return normalizeStockSymbol(routeParams?.symbol || params?.symbol || "");
}

interface ResolveSymbolOptions {
  env?: Record<string, unknown>;
  stockSymbol?: unknown;
  symbol?: unknown;
  stockSearch?: unknown;
  stockPathname?: unknown;
  routeParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

function resolveStockSymbolState({ env = {}, stockSymbol, symbol, stockSearch, stockPathname, routeParams, params }: ResolveSymbolOptions): { symbol: string; isExplicit: boolean } {
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
    return { symbol: explicitSymbol, isExplicit: true };
  }
  return { symbol: DEFAULT_STOCK_SYMBOL, isExplicit: false };
}

interface SyncLocationOptions {
  stockSearch?: unknown;
  stockPathname?: unknown;
  stockSymbol?: unknown;
  symbol?: unknown;
  routeParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

function syncStockLocation(nextSymbol: string, { stockSearch, stockPathname, stockSymbol, symbol, routeParams, params }: SyncLocationOptions): void {
  if (
    typeof stockSearch === "string"
    || typeof stockPathname === "string"
    || normalizeStockSymbol(stockSymbol)
    || normalizeStockSymbol(symbol)
    || resolveRouteParamSymbol(routeParams, params)
  ) {
    return;
  }
  if (typeof globalThis.location?.href !== "string" || typeof globalThis.history?.replaceState !== "function") return;
  try {
    const nextUrl = new URL(globalThis.location.href);
    nextUrl.pathname = `/stocks/${encodeURIComponent(nextSymbol)}`;
    nextUrl.searchParams.delete("symbol");
    globalThis.history.replaceState(globalThis.history.state, "", nextUrl.toString());
  } catch {
    // Keep local symbol state working even if URL sync is unavailable.
  }
}

interface ShellStockDetailPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
  stockSymbol?: string;
  symbol?: string;
  stockSearch?: string;
  stockPathname?: string;
  routeParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
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
}: ShellStockDetailPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: "Không thể tải snapshot stock detail từ core runtime.",
    refreshNotice: "Đã làm mới snapshot stock detail từ core runtime.",
  });

  const resolvedStockSymbolState = resolveStockSymbolState({ env, stockSymbol, symbol, stockSearch, stockPathname, routeParams, params });
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
    if (!resolvedStockSymbolState.isExplicit) return;
    setActiveStockSymbol(prev => (prev === resolvedStockSymbol ? prev : resolvedStockSymbol));
    setStockSymbolDraft(prev => (prev === resolvedStockSymbol ? prev : resolvedStockSymbol));
  }, [resolvedStockSymbol, resolvedStockSymbolState.isExplicit]);

  function handleStockSymbolChange(event: React.ChangeEvent<HTMLInputElement>) {
    setStockSymbolDraft(normalizeStockSymbol(event.target.value));
  }

  function handleStockSymbolSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextSymbol = normalizeStockSymbol(stockSymbolDraft) || resolvedStockSymbol;
    if (!nextSymbol || nextSymbol === activeStockSymbol) return;
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
        { label: "Username", value: identity.username || (session?.principal?.username as string) || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: (session?.session_id as string) || "Chưa có" },
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

  return (
    <ShellPageChrome
      eyebrow="Core stock detail market"
      title={`Trang chi tiết cổ phiếu SaaS${activeStockSymbol ? ` • ${activeStockSymbol}` : ""}`}
      description="Route /stocks/:symbol giờ được host hoàn toàn trong packages/web, tự resolve symbol từ path/search/props và chỉ mount SaaS stock detail surface từ core runtime, không phụ thuộc frontend hay backend cũ."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane stock detail" : "Lane stock detail sẵn sàng cho kiểm tra"}
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
            subtitle="Đọc nhanh session, runtime health và build meta trước khi mount stock detail surface thật của SaaS shell."
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className="shellPage__summaryGrid">{summaryCards}</section>
          </ShellPanel>

          <ShellPanel
            title="Market route và abilities"
            subtitle="Kiểm tra route stock detail đã được runtime expose đúng lane market và shell hiện tại nhận đúng symbol từ URL hay props chưa."
          >
            {renderBuildMetaCard({ key: "stock-detail-build-meta", buildMeta })}
            <div key="stock-detail-routes">
              <h3 className="shellPage__itemTitle">Visible market routes</h3>
              {renderValueList(stockRoutes, "Runtime hiện chưa expose route stock detail nào cho shell này.", "stock-detail-routes")}
            </div>
            <div key="stock-detail-surfaces">
              <h3 className="shellPage__itemTitle">Enabled surfaces</h3>
              {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "stock-detail-surfaces")}
            </div>
            {renderAbilityList({
              abilities: stockAbilities,
              emptyText: "Runtime hiện chưa trả về ability stock detail nào cho route này.",
              keyPrefix: "stock-detail-ability",
            })}
          </ShellPanel>
        </div>

        <ShellPanel
          title={`SaaS stock detail surface (${activeStockSymbol})`}
          subtitle="Surface này dùng đúng page mới trong packages/web và deep-link bằng /stocks/:symbol giống lane whale-alerts dùng shell host ở route-level."
          actions={renderHealthStatusPill(health)}
        >
          <form className="shellPage__form" key="stock-detail-symbol-form" onSubmit={handleStockSymbolSubmit}>
            <div className="shellPage__formGrid">
              {renderShellField({
                label: "Mã cổ phiếu",
                name: "stock-detail-symbol",
                value: stockSymbolDraft,
                onChange: handleStockSymbolChange,
                placeholder: "Ví dụ: HPG",
                autoComplete: "off",
              })}
              <div className="shellPage__field">
                <span className="shellPage__fieldLabel">Route hiện tại</span>
                <div className="shellPage__input">/stocks/{activeStockSymbol || DEFAULT_STOCK_SYMBOL}</div>
              </div>
            </div>
            <div className="shellPage__actions">
              <button type="submit" className="shellPage__button shellPage__button--primary" disabled={!stockSymbolDraft}>
                Mở stock detail
              </button>
            </div>
          </form>

          <article className="shellPage__surfaceCard" key="stock-detail-surface">
            <StockDetailPage env={env} symbol={activeStockSymbol} />
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
