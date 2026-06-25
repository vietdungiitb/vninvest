import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface SchedulerJob {
  key: string;
  name: string;
  status: string;
  cadence: string;
  last_run?: string;
  next_run?: string;
  freshness?: string;
  [key: string]: unknown;
}

interface SocSchedulerBoardProps {
  domain?: string;
  onAction?: (jobKey: string, action: string, reason: string) => Promise<void>;
}

export function SocSchedulerBoard({ domain, onAction }: SocSchedulerBoardProps) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [actionType, setActionType] = useState("");
  const [reason, setReason] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await (defaultCoreApiAdapter as unknown as { getSocSchedulerPlan: () => Promise<{ jobs?: SchedulerJob[] }> }).getSocSchedulerPlan();
      let filteredJobs = data.jobs || [];
      if (domain) {
        filteredJobs = filteredJobs.filter((j) => j.key?.includes(domain) || j.name?.toLowerCase().includes(domain));
      }
      setJobs(filteredJobs);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load scheduler plan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 60000);
    return () => clearInterval(interval);
  }, [domain]);

  const handleAction = async (jobKey: string, action: string) => {
    setSelectedJob(jobKey);
    setActionType(action);
    setReason("");
  };

  const confirmAction = async () => {
    if (!selectedJob || !actionType) return;
    setActionLoading((prev) => ({ ...prev, [selectedJob]: true }));
    try {
      if (onAction) {
        await onAction(selectedJob, actionType, reason);
      } else {
        await (defaultCoreApiAdapter as unknown as { postSocSchedulerJobAction: (key: string, action: string, reason: string) => Promise<void> }).postSocSchedulerJobAction(selectedJob, actionType, reason);
      }
      setSelectedJob(null);
      setActionType("");
      setReason("");
      await fetchJobs();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Action failed."}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [selectedJob]: false }));
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active": return "#34d399";
      case "paused": return "#fbbf24";
      case "failed": return "#f87171";
      default: return "#94a3b8";
    }
  };

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement("div", { className: styles.sectionCardTitle }, t("soc.scheduler.title")),
    loading && jobs.length === 0
      ? createElement("p", { className: styles.emptyState }, t("soc.scheduler.loading"))
      : error
        ? createElement("div", { className: styles.inlineError }, error)
        : createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
            jobs.map((job) => {
              const isLoading = actionLoading[job.key] || false;
              return createElement(
                "div",
                {
                  key: job.key,
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.3)",
                    border: "1px solid var(--border-default)",
                  },
                },
                createElement(
                  "div",
                  { style: { flex: 1 } },
                  createElement("div", { style: { fontWeight: 600, fontSize: "0.85rem" } }, job.name),
                  createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" } },
                    `Key: ${job.key} \u2022 Cadence: ${job.cadence || "N/A"}`,
                  ),
                ),
                createElement(
                  "span",
                  {
                    className: styles.statusBadge,
                    style: { background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) },
                  },
                  job.status,
                ),
                createElement(
                  "div",
                  { style: { display: "flex", gap: "0.35rem", marginLeft: "0.75rem" } },
                  job.status === "active"
                    ? createElement(
                        "button",
                        {
                          onClick: () => handleAction(job.key, "pause"),
                          disabled: isLoading,
                          className: styles.actionBtn,
                          style: { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", fontSize: "0.65rem" },
                        },
                        t("soc.scheduler.pause"),
                      )
                    : createElement(
                        "button",
                        {
                          onClick: () => handleAction(job.key, "resume"),
                          disabled: isLoading,
                          className: styles.actionBtn,
                          style: { background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: "0.65rem" },
                        },
                        t("soc.scheduler.resume"),
                      ),
                  createElement(
                    "button",
                    {
                      onClick: () => handleAction(job.key, "trigger"),
                      disabled: isLoading,
                      className: styles.actionBtn,
                      style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)", fontSize: "0.65rem" },
                    },
                    t("soc.scheduler.trigger"),
                  ),
                ),
              );
            }),
          ),
    selectedJob
      ? createElement(
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
            },
            onClick: () => { setSelectedJob(null); setActionType(""); setReason(""); },
          },
          createElement(
            "div",
            {
              className: styles.glassPanel,
              style: { maxWidth: "480px", width: "90%" },
              onClick: (e: React.MouseEvent) => e.stopPropagation(),
            },
            createElement("h4", { style: { margin: "0 0 1rem" } },
              t("soc.scheduler.confirm_action", { action: actionType, job: selectedJob }),
            ),
            createElement(
              "label",
              { style: { display: "block", marginBottom: "1rem" } },
              createElement("div", { style: { fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--text-muted)" } }, t("soc.scheduler.reason")),
              createElement(
                "input",
                {
                  type: "text",
                  value: reason,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value),
                  className: styles.searchInput,
                  placeholder: t("soc.scheduler.reason_placeholder"),
                },
              ),
            ),
            createElement(
              "div",
              { style: { display: "flex", justifyContent: "flex-end", gap: "0.75rem" } },
              createElement(
                "button",
                {
                  onClick: () => { setSelectedJob(null); setActionType(""); setReason(""); },
                  className: styles.actionBtn,
                  style: { background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted)" },
                },
                t("soc.actions.cancel"),
              ),
              createElement(
                "button",
                {
                  onClick: confirmAction,
                  disabled: !reason.trim(),
                  className: styles.actionBtn,
                  style: {
                    background: "rgba(0, 180, 216, 0.2)",
                    color: "var(--accent-cyan)",
                    cursor: !reason.trim() ? "not-allowed" : "pointer",
                  },
                },
                t("soc.actions.confirm"),
              ),
            ),
          ),
        )
      : null,
  );
}
