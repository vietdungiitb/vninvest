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

export function ShellAiCommandCenterPage({
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
    fallbackErrorMessage: "Không thể tải snapshot điều hành AI từ core runtime.",
    refreshNotice: "Đã làm mới snapshot điều hành AI từ core runtime.",
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
  const aiRoutes = filterVisibleRoutes(visibleRoutes, ["ai-command-center", "ai-advisory"]);
  const aiFlags = buildSurfaceFlags(surfaces, [
    {
      key: "show_ai_command_center",
      label: "show_ai_command_center",
      detail: "Flag chính xác nhận runtime đang mở lane điều hành AI cho shell hiện tại.",
    },
    {
      key: "show_admin_ops",
      label: "show_admin_ops",
      detail: "Cho biết operator lane có đồng thời bật để phối hợp với control center AI hay không.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem shell AI hiện tại có đang nằm trong build target VIP hay không.",
    },
  ]);
  const aiAbilities = filterAbilitiesBySubject(abilities, "ai");

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("AI routes", String(aiRoutes.length)),
    renderShellMetric("AI flags ON", String(countFlagsByState(aiFlags, "ON"))),
    renderShellMetric("AI abilities", String(aiAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-session",
      title: "Operator và session hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "ai-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "system",
    activeDetail: "Đây là group gating chính chứa route AI command center.",
    visibleDetail: "Group này vẫn đi cùng session AI hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(aiRoutes, {
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong shell hiện tại.",
  });

  return renderShellPageChrome({
    eyebrow: "Core AI command center",
    title: "Trung tâm điều hành AI shell",
    description:
      "Trang này xác nhận lane AI của core shell đã có route-level page thật, bám đúng surface flag `show_ai_command_center`, AI routes và operator session mà không cần thêm backend contract mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane AI" : "Lane AI sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, build meta và runtime health trước khi nối các control AI thật vào page này.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "AI routes và navigation groups",
          subtitle: "Kiểm tra route `ai-command-center` cùng các route AI liên quan đã được runtime mở đúng theo shell hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "ai-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-groups"),
            ),
            renderElement(
              "div",
              { key: "ai-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "AI routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route AI nào cho session này.", "ai-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Surface flags và AI abilities",
        subtitle: "Giữ cùng một viewport cho auditor đọc tình trạng flag AI, route exposure và quyền quản trị liên quan đến AI lane.",
        actions: renderHealthStatusPill(health),
        children: [
          renderFlagList(aiFlags, "Runtime chưa công bố surface flag AI nào.", "ai-flags"),
          renderBuildMetaCard({ key: "ai-build-meta", buildMeta }),
          renderAbilityList({
            abilities: aiAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI lane nào cho route này.",
            keyPrefix: "ai-ability",
          }),
        ],
      }),
    ),
  });
}