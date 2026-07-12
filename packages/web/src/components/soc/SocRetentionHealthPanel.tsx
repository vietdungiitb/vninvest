import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
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
  const { t } = useI18n();

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
  const retentionThresholdTone = isWithinStaleness ? "#34d399" : "#fbbf24";

  const statusColors =
    retentionStatus === "success"
      ? { bg: "rgba(16, 185, 129, 0.15)", text: "#34d399", label: t("soc.dataops.retention_status_ok") }
      : retentionStatus === "failed"
      ? { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", label: t("soc.dataops.retention_status_failed") }
      : { bg: "rgba(100, 116, 139, 0.15)", text: "#94a3b8", label: t("soc.dataops.retention_status_unknown") };

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" } },
      createElement(
        "div",
        null,
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.retention_health")),
        createElement(
          "p",
          { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", margin: "0.15rem 0 0 0" } },
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
            fontSize: "0.7rem",
            fontWeight: 600,
          },
        },
        statusColors.label
      )
    ),

    createElement(
      "div",
      { className: styles.metricGrid, style: { gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1rem" } },
      createElement(
        "div",
        { className: styles.metricCard },
        createElement("div", { className: styles.metricLabel }, t("soc.dataops.retention_deleted")),
        createElement(
          "div",
          { className: styles.metricValue, style: { color: "#f87171" } },
          (retentionHealth.latest_run?.deleted_rows || 0).toLocaleString()
        )
      ),
      createElement(
        "div",
        { className: styles.metricCard },
        createElement("div", { className: styles.metricLabel }, t("soc.dataops.retention_days")),
        createElement(
          "div",
          { className: styles.metricValue, style: { color: "var(--accent-cyan, #06b6d4)" } },
          `${retentionHealth.retention_days || 0} days`
        )
      )
    ),

    createElement(
      "div",
      { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", spaceY: "0.2rem" } },
      createElement(
        "p",
        { style: { margin: "0.15rem 0" } },
        t("soc.dataops.retention_policy_line", {
          days: retentionHealth.retention_days || 0,
        })
      ),
      createElement(
        "p",
        { style: { margin: "0.15rem 0" } },
        t("soc.dataops.retention_trend_line", {
          delta: retentionDeletedDelta > 0 ? `+${retentionDeletedDelta}` : `${retentionDeletedDelta}`,
          average: (retentionTrend.average_deleted_rows || 0).toFixed(2),
        })
      ),
      createElement(
        "p",
        { style: { margin: "0.15rem 0" } },
        t("soc.dataops.retention_retained_delta_line", {
          delta: retentionRetainedDelta > 0 ? `+${retentionRetainedDelta}` : `${retentionRetainedDelta}`,
        })
      )
    ),

    createElement(
      "div",
      { style: { marginTop: "1rem", borderTop: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", paddingTop: "0.75rem" } },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" } },
        createElement("p", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)", margin: 0, fontWeight: 600 } }, t("soc.dataops.retention_chart_title")),
        createElement(
          "span",
          {
            style: {
              fontSize: "0.65rem",
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
          style: {
            display: "flex",
            alignItems: "flex-end",
            height: "70px",
            gap: "0.5rem",
            padding: "0.5rem",
            borderRadius: "6px",
            background: "rgba(15, 23, 42, 0.3)",
            border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
          },
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
              background: "linear-gradient(180deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.8))",
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
            { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)", width: "100%", textAlign: "center" } },
            t("soc.dataops.retention_history_empty")
          )
      ),
      createElement(
        "p",
        {
          style: {
            fontSize: "0.65rem",
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
