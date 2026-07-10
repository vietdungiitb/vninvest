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

interface ShellPortfoliosPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: null;
}

const WORKSPACE_ROUTE_IDS = ["dashboard", "watchlist", "transactions", "portfolios"];
const PORTFOLIO_ROUTE_IDS = ["portfolios", "transactions"];

export function ShellPortfoliosPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellPortfoliosPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot danh mục từ core runtime.",
    refreshNotice: "Đã làm mới snapshot danh mục từ core runtime.",
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
  const workspaceRoutes = filterVisibleRoutes(visibleRoutes, WORKSPACE_ROUTE_IDS);
  const portfolioRoutes = filterVisibleRoutes(visibleRoutes, PORTFOLIO_ROUTE_IDS);
  const portfolioAbilities = filterAbilitiesBySubject(abilities, "portfolio");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Workspace routes", String(workspaceRoutes.length)),
    renderShellMetric("Portfolio routes", String(portfolioRoutes.length)),
    renderShellMetric("Portfolio abilities", String(portfolioAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "portfolio-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "portfolio-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "workspace",
    activeDetail: "Đây là group gating chính cho toàn bộ workspace lane, bao gồm surface danh mục.",
    visibleDetail: "Group này vẫn đi cùng session workspace hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(portfolioRoutes, {
    activeItem: "portfolios",
    activeDetail: "Đây là route danh mục chính mà shell workspace cần mở cho session hiện tại.",
    visibleDetail: "Route workspace liên quan đang được runtime cho phép hiển thị.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core portfolios workspace"
      title="Trung tâm danh mục và workspace"
      description="Trang này xác nhận lane danh mục của core shell đã có route-level page thật, bám đúng workspace routes, ability danh mục và session bootstrap mà không cần mở contract backend mới."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane danh mục" : "Lane danh mục sẵn sàng cho kiểm tra"}
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
            subtitle="Đọc nhanh session, runtime health và build meta trước khi nối portfolio workspace thật vào shell này."
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className="shellPage__summaryGrid">
              {summaryCards}
            </section>
          </ShellPanel>
          <ShellPanel
            title="Workspace groups và portfolio routes"
            subtitle="Kiểm tra group `workspace` cùng route `portfolios` đã được runtime mở đúng theo bootstrap hiện tại hay chưa."
          >
            <div key="portfolio-groups">
              <h3 className="shellPage__itemTitle">Visible groups</h3>
              {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "portfolio-groups")}
            </div>
            <div key="portfolio-routes">
              <h3 className="shellPage__itemTitle">Portfolio routes</h3>
              {renderFlagList(routeFlags, "Runtime hiện chưa expose route danh mục nào cho session này.", "portfolio-routes")}
            </div>
          </ShellPanel>
        </div>
        <ShellPanel
          title="Portfolio abilities và build metadata"
          subtitle="Giữ cùng một viewport cho auditor đọc workspace reach, enabled surfaces và ability map của lane danh mục."
          actions={renderHealthStatusPill(health)}
        >
          {renderBuildMetaCard({ key: "portfolio-build-meta", buildMeta })}
          <div key="workspace-routes-all">
            <h3 className="shellPage__itemTitle">Workspace routes</h3>
            {renderValueList(workspaceRoutes, "Runtime hiện chưa mở route workspace nào.", "workspace-routes")}
          </div>
          <div key="portfolio-surfaces">
            <h3 className="shellPage__itemTitle">Enabled surfaces</h3>
            {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "portfolio-surfaces")}
          </div>
          {renderAbilityList({
            abilities: portfolioAbilities,
            emptyText: "Runtime hiện chưa trả về ability danh mục nào cho route này.",
            keyPrefix: "portfolio-ability",
          })}
          <article className="shellPage__surfaceCard" key="portfolio-summary-card">
            <h3 className="shellPage__itemTitle">Workspace summary</h3>
            <p className="shellPage__itemMeta">Workspace routes visible: {workspaceRoutes.length}</p>
            <p className="shellPage__itemMeta">Portfolio routes active: {countFlagsByState(routeFlags, "ACTIVE")}</p>
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
