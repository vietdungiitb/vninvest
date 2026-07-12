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
  
  if (before.decay_days !== undefined && after.decay_days !== undefined && after.decay_days !== before.decay_days) {
    warnings.push(`Thay đổi số ngày phân rã (decay_days): ${before.decay_days} \u2192 ${after.decay_days}`);
  }
  if (before.parity_snapshot_retention_days !== undefined && after.parity_snapshot_retention_days !== undefined && after.parity_snapshot_retention_days !== before.parity_snapshot_retention_days) {
    warnings.push(`Thay đổi ngày lưu trữ parity snapshot: ${before.parity_snapshot_retention_days} \u2192 ${after.parity_snapshot_retention_days}`);
  }

  const queues = ["hot_user_demand", "warm_liquid_market", "cold_full_market", "recovery_backlog"];
  for (const q of queues) {
    const bQ = before[q] as Record<string, unknown> | undefined;
    const aQ = after[q] as Record<string, unknown> | undefined;
    if (bQ && aQ) {
      if (aQ.poll_interval_seconds !== undefined && bQ.poll_interval_seconds !== undefined && aQ.poll_interval_seconds !== bQ.poll_interval_seconds) {
        warnings.push(`Thay đổi chu kỳ quét của ${q} (poll_interval_seconds): ${bQ.poll_interval_seconds}s \u2192 ${aQ.poll_interval_seconds}s`);
      }
      if (aQ.max_batch_size !== undefined && bQ.max_batch_size !== undefined && aQ.max_batch_size !== bQ.max_batch_size) {
        warnings.push(`Thay đổi kích thước batch của ${q} (max_batch_size): ${bQ.max_batch_size} \u2192 ${aQ.max_batch_size}`);
      }
      if (aQ.max_dispatch_per_cycle !== undefined && bQ.max_dispatch_per_cycle !== undefined && aQ.max_dispatch_per_cycle !== bQ.max_dispatch_per_cycle) {
        warnings.push(`Thay đổi số lượng phát hành của ${q} (max_dispatch_per_cycle): ${bQ.max_dispatch_per_cycle} \u2192 ${aQ.max_dispatch_per_cycle}`);
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

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsRuntimeConfig: () => Promise<RuntimeEnvelope>;
        getSocDataOpsRuntimeConfigAudit: (page: number) => Promise<{ results?: AuditEntry[]; next?: string | null }>;
      };
      const [envelopeData, auditData] = await Promise.all([
        adapter.getSocDataOpsRuntimeConfig(),
        adapter.getSocDataOpsRuntimeConfigAudit(auditPage),
      ]);
      setEnvelope(envelopeData);
      setEditConfig(JSON.stringify(envelopeData.config || {}, null, 2));
      setAuditTrail(auditData.results || []);
      setAuditHasMore(!!auditData.next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load config data.");
    } finally {
      setLoading(false);
    }
  }, [auditPage]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

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
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
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
            { style: { fontSize: "0.7rem", color: "var(--accent-amber)", marginBottom: "0.5rem" } },
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
        { style: { display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" } },
        createElement(
          "button",
          {
            onClick: handlePreview,
            className: styles.actionBtn,
            style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan, #06b6d4)" },
          },
          t("soc.actions.preview"),
        ),
        createElement(
          "button",
          {
            onClick: () => setEditConfig(JSON.stringify(envelope?.config || {}, null, 2)),
            className: styles.actionBtn,
            style: { background: "rgba(255, 191, 77, 0.15)", color: "var(--accent-amber)" },
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
            { style: { maxHeight: "240px", overflow: "auto" } },
            auditTrail.map((entry, i) =>
              createElement(
                "div",
                {
                  key: i,
                  style: {
                    padding: "0.5rem",
                    borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                    fontSize: "0.75rem",
                  },
                },
                createElement("span", { style: { fontWeight: 600, color: "var(--accent-cyan, #06b6d4)" } }, entry.actor || "system"),
                ` \u2022 ${entry.action || "config_change"}`,
                createElement("span", { style: { float: "right", color: "var(--text-muted, #94a3b8)" } },
                  entry.timestamp?.split("T")[1]?.slice(0, 8) || "",
                ),
              ),
            ),
          ),
          createElement(
            "div",
            { style: { display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" } },
            createElement(
              "button",
              {
                onClick: () => setAuditPage((p) => Math.max(1, p - 1)),
                disabled: auditPage <= 1,
                className: styles.actionBtn,
                style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted, #94a3b8)" },
              },
              "\u25C0 " + t("soc.actions.prev"),
            ),
            createElement(
              "span",
              { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", alignSelf: "center" } },
              t("soc.actions.page", { page: auditPage }),
            ),
            createElement(
              "button",
              {
                onClick: () => setAuditPage((p) => p + 1),
                disabled: !auditHasMore,
                className: styles.actionBtn,
                style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted, #94a3b8)" },
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
