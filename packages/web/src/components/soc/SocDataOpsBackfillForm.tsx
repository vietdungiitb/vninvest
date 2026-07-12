import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

const SUPPORTED_DATASETS = [
  "daily_prices",
  "price_board_snapshot",
  "intraday_bars",
  "intraday_ticks",
  "session_facts",
];

const SYMBOL_GROUPS = ["VN30", "VN50", "VN100", "HOSE", "HNX", "UPCOM", "ALL", "CUSTOM"];

const MODE_OPTIONS = ["missing_only", "force_refresh"];
const EXEC_OPTIONS = ["async", "sync"];

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text-muted, #94a3b8)",
  marginBottom: "0.25rem",
  display: "block",
};

interface PreviewResult {
  summary?: { planned_count: number; skipped_count: number };
  items?: Record<string, unknown>[];
  skipped?: Record<string, unknown>[];
}

export function SocDataOpsBackfillForm() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { runs, loading } = state;

  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(["intraday_ticks"]);
  const [selectedGroup, setSelectedGroup] = useState("VN30");
  const [customSymbols, setCustomSymbols] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mode, setMode] = useState("missing_only");
  const [executionMode, setExecutionMode] = useState("async");
  const [dryRun, setDryRun] = useState(false);
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const adapter = defaultCoreApiAdapter as unknown as {
    previewSocDataOpsPlanner: (p: Record<string, unknown>) => Promise<PreviewResult>;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { actions.refreshRuns(); }, []);

  const buildPayload = useCallback(() => ({
    datasets: selectedDatasets,
    symbol_group: selectedGroup === "CUSTOM" ? "custom" : selectedGroup,
    ...(selectedGroup === "CUSTOM" && customSymbols.trim() ? { symbols: customSymbols } : {}),
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    mode,
    dry_run: dryRun,
    execution_mode: executionMode,
    reason: reason.trim() || "ops_soc",
  }), [selectedDatasets, selectedGroup, customSymbols, dateFrom, dateTo, mode, dryRun, executionMode, reason]);

  const handlePreview = async () => {
    setError(""); setSuccess(""); setPreview(null);
    setPreviewing(true);
    try {
      const result = await adapter.previewSocDataOpsPlanner(buildPayload());
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.preview_failed"));
    } finally { setPreviewing(false); }
  };

  const handleRun = async () => {
    if (!reason.trim()) { setError(t("soc.dataops.backfill_reason_required")); return; }
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const runId = await actions.triggerBackfill(buildPayload());
      if (runId) {
        setSuccess(t("soc.dataops.backfill_queued_with_run", { run_id: runId }));
        setPreview(null);
      } else {
        setError(t("soc.dataops.backfill_failed"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.backfill_failed"));
    } finally { setSubmitting(false); }
  };

  const handleAbort = async (runId: string) => {
    if (!window.confirm(t("soc.dataops.abort_confirm"))) return;
    try { await actions.abortRun(runId); }
    catch (err) { setError(`Abort: ${err instanceof Error ? err.message : "Failed."}`); }
  };

  const toggleDataset = (key: string) => {
    setSelectedDatasets((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };

  const getStatusColor = (s: string): string => {
    switch (s) {
      case "running": return "#34d399";
      case "success": case "completed": return "var(--accent-cyan, #06b6d4)";
      case "failed": return "#f87171";
      case "aborted": case "cancelled": return "#94a3b8";
      default: return "#fbbf24";
    }
  };

  const getStatusI18n = (s: string): string => {
    const key = `soc.dataops.run_status_${s}`;
    return t(key);
  };

  const activeRun = runs.find((r) => r.status === "running" || r.status === "queued");
  const plannedCount = preview?.summary?.planned_count ?? 0;
  const skippedCount = preview?.summary?.skipped_count ?? 0;

  const renderDatasetCheckboxes = () =>
    createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" } },
        SUPPORTED_DATASETS.map((key) =>
          createElement(
            "label",
            {
              key,
              className: styles.dataTypeCard,
              style: {
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.35rem",
                minWidth: "150px",
                ...(selectedDatasets.includes(key) ? { borderColor: "rgba(34, 211, 238, 0.4)" } : {}),
              },
            },
            createElement("input", {
              type: "checkbox",
              checked: selectedDatasets.includes(key),
              onChange: () => toggleDataset(key),
              style: { marginTop: "0.1rem", accentColor: "#22d3ee" },
            }),
            createElement(
              "span",
              { style: { fontSize: "0.72rem" } },
              createElement("span", { style: { fontWeight: 600, display: "block" } }, t(`soc.dataops.dataset_${key}`)),
              createElement("span", { style: { fontSize: "0.62rem", color: "var(--text-muted, #94a3b8)", display: "block", marginTop: "0.1rem" } },
                t(`soc.dataops.dataset_field_${key}`)),
            ),
          ),
        ),
      ),
    );

  const renderSymbolGroupRadios = () =>
    createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_symbol_group")),
      createElement(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.25rem" } },
        SYMBOL_GROUPS.map((g) =>
          createElement(
            "button",
            {
              key: g,
              type: "button",
              className: `${styles.filterBtn} ${selectedGroup === g ? styles.filterBtnActive : styles.filterBtnInactive}`,
              onClick: () => setSelectedGroup(g),
            },
            g === "CUSTOM" ? t("soc.dataops.backfill_mode_missing_only")?.replace("Missing-only", "Custom") || "CUSTOM" : g,
          ),
        ),
      ),
      selectedGroup === "CUSTOM"
        ? createElement(
            "div",
            { style: { marginTop: "0.35rem" } },
            createElement("textarea", {
              className: styles.searchInput,
              placeholder: t("soc.dataops.planner_symbols_placeholder"),
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              style: { minHeight: "50px", resize: "vertical", fontSize: "0.75rem" },
            }),
            createElement("p", { style: { fontSize: "0.6rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.15rem" } },
              t("soc.dataops.planner_symbols_hint")),
          )
        : null,
    );

  const renderDateModeRow = () =>
    createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" } },
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_from_date")),
        createElement("input", {
          type: "date", value: dateFrom, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value),
          onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
          onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
        }),
      ),
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_to_date")),
        createElement("input", {
          type: "date", value: dateTo, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value),
          onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
          onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
        }),
      ),
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_mode")),
        createElement("select", {
          value: mode, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value),
        }, MODE_OPTIONS.map((m) =>
          createElement("option", { key: m, value: m }, t(`soc.dataops.backfill_mode_${m}`)),
        )),
      ),
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_execution")),
        createElement("select", {
          value: executionMode, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setExecutionMode(e.target.value),
        }, EXEC_OPTIONS.map((e) =>
          createElement("option", { key: e, value: e }, t(`soc.dataops.backfill_exec_${e}`)),
        )),
      ),
    );

  const renderReasonInput = () =>
    createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.reason")),
      createElement("input", {
        type: "text", value: reason, className: styles.searchInput,
        placeholder: t("soc.dataops.reason_placeholder"),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
      }),
    );

  const renderDryRunCheckbox = () =>
    createElement(
      "label",
      { style: { display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", marginBottom: "0.75rem", fontSize: "0.75rem", color: "#fbbf24" } },
      createElement("input", {
        type: "checkbox", checked: dryRun,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDryRun(e.target.checked),
        style: { accentColor: "#fbbf24" },
      }),
      t("soc.dataops.backfill_dry_run"),
    );

  const renderActionRow = () =>
    createElement(
      "div",
      { style: { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" } },
      createElement(
        "button",
        {
          className: styles.actionBtn,
          onClick: handlePreview,
          disabled: previewing || submitting,
          style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan, #06b6d4)" },
        },
        previewing ? t("soc.dataops.planner_preview_loading") : t("soc.dataops.planner_preview"),
      ),
      createElement(
        "button",
        {
          className: styles.runBtn,
          onClick: handleRun,
          disabled: submitting || previewing,
        },
        submitting ? t("soc.dataops.planner_run_loading") : t("soc.dataops.backfill_run"),
      ),
    );

  const renderPreviewResults = () => {
    if (!preview) return null;
    return createElement(
      "div",
      { style: { marginTop: "0.75rem", padding: "0.75rem", borderRadius: "8px", background: "rgba(15, 23, 42, 0.3)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
      createElement("div", { style: { fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem" } }, t("soc.dataops.planner_preview_summary")),
      createElement(
        "div",
        { className: styles.metricGrid },
        createElement(
          "div", { className: styles.metricCard },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: styles.metricValue, style: { color: "var(--accent-cyan, #06b6d4)" } }, String(plannedCount)),
        ),
        createElement(
          "div", { className: styles.metricCard },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: styles.metricValue, style: { color: "#94a3b8" } }, String(skippedCount)),
        ),
      ),
    );
  };

  const renderActiveRunBanner = () => {
    if (!activeRun) return null;
    return createElement(
      "div",
      { style: { padding: "0.6rem 0.75rem", borderRadius: "8px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", color: "#fbbf24", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" } },
      createElement(
        "span", null,
        `${t("soc.dataops.backfill_active_run_label")}: ${activeRun.run_id.slice(0, 8)}...`,
      ),
      createElement(
        "button",
        {
          className: styles.actionBtn,
          onClick: () => handleAbort(activeRun.run_id),
          style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem" },
        },
        t("soc.dataops.abort"),
      ),
    );
  };

  const renderRunHistory = () =>
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.run_history_title")),
      createElement("p", { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", margin: "0 0 0.75rem 0" } },
        t("soc.dataops.run_history_description")),
      loading.runs
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading_runs"))
        : runs.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_runs"))
          : createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "0.35rem" } },
              runs.slice(0, 20).map((run) =>
                createElement(
                  "div",
                  {
                    key: run.run_id,
                    style: {
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.4rem 0.6rem", borderRadius: "6px",
                      background: "rgba(15, 23, 42, 0.25)", border: "1px solid rgba(80, 120, 168, 0.1)",
                    },
                  },
                  createElement(
                    "div",
                    { style: { flex: 1, minWidth: 0 } },
                    createElement("div", { style: { fontWeight: 600, fontSize: "0.75rem" } },
                      t(`soc.dataops.dataset_${run.dataset}`) || run.dataset),
                    createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" } },
                      `${run.run_id.slice(0, 8)}... \u2022 ${run.started_at?.split("T")[0] || "N/A"}`),
                  ),
                  createElement(
                    "span",
                    {
                      className: styles.statusBadge,
                      style: { background: `${getStatusColor(run.status)}18`, color: getStatusColor(run.status) },
                    },
                    getStatusI18n(run.status) || run.status,
                  ),
                  run.status === "running"
                    ? createElement(
                        "button",
                        {
                          onClick: () => handleAbort(run.run_id),
                          className: styles.actionBtn,
                          style: { background: "rgba(239, 68, 68, 0.12)", color: "#f87171", fontSize: "0.6rem", marginLeft: "0.35rem" },
                        },
                        t("soc.dataops.abort"),
                      )
                    : null,
                ),
              ),
            ),
    );

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.planner_title")),
      createElement("p", { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", margin: "0 0 0.75rem 0" } },
        t("soc.dataops.planner_description")),
      renderDatasetCheckboxes(),
      renderSymbolGroupRadios(),
      renderDateModeRow(),
      renderDryRunCheckbox(),
      renderReasonInput(),
      renderActiveRunBanner(),
      error ? createElement("div", { className: styles.inlineError, style: { marginBottom: "0.5rem" } }, error) : null,
      success ? createElement("div", { className: styles.inlineSuccess, style: { marginBottom: "0.5rem" } }, success) : null,
      renderActionRow(),
      renderPreviewResults(),
    ),
    renderRunHistory(),
  );
}
