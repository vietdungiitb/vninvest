import styles from "../../components/ShellPageTemplate.module.css";
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
interface ShellDashboardPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: null;
}

const WORKSPACE_ROUTE_IDS = ["dashboard", "watchlist", "transactions", "portfolios"];

export function ShellDashboardPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellDashboardPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot dashboard từ core runtime.",
    refreshNotice: "Đã làm mới snapshot dashboard từ core runtime.",
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
  const dashboardAbilities = filterAbilitiesBySubject(abilities, "dashboard");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Workspace routes", String(workspaceRoutes.length)),
    renderShellMetric("Dashboard abilities", String(dashboardAbilities.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "dashboard-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "dashboard-runtime",
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
    activeDetail: "Đây là group gating chính cho lane dashboard trong workspace shell.",
    visibleDetail: "Group này vẫn đi cùng session workspace hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(workspaceRoutes, {
    activeItem: "dashboard",
    activeDetail: "Đây là route dashboard chính mà shell workspace cần mở cho session hiện tại.",
    visibleDetail: "Route workspace liên quan đang được runtime cho phép hiển thị.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core dashboard workspace"
      title="Trung tâm dashboard và workspace"
      description="Trang này xác nhận lane dashboard của core shell đã có route-level page thật, bám đúng workspace routes, dashboard ability và bootstrap session mà không cần thêm backend contract mới."
      badge={(
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading ? "Đang đồng bộ lane dashboard" : "Lane dashboard sẵn sàng cho kiểm tra"}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title="Snapshot operator và runtime"
            subtitle="Đọc nhanh session, runtime health và build meta trước khi nối dashboard workspace thật vào shell này."
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className={`${styles.summaryGrid}`}>
              {summaryCards}
            </section>
          </ShellPanel>
          <ShellPanel
            title="Workspace groups và dashboard routes"
            subtitle="Kiểm tra group `workspace` cùng route `dashboard` đã được runtime mở đúng theo bootstrap hiện tại hay chưa."
          >
            <div key="dashboard-groups">
              <h3 className={`${styles.itemTitle}`}>Visible groups</h3>
              {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "dashboard-groups")}
            </div>
            <div key="dashboard-routes">
              <h3 className={`${styles.itemTitle}`}>Workspace routes</h3>
              {renderFlagList(routeFlags, "Runtime hiện chưa expose route dashboard nào cho session này.", "dashboard-routes")}
            </div>
          </ShellPanel>
        </div>
        <ShellPanel
          title="Dashboard abilities và build metadata"
          subtitle="Giữ cùng một viewport cho auditor đọc workspace reach, enabled surfaces và ability map của lane dashboard."
          actions={renderHealthStatusPill(health)}
        >
          {renderBuildMetaCard({ key: "dashboard-build-meta", buildMeta })}
          <div key="dashboard-workspace-routes">
            <h3 className={`${styles.itemTitle}`}>Workspace routes</h3>
            {renderValueList(workspaceRoutes, "Runtime hiện chưa mở route workspace nào.", "dashboard-workspace-routes")}
          </div>
          <div key="dashboard-surfaces">
            <h3 className={`${styles.itemTitle}`}>Enabled surfaces</h3>
            {renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "dashboard-surfaces")}
          </div>
          {renderAbilityList({
            abilities: dashboardAbilities,
            emptyText: "Runtime hiện chưa trả về ability dashboard nào cho route này.",
            keyPrefix: "dashboard-ability",
          })}
          <article className={`${styles.surfaceCard}`} key="dashboard-summary-card">
            <h3 className={`${styles.itemTitle}`}>Workspace summary</h3>
            <p className={`${styles.itemMeta}`}>Workspace routes visible: {workspaceRoutes.length}</p>
            <p className={`${styles.itemMeta}`}>Dashboard routes active: {countFlagsByState(routeFlags, "ACTIVE")}</p>
          </article>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
