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
      case "completed": return "var(--accent-cyan, #06b6d4)";
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
      { className: "s5_0_SocBackfillProgressPanel",  },
      createElement("h3", { className: "s5_1_SocBackfillProgressPanel",  }, t("soc.backfill.title")),
      createElement(
        "button",
        {
          onClick: fetchRuns,
          className: `styles.actionBtn s5_2_SocBackfillProgressPanel`,
          
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
                    { className: "s5_3_SocBackfillProgressPanel",  },
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
                            border: selectedRun === run.run_id ? "1px solid var(--accent-cyan, #06b6d4)" : "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          },
                        },
                        createElement(
                          "div",
                          { className: "s5_4_SocBackfillProgressPanel",  },
                          createElement("div", { className: "s5_5_SocBackfillProgressPanel",  }, run.dataset),
                          createElement(
                            "span",
                            {
                              className: styles.statusBadge,
                              style: { background: `${getStatusColor(run.status)}20`, color: getStatusColor(run.status) },
                            },
                            run.status,
                          ),
                        ),
                        createElement("div", { className: "s5_6_SocBackfillProgressPanel",  },
                          `${run.completed_symbols || 0}/${run.total_symbols || 0} symbols \u2022 ${run.started_at?.split("T")[0] || "N/A"}`,
                        ),
                        run.progress != null
                          ? createElement(
                              "div",
                              { className: "s5_7_SocBackfillProgressPanel",  },
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
                                className: `styles.actionBtn s5_8_SocBackfillProgressPanel`,
                                
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
                          { className: "s5_9_SocBackfillProgressPanel",  },
                          createElement(
                            "div",
                            { className: "s5_10_SocBackfillProgressPanel",  },
                            createElement("div", null,
                              createElement("div", { className: "s5_11_SocBackfillProgressPanel",  }, t("soc.backfill.dataset")),
                              createElement("div", { className: "s5_12_SocBackfillProgressPanel",  }, runDetail.dataset),
                            ),
                            createElement("div", null,
                              createElement("div", { className: "s5_13_SocBackfillProgressPanel",  }, t("soc.backfill.status")),
                              createElement("div", { style: { fontWeight: 600, color: getStatusColor(runDetail.status) } }, runDetail.status),
                            ),
                            createElement("div", null,
                              createElement("div", { className: "s5_14_SocBackfillProgressPanel",  }, t("soc.backfill.progress")),
                              createElement("div", { className: "s5_15_SocBackfillProgressPanel",  }, `${runDetail.progress ?? 0}%`),
                            ),
                            createElement("div", null,
                              createElement("div", { className: "s5_16_SocBackfillProgressPanel",  }, t("soc.backfill.started")),
                              createElement("div", { className: "s5_17_SocBackfillProgressPanel",  }, runDetail.started_at?.split("T")[0] || "N/A"),
                            ),
                          ),
                          runDetail.progress != null
                            ? createElement(
                                "div",
                                { className: "s5_18_SocBackfillProgressPanel",  },
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
