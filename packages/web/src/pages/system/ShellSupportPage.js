import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
} from "../../components/ShellPageTemplate.js";
import {
  buildVisibilityFlags,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  getEnabledSurfaceKeys,
  renderAbilityList,
  renderBuildMetaCard,
  renderElement,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const SYSTEM_ROUTE_IDS = ["support", "settings", "ai-command-center"];

export function ShellSupportPage({
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
    fallbackErrorMessage: "Không thể tải snapshot hỗ trợ hệ thống từ core runtime.",
    refreshNotice: "Đã làm mới snapshot hỗ trợ hệ thống từ core runtime.",
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
  const systemRoutes = filterVisibleRoutes(visibleRoutes, SYSTEM_ROUTE_IDS);
  const supportAbilities = filterAbilitiesBySubject(abilities, "support");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("System routes", String(systemRoutes.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
    renderShellMetric("Support abilities", String(supportAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "support-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "support-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "system",
    activeDetail: "Đây là group gating chính cho support lane trong system shell.",
    visibleDetail: "Group này vẫn đi cùng session system hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(systemRoutes, {
    activeItem: "support",
    activeDetail: "Đây là route hỗ trợ hệ thống chính đang được shell mở cho session hiện tại.",
    visibleDetail: "Route system liên quan đang được runtime cho phép hiển thị.",
  });

  return renderShellPageChrome({
    eyebrow: "Core support lane",
    title: "Trung tâm hỗ trợ hệ thống",
    description:
      "Trang này xác nhận lane hỗ trợ của core shell đã có route-level page thật, bám đúng system routes, support ability và bootstrap session mà không cần thêm backend contract mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane hỗ trợ" : "Lane hỗ trợ sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, build meta và runtime health trước khi nối các workflow support thật vào lane này.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "System groups và support routes",
          subtitle: "Kiểm tra group `system` cùng route `support` đã được runtime mở đúng theo shell hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "support-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "support-groups"),
            ),
            renderElement(
              "div",
              { key: "support-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "System routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route hỗ trợ nào cho session này.", "support-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Support abilities và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc support reach, enabled surfaces và metadata của lane hỗ trợ.",
        actions: renderHealthStatusPill(health),
        children: [
          renderBuildMetaCard({ key: "support-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "support-system-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "System routes"),
            renderValueList(systemRoutes, "Runtime hiện chưa mở route system nào.", "support-system-routes"),
          ),
          renderElement(
            "div",
            { key: "support-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "support-surfaces"),
          ),
          renderAbilityList({
            abilities: supportAbilities,
            emptyText: "Runtime hiện chưa trả về ability hỗ trợ nào cho route này.",
            keyPrefix: "support-ability",
          }),
        ],
      }),
    ),
  });
}