import { createElement, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocCustomGroupManager } from "./SocCustomGroupManager.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocStatusBadge } from "./SocStatusBadge.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
import { CUSTOM_GROUP_KEY, DEFAULT_SYMBOL_GROUP } from "../../constants/marketGroups.js";
import styles from "./soc.module.css";

interface RunLogEntry {
  run_id: string;
  dataset: string;
  status: string;
  started_at: string;
  message?: string;
  planned?: number;
  inserted?: number;
  updated?: number;
  skipped_existing?: number;
  failed?: number;
  [key: string]: unknown;
}

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

const DATASETS_WITH_METADATA = [
  { key: "daily_prices", supported: true },
  { key: "price_board_snapshot", supported: true },
  { key: "intraday_bars", supported: true },
  { key: "intraday_ticks", supported: true },
  { key: "session_facts", supported: true },
  { key: "whale_events", supported: false },
  { key: "order_flow", supported: false },
  { key: "dark_flow", supported: false },
];

const MODE_OPTIONS = ["missing_only", "force_refresh"];
const EXEC_OPTIONS = ["async", "sync"];
const PREVIEW_PAGE_SIZE = 8;

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text-muted, #94a3b8)",
  marginBottom: "0.25rem",
  display: "block",
};

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
    fontSize: "var(--fs-xs, 0.75rem)",
    color: "var(--color-success-500, #34d399)",
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

const adapter = defaultCoreApiAdapter as unknown as {
  getSocDataOpsRunLogs: (page: number, pageSize: number) => Promise<{ results?: RunLogEntry[]; next?: string | null }>;
  purgeSocDataOpsRunLogs: (keep: number) => Promise<void>;
  previewSocDataOpsPlanner: (p: Record<string, unknown>) => Promise<PreviewResult>;
};

export function SocDataOpsOperationsSection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { runs } = state;

  const { predefined, custom: apiCustomGroups, reload: reloadGroups } = useSymbolGroups();
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [runLogsPage, setRunLogsPage] = useState(1);
  const [runLogsPageSize, setRunLogsPageSize] = useState(10);
  const [runLogsHasMore, setRunLogsHasMore] = useState(false);
  const [runLogsLoading, setRunLogsLoading] = useState(false);

  // Form State
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

  // Preview State
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [skippedPage, setSkippedPage] = useState(0);
  const [plannedExpanded, setPlannedExpanded] = useState(true);
  const [skippedExpanded, setSkippedExpanded] = useState(false);

  // Drawer Custom Group State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchRunLogs = useCallback(async (page: number, pageSize: number) => {
    setRunLogsLoading(true);
    try {
      const data = await adapter.getSocDataOpsRunLogs(page, pageSize);
      setRunLogs(data.results || []);
      setRunLogsHasMore(!!data.next);
    } catch {
      setRunLogs([]);
    } finally {
      setRunLogsLoading(false);
    }
  }, []);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    setRunLogsPageSize(newSize);
    setRunLogsPage(1);
  };

  useEffect(() => {
    actions.refreshRuns();
  }, [actions]);

  useEffect(() => {
    fetchRunLogs(runLogsPage, runLogsPageSize);
  }, [runLogsPage, runLogsPageSize, fetchRunLogs]);

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
  }), [selectedDatasets, isCustom, selectedGroup, customSymbols, dateFrom, dateTo, mode, dryRun, executionMode, reason]);

  const handlePreview = async () => {
    if (isCustom && !customSymbols.trim()) {
      setError(t("soc.dataops.backfill_custom_symbols_required"));
      return;
    }
    setError(""); setSuccess(""); setPreview(null);
    setPreviewing(true);
    setPlannedPage(0);
    setSkippedPage(0);
    try {
      const result = await adapter.previewSocDataOpsPlanner(buildPayload());
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.preview_failed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleRun = async () => {
    if (!reason.trim()) {
      setError(t("soc.dataops.backfill_reason_required"));
      return;
    }
    if (isCustom && !customSymbols.trim()) {
      setError(t("soc.dataops.backfill_custom_symbols_required"));
      return;
    }
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const runId = await actions.triggerBackfill(buildPayload());
      setSuccess(t("soc.dataops.backfill_queued_with_run", { run_id: runId }));
      setPreview(null);
      fetchRunLogs(1, runLogsPageSize);
      setRunLogsPage(1);
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
      fetchRunLogs(1, runLogsPageSize);
    } catch (err) {
      setError(`Abort: ${err instanceof Error ? err.message : "Failed."}`);
    }
  };

  const handlePurgeLogs = async () => {
    if (!window.confirm(t("soc.dataops.purge_logs_confirm"))) return;
    try {
      await adapter.purgeSocDataOpsRunLogs(50);
      await fetchRunLogs(1, runLogsPageSize);
      setRunLogsPage(1);
    } catch (err) {
      setError(`Purge: ${err instanceof Error ? err.message : "Failed."}`);
    }
  };

  const toggleDataset = (key: string) => {
    setSelectedDatasets((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };
  const activeRun = runs.find((r) => r.status === "running" || r.status === "queued");
  const plannedCount = preview?.summary?.planned_count ?? 0;
  const skippedCount = preview?.summary?.skipped_count ?? 0;
  const plannedItems = preview?.items ?? [];
  const skippedItems = preview?.skipped ?? [];
  const plannedTotalPages = Math.max(1, Math.ceil(plannedItems.length / PREVIEW_PAGE_SIZE));
  const skippedTotalPages = Math.max(1, Math.ceil(skippedItems.length / PREVIEW_PAGE_SIZE));
  const plannedPageItems = plannedItems.slice(plannedPage * PREVIEW_PAGE_SIZE, (plannedPage + 1) * PREVIEW_PAGE_SIZE);
  const skippedPageItems = skippedItems.slice(skippedPage * PREVIEW_PAGE_SIZE, (skippedPage + 1) * PREVIEW_PAGE_SIZE);

  const allGroups = [
    ...predefined.map((g) => ({ key: g.group_id, label: g.name, type: "builtin" })),
    ...apiCustomGroups.map((g) => ({ key: g.slug, label: g.name, type: "custom" })),
    { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label"), type: "custom" },
  ];

  // Render Left Form Components
  const renderDatasetCheckboxes = () =>
    createElement(
      "div",
      { },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { },
        DATASETS_WITH_METADATA.map((ds) => {
          const isSelected = selectedDatasets.includes(ds.key);
          return createElement(
            "label",
            {
              key: ds.key,
              className: styles.dataTypeCard,
              style: {
                cursor: ds.supported ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.35rem",
                opacity: ds.supported ? 1 : 0.5,
                ...(isSelected && ds.supported ? { borderColor: "rgba(34, 211, 238, 0.4)" } : {}),
              },
            },
            createElement("input", {
              type: "checkbox",
              checked: isSelected && ds.supported,
              disabled: !ds.supported,
              onChange: () => ds.supported && toggleDataset(ds.key),
              }),
            createElement(
              "span",
              { },
              createElement("span", { }, t(`soc.dataops.dataset_${ds.key}`)),
              !ds.supported
                ? createElement(
                    "span",
                    { },
                    "Coming soon",
                  )
                : createElement(
                    "span",
                    { },
                    t(`soc.dataops.dataset_field_${ds.key}`),
                  ),
            ),
          );
        }),
      ),
    );

  const renderSymbolGroupSelect = () =>
    createElement(
      "div",
      { },
      createElement(
        "div",
        { },
        createElement("label", { style: { ...LABEL_STYLE, marginBottom: 0 } }, t("soc.dataops.backfill_symbol_group")),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => setIsDrawerOpen(true),
            title: t("soc.dataops.ops_section_custom_groups"),
          },
          "\u2699 " + t("soc.dataops.subtab.config"),
        ),
      ),
      createElement(
        "div",
        { },
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
            g.type === "custom" && g.key !== CUSTOM_GROUP_KEY ? "\u2605 " : "",
            g.label,
          ),
        ),
      ),
      isCustom
        ? createElement(
            "div",
            { },
            createElement("label", { style: { ...LABEL_STYLE, marginBottom: "0.15rem" } }, t("soc.dataops.backfill_custom_symbols")),
            createElement("textarea", {
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              className: `styles.searchInput`,
              placeholder: t("soc.dataops.backfill_custom_symbols_placeholder"),
              
            }),
            createElement("p", { },
              t("soc.dataops.backfill_custom_symbols_hint")),
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
          disabled: submitting || previewing || !!activeRun,
        },
        submitting ? t("soc.dataops.planner_run_loading") : t("soc.dataops.backfill_run"),
      ),
    );

  // Render Right Column Components
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
            className: `styles.actionBtn`,
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
        className: `styles.filterBtn`,
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
            { className: styles.previewTable },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                null,
                columns.map((c) =>
                  createElement("th", { key: c.key }, c.label),
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
                    createElement("td", { key: c.key }, String(item[c.key] ?? "")),
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
                  className: `styles.actionBtn`,
                  onClick: () => setPage(Math.max(0, page - 1)),
                  disabled: page === 0,
                  
                }, "\u25C0"),
                createElement("span", { },
                  `${page + 1}/${totalPages}`),
                createElement("button", {
                  className: `styles.actionBtn`,
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
    if (!preview) {
      return createElement(
        "div",
        { className: styles.emptyState },
        createElement(LucideIcon, { name: "ClipboardList", className: styles.emptyStateIcon }),
        createElement("p", { }, t("soc.dataops.planner_preview_empty")),
      );
    }

    return createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.planner_preview_summary")),
      createElement(
        "div",
        { className: styles.metricGrid },
        createElement(
          "div",
          { className: styles.metricCard, onClick: () => setPlannedExpanded(!plannedExpanded), style: { cursor: "pointer", border: plannedExpanded ? "1px solid var(--accent-cyan, #06b6d4)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: `styles.metricValue`,  }, String(plannedCount)),
        ),
        createElement(
          "div",
          { className: styles.metricCard, onClick: () => setSkippedExpanded(!skippedExpanded), style: { cursor: "pointer", border: skippedExpanded ? "1px solid var(--text-muted, #94a3b8)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: `styles.metricValue`,  }, String(skippedCount)),
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

  // Render Run Logs Section
  const renderRunLogsSection = () =>
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.run_logs")),
        createElement(
          "div",
          { },
          createElement(
            "select",
            {
              value: runLogsPageSize,
              onChange: handlePageSizeChange,
              className: `styles.searchInput`,
              
            },
            [5, 10, 15, 20].map((size) =>
              createElement("option", { key: size, value: size }, `${size} ${t("soc.dataops.run_logs_per_page")}`)
            )
          ),
          createElement(
            "button",
            {
              onClick: handlePurgeLogs,
              className: `styles.actionBtn`,
              
            },
            t("soc.dataops.purge_logs"),
          ),
        ),
      ),
      runLogsLoading
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"))
        : runLogs.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_run_logs"))
          : createElement(
              "div",
              { },
              runLogs.map((log, i) =>
                createElement(
                  "div",
                  {
                    key: log.run_id || i,
                    },
                  createElement(
                    "div",
                    { },
                    createElement(
                      "div",
                      null,
                      createElement("span", { }, t(`soc.dataops.dataset_${log.dataset}`) || log.dataset),
                      log.message
                        ? createElement("div", { }, log.message)
                        : null,
                    ),
                    createElement(SocStatusBadge, {
                      status: log.status,
                      label: t(`soc.dataops.run_status_${log.status}`) || log.status,
                      dot: false,
                    }),
                  ),
                  (log.planned != null || log.inserted != null || log.updated != null || log.skipped_existing != null || log.failed != null)
                    ? createElement(
                        "div",
                        { },
                        log.planned != null ? createElement("span", null, `${t("soc.dataops.backfill_planned")}: ${log.planned}`) : null,
                        log.inserted != null ? createElement("span", null, `${t("soc.dataops.backfill_inserted")}: ${log.inserted}`) : null,
                        log.updated != null ? createElement("span", null, `${t("soc.dataops.backfill_updated")}: ${log.updated}`) : null,
                        log.skipped_existing != null ? createElement("span", { }, `${t("soc.dataops.backfill_skipped")}: ${log.skipped_existing}`) : null,
                        log.failed != null ? createElement("span", { }, `${t("soc.dataops.backfill_failed")}: ${log.failed}`) : null,
                      )
                    : null,
                  createElement(
                    "div",
                    { },
                    log.started_at?.split("T").join(" ")?.slice(0, 19) || "—",
                  ),
                ),
              ),
              createElement(
                "div",
                { },
                createElement(
                  "button",
                  {
                    onClick: () => setRunLogsPage((p) => Math.max(1, p - 1)),
                    disabled: runLogsPage <= 1,
                    className: `styles.actionBtn`,
                    
                  },
                  "\u25C0 " + t("soc.actions.prev"),
                ),
                createElement(
                  "span",
                  { },
                  t("soc.actions.page", { page: runLogsPage }),
                ),
                createElement(
                  "button",
                  {
                    onClick: () => setRunLogsPage((p) => p + 1),
                    disabled: !runLogsHasMore,
                    className: `styles.actionBtn`,
                    
                  },
                  t("soc.actions.next") + " \u25B6",
                ),
              ),
            ),
    );

  return createElement(
    "div",
    { },
    // Banner Cảnh báo / Badge Phân quyền
    createElement(
      "div",
      { },
      createElement(SocOwnershipBadge, { team: "core", writable: true, accessLevel: "service_ops" }),
    ),
    // Bố cục lưới 2 cột chính
    createElement(
      "div",
      { className: styles.opsLayoutContainer },
      // Cột trái (Form cấu hình)
      createElement(
        "div",
        { className: styles.opsLeftCol },
        createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_form_title")),
          renderDatasetCheckboxes(),
          renderSymbolGroupSelect(),
          renderDateModeRow(),
          renderReasonInput(),
          renderDryRunCheckbox(),
          error ? createElement("div", { className: `styles.inlineError`,  }, error) : null,
          success ? createElement("div", { className: `styles.inlineSuccess`,  }, success) : null,
          renderActionRow(),
        ),
      ),
      // Cột phải (Active run + Preview console)
      createElement(
        "div",
        { className: styles.opsRightCol },
        renderActiveRunBanner(),
        renderPreviewResults(),
      ),
    ),
    // Phần dưới: Nhật ký chạy (Run Logs)
    renderRunLogsSection(),
    // Ngăn kéo trượt Custom Group Manager Drawer
    isDrawerOpen && typeof document !== "undefined"
      ? createPortal(
          createElement(
            "div",
            { },
            createElement("div", { className: styles.drawerOverlay, onClick: () => setIsDrawerOpen(false) }),
            createElement(
              "div",
              { className: styles.drawerContent },
              createElement(
                "div",
                { },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_custom_group_label")),
                createElement(
                  "button",
                  {
                    onClick: () => setIsDrawerOpen(false),
                    className: `styles.actionBtn`,
                    
                  },
                  "\u2715",
                ),
              ),
              createElement(SocCustomGroupManager, { onGroupsChanged: reloadGroups }),
            ),
          ),
          document.body
        )
      : null,
  );
}

