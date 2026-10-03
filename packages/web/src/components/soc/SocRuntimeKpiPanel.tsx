import { createElement, useEffect, useRef, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface HealthBucket {
  hour: string;
  checks: number;
  failed: number;
}

interface SloServiceRow {
  service_key: string;
  name: string;
  domain: string;
  status: string;
  is_active: boolean;
  slo_target: number;
  uptime_30d: number | null;
  burn_rate_1h: number | null;
  error_budget_remaining: number | null;
  last_check_at: string | null;
  recent_checks_24h: HealthBucket[];
}

const bucketColor = (ratio: number): string => {
  if (ratio <= 0) return "var(--soc-c-34d399)";
  if (ratio < 0.35) return "var(--soc-c-fbbf24)";
  return "var(--soc-c-f87171)";
};

const BAR_MAX_HEIGHT = 28;

export function SocRuntimeKpiPanel() {
  const { t } = useI18n();
  const [services, setServices] = useState<SloServiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const adapter = defaultCoreApiAdapter as unknown as {
          getSocSloOverview: () => Promise<{ services: SloServiceRow[] }>;
        };
        const result = await adapter.getSocSloOverview();
        if (!mountedRef.current) return;
        setServices(result.services ?? []);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : t("soc.slo.spark_load_failed"));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    fetchData();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const rows = services ? [...services] : [];
  rows.sort((a, b) => {
    const aBurn = a.burn_rate_1h ?? -1;
    const bBurn = b.burn_rate_1h ?? -1;
    if (aBurn !== bBurn) return bBurn - aBurn;
    return a.name.localeCompare(b.name);
  });

  const hasAnyData = rows.some(
    (row) => (row.recent_checks_24h?.length ?? 0) > 0 || row.uptime_30d != null,
  );

  const renderSparkline = (service: SloServiceRow) => {
    const buckets = service.recent_checks_24h ?? [];
    const totalChecks = buckets.reduce((sum, b) => sum + b.checks, 0);
    const totalFailed = buckets.reduce((sum, b) => sum + b.failed, 0);
    const burnRate = service.burn_rate_1h != null ? service.burn_rate_1h.toFixed(2) : "—";
    const uptimePct = service.uptime_30d != null ? `${(service.uptime_30d * 100).toFixed(2)}%` : "—";

    return createElement(
      "div",
      { className: styles.sparkRow },
      createElement(
        "div",
        { className: styles.sparkMeta },
        createElement("span", { className: styles.sparkName }, service.name),
        createElement("span", { className: styles.kpiBadge, title: t("soc.slo.burn_rate_tooltip") },
          `${t("soc.slo.burn_rate_label")} ${burnRate}`,
        ),
        createElement("span", { className: styles.kpiBadge, title: t("soc.slo.uptime_30d_tooltip") },
          `${t("soc.slo.uptime_label")} ${uptimePct}`,
        ),
        totalChecks > 0
          ? createElement(
              "span",
              { className: styles.sparkFailed },
              t("soc.slo.spark_failed_summary", { failed: totalFailed, checks: totalChecks }),
            )
          : null,
      ),
      buckets.length > 0
        ? createElement(
            "div",
            { className: styles.sparkBarTrack, role: "img", "aria-label": `${t("soc.slo.spark_heading")} ${service.name}` },
            buckets.map((bucket, idx) => {
              const ratio = bucket.checks > 0 ? bucket.failed / bucket.checks : 0;
              const height = Math.max(2, Math.round(ratio * BAR_MAX_HEIGHT));
              return createElement("div", {
                key: `${service.service_key}-${idx}-${bucket.hour}`,
                "data-testid": `spark-bar-${idx}`,
                className: styles.sparkBar,
                style: { height: `${height}px`, backgroundColor: bucketColor(ratio) },
                title: `${bucket.hour} — ${t("soc.slo.spark_tooltip")} ${(ratio * 100).toFixed(0)}%`,
              });
            }),
          )
        : createElement("div", { className: styles.sparkEmpty }, t("soc.slo.spark_empty")),
    );
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      ShellPanel,
      {
        title: t("soc.runtime_kpi.title"),
        subtitle: t("soc.runtime_kpi.subtitle"),
      },
      createElement(
        "div",
        { className: styles.bannerNotice, style: { marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" } },
        createElement("span", null, t("soc.runtime_kpi.banner_hint")),
        createElement("a", { href: "/admin/usage", style: { color: "var(--accent-cyan, #06b6d4)", fontWeight: 600, textDecoration: "underline", whiteSpace: "nowrap" } }, t("soc.runtime_kpi.banner_link")),
      ),
      loading
        ? createElement("div", { className: styles.sparkLoading }, t("soc.slo.spark_loading"))
        : error
          ? createElement(
              "div",
              { className: styles.sparkError },
              error,
              createElement(
                "button",
                {
                  type: "button",
                  style: { marginLeft: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: 6, cursor: "pointer" },
                  onClick: () => setReloadKey((k) => k + 1),
                },
                "Retry",
              ),
            )
          : rows.length === 0 || !hasAnyData
            ? createElement(
                "div",
                { className: styles.emptyState },
                createElement(
                  "svg",
                  { width: 48, height: 48, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5 },
                  createElement("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" }),
                ),
                createElement("p", null, t("soc.slo.spark_empty")),
              )
            : createElement(
                "div",
                { className: styles.sectionCard },
                createElement("p", { className: styles.sectionCardTitle }, t("soc.slo.spark_heading")),
                createElement("div", null, ...rows.map(renderSparkline)),
              ),
    ),
  );
}