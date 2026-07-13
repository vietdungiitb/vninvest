import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface BackfillJob {
  id: string;
  status: string;
  symbol: string;
  date: string;
  progress: number;
  started_at: string;
  completed_at?: string;
  error?: string;
  [key: string]: unknown;
}

export function SocDnseBackfillPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<BackfillJob[]>([]);
  const [symbol, setSymbol] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getDnseBackfillJobs: () => Promise<{ jobs?: BackfillJob[] }>;
      };
      const data = await adapter.getDnseBackfillJobs();
      setJobs(data.jobs || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load DNSE backfill jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSubmit = async () => {
    if (!symbol.trim()) {
      alert(t("soc.dnse.symbol_required"));
      return;
    }
    setSubmitting(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        triggerDnseBackfill: (payload: Record<string, unknown>) => Promise<void>;
      };
      await adapter.triggerDnseBackfill({
        symbol: symbol.toUpperCase(),
        date_from: dateFrom,
        date_to: dateTo,
      });
      alert(t("soc.dnse.backfill_started"));
      setSymbol("");
      setDateFrom("");
      setDateTo("");
      await fetchJobs();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Backfill failed."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed": return "#34d399";
      case "running": return "var(--accent-cyan, #06b6d4)";
      case "failed": return "#f87171";
      case "queued": return "#fbbf24";
      default: return "#94a3b8";
    }
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      ShellPanel,
      {
        title: t("soc.dnse.title"),
        subtitle: t("soc.dnse.subtitle"),
      },
      loading && jobs.length === 0
        ? createElement("p", { className: styles.emptyState }, t("soc.dnse.loading"))
        : error
          ? createElement("div", { className: styles.inlineError }, error)
          : createElement(
              "div",
              null,
              createElement(
                "div",
                { className: styles.sectionCard },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dnse.trigger_title")),
                createElement(
                  "div",
                  { className: "s5_0_SocDnseBackfillPanel",  },
                  createElement(
                    "div",
                    null,
                    createElement("label", { className: "s5_1_SocDnseBackfillPanel",  }, t("soc.dnse.symbol")),
                    createElement(
                      "input",
                      {
                        type: "text",
                        value: symbol,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSymbol(e.target.value),
                        className: styles.searchInput,
                        placeholder: "VCB, FPT, VIC...",
                      },
                    ),
                  ),
                  createElement(
                    "div",
                    null,
                    createElement("label", { className: "s5_2_SocDnseBackfillPanel",  }, t("soc.dnse.date_from")),
                    createElement(
                      "input",
                      {
                        type: "date",
                        value: dateFrom,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value),
                        className: styles.searchInput,
                        onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
                        onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
                      },
                    ),
                  ),
                  createElement(
                    "div",
                    null,
                    createElement("label", { className: "s5_3_SocDnseBackfillPanel",  }, t("soc.dnse.date_to")),
                    createElement(
                      "input",
                      {
                        type: "date",
                        value: dateTo,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value),
                        className: styles.searchInput,
                        onClick: (e: any) => { try { e.target.showPicker(); } catch {} },
                        onFocus: (e: any) => { try { e.target.showPicker(); } catch {} },
                      },
                    ),
                  ),
                ),
                createElement(
                  "button",
                  {
                    onClick: handleSubmit,
                    disabled: submitting,
                    className: styles.actionBtn,
                    style: {
                      marginTop: "0.75rem",
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      cursor: submitting ? "not-allowed" : "pointer",
                    },
                  },
                  submitting ? t("soc.dnse.submitting") : t("soc.dnse.start_backfill"),
                ),
              ),
              createElement(
                "div",
                { className: `styles.sectionCard s5_4_SocDnseBackfillPanel`,  },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dnse.recent_jobs")),
                jobs.length === 0
                  ? createElement("p", { className: styles.emptyState }, t("soc.dnse.no_jobs"))
                  : createElement(
                      "div",
                      { className: "s5_5_SocDnseBackfillPanel",  },
                      jobs.slice(0, 15).map((job) =>
                        createElement(
                          "div",
                          {
                            key: job.id,
                            className: "s5_6_SocDnseBackfillPanel", 
                          },
                          createElement(
                            "div",
                            { className: "s5_7_SocDnseBackfillPanel",  },
                            createElement("span", { className: "s5_8_SocDnseBackfillPanel",  }, job.symbol),
                            createElement("span", { className: "s5_9_SocDnseBackfillPanel",  },
                              job.date || "N/A",
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
                          job.error
                            ? createElement("span", { className: "s5_10_SocDnseBackfillPanel",  }, job.error)
                            : null,
                        ),
                      ),
                    ),
              ),
            ),
    ),
  );
}
