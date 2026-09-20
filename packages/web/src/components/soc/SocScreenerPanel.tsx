import { createElement, useEffect, useState, useRef } from "react";
import { useI18n } from "../../context/LangContext.js";
import { ShellPanel } from "../../components/ShellPageTemplate.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocScreenerRuleModal } from "./SocScreenerRuleModal.js";
import { SocScreenerConfigForm, resolveScreenerConfigSource } from "./SocScreenerConfigForm.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { toneColor } from "./socStatusColors.js";
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

/**
 * SC-02: merge edited scalars over the currently stored payload so a Save
 * from the 5-field form does not wipe `rules` (BE `from_dict` defaults
 * missing keys) nor reset flags like `enabled`/`publish_to_redis`.
 */
export function mergeScreenerConfigPayload(
  currentEnvelope: unknown,
  edited: Record<string, unknown>,
): Record<string, unknown> {
  const env = (currentEnvelope ?? {}) as Record<string, any>;
  const nested = env.config_payload ?? env.config;
  const base = nested && typeof nested === "object" ? nested : {};
  return { ...base, ...edited };
}

/**
 * SC-14: results timestamps may be full ISO (signal era) or plain session
 * dates (run-log era) — render date + HH:MM instead of time-only.
 */
export function formatScreenerTimestamp(ts: unknown): string {
  if (typeof ts !== "string" || !ts) return "";
  const datePart = ts.split("T")[0];
  const timePart = ts.split("T")[1]?.slice(0, 5);
  return timePart ? `${datePart} ${timePart}` : datePart;
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
  const [savingRule, setSavingRule] = useState(false);
  // SC-07: write capability from the ownership endpoint (default open until loaded).
  const [canWrite, setCanWrite] = useState(true);
  const [ruleModal, setRuleModal] = useState<{ mode: "create" | "edit"; rule?: ScreenerRule } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [rulesPage, setRulesPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const pageSize = 10;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cfg, rulesData, resultsData, alertsData, m, ownership] = await Promise.all([
        defaultCoreApiAdapter.getSocScreenerConfig(),
        defaultCoreApiAdapter.getSocScreenerRules(),
        defaultCoreApiAdapter.getSocScreenerResults(),
        defaultCoreApiAdapter.getSocScreenerAlerts(),
        defaultCoreApiAdapter.getSocScreenerMetrics(),
        defaultCoreApiAdapter.getSocScreenerOwnership().catch(() => null),
      ]);

      setConfig(cfg);
      const rulesList = (rulesData as any).results || (rulesData as any).rules || [];
      setRules(rulesList);
      const resultsList = (resultsData as any).results || (resultsData as any).symbols_matched || [];
      setResults(resultsList);
      const alertsList = (alertsData as any).results || (alertsData as any).alerts || [];
      setAlerts(alertsList);
      setMetrics(m);
      // SC-07: ownership endpoint drives the badge + write buttons.
      if (ownership && typeof (ownership as any).can_apply === "boolean") {
        setCanWrite((ownership as any).can_apply);
      }
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

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current != null) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (toastTimeoutRef.current != null) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3000) as unknown as number;
  };

  const handleApplyConfig = async (directConfig?: ScreenerConfig) => {
    const payload = (directConfig ?? previewModal?.after) as ScreenerConfig | undefined;
    if (!payload) return;
    try {
      setApplying(true);
      // SC-02: preserve stored rules/flags — the form only edits 5 scalars.
      const merged = mergeScreenerConfigPayload(config, payload as Record<string, unknown>);
      await defaultCoreApiAdapter.applySocScreenerConfig(merged as ScreenerConfig);
      showToast(t("soc.screener.config_saved"), "success");
      setPreviewModal(null);
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("soc.screener.apply_failed"), "error");
    } finally {
      setApplying(false);
    }
  };

  // SC-09: open the before/after preview instead of applying blindly.
  const handlePreviewConfig = (directConfig?: ScreenerConfig) => {
    if (!directConfig) return;
    setPreviewModal({
      before: resolveScreenerConfigSource(config) as Record<string, unknown>,
      after: mergeScreenerConfigPayload(config, directConfig as Record<string, unknown>),
    });
  };

  const handleManualScan = async () => {
    if (!manualSymbols.trim()) {
      showToast(t("soc.screener.scan_symbols_required"), "error");
      return;
    }
    setScanning(true);
    try {
      const symbols = manualSymbols.split(",").map((s) => s.trim()).filter(Boolean);
      // SC-03: the endpoint evaluates synchronously and returns real results.
      const data = (await defaultCoreApiAdapter.manualSocScreenerScan(symbols)) as {
        status?: string; matched?: unknown[]; symbols_scanned?: number; rules_evaluated?: number;
      } | undefined;
      if (data && data.status === "completed") {
        const matched = Array.isArray(data.matched) ? data.matched.length : 0;
        showToast(
          t("soc.screener.scan_completed", {
            matched,
            scanned: data.symbols_scanned ?? symbols.length,
            rules: data.rules_evaluated ?? 0,
          }),
          "success",
        );
      } else {
        showToast(t("soc.screener.scan_queued"), "success");
      }
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
    if (!canWrite) {
      showToast(t("soc.screener.read_only"), "error");
      return;
    }
    setSavingRule(true);
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
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!canWrite) {
      showToast(t("soc.screener.read_only"), "error");
      return;
    }
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
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value),
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
            createElement(SocOwnershipBadge, { team: "core", writable: canWrite, accessLevel: "service_ops" }),
            createElement(
              "div",
              { className: styles.bannerNotice, style: { marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" } },
              createElement("span", null, t("soc.screener.ops_notice")),
              createElement(
                "a",
                { href: "/screener", style: { color: "var(--accent-cyan, #06b6d4)", textDecoration: "underline", fontWeight: 600, whiteSpace: "nowrap" } },
                t("soc.screener.link_to_user_screener"),
              ),
            ),
            createElement("div", { className: styles.sectionCard },
              createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.config_title")),
              createElement(SocScreenerConfigForm, {
                initialConfig: config || {},
                onSave: handleApplyConfig,
                onPreview: handlePreviewConfig,
                onCancel: () => {},
                loading: applying,
              }),
            ),
            createElement("div", { className: styles.sectionCard,  },
              createElement("div", { className: styles.sectionCardTitle,  },
                t("soc.screener.rules_title"),
                createElement(
                  "button",
                  { onClick: handleOpenCreateRule, className: styles.actionBtn, disabled: !canWrite, },
                  t("soc.screener.add_rule")
                ),
              ),
              createElement(
                "table",
                { },
                createElement("thead", null,
                  createElement("tr", null,
                    createElement("th", { }, t("soc.screener.rule_name")),
                    createElement("th", { }, t("soc.screener.rule_type_label")),
                    createElement("th", { }, t("soc.screener.rule_enabled")),
                    createElement("th", { }, t("soc.actions.actions")),
                  ),
                ),
                createElement("tbody", null,
                  // SC-15: empty state instead of a bare header-only table.
                  rules.length === 0
                    ? createElement("tr", { key: "empty" },
                        createElement("td", { colSpan: 4 }, t("soc.screener.rules_empty")))
                    : rules.slice((rulesPage - 1) * pageSize, rulesPage * pageSize).map((rule) =>
                    createElement("tr", { key: rule.id },
                      createElement("td", { }, rule.name),
                      createElement("td", { }, rule.type),
                      createElement("td", { },
                        createElement("span", {
                          className: styles.statusBadge,
                          style: {
                            background: rule.enabled ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
                            color: rule.enabled ? "var(--soc-c-34d399)" : "var(--soc-c-94a3b8)",
                            fontSize: "0.68rem",
                          },
                        }, rule.enabled ? t("soc.screener.rule_active") : t("soc.screener.rule_inactive")),
                      ),
                      createElement("td", { },
                        createElement(
                          "button",
                          {
                            onClick: () => handleOpenEditRule(rule),
                            className: styles.actionBtn,
                            disabled: !canWrite,
                            
                          },
                          t("soc.actions.edit"),
                        ),
                        createElement(
                          "button",
                          {
                            onClick: () => handleDeleteRule(rule.id),
                            className: styles.actionBtn,
                            disabled: !canWrite,
                            
                          },
                          t("soc.actions.delete"),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              rules.length > pageSize ? createElement(
                "div",
                { className: styles.pagination, style: { marginTop: "0.75rem" } },
                createElement("button", { className: styles.pageBtn, disabled: rulesPage <= 1, onClick: () => setRulesPage((p) => Math.max(1, p - 1)) }, t("soc.actions.prev")),
                createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, t("soc.actions.page", { page: rulesPage })),
                createElement("button", { className: styles.pageBtn, disabled: rulesPage * pageSize >= rules.length, onClick: () => setRulesPage((p) => p + 1) }, t("soc.actions.next")),
              ) : null,
            ),
            createElement("div", { className: styles.sectionCard,  },
              createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.manual_scan_title")),
              createElement(
                "div",
                { },
                createElement(
                  "input",
                  {
                    type: "text",
                    value: manualSymbols,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setManualSymbols(e.target.value),
                    className: styles.searchInput,
                    placeholder: t("soc.screener.symbols_placeholder"),
                    
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
                      color: "var(--color-success-500, #34d399)",
                      cursor: scanning ? "not-allowed" : "pointer",
                    },
                  },
                  scanning ? t("soc.screener.scanning") : t("soc.screener.run_scan"),
                ),
              ),
            ),
            createElement("div", { className: styles.sectionGrid,  },
              createElement(
                "div",
                { className: styles.sectionCard },
                createElement("div", { className: styles.sectionCardTitle }, t("soc.screener.results_title")),
                results.length === 0
                  ? createElement("p", { className: styles.emptyState }, t("soc.screener.no_results"))
                  : createElement(
                      "div",
                      { },
                      results.slice((resultsPage - 1) * pageSize, resultsPage * pageSize).map((r) =>
                        createElement(
                          "div",
                          {
                            key: r.id,
                            },
                          createElement("span", { }, r.symbol),
                          ` \u2022 ${r.rule_name}`,
                          // SC-14: date + HH:MM (not time-only).
                          createElement("span", { },
                            formatScreenerTimestamp(r.timestamp) || "",
                          ),
                        ),
                      ),
                      results.length > pageSize ? createElement(
                        "div",
                        { className: styles.pagination, style: { marginTop: "0.5rem" } },
                        createElement("button", { className: styles.pageBtn, disabled: resultsPage <= 1, onClick: () => setResultsPage((p) => Math.max(1, p - 1)) }, t("soc.actions.prev")),
                        createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, t("soc.actions.page", { page: resultsPage })),
                        createElement("button", { className: styles.pageBtn, disabled: resultsPage * pageSize >= results.length, onClick: () => setResultsPage((p) => p + 1) }, t("soc.actions.next")),
                      ) : null,
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
                      { },
                      alerts.slice(0, 10).map((a) =>
                        createElement(
                          "div",
                          {
                            key: a.id,
                            },
                          createElement("span", { }, a.symbol),
                          `: ${a.message}`,
                        ),
                      ),
                    ),
              ),
            ),
            createElement("div", { className: styles.metricGrid,  },
              renderMetricCard(t("soc.screener.avg_scan"), `${metrics?.avg_scan_duration_ms ?? 0}ms`, "var(--accent-cyan, #06b6d4)"),
              renderMetricCard(t("soc.screener.hit_rate"), `${metrics?.rules_hit_rate ?? 0}%`, toneColor("success")),
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
          loading: savingRule,
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