import { createElement, useEffect, useState, useMemo } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor, getStatusBadgeStyle } from "./socStatusColors.js";
import { LucideIcon } from "../ui/lucide-icon.js";
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

const DOMAIN_TAB_MAP: Record<string, string> = {
  prefetch: "prefetch",
  signals: "signals",
  vnbroker: "vnbroker",
  screener: "screener",
  dataops: "dataops",
  "runtime-kpi": "runtime-kpi",
  "dnse-backfill": "dnse-backfill",
};

const METRIC_DEFS = [
  { key: "total", icon: "Server", colorVar: "--soc-c-f1f5f9" },
  { key: "healthy", icon: "CheckCircle", colorVar: "--soc-c-34d399" },
  { key: "degraded", icon: "AlertTriangle", colorVar: "--soc-c-fbbf24" },
  { key: "critical", icon: "XCircle", colorVar: "--soc-c-f87171" },
  { key: "unknown", icon: "HelpCircle", colorVar: "--soc-c-94a3b8" },
  { key: "disabled", icon: "PowerOff", colorVar: "--soc-c-64748b" },
] as const;

const METRIC_LABEL_KEYS: Record<string, string> = {
  total: "soc.overview.total_services",
  healthy: "soc.overview.healthy_count",
  degraded: "soc.overview.degraded_count",
  critical: "soc.overview.critical_count",
  unknown: "soc.overview.unknown_count",
  disabled: "soc.overview.disabled_count",
};

const METRIC_COLORS: Record<string, string> = {
  total: "#f1f5f9",
  healthy: "#34d399",
  degraded: "#fbbf24",
  critical: "#f87171",
  unknown: "#94a3b8",
  disabled: "#64748b",
};

const METRIC_BORDER_COLORS: Record<string, string> = {
  total: "rgba(241,245,249,0.4)",
  healthy: "rgba(52,211,153,0.6)",
  degraded: "rgba(251,191,36,0.6)",
  critical: "rgba(248,113,113,0.6)",
  unknown: "rgba(148,163,184,0.4)",
  disabled: "rgba(100,116,139,0.4)",
};

const METRIC_ICON_BG: Record<string, string> = {
  total: "rgba(241,245,249,0.08)",
  healthy: "rgba(52,211,153,0.12)",
  degraded: "rgba(251,191,36,0.12)",
  critical: "rgba(248,113,113,0.12)",
  unknown: "rgba(148,163,184,0.08)",
  disabled: "rgba(100,116,139,0.08)",
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

  const services = useMemo(() => data?.services ?? [], [data]);

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
    const critical = services.filter(
      (s) => s.is_active && (s.status === "unhealthy" || s.status === "critical"),
    ).length;
    const unknown = services.filter(
      (s) =>
        s.is_active &&
        !["healthy", "degraded", "unhealthy", "critical", "maintenance"].includes(s.status),
    ).length;
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

  const filterButtons = [
    { key: "all", label: t("soc.overview.filter_all") },
    { key: "healthy", label: t("soc.overview.filter_healthy") },
    { key: "degraded", label: t("soc.overview.filter_degraded") },
    { key: "critical", label: t("soc.overview.filter_critical") },
    { key: "disabled", label: t("soc.overview.filter_disabled") },
  ];

  /* ── Skeleton loading ── */
  if (loading) {
    return createElement(
      "div",
      { className: styles.glassPanel },
      createElement(
        "div",
        { className: styles.overviewPageHeader },
        createElement("div", {
          className: `${styles.skeleton} ${styles.overviewSkeletonMetric}`,
          style: { width: "120px", height: "12px", marginBottom: "12px" },
        }),
        createElement("div", {
          className: `${styles.skeleton} ${styles.overviewSkeletonMetric}`,
          style: { width: "260px", height: "24px", marginBottom: "8px" },
        }),
        createElement("div", {
          className: `${styles.skeleton} ${styles.overviewSkeletonMetric}`,
          style: { width: "380px", height: "14px" },
        }),
      ),
      createElement(
        "div",
        { className: styles.overviewMetricGrid },
        ...Array.from({ length: 6 }, (_, i) =>
          createElement("div", {
            key: i,
            className: `${styles.skeleton} ${styles.overviewSkeletonMetric}`,
          }),
        ),
      ),
      createElement(
        "div",
        { className: styles.overviewHealthBar },
        createElement("div", {
          className: `${styles.skeleton}`,
          style: { width: "100%", height: "100%", borderRadius: "999px" },
        }),
      ),
      createElement(
        "div",
        { className: styles.servicesGrid },
        ...Array.from({ length: 3 }, (_, i) =>
          createElement("div", {
            key: i,
            className: `${styles.skeleton} ${styles.overviewSkeletonCard}`,
          }),
        ),
      ),
    );
  }

  if (error) {
    return createElement("div", { className: styles.glassPanel },
      createElement("div", { className: styles.inlineError }, error),
    );
  }

  const total = stats.total || 1;
  const healthyPct = (stats.healthy / total) * 100;
  const degradedPct = (stats.degraded / total) * 100;
  const criticalPct = (stats.critical / total) * 100;

  return createElement(
    "div",
    { className: styles.glassPanel },

    /* ── 1. Page Header ── */
    createElement(
      "div",
      { className: styles.overviewPageHeader },
      createElement(
        "div",
        { className: styles.overviewEyebrow },
        createElement(LucideIcon, { name: "Activity", className: "h-3.5 w-3.5" }),
        "SOC",
      ),
      createElement("h2", { className: styles.overviewTitle }, t("soc.overview.overview_title")),
      createElement("p", { className: styles.overviewDescription }, t("soc.overview.overview_description")),
      createElement(
        "div",
        { className: styles.overviewHeroBadge },
        createElement("span", { className: styles.overviewHeroBadgePulse }),
        t("soc.overview.overview_health_ratio", {
          healthy: String(stats.healthy),
          total: String(stats.total),
        }),
      ),
    ),

    /* ── 2. Health Ratio Bar ── */
    createElement(
      "div",
      { className: styles.overviewHealthBar },
      healthyPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentHealthy}`,
            style: { width: `${healthyPct}%` },
          })
        : null,
      degradedPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentDegraded}`,
            style: { width: `${degradedPct}%` },
          })
        : null,
      criticalPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentCritical}`,
            style: { width: `${criticalPct}%` },
          })
        : null,
    ),

    /* ── 3. Metric Cards ── */
    createElement(
      "div",
      { className: styles.overviewMetricGrid },
      ...METRIC_DEFS.map((def) => {
        const value = stats[def.key as keyof typeof stats];
        const color = METRIC_COLORS[def.key];
        return createElement(
          "div",
          {
            key: def.key,
            className: styles.overviewMetricCard,
            style: { borderLeftColor: METRIC_BORDER_COLORS[def.key] },
          },
          createElement(
            "div",
            {
              className: styles.overviewMetricIcon,
              style: { background: METRIC_ICON_BG[def.key] },
            },
            createElement(LucideIcon, {
              name: def.icon,
              className: "h-5 w-5",
            }),
          ),
          createElement(
            "div",
            { className: styles.overviewMetricBody },
            createElement(
              "div",
              { className: styles.overviewMetricLabel },
              t(METRIC_LABEL_KEYS[def.key]),
            ),
            createElement(
              "div",
              { className: styles.overviewMetricValue, style: { color } },
              String(value),
            ),
          ),
        );
      }),
    ),

    /* ── 4. Toolbar ── */
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
      }),
      createElement(
        "div",
        null,
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
          ),
        ),
      ),
    ),

    /* ── 5. Services Grid ── */
    paginated.length === 0
      ? createElement(
          "div",
          { className: styles.emptyState },
          createElement(LucideIcon, { name: "Inbox", className: "h-8 w-8" }),
          createElement("p", { style: { margin: "0.5rem 0 0", color: "var(--text-muted)" } },
            t("soc.overview.filter_all") + " — " + t("soc.health.unknown_value"),
          ),
        )
      : createElement(
          "div",
          { className: styles.servicesGrid },
          ...paginated.map((service) => {
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
                className: `${styles.overviewServiceCard} ${!service.is_active ? styles.overviewServiceCardInactive : ""}`,
              },

              /* Header row: name + badge */
              createElement(
                "div",
                { className: styles.overviewServiceHeader },
                createElement(
                  "div",
                  { className: styles.overviewServiceInfo },
                  createElement("h4", { className: styles.overviewServiceName }, service.name),
                  createElement(
                    "p",
                    { className: styles.overviewServiceKey },
                    `${service.service_key} · ${service.domain}`,
                  ),
                ),
                createElement(
                  "span",
                  {
                    className: styles.statusBadge,
                    style: { ...getStatusBadgeStyle(service.status) },
                  },
                  statusLabel,
                ),
              ),

              /* Stats row: latency + last check */
              createElement(
                "div",
                { className: styles.overviewServiceStats },
                createElement(
                  "div",
                  { className: styles.overviewStatItem },
                  createElement("span", { className: styles.overviewStatLabel }, t("soc.health.latency_label")),
                  createElement(
                    "span",
                    { className: styles.overviewStatValue },
                    service.is_active && service.avg_response_ms != null
                      ? `${service.avg_response_ms.toFixed(0)}ms`
                      : "—",
                  ),
                ),
                createElement(
                  "div",
                  { className: styles.overviewStatItem },
                  createElement("span", { className: styles.overviewStatLabel }, t("soc.health.last_check_label")),
                  createElement(
                    "span",
                    { className: styles.overviewStatValue },
                    service.last_check_at
                      ? service.last_check_at.split("T")[1]?.slice(0, 8) || "—"
                      : "—",
                  ),
                ),
              ),

              /* Action buttons */
              createElement(
                "div",
                { className: styles.overviewServiceActions },
                createElement(
                  "button",
                  {
                    className: styles.actionBtn,
                    disabled: isLoadingToggle,
                    onClick: () => handleToggle(service),
                    style: {
                      background: service.is_active ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                      color: service.is_active ? toneColor("danger") : toneColor("success"),
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
                      },
                      t("soc.overview.configure_service"),
                    )
                  : null,
              ),
            );
          }),
        ),

    /* ── 6. Pagination ── */
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
            null,
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
  );
}
