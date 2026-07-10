import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface ScreenerConfig {
  scan_interval?: number;
  max_symbols?: number;
  alert_cooldown?: number;
  retention_hours?: number;
  [key: string]: unknown;
}

interface ScreenerRule {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  [key: string]: unknown;
}

interface ScreenerResult {
  id: string;
  symbol: string;
  rule_name: string;
  timestamp: string;
  value: unknown;
}

interface ScreenerAlert {
  id: string;
  symbol: string;
  message: string;
  timestamp: string;
}

interface ScreenerMetrics {
  avg_scan_duration_ms?: number;
  rules_hit_rate?: number;
}

export function SocScreenerPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<ScreenerConfig | null>(null);
  const [rules, setRules] = useState<ScreenerRule[]>([]);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [alerts, setAlerts] = useState<ScreenerAlert[]>([]);
  const [metrics, setMetrics] = useState<ScreenerMetrics | null>(null);
  const [editConfig, setEditConfig] = useState("");
  const [previewModal, setPreviewModal] = useState<{ before: Record<string, unknown>; after: Record<string, unknown> } | null>(null);
  const [applying, setApplying] = useState(false);
  const [manualSymbols, setManualSymbols] = useState("");
  const [scanning, setScanning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocScreenerConfig: () => Promise<ScreenerConfig>;
        getSocScreenerRules: () => Promise<{ rules?: ScreenerRule[] }>;
        getSocScreenerResults: () => Promise<{ symbols_matched?: ScreenerResult[] }>;
        getSocScreenerAlerts: () => Promise<{ alerts?: ScreenerAlert[] }>;
        getSocScreenerMetrics: () => Promise<ScreenerMetrics>;
      };

      const [cfg, rulesData, resultsData, alertsData, m] = await Promise.all([
        adapter.getSocScreenerConfig(),
        adapter.getSocScreenerRules(),
        adapter.getSocScreenerResults(),
        adapter.getSocScreenerAlerts(),
        adapter.getSocScreenerMetrics(),
      ]);

      setConfig(cfg);
      setEditConfig(JSON.stringify(cfg || {}, null, 2));
      setRules(rulesData.rules || []);
      setResults(resultsData.symbols_matched || []);
      setAlerts(alertsData.alerts || []);
      setMetrics(m);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load screener data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(editConfig) as ScreenerConfig;
      setPreviewModal({ before: config || {}, after: parsed });
    } catch {
      alert(t("soc.screener.invalid_json"));
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as ScreenerConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocScreenerConfig: (cfg: ScreenerConfig) => Promise<void> };
      await adapter.applySocScreenerConfig(parsed);
      setPreviewModal(null);
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Apply failed."}`);
    } finally {
      setApplying(false);
    }
  };

  const handleManualScan = async () => {
    if (!manualSymbols.trim()) {
      alert(t("soc.screener.scan_symbols_required"));
      return;
    }
    setScanning(true);
    try {
      const symbols = manualSymbols.split(",").map((s) => s.trim()).filter(Boolean);
      const adapter = defaultCoreApiAdapter as unknown as { manualSocScreenerScan: (symbols: string[]) => Promise<void> };
      await adapter.manualSocScreenerScan(symbols);
      alert(t("soc.screener.scan_queued"));
      setManualSymbols("");
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Scan failed."}`);
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm(t("soc.screener.delete_rule_confirm"))) return;
    try {
      const adapter = defaultCoreApiAdapter as unknown as { deleteSocScreenerRule: (id: string) => Promise<void> };
      await adapter.deleteSocScreenerRule(ruleId);
      await fetchData();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Delete failed."}`);
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
        title: t("soc.screener.title"),
        subtitle: t("soc.screener.subtitle"),
      },
      loading
        ? createElement("p", { className: styles.emptyState }, t("soc.screener.loading"))
        : error
          ? createElement("div", { className: styles.inlineError }, error)
          : createElement(
              "div",
              null,
              createElement("div", { className: styles.sectionCard },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.config_title")),
                createElement(
                  "textarea",
                  {
                    value: editConfig,
                    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
                    className: styles.configEditor,
                    rows: 6,
                  },
                ),
                createElement(
                  "div",
                  { style: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" } },
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
                ),
              ),
              createElement("div", { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.rules_title")),
                createElement(
                  "table",
                  { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" } },
                  createElement("thead", null,
                    createElement("tr", null,
                      createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.screener.rule_name")),
                      createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.screener.rule_type")),
                      createElement("th", { style: { textAlign: "center", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.screener.rule_enabled")),
                      createElement("th", { style: { textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, t("soc.actions.actions")),
                    ),
                  ),
                  createElement("tbody", null,
                    rules.map((rule) =>
                      createElement("tr", { key: rule.id },
                        createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)" } }, rule.name),
                        createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)", color: "var(--text-muted)" } }, rule.type),
                        createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)", textAlign: "center" } },
                          rule.enabled ? "\u2705" : "\u274C",
                        ),
                        createElement("td", { style: { padding: "0.5rem", borderBottom: "1px solid var(--border-default)", textAlign: "right" } },
                          createElement(
                            "button",
                            {
                              onClick: () => handleDeleteRule(rule.id),
                              className: styles.actionBtn,
                              style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem" },
                            },
                            t("soc.actions.delete"),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              createElement("div", { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.manual_scan_title")),
                createElement(
                  "div",
                  { style: { display: "flex", gap: "0.5rem", alignItems: "center" } },
                  createElement(
                    "input",
                    {
                      type: "text",
                      value: manualSymbols,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setManualSymbols(e.target.value),
                      className: styles.searchInput,
                      placeholder: t("soc.screener.symbols_placeholder"),
                      style: { flex: 1 },
                    },
                  ),
                  createElement(
                    "button",
                    {
                      onClick: handleManualScan,
                      disabled: scanning,
                      className: styles.actionBtn,
                      style: {
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        cursor: scanning ? "not-allowed" : "pointer",
                      },
                    },
                    scanning ? t("soc.screener.scanning") : t("soc.screener.run_scan"),
                  ),
                ),
              ),
              createElement("div", { className: styles.sectionGrid, style: { marginTop: "1.25rem" } },
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.results_title")),
                  results.length === 0
                    ? createElement("p", { className: styles.emptyState }, t("soc.screener.no_results"))
                    : createElement(
                        "div",
                        { style: { maxHeight: "200px", overflow: "auto" } },
                        results.slice(0, 20).map((r) =>
                          createElement(
                            "div",
                            {
                              key: r.id,
                              style: {
                                padding: "0.5rem",
                                borderBottom: "1px solid var(--border-default)",
                                fontSize: "0.75rem",
                              },
                            },
                            createElement("span", { style: { fontWeight: 700, color: "var(--accent-cyan)" } }, r.symbol),
                            ` \u2022 ${r.rule_name}`,
                            createElement("span", { style: { float: "right", color: "var(--text-muted)" } },
                              r.timestamp?.split("T")[1]?.slice(0, 8) || "",
                            ),
                          ),
                        ),
                      ),
                ),
                createElement(
                  "div",
                  { className: styles.sectionCard },
                  createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.alerts_title")),
                  alerts.length === 0
                    ? createElement("p", { className: styles.emptyState }, t("soc.screener.no_alerts"))
                    : createElement(
                        "div",
                        { style: { maxHeight: "200px", overflow: "auto" } },
                        alerts.slice(0, 10).map((a) =>
                          createElement(
                            "div",
                            {
                              key: a.id,
                              style: {
                                padding: "0.5rem",
                                borderBottom: "1px solid var(--border-default)",
                                fontSize: "0.75rem",
                              },
                            },
                            createElement("span", { style: { fontWeight: 700, color: "#fbbf24" } }, a.symbol),
                            `: ${a.message}`,
                          ),
                        ),
                      ),
                ),
              ),
              createElement("div", { className: styles.metricGrid, style: { marginTop: "1.25rem" } },
                renderMetricCard(t("soc.screener.avg_scan"), `${metrics?.avg_scan_duration_ms ?? 0}ms`, "var(--accent-cyan)"),
                renderMetricCard(t("soc.screener.hit_rate"), `${metrics?.rules_hit_rate ?? 0}%`, "#34d399"),
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
