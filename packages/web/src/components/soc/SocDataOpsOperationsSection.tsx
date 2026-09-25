import { createElement, useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button.js";
import { createPortal } from "react-dom";
import { useI18n } from "../../context/LangContext.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocCustomGroupManager } from "./SocCustomGroupManager.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocStatusBadge } from "./SocStatusBadge.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { useSymbolGroups } from "../../hooks/useSymbolGroups.js";
import { CUSTOM_GROUP_KEY, DEFAULT_SYMBOL_GROUP } from "../../constants/marketGroups.js";
import { validateDateRange } from "./socValidation.js";
import { formatLastCheck } from "./socTime.js";
import styles from "./soc.module.css";

interface RunLogEntry {
  run_id: string;
  service_run_log_id?: number;
  status: string;
  mode?: string;
  reason?: string;
  execution_mode?: string;
  started_at: string;
  finished_at?: string | null;
  duration_seconds?: number;
  summary?: {
    planned_items?: number;
    skipped_items?: number;
    inserted?: number;
    updated?: number;
    skipped_existing?: number;
    failed?: number;
    repaired_conflicts?: number;
  };
  dataset?: string;
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

const MODE_OPTIONS = ["missing_only", "strict_fresh"];
const EXEC_OPTIONS = ["async", "sync"];
const PREVIEW_PAGE_SIZE = 8;

const adapter = defaultCoreApiAdapter as unknown as {
  getSocDataOpsRunLogs: (page: number, pageSize: number) => Promise<{ results?: RunLogEntry[]; next?: string | null }>;
  purgeSocDataOpsRunLogs: (keep: number) => Promise<void>;
  previewSocDataOpsPlanner: (p: Record<string, unknown>) => Promise<PreviewResult>;
};

export function SocDataOpsOperationsSection() {
  const { t, localeTag } = useI18n() as unknown as { t: (k: string, o?: unknown) => string; localeTag: string };
  const confirm = useConfirm();
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
  const [forceRefresh, setForceRefresh] = useState(false);
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
    fetchRunLogs(runLogsPage, runLogsPageSize);
  }, [runLogsPage, runLogsPageSize, fetchRunLogs]);

  const isCustom = selectedGroup === CUSTOM_GROUP_KEY;

  const buildPayload = useCallback(() => ({
    datasets: selectedDatasets,
    ...(isCustom
      ? { symbols: customSymbols.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) }
      : { symbol_group: selectedGroup }
    ),
    mode,
    force_refresh: forceRefresh,
    ...(dateTo ? { reference_trade_date: dateTo } : {}),
    execution_mode: executionMode,
    reason: reason.trim() || "ops_soc",
  }), [selectedDatasets, isCustom, selectedGroup, customSymbols, dateTo, mode, forceRefresh, executionMode, reason]);

  const handlePreview = async () => {
    if (selectedDatasets.length === 0) {
      setError(t("soc.dataops.backfill_dataset_required"));
      return;
    }
    if (isCustom && !customSymbols.trim()) {
      setError(t("soc.dataops.backfill_custom_symbols_required"));
      return;
    }
    {
      const dateErr = validateDateRange(dateFrom, dateTo, t);
      if (dateErr) { setError(dateErr); return; }
    }
    setError(""); setSuccess(""); setPreview(null);
    setPreviewing(true);
    setPlannedPage(0);
    setSkippedPage(0);
    try {
      const result = await adapter.previewSocDataOpsPlanner(buildPayload());
      setPreview(result);
      setPlannedExpanded(true);
      setSkippedExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.preview_failed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleRun = async () => {
    if (dryRun) {
      setError(t("soc.dataops.backfill_dry_run_blocked"));
      return;
    }
    if (selectedDatasets.length === 0) {
      setError(t("soc.dataops.backfill_dataset_required"));
      return;
    }
    if (!reason.trim()) {
      setError(t("soc.dataops.backfill_reason_required"));
      return;
    }
    if (isCustom && !customSymbols.trim()) {
      setError(t("soc.dataops.backfill_custom_symbols_required"));
      return;
    }
    {
      const dateErr = validateDateRange(dateFrom, dateTo, t);
      if (dateErr) { setError(dateErr); return; }
    }
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      const runId = await actions.triggerBackfill(buildPayload());
      if (runId) {
        setSuccess(t("soc.dataops.backfill_queued_with_run", { run_id: runId }));
      } else {
        setSuccess(t("soc.dataops.backfill_queued"));
      }
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
    const ok = await confirm({
      title: t("common.confirmTitle"),
      message: t("soc.dataops.abort_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await actions.abortRun(runId);
      fetchRunLogs(1, runLogsPageSize);
    } catch (err) {
      setError(`Abort: ${err instanceof Error ? err.message : "Failed."}`);
    }
  };

  const handlePurgeLogs = async () => {
    const ok = await confirm({
      title: t("common.confirmTitle"),
      message: t("soc.dataops.purge_logs_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
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
        createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.backfill_datasets")),
          createElement(
            "div",
            { className: styles.opsCheckboxGrid },
            DATASETS_WITH_METADATA.map((ds) => {
              const isSelected = selectedDatasets.includes(ds.key);
              return createElement(
                "label",
                {
                  key: ds.key,
                  className: [
                    styles.dataTypeCard,
                    !ds.supported ? styles.opsCheckboxLabelDisabled : "",
                    isSelected && ds.supported ? styles.opsCheckboxLabelActive : "",
                  ].filter(Boolean).join(" "),
                  style: {
                    cursor: ds.supported ? "pointer" : "not-allowed",
                    opacity: ds.supported ? 1 : 0.5,
                  },
                  title: !ds.supported ? t(`soc.dataops.dataset_field_${ds.key}`) + " — " + t("soc.dataops.backfill_dataset_coming_soon") : t(`soc.dataops.dataset_field_${ds.key}`),
                },
            createElement("input", {
              type: "checkbox",
              checked: isSelected && ds.supported,
              disabled: !ds.supported,
              onChange: () => ds.supported && toggleDataset(ds.key),
              }),
            createElement(
              "span",
              { className: styles.opsCheckboxContent },
              createElement("span", { className: styles.opsCheckboxName }, t(`soc.dataops.dataset_${ds.key}`)),
              !ds.supported
                ? createElement(
                    "span",
                    { className: styles.opsCheckboxComing },
                    t("soc.dataops.backfill_dataset_coming_soon"),
                  )
                : createElement(
                    "span",
                    { className: styles.opsCheckboxDesc },
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
        { className: styles.opsGroupHeader },
        createElement("label", { className: styles.opsFormLabel, style: { marginBottom: 0 } }, t("soc.dataops.backfill_symbol_group")),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => setIsDrawerOpen(true),
            title: t("soc.dataops.ops_section_custom_groups"),
            className: styles.actionBtn,
          },
          "\u2699 " + t("soc.dataops.subtab.config"),
        ),
      ),
      createElement(
        "div",
        { className: styles.opsGroupBar },
        allGroups.map((g) =>
          createElement(
            "button",
            {
              key: g.key,
              type: "button",
              className: `${styles.filterBtn} ${selectedGroup === g.key ? styles.filterBtnActive : styles.filterBtnInactive}`,
              onClick: () => setSelectedGroup(g.key),
              style: g.type === "custom" ? { border: "1px solid rgba(var(--soc-rgb-2dd4bf) / 0.3)" } : undefined,
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
            createElement("label", { className: styles.opsFormLabel, style: { marginBottom: "0.15rem" } }, t("soc.dataops.backfill_custom_symbols")),
            createElement("textarea", {
              value: customSymbols,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomSymbols(e.target.value),
              className: styles.searchInput,
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
        { className: styles.opsConfigFields },
        createElement(
          "div", { className: styles.opsFormField },
          createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.backfill_from_date")),
          createElement("input", {
            type: "date", value: dateFrom, className: styles.searchInput,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value),
            onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
            onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
          }),
        ),
        createElement(
          "div", { className: styles.opsFormField },
          createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.backfill_to_date")),
          createElement("input", {
            type: "date", value: dateTo, className: styles.searchInput,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value),
            onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
            onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
          }),
        ),
        createElement(
          "div", { className: styles.opsFormField },
          createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.backfill_mode")),
          createElement("select", {
            value: mode, className: styles.searchInput,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value),
          }, MODE_OPTIONS.map((m) =>
            createElement("option", { key: m, value: m }, t(`soc.dataops.backfill_mode_${m}`)),
          )),
        ),
        createElement(
          "div", { className: styles.opsFormField },
          createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.backfill_execution")),
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
        { className: styles.opsFormField },
        createElement("label", { className: styles.opsFormLabel }, t("soc.dataops.reason")),
      createElement("input", {
        type: "text", value: reason, className: styles.searchInput,
        placeholder: t("soc.dataops.reason_placeholder"),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
      }),
    );

  const renderDryRunCheckbox = () =>
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "0.4rem" } },
      createElement(
        "label",
        { className: styles.opsDryRunRow, title: t("soc.dataops.backfill_dry_run_hint") },
        createElement("input", {
          type: "checkbox", checked: dryRun,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDryRun(e.target.checked),
          }),
        t("soc.dataops.backfill_dry_run"),
      ),
      createElement(
        "label",
        { className: styles.opsDryRunRow, title: t("soc.dataops.planner_force_refresh_hint") },
        createElement("input", {
          type: "checkbox", checked: forceRefresh,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForceRefresh(e.target.checked),
          }),
        t("soc.dataops.planner_force_refresh"),
      ),
    );

  const renderActionRow = () =>
    createElement(
      "div",
      { className: styles.opsFormActions },
      createElement(
        "button",
        {
          className: styles.runBtn,
          onClick: handleRun,
          disabled: submitting || previewing || !!activeRun || selectedDatasets.length === 0,
        },
        submitting ? t("soc.dataops.planner_run_loading") : t("soc.dataops.backfill_run"),
      ),
      createElement(
        "button",
        {
          className: styles.actionBtn,
          onClick: handlePreview,
          disabled: previewing || submitting || selectedDatasets.length === 0,
          
        },
        previewing ? t("soc.dataops.planner_preview_loading") : t("soc.dataops.planner_preview"),
      ),
    );

  // Render Right Column Components
  const renderActiveRunBanner = () => {
    if (!activeRun) return null;
    const progress = typeof activeRun.progress === "number" ? activeRun.progress : 0;
    return createElement(
      "div",
      { className: styles.opsActiveBanner },
      createElement(
        "div",
        { className: styles.opsActiveBannerHeader },
        createElement("span", { className: styles.opsActiveBannerTitle },
          `${t("soc.dataops.backfill_active_run_label")}: ${activeRun.run_id.slice(0, 8)}...`,
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: () => handleAbort(activeRun.run_id),
            
          },
          t("soc.dataops.abort"),
        ),
      ),
      createElement(
        "div",
        { className: styles.progressBar },
        createElement("div", { className: styles.progressBarFill, style: { width: `${Math.min(progress, 100)}%`, background: "linear-gradient(90deg, var(--soc-c-34d399), var(--soc-c-22d3ee))" } }),
      ),
      createElement(
        "div",
        { className: styles.opsActiveBannerMeta },
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
                createElement(Button, {
                    className: styles.actionBtn,
                    variant: "ghost",
                    size: "sm",
                    onClick: () => setPage(Math.max(0, page - 1)),
                    disabled: page === 0,
                  
                }, "\u25C0"),
                createElement("span", { },
                  `${page + 1}/${totalPages}`),
                createElement(Button, {
                    className: styles.actionBtn,
                    variant: "ghost",
                    size: "sm",
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
    return createElement(
      "div",
      { },
      createElement(
        "div",
        { className: styles.metricGrid },
        createElement(
          "div",
          { className: styles.metricCard, onClick: () => setPlannedExpanded(!plannedExpanded), style: { cursor: "pointer", border: plannedExpanded ? "1px solid var(--accent-cyan, #06b6d4)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_planned_items")),
          createElement("div", { className: styles.metricValue }, String(plannedCount)),
        ),
        createElement(
          "div",
          { className: styles.metricCard, onClick: () => setSkippedExpanded(!skippedExpanded), style: { cursor: "pointer", border: skippedExpanded ? "1px solid var(--text-muted, #94a3b8)" : undefined } },
          createElement("div", { className: styles.metricLabel }, t("soc.dataops.planner_skipped_items")),
          createElement("div", { className: styles.metricValue }, String(skippedCount)),
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
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" } },
        createElement("div", { className: styles.sectionCardTitle, style: { margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" } }, createElement(LucideIcon, { name: "Clock", className: "h-4 w-4" }), t("soc.dataops.run_logs"), createElement("span", { style: { fontSize: "var(--fs-xs)", fontWeight: 400, color: "var(--text-muted)" } }, `· ${runLogs.length} runs`)),
        createElement(
          "div",
          { },
          createElement(
            "select",
            {
              value: runLogsPageSize,
              onChange: handlePageSizeChange,
              className: styles.searchInput,
              
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
              { className: styles.opsTimeline, style: { display: "flex", flexDirection: "column", gap: "0.5rem", position: "relative", paddingLeft: "0.5rem", borderLeft: "1px solid var(--border-default, rgba(80,120,168,0.12))" } },
              runLogs.map((log, i) => {
                const summary = (log.summary as Record<string, number>) || {};
                const planned = summary.planned_items ?? (log as Record<string, unknown>).planned as number | undefined;
                const inserted = summary.inserted ?? log.inserted;
                const updated = summary.updated ?? log.updated;
                const skipped = summary.skipped_existing ?? log.skipped_existing;
                const failed = summary.failed ?? log.failed;
                const hasStats = planned != null || inserted != null || updated != null || skipped != null || failed != null;
                const timeInfo = (() => {
                  try {
                    return formatLastCheck(log.started_at, localeTag || "vi-VN", t);
                  } catch {
                    return { display: log.started_at?.slice(0, 19) || "—", title: log.started_at || "" };
                  }
                })();
                const duration = log.duration_seconds != null ? `${Number(log.duration_seconds).toFixed(1)}s` : log.finished_at ? "—" : "";
                return createElement(
                  "div",
                  {
                    key: log.run_id || i,
                    className: styles.opsRunLogCard,
                    style: { borderLeft: `3px solid ${log.status === "success" ? "var(--soc-c-34d399)" : log.status === "failed" ? "var(--soc-c-f87171)" : log.status === "running" || log.status === "queued" ? "var(--soc-c-22d3ee)" : "var(--soc-c-94a3b8)"}` },
                  },
                  createElement(
                    "div",
                    { className: styles.opsRunLogRow },
                    createElement("span", { style: { fontWeight: 700, fontFamily: "Menlo, monospace", fontSize: "var(--fs-sm)" } }, log.run_id || `run-${i}`),
                    createElement(SocStatusBadge, {
                      status: log.status,
                      label: log.status ? t(`soc.dataops.run_status_${log.status}`) || log.status : t("soc.dataops.run_status_unknown"),
                      dot: true,
                    }),
                    createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginLeft: "0.35rem" } }, log.mode ? t(`soc.dataops.backfill_mode_${log.mode}`) || log.mode : ""),
                    log.execution_mode ? createElement("span", { style: { fontSize: "var(--fs-xs)", padding: "0.1rem 0.35rem", borderRadius: "4px", background: "rgba(var(--soc-rgb-94a3b8) / 0.12)", color: "var(--soc-c-94a3b8)" } }, log.execution_mode) : null,
                  ),
                  createElement(
                    "div",
                    { className: styles.opsRunLogMeta, style: { display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" } },
                    createElement("span", { title: (timeInfo as { title: string }).title, style: { fontSize: "var(--fs-xs)" } }, (timeInfo as { display: string }).display),
                    duration ? createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)" } }, `· ${duration}`) : null,
                    log.reason ? createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--soc-c-94a3b8)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: String(log.reason) }, String(log.reason)) : null,
                  ),
                  hasStats
                    ? createElement(
                        "div",
                        { className: styles.opsRunLogStats },
                        planned != null ? createElement("span", { className: styles.opsRunLogStat }, `Planned ${planned}`) : null,
                        inserted != null ? createElement("span", { className: styles.opsRunLogStat }, `Inserted ${inserted}`) : null,
                        updated != null ? createElement("span", { className: styles.opsRunLogStat }, `Updated ${updated}`) : null,
                        skipped != null ? createElement("span", { className: styles.opsRunLogStat }, `Skipped ${skipped}`) : null,
                        failed != null ? createElement("span", { className: styles.opsRunLogStat, style: { color: Number(failed) > 0 ? "var(--soc-c-f87171)" : undefined } }, `Failed ${failed}`) : null,
                      )
                    : null,
                );
              }),
              createElement(
                "div",
                { },
                createElement(
                  "button",
                  {
                    onClick: () => setRunLogsPage((p) => Math.max(1, p - 1)),
                    disabled: runLogsPage <= 1,
                    className: styles.actionBtn,
                    
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
                    className: styles.actionBtn,
                    
                  },
                  t("soc.actions.next") + " \u25B6",
                ),
              ),
            ),
    );

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    createElement(
      "div",
      { },
      createElement(SocOwnershipBadge, { team: "core", writable: true, accessLevel: "service_ops" }),
    ),
      createElement(
        "div",
        { className: styles.sectionCard },
        createElement("div", { className: styles.sectionCardTitle, style: { display: "flex", alignItems: "center", gap: "0.5rem" } }, createElement(LucideIcon, { name: "Rocket", className: "h-4 w-4" }), t("soc.dataops.backfill_form_title"), createElement("span", { style: { fontSize: "var(--fs-xs)", fontWeight: 400, color: "var(--text-muted)", marginLeft: "0.5rem" } }, t("soc.dataops.backfill_context_purpose", { defaultValue: "Bổ sung dữ liệu thiếu" })) ),
        createElement(
          "div",
          { className: styles.opsFormGrid },
          // Row 1 — Nhóm mã dàn đều full width (1 cột lớn) — fix "thu gọn cột 1, cột 2 trống vô duyên"
          createElement(
            "div",
            { style: { gridColumn: "1 / -1" } },
            createElement("div", { className: styles.opsSectionHeader }, createElement(LucideIcon, { name: "Users", className: "h-3.5 w-3.5" }), t("soc.dataops.backfill_symbol_group")),
            renderSymbolGroupSelect(),
          ),
          // Row 2 — 2 cột đều: trái Datasets, phải Execution
          createElement(
            "div",
            { className: styles.opsFormLeft },
            createElement("div", { className: styles.opsSectionHeader }, createElement(LucideIcon, { name: "Layers", className: "h-3.5 w-3.5" }), t("soc.dataops.backfill_datasets")),
            renderDatasetCheckboxes(),
          ),
          createElement(
            "div",
            { className: styles.opsFormRight },
            createElement("div", { className: styles.opsSectionHeader }, createElement(LucideIcon, { name: "Settings", className: "h-3.5 w-3.5" }), t("soc.dataops.ops_section_execution", { defaultValue: "Cấu hình thực thi" } as unknown as string)),
            renderDateModeRow(),
            createElement("div", { style: { height: "0.6rem" } }),
            renderReasonInput(),
            createElement("div", { style: { height: "0.5rem" } }),
            renderDryRunCheckbox(),
          ),
        ),
        error ? createElement("div", { className: styles.inlineError, style: { marginTop: "0.75rem" } }, error) : null,
        success ? createElement("div", { className: styles.inlineSuccess }, success) : null,
        renderActionRow(),
        renderActiveRunBanner(),
        preview ? createElement("div", { style: { marginTop: "1rem", borderTop: "1px solid var(--border-default, rgba(80,120,168,0.15))", paddingTop: "1rem" } }, renderPreviewResults()) : null,
      ),
    renderRunLogsSection(),
    // Custom Group Drawer
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
                { className: styles.opsDrawerHeader },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.backfill_custom_group_label")),
                createElement(
                  "button",
                  {
                    onClick: () => setIsDrawerOpen(false),
                    className: styles.opsDrawerClose,
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
    // Preview inline (was drawer) — now rendered above inside sectionCard
  );
}

