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
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        borderRadius: "8px",
        border: "1px solid rgba(80, 120, 168, 0.15)",
        background: "rgba(2, 11, 35, 0.4)",
        padding: "0.75rem 1.25rem",
        fontSize: "0.75rem",
        marginBottom: "1rem",
        alignItems: "center",
      }
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
      { style: { color: "var(--text-muted, #94a3b8)" } },
      `${t("soc.scheduler.health_total")}: `,
      createElement("span", { style: { color: "#f1f5f9", fontWeight: 600 } }, health.jobs_total)
    ),
    createElement(
      "span",
      { style: { color: "var(--text-muted, #94a3b8)" } },
      `${t("soc.scheduler.health_enabled")}: `,
      createElement("span", { style: { color: "#60a5fa", fontWeight: 600 } }, health.enabled_count)
    ),
    createElement(
      "span",
      { style: { color: "var(--text-muted, #94a3b8)" } },
      `${t("soc.scheduler.health_degraded")}: `,
      createElement("span", { style: { color: "#fbbf24", fontWeight: 600 } }, health.degraded_count)
    ),
    createElement(
      "span",
      { style: { color: "var(--text-muted, #94a3b8)" } },
      `${t("soc.scheduler.health_inflight")}: `,
      createElement("span", { style: { color: "#34d399", fontWeight: 600 } }, health.by_status?.running || 0)
    ),
    createElement(
      "span",
      { style: { color: "var(--text-muted, #94a3b8)" } },
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
    { style: { display: "flex", flexWrap: "nowrap", gap: "0.25rem", alignItems: "center" } },
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
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        padding: "1rem",
      },
      onClick: onCancel,
    },
    createElement(
      "div",
      {
        className: styles.glassPanel,
        style: { maxWidth: "400px", width: "100%", background: "#0b1528" },
        onClick: (e: any) => e.stopPropagation(),
      },
      createElement("h3", { style: { margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700, color: "#fff" } }, 
        t("soc.scheduler.confirm_title")
      ),
      createElement("p", { style: { margin: "0 0 1rem", fontSize: "0.8rem", color: "var(--text-muted, #94a3b8)" } },
        `${t("soc.scheduler.confirm_action")}: `,
        createElement("span", { style: { color: "#fbbf24", fontWeight: 600 } }, action),
        " — ",
        createElement("span", { style: { fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8" } }, job.job_key)
      ),
      createElement("label", { style: { display: "block", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted, #94a3b8)", marginBottom: "0.25rem", fontWeight: 600 } },
        t("soc.scheduler.reason_label")
      ),
      createElement("textarea", {
        className: styles.configEditor,
        rows: 2,
        placeholder: t("soc.scheduler.reason_placeholder"),
        value: reason,
        onChange: (e: any) => setReason(e.target.value),
        style: { width: "100%", marginBottom: "1rem", boxSizing: "border-box" },
      }),
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "flex-end", gap: "0.5rem" } },
        createElement(
          "button",
          {
            type: "button",
            onClick: onCancel,
            className: styles.actionBtn,
            style: { background: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1" },
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
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(80, 120, 168, 0.2)",
            paddingBottom: "0.75rem",
            marginBottom: "1rem",
          }
        },
        createElement("div", null,
          createElement("p", { style: { margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#fff" } }, t("soc.scheduler.history_drawer_title")),
          createElement("p", { style: { margin: "0.15rem 0 0 0", fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-muted)" } }, jobKey)
        ),
        createElement("button", {
          type: "button",
          onClick: onClose,
          style: {
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "1rem"
          }
        }, "✕")
      ),
      // Content body
      loading && createElement("p", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, t("common.loading")),
      error && createElement("p", { style: { fontSize: "0.75rem", color: "#f87171" } }, error),
      history && !loading && createElement(
        "div",
        null,
        createElement(
          "p",
          { style: { fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.75rem" } },
          t("soc.scheduler.history_count", { count: history.count })
        ),
        history.results.length === 0
          ? createElement("p", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, t("soc.scheduler.history_empty"))
          : createElement(
              "table",
              { style: { width: "100%", fontSize: "0.7rem", borderCollapse: "collapse", textAlign: "left" } },
              createElement(
                "thead",
                { style: { borderBottom: "1px solid rgba(80, 120, 168, 0.15)", color: "var(--text-muted)" } },
                createElement(
                  "tr",
                  null,
                  createElement("th", { style: { padding: "0.4rem 0.25rem" } }, t("soc.scheduler.history_col_status")),
                  createElement("th", { style: { padding: "0.4rem 0.25rem" } }, t("soc.scheduler.history_col_started")),
                  createElement("th", { style: { padding: "0.4rem 0.25rem" } }, t("soc.scheduler.history_col_duration")),
                  createElement("th", { style: { padding: "0.4rem 0.25rem" } }, t("soc.scheduler.history_col_task_id"))
                )
              ),
              createElement(
                "tbody",
                null,
                history.results.map((run) => {
                   const statusStyles = getStatusStyles(run.status);
                   return createElement(
                     "tr",
                     { key: run.id, style: { borderBottom: "1px solid rgba(80, 120, 168, 0.08)", verticalAlign: "top" } },
                     createElement("td", { style: { padding: "0.4rem 0.25rem" } },
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
                     createElement("td", { style: { padding: "0.4rem 0.25rem", color: "#cbd5e1" } }, run.started_at || "—"),
                     createElement("td", { style: { padding: "0.4rem 0.25rem", color: "#cbd5e1" } }, run.duration_seconds != null ? `${run.duration_seconds}s` : "—"),
                     createElement("td", {
                       style: {
                         padding: "0.4rem 0.25rem",
                         fontFamily: "monospace",
                         color: "var(--text-muted)",
                         maxWidth: "100px",
                         overflow: "hidden",
                         textOverflow: "ellipsis",
                         whiteSpace: "nowrap"
                       }
                     }, run.celery_task_id || "—")
                   );
                })
              )
            ),
        // Pagination
        createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid rgba(80, 120, 168, 0.15)"
            }
          },
          createElement("span", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
            `${t("soc.dataops.run_history_page")} ${page}/${history.total_pages || 1}`
          ),
          createElement(
            "div",
            { style: { display: "flex", gap: "0.5rem" } },
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.previous,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
                className: styles.pageBtn,
                style: { padding: "0.25rem 0.5rem", fontSize: "0.65rem", whiteSpace: "nowrap" }
              },
              t("soc.dataops.run_history_previous")
            ),
            createElement(
              "button",
              {
                type: "button",
                disabled: !history.next,
                onClick: () => setPage((p) => p + 1),
                className: styles.pageBtn,
                style: { padding: "0.25rem 0.5rem", fontSize: "0.65rem", whiteSpace: "nowrap" }
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
    { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
    
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
        { style: { fontFamily: "monospace", fontSize: "0.7rem", opacity: 0.7 } },
        actionBanner.requestId
      )
    ),

    // Header row
    createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }
      },
      createElement(
        "div",
        null,
        !hideHeaderTitle && createElement(
          "h3",
          { style: { margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#fff" } },
          t("soc.scheduler.board_title")
        ),
        plan?.generated_at && createElement(
          "p",
          { style: { margin: "0.25rem 0 0 0", fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)" } },
          `${t("soc.scheduler.board_generated_at")}: ${new Date(plan.generated_at).toLocaleString("vi-VN")}`
        )
      ),
      createElement(
        "div",
        { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
        
        // Domain Filter Select (hidden in embedded mode)
        !embedded && createElement(
          "select",
          {
            value: domainFilter,
            onChange: (e: any) => setDomainFilter(e.target.value),
            className: styles.jobDomainSelect,
            style: { width: "auto", minWidth: "120px", padding: "0.35rem 1.75rem 0.35rem 0.5rem" }
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
            className: styles.pageBtn,
            style: { padding: "0.35rem 0.75rem" }
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
        style: {
          overflowX: "auto",
          borderRadius: "8px",
          border: "1px solid rgba(80, 120, 168, 0.15)",
          background: "rgba(8, 23, 52, 0.2)",
        }
      },
      createElement(
        "table",
        {
          style: {
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.75rem",
            textAlign: "left"
          }
        },
        createElement(
          "thead",
          {
            style: {
              borderBottom: "1px solid rgba(80, 120, 168, 0.15)",
              background: "rgba(15, 23, 42, 0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-muted, #94a3b8)",
              fontSize: "0.7rem",
              fontWeight: 700
            }
          },
          createElement(
            "tr",
            null,
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_job")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_domain")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_status")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_freshness")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_next_run")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_lag")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_actions")),
            createElement("th", { style: { padding: "0.6rem 0.75rem" } }, t("soc.scheduler.col_history"))
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
                  { colSpan: 8, style: { padding: "2rem", textAlign: "center", color: "var(--text-muted)" } },
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
                    style: {
                      borderBottom: "1px solid rgba(80, 120, 168, 0.08)",
                      verticalAlign: "top"
                    }
                  },
                  // Job key and display name
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem" } },
                    createElement("p", { style: { margin: 0, fontFamily: "monospace", fontSize: "0.75rem", color: "#cbd5e1" } }, job.job_key),
                    job.display_name && createElement("p", { style: { margin: "0.15rem 0 0 0", fontSize: "0.65rem", color: "var(--text-muted)" } }, job.display_name)
                  ),
                  // Domain
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem", color: "#94a3b8" } },
                    job.domain
                  ),
                  // Status + Live/Stuck indicators
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem" } },
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
                        className: styles.pulsingDot,
                        style: {
                          marginLeft: "0.35rem",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(16, 185, 129, 0.2)",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          color: "#34d399",
                          fontSize: "0.6rem",
                          padding: "0.05rem 0.25rem",
                          borderRadius: "3px",
                          fontWeight: 700,
                          textTransform: "uppercase"
                        }
                      },
                      "live"
                    ),
                    job.is_possibly_stuck && createElement(
                      "span",
                      {
                        title: t("soc.scheduler.tooltip_stuck"),
                        style: {
                          marginLeft: "0.35rem",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(245, 158, 11, 0.2)",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          color: "#fbbf24",
                          fontSize: "0.6rem",
                          padding: "0.05rem 0.25rem",
                          borderRadius: "3px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          cursor: "help"
                        }
                      },
                      t("soc.scheduler.badge_stuck")
                    ),
                    job.is_possibly_stuck && job.inflight_elapsed_seconds != null && createElement(
                      "p",
                      { style: { margin: "0.15rem 0 0 0", fontSize: "0.6rem", color: "#fbbf24" } },
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
                    { style: { padding: "0.6rem 0.75rem", color: "#cbd5e1" } },
                    formatNextRun(job.next_run_at)
                  ),
                  // Lag
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem", color: "#cbd5e1" } },
                    formatLag(job.lag_seconds)
                  ),
                  // Actions buttons
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem" } },
                    createElement(JobActionButtons, { job, onAction: handleAction, t })
                  ),
                  // History button
                  createElement(
                    "td",
                    { style: { padding: "0.6rem 0.75rem" } },
                    createElement(
                      "button",
                      {
                        type: "button",
                        onClick: () => setHistoryJob(job.job_key),
                        className: styles.pageBtn,
                        style: { padding: "0.25rem 0.5rem", fontSize: "0.65rem" }
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
