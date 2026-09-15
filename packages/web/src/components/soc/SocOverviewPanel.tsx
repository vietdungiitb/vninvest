import { createElement, useEffect, useState, useMemo, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { getStatusBadgeStyle } from "./socStatusColors.js";
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

interface SloRow {
  service_key: string;
  uptime_30d: number | null;
  burn_rate_1h: number | null;
  error_budget_remaining: number | null;
  slo_target: number;
}

interface OverviewData {
  services: ServiceItem[];
  total?: number;
}

interface SloOverviewData {
  services: SloRow[];
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
  { key: "maintenance", icon: "Wrench", colorVar: "--soc-c-22d3ee" },
  { key: "unknown", icon: "HelpCircle", colorVar: "--soc-c-94a3b8" },
  { key: "disabled", icon: "PowerOff", colorVar: "--soc-c-64748b" },
] as const;

const METRIC_LABEL_KEYS: Record<string, string> = {
  total: "soc.overview.total_services",
  healthy: "soc.overview.healthy_count",
  degraded: "soc.overview.degraded_count",
  critical: "soc.overview.critical_count",
  maintenance: "soc.overview.maintenance_count",
  unknown: "soc.overview.unknown_count",
  disabled: "soc.overview.disabled_count",
};

const METRIC_COLORS: Record<string, string> = {
  total: "#f1f5f9",
  healthy: "#34d399",
  degraded: "#fbbf24",
  critical: "#f87171",
  maintenance: "var(--soc-c-22d3ee)",
  unknown: "#94a3b8",
  disabled: "#64748b",
};

const METRIC_BORDER_COLORS: Record<string, string> = {
  total: "rgba(241,245,249,0.4)",
  healthy: "rgba(52,211,153,0.6)",
  degraded: "rgba(251,191,36,0.6)",
  critical: "rgba(248,113,113,0.6)",
  maintenance: "color-mix(in srgb, var(--soc-c-22d3ee) 60%, transparent)",
  unknown: "rgba(148,163,184,0.4)",
  disabled: "rgba(100,116,139,0.4)",
};

const METRIC_ICON_BG: Record<string, string> = {
  total: "rgba(241,245,249,0.08)",
  healthy: "rgba(52,211,153,0.12)",
  degraded: "rgba(251,191,36,0.12)",
  critical: "rgba(248,113,113,0.12)",
  maintenance: "color-mix(in srgb, var(--soc-c-22d3ee) 12%, transparent)",
  unknown: "rgba(148,163,184,0.08)",
  disabled: "rgba(100,116,139,0.08)",
};

export function SocOverviewPanel({ onChangeTab }: SocOverviewPanelProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sloError, setSloError] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [sloMap, setSloMap] = useState<Record<string, SloRow>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [confirmToggle, setConfirmToggle] = useState<ServiceItem | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const intervalDelayRef = useRef(15000);

  const fetchSlo = async () => {
    try {
      const sloAdapter = defaultCoreApiAdapter as unknown as {
        getSocSloOverview: () => Promise<SloOverviewData>;
      };
      const sloResult = await sloAdapter.getSocSloOverview();
      if (!mountedRef.current) return;
      const map: Record<string, SloRow> = {};
      for (const row of sloResult.services ?? []) {
        map[row.service_key] = row;
      }
      setSloMap(map);
      setSloError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setSloError(err instanceof Error ? err.message : t("soc.overview.slo_load_failed", { defaultValue: "Failed to load SLO data." }));
      setSloMap({});
    }
  };

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    if (!isSilent) setSloError("");
    try {
      const overviewAdapter = defaultCoreApiAdapter as unknown as {
        getSocOverviewSummary: () => Promise<OverviewData>;
      };
      const overviewResult = await overviewAdapter.getSocOverviewSummary();
      if (!mountedRef.current) return;
      setData(overviewResult);
      setError("");
      const hadBackoff = consecutiveErrorsRef.current >= 3;
      consecutiveErrorsRef.current = 0;
      if (hadBackoff) restartInterval(15000);
    } catch (err) {
      if (!mountedRef.current) return;
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 3 && intervalDelayRef.current === 15000) {
        restartInterval(60000);
      }
      if (!isSilent || consecutiveErrorsRef.current >= 3) {
        setError(err instanceof Error ? err.message : "Cannot load overview data.");
      }
    } finally {
      if (!isSilent && mountedRef.current) setLoading(false);
    }
    await fetchSlo();
  };

  const restartInterval = (delayMs: number) => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalDelayRef.current = delayMs;
    intervalRef.current = window.setInterval(() => {
      fetchData(true);
    }, delayMs);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData(false);
    restartInterval(15000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const services = useMemo(() => data?.services ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services.filter((s) => {
      if (q && !s.service_key.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q) && !s.domain?.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "healthy") return s.is_active && s.status === "healthy";
      if (statusFilter === "degraded") return s.is_active && s.status === "degraded";
      if (statusFilter === "critical") {
        return s.is_active && (s.status === "unhealthy" || s.status === "critical");
      }
      if (statusFilter === "maintenance") return s.is_active && s.status === "maintenance";
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
    return services.reduce(
      (acc, s) => {
        acc.total += 1;
        if (!s.is_active) {
          acc.disabled += 1;
          return acc;
        }
        if (s.status === "healthy") acc.healthy += 1;
        else if (s.status === "degraded") acc.degraded += 1;
        else if (s.status === "unhealthy" || s.status === "critical") acc.critical += 1;
        else if (s.status === "maintenance") acc.maintenance += 1;
        else acc.unknown += 1;
        return acc;
      },
      { total: 0, healthy: 0, degraded: 0, critical: 0, maintenance: 0, unknown: 0, disabled: 0 },
    );
  }, [services]);

  const handleToggle = (service: ServiceItem) => {
    setConfirmToggle(service);
    setToggleReason("");
  };

  const handleConfirmToggle = async (service: ServiceItem, reason: string) => {
    const key = `toggle-${service.service_key}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        updateSocService: (key: string, payload: Record<string, unknown>) => Promise<unknown>;
      };
      await adapter.updateSocService(service.service_key, { is_active: !service.is_active, change_reason: reason });
      await fetchData(true);
      setConfirmToggle(null);
      setToggleReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.overview.error_toggle_failed", { defaultValue: "Failed to toggle service." }));
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
      await fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.overview.error_health_check_failed", { defaultValue: "Failed to trigger health check." }));
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
    { key: "maintenance", label: t("soc.overview.filter_maintenance") },
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
        ...Array.from({ length: 7 }, (_, i) =>
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
      createElement("button", {
        className: styles.actionBtn,
        "aria-label": t("soc.overview.retry", { defaultValue: "Retry" }),
        style: { marginTop: "0.75rem" },
        onClick: () => fetchData(false),
      }, t("soc.overview.retry", { defaultValue: "Thử lại" })),
    );
  }

  const total = stats.total || 1;
  const healthyPct = (stats.healthy / total) * 100;
  const degradedPct = (stats.degraded / total) * 100;
  const criticalPct = (stats.critical / total) * 100;
  const maintenancePct = (stats.maintenance / total) * 100;
  const unknownPct = (stats.unknown / total) * 100;
  const disabledPct = (stats.disabled / total) * 100;

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
      {
        className: styles.overviewHealthBar,
        role: "img",
        "aria-label": t("soc.overview.health_bar_label", { healthy: String(stats.healthy), total: String(stats.total) }),
      },
      healthyPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentHealthy}`,
            style: { width: `${healthyPct}%` },
            title: `${t("soc.overview.filter_healthy")}: ${stats.healthy}`,
            "aria-label": `${t("soc.overview.filter_healthy")}: ${stats.healthy}`,
          })
        : null,
      degradedPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentDegraded}`,
            style: { width: `${degradedPct}%` },
            title: `${t("soc.overview.filter_degraded")}: ${stats.degraded}`,
            "aria-label": `${t("soc.overview.filter_degraded")}: ${stats.degraded}`,
          })
        : null,
      criticalPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentCritical}`,
            style: { width: `${criticalPct}%` },
            title: `${t("soc.overview.filter_critical")}: ${stats.critical}`,
            "aria-label": `${t("soc.overview.filter_critical")}: ${stats.critical}`,
          })
        : null,
      maintenancePct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentMaintenance}`,
            style: { width: `${maintenancePct}%` },
            title: `${t("soc.overview.filter_maintenance")}: ${stats.maintenance}`,
            "aria-label": `${t("soc.overview.filter_maintenance")}: ${stats.maintenance}`,
          })
        : null,
      unknownPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentUnknown}`,
            style: { width: `${unknownPct}%` },
            title: `${t("soc.overview.unknown_count")}: ${stats.unknown}`,
            "aria-label": `${t("soc.overview.unknown_count")}: ${stats.unknown}`,
          })
        : null,
      disabledPct > 0
        ? createElement("div", {
            className: `${styles.overviewHealthBarSegment} ${styles.overviewHealthBarSegmentDisabled}`,
            style: { width: `${disabledPct}%` },
            title: `${t("soc.overview.filter_disabled")}: ${stats.disabled}`,
            "aria-label": `${t("soc.overview.filter_disabled")}: ${stats.disabled}`,
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

    /* ── SLO Error Banner (W4) ── */
    sloError
      ? createElement(
          "div",
          { className: styles.inlineError, style: { marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" } },
          createElement("span", null, sloError),
          createElement("button", { className: styles.actionBtn, onClick: () => fetchSlo() }, t("soc.overview.retry_slo")),
        )
      : null,

    /* ── 5. Services Grid ── */
    paginated.length === 0
      ? createElement(
          "div",
          { className: styles.emptyState },
          createElement(LucideIcon, { name: "Inbox", className: "h-8 w-8" }),
          createElement("p", { style: { margin: "0.5rem 0 0", color: "var(--text-muted)" } },
            t("soc.overview.empty_filtered"),
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
                  "div",
                  { className: styles.overviewServiceBadges },
                  createElement(
                    "span",
                    {
                      className: styles.statusBadge,
                      style: { ...getStatusBadgeStyle(service.status) },
                    },
                    statusLabel,
                  ),
                  (() => {
                    const slo = sloMap[service.service_key];
                    if (!slo || slo.uptime_30d == null) return null;
                    const uptimePct = (slo.uptime_30d * 100).toFixed(2);
                    const budgetPct = slo.error_budget_remaining != null
                      ? `${(slo.error_budget_remaining * 100).toFixed(1)}%`
                      : "—";
                    const burnColor = (slo.burn_rate_1h ?? 0) > 1
                      ? "var(--soc-c-f87171)"
                      : (slo.burn_rate_1h ?? 0) > 0.5
                        ? "var(--soc-c-fbbf24)"
                        : "var(--soc-c-34d399)";
                    return createElement(
                      "div",
                      { className: styles.sloBadges },
                      createElement("span", { className: styles.sloBadge, title: t("soc.slo.uptime_30d_tooltip") },
                        `${t("soc.slo.uptime_label")} ${uptimePct}%`,
                      ),
                      createElement("span", { className: styles.sloBadge, title: t("soc.slo.burn_rate_tooltip") },
                        createElement("span", { style: { color: burnColor } }, `${t("soc.slo.burn_rate_label")} ${(slo.burn_rate_1h ?? 0).toFixed(2)}`),
                      ),
                      createElement("span", { className: styles.sloBadge, title: t("soc.slo.error_budget_tooltip") },
                        `${t("soc.slo.budget_label")} ${budgetPct}`,
                      ),
                    );
                  })(),
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
                    className: `${styles.actionBtn} ${service.is_active ? styles.disableBtn : styles.enableBtn}`,
                    disabled: isLoadingToggle,
                    onClick: () => handleToggle(service),
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

    /* ── Toggle Confirm Modal (W1) ── */
    confirmToggle
      ? createElement(
          "div",
          { className: styles.schedulerModalOverlay, onClick: () => { setConfirmToggle(null); setToggleReason(""); } },
          createElement(
            "div",
            { className: styles.schedulerModalCard, onClick: (e: any) => e.stopPropagation() },
            createElement("h3", { className: styles.schedulerModalTitle }, t("soc.overview.toggle_title")),
            createElement(
              "p",
              { className: styles.schedulerModalBody },
              t(confirmToggle.is_active ? "soc.overview.toggle_confirm_disable" : "soc.overview.toggle_confirm_enable", { name: confirmToggle.name }),
            ),
            createElement("label", { className: styles.schedulerModalField }, t("soc.overview.toggle_reason_label")),
            createElement("textarea", {
              className: styles.schedulerModalTextarea,
              rows: 2,
              placeholder: t("soc.overview.toggle_reason_placeholder"),
              value: toggleReason,
              onChange: (e: any) => setToggleReason(e.target.value),
            }),
            createElement(
              "div",
              { className: styles.schedulerModalActions },
              createElement(
                "button",
                { type: "button", onClick: () => { setConfirmToggle(null); setToggleReason(""); }, className: styles.schedulerModalCancel },
                t("common.cancel", { defaultValue: "Hủy" }),
              ),
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => confirmToggle && handleConfirmToggle(confirmToggle, toggleReason),
                  disabled: !toggleReason.trim() || !!actionLoading[`toggle-${confirmToggle.service_key}`],
                  className: styles.schedulerModalProceed,
                },
                actionLoading[`toggle-${confirmToggle.service_key}`] ? t("soc.overview.loading_text") : t("common.confirm", { defaultValue: "Xác nhận" }),
              ),
            ),
          ),
        )
      : null,
  );
}
