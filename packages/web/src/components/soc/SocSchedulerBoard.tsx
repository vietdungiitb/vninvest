import { createElement, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor, getStatusBadgeStyle } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface SchedulerJob {
  job_key: string;
  display_name?: string;
  domain: string;
  status: string;
  freshness_state?: string;
  next_run_at?: string;
  lag_seconds?: number;
  capabilities?: string[];
  control_mode?: string;
  is_inflight?: boolean;
  is_possibly_stuck?: boolean;
  inflight_elapsed_seconds?: number;
  trigger_type?: string;
  [key: string]: unknown;
}

interface SchedulerHealth {
  overall_health: string;
  jobs_total: number;
  enabled_count: number;
  degraded_count: number;
  by_status?: {
    running?: number;
    [key: string]: number | undefined;
  };
  by_freshness?: {
    stale?: number;
    [key: string]: number | undefined;
  };
  [key: string]: unknown;
}

interface JobRunHistory {
  count: number;
  total_pages: number;
  previous: boolean;
  next: boolean;
  results: {
    id: string;
    status: string;
    started_at: string;
    duration_seconds?: number;
    celery_task_id?: string;
    [key: string]: unknown;
  }[];
}

interface SocSchedulerBoardProps {
  domain?: string;
  onAction?: (jobKey: string, action: string, reason: string) => Promise<void>;
  hideHeaderTitle?: boolean;
}

const RISKY_ACTIONS = new Set(["disable", "abort"]);
const DOMAIN_FILTER_OPTIONS = ["all", "market_data", "signals", "whale", "platform", "maintenance"];

const getStatusStyles = (status: string) => getStatusBadgeStyle(status);

const getFreshnessColor = (freshness?: string) => {
  switch (freshness) {
    case "fresh": return toneColor("success");
    case "warm": return toneColor("info");
    case "stale": return toneColor("warning");
    case "missing": return "#64748b";
    default: return "var(--color-text-muted, #94a3b8)";
  }
};

function formatLag(seconds?: number) {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} ng\xE0y ${rh}h` : `${d} ng\xE0y`;
}

function formatNextRun(dateStr?: string, triggerType?: string) {
  if (!dateStr) {
    if (triggerType === "cron") return "—";
    return "—";
  }
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return dateStr;
  }
}

function domainBadgeClass(domain: string): string {
  const d = domain.toLowerCase();
  if (d.startsWith("platform")) return styles.schedulerDomainBadgePlatform;
  if (d.startsWith("dataops") || d.startsWith("data")) return styles.schedulerDomainBadgeDataops;
  if (d.startsWith("material")) return styles.schedulerDomainBadgeMaterialization;
  if (d.startsWith("prefetch")) return styles.schedulerDomainBadgePrefetch;
  return styles.schedulerDomainBadgePlatform;
}

// ─── Health summary strip ─────────────────────────────────────────────────────
function SchedulerHealthStrip({ health, t }: { health: SchedulerHealth | null; t: (key: string, o?: any) => string }) {
  if (!health) return null;
  const healthColor = health.overall_health === "healthy"
    ? toneColor("success")
    : health.overall_health === "degraded"
      ? toneColor("warning")
      : toneColor("danger");

  return createElement(
    "div",
    { className: styles.schedulerHealthStrip },
    createElement(
      "span",
      { className: styles.schedulerHealthBadge, style: { color: healthColor } },
      health.overall_health
    ),
    createElement(
      "span",
      { className: styles.schedulerHealthItem },
      `${t("soc.scheduler.health_total")}: `,
      createElement("span", { className: styles.schedulerHealthValue }, health.jobs_total)
    ),
    createElement(
      "span",
      { className: styles.schedulerHealthItem },
      `${t("soc.scheduler.health_enabled")}: `,
      createElement("span", { className: styles.schedulerHealthValue }, health.enabled_count)
    ),
    createElement(
      "span",
      { className: styles.schedulerHealthItem },
      `${t("soc.scheduler.health_degraded")}: `,
      createElement("span", { className: styles.schedulerHealthValue }, health.degraded_count)
    ),
    createElement(
      "span",
      { className: styles.schedulerHealthItem },
      `${t("soc.scheduler.health_inflight")}: `,
      createElement("span", { className: styles.schedulerHealthValue }, health.by_status?.running || 0)
    ),
    createElement(
      "span",
      { className: styles.schedulerHealthItem },
      `${t("soc.scheduler.health_stale")}: `,
      createElement(
        "span",
        { className: styles.schedulerHealthValue, style: { color: health.by_freshness?.stale ? toneColor("danger") : undefined } },
        health.by_freshness?.stale || 0
      )
    )
  );
}

// ─── Action Button row for a single job ───────────────────────────────────────
function JobActionButtons({
  job,
  onAction,
  t
}: {
  job: SchedulerJob;
  onAction: (job: SchedulerJob, action: string) => void;
  t: (key: string, o?: any) => string;
}) {
  const normalizedCaps = (() => {
    const rawCaps = Array.isArray(job.capabilities) ? job.capabilities : [];
    const mapped = rawCaps.map((cap) => (cap === "abort_active" ? "abort" : cap));

    if (mapped.length > 0) {
      return mapped;
    }

    const mode = String(job.control_mode || "").toLowerCase();
    if (mode === "manual_only" || mode === "beat_read_only") {
      return ["run_now"];
    }
    if (mode === "platform_managed") {
      return [];
    }
    // COC-54: don't grant abort by default — only if capabilities explicitly allow it
    return ["enable", "disable", "run_now"];
  })();

  const isRunning = job.is_inflight;
  const isJobDisabled = job.status === "disabled";

  const btn = (action: string, label: string, variantClass: string) => {
    const supported = normalizedCaps.includes(action);
    const lockedByRunning = isRunning && action === "run_now";

    return createElement(
      "button",
      {
        key: action,
        type: "button",
        disabled: !supported || lockedByRunning,
        onClick: () => onAction(job, action),
        className: `${styles.schedulerActionCapsule} ${variantClass}`,
      },
      label
    );
  };

  return createElement(
    "div",
    { className: styles.schedulerActionsRow },
    isJobDisabled
      ? btn("enable", t("soc.scheduler.action_enable"), styles.schedulerActionEnable)
      : btn("disable", t("soc.scheduler.action_disable"), styles.schedulerActionDisable),
    btn("run_now", t("soc.scheduler.action_run_now"), styles.schedulerActionRunNow),
    btn("abort", t("soc.scheduler.action_abort"), styles.schedulerActionAbort)
  );
}

// ─── Confirm action modal ────────────────────────────────────────────────────
function ActionConfirmModal({
  job,
  action,
  onConfirm,
  onCancel,
  t
}: {
  job: SchedulerJob;
  action: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  t: (key: string, o?: any) => string;
}) {
  const [reason, setReason] = useState("");
  return createElement(
    "div",
    { className: styles.schedulerModalOverlay, onClick: onCancel },
    createElement(
      "div",
      { className: styles.schedulerModalCard, onClick: (e: any) => e.stopPropagation() },
      createElement("h3", { className: styles.schedulerModalTitle }, t("soc.scheduler.confirm_title")),
      createElement(
        "p",
        { className: styles.schedulerModalBody },
        createElement("span", { className: styles.schedulerModalAction }, action),
        " \u2014 ",
        job.job_key
      ),
      createElement("label", { className: styles.schedulerModalField }, t("soc.scheduler.reason_label")),
      createElement("textarea", {
        className: styles.schedulerModalTextarea,
        rows: 2,
        placeholder: t("soc.scheduler.reason_placeholder"),
        value: reason,
        onChange: (e: any) => setReason(e.target.value),
      }),
      createElement(
        "div",
        { className: styles.schedulerModalActions },
        createElement(
          "button",
          { type: "button", onClick: onCancel, className: styles.schedulerModalCancel },
          t("common.cancel")
        ),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => onConfirm(reason),
            disabled: !reason.trim(),
            className: styles.schedulerModalProceed,
          },
          t("soc.scheduler.confirm_proceed")
        )
      )
    )
  );
}

// ─── Job history drawer ───────────────────────────────────────────────────────
function JobHistoryDrawer({
  jobKey,
  onClose,
  t
}: {
  jobKey: string;
  onClose: () => void;
  t: (key: string, o?: any) => string;
}) {
  const [history, setHistory] = useState<JobRunHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocSchedulerJobHistory: (jobKey: string, page: number, pageSize: number) => Promise<JobRunHistory>;
      };
      const data = await adapter.getSocSchedulerJobHistory(jobKey, p, 15);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.error_load_history"));
    } finally {
      setLoading(false);
    }
  }, [jobKey, t]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return createElement(
    "div",
    null,
    createElement("div", { className: styles.drawerOverlay, onClick: onClose }),
    createElement(
      "div",
      { className: styles.drawerContent, onClick: (e: any) => e.stopPropagation() },
      createElement(
        "div",
        { className: styles.schedulerDrawerHeader },
        createElement(
          "div",
          { className: styles.schedulerDrawerInfo },
          createElement("p", { className: styles.schedulerDrawerTitle }, t("soc.scheduler.history_drawer_title")),
          createElement("p", { className: styles.schedulerDrawerSub }, jobKey)
        ),
        createElement("button", { type: "button", onClick: onClose, className: styles.schedulerDrawerClose }, "\u2715")
      ),
      loading && createElement("p", { className: styles.schedulerDrawerCount }, t("common.loading")),
      error && createElement("p", { className: styles.schedulerDrawerCount, style: { color: toneColor("danger") } }, error),
      history && !loading && createElement(
        "div",
        null,
        createElement(
          "p",
          { className: styles.schedulerDrawerCount },
          t("soc.scheduler.history_count", { count: history.count })
        ),
        history.results.length === 0
          ? createElement("p", { className: styles.schedulerDrawerCount }, t("soc.scheduler.history_empty"))
          : createElement(
              "table",
              { className: styles.coverageTable },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", null, t("soc.scheduler.history_col_status")),
                  createElement("th", null, t("soc.scheduler.history_col_started")),
                  createElement("th", null, t("soc.scheduler.history_col_duration")),
                  createElement("th", null, t("soc.scheduler.history_col_task_id"))
                )
              ),
              createElement(
                "tbody",
                null,
                history.results.map((run) => {
                   const statusStyles = getStatusStyles(run.status);
                   return createElement(
                     "tr",
                     { key: run.id },
                     createElement("td", null,
                       createElement(
                         "span",
                         { className: styles.schedulerStatusBadge, style: statusStyles },
                         run.status
                       )
                     ),
                     createElement("td", { style: { fontSize: "0.7rem" } }, run.started_at || "\u2014"),
                     createElement("td", { style: { fontSize: "0.7rem", fontVariantNumeric: "tabular-nums" } }, run.duration_seconds != null ? `${run.duration_seconds}s` : "\u2014"),
                     createElement("td", { style: { fontSize: "0.65rem", fontFamily: "monospace", wordBreak: "break-all", maxWidth: "200px" } }, run.celery_task_id || "\u2014")
                   );
                })
              )
            ),
        history.total_pages > 1 && createElement(
          "div",
          { className: styles.schedulerDrawerPagination },
          createElement(
            "span",
            { className: styles.schedulerDrawerPageInfo },
            `${t("soc.dataops.run_history_page")} ${page}/${history.total_pages || 1}`
          ),
          createElement(
            "div",
            { className: styles.schedulerDrawerPageBtns },
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.previous,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
                className: styles.pageBtnSmall,
              },
              t("soc.dataops.run_history_previous")
            ),
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.next,
                onClick: () => setPage((p) => p + 1),
                className: styles.pageBtnSmall,
              },
              t("soc.dataops.run_history_next")
            )
          )
        )
      )
    )
  );
}

// ─── Main SchedulerBoard ──────────────────────────────────────────────────────
export function SocSchedulerBoard({ domain: domainProp, onAction, hideHeaderTitle }: SocSchedulerBoardProps) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<{ jobs?: SchedulerJob[]; generated_at?: string } | null>(null);
  const [health, setHealth] = useState<SchedulerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [confirmModal, setConfirmModal] = useState<{ job: SchedulerJob; action: string } | null>(null);
  const [historyJob, setHistoryJob] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: "success" | "error"; msg: string; requestId?: string } | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocSchedulerPlan: () => Promise<{ jobs?: SchedulerJob[]; generated_at?: string }>;
        getSocSchedulerHealth: () => Promise<SchedulerHealth>;
      };
      const [planData, healthData] = await Promise.all([
        adapter.getSocSchedulerPlan(),
        adapter.getSocSchedulerHealth(),
      ]);
      setPlan(planData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.error_load_scheduler"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    const jitter = Math.random() * 3000;
    const interval = setInterval(() => {
      if (document.hidden) return;
      load();
    }, 60000 + jitter);
    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const executeAction = useCallback(async (jobKey: string, action: string, reason: string) => {
    setConfirmModal(null);
    try {
      if (onAction) {
        await onAction(jobKey, action, reason);
      } else {
        const adapter = defaultCoreApiAdapter as unknown as {
          postSocSchedulerJobAction: (jobKey: string, action: string, reason: string) => Promise<{ message?: string; request_id?: string }>;
        };
        const result = await adapter.postSocSchedulerJobAction(jobKey, action, reason);
        setActionBanner({
          type: "success",
          msg: result.message || t("soc.scheduler.action_success"),
          requestId: result.request_id,
        });
      }
      load();
    } catch (err) {
      setActionBanner({
        type: "error",
        msg: err instanceof Error ? err.message : t("soc.scheduler.action_error"),
      });
    }
    setTimeout(() => setActionBanner(null), 6000);
  }, [load, t, onAction]);

  const handleAction = useCallback((job: SchedulerJob, action: string) => {
    if (RISKY_ACTIONS.has(action)) {
      setConfirmModal({ job, action });
    } else {
      executeAction(job.job_key, action, "");
    }
  }, [executeAction]);

  const embedded = domainProp != null;
  const effectiveDomainFilter = embedded && !showAllDomains ? domainProp : domainFilter;
  const activeDomainFilter = embedded && !showAllDomains ? domainProp as string : effectiveDomainFilter;

  const filteredJobs = plan?.jobs?.filter(
    (j) => activeDomainFilter === "all" || j.domain === activeDomainFilter
  ) ?? [];
  const totalJobs = plan?.jobs?.length ?? 0;

  return createElement(
    "div",
    { className: styles.schedulerWrap },

    // Health strip — always visible (COC-20: DataOps embedded needs strip)
    createElement(SchedulerHealthStrip, { health, t }),

    // Action banner
    actionBanner && createElement(
      "div",
      {
        className: `${styles.schedulerActionBanner} ${actionBanner.type === "success" ? styles.schedulerActionBannerSuccess : styles.schedulerActionBannerError}`,
      },
      createElement("span", null, actionBanner.msg),
      actionBanner.requestId && createElement("span", { style: { opacity: 0.6, fontSize: "0.65rem", fontFamily: "monospace" } }, actionBanner.requestId)
    ),

    // Header row
    createElement(
      "div",
      { className: styles.schedulerHeader },
      createElement(
        "div",
        { className: styles.schedulerHeaderLeft },
        !hideHeaderTitle && createElement("h3", { className: styles.schedulerTitle }, t("soc.scheduler.board_title")),
        plan?.generated_at && createElement(
          "p",
          { className: styles.schedulerTimestamp },
          `${t("soc.scheduler.board_generated_at")}: ${new Date(plan.generated_at).toLocaleString("vi-VN")}`
        ),
        plan && createElement(
          "p",
          { className: styles.schedulerTimestamp, style: { fontSize: "0.7rem", opacity: 0.85 } },
          embedded
            ? `${t("soc.scheduler.filter_count", { filtered: filteredJobs.length, total: totalJobs })} — ${showAllDomains ? t("soc.scheduler.filter_all_domains") : domainProp}`
            : `${t("soc.scheduler.health_total")}: ${totalJobs}`
        ),
        embedded && totalJobs > 0 && createElement(
          "button",
          {
            type: "button",
            onClick: () => setShowAllDomains((v) => !v),
            className: styles.pageBtnSmall,
            style: { marginTop: "0.25rem", fontSize: "0.7rem" },
          },
          showAllDomains ? `${t("soc.scheduler.filter_show_dataops_only")} (${filteredJobs.length})` : `${t("soc.scheduler.filter_show_all")} (${totalJobs})`
        )
      ),
      createElement(
        "div",
        { className: styles.schedulerHeaderRight },
        !embedded && createElement(
          "select",
          {
            value: domainFilter,
            onChange: (e: any) => setDomainFilter(e.target.value),
            className: styles.jobDomainSelect,
          },
          DOMAIN_FILTER_OPTIONS.map((d) =>
            createElement("option", { key: d, value: d },
              d === "all" ? t("soc.scheduler.filter_all_domains") : d
            )
          )
        ),
        createElement(
          "button",
          {
            type: "button",
            onClick: load,
            disabled: loading,
            className: styles.pageBtnSmall,
          },
          loading ? t("common.loading") : t("common.refresh")
        )
      )
    ),

    // Error banner
    error && createElement("div", { className: styles.inlineError }, error),

    // Table Content
    !error && createElement(
      "div",
      { className: styles.schedulerTableWrap },
      createElement(
        "table",
        { className: styles.coverageTable },
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            createElement("th", null, t("soc.scheduler.col_job")),
            createElement("th", null, t("soc.scheduler.col_domain")),
            createElement("th", null, t("soc.scheduler.col_status")),
            createElement("th", null, t("soc.scheduler.col_freshness")),
            createElement("th", null, t("soc.scheduler.col_next_run")),
            createElement("th", null, t("soc.scheduler.col_lag")),
            createElement("th", null, t("soc.scheduler.col_actions")),
            createElement("th", null, t("soc.scheduler.col_history"))
          )
        ),
        createElement(
          "tbody",
          null,
          filteredJobs.length === 0
            ? createElement(
                "tr",
                null,
                createElement("td", { colSpan: 8, style: { textAlign: "center", padding: "2rem", color: "var(--text-muted, #94a3b8)" } },
                  t("soc.scheduler.empty_state")
                )
              )
            : filteredJobs.map((job) => {
                const statusStyles = getStatusStyles(job.status);
                const freshnessColor = getFreshnessColor(job.freshness_state);

                return createElement(
                  "tr",
                  { key: job.job_key },
                  createElement(
                    "td",
                    null,
                    createElement(
                      "div",
                      { className: styles.schedulerJobCell },
                      createElement("span", { className: styles.schedulerJobKey }, job.job_key),
                      job.display_name && createElement("span", { className: styles.schedulerJobDesc }, job.display_name)
                    )
                  ),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "span",
                      { className: `${styles.schedulerDomainBadge} ${domainBadgeClass(job.domain)}` },
                      job.domain
                    )
                  ),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "span",
                      { className: styles.schedulerStatusBadge, style: statusStyles },
                      t(`soc.scheduler.status_${job.status}`, { defaultValue: job.status })
                    ),
                    (job.is_inflight || job.is_possibly_stuck) && createElement(
                      "div",
                      { className: styles.schedulerStatusIndicators },
                      job.is_inflight && createElement(
                        "span",
                        { className: styles.schedulerLiveDot },
                        createElement("span", { className: styles.pulsingDot }),
                        t("soc.dataops.indicator_live")
                      ),
                      job.is_possibly_stuck && createElement(
                        "span",
                        { className: styles.schedulerStuckBadge, title: t("soc.scheduler.tooltip_stuck") },
                        t("soc.scheduler.badge_stuck")
                      ),
                      job.is_possibly_stuck && job.inflight_elapsed_seconds != null && createElement(
                        "span",
                        { className: styles.schedulerStuckElapsed },
                        `${Math.floor(job.inflight_elapsed_seconds / 3600)}h${Math.floor((job.inflight_elapsed_seconds % 3600) / 60)}m`
                      )
                    )
                  ),
                  createElement(
                    "td",
                    null,
                    createElement(
                      "span",
                      { className: styles.schedulerFreshness, style: { color: freshnessColor } },
                      job.freshness_state ? t(`soc.scheduler.freshness_${job.freshness_state}`, { defaultValue: job.freshness_state }) : "\u2014"
                    )
                  ),
                  createElement("td", { style: { fontSize: "0.7rem", fontVariantNumeric: "tabular-nums" }, title: !job.next_run_at && job.trigger_type === "cron" ? t("soc.scheduler.cron_tooltip", { label: job.display_name || job.job_key }) : undefined }, !job.next_run_at && job.trigger_type === "cron" ? t("soc.scheduler.not_scheduled") : formatNextRun(job.next_run_at, job.trigger_type)),
                  createElement("td", { style: { fontSize: "0.7rem", fontVariantNumeric: "tabular-nums" } }, formatLag(job.lag_seconds)),
                  createElement("td", null, createElement(JobActionButtons, { job, onAction: handleAction, t })),
                  createElement("td", null,
                    createElement(
                      "button",
                      {
                        type: "button",
                        onClick: () => setHistoryJob(job.job_key),
                        className: styles.schedulerHistoryBtn,
                      },
                      t("soc.scheduler.view_history")
                    )
                  )
                );
              })
        )
      )
    ),

    // Confirm Modal
    confirmModal && createPortal(
      createElement(ActionConfirmModal, {
        job: confirmModal.job,
        action: confirmModal.action,
        onConfirm: (reason) => executeAction(confirmModal.job.job_key, confirmModal.action, reason),
        onCancel: () => setConfirmModal(null),
        t
      }),
      document.body
    ),

    // History Drawer
    historyJob && typeof document !== "undefined" && createPortal(
      createElement(JobHistoryDrawer, {
        jobKey: historyJob,
        onClose: () => setHistoryJob(null),
        t
      }),
      document.body
    )
  );
}
