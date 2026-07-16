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
  if (m < 60) return `${m}p ${s % 60}s`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem > 0 ? `${h}h ${rem}p` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} ngày ${rh}h` : `${d} ngày`;
}

function formatNextRun(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return dateStr;
  }
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
    {
      },
    createElement(
      "span",
      {
        style: {
          fontWeight: 700,
          textTransform: "uppercase",
          color: healthColor,
          letterSpacing: "0.05em",
        }
      },
      health.overall_health
    ),
    createElement(
      "span",
      { },
      `${t("soc.scheduler.health_total")}: `,
      createElement("span", { }, health.jobs_total)
    ),
    createElement(
      "span",
      { },
      `${t("soc.scheduler.health_enabled")}: `,
      createElement("span", { }, health.enabled_count)
    ),
    createElement(
      "span",
      { },
      `${t("soc.scheduler.health_degraded")}: `,
      createElement("span", { }, health.degraded_count)
    ),
    createElement(
      "span",
      { },
      `${t("soc.scheduler.health_inflight")}: `,
      createElement("span", { }, health.by_status?.running || 0)
    ),
    createElement(
      "span",
      { },
      `${t("soc.scheduler.health_stale")}: `,
      createElement("span", { style: { color: health.by_freshness?.stale ? toneColor("danger") : "#f1f5f9", fontWeight: 600 } }, health.by_freshness?.stale || 0)
    )
  );
}

// ─── Action Button row for a single job ─────────────────────────────────────────────
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
    return ["enable", "disable", "run_now", "abort"];
  })();

  const isRunning = job.is_inflight;

  const btn = (action: string, label: string, stylesObj: Record<string, string>) => {
    const supported = normalizedCaps.includes(action);
    const lockedByRunning = isRunning && action === "run_now";
    
    return createElement(
      "button",
      {
        key: action,
        type: "button",
        disabled: !supported || lockedByRunning,
        onClick: () => onAction(job, action),
        className: styles.actionBtn,
        style: {
          padding: "0.25rem 0.5rem",
          fontSize: "0.65rem",
          whiteSpace: "nowrap",
          opacity: (!supported || lockedByRunning) ? 0.4 : 1,
          cursor: (!supported || lockedByRunning) ? "not-allowed" : "pointer",
          ...stylesObj,
        }
      },
      label
    );
  };

  const isJobDisabled = job.status === "disabled";

  return createElement(
    "div",
    { },
    isJobDisabled
      ? btn("enable", t("soc.scheduler.action_enable"), { background: "rgba(59, 130, 246, 0.15)", color: toneColor("info") })
      : btn("disable", t("soc.scheduler.action_disable"), { background: "rgba(148, 163, 184, 0.15)", color: "var(--color-text-secondary, #cbd5e1)" }),
    btn("run_now", t("soc.scheduler.action_run_now"), { background: "rgba(16, 185, 129, 0.15)", color: toneColor("success") }),
    btn("abort", t("soc.scheduler.action_abort"), { background: "rgba(244, 63, 94, 0.15)", color: "var(--color-danger-400, #f43f5e)" })
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
    {
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: `styles.glassPanel`,
        
        onClick: (e: any) => e.stopPropagation(),
      },
      createElement("h3", { }, 
        t("soc.scheduler.confirm_title")
      ),
      createElement("p", { },
        `${t("soc.scheduler.confirm_action")}: `,
        createElement("span", { }, action),
        " — ",
        createElement("span", { }, job.job_key)
      ),
      createElement("label", { },
        t("soc.scheduler.reason_label")
      ),
      createElement("textarea", {
        className: `styles.configEditor`,
        rows: 2,
        placeholder: t("soc.scheduler.reason_placeholder"),
        value: reason,
        onChange: (e: any) => setReason(e.target.value),
        
      }),
      createElement(
        "div",
        { },
        createElement(
          "button",
          {
            type: "button",
            onClick: onCancel,
            className: `styles.actionBtn`,
            
          },
          t("common.cancel")
        ),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => onConfirm(reason),
            disabled: !reason.trim(),
            className: styles.actionBtn,
            style: {
              background: "rgba(245, 158, 11, 0.2)",
              color: toneColor("warning"),
              border: "1px solid rgba(245, 158, 11, 0.3)",
              cursor: !reason.trim() ? "not-allowed" : "pointer",
            },
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
      setError(err instanceof Error ? err.message : "Error loading history");
    } finally {
      setLoading(false);
    }
  }, [jobKey]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return createElement(
    "div",
    null,
    createElement("div", {
      className: styles.drawerOverlay,
      onClick: onClose,
    }),
    createElement(
      "div",
      {
        className: styles.drawerContent,
        onClick: (e: any) => e.stopPropagation(),
      },
      // Header
      createElement(
        "div",
        {
          },
        createElement("div", null,
          createElement("p", { }, t("soc.scheduler.history_drawer_title")),
          createElement("p", { }, jobKey)
        ),
        createElement("button", {
          type: "button",
          onClick: onClose,
          }, "✕")
      ),
      // Content body
      loading && createElement("p", { }, t("common.loading")),
      error && createElement("p", { }, error),
      history && !loading && createElement(
        "div",
        null,
        createElement(
          "p",
          { },
          t("soc.scheduler.history_count", { count: history.count })
        ),
        history.results.length === 0
          ? createElement("p", { }, t("soc.scheduler.history_empty"))
          : createElement(
              "table",
              { },
              createElement(
                "thead",
                { },
                createElement(
                  "tr",
                  null,
                  createElement("th", { }, t("soc.scheduler.history_col_status")),
                  createElement("th", { }, t("soc.scheduler.history_col_started")),
                  createElement("th", { }, t("soc.scheduler.history_col_duration")),
                  createElement("th", { }, t("soc.scheduler.history_col_task_id"))
                )
              ),
              createElement(
                "tbody",
                null,
                history.results.map((run) => {
                   const statusStyles = getStatusStyles(run.status);
                   return createElement(
                     "tr",
                     { key: run.id, },
                     createElement("td", { },
                       createElement(
                         "span",
                         {
                           style: {
                             display: "inline-block",
                             padding: "0.1rem 0.35rem",
                             borderRadius: "4px",
                             fontWeight: 700,
                             textTransform: "uppercase",
                             fontSize: "0.65rem",
                             ...statusStyles
                           }
                         },
                         run.status
                       )
                     ),
                     createElement("td", { }, run.started_at || "—"),
                     createElement("td", { }, run.duration_seconds != null ? `${run.duration_seconds}s` : "—"),
                     createElement("td", {
                       }, run.celery_task_id || "—")
                   );
                })
              )
            ),
        // Pagination
        createElement(
          "div",
          {
            },
          createElement("span", { },
            `${t("soc.dataops.run_history_page")} ${page}/${history.total_pages || 1}`
          ),
          createElement(
            "div",
            { },
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.previous,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
                className: `styles.pageBtn`,
                
              },
              t("soc.dataops.run_history_previous")
            ),
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.next,
                onClick: () => setPage((p) => p + 1),
                className: `styles.pageBtn`,
                
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
      setError(err instanceof Error ? err.message : "Cannot load scheduler status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
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
  const activeDomainFilter = embedded ? domainProp : domainFilter;

  const filteredJobs = plan?.jobs?.filter(
    (j) => activeDomainFilter === "all" || j.domain === activeDomainFilter
  ) ?? [];

  return createElement(
    "div",
    { },
    
    // Health strip (hidden in embedded mode)
    !embedded && createElement(SchedulerHealthStrip, { health, t }),

    // Action banner
    actionBanner && createElement(
      "div",
      {
        style: {
          borderRadius: "8px",
          border: actionBanner.type === "success" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(244, 63, 94, 0.4)",
          background: actionBanner.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
          color: actionBanner.type === "success" ? toneColor("success") : "var(--color-danger-400, #f43f5e)",
          padding: "0.75rem 1rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }
      },
      createElement("span", null, actionBanner.msg),
      actionBanner.requestId && createElement(
        "span",
        { },
        actionBanner.requestId
      )
    ),

    // Header row
    createElement(
      "div",
      {
        },
      createElement(
        "div",
        null,
        !hideHeaderTitle && createElement(
          "h3",
          { },
          t("soc.scheduler.board_title")
        ),
        plan?.generated_at && createElement(
          "p",
          { },
          `${t("soc.scheduler.board_generated_at")}: ${new Date(plan.generated_at).toLocaleString("vi-VN")}`
        )
      ),
      createElement(
        "div",
        { },
        
        // Domain Filter Select (hidden in embedded mode)
        !embedded && createElement(
          "select",
          {
            value: domainFilter,
            onChange: (e: any) => setDomainFilter(e.target.value),
            className: `styles.jobDomainSelect`,
            
          },
          DOMAIN_FILTER_OPTIONS.map((d) => 
            createElement(
              "option",
              { key: d, value: d },
              d === "all" ? t("soc.scheduler.filter_all_domains") : d
            )
          )
        ),

        // Refresh button
        createElement(
          "button",
          {
            type: "button",
            onClick: load,
            disabled: loading,
            className: `styles.pageBtn`,
            
          },
          loading ? t("common.loading") : t("common.refresh")
        )
      )
    ),

    // Error banner
    error && createElement(
      "div",
      { className: styles.inlineError },
      error
    ),

    // Table Content
    !error && createElement(
      "div",
      {
        },
      createElement(
        "table",
        {
          },
        createElement(
          "thead",
          {
            },
          createElement(
            "tr",
            null,
            createElement("th", { }, t("soc.scheduler.col_job")),
            createElement("th", { }, t("soc.scheduler.col_domain")),
            createElement("th", { }, t("soc.scheduler.col_status")),
            createElement("th", { }, t("soc.scheduler.col_freshness")),
            createElement("th", { }, t("soc.scheduler.col_next_run")),
            createElement("th", { }, t("soc.scheduler.col_lag")),
            createElement("th", { }, t("soc.scheduler.col_actions")),
            createElement("th", { }, t("soc.scheduler.col_history"))
          )
        ),
        createElement(
          "tbody",
          null,
          filteredJobs.length === 0
            ? createElement(
                "tr",
                null,
                createElement(
                  "td",
                  { colSpan: 8, },
                  t("soc.scheduler.empty_state")
                )
              )
            : filteredJobs.map((job) => {
                const statusStyles = getStatusStyles(job.status);
                const freshnessColor = getFreshnessColor(job.freshness_state);

                return createElement(
                  "tr",
                  {
                    key: job.job_key,
                    },
                  // Job key and display name
                  createElement(
                    "td",
                    { },
                    createElement("p", { }, job.job_key),
                    job.display_name && createElement("p", { }, job.display_name)
                  ),
                  // Domain
                  createElement(
                    "td",
                    { },
                    job.domain
                  ),
                  // Status + Live/Stuck indicators
                  createElement(
                    "td",
                    { },
                    createElement(
                      "span",
                      {
                        style: {
                          display: "inline-block",
                          padding: "0.1rem 0.35rem",
                          borderRadius: "4px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          fontSize: "0.65rem",
                          ...statusStyles
                        }
                      },
                      t(`soc.scheduler.status_${job.status}`, { defaultValue: job.status })
                    ),
                    job.is_inflight && createElement(
                      "span",
                      {
                        className: `styles.pulsingDot`,
                        
                      },
                      "live"
                    ),
                    job.is_possibly_stuck && createElement(
                      "span",
                      {
                        title: t("soc.scheduler.tooltip_stuck"),
                        },
                      t("soc.scheduler.badge_stuck")
                    ),
                    job.is_possibly_stuck && job.inflight_elapsed_seconds != null && createElement(
                      "p",
                      { },
                      `${Math.floor(job.inflight_elapsed_seconds / 3600)}h${Math.floor((job.inflight_elapsed_seconds % 3600) / 60)}m`
                    )
                  ),
                  // Freshness
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem", fontWeight: 600, color: freshnessColor } },
                    job.freshness_state ? t(`soc.scheduler.freshness_${job.freshness_state}`, { defaultValue: job.freshness_state }) : "—"
                  ),
                  // Next run
                  createElement(
                    "td",
                    { },
                    formatNextRun(job.next_run_at)
                  ),
                  // Lag
                  createElement(
                    "td",
                    { },
                    formatLag(job.lag_seconds)
                  ),
                  // Actions buttons
                  createElement(
                    "td",
                    { },
                    createElement(JobActionButtons, { job, onAction: handleAction, t })
                  ),
                  // History button
                  createElement(
                    "td",
                    { },
                    createElement(
                      "button",
                      {
                        type: "button",
                        onClick: () => setHistoryJob(job.job_key),
                        className: `styles.pageBtn`,
                        
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
