import styles from "../../components/ShellPageTemplate.module.css";
import { useI18n } from "../../context/LangContext.js";
import {
  ShellPageChrome,
  ShellPanel,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import {
  deriveCoreShellSnapshot,
  getEnabledSurfaceKeys,
  renderAbilityList,
  renderBuildMetaCard,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  renderValueList,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

interface ShellSettingsPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function ShellSettingsPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellSettingsPageProps) {
  const { t } = useI18n();
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: t("shellSettings.fallbackError", { defaultValue: "Không thể tải snapshot cấu hình shell từ core runtime." }),
    refreshNotice: t("shellSettings.refreshNotice", { defaultValue: "Đã làm mới snapshot cấu hình shell từ core runtime." }),
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
    renderShellMetric(t("shellSettings.metricBuildTarget", { defaultValue: "Build target" }), buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric(t("shellSettings.metricCurrentPlan", { defaultValue: "Gói hiện tại" }), capabilities?.build?.plan || "n/a"),
    renderShellMetric(t("shellSettings.metricVisibleRoutes", { defaultValue: "Route nhìn thấy" }), String(visibleRoutes.length)),
    renderShellMetric(t("shellSettings.metricActiveAbilities", { defaultValue: "Ability active" }), String(abilities.length)),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "session",
      title: t("shellSettings.sessionTitle", { defaultValue: "Phiên shell hiện tại" }),
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || t("shellSettings.empty", { defaultValue: "Chưa có" }) },
        { label: "Session ID", value: session?.session_id || t("shellSettings.empty", { defaultValue: "Chưa có" }) },
        { label: "Email", value: identity.email || t("shellSettings.empty", { defaultValue: "Chưa có" }) },
      ],
    }),
    renderSummaryCard({
      key: "runtime",
      title: t("shellSettings.runtimeTitle", { defaultValue: "Runtime và adapter" }),
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  return (
    <ShellPageChrome
      eyebrow={t("shellSettings.eyebrow", { defaultValue: "Core shell settings" })}
      title={t("shellSettings.title", { defaultValue: "Thiết lập shell và quyền truy cập" })}
      description={t("shellSettings.description", { defaultValue: "Trang này xác nhận shell core đang nhận đúng health, build meta, session, navigation và surface flags trước khi các route hệ thống sâu hơn được dựng tiếp." })}
      badge={(
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading ? t("shellSettings.syncing", { defaultValue: "Đang đồng bộ core runtime" }) : t("shellSettings.ready", { defaultValue: "Core runtime sẵn sàng cho kiểm tra" })}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title={t("shellSettings.snapshotTitle", { defaultValue: "Snapshot runtime hiện tại" })}
            subtitle={t("shellSettings.snapshotSubtitle", { defaultValue: "Đọc nhanh tình trạng phiên, môi trường và adapter đang được shell core sử dụng." })}
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
          >
            <section className={`${styles.summaryGrid}`}>
              {summaryCards}
            </section>
          </ShellPanel>
          <ShellPanel
            title={t("shellSettings.navTitle", { defaultValue: "Nhóm điều hướng và surface flags" })}
            subtitle={t("shellSettings.navSubtitle", { defaultValue: "Cho phép kiểm tra nhanh gating hiện hành của system/workspace/admin trước khi page hệ thống thật được nối vào shell." })}
          >
            <div key="visible-groups-block">
              <h3 className={`${styles.itemTitle}`}>{t("shellSettings.visibleGroups", { defaultValue: "Visible groups" })}</h3>
              {renderValueList(visibleGroups, t("shellSettings.noGroups", { defaultValue: "Chưa có navigation group nào được mở." }), "groups")}
            </div>
            <div key="visible-routes-block">
              <h3 className={`${styles.itemTitle}`}>{t("shellSettings.visibleRoutes", { defaultValue: "Visible routes" })}</h3>
              {renderValueList(visibleRoutes, t("shellSettings.noRoutes", { defaultValue: "Chưa có route nào được mở." }), "routes")}
            </div>
            <div key="surfaces-block">
              <h3 className={`${styles.itemTitle}`}>{t("shellSettings.enabledSurfaces", { defaultValue: "Enabled surfaces" })}</h3>
              {renderValueList(enabledSurfaces, t("shellSettings.noSurfaces", { defaultValue: "Runtime chưa bật surface flag nào." }), "surfaces")}
            </div>
          </ShellPanel>
        </div>
        <ShellPanel
          title={t("shellSettings.abilityTitle", { defaultValue: "Ability map và build metadata" })}
          subtitle={t("shellSettings.abilitySubtitle", { defaultValue: "Giữ cùng một viewport cho auditor đọc plan, abilities và metadata mà không cần rời khỏi route settings." })}
          actions={renderHealthStatusPill(health)}
        >
          {renderBuildMetaCard({ key: "build-meta-card", buildMeta })}
          {renderAbilityList({
            abilities,
            emptyText: t("shellSettings.noAbilities", { defaultValue: "Runtime hiện chưa trả về ability nào cho shell page này." }),
          })}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
