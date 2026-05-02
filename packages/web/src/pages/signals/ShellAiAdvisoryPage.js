import {
  renderShellMetric,
  renderShellPageChrome,
  renderShellPanel,
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
  renderElement,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const SIGNAL_ROUTE_IDS = ["ai-advisory", "whale-alerts"];

export function ShellAiAdvisoryPage({
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
    fallbackErrorMessage: "Không thể tải snapshot AI advisory từ core runtime.",
    refreshNotice: "Đã làm mới snapshot AI advisory từ core runtime.",
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
  const signalRoutes = filterVisibleRoutes(visibleRoutes, SIGNAL_ROUTE_IDS);
  const advisoryAbilities = filterAbilitiesBySubject(abilities, "aiadvisory");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Signals routes", String(signalRoutes.length)),
    renderShellMetric("Advisory abilities", String(advisoryAbilities.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-advisory-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "ai-advisory-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "signals",
    activeDetail: "Đây là group gating chính cho lane AI advisory trong signals shell.",
    visibleDetail: "Group này vẫn đi cùng session signals hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(signalRoutes, {
    activeItem: "ai-advisory",
    activeDetail: "Đây là route AI advisory chính mà shell signals cần mở cho session hiện tại.",
    visibleDetail: "Route signals liên quan đang được runtime cho phép hiển thị.",
  });

  return renderShellPageChrome({
    eyebrow: "Core AI advisory signals",
    title: "Trung tâm AI advisory và tín hiệu",
    description:
      "Trang này xác nhận lane AI advisory của core shell đã có route-level page thật, bám đúng signals routes, advisory ability và bootstrap session mà chỉ cần chỉnh rất hẹp ở bootstrap contract hiện có.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane AI advisory" : "Lane AI advisory sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi nối advisory experience thật vào signals shell này.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Signals groups và advisory routes",
          subtitle: "Kiểm tra group `signals` cùng route `ai-advisory` đã được runtime mở đúng theo bootstrap hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "ai-advisory-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-advisory-groups"),
            ),
            renderElement(
              "div",
              { key: "ai-advisory-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route advisory nào cho session này.", "ai-advisory-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Advisory abilities và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc signal reach, enabled surfaces và ability map của lane AI advisory.",
        actions: renderHealthStatusPill(health),
        children: [
          renderBuildMetaCard({ key: "ai-advisory-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "ai-advisory-signal-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
            renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "ai-advisory-signal-routes"),
          ),
          renderElement(
            "div",
            { key: "ai-advisory-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "ai-advisory-surfaces"),
          ),
          renderAbilityList({
            abilities: advisoryAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI advisory nào cho route này.",
            keyPrefix: "ai-advisory-ability",
          }),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "ai-advisory-summary-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals summary"),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Signals routes visible: ${signalRoutes.length}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Advisory routes active: ${countFlagsByState(routeFlags, "ACTIVE")}`,
            ),
          ),
        ],
      }),
    ),
  });
}