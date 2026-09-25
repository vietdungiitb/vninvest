import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocServiceHealthCard } from "./SocServiceHealthCard.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface VnbrokerConfig {
  preferred_provider?: string;
  max_retries?: number;
  retry_delay?: number;
  rpm?: number;
  burst?: number;
  circuit_breaker_threshold?: number;
  timeout?: {
    connect?: number;
    read?: number;
    write?: number;
    pool?: number;
  };
  [key: string]: unknown;
}

interface VnbrokerHealth {
  status?: string;
  avg_response_ms?: number;
  provider_health?: {
    healthy?: number;
    degraded?: number;
    critical?: number;
  };
  [key: string]: unknown;
}

interface VnbrokerProvider {
  provider: string;
  label: string;
  enabled: boolean;
  in_active_cycle?: boolean;
  runtime_ready?: boolean;
  runtime_gate?: string;
  [key: string]: unknown;
}

interface BenchmarkResult {
  provider: string;
  latency_ms: number;
  rpm: number;
  success_rate: number;
  rate_limit_pct: number;
  [key: string]: unknown;
}

const vnbrokerAdapter = defaultCoreApiAdapter as unknown as {
  getSocVnbrokerConfig: () => Promise<VnbrokerConfig>;
  getSocVnbrokerHealth: () => Promise<VnbrokerHealth>;
  getSocVnbrokerProviders: () => Promise<{ providers?: VnbrokerProvider[] }>;
  getSocVnbrokerBenchmarkLatest: () => Promise<{ results?: BenchmarkResult[] }>;
  getSocVnbrokerCircuitBreaker: () => Promise<{ status?: string; tripped?: boolean; tripped_at?: string | null }>;
  getSocVnbrokerMetrics: () => Promise<{ throughput: number; error_rate: number }>;
  applySocVnbrokerConfig: (cfg: VnbrokerConfig) => Promise<void>;
  previewSocVnbrokerConfig: (cfg: VnbrokerConfig) => Promise<{
    change_summary?: string[];
    impact_warnings?: string[];
    validation_errors?: string[];
  }>;
  testSocVnbrokerConnection: () => Promise<{ status?: string; message?: string }>;
  runSocVnbrokerBenchmark: (payload: Record<string, unknown>) => Promise<{ results?: BenchmarkResult[] }>;
};

export function SocVnbrokerPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<VnbrokerConfig | null>(null);
  const [health, setHealth] = useState<VnbrokerHealth | null>(null);
  const [providers, setProviders] = useState<VnbrokerProvider[]>([]);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [editConfig, setEditConfig] = useState("");
  const [previewModal, setPreviewModal] = useState<{ before: Record<string, unknown>; after: Record<string, unknown> } | null>(null);
  const [applying, setApplying] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkProvider, setBenchmarkProvider] = useState("all");

  // Circuit Breaker, preview details & connection testing states
  const [circuitBreaker, setCircuitBreaker] = useState<{ status?: string; tripped?: boolean; tripped_at?: string | null } | null>(null);
  const [previewResults, setPreviewResults] = useState<{ changeSummary?: string[]; impactWarnings?: string[]; validationErrors?: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [metrics, setMetrics] = useState<{ throughput: number; error_rate: number } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cfg, h, prov, bench, cb] = await Promise.all([
        vnbrokerAdapter.getSocVnbrokerConfig(),
        vnbrokerAdapter.getSocVnbrokerHealth(),
        vnbrokerAdapter.getSocVnbrokerProviders(),
        vnbrokerAdapter.getSocVnbrokerBenchmarkLatest(),
        vnbrokerAdapter.getSocVnbrokerCircuitBreaker(),
      ]);

      setConfig(cfg);
      setEditConfig(JSON.stringify(cfg || {}, null, 2));
      setHealth(h);
      setProviders(prov.providers || []);
      setBenchmarkResults(bench.results || []);
      setCircuitBreaker(cb);
      vnbrokerAdapter.getSocVnbrokerMetrics().then(setMetrics).catch(() => setMetrics(null));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load vnbroker data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePreview = async () => {
    try {
      const parsed = JSON.parse(editConfig) as VnbrokerConfig;
      setPreviewing(true);
      const result = await vnbrokerAdapter.previewSocVnbrokerConfig(parsed);
      setPreviewResults({
        changeSummary: result.change_summary || [],
        impactWarnings: result.impact_warnings || [],
        validationErrors: result.validation_errors || [],
      });
      setPreviewModal({ before: config || {}, after: parsed });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soc.vnbroker.invalid_json"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as VnbrokerConfig;
      setApplying(true);
      await vnbrokerAdapter.applySocVnbrokerConfig(parsed);
      setPreviewModal(null);
      setPreviewResults(null);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarkLoading(true);
    try {
      const payload = benchmarkProvider !== "all" ? { provider: benchmarkProvider } : {};
      const result = await vnbrokerAdapter.runSocVnbrokerBenchmark(payload);
      setBenchmarkResults(result.results || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Benchmark failed.");
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    const ok = await confirm({
      title: t("soc.vnbroker.reset_title"),
      message: t("soc.vnbroker.reset_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await vnbrokerAdapter.applySocVnbrokerConfig({});
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await vnbrokerAdapter.testSocVnbrokerConnection();
      toast.success(t("soc.vnbroker.connection_success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setTestingConnection(false);
    }
  };

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value),
    );
  };

  return createElement(
    "div",
    { className: styles.glassPanel },
    createElement(
      ShellPanel,
      {
        title: t("soc.vnbroker.title"),
        subtitle: t("soc.vnbroker.subtitle"),
      },
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.vnbroker.loading"))
        : error
          ? createElement("div", { className: styles.inlineError }, error)
          : createElement(
              "div",
              null,
              createElement("div", { className: styles.sectionGrid },
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.core_config_title")),
                  createElement(
                    "textarea",
                    {
                      value: editConfig,
                      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
                      className: styles.configEditor,
                      rows: 10,
                    },
                  ),
                  createElement(
                    "div",
                    { },
                    createElement(
                      "button",
                      {
                        onClick: handlePreview,
                        disabled: previewing,
                        className: styles.actionBtn,
                        style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan, #06b6d4)", cursor: previewing ? "not-allowed" : "pointer" }
                      },
                      previewing ? t("soc.prefetch.loading") : t("soc.actions.preview"),
                    ),
                    createElement(
                      "button",
                      { onClick: () => setEditConfig(JSON.stringify(config || {}, null, 2)), className: styles.actionBtn,  },
                      t("soc.actions.edit"),
                    ),
                    createElement(
                      "button",
                      { onClick: handleResetToDefaults, className: styles.actionBtn,  },
                      t("soc.vnbroker.reset_defaults"),
                    ),
                  ),
                ),
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement(
                    "div",
                    { },
                    createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.circuit_breaker_title")),
                    createElement(
                      "span",
                      {
                        className: styles.statusBadge,
                        style: {
                          background: circuitBreaker?.tripped ? "rgba(var(--soc-rgb-ef4444) / 0.15)" : "rgba(var(--soc-rgb-34d399) / 0.15)",
                          color: circuitBreaker?.tripped ? toneColor("danger") : "var(--color-success-500, #34d399)",
                          fontSize: "var(--fs-xs)",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontWeight: 600,
                        },
                      },
                      circuitBreaker?.tripped ? t("soc.vnbroker.breaker_tripped") : t("soc.vnbroker.breaker_closed"),
                    ),
                  ),
                  createElement(
                    "div",
                    { },
                    circuitBreaker?.tripped
                      ? `Tripped at: ${circuitBreaker.tripped_at ? circuitBreaker.tripped_at.split("T")[1]?.slice(0, 8) : "N/A"}`
                      : t("soc.vnbroker.breaker_normal_desc"),
                  ),
                  createElement("hr", { }),
                  createElement("div", { className: styles.sectionCardTitle,  }, t("soc.vnbroker.test_connection")),
                  createElement(
                    "button",
                    {
                      onClick: handleTestConnection,
                      disabled: testingConnection,
                      className: styles.actionBtn,
                      style: {
                        background: "rgba(var(--soc-rgb-38bdf8) / 0.15)",
                        color: "var(--accent-cyan, #06b6d4)",
                        cursor: testingConnection ? "not-allowed" : "pointer",
                        width: "100%",
                      },
                    },
                    testingConnection ? t("soc.vnbroker.testing_connection") : t("soc.vnbroker.test_connection"),
                  ),
                ),
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.health_title")),
                  createElement("div", { className: styles.metricGrid },
                    renderMetricCard(t("soc.health.status_healthy"), health?.provider_health?.healthy ?? 0, "var(--color-success-500, #34d399)"),
                    renderMetricCard(t("soc.health.status_degraded"), health?.provider_health?.degraded ?? 0, toneColor("warning")),
                    renderMetricCard(t("soc.health.status_critical"), health?.provider_health?.critical ?? 0, toneColor("danger")),
                  ),
                  createElement("div", { className: styles.metricGrid,  },
                    renderMetricCard(t("soc.vnbroker.throughput"), `${(metrics?.throughput ?? 0).toFixed(1)}/s`, "var(--accent-cyan, #06b6d4)"),
                    renderMetricCard(t("soc.vnbroker.error_rate"), `${metrics?.error_rate ?? 0}%`, toneColor(metrics && metrics.error_rate > 0 ? "danger" : "success")),
                    renderMetricCard(t("soc.vnbroker.avg_latency"), `${health?.avg_response_ms ?? 0}ms`, toneColor("warning")),
                  ),
                ),
              ),
              createElement("div", { className: styles.sectionCard,  },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.benchmark_title")),
                createElement(
                  "div",
                  { },
                  createElement(
                    "select",
                    {
                      value: benchmarkProvider,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setBenchmarkProvider(e.target.value),
                      className: styles.searchInput,
                      
                    },
                    createElement("option", { value: "all" }, t("soc.vnbroker.all_providers")),
                    providers.map((p) => createElement("option", { key: p.provider, value: p.provider }, p.label)),
                  ),
                  createElement(
                    "button",
                    {
                      onClick: handleRunBenchmark,
                      disabled: benchmarkLoading,
                      className: styles.actionBtn,
                      style: {
                        background: "rgba(var(--soc-rgb-10b981) / 0.15)",
                        color: "var(--color-success-500, #34d399)",
                        cursor: benchmarkLoading ? "not-allowed" : "pointer",
                      },
                    },
                    benchmarkLoading ? t("soc.vnbroker.running_benchmark") : t("soc.vnbroker.run_benchmark"),
                  ),
                ),
                benchmarkResults.length > 0
                  ? createElement(
                      "table",
                      { },
                      createElement("thead", null,
                        createElement("tr", null,
                          createElement("th", { }, t("soc.vnbroker.provider")),
                          createElement("th", { }, t("soc.vnbroker.latency")),
                          createElement("th", { }, "RPM"),
                          createElement("th", { }, t("soc.vnbroker.success_rate")),
                          createElement("th", { }, t("soc.vnbroker.rate_limit")),
                        ),
                      ),
                      createElement("tbody", null,
                        benchmarkResults.map((r) => {
                           const successColor = r.success_rate >= 100 ? "var(--color-success-500, #34d399)" : r.success_rate >= 95 ? toneColor("warning") : toneColor("danger");
                           const rateLimitColor = r.rate_limit_pct > 5 ? toneColor("danger") : "var(--color-text-muted, #94a3b8)";
                          return createElement(
                            "tr",
                            { key: r.provider, },
                            createElement("td", { }, r.provider),
                            createElement("td", { }, `${r.latency_ms}ms`),
                            createElement("td", { }, r.rpm),
                            createElement(
                              "td",
                              { },
                              createElement(
                                "span",
                                {
                                  style: {
                                    background: `${successColor}15`,
                                    color: successColor,
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: "4px",
                                    fontSize: "var(--fs-xs)",
                                    fontWeight: 600,
                                  },
                                },
                                `${r.success_rate}%`
                              )
                            ),
                            createElement(
                              "td",
                              { },
                              createElement(
                                "span",
                                {
                                  style: {
                                    background: r.rate_limit_pct > 5 ? "rgba(var(--soc-rgb-ef4444) / 0.15)" : "transparent",
                                    color: rateLimitColor,
                                    padding: r.rate_limit_pct > 5 ? "0.2rem 0.5rem" : "0",
                                    borderRadius: "4px",
                                    fontSize: "var(--fs-xs)",
                                    fontWeight: r.rate_limit_pct > 5 ? 600 : 400,
                                  },
                                },
                                `${r.rate_limit_pct}%`
                              )
                            ),
                          );
                        }),
                      ),
                    )
                  : createElement("p", { className: styles.emptyState }, t("soc.vnbroker.no_benchmark_results")),
              ),
              createElement("div", { className: styles.sectionCard,  },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.providers_title")),
                createElement(
                  "div",
                  { },
                  providers.map((p) =>
                    createElement(SocServiceHealthCard, {
                      key: p.provider,
                      service: {
                        service_key: p.provider,
                        name: p.label,
                        domain: "vnbroker",
                        status: p.runtime_ready ? "healthy" : (p.enabled ? "degraded" : "unknown"),
                        is_active: Boolean(p.enabled && p.runtime_ready),
                        avg_response_ms: health?.avg_response_ms,
                      },
                    }),
                  ),
                ),
              ),
            ),
    ),
    previewModal
      ? createElement(SocConfigPreviewModal, {
          before: previewModal.before,
          after: previewModal.after,
          changeSummary: previewResults?.changeSummary,
          impactWarnings: previewResults?.impactWarnings,
          validationErrors: previewResults?.validationErrors,
          onConfirm: handleApply,
          onCancel: () => {
            setPreviewModal(null);
            setPreviewResults(null);
          },
          loading: applying,
        })
      : null,
  );
}
