import { createElement, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
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

const getStatusStyles = (status: string) => {
  switch (status) {
    case "running":
      return { background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" };
    case "enabled":
      return { background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" };
    case "idle":
      return { background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1", border: "1px solid rgba(148, 163, 184, 0.2)" };
    case "disabled":
      return { background: "rgba(71, 85, 105, 0.2)", color: "#94a3b8", border: "1px solid rgba(71, 85, 105, 0.3)" };
    case "degraded":
      return { background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" };
    case "stale":
      return { background: "rgba(244, 63, 94, 0.2)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.3)" };
    default:
      return { background: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", border: "1px solid rgba(148, 163, 184, 0.2)" };
  }
};

const getFreshnessColor = (freshness?: string) => {
  switch (freshness) {
    case "fresh": return "#34d399";
    case "warm": return "#60a5fa";
    case "stale": return "#fbbf24";
    case "missing": return "#64748b";
    default: return "#94a3b8";
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
    ? "#34d399" 
    : health.overall_health === "degraded" 
      ? "#fbbf24" 
      : "#f87171";
  
  return createElement(
    "div",
    {
      className: "s5_0_SocSchedulerBoard", 
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
      { className: "s5_1_SocSchedulerBoard",  },
      `${t("soc.scheduler.health_total")}: `,
      createElement("span", { className: "s5_2_SocSchedulerBoard",  }, health.jobs_total)
    ),
    createElement(
      "span",
      { className: "s5_3_SocSchedulerBoard",  },
      `${t("soc.scheduler.health_enabled")}: `,
      createElement("span", { className: "s5_4_SocSchedulerBoard",  }, health.enabled_count)
    ),
    createElement(
      "span",
      { className: "s5_5_SocSchedulerBoard",  },
      `${t("soc.scheduler.health_degraded")}: `,
      createElement("span", { className: "s5_6_SocSchedulerBoard",  }, health.degraded_count)
    ),
    createElement(
      "span",
      { className: "s5_7_SocSchedulerBoard",  },
      `${t("soc.scheduler.health_inflight")}: `,
      createElement("span", { className: "s5_8_SocSchedulerBoard",  }, health.by_status?.running || 0)
    ),
    createElement(
      "span",
      { className: "s5_9_SocSchedulerBoard",  },
      `${t("soc.scheduler.health_stale")}: `,
      createElement("span", { style: { color: health.by_freshness?.stale ? "#f87171" : "#f1f5f9", fontWeight: 600 } }, health.by_freshness?.stale || 0)
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
    { className: "s5_10_SocSchedulerBoard",  },
    isJobDisabled
      ? btn("enable", t("soc.scheduler.action_enable"), { background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" })
      : btn("disable", t("soc.scheduler.action_disable"), { background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1" }),
    btn("run_now", t("soc.scheduler.action_run_now"), { background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }),
    btn("abort", t("soc.scheduler.action_abort"), { background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e" })
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
      className: "s5_11_SocSchedulerBoard", 
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: `styles.glassPanel s5_12_SocSchedulerBoard`,
        
        onClick: (e: any) => e.stopPropagation(),
      },
      createElement("h3", { className: "s5_13_SocSchedulerBoard",  }, 
        t("soc.scheduler.confirm_title")
      ),
      createElement("p", { className: "s5_14_SocSchedulerBoard",  },
        `${t("soc.scheduler.confirm_action")}: `,
        createElement("span", { className: "s5_15_SocSchedulerBoard",  }, action),
        " — ",
        createElement("span", { className: "s5_16_SocSchedulerBoard",  }, job.job_key)
      ),
      createElement("label", { className: "s5_17_SocSchedulerBoard",  },
        t("soc.scheduler.reason_label")
      ),
      createElement("textarea", {
        className: `styles.configEditor s5_18_SocSchedulerBoard`,
        rows: 2,
        placeholder: t("soc.scheduler.reason_placeholder"),
        value: reason,
        onChange: (e: any) => setReason(e.target.value),
        
      }),
      createElement(
        "div",
        { className: "s5_19_SocSchedulerBoard",  },
        createElement(
          "button",
          {
            type: "button",
            onClick: onCancel,
            className: `styles.actionBtn s5_20_SocSchedulerBoard`,
            
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
              color: "#fbbf24",
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
          className: "s5_21_SocSchedulerBoard", 
        },
        createElement("div", null,
          createElement("p", { className: "s5_22_SocSchedulerBoard",  }, t("soc.scheduler.history_drawer_title")),
          createElement("p", { className: "s5_23_SocSchedulerBoard",  }, jobKey)
        ),
        createElement("button", {
          type: "button",
          onClick: onClose,
          className: "s5_24_SocSchedulerBoard", 
        }, "✕")
      ),
      // Content body
      loading && createElement("p", { className: "s5_25_SocSchedulerBoard",  }, t("common.loading")),
      error && createElement("p", { className: "s5_26_SocSchedulerBoard",  }, error),
      history && !loading && createElement(
        "div",
        null,
        createElement(
          "p",
          { className: "s5_27_SocSchedulerBoard",  },
          t("soc.scheduler.history_count", { count: history.count })
        ),
        history.results.length === 0
          ? createElement("p", { className: "s5_28_SocSchedulerBoard",  }, t("soc.scheduler.history_empty"))
          : createElement(
              "table",
              { className: "s5_29_SocSchedulerBoard",  },
              createElement(
                "thead",
                { className: "s5_30_SocSchedulerBoard",  },
                createElement(
                  "tr",
                  null,
                  createElement("th", { className: "s5_31_SocSchedulerBoard",  }, t("soc.scheduler.history_col_status")),
                  createElement("th", { className: "s5_32_SocSchedulerBoard",  }, t("soc.scheduler.history_col_started")),
                  createElement("th", { className: "s5_33_SocSchedulerBoard",  }, t("soc.scheduler.history_col_duration")),
                  createElement("th", { className: "s5_34_SocSchedulerBoard",  }, t("soc.scheduler.history_col_task_id"))
                )
              ),
              createElement(
                "tbody",
                null,
                history.results.map((run) => {
                   const statusStyles = getStatusStyles(run.status);
                   return createElement(
                     "tr",
                     { key: run.id, className: "s5_35_SocSchedulerBoard",  },
                     createElement("td", { className: "s5_36_SocSchedulerBoard",  },
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
                     createElement("td", { className: "s5_37_SocSchedulerBoard",  }, run.started_at || "—"),
                     createElement("td", { className: "s5_38_SocSchedulerBoard",  }, run.duration_seconds != null ? `${run.duration_seconds}s` : "—"),
                     createElement("td", {
                       className: "s5_39_SocSchedulerBoard", 
                     }, run.celery_task_id || "—")
                   );
                })
              )
            ),
        // Pagination
        createElement(
          "div",
          {
            className: "s5_40_SocSchedulerBoard", 
          },
          createElement("span", { className: "s5_41_SocSchedulerBoard",  },
            `${t("soc.dataops.run_history_page")} ${page}/${history.total_pages || 1}`
          ),
          createElement(
            "div",
            { className: "s5_42_SocSchedulerBoard",  },
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.previous,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
                className: `styles.pageBtn s5_43_SocSchedulerBoard`,
                
              },
              t("soc.dataops.run_history_previous")
            ),
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.next,
                onClick: () => setPage((p) => p + 1),
                className: `styles.pageBtn s5_44_SocSchedulerBoard`,
                
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
    { className: "s5_45_SocSchedulerBoard",  },
    
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
          color: actionBanner.type === "success" ? "#34d399" : "#f43f5e",
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
        { className: "s5_46_SocSchedulerBoard",  },
        actionBanner.requestId
      )
    ),

    // Header row
    createElement(
      "div",
      {
        className: "s5_47_SocSchedulerBoard", 
      },
      createElement(
        "div",
        null,
        !hideHeaderTitle && createElement(
          "h3",
          { className: "s5_48_SocSchedulerBoard",  },
          t("soc.scheduler.board_title")
        ),
        plan?.generated_at && createElement(
          "p",
          { className: "s5_49_SocSchedulerBoard",  },
          `${t("soc.scheduler.board_generated_at")}: ${new Date(plan.generated_at).toLocaleString("vi-VN")}`
        )
      ),
      createElement(
        "div",
        { className: "s5_50_SocSchedulerBoard",  },
        
        // Domain Filter Select (hidden in embedded mode)
        !embedded && createElement(
          "select",
          {
            value: domainFilter,
            onChange: (e: any) => setDomainFilter(e.target.value),
            className: `styles.jobDomainSelect s5_51_SocSchedulerBoard`,
            
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
            className: `styles.pageBtn s5_52_SocSchedulerBoard`,
            
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
        className: "s5_53_SocSchedulerBoard", 
      },
      createElement(
        "table",
        {
          className: "s5_54_SocSchedulerBoard", 
        },
        createElement(
          "thead",
          {
            className: "s5_55_SocSchedulerBoard", 
          },
          createElement(
            "tr",
            null,
            createElement("th", { className: "s5_56_SocSchedulerBoard",  }, t("soc.scheduler.col_job")),
            createElement("th", { className: "s5_57_SocSchedulerBoard",  }, t("soc.scheduler.col_domain")),
            createElement("th", { className: "s5_58_SocSchedulerBoard",  }, t("soc.scheduler.col_status")),
            createElement("th", { className: "s5_59_SocSchedulerBoard",  }, t("soc.scheduler.col_freshness")),
            createElement("th", { className: "s5_60_SocSchedulerBoard",  }, t("soc.scheduler.col_next_run")),
            createElement("th", { className: "s5_61_SocSchedulerBoard",  }, t("soc.scheduler.col_lag")),
            createElement("th", { className: "s5_62_SocSchedulerBoard",  }, t("soc.scheduler.col_actions")),
            createElement("th", { className: "s5_63_SocSchedulerBoard",  }, t("soc.scheduler.col_history"))
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
                  { colSpan: 8, className: "s5_64_SocSchedulerBoard",  },
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
                    className: "s5_65_SocSchedulerBoard", 
                  },
                  // Job key and display name
                  createElement(
                    "td",
                    { className: "s5_66_SocSchedulerBoard",  },
                    createElement("p", { className: "s5_67_SocSchedulerBoard",  }, job.job_key),
                    job.display_name && createElement("p", { className: "s5_68_SocSchedulerBoard",  }, job.display_name)
                  ),
                  // Domain
                  createElement(
                    "td",
                    { className: "s5_69_SocSchedulerBoard",  },
                    job.domain
                  ),
                  // Status + Live/Stuck indicators
                  createElement(
                    "td",
                    { className: "s5_70_SocSchedulerBoard",  },
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
                        className: `styles.pulsingDot s5_71_SocSchedulerBoard`,
                        
                      },
                      "live"
                    ),
                    job.is_possibly_stuck && createElement(
                      "span",
                      {
                        title: t("soc.scheduler.tooltip_stuck"),
                        className: "s5_72_SocSchedulerBoard", 
                      },
                      t("soc.scheduler.badge_stuck")
                    ),
                    job.is_possibly_stuck && job.inflight_elapsed_seconds != null && createElement(
                      "p",
                      { className: "s5_73_SocSchedulerBoard",  },
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
                    { className: "s5_74_SocSchedulerBoard",  },
                    formatNextRun(job.next_run_at)
                  ),
                  // Lag
                  createElement(
                    "td",
                    { className: "s5_75_SocSchedulerBoard",  },
                    formatLag(job.lag_seconds)
                  ),
                  // Actions buttons
                  createElement(
                    "td",
                    { className: "s5_76_SocSchedulerBoard",  },
                    createElement(JobActionButtons, { job, onAction: handleAction, t })
                  ),
                  // History button
                  createElement(
                    "td",
                    { className: "s5_77_SocSchedulerBoard",  },
                    createElement(
                      "button",
                      {
                        type: "button",
                        onClick: () => setHistoryJob(job.job_key),
                        className: `styles.pageBtn s5_78_SocSchedulerBoard`,
                        
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
