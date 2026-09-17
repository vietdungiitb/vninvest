import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface RuntimeConfig {
  [key: string]: unknown;
}

interface OwnershipInfo {
  owner_team?: string;
  mode?: string;
  can_apply?: boolean;
  write_block_reason?: string;
  writer?: string;
  write_surface?: string;
  locked_fields?: string[];
}

interface RuntimeEnvelope {
  config: RuntimeConfig;
  ownership: OwnershipInfo | null;
  updated_at: string | null;
}

interface AuditEntry {
  actor?: string;
  action?: string;
  timestamp?: string;
  [key: string]: unknown;
}

function computeChangeSummary(before: RuntimeConfig, after: RuntimeConfig): string[] {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of allKeys) {
    const bVal = before?.[key];
    const aVal = after?.[key];
    const bStr = typeof bVal === "object" ? JSON.stringify(bVal) : String(bVal ?? "");
    const aStr = typeof aVal === "object" ? JSON.stringify(aVal) : String(aVal ?? "");
    if (bStr !== aStr) {
      changes.push(`\u2022 ${key}: ${bStr.slice(0, 80)} \u2192 ${aStr.slice(0, 80)}`);
    }
  }
  return changes;
}

function computeImpactWarnings(before: RuntimeConfig, after: RuntimeConfig): string[] {
  const warnings: string[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const sensitiveKeys = new Set(["poll_interval_seconds", "max_batch_size", "max_dispatch_per_cycle", "decay_days", "parity_snapshot_retention_days", "retention_days"]);
  for (const key of allKeys) {
    const bVal = before?.[key];
    const aVal = after?.[key];
    const bStr = typeof bVal === "object" ? JSON.stringify(bVal) : String(bVal ?? "");
    const aStr = typeof aVal === "object" ? JSON.stringify(aVal) : String(aVal ?? "");
    if (bStr === aStr) continue;
    // Top-level sensitive keys
    if (sensitiveKeys.has(key)) {
      warnings.push(`Thay đổi ${key}: ${String(bVal ?? "—").slice(0, 60)} → ${String(aVal ?? "—").slice(0, 60)}`);
      continue;
    }
    // Queue-level keys (nested)
    const bQ = before[key] as Record<string, unknown> | undefined;
    const aQ = after[key] as Record<string, unknown> | undefined;
    if (bQ && aQ && typeof bQ === "object" && typeof aQ === "object") {
      for (const sk of sensitiveKeys) {
        if (sk in bQ || sk in aQ) {
          const bv = (bQ as Record<string, unknown>)[sk];
          const av = (aQ as Record<string, unknown>)[sk];
          if (String(bv) !== String(av) && (bv !== undefined || av !== undefined)) {
            warnings.push(`Thay đổi ${key}.${sk}: ${String(bv ?? "—")} → ${String(av ?? "—")}`);
          }
        }
      }
    }
  }
  return warnings;
}

export function SocDataOpsConfigSection() {
  const { t } = useI18n();
  const [envelope, setEnvelope] = useState<RuntimeEnvelope | null>(null);
  const [editConfig, setEditConfig] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewModal, setPreviewModal] = useState<{
    before: RuntimeConfig;
    after: RuntimeConfig;
    changeSummary: string[];
    impactWarnings: string[];
    validationErrors?: string[];
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [auditHasMore, setAuditHasMore] = useState(false);

  const fetchConfigOnly = useCallback(async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsRuntimeConfig: () => Promise<RuntimeEnvelope>;
      };
      const envelopeData = await adapter.getSocDataOpsRuntimeConfig();
      setEnvelope(envelopeData);
      setEditConfig((prev) => {
        if (prev && prev.trim()) {
          try { JSON.parse(prev); return prev; } catch { /* fallthrough */ }
        }
        return JSON.stringify(envelopeData.config || {}, null, 2);
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load config data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditOnly = useCallback(async (page: number) => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsRuntimeConfigAudit: (page: number) => Promise<{ results?: AuditEntry[]; next?: string | null }>;
      };
      const auditData = await adapter.getSocDataOpsRuntimeConfigAudit(page);
      setAuditTrail(auditData.results || []);
      setAuditHasMore(!!auditData.next);
    } catch {
      // keep previous audit data
    }
  }, []);

  useEffect(() => {
    fetchConfigOnly();
  }, [fetchConfigOnly]);

  useEffect(() => {
    fetchAuditOnly(auditPage);
  }, [fetchAuditOnly, auditPage]);

  const handlePreview = async () => {
    try {
      const parsed = JSON.parse(editConfig) as RuntimeConfig;
      const before = envelope?.config || {};
      const changeSummary = computeChangeSummary(before, parsed);
      const impactWarnings = computeImpactWarnings(before, parsed);

      // Call preview API
      const adapter = defaultCoreApiAdapter as unknown as {
        previewSocDataOpsRuntimeConfig: (cfg: RuntimeConfig) => Promise<{
          projected_config?: RuntimeConfig;
          validation_errors?: string[];
          is_valid?: boolean;
        }>;
      };

      let validationErrors: string[] = [];
      try {
        const previewResult = await adapter.previewSocDataOpsRuntimeConfig(parsed);
        if (previewResult && Array.isArray(previewResult.validation_errors)) {
          validationErrors = previewResult.validation_errors;
        }
      } catch (err) {
        validationErrors = [err instanceof Error ? err.message : "Lỗi kiểm tra cấu hình."];
      }

      setPreviewModal({ before, after: parsed, changeSummary, impactWarnings, validationErrors });
    } catch {
      alert(t("soc.dataops.invalid_json"));
    }
  };

  const handleApply = async () => {
    try {
      const parsed = JSON.parse(editConfig) as RuntimeConfig;
      setApplying(true);
      const adapter = defaultCoreApiAdapter as unknown as { applySocDataOpsRuntimeConfig: (cfg: RuntimeConfig) => Promise<RuntimeEnvelope> };
      const result = await adapter.applySocDataOpsRuntimeConfig(parsed);
      setPreviewModal(null);
      setEnvelope(result);
      setEditConfig(JSON.stringify(result.config || {}, null, 2));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Apply failed."}`);
    } finally {
      setApplying(false);
    }
  };

  const ownership = envelope?.ownership;

  if (loading) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  return createElement(
    "div",
    { },
    error ? createElement("div", { className: styles.inlineError }, error) : null,

    ownership
      ? createElement(SocOwnershipBadge, {
          team: ownership.owner_team,
          writable: ownership.can_apply,
          accessLevel: ownership.mode,
        })
      : null,

    ownership?.write_block_reason
      ? createElement(SocWriteGuardBanner, {
          owner: ownership.owner_team,
          writer: ownership.writer || ownership.owner_team,
          surface: ownership.write_surface,
        })
      : null,

    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.config_editor")),
      ownership?.locked_fields && ownership.locked_fields.length > 0
        ? createElement(
            "div",
            { },
            `${t("soc.dataops.locked_fields")}: ${ownership.locked_fields.join(", ")}`,
          )
        : null,
      createElement(
        "textarea",
        {
          value: editConfig,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditConfig(e.target.value),
          className: styles.configEditor,
          rows: 12,
        },
      ),
      createElement(
        "div",
        { },
        createElement(
          "button",
          {
            onClick: handlePreview,
            className: styles.actionBtn,
            
          },
          t("soc.actions.preview"),
        ),
        createElement(
          "button",
          {
            onClick: () => setEditConfig(JSON.stringify(envelope?.config || {}, null, 2)),
            className: styles.actionBtn,
            
          },
          t("soc.actions.edit"),
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
            { },
            auditTrail.map((entry, i) =>
              createElement(
                "div",
                {
                  key: i,
                  },
                createElement("span", { }, entry.actor || "system"),
                ` \u2022 ${entry.action || "config_change"}`,
                createElement("span", { },
                  entry.timestamp?.split("T")[1]?.slice(0, 8) || "",
                ),
              ),
            ),
          ),
          createElement(
            "div",
            { },
            createElement(
              "button",
              {
                onClick: () => setAuditPage((p) => Math.max(1, p - 1)),
                disabled: auditPage <= 1,
                className: styles.actionBtn,
                
              },
              "\u25C0 " + t("soc.actions.prev"),
            ),
            createElement(
              "span",
              { },
              t("soc.actions.page", { page: auditPage }),
            ),
            createElement(
              "button",
              {
                onClick: () => setAuditPage((p) => p + 1),
                disabled: !auditHasMore,
                className: styles.actionBtn,
                
              },
              t("soc.actions.next") + " \u25B6",
            ),
          ),
        )
      : null,

    previewModal
      ? createElement(SocConfigPreviewModal, {
          before: previewModal.before,
          after: previewModal.after,
          changeSummary: previewModal.changeSummary,
          impactWarnings: previewModal.impactWarnings,
          validationErrors: previewModal.validationErrors,
          onConfirm: handleApply,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
  );
}
