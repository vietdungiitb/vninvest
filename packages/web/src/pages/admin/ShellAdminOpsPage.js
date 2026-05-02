import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import {
  buildSurfaceFlags,
  buildVisibilityFlags,
  countFlagsByState,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  renderAbilityList,
  renderBuildMetaCard,
  renderElement,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

export function ShellAdminOpsPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot,
    fallbackErrorMessage: "Không thể tải snapshot điều hành admin từ core runtime.",
    refreshNotice: "Đã làm mới snapshot điều hành admin từ core runtime.",
  });

  const {
    buildMeta,
    health,
    capabilities,
    session,
    identity,
    visibleGroups,
    visibleRoutes,
    abilities,
    surfaces,
  } = deriveCoreShellSnapshot(viewState);
  const adminAbilities = filterAbilitiesBySubject(abilities, "admin");
  const adminRoutes = filterVisibleRoutes(visibleRoutes, ["admin-ops", "ai-command-center"]);
  const adminFlags = buildSurfaceFlags(surfaces, [
    {
      key: "show_admin_ops",
      label: "show_admin_ops",
      detail: "Xác nhận shell có mở operator surface cho route admin-ops hay không.",
    },
    {
      key: "show_ai_command_center",
      label: "show_ai_command_center",
      detail: "Cho biết runtime đã sẵn sàng expose lane điều hành AI hay chưa.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem session admin hiện tại có đồng thời bật lane VIP hay không.",
    },
  ]);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Admin routes", String(adminRoutes.length)),
    renderShellMetric("Admin flags ON", String(countFlagsByState(adminFlags, "ON"))),
    renderShellMetric("Admin abilities", String(adminAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "admin-session",
      title: "Operator identity hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Staff", value: identity.is_staff ? "Có" : "Không" },
        { label: "Superuser", value: identity.is_superuser ? "Có" : "Không" },
      ],
    }),
    renderSummaryCard({
      key: "admin-runtime",
      title: "Core runtime snapshot",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "admin",
    activeDetail: "Đây là group gating chính cho lane operator surfaces.",
    visibleDetail: "Group này vẫn đi cùng session admin hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(adminRoutes, {
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong navigation hiện tại.",
  });

  return renderShellPageChrome({
    eyebrow: "Core admin operations",
    title: "Trung tâm vận hành admin shell",
    description:
      "Trang này chứng minh lane admin của core shell đã có route-level page thật, bám đúng surface flags, admin routes và operator identity mà không cần thêm contract backend mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane admin" : "Lane admin sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh identity, runtime status và session của operator hiện tại trước khi nối các thao tác admin thật.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Admin routes và navigation groups",
          subtitle: "Kiểm tra route `admin-ops` cùng nhóm `admin` đã được runtime mở đúng theo session operator hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "admin-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "admin-groups"),
            ),
            renderElement(
              "div",
              { key: "admin-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Admin routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route admin nào cho session này.", "admin-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Surface flags và operator abilities",
        subtitle: "Giữ cùng một viewport cho operator đọc tình trạng flag admin, AI lane và các quyền quản trị đang active.",
        actions: renderHealthStatusPill(health),
        children: [
          renderFlagList(adminFlags, "Runtime chưa công bố surface flag nào.", "admin-flags"),
          renderBuildMetaCard({ key: "admin-build-meta", buildMeta }),
          renderAbilityList({
            abilities: adminAbilities,
            emptyText: "Runtime hiện chưa trả về ability admin nào cho route này.",
            keyPrefix: "admin-ability",
            getPill: (ability) => ability.subject,
            getDetail: (ability) => `Action: ${ability.action}`,
          }),
        ],
      }),
    ),
  });
}