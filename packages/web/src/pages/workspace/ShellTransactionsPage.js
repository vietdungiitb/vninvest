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

const WORKSPACE_ROUTE_IDS = ["dashboard", "watchlist", "transactions", "portfolios"];

export function ShellTransactionsPage({
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
    fallbackErrorMessage: "Không thể tải snapshot giao dịch từ core runtime.",
    refreshNotice: "Đã làm mới snapshot giao dịch từ core runtime.",
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
  const workspaceRoutes = filterVisibleRoutes(visibleRoutes, WORKSPACE_ROUTE_IDS);
  const transactionAbilities = filterAbilitiesBySubject(abilities, "transactions");
  const enabledSurfaces = getEnabledSurfaceKeys(surfaces);

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("Workspace routes", String(workspaceRoutes.length)),
    renderShellMetric("Transaction abilities", String(transactionAbilities.length)),
    renderShellMetric("Enabled surfaces", String(enabledSurfaces.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "transactions-session",
      title: "Operator và phiên hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Email", value: identity.email || "Chưa có" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "transactions-runtime",
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
    activeDetail: "Đây là group gating chính cho lane giao dịch trong workspace shell.",
    visibleDetail: "Group này vẫn đi cùng session workspace hiện tại.",
  });
  const routeFlags = buildVisibilityFlags(workspaceRoutes, {
    activeItem: "transactions",
    activeDetail: "Đây là route giao dịch chính mà shell workspace cần mở cho session hiện tại.",
    visibleDetail: "Route workspace liên quan đang được runtime cho phép hiển thị.",
  });

  return renderShellPageChrome({
    eyebrow: "Core transactions workspace",
    title: "Trung tâm giao dịch và workspace",
    description:
      "Trang này xác nhận lane giao dịch của core shell đã có route-level page thật, bám đúng workspace routes, transactions ability và bootstrap session mà không cần thêm backend contract mới.",
    badge: renderElement(
      "div",
      { className: "shellPage__heroBadge" },
      renderElement("span", { className: "shellPage__statusDot" }),
      viewState.loading ? "Đang đồng bộ lane giao dịch" : "Lane giao dịch sẵn sàng cho kiểm tra",
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
          subtitle: "Đọc nhanh session, runtime health và build meta trước khi nối lane giao dịch thật vào workspace shell này.",
          actions: renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading }),
          children: renderElement("section", { className: "shellPage__summaryGrid" }, summaryCards),
        }),
        renderShellPanel({
          title: "Workspace groups và route giao dịch",
          subtitle: "Kiểm tra group `workspace` cùng route `transactions` đã được runtime mở đúng theo bootstrap hiện tại hay chưa.",
          children: [
            renderElement(
              "div",
              { key: "transactions-groups" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Visible groups"),
              renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "transactions-groups"),
            ),
            renderElement(
              "div",
              { key: "transactions-routes" },
              renderElement("h3", { className: "shellPage__itemTitle" }, "Workspace routes"),
              renderFlagList(routeFlags, "Runtime hiện chưa expose route giao dịch nào cho session này.", "transactions-routes"),
            ),
          ],
        }),
      ),
      renderShellPanel({
        title: "Transactions abilities và build metadata",
        subtitle: "Giữ cùng một viewport cho auditor đọc workspace reach, enabled surfaces và ability map của lane giao dịch.",
        actions: renderHealthStatusPill(health),
        children: [
          renderBuildMetaCard({ key: "transactions-build-meta", buildMeta }),
          renderElement(
            "div",
            { key: "transactions-workspace-routes" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Workspace routes"),
            renderValueList(workspaceRoutes, "Runtime hiện chưa mở route workspace nào.", "transactions-workspace-routes"),
          ),
          renderElement(
            "div",
            { key: "transactions-surfaces" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Enabled surfaces"),
            renderValueList(enabledSurfaces, "Runtime chưa bật surface flag nào.", "transactions-surfaces"),
          ),
          renderAbilityList({
            abilities: transactionAbilities,
            emptyText: "Runtime hiện chưa trả về ability giao dịch nào cho route này.",
            keyPrefix: "transactions-ability",
          }),
          renderElement(
            "article",
            { className: "shellPage__surfaceCard", key: "transactions-summary-card" },
            renderElement("h3", { className: "shellPage__itemTitle" }, "Workspace summary"),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Workspace routes visible: ${workspaceRoutes.length}`,
            ),
            renderElement(
              "p",
              { className: "shellPage__itemMeta" },
              `Transactions routes active: ${countFlagsByState(routeFlags, "ACTIVE")}`,
            ),
          ),
        ],
      }),
    ),
  });
}