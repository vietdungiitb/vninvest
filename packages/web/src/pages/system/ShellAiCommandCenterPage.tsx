import styles from "../../components/ShellPageTemplate.module.css";
import { useRef } from "react";
import {
  ShellPageChrome,
  ShellPanel,
  renderShellMetric,
} from "../../components/ShellPageTemplate.js";
import {
  buildSurfaceFlags,
  buildVisibilityFlags,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  renderAbilityList,
  renderBuildMetaCard,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";
import {
  AICommandCenterForm,
  AISettings,
  AICommandCenterTransport,
} from "../../components/AICommandCenterForm.js";
import { createTranslator } from "../../i18n/index.js";
import { useI18n } from "../../context/LangContext.js";

interface ShellAiCommandCenterPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const shellT = createTranslator("vi");

export function ShellAiCommandCenterPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellAiCommandCenterPageProps) {
  const { t } = useI18n();
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: t("shellAiCommandCenter.fallbackError", { defaultValue: "Không thể tải snapshot điều hành AI từ core runtime." }),
    refreshNotice: t("shellAiCommandCenter.refreshNotice", { defaultValue: "Đã làm mới snapshot điều hành AI từ core runtime." }),
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
      detail: t("shellAiCommandCenter.flagCommandCenter", { defaultValue: "Flag chính xác nhận runtime đang mở lane điều hành AI cho shell hiện tại." }),
    },
    {
      key: "show_operations_center",
      label: "show_operations_center",
      detail: t("shellAiCommandCenter.flagOperationsCenter", { defaultValue: "Cho biết lane SOC có đồng thời bật để phối hợp với control center AI hay không." }),
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: t("shellAiCommandCenter.flagVipShell", { defaultValue: "Dùng để đối chiếu xem shell AI hiện tại có đang nằm trong build target VIP hay không." }),
    },
  ]);
  const aiAbilities = filterAbilitiesBySubject(abilities, "ai");

  const fetchRef = useRef(fetchImpl);
  fetchRef.current = fetchImpl;

  const transport: AICommandCenterTransport = {
    getConfig: async () => {
      const impl = fetchRef.current;
      if (!impl) throw new Error(t("shellAiCommandCenter.loadConfigError", { defaultValue: "Không thể tải cấu hình AI từ core runtime." }));
      const res = await impl("/core/v1/workspace/ai-command-center/");
      if (!res.ok) throw new Error(t("shellAiCommandCenter.loadConfigError", { defaultValue: "Không thể tải cấu hình AI từ core runtime." }));
      return (await res.json()) as AISettings;
    },
    updateConfig: async (payload) => {
      const impl = fetchRef.current;
      if (!impl) throw new Error(t("shellAiCommandCenter.saveConnectError", { defaultValue: "Lỗi kết nối khi lưu cấu hình." }));
      const res = await impl("/core/v1/workspace/ai-command-center/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || t("shellAiCommandCenter.saveConfigError", { defaultValue: "Lỗi khi lưu cấu hình AI." }));
      }
      return (await res.json()) as AISettings;
    },
    testConnection: async (payload) => {
      const impl = fetchRef.current;
      if (!impl) throw new Error(t("shellAiCommandCenter.testNetworkError", { defaultValue: "Lỗi mạng khi thử nghiệm kết nối." }));
      const res = await impl("/core/v1/workspace/ai-command-center/test-connection/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data.message || t("shellAiCommandCenter.testFailed", { defaultValue: "Kết nối thất bại." }) };
      }
      return { ok: true, message: data.message || t("shellAiCommandCenter.testSuccess", { defaultValue: "Kết nối thành công!" }), ...data };
    },
  };

  const metrics = [
    renderShellMetric(t("shellAiCommandCenter.metricBuildTarget", { defaultValue: "Build target" }), buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("AI Provider", "…"),
    renderShellMetric("AI Model", "…"),
    renderShellMetric("Runtime Ready", "…"),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-session",
      title: t("shellAiCommandCenter.sessionTitle", { defaultValue: "Operator và session hiện tại" }),
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || t("shellAiCommandCenter.empty", { defaultValue: "Chưa có" }) },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
        { label: "Session ID", value: session?.session_id || t("shellAiCommandCenter.empty", { defaultValue: "Chưa có" }) },
      ],
    }),
    renderSummaryCard({
      key: "ai-runtime",
      title: t("shellAiCommandCenter.runtimeTitle", { defaultValue: "Core runtime và adapter" }),
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "system",
    activeDetail: t("shellAiCommandCenter.groupActiveDetail", { defaultValue: "Đây là group gating chính chứa route AI command center." }),
    visibleDetail: t("shellAiCommandCenter.groupVisibleDetail", { defaultValue: "Group này vẫn đi cùng session AI hiện tại." }),
  });

  const routeFlags = buildVisibilityFlags(aiRoutes, {
    activeItem: "ai-command-center",
    activeDetail: t("shellAiCommandCenter.routeActiveDetail", { defaultValue: "Đây là route AI command center chính đang được shell mở cho session hiện tại." }),
    visibleDetail: t("shellAiCommandCenter.routeVisibleDetail", { defaultValue: "Route này đang được runtime cho phép xuất hiện trong shell hiện tại." }),
  });

  return (
    <ShellPageChrome
      eyebrow={t("shellAiCommandCenter.eyebrow", { defaultValue: "Core AI command center" })}
      title={t("shellAiCommandCenter.title", { defaultValue: "Trung tâm điều hành AI shell" })}
      description={t("shellAiCommandCenter.description", { defaultValue: "Trang này cho phép cấu hình Nhà cung cấp AI và Mô hình AI tương ứng trực tiếp cho core runtime, kết nối đồng bộ an toàn qua SaaS-native endpoints." })}
      badge={(
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading ? t("shellAiCommandCenter.syncing", { defaultValue: "Đang đồng bộ..." }) : t("shellAiCommandCenter.ready", { defaultValue: "Sẵn sàng hoạt động" })}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title={t("shellAiCommandCenter.configTitle", { defaultValue: "Cấu hình AI Runtime" })}
            subtitle={t("shellAiCommandCenter.configSubtitle", { defaultValue: "Thiết lập nhà cung cấp AI, lựa chọn mô hình và API key an toàn." })}
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading, label: t("shellAiCommandCenter.refreshForm", { defaultValue: "Làm mới form" }) })}
          >
            {/* F8: shared form — 0 field drift vs AICommandCenterPage */}
            <AICommandCenterForm
              transport={transport}
              t={shellT}
              localeTag="vi-VN"
              showRefreshButton={false}
              showPromptConfigButton={false}
              onSettingsSaved={() => handleRefresh()}
            />
          </ShellPanel>

          <ShellPanel
            title={t("shellAiCommandCenter.snapshotTitle", { defaultValue: "Snapshot operator và runtime" })}
            subtitle={t("shellAiCommandCenter.snapshotSubtitle", { defaultValue: "Đọc nhanh session, build meta và runtime health trước khi nối các control AI thật vào page này." })}
          >
            <section className={`${styles.summaryGrid}`}>
              {summaryCards}
            </section>
          </ShellPanel>
        </div>

        <ShellPanel
          title={t("shellAiCommandCenter.flagsTitle", { defaultValue: "Surface flags và AI abilities" })}
          subtitle={t("shellAiCommandCenter.flagsSubtitle", { defaultValue: "Giữ cùng một viewport cho auditor đọc tình trạng flag AI, route exposure và quyền liên quan." })}
          actions={renderHealthStatusPill(health)}
        >
          <div key="ai-groups-block">
            <h3 className={`${styles.itemTitle}`}>{t("shellAiCommandCenter.aiGroupsRoutes", { defaultValue: "AI Groups & Routes" })}</h3>
            {renderFlagList(groupFlags, t("shellAiCommandCenter.noGroups", { defaultValue: "Session hiện chưa mở group điều hướng nào." }), "ai-groups")}
            <div className="h-2.5" />
            {renderFlagList(routeFlags, t("shellAiCommandCenter.noAiRoutes", { defaultValue: "Runtime hiện chưa expose route AI nào." }), "ai-routes")}
          </div>
          {renderFlagList(aiFlags, t("shellAiCommandCenter.noAiFlags", { defaultValue: "Runtime chưa công bố surface flag AI nào." }), "ai-flags")}
          {renderBuildMetaCard({ key: "ai-build-meta", buildMeta })}
          {renderAbilityList({
            abilities: aiAbilities,
            emptyText: t("shellAiCommandCenter.noAbilities", { defaultValue: "Runtime hiện chưa trả về ability AI lane nào cho route này." }),
            keyPrefix: "ai-ability",
          })}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
