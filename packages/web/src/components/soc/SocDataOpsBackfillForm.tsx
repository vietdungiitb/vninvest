import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
import { CUSTOM_GROUP_KEY, DEFAULT_SYMBOL_GROUP } from "../../constants/marketGroups.js";
import { getStatusBadgeStyle } from "./socStatusColors.js";
import styles from "./soc.module.css";

const SUPPORTED_DATASETS = [
  "daily_prices",
  "price_board_snapshot",
  "intraday_bars",
  "intraday_ticks",
  "session_facts",
];

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

  const { predefined } = useSymbolGroups();
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(["intraday_ticks"]);
  const [selectedGroup, setSelectedGroup] = useState(DEFAULT_SYMBOL_GROUP);
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
    symbol_group: selectedGroup === CUSTOM_GROUP_KEY ? "custom" : selectedGroup,
    ...(selectedGroup === CUSTOM_GROUP_KEY && customSymbols.trim() ? { symbols: customSymbols } : {}),
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
      { },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { },
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
              }),
            createElement(
              "span",
              { },
              createElement("span", { }, t(`soc.dataops.dataset_${key}`)),
              createElement("span", { },
                t(`soc.dataops.dataset_field_${key}`)),
            ),
          ),
        ),
      ),
    );

  const renderSymbolGroupRadios = () =>
    createElement(
      "div",
      { },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_symbol_group")),
      createElement(
        "div",
        { },
        [
          ...predefined.map((g) => ({ key: g.group_id, label: g.name })),
          { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label") || "CUSTOM" },
        ].map((g) =>
          createElement(
            "button",
            {
              key: g.key,
              type: "button",
              className: `${styles.filterBtn} ${selectedGroup === g.key ? styles.filterBtnActive : styles.filterBtnInactive}`,
              onClick: () => setSelectedGroup(g.key),
            },
            g.label,
          ),
        ),
      ),
      selectedGroup === CUSTOM_GROUP_KEY
        ? createElement(
            "div",
            { },
            createElement("textarea", {
              className: `styles.searchInput`,
              placeholder: t("soc.dataops.planner_symbols_placeholder"),
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              
            }),
            createElement("p", { },
              t("soc.dataops.planner_symbols_hint")),
          )
        : null,
    );

  const renderDateModeRow = () =>
    createElement(
      "div",
      { },
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
      { },
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
      { },
      createElement("input", {
        type: "checkbox", checked: dryRun,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDryRun(e.target.checked),
        }),
      t("soc.dataops.backfill_dry_run"),
    );

  const renderActionRow = () =>
    createElement(
      "div",
      { },
      createElement(
        "button",
        {
          className: `styles.actionBtn`,
          onClick: handlePreview,
          disabled: previewing || submitting,
          
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
      { },
      createElement("div", { }, t("soc.dataops.planner_preview_summary")),
      createElement(
        "div",
        { className: styles.metricGrid },
        createElement(
          "div", { className: styles.metricCard },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: `styles.metricValue`,  }, String(plannedCount)),
        ),
        createElement(
          "div", { className: styles.metricCard },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: `styles.metricValue`,  }, String(skippedCount)),
        ),
      ),
    );
  };

  const renderActiveRunBanner = () => {
    if (!activeRun) return null;
    return createElement(
      "div",
      { },
      createElement(
        "span", null,
        `${t("soc.dataops.backfill_active_run_label")}: ${activeRun.run_id.slice(0, 8)}...`,
      ),
      createElement(
        "button",
        {
          className: `styles.actionBtn`,
          onClick: () => handleAbort(activeRun.run_id),
          
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
      createElement("p", { },
        t("soc.dataops.run_history_description")),
      loading.runs
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading_runs"))
        : runs.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_runs"))
          : createElement(
              "div",
              { },
              runs.slice(0, 20).map((run) =>
                createElement(
                  "div",
                  {
                    key: run.run_id,
                    },
                  createElement(
                    "div",
                    { },
                    createElement("div", { },
                      t(`soc.dataops.dataset_${run.dataset}`) || run.dataset),
                    createElement("div", { },
                      `${run.run_id.slice(0, 8)}... \u2022 ${run.started_at?.split("T")[0] || "N/A"}`),
                  ),
                  createElement(
                    "span",
                    {
                      className: styles.statusBadge,
                      style: { ...getStatusBadgeStyle(run.status) },
                    },
                    getStatusI18n(run.status) || run.status,
                  ),
                  run.status === "running"
                    ? createElement(
                        "button",
                        {
                          onClick: () => handleAbort(run.run_id),
                          className: `styles.actionBtn`,
                          
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
    { },
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.planner_title")),
      createElement("p", { },
        t("soc.dataops.planner_description")),
      renderDatasetCheckboxes(),
      renderSymbolGroupRadios(),
      renderDateModeRow(),
      renderDryRunCheckbox(),
      renderReasonInput(),
      renderActiveRunBanner(),
      error ? createElement("div", { className: `styles.inlineError`,  }, error) : null,
      success ? createElement("div", { className: `styles.inlineSuccess`,  }, success) : null,
      renderActionRow(),
      renderPreviewResults(),
    ),
    renderRunHistory(),
  );
}
