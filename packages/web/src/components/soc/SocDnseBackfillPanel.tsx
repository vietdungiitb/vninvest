import { createElement, useEffect, useState, useRef } from "react";
import { Button } from "../ui/button.js";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { validateDateRange } from "./socValidation.js";
import { getStatusBadgeStyle } from "./socStatusColors.js";
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
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [jobs, setJobs] = useState<BackfillJob[]>([]);
  const [symbol, setSymbol] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const jobsPageSize = 10;
  const mountedRef = useRef(true);
  const jobsRef = useRef<BackfillJob[]>([]);

  const fetchJobs = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getDnseBackfillJobs: () => Promise<{ jobs?: BackfillJob[]; results?: BackfillJob[]; data?: BackfillJob[] }>;
      };
      const data = await adapter.getDnseBackfillJobs();
      const list = (data as any).jobs || (data as any).results || (data as any).data || [];
      if (!mountedRef.current) return;
      setJobs(list);
      setError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Cannot load DNSE backfill jobs.");
    } finally {
      if (!isSilent && mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    mountedRef.current = true;
    fetchJobs(false);
    const id = window.setInterval(() => {
      if (jobsRef.current.some((j) => j.status === "running" || j.status === "queued")) {
        fetchJobs(true);
      }
    }, 5000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  const handleSubmit = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setFormError(t("soc.dnse.symbol_required"));
      return;
    }
    if (!/^[A-Z0-9]{3,4}$/.test(sym)) {
      setFormError(t("soc.dnse.symbol_invalid", { defaultValue: "Mã không hợp lệ (3-4 ký tự A-Z0-9, VD: VCB, FPT)" }));
      return;
    }
    {
      const dateErr = validateDateRange(dateFrom, dateTo, t);
      if (dateErr) { setFormError(dateErr); return; }
    }
    setFormError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        triggerDnseBackfill: (payload: Record<string, unknown>) => Promise<void>;
      };
      await adapter.triggerDnseBackfill({
        symbol: sym,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setSuccess(t("soc.dnse.backfill_started"));
      setSymbol("");
      setDateFrom("");
      setDateTo("");
      await fetchJobs(false);
      setJobsPage(1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Backfill failed.");
    } finally {
      setSubmitting(false);
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
              formError ? createElement("div", { className: styles.inlineError, style: { marginBottom: "0.75rem" } }, formError) : null,
              success ? createElement("div", { className: styles.inlineSuccess, style: { marginBottom: "0.75rem" } }, success) : null,
              createElement(
                "div",
                { className: styles.sectionCard },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dnse.trigger_title")),
                createElement(
                  "div",
                  { },
                  createElement(
                    "div",
                    null,
                    createElement("label", { }, t("soc.dnse.symbol")),
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
                    createElement("label", { }, t("soc.dnse.date_from")),
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
                    createElement("label", { }, t("soc.dnse.date_to")),
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
                      background: "rgba(var(--soc-rgb-10b981) / 0.2)",
                      color: "var(--color-success-500, #34d399)",
                       cursor: submitting ? "not-allowed" : "pointer",
                    },
                  },
                  submitting ? t("soc.dnse.submitting") : t("soc.dnse.start_backfill"),
                ),
              ),
              createElement(
                "div",
                { className: styles.sectionCard,  },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.dnse.recent_jobs")),
                jobs.length === 0
                  ? createElement("p", { className: styles.emptyState }, t("soc.dnse.no_jobs"))
                  : (() => {
                      const totalPages = Math.max(1, Math.ceil(jobs.length / jobsPageSize));
                      const safePage = Math.min(jobsPage, totalPages);
                      const paged = jobs.slice((safePage - 1) * jobsPageSize, safePage * jobsPageSize);
                      return createElement(
                      "div",
                      { },
                      paged.map((job) =>
                        createElement(
                          "div",
                          {
                            key: job.id,
                            },
                          createElement(
                            "div",
                            { },
                            createElement("span", { }, job.symbol),
                            createElement("span", { },
                              job.date || "N/A",
                            ),
                          ),
                          createElement(
                            "span",
                            {
                              className: styles.statusBadge,
                              style: { ...getStatusBadgeStyle(job.status) },
                            },
                            job.status,
                          ),
                          job.error
                            ? createElement("span", { }, job.error)
                            : null,
                        ),
                      ),
                      totalPages > 1 ? createElement(
                        "div",
                        { className: styles.pagination, style: { marginTop: "0.75rem" } },
                        createElement(Button, { className: styles.pageBtn, variant: "ghost", size: "sm", disabled: safePage <= 1, onClick: () => setJobsPage((p) => Math.max(1, p - 1)) }, t("soc.actions.prev")),
                        createElement("span", { style: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" } }, t("soc.actions.page", { page: safePage })),
                        createElement(Button, { className: styles.pageBtn, variant: "ghost", size: "sm", disabled: safePage >= totalPages, onClick: () => setJobsPage((p) => p + 1) }, t("soc.actions.next")),
                      ) : null,
                    );
                    })(),
              ),
            ),
    ),
  );
}
