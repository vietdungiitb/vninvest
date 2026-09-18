import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { NumberInput, SocQueueTierFieldSet, type QueueTierConfig } from "./SocQueueTierFieldSet.js";
import { diffObjects, type DiffRow } from "../../lib/diffUtil.js";
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

type TierKey = "hot_user_demand" | "warm_liquid_market" | "cold_full_market" | "recovery_backlog";

type FormState = {
  decay_days: number;
  parity_snapshot_retention_days: number;
  hot_user_demand: QueueTierConfig;
  warm_liquid_market: QueueTierConfig;
  cold_full_market: QueueTierConfig;
  recovery_backlog: QueueTierConfig;
};

const TIER_KEYS: TierKey[] = ["hot_user_demand", "warm_liquid_market", "cold_full_market", "recovery_backlog"];

const TIER_LABEL_KEYS: Record<TierKey, string> = {
  hot_user_demand: "soc.dataops.tier_hot_user_demand",
  warm_liquid_market: "soc.dataops.tier_warm_liquid_market",
  cold_full_market: "soc.dataops.tier_cold_full_market",
  recovery_backlog: "soc.dataops.tier_recovery_backlog",
};

const TIER_FIELD_RANGES: Record<keyof QueueTierConfig, { min: number; max: number }> = {
  poll_interval_seconds: { min: 10, max: 3600 },
  max_batch_size: { min: 1, max: 500 },
  max_dispatch_per_cycle: { min: 1, max: 500 },
};

const GLOBAL_FIELD_RANGES: Record<"decay_days" | "parity_snapshot_retention_days", { min: number; max: number }> = {
  decay_days: { min: 1, max: 365 },
  parity_snapshot_retention_days: { min: 1, max: 365 },
};

const DEFAULTS: FormState = {
  decay_days: 7,
  parity_snapshot_retention_days: 30,
  hot_user_demand: { poll_interval_seconds: 30, max_batch_size: 50, max_dispatch_per_cycle: 50 },
  warm_liquid_market: { poll_interval_seconds: 120, max_batch_size: 50, max_dispatch_per_cycle: 50 },
  cold_full_market: { poll_interval_seconds: 900, max_batch_size: 200, max_dispatch_per_cycle: 200 },
  recovery_backlog: { poll_interval_seconds: 600, max_batch_size: 50, max_dispatch_per_cycle: 50 },
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return fallback;
}

function readForm(config: RuntimeConfig | null | undefined): FormState {
  const c = (config || {}) as Record<string, unknown>;
  const tier = (key: TierKey): QueueTierConfig => {
    const raw = (c[key] || {}) as Record<string, unknown>;
    const d = DEFAULTS[key];
    return {
      poll_interval_seconds: toNumber(raw.poll_interval_seconds, d.poll_interval_seconds),
      max_batch_size: toNumber(raw.max_batch_size, d.max_batch_size),
      max_dispatch_per_cycle: toNumber(raw.max_dispatch_per_cycle, d.max_dispatch_per_cycle),
    };
  };
  return {
    decay_days: toNumber(c.decay_days, DEFAULTS.decay_days),
    parity_snapshot_retention_days: toNumber(c.parity_snapshot_retention_days, DEFAULTS.parity_snapshot_retention_days),
    hot_user_demand: tier("hot_user_demand"),
    warm_liquid_market: tier("warm_liquid_market"),
    cold_full_market: tier("cold_full_market"),
    recovery_backlog: tier("recovery_backlog"),
  };
}

function toPayload(form: FormState): RuntimeConfig {
  return {
    decay_days: form.decay_days,
    parity_snapshot_retention_days: form.parity_snapshot_retention_days,
    hot_user_demand: { ...form.hot_user_demand },
    warm_liquid_market: { ...form.warm_liquid_market },
    cold_full_market: { ...form.cold_full_market },
    recovery_backlog: { ...form.recovery_backlog },
  };
}

export function SocDataOpsConfigSection() {
  const { t } = useI18n();
  const [envelope, setEnvelope] = useState<RuntimeEnvelope | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewModal, setPreviewModal] = useState<{
    before: RuntimeConfig;
    after: RuntimeConfig;
    diff: DiffRow[];
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
      setForm((prev) => {
        const loaded = readForm(envelopeData.config);
        const isUntouched = JSON.stringify(prev) === JSON.stringify(DEFAULTS);
        return isUntouched ? loaded : prev;
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải cấu hình runtime DataOps.");
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

  const lockedFields = envelope?.ownership?.locked_fields || [];

  const validateForm = useCallback((candidate: FormState): Record<string, string> => {
    const errs: Record<string, string> = {};
    (Object.keys(GLOBAL_FIELD_RANGES) as Array<keyof typeof GLOBAL_FIELD_RANGES>).forEach((key) => {
      const { min, max } = GLOBAL_FIELD_RANGES[key];
      const value = candidate[key];
      if (!Number.isFinite(value) || value < min || value > max) {
        errs[key] = t("soc.dataops.field_range_error", { min, max });
      }
    });
    TIER_KEYS.forEach((tierKey) => {
      const tier = candidate[tierKey];
      (Object.keys(TIER_FIELD_RANGES) as Array<keyof QueueTierConfig>).forEach((field) => {
        const { min, max } = TIER_FIELD_RANGES[field];
        const value = tier[field];
        if (!Number.isFinite(value) || value < min || value > max) {
          errs[`${tierKey}.${field}`] = t("soc.dataops.field_range_error", { min, max });
        }
      });
    });
    return errs;
  }, [t]);

  const updateGlobalField = (key: "decay_days" | "parity_snapshot_retention_days", value: number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const { min, max } = GLOBAL_FIELD_RANGES[key];
    setFormErrors((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(value) || value < min || value > max) {
        next[key] = t("soc.dataops.field_range_error", { min, max });
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const updateTierField = (tierKey: string, field: keyof QueueTierConfig, value: number) => {
    setForm((prev) => {
      const key = tierKey as TierKey;
      return { ...prev, [key]: { ...prev[key], [field]: value } };
    });
    const errKey = `${tierKey}.${field}`;
    const { min, max } = TIER_FIELD_RANGES[field];
    setFormErrors((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(value) || value < min || value > max) {
        next[errKey] = t("soc.dataops.field_range_error", { min, max });
      } else {
        delete next[errKey];
      }
      return next;
    });
  };

  const handleReset = () => {
    setForm(readForm(envelope?.config));
    setFormErrors({});
    setError("");
    setSuccess("");
  };

  const handleResetDefaults = () => {
    setForm(DEFAULTS);
    setFormErrors({});
    setError("");
    setSuccess("");
  };

  const handlePreview = async () => {
    const errs = validateForm(form);
    setFormErrors(errs);
    const firstErrorKey = Object.keys(errs)[0];
    if (firstErrorKey) {
      const target = document.querySelector(`[data-field="${firstErrorKey}"]`) as HTMLInputElement | null;
      target?.focus();
    }
    setError("");
    const before = readForm(envelope?.config);
    const payload = toPayload(form);
    const diff = diffObjects(before, payload);
    const impactWarnings = diff
      .filter((row) => row.impact !== "none")
      .map((row) => `${row.key}: ${row.before} \u2192 ${row.after}`);

    const adapter = defaultCoreApiAdapter as unknown as {
      previewSocDataOpsRuntimeConfig: (cfg: RuntimeConfig) => Promise<{
        projected_config?: RuntimeConfig;
        validation_errors?: string[];
        is_valid?: boolean;
      }>;
    };

    let validationErrors: string[] = [];
    try {
      const previewResult = await adapter.previewSocDataOpsRuntimeConfig(payload);
      if (previewResult && Array.isArray(previewResult.validation_errors)) {
        validationErrors = previewResult.validation_errors;
      }
    } catch (err) {
      validationErrors = [err instanceof Error ? err.message : t("soc.dataops.preview_failed")];
    }

    setPreviewModal({ before, after: payload, diff, impactWarnings, validationErrors });
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as { applySocDataOpsRuntimeConfig: (cfg: RuntimeConfig) => Promise<RuntimeEnvelope> };
      const result = await adapter.applySocDataOpsRuntimeConfig(toPayload(form));
      setPreviewModal(null);
      setEnvelope(result);
      setForm(readForm(result.config));
      setFormErrors({});
      setError("");
      setSuccess(t("soc.dataops.apply_success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.apply_failed"));
    } finally {
      setApplying(false);
    }
  };

  const ownership = envelope?.ownership;
  const globals = createElement(
    "div",
    { className: styles.fieldGrid },
    createElement(NumberInput, {
      id: "decay_days",
      label: t("soc.dataops.field_decay_days"),
      value: form.decay_days,
      min: GLOBAL_FIELD_RANGES.decay_days.min,
      max: GLOBAL_FIELD_RANGES.decay_days.max,
      unit: t("soc.dataops.unit_days"),
      help: t("soc.dataops.field_decay_days_help"),
      error: formErrors.decay_days,
      disabled: lockedFields.includes("decay_days"),
      onChange: (value) => updateGlobalField("decay_days", value),
    }),
    createElement(NumberInput, {
      id: "parity_snapshot_retention_days",
      label: t("soc.dataops.field_parity_retention_days"),
      value: form.parity_snapshot_retention_days,
      min: GLOBAL_FIELD_RANGES.parity_snapshot_retention_days.min,
      max: GLOBAL_FIELD_RANGES.parity_snapshot_retention_days.max,
      unit: t("soc.dataops.unit_days"),
      help: t("soc.dataops.field_parity_retention_days_help"),
      error: formErrors.parity_snapshot_retention_days,
      disabled: lockedFields.includes("parity_snapshot_retention_days"),
      onChange: (value) => updateGlobalField("parity_snapshot_retention_days", value),
    }),
  );

  if (loading) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  return createElement(
    "div",
    { },
    error ? createElement("div", { className: styles.inlineError, role: "alert" }, error) : null,
    success ? createElement("div", { className: styles.inlineSuccess, role: "status" }, success) : null,

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
      envelope?.updated_at
        ? createElement("p", { className: styles.helpText }, `${t("soc.dataops.last_updated")}: ${envelope.updated_at}`)
        : null,
      ownership?.locked_fields && ownership.locked_fields.length > 0
        ? createElement(
            "p",
            { className: styles.helpText },
            `${t("soc.dataops.locked_fields")}: ${ownership.locked_fields.join(", ")}`,
          )
        : null,
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.global_config")),
      globals,
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers_config")),
      createElement(
        "div",
        { className: styles.sectionGrid },
        TIER_KEYS.map((tierKey) =>
          createElement(SocQueueTierFieldSet, {
            key: tierKey,
            tierKey,
            label: t(TIER_LABEL_KEYS[tierKey]),
            config: form[tierKey],
            errors: formErrors,
            lockedFields,
            disabled: envelope?.ownership?.can_apply === false,
            onChange: updateTierField,
          }),
        ),
      ),
      createElement(
        "div",
        { },
        createElement(
          "button",
          { onClick: handlePreview, className: styles.actionBtn },
          t("soc.actions.preview"),
        ),
        createElement(
          "button",
          { onClick: handleReset, className: styles.actionBtn },
          t("soc.actions.reset"),
        ),
        createElement(
          "button",
          { onClick: handleResetDefaults, className: styles.actionBtn },
          t("soc.dataops.reset_defaults"),
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
                { key: i },
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
          diff: previewModal.diff,
          impactWarnings: previewModal.impactWarnings,
          validationErrors: previewModal.validationErrors,
          onConfirm: handleApply,
          onCancel: () => setPreviewModal(null),
          loading: applying,
        })
      : null,
  );
}
