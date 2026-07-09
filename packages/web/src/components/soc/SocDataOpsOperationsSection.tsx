import { createElement, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocCustomGroupManager } from "./SocCustomGroupManager.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import styles from "./soc.module.css";

interface SymbolGroup {
  slug: string;
  name: string;
  description?: string;
  type: string;
  symbol_count?: number;
}

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

const SYMBOL_GROUPS = ["VN30", "VN50", "VN100", "HOSE", "HNX", "UPCOM", "ALL"];
const MODE_OPTIONS = ["missing_only", "force_refresh"];
const EXEC_OPTIONS = ["async", "sync"];

const CUSTOM_GROUP_KEY = "__custom__";
const PREVIEW_PAGE_SIZE = 8;

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  color: "var(--text-muted)",
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
    color: "var(--text-muted)",
    marginTop: "0.35rem",
  } as React.CSSProperties,
};

const adapter = defaultCoreApiAdapter as unknown as {
  getSocSymbolGroups: () => Promise<SymbolGroup[]>;
  getSocDataOpsRunLogs: (page: number, pageSize: number) => Promise<{ results?: RunLogEntry[]; next?: string | null }>;
  purgeSocDataOpsRunLogs: (keep: number) => Promise<void>;
  previewSocDataOpsPlanner: (p: Record<string, unknown>) => Promise<PreviewResult>;
};

export function SocDataOpsOperationsSection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { runs } = state;

  const [customGroups, setCustomGroups] = useState<SymbolGroup[]>([]);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [runLogsPage, setRunLogsPage] = useState(1);
  const [runLogsPageSize, setRunLogsPageSize] = useState(10);
  const [runLogsHasMore, setRunLogsHasMore] = useState(false);
  const [runLogsLoading, setRunLogsLoading] = useState(false);

  // Form State
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

  // Preview State
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [plannedPage, setPlannedPage] = useState(0);
  const [skippedPage, setSkippedPage] = useState(0);
  const [plannedExpanded, setPlannedExpanded] = useState(true);
  const [skippedExpanded, setSkippedExpanded] = useState(false);

  // Drawer Custom Group State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);


  const fetchCustomGroups = useCallback(async () => {
    try {
      const data = await adapter.getSocSymbolGroups();
      setCustomGroups(data.filter((g) => g.type === "custom"));
    } catch {
      setCustomGroups([]);
    }
  }, []);

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
    fetchCustomGroups();
    actions.refreshRuns();
  }, [fetchCustomGroups, actions]);

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

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "success": case "completed": return { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" };
      case "running": case "active": return { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" };
      case "failed": case "error": return { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" };
      case "partial": return { background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" };
      case "queued": case "pending": return { background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8" };
      default: return { background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8" };
    }
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
    ...SYMBOL_GROUPS.map((g) => ({ key: g, label: g, type: "builtin" })),
    ...customGroups.map((g) => ({ key: g.slug, label: g.name, type: "custom" })),
    { key: CUSTOM_GROUP_KEY, label: t("soc.dataops.backfill_custom_group_label"), type: "custom" },
  ];

  // Render Left Form Components
  const renderDatasetCheckboxes = () =>
    createElement(
      "div",
      { style: { marginBottom: "0.75rem" } },
      createElement("label", { style: LABEL_STYLE }, t("soc.dataops.backfill_datasets")),
      createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.4rem", marginTop: "0.25rem" } },
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
              style: { marginTop: "0.1rem", accentColor: "#22d3ee" },
            }),
            createElement(
              "span",
              { style: { fontSize: "0.7rem" } },
              createElement("span", { style: { fontWeight: 600, display: "block" } }, t(`soc.dataops.dataset_${ds.key}`)),
              !ds.supported
                ? createElement(
                    "span",
                    { style: { fontSize: "0.55rem", color: "var(--accent-amber)", fontWeight: 600, marginTop: "0.1rem", display: "block" } },
                    "Coming soon",
                  )
                : createElement(
                    "span",
                    { style: { fontSize: "0.6rem", color: "var(--text-muted)", display: "block", marginTop: "0.05rem" } },
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
      { style: { marginBottom: "0.75rem" } },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" } },
        createElement("label", { style: { ...LABEL_STYLE, marginBottom: 0 } }, t("soc.dataops.backfill_symbol_group")),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => setIsDrawerOpen(true),
            style: { background: "none", border: "none", color: "var(--accent-cyan)", cursor: "pointer", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" },
            title: t("soc.dataops.ops_section_custom_groups"),
          },
          "\u2699 " + t("soc.dataops.subtab.config"),
        ),
      ),
      createElement(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "0.3rem" } },
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
            { style: { marginTop: "0.5rem" } },
            createElement("label", { style: { ...LABEL_STYLE, marginBottom: "0.15rem" } }, t("soc.dataops.backfill_custom_symbols")),
            createElement("textarea", {
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              className: styles.searchInput,
              placeholder: t("soc.dataops.backfill_custom_symbols_placeholder"),
              style: { minHeight: "60px", resize: "vertical", fontSize: "0.75rem", width: "100%" },
            }),
            createElement("p", { style: { fontSize: "0.55rem", color: "var(--text-muted)", marginTop: "0.1rem" } },
              t("soc.dataops.backfill_custom_symbols_hint")),
          )
        : null,
    );

  const renderDateModeRow = () =>
    createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" } },
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
          style: { background: "rgba(0, 180, 216, 0.12)", color: "var(--accent-cyan)" },
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
            className: styles.actionBtn,
            onClick: () => handleAbort(activeRun.run_id),
            style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem" },
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
        className: styles.filterBtn,
        onClick: () => setExpanded(!expanded),
        style: {
          width: "100%", textAlign: "left", fontSize: "0.7rem",
          background: "rgba(15, 23, 42, 0.3)", border: "1px solid var(--border-default)",
          color: "var(--text-primary)", padding: "0.4rem 0.6rem",
          cursor: "pointer",
        },
      },
      `${t(labelKey)} (${count}) ${expanded ? "\u25B2" : "\u25BC"}`,
    );
    const tableContent = expanded
      ? createElement(
          "div",
          { style: { overflowX: "auto", marginTop: "0.25rem" } },
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
                { style: { display: "flex", justifyContent: "center", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem" } },
                createElement("button", {
                  className: styles.actionBtn,
                  onClick: () => setPage(Math.max(0, page - 1)),
                  disabled: page === 0,
                  style: { fontSize: "0.6rem", padding: "0.15rem 0.35rem" },
                }, "\u25C0"),
                createElement("span", { style: { fontSize: "0.65rem", color: "var(--text-muted)" } },
                  `${page + 1}/${totalPages}`),
                createElement("button", {
                  className: styles.actionBtn,
                  onClick: () => setPage(Math.min(totalPages - 1, page + 1)),
                  disabled: page >= totalPages - 1,
                  style: { fontSize: "0.6rem", padding: "0.15rem 0.35rem" },
                }, "\u25B6"),
              )
            : null,
        )
      : null;
    return createElement("div", { style: { marginTop: "0.5rem" } }, headerBtn, tableContent);
  };

  const renderPreviewResults = () => {
    if (!preview) {
      return createElement(
        "div",
        { className: styles.sectionCard, style: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "180px", color: "var(--text-muted)" } },
        createElement("span", { style: { fontSize: "2.5rem", marginBottom: "0.5rem" } }, "\u{1F5D2}"),
        createElement("p", { style: { fontSize: "0.75rem", margin: 0, textAlign: "center" } }, t("soc.dataops.planner_preview_empty")),
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
          { className: styles.metricCard, onClick: () => setPlannedExpanded(!plannedExpanded), style: { cursor: "pointer", border: plannedExpanded ? "1px solid var(--accent-cyan)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: styles.metricValue, style: { color: "var(--accent-cyan)" } }, String(plannedCount)),
        ),
        createElement(
          "div",
          { className: styles.metricCard, onClick: () => setSkippedExpanded(!skippedExpanded), style: { cursor: "pointer", border: skippedExpanded ? "1px solid var(--text-muted)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: styles.metricValue, style: { color: "#94a3b8" } }, String(skippedCount)),
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
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" } },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.run_logs")),
        createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
          createElement(
            "select",
            {
              value: runLogsPageSize,
              onChange: handlePageSizeChange,
              className: styles.searchInput,
              style: {
                width: "auto",
                padding: "0.2rem 1.8rem 0.2rem 0.5rem",
                fontSize: "0.7rem",
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px solid var(--border-default, rgba(80, 120, 168, 0.2))",
                borderRadius: "4px",
                color: "var(--text-primary)",
                cursor: "pointer",
                height: "28px"
              }
            },
            [5, 10, 15, 20].map((size) =>
              createElement("option", { key: size, value: size }, `${size} ${t("soc.dataops.run_logs_per_page")}`)
            )
          ),
          createElement(
            "button",
            {
              onClick: handlePurgeLogs,
              className: styles.actionBtn,
              style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.7rem", height: "28px" },
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
              { style: { display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" } },
              runLogs.map((log, i) =>
                createElement(
                  "div",
                  {
                    key: log.run_id || i,
                    style: {
                      padding: "0.6rem 0.75rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.25)",
                      border: "1px solid var(--border-default)",
                      fontSize: "0.75rem",
                    },
                  },
                  createElement(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                    createElement(
                      "div",
                      null,
                      createElement("span", { style: { fontWeight: 600 } }, t(`soc.dataops.dataset_${log.dataset}`) || log.dataset),
                      log.message
                        ? createElement("div", { style: { color: "var(--text-muted)", marginTop: "0.1rem", fontSize: "0.68rem" } }, log.message)
                        : null,
                    ),
                    createElement("span", {
                      className: styles.statusBadge,
                      style: { ...getStatusBadgeStyle(log.status), fontSize: "0.62rem" },
                    }, t(`soc.dataops.run_status_${log.status}`) || log.status),
                  ),
                  (log.planned != null || log.inserted != null || log.updated != null || log.skipped_existing != null || log.failed != null)
                    ? createElement(
                        "div",
                        { style: { display: "flex", gap: "0.75rem", marginTop: "0.35rem", fontSize: "0.62rem", color: "var(--text-muted)" } },
                        log.planned != null ? createElement("span", null, `${t("soc.dataops.backfill_planned")}: ${log.planned}`) : null,
                        log.inserted != null ? createElement("span", null, `${t("soc.dataops.backfill_inserted")}: ${log.inserted}`) : null,
                        log.updated != null ? createElement("span", null, `${t("soc.dataops.backfill_updated")}: ${log.updated}`) : null,
                        log.skipped_existing != null ? createElement("span", { style: { color: "#94a3b8" } }, `${t("soc.dataops.backfill_skipped")}: ${log.skipped_existing}`) : null,
                        log.failed != null ? createElement("span", { style: { color: "#f87171" } }, `${t("soc.dataops.backfill_failed")}: ${log.failed}`) : null,
                      )
                    : null,
                  createElement(
                    "div",
                    { style: { fontSize: "0.58rem", color: "var(--text-muted)", marginTop: "0.2rem" } },
                    log.started_at?.split("T").join(" ")?.slice(0, 19) || "—",
                  ),
                ),
              ),
              createElement(
                "div",
                { style: { display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" } },
                createElement(
                  "button",
                  {
                    onClick: () => setRunLogsPage((p) => Math.max(1, p - 1)),
                    disabled: runLogsPage <= 1,
                    className: styles.actionBtn,
                    style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted)" },
                  },
                  "\u25C0 " + t("soc.actions.prev"),
                ),
                createElement(
                  "span",
                  { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
                  t("soc.actions.page", { page: runLogsPage }),
                ),
                createElement(
                  "button",
                  {
                    onClick: () => setRunLogsPage((p) => p + 1),
                    disabled: !runLogsHasMore,
                    className: styles.actionBtn,
                    style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted)" },
                  },
                  t("soc.actions.next") + " \u25B6",
                ),
              ),
            ),
    );

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
    // Banner Cảnh báo / Badge Phân quyền
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "flex-end", gap: "0.5rem" } },
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
          error ? createElement("div", { className: styles.inlineError, style: { marginBottom: "0.5rem" } }, error) : null,
          success ? createElement("div", { className: styles.inlineSuccess, style: { marginBottom: "0.5rem" } }, success) : null,
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
            { style: { position: "fixed", inset: 0, zIndex: 9999 } },
            createElement("div", { className: styles.drawerOverlay, onClick: () => setIsDrawerOpen(false) }),
            createElement(
              "div",
              { className: styles.drawerContent },
              createElement(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_custom_group_label")),
                createElement(
                  "button",
                  {
                    onClick: () => setIsDrawerOpen(false),
                    className: styles.actionBtn,
                    style: { background: "rgba(100, 116, 139, 0.2)", color: "var(--text-primary)", fontSize: "0.75rem", padding: "0.25rem 0.5rem" },
                  },
                  "\u2715",
                ),
              ),
              createElement(SocCustomGroupManager, { onGroupsChanged: fetchCustomGroups }),
            ),
          ),
          document.body
        )
      : null,
  );
}

