import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocServiceHealthCard } from "./SocServiceHealthCard.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
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
  key: string;
  name: string;
  status: string;
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
      alert(`Error: ${err instanceof Error ? err.message : t("soc.vnbroker.invalid_json")}`);
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
      alert(`Error: ${err instanceof Error ? err.message : "Apply failed."}`);
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
      alert(`Error: ${err instanceof Error ? err.message : "Benchmark failed."}`);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm(t("soc.vnbroker.reset_confirm"))) return;
    try {
      await vnbrokerAdapter.applySocVnbrokerConfig({});
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Reset failed."}`);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await vnbrokerAdapter.testSocVnbrokerConnection();
      alert(t("soc.vnbroker.connection_success"));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Connection test failed."}`);
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
                    { style: { display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" } },
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
                      { onClick: () => setEditConfig(JSON.stringify(config || {}, null, 2)), className: styles.actionBtn, style: { background: "rgba(255, 191, 77, 0.15)", color: "var(--accent-amber)" } },
                      t("soc.actions.edit"),
                    ),
                    createElement(
                      "button",
                      { onClick: handleResetToDefaults, className: styles.actionBtn, style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" } },
                      t("soc.vnbroker.reset_defaults"),
                    ),
                  ),
                ),
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" } },
                    createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.circuit_breaker_title")),
                    createElement(
                      "span",
                      {
                        className: styles.statusBadge,
                        style: {
                          background: circuitBreaker?.tripped ? "rgba(239, 68, 68, 0.15)" : "rgba(52, 211, 153, 0.15)",
                          color: circuitBreaker?.tripped ? "#f87171" : "#34d399",
                          fontSize: "0.7rem",
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
                    { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", lineHeight: "1.4" } },
                    circuitBreaker?.tripped
                      ? `Tripped at: ${circuitBreaker.tripped_at ? circuitBreaker.tripped_at.split("T")[1]?.slice(0, 8) : "N/A"}`
                      : t("soc.vnbroker.breaker_normal_desc"),
                  ),
                  createElement("hr", { style: { border: "none", borderTop: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", margin: "0.75rem 0" } }),
                  createElement("div", { className: styles.sectionCardTitle, style: { fontSize: "0.8rem", marginBottom: "0.5rem" } }, t("soc.vnbroker.test_connection")),
                  createElement(
                    "button",
                    {
                      onClick: handleTestConnection,
                      disabled: testingConnection,
                      className: styles.actionBtn,
                      style: {
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
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
                    renderMetricCard(t("soc.health.status_healthy"), health?.provider_health?.healthy ?? 0, "#34d399"),
                    renderMetricCard(t("soc.health.status_degraded"), health?.provider_health?.degraded ?? 0, "#fbbf24"),
                    renderMetricCard(t("soc.health.status_critical"), health?.provider_health?.critical ?? 0, "#f87171"),
                  ),
                  createElement("div", { className: styles.metricGrid, style: { marginTop: "0.75rem" } },
                    renderMetricCard(t("soc.vnbroker.throughput"), `${health?.avg_response_ms ? (1000 / health.avg_response_ms).toFixed(1) : 0}/s`, "var(--accent-cyan, #06b6d4)"),
                    renderMetricCard(t("soc.vnbroker.avg_latency"), `${health?.avg_response_ms ?? 0}ms`, "#fbbf24"),
                  ),
                ),
              ),
              createElement("div", { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.benchmark_title")),
                createElement(
                  "div",
                  { style: { display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" } },
                  createElement(
                    "select",
                    {
                      value: benchmarkProvider,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setBenchmarkProvider(e.target.value),
                      className: styles.searchInput,
                      style: { maxWidth: "200px" },
                    },
                    createElement("option", { value: "all" }, t("soc.vnbroker.all_providers")),
                    providers.map((p) => createElement("option", { key: p.key, value: p.key }, p.name)),
                  ),
                  createElement(
                    "button",
                    {
                      onClick: handleRunBenchmark,
                      disabled: benchmarkLoading,
                      className: styles.actionBtn,
                      style: {
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        cursor: benchmarkLoading ? "not-allowed" : "pointer",
                      },
                    },
                    benchmarkLoading ? t("soc.vnbroker.running_benchmark") : t("soc.vnbroker.run_benchmark"),
                  ),
                ),
                benchmarkResults.length > 0
                  ? createElement(
                      "table",
                      { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" } },
                      createElement("thead", null,
                        createElement("tr", null,
                          createElement("th", { style: { textAlign: "left", padding: "0.75rem", borderBottom: "2px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.vnbroker.provider")),
                          createElement("th", { style: { textAlign: "left", padding: "0.75rem", borderBottom: "2px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.vnbroker.latency")),
                          createElement("th", { style: { textAlign: "left", padding: "0.75rem", borderBottom: "2px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, "RPM"),
                          createElement("th", { style: { textAlign: "left", padding: "0.75rem", borderBottom: "2px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.vnbroker.success_rate")),
                          createElement("th", { style: { textAlign: "left", padding: "0.75rem", borderBottom: "2px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.vnbroker.rate_limit")),
                        ),
                      ),
                      createElement("tbody", null,
                        benchmarkResults.map((r) => {
                          const successColor = r.success_rate >= 100 ? "#34d399" : r.success_rate >= 95 ? "#fbbf24" : "#f87171";
                          const rateLimitColor = r.rate_limit_pct > 5 ? "#f87171" : "var(--text-muted, #94a3b8)";
                          return createElement(
                            "tr",
                            { key: r.provider, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                            createElement("td", { style: { padding: "0.75rem", fontWeight: 600 } }, r.provider),
                            createElement("td", { style: { padding: "0.75rem" } }, `${r.latency_ms}ms`),
                            createElement("td", { style: { padding: "0.75rem" } }, r.rpm),
                            createElement(
                              "td",
                              { style: { padding: "0.75rem" } },
                              createElement(
                                "span",
                                {
                                  style: {
                                    background: `${successColor}15`,
                                    color: successColor,
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  },
                                },
                                `${r.success_rate}%`
                              )
                            ),
                            createElement(
                              "td",
                              { style: { padding: "0.75rem" } },
                              createElement(
                                "span",
                                {
                                  style: {
                                    background: r.rate_limit_pct > 5 ? "rgba(239, 68, 68, 0.15)" : "transparent",
                                    color: rateLimitColor,
                                    padding: r.rate_limit_pct > 5 ? "0.2rem 0.5rem" : "0",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
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
              createElement("div", { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.providers_title")),
                createElement(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "0.75rem" } },
                  providers.map((p) =>
                    createElement(SocServiceHealthCard, {
                      key: p.key,
                      service: {
                        service_key: p.key,
                        name: p.name,
                        domain: "vnbroker",
                        status: p.status,
                        is_active: p.status !== "unhealthy",
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
