import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocSchedulerBoard } from "./SocSchedulerBoard.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface RuntimeConfig {
  [key: string]: unknown;
}

export function SocDataOpsConfigSection() {
  const { t } = useI18n();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [editConfig, setEditConfig] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewModal, setPreviewModal] = useState<{ before: Record<string, unknown>; after: Record<string, unknown> } | null>(null);
  const [applying, setApplying] = useState(false);
  const [runLogs, setRunLogs] = useState<any[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsRuntimeConfig: () => Promise<RuntimeConfig>;
        getSocDataOpsRunLogs: (page: number) => Promise<{ results?: any[] }>;
        getSocDataOpsRuntimeConfigAudit: (page: number) => Promise<{ results?: any[] }>;
      };
      const [cfg, logs, audit] = await Promise.all([
        adapter.getSocDataOpsRuntimeConfig(),
        adapter.getSocDataOpsRunLogs(1),
        adapter.getSocDataOpsRuntimeConfigAudit(1),
      ]);
      setConfig(cfg);
      setRunLogs(logs.results || []);
      setAuditTrail(audit.results || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load config data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(editConfig) as RuntimeConfig;
      setPreviewModal({ before: config || {}, after: parsed });
    } catch {
      alert(t("soc.dataops.invalid_json"));
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as RuntimeConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocDataOpsRuntimeConfig: (cfg: RuntimeConfig) => Promise<void> };
      await adapter.applySocDataOpsRuntimeConfig(parsed);
      setPreviewModal(null);
      await fetchConfig();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Apply failed."}`);
    } finally {
      setApplying(false);
    }
  };

  const handlePurgeLogs = async () => {
    if (!window.confirm(t("soc.dataops.purge_logs_confirm"))) return;
    try {
      const adapter = defaultCoreApiAdapter as unknown as { purgeSocDataOpsRunLogs: (keep: number) => Promise<void> };
      await adapter.purgeSocDataOpsRunLogs(50);
      alert(t("soc.dataops.purge_logs_success"));
      await fetchConfig();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Purge failed."}`);
    }
  };

  if (loading) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    error ? createElement("div", { className: styles.inlineError }, error) : null,
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.config_editor")),
      createElement(
        "textarea",
        {
          value: editConfig || JSON.stringify(config || {}, null, 2),
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
          className: styles.configEditor,
          rows: 12,
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
          { onClick: handlePurgeLogs, className: styles.actionBtn, style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171" } },
          t("soc.dataops.purge_logs"),
        ),
      ),
    ),
    auditTrail.length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.audit_trail")),
          createElement(
            "div",
            { style: { maxHeight: "200px", overflow: "auto" } },
            auditTrail.slice(0, 10).map((entry, i) =>
              createElement(
                "div",
                {
                  key: i,
                  style: {
                    padding: "0.5rem",
                    borderBottom: "1px solid var(--border-default)",
                    fontSize: "0.75rem",
                  },
                },
                createElement("span", { style: { fontWeight: 600, color: "var(--accent-cyan)" } }, entry.actor || "system"),
                ` \u2022 ${entry.action || "config_change"}`,
                createElement("span", { style: { float: "right", color: "var(--text-muted)" } },
                  entry.timestamp?.split("T")[1]?.slice(0, 8) || "",
                ),
              ),
            ),
          ),
        )
      : null,
    runLogs.length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.run_logs")),
          createElement(
            "div",
            { style: { maxHeight: "200px", overflow: "auto" } },
            runLogs.slice(0, 10).map((log, i) =>
              createElement(
                "div",
                {
                  key: i,
                  style: {
                    padding: "0.5rem",
                    borderBottom: "1px solid var(--border-default)",
                    fontSize: "0.75rem",
                  },
                },
                log.message || log.event || JSON.stringify(log).slice(0, 100),
              ),
            ),
          ),
        )
      : null,
    createElement(
      "div",
      { style: { marginTop: "0.5rem" } },
      createElement(SocSchedulerBoard, { domain: "dataops" }),
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
