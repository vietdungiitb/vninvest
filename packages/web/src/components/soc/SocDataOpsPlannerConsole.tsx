// @deprecated — Orphan (F17). Not imported anywhere (grep 0 hit).
// Kept for reference until P2 cleanup removes it. Use SocDataOpsOperationsSection as canonical.
import { createElement, useCallback, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

const PLANNER_DATASETS = [
  "daily_prices",
  "price_board_snapshot",
  "intraday_bars",
  "intraday_ticks",
  "session_facts",
];

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text-muted, #94a3b8)",
  marginBottom: "0.25rem",
  display: "block",
};

const PLANNER_PREVIEW_PAGE_SIZE = 12;

interface PreviewItem {
  symbol?: string;
  dataset?: string;
  status?: string;
  reason?: string;
  [key: string]: unknown;
}

interface PreviewResult {
  summary?: { planned_count: number; skipped_count: number };
  items?: PreviewItem[];
  skipped?: PreviewItem[];
}

export function SocDataOpsPlannerConsole() {
  const { t } = useI18n();
  const { actions } = useDataOps();

  const [symbols, setSymbols] = useState("");
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(["intraday_ticks"]);
  const [executionMode, setExecutionMode] = useState("async");
  const [reason, setReason] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [skippedPage, setSkippedPage] = useState(0);
  const [plannedExpanded, setPlannedExpanded] = useState(false);
  const [skippedExpanded, setSkippedExpanded] = useState(false);

  const adapter = defaultCoreApiAdapter as unknown as {
    previewSocDataOpsPlanner: (p: Record<string, unknown>) => Promise<PreviewResult>;
  };

  const toggleDataset = (key: string) => {
    setSelectedDatasets((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };

  const buildPayload = useCallback(() => ({
    datasets: selectedDatasets,
    symbols: symbols.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    mode: "missing_only",
    execution_mode: executionMode,
    reason: reason.trim() || "ops_soc",
    force_refresh: forceRefresh,
  }), [selectedDatasets, symbols, executionMode, reason, forceRefresh]);

  const handlePreview = async () => {
    setError(""); setSuccess(""); setPreview(null);
    setPreviewing(true);
    setPlannedPage(0);
    setSkippedPage(0);
    setPlannedExpanded(false);
    setSkippedExpanded(false);
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

  const plannedCount = preview?.summary?.planned_count ?? 0;
  const skippedCount = preview?.summary?.skipped_count ?? 0;
  const plannedItems = preview?.items ?? [];
  const skippedItems = preview?.skipped ?? [];
  const plannedTotalPages = Math.max(1, Math.ceil(plannedItems.length / PLANNER_PREVIEW_PAGE_SIZE));
  const skippedTotalPages = Math.max(1, Math.ceil(skippedItems.length / PLANNER_PREVIEW_PAGE_SIZE));
  const plannedPageItems = plannedItems.slice(plannedPage * PLANNER_PREVIEW_PAGE_SIZE, (plannedPage + 1) * PLANNER_PREVIEW_PAGE_SIZE);
  const skippedPageItems = skippedItems.slice(skippedPage * PLANNER_PREVIEW_PAGE_SIZE, (skippedPage + 1) * PLANNER_PREVIEW_PAGE_SIZE);

  const renderDatasetCheckboxes = () =>
    createElement(
      "div",
      { },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { },
        PLANNER_DATASETS.map((key) =>
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
            ),
          ),
        ),
      ),
    );

  const renderSymbolsTextarea = () =>
    createElement(
      "div",
      { },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.planner_symbols")),
      createElement("textarea", {
        className: styles.searchInput,
        placeholder: t("soc.dataops.planner_symbols_placeholder"),
        value: symbols,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setSymbols(e.target.value),
        
      }),
      createElement("p", { },
        t("soc.dataops.planner_symbols_hint")),
    );

  const renderControlsRow = () =>
    createElement(
      "div",
      { },
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_execution")),
        createElement("select", {
          value: executionMode, className: styles.searchInput,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setExecutionMode(e.target.value),
        }, ["async", "sync"].map((e) =>
          createElement("option", { key: e, value: e }, t(`soc.dataops.backfill_exec_${e}`)),
        )),
      ),
      createElement(
        "div", null,
        createElement("label", { style: LABEL_STYLE }, t("soc.dataops.reason")),
        createElement("input", {
          type: "text", value: reason, className: styles.searchInput,
          placeholder: t("soc.dataops.reason_placeholder"),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
        }),
      ),
    );

  const renderForceRefreshCheckbox = () =>
    createElement(
      "label",
      { },
      createElement("input", {
        type: "checkbox", checked: forceRefresh,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForceRefresh(e.target.checked),
        }),
      t("soc.dataops.planner_force_refresh"),
    );

  const renderActionRow = () =>
    createElement(
      "div",
      { },
      createElement(
        "button",
        {
          className: styles.actionBtn,
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

  const renderItemsTable = (
    items: PreviewItem[],
    page: number,
    totalPages: number,
    setPage: (p: number) => void,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    labelKey: string,
    count: number,
    columns: { key: string; label: string }[],
  ) => {
    if (count === 0) return null;
    const headerBtn = createElement(
      "button",
      {
        className: styles.filterBtn,
        onClick: () => setExpanded(!expanded),
        
      },
      `${t(labelKey)} (${count}) ${expanded ? "\u25B2" : "\u25BC"}`,
    );
    const tableContent = expanded
      ? createElement(
          "div",
          { },
          createElement(
            "table",
            { },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                columns.map((c) =>
                  createElement("th", {
                    key: c.key,
                    }, c.label),
                ),
              ),
            ),
            createElement(
              "tbody",
              null,
              items.map((item, i) =>
                createElement(
                  "tr",
                  { key: i },
                  columns.map((c) =>
                    createElement("td", {
                      key: c.key,
                      }, String(item[c.key] ?? "")),
                  ),
                ),
              ),
            ),
          ),
          totalPages > 1
            ? createElement(
                "div",
                { },
                createElement("button", {
                  className: styles.actionBtn,
                  onClick: () => setPage(Math.max(0, page - 1)),
                  disabled: page === 0,
                  
                }, "\u25C0"),
                createElement("span", { },
                  `${t("soc.dataops.planner_page")} ${page + 1}/${totalPages}`),
                createElement("button", {
                  className: styles.actionBtn,
                  onClick: () => setPage(Math.min(totalPages - 1, page + 1)),
                  disabled: page >= totalPages - 1,
                  
                }, "\u25B6"),
              )
            : null,
        )
      : null;
    return createElement("div", { }, headerBtn, tableContent);
  };

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
          "div", { className: styles.metricCard, onClick: () => setPlannedExpanded(!plannedExpanded),  },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: styles.metricValue,  }, String(plannedCount)),
        ),
        createElement(
          "div", { className: styles.metricCard, onClick: () => setSkippedExpanded(!skippedExpanded),  },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: styles.metricValue,  }, String(skippedCount)),
        ),
      ),
      renderItemsTable(
        plannedPageItems, plannedPage, plannedTotalPages, setPlannedPage,
        plannedExpanded, setPlannedExpanded,
        "soc.dataops.planner_planned_items", plannedCount,
        [{ key: "symbol", label: t("soc.dataops.planner_col_symbol") }, { key: "dataset", label: t("soc.dataops.planner_col_dataset") }, { key: "status", label: t("soc.dataops.planner_col_status") }],
      ),
      renderItemsTable(
        skippedPageItems, skippedPage, skippedTotalPages, setSkippedPage,
        skippedExpanded, setSkippedExpanded,
        "soc.dataops.planner_skipped_items", skippedCount,
        [{ key: "symbol", label: t("soc.dataops.planner_col_symbol") }, { key: "dataset", label: t("soc.dataops.planner_col_dataset") }, { key: "reason", label: t("soc.dataops.planner_col_reason") }],
      ),
    );
  };

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement(
      "div",
      { },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.planner_title")),
      createElement(
        "span",
        {
          },
        "planner",
      ),
    ),
    createElement("p", { },
      t("soc.dataops.planner_description")),
    renderSymbolsTextarea(),
    renderDatasetCheckboxes(),
    renderControlsRow(),
    renderForceRefreshCheckbox(),
    error ? createElement("div", { className: styles.inlineError,  }, error) : null,
    success ? createElement("div", { className: styles.inlineSuccess,  }, success) : null,
    renderActionRow(),
    renderPreviewResults(),
  );
}
