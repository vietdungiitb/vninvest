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

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocVnbrokerConfig: () => Promise<VnbrokerConfig>;
        getSocVnbrokerHealth: () => Promise<VnbrokerHealth>;
        getSocVnbrokerProviders: () => Promise<{ providers?: VnbrokerProvider[] }>;
        getSocVnbrokerBenchmarkLatest: () => Promise<{ results?: BenchmarkResult[] }>;
      };

      const [cfg, h, prov, bench] = await Promise.all([
        adapter.getSocVnbrokerConfig(),
        adapter.getSocVnbrokerHealth(),
        adapter.getSocVnbrokerProviders(),
        adapter.getSocVnbrokerBenchmarkLatest(),
      ]);

      setConfig(cfg);
      setHealth(h);
      setProviders(prov.providers || []);
      setBenchmarkResults(bench.results || []);
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

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(editConfig) as VnbrokerConfig;
      setPreviewModal({ before: config || {}, after: parsed });
    } catch {
      alert(t("soc.vnbroker.invalid_json"));
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as VnbrokerConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocVnbrokerConfig: (cfg: VnbrokerConfig) => Promise<void> };
      await adapter.applySocVnbrokerConfig(parsed);
      setPreviewModal(null);
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
      const adapter = defaultCoreApiAdapter as unknown as { runSocVnbrokerBenchmark: (payload: Record<string, unknown>) => Promise<{ results?: BenchmarkResult[] }> };
      const result = await adapter.runSocVnbrokerBenchmark(payload);
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
      const adapter = defaultCoreApiAdapter as unknown as { applySocVnbrokerConfig: (cfg: VnbrokerConfig) => Promise<void> };
      await adapter.applySocVnbrokerConfig({});
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Reset failed."}`);
    }
  };

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary)" } }, value),
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
                      value: editConfig || JSON.stringify(config || {}, null, 2),
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
                      { onClick: handlePreview, className: styles.actionBtn, style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" } },
                      t("soc.actions.preview"),
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
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.vnbroker.health_title")),
                  createElement("div", { className: styles.metricGrid },
                    renderMetricCard(t("soc.health.status_healthy"), health?.provider_health?.healthy ?? 0, "#34d399"),
                    renderMetricCard(t("soc.health.status_degraded"), health?.provider_health?.degraded ?? 0, "#fbbf24"),
                    renderMetricCard(t("soc.health.status_critical"), health?.provider_health?.critical ?? 0, "#f87171"),
                  ),
                  createElement("div", { className: styles.metricGrid, style: { marginTop: "0.75rem" } },
                    renderMetricCard(t("soc.vnbroker.throughput"), `${health?.avg_response_ms ? (1000 / health.avg_response_ms).toFixed(1) : 0}/s`, "var(--accent-cyan)"),
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
                          createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.vnbroker.provider")),
                          createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.vnbroker.latency")),
                          createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, "RPM"),
                          createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.vnbroker.success_rate")),
                          createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.vnbroker.rate_limit")),
                        ),
                      ),
                      createElement("tbody", null,
                        benchmarkResults.map((r) =>
                          createElement("tr", { key: r.provider },
                            createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)", fontWeight: 600 } }, r.provider),
                            createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, `${r.latency_ms}ms`),
                            createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, r.rpm),
                            createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, `${r.success_rate}%`),
                            createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)", color: r.rate_limit_pct > 5 ? "#f87171" : "var(--text-muted)" } }, `${r.rate_limit_pct}%`),
                          ),
                        ),
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
          onConfirm: handleApply,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
  );
}
