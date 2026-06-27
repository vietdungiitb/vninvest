import { createElement, useEffect, useState, useMemo } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface ServiceItem {
  service_key: string;
  name: string;
  domain: string;
  status: string;
  is_active: boolean;
  avg_response_ms?: number;
  last_check_at?: string;
  config_domain?: string;
}

interface OverviewData {
  services: ServiceItem[];
  total?: number;
}

interface SocOverviewPanelProps {
  onChangeTab?: (tab: string) => void;
}

const ITEMS_PER_PAGE = 9;

const STATUS_LABEL_MAP: Record<string, string> = {
  healthy: "soc.health.status_healthy",
  degraded: "soc.health.status_degraded",
  unhealthy: "soc.health.status_critical",
  critical: "soc.health.status_critical",
  maintenance: "soc.health.status_maintenance",
};

const STATUS_COLOR_MAP: Record<string, string> = {
  healthy: "#34d399",
  degraded: "#fbbf24",
  unhealthy: "#f87171",
  critical: "#f87171",
  maintenance: "#38bdf8",
};

const DOMAIN_TAB_MAP: Record<string, string> = {
  prefetch: "prefetch",
  signals: "signals",
  vnbroker: "vnbroker",
  screener: "screener",
  dataops: "dataops",
  "runtime-kpi": "runtime-kpi",
  "dnse-backfill": "dnse-backfill",
};

export function SocOverviewPanel({ onChangeTab }: SocOverviewPanelProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocOverviewSummary: () => Promise<OverviewData>;
      };
      const result = await adapter.getSocOverviewSummary();
      setData(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load overview data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const services = data?.services ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services.filter((s) => {
      if (q && !s.service_key.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "healthy") return s.is_active && s.status === "healthy";
      if (statusFilter === "degraded") return s.is_active && s.status === "degraded";
      if (statusFilter === "critical") {
        return s.is_active && (s.status === "unhealthy" || s.status === "critical");
      }
      if (statusFilter === "disabled") return !s.is_active;
      return true;
    });
  }, [services, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const stats = useMemo(() => {
    const total = services.length;
    const healthy = services.filter((s) => s.is_active && s.status === "healthy").length;
    const degraded = services.filter((s) => s.is_active && s.status === "degraded").length;
    const critical = services.filter((s) => s.is_active && (s.status === "unhealthy" || s.status === "critical")).length;
    const unknown = services.filter((s) => s.is_active && !["healthy", "degraded", "unhealthy", "critical", "maintenance"].includes(s.status)).length;
    const disabled = services.filter((s) => !s.is_active).length;
    return { total, healthy, degraded, critical, unknown, disabled };
  }, [services]);

  const handleToggle = async (service: ServiceItem) => {
    const key = `toggle-${service.service_key}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        updateSocService: (key: string, payload: Record<string, unknown>) => Promise<unknown>;
      };
      await adapter.updateSocService(service.service_key, { is_active: !service.is_active });
      await fetchData();
    } catch {
      setError("Failed to toggle service.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleHealthCheck = async (service: ServiceItem) => {
    const key = `health-${service.service_key}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        triggerSocServiceHealthCheck: (key: string) => Promise<unknown>;
      };
      await adapter.triggerSocServiceHealthCheck(service.service_key);
      await fetchData();
    } catch {
      setError("Failed to trigger health check.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleConfigure = (service: ServiceItem) => {
    const domain = service.config_domain || service.domain;
    const tab = DOMAIN_TAB_MAP[domain] || null;
    if (tab && onChangeTab) {
      onChangeTab(tab);
    }
  };

  const getStatusLabel = (status: string, isActive: boolean): string => {
    if (!isActive) return t("soc.health.status_unknown");
    const key = STATUS_LABEL_MAP[status];
    return key ? t(key) : t("soc.health.status_unknown");
  };

  const getStatusColor = (status: string, isActive: boolean): string => {
    if (!isActive) return "#94a3b8";
    return STATUS_COLOR_MAP[status] || "#cbd5e1";
  };

  const filterButtons = [
    { key: "all", label: t("soc.overview.filter_all") },
    { key: "healthy", label: t("soc.overview.filter_healthy") },
    { key: "degraded", label: t("soc.overview.filter_degraded") },
    { key: "critical", label: t("soc.overview.filter_critical") },
    { key: "disabled", label: t("soc.overview.filter_disabled") },
  ];

  const renderMetricCard = (label: string, value: number, color: string) => {
    return createElement(
      "div",
      { className: styles.metricCard, key: label },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", {
        className: styles.metricValue,
        style: { color },
      }, String(value)),
    );
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    loading
      ? createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"))
      : error
        ? createElement("div", { className: styles.inlineError }, error)
        : createElement(
            "div",
            null,
            createElement(
              "div",
              { className: styles.metricGrid },
              renderMetricCard(t("soc.overview.total_services"), stats.total, "#f1f5f9"),
              renderMetricCard(t("soc.overview.healthy_count"), stats.healthy, "#34d399"),
              renderMetricCard(t("soc.overview.degraded_count"), stats.degraded, "#fbbf24"),
              renderMetricCard(t("soc.overview.critical_count"), stats.critical, "#f87171"),
              renderMetricCard(t("soc.overview.unknown_count"), stats.unknown, "#cbd5e1"),
              renderMetricCard(t("soc.overview.disabled_count"), stats.disabled, "#94a3b8"),
            ),
            createElement(
              "div",
              { className: styles.toolbar },
              createElement("input", {
                className: styles.searchInput,
                type: "text",
                placeholder: t("soc.overview.search_placeholder"),
                value: search,
                onChange: (e: { target: { value: string } }) => {
                  setSearch(e.target.value);
                  setPage(1);
                },
                style: { maxWidth: "320px" },
              }),
              createElement(
                "div",
                { style: { display: "flex", gap: "0.4rem", flexWrap: "wrap" } },
                ...filterButtons.map((btn) =>
                  createElement(
                    "button",
                    {
                      key: btn.key,
                      className: `${styles.filterBtn} ${statusFilter === btn.key ? styles.filterBtnActive : styles.filterBtnInactive}`,
                      onClick: () => {
                        setStatusFilter(btn.key);
                        setPage(1);
                      },
                    },
                    btn.label,
                  )
                ),
              ),
            ),
            createElement(
              "div",
              { className: styles.servicesGrid },
              ...paginated.map((service) => {
                const statusColor = getStatusColor(service.status, service.is_active);
                const statusLabel = getStatusLabel(service.status, service.is_active);
                const toggleKey = `toggle-${service.service_key}`;
                const healthKey = `health-${service.service_key}`;
                const isLoadingToggle = actionLoading[toggleKey];
                const isLoadingHealth = actionLoading[healthKey];
                const hasConfig = !!DOMAIN_TAB_MAP[service.config_domain || service.domain];

                return createElement(
                  "div",
                  {
                    key: service.service_key,
                    className: `${styles.serviceCard} ${!service.is_active ? styles.serviceCardInactive : ""}`,
                  },
                  createElement(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                    createElement(
                      "div",
                      null,
                      createElement("h4", { style: { margin: 0, fontWeight: 700, fontSize: "1rem" } }, service.name),
                      createElement("p", {
                        style: { margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" },
                      }, `${service.service_key} \u2022 ${service.domain}`),
                    ),
                    createElement(
                      "span",
                      {
                        className: styles.statusBadge,
                        style: { background: `${statusColor}20`, color: statusColor },
                      },
                      statusLabel,
                    ),
                  ),
                  createElement(
                    "div",
                    { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" } },
                    createElement(
                      "div",
                      { style: { background: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" } },
                      createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" } }, t("soc.health.latency_label")),
                      createElement("div", { style: { fontWeight: 600, fontSize: "0.9rem", marginTop: "0.15rem" } },
                        service.is_active && service.avg_response_ms != null
                          ? `${service.avg_response_ms.toFixed(0)}ms`
                          : t("soc.health.unknown_value"),
                      ),
                    ),
                    createElement(
                      "div",
                      { style: { background: "rgba(2, 11, 35, 0.4)", padding: "0.5rem 0.75rem", borderRadius: "8px" } },
                      createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" } }, t("soc.health.last_check_label")),
                      createElement("div", { style: { fontWeight: 500, fontSize: "0.8rem", marginTop: "0.15rem" } },
                        service.last_check_at
                          ? service.last_check_at.split("T")[1]?.slice(0, 8) || t("soc.health.unknown_value")
                          : t("soc.health.unknown_value"),
                      ),
                    ),
                  ),
                  createElement(
                    "div",
                    { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" } },
                    createElement(
                      "button",
                      {
                        className: styles.actionBtn,
                        disabled: isLoadingToggle,
                        onClick: () => handleToggle(service),
                        style: {
                          background: service.is_active ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                          color: service.is_active ? "#f87171" : "#34d399",
                        },
                      },
                      isLoadingToggle
                        ? t("soc.overview.loading_text")
                        : service.is_active
                          ? t("soc.overview.disable_service")
                          : t("soc.overview.enable_service"),
                    ),
                    createElement(
                      "button",
                      {
                        className: styles.actionBtn,
                        disabled: isLoadingHealth || !service.is_active,
                        onClick: () => handleHealthCheck(service),
                        style: { background: "rgba(0, 180, 216, 0.12)", color: "#22d3ee" },
                      },
                      isLoadingHealth
                        ? t("soc.overview.loading_text")
                        : t("soc.overview.run_health_check"),
                    ),
                    hasConfig
                      ? createElement(
                          "button",
                          {
                            className: styles.actionBtn,
                            onClick: () => handleConfigure(service),
                            style: { background: "rgba(251, 191, 36, 0.12)", color: "#fbbf24" },
                          },
                          t("soc.overview.configure_service"),
                        )
                      : null,
                  ),
                );
              }),
            ),
            totalPages > 1
              ? createElement(
                  "div",
                  { className: styles.pagination },
                  createElement(
                    "button",
                    {
                      className: styles.pageBtn,
                      disabled: safePage <= 1,
                      onClick: () => setPage(safePage - 1),
                    },
                    t("soc.overview.prev_page"),
                  ),
                  createElement(
                    "span",
                    { style: { fontSize: "0.8rem", color: "var(--text-muted)" } },
                    t("soc.overview.page_of", { page: String(safePage), total: String(totalPages) }),
                  ),
                  createElement(
                    "button",
                    {
                      className: styles.pageBtn,
                      disabled: safePage >= totalPages,
                      onClick: () => setPage(safePage + 1),
                    },
                    t("soc.overview.next_page"),
                  ),
                )
              : null,
          ),
  );
}
