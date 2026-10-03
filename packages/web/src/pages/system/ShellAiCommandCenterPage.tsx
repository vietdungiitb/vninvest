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
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
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
      key: "show_operations_center",
      label: "show_operations_center",
      detail: "Cho biết lane SOC có đồng thời bật để phối hợp với control center AI hay không.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem shell AI hiện tại có đang nằm trong build target VIP hay không.",
    },
  ]);
  const aiAbilities = filterAbilitiesBySubject(abilities, "ai");

  const fetchRef = useRef(fetchImpl);
  fetchRef.current = fetchImpl;

  const transport: AICommandCenterTransport = {
    getConfig: async () => {
      const impl = fetchRef.current;
      if (!impl) throw new Error("Không thể tải cấu hình AI từ core runtime.");
      const res = await impl("/core/v1/workspace/ai-command-center/");
      if (!res.ok) throw new Error("Không thể tải cấu hình AI từ core runtime.");
      return (await res.json()) as AISettings;
    },
    updateConfig: async (payload) => {
      const impl = fetchRef.current;
      if (!impl) throw new Error("Lỗi kết nối khi lưu cấu hình.");
      const res = await impl("/core/v1/workspace/ai-command-center/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Lỗi khi lưu cấu hình AI.");
      }
      return (await res.json()) as AISettings;
    },
    testConnection: async (payload) => {
      const impl = fetchRef.current;
      if (!impl) throw new Error("Lỗi mạng khi thử nghiệm kết nối.");
      const res = await impl("/core/v1/workspace/ai-command-center/test-connection/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: data.message || "Kết nối thất bại." };
      }
      return { ok: true, message: data.message || "Kết nối thành công!", ...data };
    },
  };

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("AI Provider", "…"),
    renderShellMetric("AI Model", "…"),
    renderShellMetric("Runtime Ready", "…"),
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
    activeItem: "ai-command-center",
    activeDetail: "Đây là route AI command center chính đang được shell mở cho session hiện tại.",
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong shell hiện tại.",
  });

  return (
    <ShellPageChrome
      eyebrow="Core AI command center"
      title="Trung tâm điều hành AI shell"
      description="Trang này cho phép cấu hình Nhà cung cấp AI và Mô hình AI tương ứng trực tiếp cho core runtime, kết nối đồng bộ an toàn qua SaaS-native endpoints."
      badge={(
        <div className={`${styles.heroBadge}`}>
          <span className={`${styles.statusDot}`} />
          {viewState.loading ? "Đang đồng bộ..." : "Sẵn sàng hoạt động"}
        </div>
      )}
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error}
    >
      <section className={`${styles.bodyGrid}`}>
        <div className={`${styles.stack}`}>
          <ShellPanel
            title="Cấu hình AI Runtime"
            subtitle="Thiết lập nhà cung cấp AI, lựa chọn mô hình và API key an toàn."
            actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading, label: "Làm mới form" })}
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
            title="Snapshot operator và runtime"
            subtitle="Đọc nhanh session, build meta và runtime health trước khi nối các control AI thật vào page này."
          >
            <section className={`${styles.summaryGrid}`}>
              {summaryCards}
            </section>
          </ShellPanel>
        </div>

        <ShellPanel
          title="Surface flags và AI abilities"
          subtitle="Giữ cùng một viewport cho auditor đọc tình trạng flag AI, route exposure và quyền liên quan."
          actions={renderHealthStatusPill(health)}
        >
          <div key="ai-groups-block">
            <h3 className={`${styles.itemTitle}`}>AI Groups & Routes</h3>
            {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-groups")}
            <div className="h-2.5" />
            {renderFlagList(routeFlags, "Runtime hiện chưa expose route AI nào.", "ai-routes")}
          </div>
          {renderFlagList(aiFlags, "Runtime chưa công bố surface flag AI nào.", "ai-flags")}
          {renderBuildMetaCard({ key: "ai-build-meta", buildMeta })}
          {renderAbilityList({
            abilities: aiAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI lane nào cho route này.",
            keyPrefix: "ai-ability",
          })}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
