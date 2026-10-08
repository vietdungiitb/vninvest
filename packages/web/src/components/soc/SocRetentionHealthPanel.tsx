import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { toneColor } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface RetentionRun {
  status?: string;
  started_at?: string;
  finished_at?: string;
  duration_seconds?: number;
  deleted_rows?: number;
  retained_rows?: number;
  total_rows_before?: number;
  retention_days?: number;
  [key: string]: unknown;
}

interface RetentionHealthData {
  retention_days?: number;
  latest_run?: RetentionRun;
  history?: RetentionRun[];
  trend?: {
    peak_deleted_rows?: number;
    deleted_rows_delta?: number;
    retained_rows_delta?: number;
    latest_run_age_hours?: number;
    staleness_threshold_hours?: number;
    within_staleness_threshold?: boolean;
    average_deleted_rows?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SocRetentionHealthPanelProps {
  retentionHealth?: RetentionHealthData;
}

export function SocRetentionHealthPanel({ retentionHealth }: SocRetentionHealthPanelProps) {
  const { t, formatNumber } = useI18n();

  if (!retentionHealth) return null;

  const retentionStatus = String(retentionHealth.latest_run?.status || "").toLowerCase();
  const retentionTrend = retentionHealth.trend || {};
  const retentionHistory = retentionHealth.history || [];
  const retentionBars = [...retentionHistory].reverse();

  const retentionPeakDeletedRows = Math.max(
    retentionTrend.peak_deleted_rows || 0,
    ...retentionBars.map((historyPoint) => historyPoint.deleted_rows || 0),
    1
  );

  const retentionDeletedDelta = retentionTrend.deleted_rows_delta || 0;
  const retentionRetainedDelta = retentionTrend.retained_rows_delta || 0;
  const retentionLatestRunAgeHours = retentionTrend.latest_run_age_hours || 0;

  const isWithinStaleness = !!retentionTrend.within_staleness_threshold;
  const retentionThresholdTone = isWithinStaleness ? toneColor("success") : toneColor("warning");

  const statusColors =
    retentionStatus === "success"
      ? { bg: "rgba(var(--soc-rgb-10b981) / 0.15)", text: "var(--color-success-500, #34d399)", label: t("soc.dataops.retention_status_ok") }
      : retentionStatus === "failed"
  ? { bg: "rgba(var(--soc-rgb-ef4444) / 0.15)", text: toneColor("danger"), label: t("soc.dataops.retention_status_failed") }
  : { bg: "rgba(var(--soc-rgb-64748b) / 0.15)", text: "var(--color-text-muted, #94a3b8)", label: t("soc.dataops.retention_status_unknown") };

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.25rem" } },
      createElement(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        createElement("div", { className: styles.sectionCardTitle, style: { marginBottom: "0.35rem" } }, t("soc.dataops.retention_health")),
        createElement(
          "p",
          { style: { margin: 0, color: "var(--text-secondary, #94a3b8)", fontSize: "var(--fs-md)", lineHeight: "1.5" } },
          t("soc.dataops.retention_deleted_line", {
            deleted: retentionHealth.latest_run?.deleted_rows || 0,
            retained: retentionHealth.latest_run?.retained_rows || 0,
          })
        )
      ),
      createElement(
        "span",
        {
          className: styles.statusBadge,
          style: {
            background: statusColors.bg,
            color: statusColors.text,
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            whiteSpace: "nowrap" as const,
            flexShrink: 0,
          },
        },
        statusColors.label
      )
    ),

    createElement(
      "div",
      { className: styles.metricGrid, style: { gap: "1rem", marginBottom: "0.25rem" } },
      createElement(
        "div",
        { className: styles.metricCard, style: { padding: "0.85rem 1rem" } },
        createElement("div", { className: styles.metricLabel }, t("soc.dataops.retention_deleted")),
        createElement(
          "div",
          { className: styles.metricValue,  },
          formatNumber(retentionHealth.latest_run?.deleted_rows ?? 0)
        )
      ),
      createElement(
        "div",
        { className: styles.metricCard, style: { padding: "0.85rem 1rem" } },
        createElement("div", { className: styles.metricLabel }, t("soc.dataops.retention_days")),
        createElement(
          "div",
          { className: styles.metricValue,  },
          `${retentionHealth.retention_days || 0} days`
        )
      )
    ),

    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "0.45rem", lineHeight: "1.65", marginTop: "0.85rem", padding: "0.75rem", background: "rgba(var(--soc-rgb-0f172a) / 0.22)", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.10)" } },
      createElement(
        "p",
        { style: { margin: 0, color: "var(--text-secondary, #e2e8f0)", fontSize: "var(--fs-md)", fontWeight: 500 } },
        t("soc.dataops.retention_policy_line", {
          days: retentionHealth.retention_days || 0,
        })
      ),
      createElement(
        "p",
        { style: { margin: 0, color: "var(--text-secondary, #cbd5e1)", fontSize: "var(--fs-md)" } },
        t("soc.dataops.retention_trend_line", {
          delta: retentionDeletedDelta > 0 ? `+${retentionDeletedDelta}` : `${retentionDeletedDelta}`,
          average: (retentionTrend.average_deleted_rows || 0).toFixed(2),
        })
      ),
      createElement(
        "p",
        { style: { margin: 0, color: "var(--text-secondary, #cbd5e1)", fontSize: "var(--fs-md)" } },
        t("soc.dataops.retention_retained_delta_line", {
          delta: retentionRetainedDelta > 0 ? `+${retentionRetainedDelta}` : `${retentionRetainedDelta}`,
        })
      )
    ),

    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.85rem", padding: "0.75rem", background: "rgba(var(--soc-rgb-0f172a) / 0.18)", borderRadius: "8px", border: "1px solid rgba(80,120,168,0.08)" } },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
        createElement("p", { style: { margin: 0, fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--text-primary, #f1f5f9)" } }, t("soc.dataops.retention_chart_title")),
        createElement(
          "span",
          {
            style: {
              fontSize: "var(--fs-xs)",
              color: retentionThresholdTone,
              fontWeight: 600,
            },
          },
          isWithinStaleness
            ? t("soc.dataops.retention_threshold_ok")
            : t("soc.dataops.retention_threshold_breached")
        )
      ),
      createElement(
        "div",
        {
            style: { display: "flex", alignItems: "flex-end", gap: "4px", height: "72px", padding: "0.5rem", background: "rgba(var(--soc-rgb-0f172a) / 0.35)", borderRadius: "6px", border: "1px solid rgba(80,120,168,0.10)" },
          },
        retentionBars.map((historyPoint, index) => {
          const deletedRows = historyPoint.deleted_rows || 0;
          const heightPct = Math.max(10, Math.round((deletedRows / retentionPeakDeletedRows) * 100));
          return createElement("div", {
            key: index,
            style: {
              flex: 1,
              height: `${heightPct}%`,
              borderRadius: "4px 4px 0 0",
              background: "linear-gradient(180deg, rgba(var(--soc-rgb-f59e0b) / 0.8), rgba(var(--soc-rgb-d97706) / 0.8))",
              cursor: "help",
            },
            title: t("soc.dataops.retention_history_point_tooltip", {
              deleted: deletedRows,
              retained: historyPoint.retained_rows || 0,
              before: historyPoint.total_rows_before || 0,
            }),
          });
        }),
        retentionBars.length === 0 &&
          createElement(
            "span",
            { },
            t("soc.dataops.retention_history_empty")
          )
      ),
      createElement(
        "p",
        {
          style: {
            fontSize: "var(--fs-xs)",
            color: retentionThresholdTone,
            marginTop: "0.5rem",
            margin: "0.5rem 0 0 0",
          },
        },
        t("soc.dataops.retention_threshold_line", {
          age: retentionLatestRunAgeHours.toFixed(2),
          threshold: (retentionTrend.staleness_threshold_hours || 0).toFixed(2),
        })
      )
    )
  );
}
