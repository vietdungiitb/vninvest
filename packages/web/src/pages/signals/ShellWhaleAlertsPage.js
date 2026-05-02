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

export function ShellWhaleAlertsPage({
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
    fallbackErrorMessage: "Không thể tải snapshot whale alerts từ core runtime.",
    refreshNotice: "Đã làm mới snapshot whale alerts từ core runtime.",
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
  const whaleAbilities = filterAbilitiesBySubject(abilities, "whaleadvisory");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Signals routes", String(signalRoutes.length)),
    renderShellMetric("Whale abilities", String(whaleAbilities.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "whale-alerts-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "whale-alerts-runtime",
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
    activeDetail: "Đây là group gating chính cho lane whale alerts trong signals shell.",
    visibleDetail: "Group này vẫn đi cùng session signals hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(signalRoutes, {
    activeItem: "whale-alerts",
    activeDetail: "Đây là route whale alerts chính mà shell signals cần mở cho session hiện tại.",
    visibleDetail: "Route signals liên quan đang được runtime cho phép hiển thị.",
  });

  return renderShellPageChrome({
    eyebrow: "Core whale alerts signals",
    title: "Trung tâm whale alerts và tín hiệu",
    description:
      "Trang này xác nhận lane whale alerts của core shell đã có route-level audit surface thật, bám đúng signals routes, whale ability naming và bootstrap session mà không chạm vào KLine intelligence workspace thật của feature pack whale.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane whale alerts" : "Lane whale alerts sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi nối whale workspace thật vào shell signals này.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Signals groups và whale routes",
          subtitle: "Kiểm tra group `signals` cùng route `whale-alerts` đã được runtime mở đúng theo bootstrap hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "whale-alerts-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "whale-alerts-groups"),
            ),
            renderElement(
              "div",
              { key: "whale-alerts-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route whale alerts nào cho session này.", "whale-alerts-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Whale abilities và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc signal reach, enabled surfaces và ability map của lane whale alerts trước khi nối UI whale intelligence thật.",
        actions: renderHealthStatusPill(health),
        children: [
          renderBuildMetaCard({ key: "whale-alerts-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "whale-alerts-signal-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals routes"),
            renderValueList(signalRoutes, "Runtime hiện chưa mở route signals nào.", "whale-alerts-signal-routes"),
          ),
          renderElement(
            "div",
            { key: "whale-alerts-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "whale-alerts-surfaces"),
          ),
          renderAbilityList({
            abilities: whaleAbilities,
            emptyText: "Runtime hiện chưa trả về ability whale lane nào cho route này.",
            keyPrefix: "whale-alerts-ability",
          }),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "whale-alerts-summary-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Signals summary"),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Signals routes visible: ${signalRoutes.length}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Whale routes active: ${countFlagsByState(routeFlags, "ACTIVE")}`,
            ),
          ),
        ],
      }),
    ),
  });
}