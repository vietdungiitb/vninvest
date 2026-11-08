import styles from "../../components/ShellPageTemplate.module.css";
import { useI18n } from "../../context/LangContext.js";
import {
  ShellPageChrome,
  ShellPanel,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import {
  buildVisibilityFlags,
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

interface ShellSupportPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const SYSTEM_ROUTE_IDS = ["support", "settings", "ai-command-center"];

export function ShellSupportPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellSupportPageProps) {
  const { t } = useI18n();
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: t("shellSupport.fallbackError", { defaultValue: "Không thể tải snapshot hỗ trợ hệ thống từ core runtime." }),
    refreshNotice: t("shellSupport.refreshNotice", { defaultValue: "Đã làm mới snapshot hỗ trợ hệ thống từ core runtime." }),
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
    renderShellMetric(t("shellSupport.metricBuildTarget", { defaultValue: "Build target" }), buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric(t("shellSupport.metricSystemRoutes", { defaultValue: "System routes" }), String(systemRoutes.length)),
    renderShellMetric(t("shellSupport.metricEnabledSurfaces", { defaultValue: "Enabled surfaces" }), String(enabledSurfaces.length)),
    renderShellMetric(t("shellSupport.metricSupportAbilities", { defaultValue: "Support abilities" }), String(supportAbilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "support-session",
      title: t("shellSupport.sessionTitle", { defaultValue: "Operator và phiên hiện tại" }),
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || t("shellSupport.empty", { defaultValue: "Chưa có" }) },
        { label: "Email", value: identity.email || t("shellSupport.empty", { defaultValue: "Chưa có" }) },
        { label: "Session ID", value: session?.session_id || t("shellSupport.empty", { defaultValue: "Chưa có" }) },
      ],
    }),
    renderSummaryCard({
      key: "support-runtime",
      title: t("shellSupport.runtimeTitle", { defaultValue: "Core runtime và adapter" }),
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "system",
    activeDetail: t("shellSupport.groupActiveDetail", { defaultValue: "Đây là group gating chính cho support lane trong system shell." }),
    visibleDetail: t("shellSupport.groupVisibleDetail", { defaultValue: "Group này vẫn đi cùng session system hiện tại." }),
  });

  const routeFlags = buildVisibilityFlags(systemRoutes, {
    activeItem: "support",
    activeDetail: t("shellSupport.routeActiveDetail", { defaultValue: "Đây là route hỗ trợ hệ thống chính đang được shell mở cho session hiện tại." }),
    visibleDetail: t("shellSupport.routeVisibleDetail", { defaultValue: "Route system liên quan đang được runtime cho phép hiển thị." }),
  });

  return (
    <ShellPageChrome
      eyebrow={t("shellSupport.eyebrow", { defaultValue: "Core support lane" })}
      title={t("shellSupport.title", { defaultValue: "Trung tâm hỗ trợ hệ thống" })}
      description={t("shellSupport.description", { defaultValue: "Trang này xác nhận lane hỗ trợ của core shell đã có route-level page thật, bám đúng system routes, support ability và bootstrap session mà không cần thêm backend contract mới." })}
      badge={(
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading ? t("shellSupport.syncing", { defaultValue: "Đang đồng bộ lane hỗ trợ" }) : t("shellSupport.ready", { defaultValue: "Lane hỗ trợ sẵn sàng cho kiểm tra" })}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title={t("shellSupport.snapshotTitle", { defaultValue: "Snapshot operator và runtime" })}
            subtitle={t("shellSupport.snapshotSubtitle", { defaultValue: "Đọc nhanh session, build meta và runtime health trước khi nối các workflow support thật vào lane này." })}
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className={`${styles.summaryGrid}`}>
              {summaryCards}
            </section>
          </ShellPanel>
          <ShellPanel
            title={t("shellSupport.groupsTitle", { defaultValue: "System groups và support routes" })}
            subtitle={t("shellSupport.groupsSubtitle", { defaultValue: "Kiểm tra group `system` cùng route `support` đã được runtime mở đúng theo shell hiện tại hay chưa." })}
          >
            <div key="support-groups">
              <h3 className={`${styles.itemTitle}`}>{t("shellSupport.visibleGroups", { defaultValue: "Visible groups" })}</h3>
              {renderFlagList(groupFlags, t("shellSupport.noGroups", { defaultValue: "Session hiện chưa mở group điều hướng nào." }), "support-groups")}
            </div>
            <div key="support-routes">
              <h3 className={`${styles.itemTitle}`}>{t("shellSupport.systemRoutes", { defaultValue: "System routes" })}</h3>
              {renderFlagList(routeFlags, t("shellSupport.noSupportRoutes", { defaultValue: "Runtime hiện chưa expose route hỗ trợ nào cho session này." }), "support-routes")}
            </div>
          </ShellPanel>
        </div>
        <ShellPanel
          title={t("shellSupport.abilitiesTitle", { defaultValue: "Support abilities và build metadata" })}
          subtitle={t("shellSupport.abilitiesSubtitle", { defaultValue: "Giữ cùng một viewport cho auditor đọc support reach, enabled surfaces và metadata của lane hỗ trợ." })}
          actions={renderHealthStatusPill(health)}
        >
          {renderBuildMetaCard({ key: "support-build-meta", buildMeta })}
          <div key="support-system-routes">
            <h3 className={`${styles.itemTitle}`}>{t("shellSupport.systemRoutes", { defaultValue: "System routes" })}</h3>
            {renderValueList(systemRoutes, t("shellSupport.noSystemRoutes", { defaultValue: "Runtime hiện chưa mở route system nào." }), "support-system-routes")}
          </div>
          <div key="support-surfaces">
            <h3 className={`${styles.itemTitle}`}>{t("shellSupport.enabledSurfaces", { defaultValue: "Enabled surfaces" })}</h3>
            {renderValueList(enabledSurfaces, t("shellSupport.noSurfaces", { defaultValue: "Runtime chưa bật surface flag nào." }), "support-surfaces")}
          </div>
          {renderAbilityList({
            abilities: supportAbilities,
            emptyText: t("shellSupport.noAbilities", { defaultValue: "Runtime hiện chưa trả về ability hỗ trợ nào cho route này." }),
            keyPrefix: "support-ability",
          })}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
