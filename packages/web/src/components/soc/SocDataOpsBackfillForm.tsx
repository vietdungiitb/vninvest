import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import styles from "./soc.module.css";

const DATASETS = ["intraday_ticks", "daily_prices", "whale_alerts", "dark_flow", "snapshots"];
const SYMBOL_GROUPS = ["VN30", "VN50", "HOSE", "HNX", "UPCOM", "ALL"];

export function SocDataOpsBackfillForm() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { runs, loading } = state;
  const [selectedDataset, setSelectedDataset] = useState("intraday_ticks");
  const [selectedGroup, setSelectedGroup] = useState("VN30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    actions.refreshRuns();
  }, []);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError(t("soc.dataops.backfill_reason_required"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        dataset: selectedDataset,
        symbol_group: selectedGroup,
        date_from: dateFrom,
        date_to: dateTo,
        reason,
      };
      const runId = await actions.triggerBackfill(payload);
      if (runId) {
        alert(t("soc.dataops.backfill_started", { runId }));
        setDateFrom("");
        setDateTo("");
        setReason("");
      } else {
        setError(t("soc.dataops.backfill_failed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.backfill_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbort = async (runId: string) => {
    if (!window.confirm(t("soc.dataops.abort_confirm"))) return;
    try {
      await actions.abortRun(runId);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Abort failed."}`);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "running": return "#34d399";
      case "completed": return "var(--accent-cyan)";
      case "failed": return "#f87171";
      case "aborted": return "#94a3b8";
      default: return "#fbbf24";
    }
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_form_title")),
      createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" } },
        createElement(
          "div",
          null,
          createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } }, t("soc.dataops.dataset")),
          createElement(
            "select",
            {
              value: selectedDataset,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDataset(e.target.value),
              className: styles.searchInput,
            },
            DATASETS.map((d) => createElement("option", { key: d, value: d }, d.replace(/_/g, " "))),
          ),
        ),
        createElement(
          "div",
          null,
          createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } }, t("soc.dataops.symbol_group")),
          createElement(
            "select",
            {
              value: selectedGroup,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedGroup(e.target.value),
              className: styles.searchInput,
            },
            SYMBOL_GROUPS.map((g) => createElement("option", { key: g, value: g }, g)),
          ),
        ),
        createElement(
          "div",
          null,
          createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } }, t("soc.dataops.date_from")),
          createElement(
            "input",
            {
              type: "date",
              value: dateFrom,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value),
              className: styles.searchInput,
            },
          ),
        ),
        createElement(
          "div",
          null,
          createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } }, t("soc.dataops.date_to")),
          createElement(
            "input",
            {
              type: "date",
              value: dateTo,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value),
              className: styles.searchInput,
            },
          ),
        ),
      ),
      createElement(
        "div",
        { style: { marginTop: "0.75rem" } },
        createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" } }, t("soc.dataops.reason")),
        createElement(
          "input",
          {
            type: "text",
            value: reason,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
            className: styles.searchInput,
            placeholder: t("soc.dataops.reason_placeholder"),
          },
        ),
      ),
      error ? createElement("div", { className: styles.inlineError, style: { marginTop: "0.75rem" } }, error) : null,
      createElement(
        "button",
        {
          onClick: handleSubmit,
          disabled: submitting,
          className: styles.actionBtn,
          style: {
            marginTop: "0.75rem",
            background: "rgba(16, 185, 129, 0.2)",
            color: "#34d399",
            cursor: submitting ? "not-allowed" : "pointer",
          },
        },
        submitting ? t("soc.dataops.submitting") : t("soc.dataops.start_backfill"),
      ),
    ),
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.recent_runs")),
      loading.runs
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading_runs"))
        : runs.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_runs"))
          : createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
              runs.slice(0, 10).map((run) =>
                createElement(
                  "div",
                  {
                    key: run.run_id,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(15, 23, 42, 0.3)",
                      border: "1px solid var(--border-default)",
                    },
                  },
                  createElement(
                    "div",
                    { style: { flex: 1 } },
                    createElement("div", { style: { fontWeight: 600, fontSize: "0.8rem" } }, run.dataset),
                    createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
                      `Run: ${run.run_id.slice(0, 8)}... \u2022 ${run.started_at?.split("T")[0] || "N/A"}`,
                    ),
                  ),
                  createElement(
                    "span",
                    {
                      className: styles.statusBadge,
                      style: { background: `${getStatusColor(run.status)}20`, color: getStatusColor(run.status) },
                    },
                    run.status,
                  ),
                  run.status === "running"
                    ? createElement(
                        "button",
                        {
                          onClick: () => handleAbort(run.run_id),
                          className: styles.actionBtn,
                          style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem", marginLeft: "0.5rem" },
                        },
                        t("soc.dataops.abort"),
                      )
                    : null,
                ),
              ),
            ),
    ),
  );
}
