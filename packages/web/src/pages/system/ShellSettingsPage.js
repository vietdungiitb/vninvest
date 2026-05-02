import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import {
  deriveCoreShellSnapshot,
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
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

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
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
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
        actions: renderHealthStatusPill(health),
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