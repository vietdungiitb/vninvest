import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import {
  renderAbilityList,
  renderBuildMetaCard,
  renderElement,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

export function ShellSettingsPage({
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
    fallbackErrorMessage: "Không thể tải snapshot cấu hình shell từ core runtime.",
    refreshNotice: "Đã làm mới snapshot cấu hình shell từ core runtime.",
  });

  const buildMeta = viewState.buildMeta || null;
  const health = viewState.health || null;
  const capabilities = viewState.capabilities || null;
  const session = viewState.session || null;
  const identity = capabilities?.principal?.identity || {};
  const visibleGroups = Array.isArray(capabilities?.navigation?.visible_groups)
    ? capabilities.navigation.visible_groups
    : [];
  const visibleRoutes = Array.isArray(capabilities?.navigation?.visible_routes)
    ? capabilities.navigation.visible_routes
    : [];
  const abilities = Array.isArray(capabilities?.abilities) ? capabilities.abilities : [];
  const enabledSurfaces = Object.entries(capabilities?.surfaces || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([surfaceKey]) => surfaceKey);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Gói hiện tại", capabilities?.build?.plan || "n/a"),
    renderShellMetric("Route nhìn thấy", String(visibleRoutes.length)),
    renderShellMetric("Ability active", String(abilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "session",
      title: "Phiên shell hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "runtime",
      title: "Runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  return renderShellPageChrome({
    eyebrow: "Core shell settings",
    title: "Thiết lập shell và quyền truy cập",
    description:
      "Trang này xác nhận shell core đang nhận đúng health, build meta, session, navigation và surface flags trước khi các route hệ thống sâu hơn được dựng tiếp.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ core runtime" : "Core runtime sẵn sàng cho kiểm tra",
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
          title: "Snapshot runtime hiện tại",
          subtitle: "Đọc nhanh tình trạng phiên, môi trường và adapter đang được shell core sử dụng.",
          actions: renderElement(
            "div",
            { className: "shellPage__actions" },
            renderElement(
              "button",
              {
                type: "button",
                className: "shellPage__button shellPage__button--secondary",
                onClick: handleRefresh,
                disabled: viewState.loading,
              },
              "Làm mới snapshot",
            ),
          ),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Nhóm điều hướng và surface flags",
          subtitle: "Cho phép kiểm tra nhanh gating hiện hành của system/workspace/admin trước khi page hệ thống thật được nối vào shell.",
          children: [
            renderElement(
              "div",
              { key: "visible-groups-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderValueList(visibleGroups, "Chưa có navigation group nào được mở.", "groups"),
            ),
            renderElement(
              "div",
              { key: "visible-routes-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible routes"),
              renderValueList(visibleRoutes, "Chưa có route nào được mở.", "routes"),
            ),
            renderElement(
              "div",
              { key: "surfaces-block" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
              renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "surfaces"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Ability map và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc plan, abilities và metadata mà không cần rời khỏi route settings.",
        actions: renderElement(
          "div",
          { className: "shellPage__actions" },
          renderElement(
            "span",
            { className: "shellPage__pill" },
            `Health: ${health?.ok ? "OK" : "Chưa xác nhận"}`,
          ),
        ),
        children: [
          renderBuildMetaCard({ key: "build-meta-card", buildMeta }),
          renderAbilityList({
            abilities,
            emptyText: "Runtime hiện chưa trả về ability nào cho shell page này.",
          }),
        ],
      }),
    ),
  });
}