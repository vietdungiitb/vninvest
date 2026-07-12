import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocScreenerRuleModal } from "./SocScreenerRuleModal.js";
import { SocScreenerConfigForm } from "./SocScreenerConfigForm.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import styles from "./soc.module.css";

interface ScreenerConfig {
  scan_interval?: number;
  max_symbols?: number;
  alert_cooldown?: number;
  retention_hours?: number;
  scan_interval_seconds?: number;
  max_symbols_per_scan?: number;
  alert_cooldown_seconds?: number;
  result_retention_hours?: number;
  max_alerts_per_symbol_per_hour?: number;
  [key: string]: unknown;
}

interface ScreenerRule {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  threshold?: unknown;
  value?: unknown;
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
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<ScreenerConfig | null>(null);
  const [rules, setRules] = useState<ScreenerRule[]>([]);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [alerts, setAlerts] = useState<ScreenerAlert[]>([]);
  const [metrics, setMetrics] = useState<ScreenerMetrics | null>(null);
  const [previewModal, setPreviewModal] = useState<{ before: Record<string, unknown>; after: Record<string, unknown> } | null>(null);
  const [applying, setApplying] = useState(false);
  const [manualSymbols, setManualSymbols] = useState("");
  const [scanning, setScanning] = useState(false);
  const [ruleModal, setRuleModal] = useState<{ mode: "create" | "edit"; rule?: ScreenerRule } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cfg, rulesData, resultsData, alertsData, m] = await Promise.all([
        defaultCoreApiAdapter.getSocScreenerConfig(),
        defaultCoreApiAdapter.getSocScreenerRules(),
        defaultCoreApiAdapter.getSocScreenerResults(),
        defaultCoreApiAdapter.getSocScreenerAlerts(),
        defaultCoreApiAdapter.getSocScreenerMetrics(),
      ]);

      setConfig(cfg);
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

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApplyConfig = async () => {
    if (!previewModal) return;
    try {
      setApplying(true);
      await defaultCoreApiAdapter.applySocScreenerConfig(previewModal.after as ScreenerConfig);
      showToast(t("soc.screener.config_saved"), "success");
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("soc.screener.apply_failed"), "error");
    } finally {
      setApplying(false);
    }
  };

  const handleManualScan = async () => {
    if (!manualSymbols.trim()) {
      showToast(t("soc.screener.scan_symbols_required"), "error");
      return;
    }
    setScanning(true);
    try {
      const symbols = manualSymbols.split(",").map((s) => s.trim()).filter(Boolean);
      await defaultCoreApiAdapter.manualSocScreenerScan(symbols);
      showToast(t("soc.screener.scan_queued"), "success");
      setManualSymbols("");
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("soc.screener.scan_failed"), "error");
    } finally {
      setScanning(false);
    }
  };

  const handleOpenCreateRule = () => {
    setRuleModal({ mode: "create" });
  };

  const handleOpenEditRule = (rule: ScreenerRule) => {
    setRuleModal({ mode: "edit", rule });
  };

  const handleRuleConfirm = async (rule: { name: string; type: string; enabled: boolean; threshold?: unknown; value?: unknown }) => {
    try {
      if (ruleModal?.mode === "create") {
        await defaultCoreApiAdapter.createSocScreenerRule({
          name: rule.name,
          type: rule.type,
          enabled: rule.enabled,
          threshold: rule.threshold,
          value: rule.value,
        });
      } else if (ruleModal?.mode === "edit" && ruleModal.rule) {
        await defaultCoreApiAdapter.updateSocScreenerRule(ruleModal.rule.id, {
          name: rule.name,
          type: rule.type,
          enabled: rule.enabled,
          threshold: rule.threshold,
          value: rule.value,
        });
      }
      showToast(t("soc.screener.rule_saved"), "success");
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("soc.screener.rule_save_failed"), "error");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const confirmed = await confirm({
      title: t("soc.screener.delete_rule_title"),
      message: t("soc.screener.delete_rule_confirm"),
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await defaultCoreApiAdapter.deleteSocScreenerRule(ruleId);
      showToast(t("soc.screener.rule_deleted"), "success");
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("soc.screener.delete_failed"), "error");
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
              createElement(SocScreenerConfigForm, {
                initialConfig: config || {},
                onSave: handleApplyConfig,
                onCancel: () => {},
                loading: applying,
              }),
            ),
            createElement("div", { className: styles.sectionCard, style: { marginTop: "1.25rem" } },
              createElement("div", { className: styles.sectionCardTitle, style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                t("soc.screener.rules_title"),
                createElement(
                  "button",
                  { onClick: handleOpenCreateRule, className: styles.actionBtn, style: { background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: "0.75rem" } },
                  t("soc.screener.add_rule")
                ),
              ),
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
                            onClick: () => handleOpenEditRule(rule),
                            className: styles.actionBtn,
                            style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)", fontSize: "0.65rem", marginRight: "0.25rem" },
                          },
                          t("soc.actions.edit"),
                        ),
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
          onConfirm: handleApplyConfig,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
    ruleModal
      ? createElement(SocScreenerRuleModal, {
          mode: ruleModal.mode,
          initial: ruleModal.rule,
          onConfirm: handleRuleConfirm,
          onCancel: () => setRuleModal(null),
          loading: false,
        })
      : null,
    toast
      ? createElement(
          "div",
          {
            style: {
              position: "fixed",
              bottom: "1.5rem",
              right: "1.5rem",
              zIndex: 200,
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: toast.type === "success" ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              animation: "slideIn 0.3s ease-out",
            },
          },
          toast.message,
        )
      : null,
  );
}