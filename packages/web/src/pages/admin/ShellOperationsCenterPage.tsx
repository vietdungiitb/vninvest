import { useEffect, useState } from "react";
import {
  ShellPageChrome,
  ShellPanel,
  ShellMetric,
} from "../../components/ShellPageTemplate.js";
import {
  buildSurfaceFlags,
  buildVisibilityFlags,
  countFlagsByState,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  renderAbilityList,
  renderBuildMetaCard,
  renderFlagList,
  renderRefreshAction,
  renderSummaryCard,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

interface ShellOperationsCenterPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

interface SocService {
  service_key: string;
  name: string;
  domain: string;
  description?: string;
  is_active: boolean;
  status: string;
  avg_response_ms?: number;
  last_check_at?: string;
  [key: string]: unknown;
}

interface SocSummaryStats {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  inactive: number;
}

interface StatusBadgeStyle {
  bg: string;
  text: string;
  label: string;
}

interface SocOverviewData {
  services?: SocService[];
  [key: string]: unknown;
}

interface SocServiceConfigData {
  config_payload?: Record<string, unknown>;
  [key: string]: unknown;
}

interface FilterButtonDef {
  key: string;
  label: string;
  color: string;
}

const SOC_EDITABLE_DOMAINS = ["vnbroker", "prefetch", "signals", "screener"];

const FILTER_BUTTONS: FilterButtonDef[] = [
  { key: "all", label: "Tất cả", color: "var(--text-primary)" },
  { key: "healthy", label: "Hoạt động tốt", color: "#34d399" },
  { key: "degraded", label: "Suy giảm", color: "#fbbf24" },
  { key: "unhealthy", label: "Nguy cấp", color: "#f87171" },
  { key: "inactive", label: "Đã tắt", color: "#94a3b8" },
];

const STAT_BREAKDOWN_ITEMS = [
  { label: "Tổng dịch vụ", key: "total", color: "var(--text-primary)" as const },
  { label: "Hoạt động tốt", key: "healthy", color: "#34d399" as const },
  { label: "Suy giảm", key: "degraded", color: "#fbbf24" as const },
  { label: "Nguy cấp", key: "unhealthy", color: "#f87171" as const },
  { label: "Chưa rõ", key: "unknown", color: "#cbd5e1" as const },
  { label: "Đã tắt", key: "inactive", color: "#94a3b8" as const },
];

export function ShellOperationsCenterPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellOperationsCenterPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: "Không thể tải snapshot điều hành SOC từ core runtime.",
    refreshNotice: "Đã làm mới snapshot điều hành SOC từ core runtime.",
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

  const [services, setServices] = useState<SocService[]>([]);
  const [summary, setSummary] = useState<SocSummaryStats>({ total: 0, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0, inactive: 0 });
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");

  // States for administrative operations
  const [expandedServiceKey, setExpandedServiceKey] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState("");
  const [editingReason, setEditingReason] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [diagnosticsTab, setDiagnosticsTab] = useState("operator");
  const pageSize = 9;

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const fetchServices = async () => {
    setServicesLoading(true);
    try {
      const data = await (defaultCoreApiAdapter as unknown as { getSocOverviewSummary: () => Promise<SocOverviewData> }).getSocOverviewSummary();
      const servicesList: SocService[] = data.services || [];
      setServices(servicesList);

      const stats: SocSummaryStats = { total: servicesList.length, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0, inactive: 0 };
      servicesList.forEach((s) => {
        if (!s.is_active) {
          stats.inactive++;
        } else if (s.status === "healthy") {
          stats.healthy++;
        } else if (s.status === "degraded") {
          stats.degraded++;
        } else if (s.status === "unhealthy") {
          stats.unhealthy++;
        } else {
          stats.unknown++;
        }
      });
      setSummary(stats);
      setServicesError("");
    } catch (err) {
      console.error("Failed to fetch SOC services:", err);
      setServicesError(err instanceof Error ? err.message : (err as Record<string, string>).detail || "Không thể tải thông tin danh sách dịch vụ SOC.");
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [viewState.notice]);

  const handleToggleActive = async (serviceKey: string, currentActive: boolean) => {
    setActionLoading((prev) => ({ ...prev, [serviceKey]: true }));
    try {
      const nextActive = !currentActive;
      await (defaultCoreApiAdapter as unknown as { updateSocService: (key: string, data: { is_active: boolean }) => Promise<void> }).updateSocService(serviceKey, { is_active: nextActive });
      await fetchServices();
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : (err as Record<string, string>).detail || "Không thể cập nhật trạng thái."}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [serviceKey]: false }));
    }
  };

  const handleTriggerHealthCheck = async (serviceKey: string) => {
    setActionLoading((prev) => ({ ...prev, [serviceKey]: true }));
    try {
      await (defaultCoreApiAdapter as unknown as { triggerSocServiceHealthCheck: (key: string) => Promise<void> }).triggerSocServiceHealthCheck(serviceKey);
      alert("Đã kích hoạt yêu cầu thăm dò sức khỏe dịch vụ thủ công.");
      await fetchServices();
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : (err as Record<string, string>).detail || "Không thể trigger health check."}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [serviceKey]: false }));
    }
  };

  const handleOpenConfig = async (serviceKey: string) => {
    if (expandedServiceKey === serviceKey) {
      setExpandedServiceKey(null);
      return;
    }
    setActionLoading((prev) => ({ ...prev, [serviceKey]: true }));
    try {
      const data = await (defaultCoreApiAdapter as unknown as { getSocServiceConfig: (key: string) => Promise<SocServiceConfigData> }).getSocServiceConfig(serviceKey);
      setEditingConfig(JSON.stringify(data.config_payload || {}, null, 2));
      setEditingReason("");
      setExpandedServiceKey(serviceKey);
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : (err as Record<string, string>).detail || "Không thể tải cấu hình."}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [serviceKey]: false }));
    }
  };

  const handleSaveConfig = async (serviceKey: string) => {
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(editingConfig) as Record<string, unknown>;
    } catch {
      alert("Cấu hình phải là định dạng JSON hợp lệ.");
      return;
    }
    if (!editingReason.trim()) {
      alert("Vui lòng nhập lý do thay đổi cấu hình.");
      return;
    }
    setConfigSaving(true);
    try {
      await (defaultCoreApiAdapter as unknown as { applySocServiceConfig: (key: string, payload: Record<string, unknown>, reason: string) => Promise<void> }).applySocServiceConfig(serviceKey, parsedPayload, editingReason);
      alert("Đã cập nhật cấu hình thành công.");
      setExpandedServiceKey(null);
      await fetchServices();
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : (err as Record<string, string>).detail || "Không thể lưu cấu hình."}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetConfig = async (serviceKey: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn khôi phục cấu hình mặc định cho service này?")) {
      return;
    }
    setConfigSaving(true);
    try {
      await (defaultCoreApiAdapter as unknown as { resetSocServiceConfig: (key: string, reason: string) => Promise<void> }).resetSocServiceConfig(serviceKey, "Khôi phục cấu hình mặc định hệ thống từ giao diện SOC");
      alert("Đã khôi phục cấu hình mặc định thành công.");
      setExpandedServiceKey(null);
      await fetchServices();
    } catch (err) {
      alert(`Lỗi: ${err instanceof Error ? err.message : (err as Record<string, string>).detail || "Khôi phục cấu hình mặc định thất bại."}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const getStatusBadgeStyle = (service: SocService): StatusBadgeStyle => {
    if (!service.is_active) {
      return { bg: "rgba(100, 116, 139, 0.2)", text: "#94a3b8", label: "ĐÃ TẮT" };
    }
    switch (service.status) {
      case "healthy":
        return { bg: "rgba(16, 185, 129, 0.2)", text: "#34d399", label: "HOẠT ĐỘNG TỐT" };
      case "degraded":
        return { bg: "rgba(245, 158, 11, 0.2)", text: "#fbbf24", label: "SUY GIẢM" };
      case "unhealthy":
        return { bg: "rgba(239, 68, 68, 0.2)", text: "#f87171", label: "NGUY CẤP" };
      case "maintenance":
        return { bg: "rgba(14, 165, 233, 0.2)", text: "#38bdf8", label: "BẢO TRÌ" };
      default:
        return { bg: "rgba(148, 163, 184, 0.2)", text: "#cbd5e1", label: "CHƯA RÕ" };
    }
  };

  const operatorAbilities = filterAbilitiesBySubject(abilities, "admin");
  const operatorRoutes = filterVisibleRoutes(visibleRoutes, ["operations-center", "ai-command-center"]);
  const operatorFlags = buildSurfaceFlags(surfaces, [
    {
      key: "show_operations_center",
      label: "show_operations_center",
      detail: "Xác nhận shell có mở SOC operator surface thống nhất cho lane vận hành hay không.",
    },
    {
      key: "show_ai_command_center",
      label: "show_ai_command_center",
      detail: "Cho biết runtime đã sẵn sàng expose lane điều hành AI hay chưa.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem session operator hiện tại có đồng thời bật lane VIP hay không.",
    },
  ]);

  const metrics = [
    <ShellMetric key="build-target" label="Build target" value={buildMeta?.target || capabilities?.build?.target || "n/a"} />,
    <ShellMetric key="operator-routes" label="Operator routes" value={String(operatorRoutes.length)} />,
    <ShellMetric key="soc-flags-on" label="SOC flags ON" value={String(countFlagsByState(operatorFlags, "ON"))} />,
    <ShellMetric key="active-services" label="Active Services" value={`${summary.total - summary.inactive}/${summary.total}`} />,
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "operator-session",
      title: "SOC operator identity hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Staff", value: identity.is_staff ? "Có" : "Không" },
        { label: "Superuser", value: identity.is_superuser ? "Có" : "Không" },
      ],
    }),
    renderSummaryCard({
      key: "operator-runtime",
      title: "SOC runtime snapshot",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "admin",
    activeDetail: "Đây là group gating chính cho lane operator surfaces.",
    visibleDetail: "Group này vẫn đi cùng session operator hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(operatorRoutes, {
    activeItem: "operations-center",
    activeDetail: "Đây là route SOC chính đang dẫn cho operator shell.",
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong navigation hiện tại.",
  });

  const renderServiceCard = (service: SocService) => {
    const badge = getStatusBadgeStyle(service);
    const isExpanded = expandedServiceKey === service.service_key;
    const isLoading = actionLoading[service.service_key] || false;

    const isEditableDomain = SOC_EDITABLE_DOMAINS.includes(service.domain);

    return (
      <div
        key={service.service_key}
        className="service-card"
        style={{
          padding: "1.25rem",
          borderRadius: "12px",
          border: service.is_active ? "1px solid var(--border-default)" : "1px solid rgba(148, 163, 184, 0.15)",
          backgroundColor: service.is_active ? "var(--bg-panel-soft)" : "rgba(15, 23, 42, 0.4)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          transition: "all 0.2s ease",
          opacity: service.is_active ? 1 : 0.75,
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
          <div>
            <h4 style={{ fontWeight: "700", fontSize: "1.05rem", color: "var(--text-primary)", margin: 0 }}>{service.name}</h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>
              {`${service.service_key} • ${service.domain}`}
            </p>
          </div>
          <span
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              fontSize: "0.7rem",
              fontWeight: "700",
              backgroundColor: badge.bg,
              color: badge.text,
              letterSpacing: "0.05em",
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Stats metrics inside the card */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div style={{ backgroundColor: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Độ trễ</div>
            <div style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--text-primary)", marginTop: "0.15rem" }}>
              {service.is_active && service.avg_response_ms !== null ? `${service.avg_response_ms!.toFixed(0)}ms` : "Chưa có"}
            </div>
          </div>
          <div style={{ backgroundColor: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Lần cuối kiểm tra</div>
            <div
              style={{
                fontWeight: "500",
                fontSize: "0.8rem",
                color: "var(--text-primary)",
                marginTop: "0.15rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={service.last_check_at || "Chưa có"}
            >
              {service.last_check_at ? service.last_check_at.split("T")[1]?.slice(0, 8) || "Đã kiểm tra" : "Chưa có"}
            </div>
          </div>
        </div>

        {/* Action buttons row */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", flexWrap: "wrap" }}>
          {/* Toggle Switch button */}
          <button
            onClick={() => handleToggleActive(service.service_key, service.is_active)}
            disabled={isLoading}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: "600",
              cursor: isLoading ? "not-allowed" : "pointer",
              border: "1px solid transparent",
              backgroundColor: service.is_active ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
              color: service.is_active ? "#f87171" : "#34d399",
              flex: 1,
              transition: "all 0.15s",
            }}
          >
            {isLoading ? "Đang xử lý..." : service.is_active ? "Tắt Dịch Vụ" : "Bật Dịch Vụ"}
          </button>

          {/* Trigger health check button */}
          <button
            onClick={() => handleTriggerHealthCheck(service.service_key)}
            disabled={!service.is_active || isLoading}
            style={{
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: "600",
              cursor: !service.is_active || isLoading ? "not-allowed" : "pointer",
              backgroundColor: "rgba(18, 199, 232, 0.12)",
              color: "var(--accent-cyan)",
              border: "1px solid transparent",
              opacity: service.is_active ? 1 : 0.5,
              transition: "all 0.15s",
            }}
            title="Chạy thử manual health check"
          >
            Chạy Thử
          </button>

          {/* Edit config button (only for writable domains) */}
          {isEditableDomain ? (
            <button
              onClick={() => handleOpenConfig(service.service_key)}
              disabled={!service.is_active || isLoading}
              style={{
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: "600",
                cursor: !service.is_active || isLoading ? "not-allowed" : "pointer",
                backgroundColor: "rgba(255, 191, 77, 0.12)",
                color: "var(--accent-amber)",
                border: "1px solid transparent",
                opacity: service.is_active ? 1 : 0.5,
                transition: "all 0.15s",
              }}
            >
              {isExpanded ? "Đóng" : "Cấu Hình"}
            </button>
          ) : null}
        </div>

        {/* Expanded area for JSON editing */}
        {isExpanded ? (
          <div
            style={{
              borderTop: "1px solid rgba(80, 120, 168, 0.2)",
              paddingTop: "0.75rem",
              marginTop: "0.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--text-secondary)" }}>JSON Payload Cấu Hình:</label>
            <textarea
              value={editingConfig}
              onChange={(e) => setEditingConfig(e.target.value)}
              disabled={configSaving}
              rows={8}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                backgroundColor: "rgba(2, 11, 35, 0.6)",
                color: "#67e8f9",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <label style={{ fontSize: "0.7rem", fontWeight: "600", color: "var(--text-secondary)" }}>Lý do thay đổi (bắt buộc):</label>
            <input
              type="text"
              value={editingReason}
              onChange={(e) => setEditingReason(e.target.value)}
              disabled={configSaving}
              placeholder="Nhập lý do áp dụng cấu hình này..."
              style={{
                width: "100%",
                padding: "0.4rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--border-default)",
                backgroundColor: "rgba(2, 11, 35, 0.6)",
                color: "var(--text-primary)",
                boxSizing: "border-box",
              }}
            />
            {/* Edit actions: Save, Reset, Cancel */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
              <button
                onClick={() => handleSaveConfig(service.service_key)}
                disabled={configSaving}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  cursor: configSaving ? "not-allowed" : "pointer",
                  backgroundColor: "rgba(22, 215, 160, 0.2)",
                  color: "var(--accent-emerald)",
                  border: "none",
                }}
              >
                {configSaving ? "Đang Lưu..." : "Lưu Cấu Hình"}
              </button>
              <button
                onClick={() => handleResetConfig(service.service_key)}
                disabled={configSaving}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  cursor: configSaving ? "not-allowed" : "pointer",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "none",
                }}
              >
                Khôi Phục Mặc Định
              </button>
              <button
                onClick={() => setExpandedServiceKey(null)}
                disabled={configSaving}
                style={{
                  padding: "0.35rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.7rem",
                  fontWeight: "600",
                  cursor: configSaving ? "not-allowed" : "pointer",
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: "#cbd5e1",
                  border: "none",
                  marginLeft: "auto",
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const filteredServices = services.filter((service) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      (service.name || "").toLowerCase().includes(term) ||
      (service.service_key || "").toLowerCase().includes(term) ||
      (service.domain || "").toLowerCase().includes(term) ||
      (service.description || "").toLowerCase().includes(term);

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "inactive") return matchesSearch && !service.is_active;
    if (!service.is_active) return false;
    return matchesSearch && service.status === statusFilter;
  });

  const totalItems = filteredServices.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedServices = filteredServices.slice(startIndex, startIndex + pageSize);

  return (
    <ShellPageChrome
      eyebrow="Service Operations Center"
      title="Trung tâm SOC shell"
      description="Trang điều hành trung tâm điều hành dịch vụ (SOC) của core shell bám đúng surface flags, danh sách dịch vụ và quyền vận hành có cấu hình bật/tắt và reset config trực tiếp."
      badge={
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ lane SOC" : "Lane SOC sẵn sàng cho kiểm tra"}
        </div>
      }
      metrics={metrics}
      notice={viewState.notice}
      error={viewState.error || servicesError}
    >
      <div className="shellPage__stack" style={{ width: "100%", gap: "1.5rem" }}>
        {/* 1. Full-Width Service Monitoring & Administration Panel */}
        <ShellPanel
          title="Giám sát & Quản trị Dịch vụ SOC"
          subtitle="Bảng điều khiển trạng thái bật/tắt, kích hoạt health probe và live-configuration cho 23+ baseline service."
        >
          {/* Status breakdown box grid (6 columns on desktop) */}
          <div
            key="stats-breakdown"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            {STAT_BREAKDOWN_ITEMS.map((stat) => (
              <div
                key={stat.key}
                style={{
                  backgroundColor: "rgba(8, 23, 52, 0.4)",
                  border: "1px solid var(--border-default)",
                  padding: "0.75rem 0.5rem",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{stat.label}</div>
                <div style={{ fontWeight: "700", fontSize: "1.2rem", color: stat.color, marginTop: "0.25rem" }}>
                  {summary[stat.key as keyof SocSummaryStats]}
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filter controls */}
          <div
            key="services-filter-bar"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "1.25rem",
              padding: "0.75rem",
              borderRadius: "8px",
              backgroundColor: "rgba(15, 23, 42, 0.3)",
              border: "1px solid var(--border-default)",
            }}
          >
            {/* Left side: Status filters */}
            <div key="status-filters" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {FILTER_BUTTONS.map((btn) => {
                const isActive = statusFilter === btn.key;
                return (
                  <button
                    key={btn.key}
                    onClick={() => handleFilterChange(btn.key)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      border: "1px solid transparent",
                      backgroundColor: isActive ? "rgba(0, 180, 216, 0.18)" : "rgba(30, 41, 59, 0.5)",
                      color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                      transition: "all 0.15s",
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* Right side: Search Input */}
            <div key="search-input-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", maxWidth: "320px" }}>
              <input
                type="text"
                placeholder="Tìm kiếm dịch vụ theo tên, key..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-default)",
                  backgroundColor: "rgba(2, 11, 35, 0.6)",
                  color: "var(--text-primary)",
                  fontSize: "0.8rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Loading indicator */}
          {servicesLoading && services.length === 0
            ? <p key="services-loading" style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>Đang tải danh sách dịch vụ...</p>
            : null}

          {/* Services Grid list (3 columns on desktop, natural page flow) */}
          <div
            key="services-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.25rem",
              marginTop: "0.75rem",
            }}
          >
            {paginatedServices.map((service) => renderServiceCard(service))}
          </div>

          {/* Pagination controls (only if totalPages > 1) */}
          {totalPages > 1 ? (
            <div
              key="pagination-controls"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "1.25rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border-default)",
              }}
            >
              <button
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: activePage === 1 ? "not-allowed" : "pointer",
                  border: "none",
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: activePage === 1 ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
                }}
              >
                {'<<'}
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={activePage === 1}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: activePage === 1 ? "not-allowed" : "pointer",
                  border: "none",
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: activePage === 1 ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
                }}
              >
                {'<'}
              </button>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  margin: "0 0.5rem",
                }}
              >
                {`Trang ${activePage} / ${totalPages} (${totalItems} dịch vụ)`}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={activePage === totalPages}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: activePage === totalPages ? "not-allowed" : "pointer",
                  border: "none",
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: activePage === totalPages ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
                }}
              >
                {'>'}
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage === totalPages}
                style={{
                  padding: "0.35rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: activePage === totalPages ? "not-allowed" : "pointer",
                  border: "none",
                  backgroundColor: "rgba(100, 116, 139, 0.15)",
                  color: activePage === totalPages ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
                }}
              >
                {'>>'}
              </button>
            </div>
          ) : null}
        </ShellPanel>

        {/* 2. Consolidated Tabbed Diagnostics Panel at the bottom */}
        <ShellPanel
          title="Bảng Điều Hành & Diagnostics Kỹ Thuật"
          subtitle="Đọc trạng thái identity, routing, surface flags, và các quyền vận hành chi tiết."
          actions={renderRefreshAction({ onClick: handleRefresh, disabled: viewState.loading })}
        >
          {/* Tab bar */}
          <div
            key="diag-tabs"
            style={{
              display: "flex",
              gap: "0.5rem",
              borderBottom: "1px solid var(--border-default)",
              paddingBottom: "0.75rem",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { key: "operator", label: "Tổng quan Operator & Công cụ" },
              { key: "abilities", label: "Flags & Quyền hạn" },
              { key: "routes", label: "Đường dẫn & Nhóm điều hướng" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDiagnosticsTab(tab.key)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "1px solid transparent",
                  backgroundColor: diagnosticsTab === tab.key ? "rgba(0, 180, 216, 0.15)" : "transparent",
                  color: diagnosticsTab === tab.key ? "var(--accent-cyan)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content: Operator */}
          {diagnosticsTab === "operator" ? (
            <div key="tab-operator" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              <div key="sub-snapshot" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.25rem 0", color: "var(--text-primary)" }}>Snapshot operator và runtime</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {summaryCards}
                </div>
              </div>
              <div key="sub-build" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.25rem 0", color: "var(--text-primary)" }}>Metadata hệ thống</h3>
                {renderBuildMetaCard({ key: "operator-build-meta-tab", buildMeta })}
              </div>
              <div key="sub-tools" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.25rem 0", color: "var(--text-primary)" }}>Công cụ quản trị SOC</h3>
                <article className="shellPage__surfaceCard" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 className="shellPage__itemTitle">Quản trị SMTP / Mail</h3>
                  <a
                    href="/operations-center/mail-config"
                    style={{
                      fontWeight: 600,
                      color: "var(--accent-cyan)",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      lineHeight: "1.4",
                      display: "inline-block",
                    }}
                  >
                    Quản trị Mail Vận Hành →
                  </a>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
                    Cấu hình hộp thư gửi thông báo hệ thống (SMTP / Gmail API) phục vụ công tác giám sát, cảnh báo.
                  </p>
                </article>
              </div>
            </div>
          ) : null}

          {/* Tab Content: Abilities */}
          {diagnosticsTab === "abilities" ? (
            <div key="tab-abilities" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              <div key="sub-flags" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Surface flags</h3>
                {renderFlagList(operatorFlags, "Runtime chưa công bố surface flag nào.", "operator-flags")}
              </div>
              <div key="sub-abilities" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Operator abilities</h3>
                {renderAbilityList({
                  abilities: operatorAbilities,
                  emptyText: "Runtime hiện chưa trả về operator ability nào cho route này.",
                  keyPrefix: "operator-ability",
                  getPill: (ability: { subject: string }) => ability.subject,
                  getDetail: (ability: { action: string }) => `Action: ${ability.action}`,
                })}
              </div>
            </div>
          ) : null}

          {/* Tab Content: Routes */}
          {diagnosticsTab === "routes" ? (
            <div key="tab-routes" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              <div key="sub-groups" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Visible groups</h3>
                {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "operator-groups")}
              </div>
              <div key="sub-routes" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>Operator routes</h3>
                {renderFlagList(routeFlags, "Runtime hiện chưa expose SOC route nào cho session này.", "operator-routes")}
              </div>
            </div>
          ) : null}
        </ShellPanel>
      </div>
    </ShellPageChrome>
  );
}
