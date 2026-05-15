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

export function ShellOperationsCenterPage({
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
    fallbackErrorMessage: "Không thể tải snapshot điều hành SOC từ core runtime.",
    refreshNotice: "Đã làm mới snapshot điều hành SOC từ core runtime.",
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
  const operatorAbilities = filterAbilitiesBySubject(abilities, "admin");
  const operatorRoutes = filterVisibleRoutes(visibleRoutes, ["operations-center", "ai-command-center"]);
  const operatorFlags = buildSurfaceFlags(surfaces, [
    {
      key: "show_operations_center",
      label: "show_operations_center",
      detail: "Xác nhận shell có mở SOC operator surface thống nhất cho lane vận hành hay không.",
    },
    {
      key: "show_ai_command_center",
      label: "show_ai_command_center",
      detail: "Cho biết runtime đã sẵn sàng expose lane điều hành AI hay chưa.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem session operator hiện tại có đồng thời bật lane VIP hay không.",
    },
  ]);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Operator routes", String(operatorRoutes.length)),
    renderShellMetric("SOC flags ON", String(countFlagsByState(operatorFlags, "ON"))),
    renderShellMetric("Operator abilities", String(operatorAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "operator-session",
      title: "SOC operator identity hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Staff", value: identity.is_staff ? "Có" : "Không" },
        { label: "Superuser", value: identity.is_superuser ? "Có" : "Không" },
      ],
    }),
    renderSummaryCard({
      key: "operator-runtime",
      title: "SOC runtime snapshot",
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
    visibleDetail: "Group này vẫn đi cùng session operator hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(operatorRoutes, {
    activeItem: "operations-center",
    activeDetail: "Đây là route SOC chính đang dẫn cho operator shell.",
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong navigation hiện tại.",
  });

  return renderShellPageChrome({
    eyebrow: "Service Operations Center",
    title: "Trung tâm SOC shell",
    description:
      "Trang này xác nhận lane vận hành SOC của core shell đã có route-level page thật, bám đúng surface flags, operator routes và operator identity mà không cần thêm contract backend mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane SOC" : "Lane SOC sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh identity, runtime status và session của operator hiện tại trước khi nối các thao tác SOC thật.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "SOC routes và navigation groups",
          subtitle: "Kiểm tra operator surface thống nhất đã được runtime mở đúng theo session hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "operator-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "operator-groups"),
            ),
            renderElement(
              "div",
              { key: "operator-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Operator routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose SOC route nào cho session này.", "operator-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Surface flags và operator abilities",
        subtitle: "Giữ cùng một viewport cho operator đọc tình trạng flag SOC, AI lane và các quyền vận hành đang active.",
        actions: renderHealthStatusPill(health),
        children: [
          renderFlagList(operatorFlags, "Runtime chưa công bố surface flag nào.", "operator-flags"),
          renderBuildMetaCard({ key: "operator-build-meta", buildMeta }),
          renderAbilityList({
            abilities: operatorAbilities,
            emptyText: "Runtime hiện chưa trả về operator ability nào cho route này.",
            keyPrefix: "operator-ability",
            getPill: (ability) => ability.subject,
            getDetail: (ability) => `Action: ${ability.action}`,
          }),
        ],
      }),
    ),
  });
}