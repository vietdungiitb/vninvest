import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
import { CUSTOM_GROUP_KEY, DEFAULT_SYMBOL_GROUP } from "../../constants/marketGroups.js";
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

interface SocBackfillCenterProps {
  customGroups?: Array<{ slug: string; name: string; type: string; symbol_count?: number; description?: string }>;
}

const ACTIVE_RUN_STYLES: Record<string, React.CSSProperties> = {
  card: {
    padding: "0.75rem",
    borderRadius: "8px",
    background: "rgba(16, 185, 129, 0.06)",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    marginBottom: "0.75rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  title: {
    fontWeight: 700,
    fontSize: "0.75rem",
    color: "#34d399",
  },
  progressBar: {
    height: "6px",
    borderRadius: "3px",
    background: "rgba(16, 185, 129, 0.15)",
    overflow: "hidden",
  } as React.CSSProperties,
  progressFill: {
      height: "100%",
      borderRadius: "3px",
      background: "linear-gradient(90deg, #34d399, #22d3ee)",
      transition: "width 0.5s ease",
    } as React.CSSProperties,
  meta: {
    display: "flex",
    gap: "0.75rem",
    fontSize: "0.6rem",
    color: "var(--text-muted, #94a3b8)",
    marginTop: "0.35rem",
  } as React.CSSProperties,
};

export function SocBackfillCenter({ customGroups: propCustomGroups = [] }: SocBackfillCenterProps) {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { runs, loading } = state;

  const { predefined, custom: apiCustomGroups } = useSymbolGroups();
  const customGroups = propCustomGroups.length > 0 ? propCustomGroups : apiCustomGroups;

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { actions.refreshRuns(); }, []);

  const isCustom = selectedGroup === CUSTOM_GROUP_KEY;

  const buildPayload = useCallback(() => ({
    datasets: selectedDatasets,
    ...(isCustom
      ? { symbols: customSymbols.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) }
      : { symbol_group: selectedGroup }
    ),
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    mode,
    dry_run: dryRun,
    execution_mode: executionMode,
    reason: reason.trim() || "ops_soc",
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedDatasets, selectedGroup, customSymbols, dateFrom, dateTo, mode, dryRun, executionMode, reason]);

  const handleRun = async () => {
    if (!reason.trim()) { setError(t("soc.dataops.backfill_reason_required")); return; }
    if (isCustom && !customSymbols.trim()) { setError(t("soc.dataops.backfill_custom_symbols_required")); return; }
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const runId = await actions.triggerBackfill(buildPayload());
      if (runId) {
        setSuccess(t("soc.dataops.backfill_started"));
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
    return t(`soc.dataops.run_status_${s}`);
  };

  const activeRun = runs.find((r) => r.status === "running" || r.status === "queued");

  const allGroups = [
    ...predefined.map((g) => ({ key: g.group_id, label: g.name, type: "builtin" })),
    ...customGroups.map((g) => ({ key: g.slug, label: g.name, type: "custom" })),
    { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label"), type: "custom" },
  ];

  const renderDatasetCheckboxes = () =>
    createElement(
      "div",
      { className: "s5_0_SocBackfillCenter",  },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { className: "s5_1_SocBackfillCenter",  },
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
              className: "s5_2_SocBackfillCenter", 
            }),
            createElement(
              "span",
              { className: "s5_3_SocBackfillCenter",  },
              createElement("span", { className: "s5_4_SocBackfillCenter",  }, t(`soc.dataops.dataset_${key}`)),
              createElement("span", { className: "s5_5_SocBackfillCenter",  },
                t(`soc.dataops.dataset_field_${key}`)),
            ),
          ),
        ),
      ),
    );

  const renderSymbolGroupRadios = () =>
    createElement(
      "div",
      { className: "s5_6_SocBackfillCenter",  },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_symbol_group")),
      createElement(
        "div",
        { className: "s5_7_SocBackfillCenter",  },
        allGroups.map((g) =>
          createElement(
            "button",
            {
              key: g.key,
              type: "button",
              className: `${styles.filterBtn} ${selectedGroup === g.key ? styles.filterBtnActive : styles.filterBtnInactive}`,
              onClick: () => setSelectedGroup(g.key),
              style: g.type === "custom" ? { border: "1px solid rgba(45, 212, 191, 0.3)" } : undefined,
            },
            g.type === "custom" ? "\u2605 " : "",
            g.label,
          ),
        ),
      ),
      isCustom
        ? createElement(
            "div",
            { className: "s5_8_SocBackfillCenter",  },
            createElement("label", { style: { ...LABEL_STYLE, marginBottom: "0.15rem" } }, t("soc.dataops.backfill_custom_symbols")),
            createElement("textarea", {
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              className: `styles.searchInput s5_9_SocBackfillCenter`,
              placeholder: t("soc.dataops.backfill_custom_symbols_placeholder"),
              
            }),
            createElement("p", { className: "s5_10_SocBackfillCenter",  },
              t("soc.dataops.backfill_custom_symbols_hint")),
          )
        : null,
    );

  const renderDateModeRow = () =>
    createElement(
      "div",
      { className: "s5_11_SocBackfillCenter",  },
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
      { className: "s5_12_SocBackfillCenter",  },
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
      { className: "s5_13_SocBackfillCenter",  },
      createElement("input", {
        type: "checkbox", checked: dryRun,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDryRun(e.target.checked),
        className: "s5_14_SocBackfillCenter", 
      }),
      t("soc.dataops.backfill_dry_run"),
    );

  const renderActiveRunBanner = () => {
    if (!activeRun) return null;
    const progress = typeof activeRun.progress === "number" ? activeRun.progress : 0;
    return createElement(
      "div",
      { style: ACTIVE_RUN_STYLES.card },
      createElement(
        "div",
        { style: ACTIVE_RUN_STYLES.header },
        createElement("span", { style: ACTIVE_RUN_STYLES.title },
          `${t("soc.dataops.backfill_active_run_label")}: ${activeRun.run_id.slice(0, 8)}...`,
        ),
        createElement(
          "button",
          {
            className: `styles.actionBtn s5_15_SocBackfillCenter`,
            onClick: () => handleAbort(activeRun.run_id),
            
          },
          t("soc.dataops.abort"),
        ),
      ),
      createElement(
        "div",
        { style: ACTIVE_RUN_STYLES.progressBar },
        createElement("div", { style: { ...ACTIVE_RUN_STYLES.progressFill, width: `${Math.min(progress, 100)}%` } }),
      ),
      createElement(
        "div",
        { style: ACTIVE_RUN_STYLES.meta },
        createElement("span", null, `${activeRun.dataset || ""}`),
        createElement("span", null, `${progress.toFixed(0)}%`),
      ),
    );
  };

  const renderActionRow = () =>
    createElement(
      "div",
      { className: "s5_16_SocBackfillCenter",  },
      createElement(
        "button",
        {
          className: styles.runBtn,
          onClick: handleRun,
          disabled: submitting || !!activeRun,
        },
        submitting ? t("soc.dataops.planner_run_loading") : t("soc.dataops.backfill_run"),
      ),
    );

  const renderRunHistory = () =>
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.run_history_title")),
      createElement("p", { className: "s5_17_SocBackfillCenter",  },
        t("soc.dataops.run_history_description")),
      loading.runs
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading_runs"))
        : runs.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_runs"))
          : createElement(
              "div",
              { className: "s5_18_SocBackfillCenter",  },
              runs.slice(0, 20).map((run) =>
                createElement(
                  "div",
                  {
                    key: run.run_id,
                    className: "s5_19_SocBackfillCenter", 
                  },
                  createElement(
                    "div",
                    { className: "s5_20_SocBackfillCenter",  },
                    createElement("div", { className: "s5_21_SocBackfillCenter",  },
                      t(`soc.dataops.dataset_${run.dataset}`) || run.dataset),
                    createElement("div", { className: "s5_22_SocBackfillCenter",  },
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
                          className: `styles.actionBtn s5_23_SocBackfillCenter`,
                          
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
    { className: "s5_24_SocBackfillCenter",  },
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_center")),
      createElement("p", { className: "s5_25_SocBackfillCenter",  },
        t("soc.dataops.backfill_context_purpose")),
      renderDatasetCheckboxes(),
      renderSymbolGroupRadios(),
      renderDateModeRow(),
      renderDryRunCheckbox(),
      renderReasonInput(),
      renderActiveRunBanner(),
      error ? createElement("div", { className: `styles.inlineError s5_26_SocBackfillCenter`,  }, error) : null,
      success ? createElement("div", { className: `styles.inlineSuccess s5_27_SocBackfillCenter`,  }, success) : null,
      renderActionRow(),
    ),
    renderRunHistory(),
  );
}
