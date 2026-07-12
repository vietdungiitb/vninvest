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
                  { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" } },
                  createElement(
                    "div",
                    null,
                    createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "0.25rem", display: "block" } }, t("soc.dnse.symbol")),
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
                    createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "0.25rem", display: "block" } }, t("soc.dnse.date_from")),
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
                    createElement("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted, #94a3b8)", marginBottom: "0.25rem", display: "block" } }, t("soc.dnse.date_to")),
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
                { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dnse.recent_jobs")),
                jobs.length === 0
                  ? createElement("p", { className: styles.emptyState }, t("soc.dnse.no_jobs"))
                  : createElement(
                      "div",
                      { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
                      jobs.slice(0, 15).map((job) =>
                        createElement(
                          "div",
                          {
                            key: job.id,
                            style: {
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "6px",
                              background: "rgba(15, 23, 42, 0.3)",
                              border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                            },
                          },
                          createElement(
                            "div",
                            { style: { flex: 1 } },
                            createElement("span", { style: { fontWeight: 700, color: "var(--accent-cyan, #06b6d4)" } }, job.symbol),
                            createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginLeft: "0.5rem" } },
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
                            ? createElement("span", { style: { fontSize: "0.7rem", color: "#f87171", marginLeft: "0.5rem" } }, job.error)
                            : null,
                        ),
                      ),
                    ),
              ),
            ),
    ),
  );
}
