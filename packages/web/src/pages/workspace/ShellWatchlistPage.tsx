import {
  ShellPageChrome,
  ShellPanel,
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
import { WatchlistPage } from "../WatchlistPage.tsx";

interface ShellWatchlistPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: null;
}

const WORKSPACE_ROUTE_IDS = ["dashboard", "watchlist", "transactions", "portfolios"];

export function ShellWatchlistPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellWatchlistPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot watchlist từ core runtime.",
    refreshNotice: "Đã làm mới snapshot watchlist từ core runtime.",
  });

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
  }: any = deriveCoreShellSnapshot(viewState);

  // LOGIC GATE FOR SAAS NATIVE MIGRATION
  const hasSaasNative = capabilities?.tenant?.features?.includes("watchlist_saas_native") ||
                       session?.tenant?.features?.includes("watchlist_saas_native") ||
                       identity?.tenant?.features?.includes("watchlist_saas_native") ||
                       capabilities?.entitlements?.features?.includes("watchlist_saas_native") ||
                       session?.entitlements?.features?.includes("watchlist_saas_native");

  if (hasSaasNative) {
    return <WatchlistPage env={env} autoLoad={autoLoad} identity={identity} session={session} />;
  }

  const workspaceRoutes = filterVisibleRoutes(visibleRoutes, WORKSPACE_ROUTE_IDS);
  const watchlistAbilities = filterAbilitiesBySubject(abilities, "watchlist");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Workspace routes", String(workspaceRoutes.length)),
    renderShellMetric("Watchlist abilities", String(watchlistAbilities.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "watchlist-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "watchlist-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "workspace",
    activeDetail: "Đây là group gating chính cho lane watchlist trong workspace shell.",
    visibleDetail: "Group này vẫn đi cùng session workspace hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(workspaceRoutes, {
    activeItem: "watchlist",
    activeDetail: "Đây là route watchlist chính mà shell workspace cần mở cho session hiện tại.",
    visibleDetail: "Route workspace liên quan đang được runtime cho phép hiển thị.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core watchlist workspace"
      title="Trung tâm watchlist và workspace"
      description="Trang này xác nhận lane watchlist của core shell đã có route-level page thật, bám đúng workspace routes, watchlist ability và bootstrap session mà không cần thêm backend contract mới."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane watchlist" : "Lane watchlist sẵn sàng cho kiểm tra"}
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
            subtitle="Đọc nhanh session, runtime health và build meta trước khi nối watchlist workspace thật vào shell này."
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className="shellPage__summaryGrid">
              {summaryCards}
            </section>
          </ShellPanel>
          <ShellPanel
            title="Workspace groups và watchlist routes"
            subtitle="Kiểm tra group `workspace` cùng route `watchlist` đã được runtime mở đúng theo bootstrap hiện tại hay chưa."
          >
            <div key="watchlist-groups">
              <h3 className="shellPage__itemTitle">Visible groups</h3>
              {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "watchlist-groups")}
            </div>
            <div key="watchlist-routes">
              <h3 className="shellPage__itemTitle">Workspace routes</h3>
              {renderFlagList(routeFlags, "Runtime hiện chưa expose route watchlist nào cho session này.", "watchlist-routes")}
            </div>
          </ShellPanel>
        </div>
        <ShellPanel
          title="Watchlist abilities và build metadata"
          subtitle="Giữ cùng một viewport cho auditor đọc workspace reach, enabled surfaces và ability map của lane watchlist."
          actions={renderHealthStatusPill(health)}
        >
          {renderBuildMetaCard({ key: "watchlist-build-meta", buildMeta })}
          <div key="watchlist-workspace-routes">
            <h3 className="shellPage__itemTitle">Workspace routes</h3>
            {renderValueList(workspaceRoutes, "Runtime hiện chưa mở route workspace nào.", "watchlist-workspace-routes")}
          </div>
          <div key="watchlist-surfaces">
            <h3 className="shellPage__itemTitle">Enabled surfaces</h3>
            {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "watchlist-surfaces")}
          </div>
          {renderAbilityList({
            abilities: watchlistAbilities,
            emptyText: "Runtime hiện chưa trả về ability watchlist nào cho route này.",
            keyPrefix: "watchlist-ability",
          })}
          <article className="shellPage__surfaceCard" key="watchlist-summary-card">
            <h3 className="shellPage__itemTitle">Workspace summary</h3>
            <p className="shellPage__itemMeta">Workspace routes visible: {workspaceRoutes.length}</p>
            <p className="shellPage__itemMeta">Watchlist routes active: {countFlagsByState(routeFlags, "ACTIVE")}</p>
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
