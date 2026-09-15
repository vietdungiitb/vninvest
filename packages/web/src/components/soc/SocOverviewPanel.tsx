import { createElement, useEffect, useState, useMemo, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { getStatusBadgeStyle } from "./socStatusColors.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { formatLastCheck } from "./socTime.js";
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
  generated_at?: string;
  by_domain?: Record<string, { total: number; healthy: number; degraded: number; unhealthy: number; unknown: number; maintenance: number }>;
}

interface SloOverviewData {
  services: SloRow[];
}

interface SocOverviewPanelProps {
  onChangeTab?: (tab: string) => void;
}

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
  platform: "overview",
  data_ingest: "dataops",
  realtime: "signals",
  cache: "prefetch",
  analytics: "runtime-kpi",
  matrix: "dataops",
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

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const q = query.toLowerCase().trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return createElement(
    "span",
    null,
    before,
    createElement("mark", { style: { background: "var(--soc-c-fbbf24)", color: "#000", padding: "0 2px", borderRadius: "2px" } }, match),
    after,
  );
}

export function SocOverviewPanel({ onChangeTab }: SocOverviewPanelProps) {
  const { t, localeTag } = useI18n() as unknown as { t: (k: string, o?: any) => string; localeTag: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sloError, setSloError] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [sloMap, setSloMap] = useState<Record<string, SloRow>>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "status" | "latency">("name");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
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
    const jittered = delayMs + Math.floor(Math.random() * 3000);
    intervalRef.current = window.setInterval(() => {
      fetchData(true);
    }, jittered);
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

  // W9 debounce search 300ms
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  // W13 visibility pause/resume + jitter handled in restartInterval
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      } else {
        fetchData(true);
        restartInterval(intervalDelayRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const services = useMemo(() => data?.services ?? [], [data]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    let result = services.filter((s) => {
      if (domainFilter && s.domain !== domainFilter) return false;
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
    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "status") {
      const order: Record<string, number> = { unhealthy: 0, critical: 0, degraded: 1, maintenance: 2, unknown: 3, healthy: 4 };
      result = [...result].sort((a, b) => {
        if (!a.is_active && b.is_active) return 1;
        if (a.is_active && !b.is_active) return -1;
        const ao = order[a.status] ?? 5;
        const bo = order[b.status] ?? 5;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === "latency") {
      result = [...result].sort((a, b) => (b.avg_response_ms ?? -1) - (a.avg_response_ms ?? -1));
    }
    return result;
  }, [services, debouncedSearch, statusFilter, domainFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, domainFilter, sortBy, pageSize]);

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
    // W12: fallback to overview when domain not in map (comment để lần sau thêm domain chỉ thêm 1 dòng map)
    const domain = service.config_domain || service.domain;
    const tab = DOMAIN_TAB_MAP[domain] ?? "overview";
    if (onChangeTab) {
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

  if (error && !data) {
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
    { className: styles.glassPanel, role: "region", "aria-label": t("soc.overview.overview_title") },

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
        data?.generated_at
          ? createElement(
              "span",
              { style: { color: "var(--text-muted)", fontWeight: 400 } },
              `· ${t("soc.overview.hero_updated_at", {
                time: (() => {
                  try {
                    return new Intl.DateTimeFormat(localeTag, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(new Date(data.generated_at as string));
                  } catch {
                    return String(data.generated_at);
                  }
                })(),
              })}`,
            )
          : null,
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

    /* ── 2b. Health Bar Legend (W-U8) ── */
    createElement(
      "div",
      { className: styles.overviewLegend },
      ...(["healthy", "degraded", "critical", "maintenance", "unknown", "disabled"] as const)
        .filter((key) => stats[key] > 0)
        .map((key) =>
          createElement(
            "span",
            { key, className: styles.overviewLegendItem },
            createElement("span", {
              className: styles.overviewLegendDot,
              style: { background: METRIC_COLORS[key] },
            }),
            `${t(METRIC_LABEL_KEYS[key])}: ${stats[key]}`,
          ),
        ),
    ),

    /* ── 3. Metric Cards ── */
    createElement(
      "div",
      { className: styles.overviewMetricGrid, role: "list" },
      ...METRIC_DEFS.map((def) => {
        const value = stats[def.key as keyof typeof stats];
        const color = METRIC_COLORS[def.key];
        return createElement(
          "div",
          {
            key: def.key,
            className: styles.overviewMetricCard,
            role: "listitem",
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
            def.key === "total"
              ? null
              : createElement(
                  "div",
                  { className: styles.overviewMetricLabel },
                  t("soc.overview.metric_share", {
                    pct: String(total > 0 ? Math.round((value / total) * 100) : 0),
                  }),
                ),
          ),
        );
      }),
    ),

    /* ── Domain Strip (W7) ── */
    (() => {
      const byDomain = (data as any)?.by_domain as Record<string, any> | undefined;
      if (!byDomain || Object.keys(byDomain).length === 0) return null;
      const domains = Object.keys(byDomain).sort();
      return createElement(
        "div",
        { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" } },
        createElement("span", { className: styles.filterRowLabel }, t("soc.overview.filter_by_domain")),
        createElement(
          "button",
          {
            className: `${styles.domainPill} ${domainFilter === null ? styles.filterBtnActive : ""}`,
            "aria-pressed": domainFilter === null,
            onClick: () => setDomainFilter(null),
          },
          t("soc.overview.domain_all"),
        ),
        ...domains.map((d: string) => {
          const row = byDomain[d];
          const healthy = row.healthy ?? 0;
          const total = row.total ?? 0;
          const active = domainFilter === d;
          return createElement(
            "button",
            {
              key: d,
              className: `${styles.domainPill} ${active ? styles.filterBtnActive : ""}`,
              "aria-pressed": active,
              onClick: () => setDomainFilter(active ? null : d),
            },
            `${d} ${healthy}/${total}`,
          );
        }),
      );
    })(),

    /* ── 4. Toolbar (W-U6: 2 rows) ── */
    createElement(
      "div",
      { className: styles.toolbar },
      createElement(
        "div",
        { className: styles.toolbarRow },
        createElement("input", {
          className: styles.searchInput,
          type: "text",
          placeholder: t("soc.overview.search_placeholder"),
          value: search,
          style: { flex: "1", minWidth: "200px", width: "auto" },
          onChange: (e: { target: { value: string } }) => {
            setSearch(e.target.value);
          },
        }),
        createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
          createElement("label", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.overview.sort_label")),
          createElement(
            "select",
            {
              value: sortBy,
              onChange: (e: { target: { value: string } }) => setSortBy(e.target.value as any),
              className: styles.searchInput,
              style: { width: "auto", minWidth: "130px" },
              "aria-label": t("soc.overview.sort_label"),
            },
            createElement("option", { value: "name" }, t("soc.overview.sort_name")),
            createElement("option", { value: "status" }, t("soc.overview.sort_status")),
            createElement("option", { value: "latency" }, t("soc.overview.sort_latency")),
          ),
        ),
      ),
      createElement(
        "div",
        { className: styles.toolbarRow },
        createElement("span", { className: styles.filterRowLabel }, t("soc.overview.filter_by_status")),
        ...filterButtons.map((btn) =>
          createElement(
            "button",
            {
              key: btn.key,
              className: `${styles.filterBtn} ${statusFilter === btn.key ? styles.filterBtnActive : styles.filterBtnInactive}`,
              "aria-pressed": statusFilter === btn.key,
              onClick: () => {
                setStatusFilter(btn.key);
              },
            },
            btn.label,
          ),
        ),
      ),
    ),

    /* ── Error Banner (W6 non-blocking) ── */
    error && data
      ? createElement(
          "div",
          { className: styles.inlineError, style: { marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" } },
          createElement("span", null, error),
          createElement("button", { className: styles.actionBtn, onClick: () => fetchData(false) }, t("soc.overview.retry")),
        )
      : null,

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
          { className: styles.servicesGrid, role: "list" },
          ...paginated.map((service) => {
            const statusLabel = getStatusLabel(service.status, service.is_active);
            const toggleKey = `toggle-${service.service_key}`;
            const healthKey = `health-${service.service_key}`;
            const isLoadingToggle = actionLoading[toggleKey];
            const isLoadingHealth = actionLoading[healthKey];
            const hasConfig = true; // W12 always show, fallback handled in handleConfigure

            return createElement(
              "div",
              {
                key: service.service_key,
                className: `${styles.overviewServiceCard} ${!service.is_active ? styles.overviewServiceCardInactive : ""}`,
                role: "listitem",
              },

              /* Header row: name + badge */
              createElement(
                "div",
                { className: styles.overviewServiceHeader },
                createElement(
                  "div",
                  { className: styles.overviewServiceInfo },
                  createElement("h4", { className: styles.overviewServiceName, title: service.name }, highlightMatch(service.name, debouncedSearch) as any),
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
                    if (!service.is_active) return null;
                    const slo = sloMap[service.service_key];
                    if (!slo || slo.uptime_30d == null) return null;
                    const uptimePct = (slo.uptime_30d * 100).toFixed(2);
                    const budgetPct = slo.error_budget_remaining != null
                      ? `${(slo.error_budget_remaining * 100).toFixed(1)}%`
                      : "—";
                    const budget = slo.error_budget_remaining;
                    const burnColor = budget == null
                      ? "var(--soc-c-94a3b8)"
                      : budget > 0.5
                        ? "var(--soc-c-34d399)"
                        : budget > 0.2
                          ? "var(--soc-c-fbbf24)"
                          : "var(--soc-c-f87171)";
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
                  (() => {
                    const { display, title } = formatLastCheck(service.last_check_at, localeTag, t);
                    return createElement("span", { className: styles.overviewStatValue, title }, display);
                  })(),
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

    /* ── 6. Pagination (W10) ── */
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" } },
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" } },
        createElement("label", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.overview.page_size_label")),
        createElement(
          "select",
          {
            value: String(pageSize),
            onChange: (e: any) => setPageSize(Number(e.target.value)),
            className: styles.searchInput,
            style: { width: "auto", minWidth: "70px" },
            "aria-label": t("soc.overview.page_size_label"),
          },
          createElement("option", { value: "9" }, "9"),
          createElement("option", { value: "18" }, "18"),
          createElement("option", { value: "36" }, "36"),
        ),
        createElement(
          "span",
          { style: { fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" } },
          t("soc.overview.showing_range", {
            from: String(filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1),
            to: String(Math.min(safePage * pageSize, filtered.length)),
            total: String(filtered.length),
          }),
        ),
      ),
      totalPages > 1
        ? createElement(
            "div",
            { className: styles.pagination, role: "navigation", "aria-label": t("soc.overview.page_of", { page: String(safePage), total: String(totalPages) }) },
            createElement(
              "button",
              {
                className: styles.pageBtn,
                disabled: safePage <= 1,
                "aria-label": t("soc.overview.prev_page"),
                onClick: () => setPage(safePage - 1),
              },
              t("soc.overview.prev_page"),
            ),
            ...(() => {
              const pages: number[] = [];
              const start = Math.max(1, safePage - 2);
              const end = Math.min(totalPages, start + 4);
              const adjStart = Math.max(1, end - 4);
              for (let p = adjStart; p <= end; p++) pages.push(p);
              return pages.map((p) =>
                createElement(
                  "button",
                  {
                    key: p,
                    className: `${styles.pageBtn} ${p === safePage ? styles.filterBtnActive : ""}`,
                    "aria-label": `Page ${p}`,
                    "aria-current": p === safePage ? "page" : undefined,
                    onClick: () => setPage(p),
                  },
                  String(p),
                ),
              );
            })(),
            createElement(
              "button",
              {
                className: styles.pageBtn,
                disabled: safePage >= totalPages,
                "aria-label": t("soc.overview.next_page"),
                onClick: () => setPage(safePage + 1),
              },
              t("soc.overview.next_page"),
            ),
          )
        : null,
    ),

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
