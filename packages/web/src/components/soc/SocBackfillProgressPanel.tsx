import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface BackfillRun {
  run_id: string;
  status: string;
  dataset: string;
  progress: number;
  started_at: string;
  completed_at?: string;
  total_symbols: number;
  completed_symbols: number;
  [key: string]: unknown;
}

export function SocBackfillProgressPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<BackfillRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<BackfillRun | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocBackfillRuns: (params?: { status?: string; limit?: number }) => Promise<{ runs?: BackfillRun[] }>;
      };
      const data = await adapter.getSocBackfillRuns({ limit: 20 });
      setRuns(data.runs || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load backfill runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchRunDetail = async (runId: string) => {
    setDetailLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocBackfillRunDetail: (runId: string) => Promise<BackfillRun>;
      };
      const detail = await adapter.getSocBackfillRunDetail(runId);
      setRunDetail(detail);
    } catch (err) {
      setRunDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectRun = (runId: string) => {
    setSelectedRun(runId);
    fetchRunDetail(runId);
  };

  const handleAbort = async (runId: string) => {
    if (!window.confirm(t("soc.backfill.abort_confirm"))) return;
    try {
      const adapter = defaultCoreApiAdapter as unknown as { abortSocDataOpsPlannerRun: (runId: string) => Promise<void> };
      await adapter.abortSocDataOpsPlannerRun(runId);
      await fetchRuns();
      if (selectedRun === runId) setSelectedRun(null);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Abort failed."}`);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "running": return "#34d399";
      case "completed": return "var(--accent-cyan)";
      case "failed": return "#f87171";
      case "aborted": return "#94a3b8";
      default: return "#fbbf24";
    }
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" } },
      createElement("h3", { style: { margin: 0, fontSize: "1.1rem", fontWeight: 700 } }, t("soc.backfill.title")),
      createElement(
        "button",
        {
          onClick: fetchRuns,
          className: styles.actionBtn,
          style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" },
        },
        t("soc.backfill.refresh"),
      ),
    ),
    loading
      ? createElement("p", { className: styles.emptyState }, t("soc.backfill.loading"))
      : error
        ? createElement("div", { className: styles.inlineError }, error)
        : createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: selectedRun ? "1fr 1fr" : "1fr", gap: "1.25rem" } },
            createElement(
              "div",
              { className: styles.sectionCard },
              createElement("div", { className: styles.sectionCardTitle }, t("soc.backfill.run_list")),
              runs.length === 0
                ? createElement("p", { className: styles.emptyState }, t("soc.backfill.no_runs"))
                : createElement(
                    "div",
                    { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
                    runs.map((run) =>
                      createElement(
                        "div",
                        {
                          key: run.run_id,
                          onClick: () => handleSelectRun(run.run_id),
                          style: {
                            padding: "0.75rem",
                            borderRadius: "8px",
                            background: selectedRun === run.run_id ? "rgba(0, 180, 216, 0.08)" : "rgba(15, 23, 42, 0.3)",
                            border: selectedRun === run.run_id ? "1px solid var(--accent-cyan)" : "1px solid var(--border-default)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          },
                        },
                        createElement(
                          "div",
                          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                          createElement("div", { style: { fontWeight: 600, fontSize: "0.85rem" } }, run.dataset),
                          createElement(
                            "span",
                            {
                              className: styles.statusBadge,
                              style: { background: `${getStatusColor(run.status)}20`, color: getStatusColor(run.status) },
                            },
                            run.status,
                          ),
                        ),
                        createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" } },
                          `${run.completed_symbols || 0}/${run.total_symbols || 0} symbols \u2022 ${run.started_at?.split("T")[0] || "N/A"}`,
                        ),
                        run.progress != null
                          ? createElement(
                              "div",
                              { style: { marginTop: "0.25rem", height: "4px", borderRadius: "2px", background: "rgba(100, 116, 139, 0.2)" } },
                              createElement("div", {
                                style: {
                                  height: "100%",
                                  width: `${run.progress}%`,
                                  borderRadius: "2px",
                                  background: getStatusColor(run.status),
                                  transition: "width 0.3s ease",
                                },
                              }),
                            )
                          : null,
                        run.status === "running"
                          ? createElement(
                              "button",
                              {
                                onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleAbort(run.run_id); },
                                className: styles.actionBtn,
                                style: { marginTop: "0.5rem", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem" },
                              },
                              t("soc.backfill.abort"),
                            )
                          : null,
                      ),
                    ),
                  ),
            ),
            selectedRun
              ? createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.backfill.run_detail")),
                  detailLoading
                    ? createElement("p", { className: styles.emptyState }, t("soc.backfill.loading_detail"))
                    : runDetail
                      ? createElement(
                          "div",
                          { style: { display: "flex", flexDirection: "column", gap: "0.75rem" } },
                          createElement(
                            "div",
                            { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" } },
                            createElement("div", null,
                              createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.backfill.dataset")),
                              createElement("div", { style: { fontWeight: 600 } }, runDetail.dataset),
                            ),
                            createElement("div", null,
                              createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.backfill.status")),
                              createElement("div", { style: { fontWeight: 600, color: getStatusColor(runDetail.status) } }, runDetail.status),
                            ),
                            createElement("div", null,
                              createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.backfill.progress")),
                              createElement("div", { style: { fontWeight: 600 } }, `${runDetail.progress ?? 0}%`),
                            ),
                            createElement("div", null,
                              createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.backfill.started")),
                              createElement("div", { style: { fontWeight: 600 } }, runDetail.started_at?.split("T")[0] || "N/A"),
                            ),
                          ),
                          runDetail.progress != null
                            ? createElement(
                                "div",
                                { style: { height: "8px", borderRadius: "4px", background: "rgba(100, 116, 139, 0.2)" } },
                                createElement("div", {
                                  style: {
                                    height: "100%",
                                    width: `${runDetail.progress}%`,
                                    borderRadius: "4px",
                                    background: getStatusColor(runDetail.status),
                                    transition: "width 0.3s ease",
                                  },
                                }),
                              )
                            : null,
                        )
                      : createElement("p", { className: styles.emptyState }, t("soc.backfill.no_detail")),
                )
              : null,
          ),
  );
}
