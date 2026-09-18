import { createElement, useCallback, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { NumberInput, SocQueueTierFieldSet, type QueueTierConfig } from "./SocQueueTierFieldSet.js";
import { diffObjects, type DiffRow } from "../../lib/diffUtil.js";
import { formatLastCheck } from "./socTime.js";
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
  id?: number;
  actor?: string;
  action?: string;
  actor_ip?: string;
  service_key?: string;
  timestamp?: string;
  change_summary?: string;
  before_snapshot?: RuntimeConfig | null;
  after_snapshot?: RuntimeConfig | null;
  request_id?: string;
  [key: string]: unknown;
}

interface SchemaField {
  key: string;
  type?: string;
  min?: number;
  max?: number;
  default?: number;
  help?: string;
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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>,
  filename: string,
) {
  const header = columns.map((col) => csvEscape(col.label)).join(",");
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col.key])).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function SocDataOpsConfigSection() {
  const { t, localeTag } = useI18n() as unknown as {
    t: (key: string, opts?: Record<string, unknown>) => string;
    localeTag: string;
  };
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
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditActorFilter, setAuditActorFilter] = useState("");
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditExpandedId, setAuditExpandedId] = useState<number | null>(null);
  const [exportingAudits, setExportingAudits] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [schemaFields, setSchemaFields] = useState<Record<string, SchemaField>>({});

  useEffect(() => {
    const applySchema = async () => {
      try {
        const adapter = defaultCoreApiAdapter as unknown as {
          getSocDataOpsRuntimeConfigSchema: () => Promise<{ fields?: SchemaField[] }>;
        };
        const data = await adapter.getSocDataOpsRuntimeConfigSchema();
        const map: Record<string, SchemaField> = {};
        (data?.fields || []).forEach((f) => {
          if (f && f.key) map[f.key] = f;
        });
        setSchemaFields(map);
      } catch {
        setSchemaFields({});
      }
    };
    applySchema();
  }, []);

  const lockedFieldReason = useCallback(
    (key: string) => t("soc.badge.write_block_reason", { reason: schemaFields[key]?.help || key }),
    [schemaFields, t],
  );

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
        getSocDataOpsRuntimeConfigAudit: (
          page: number,
        ) => Promise<{ results?: AuditEntry[]; next?: string | null; count?: number }>;
      };
      const auditData = await adapter.getSocDataOpsRuntimeConfigAudit(page);
      setAuditTrail(auditData.results || []);
      setAuditHasMore(!!auditData.next);
      setAuditTotal(typeof auditData.count === "number" ? auditData.count : (auditData.results || []).length);
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
      const adapter = defaultCoreApiAdapter as unknown as {
        applySocDataOpsRuntimeConfig: (cfg: RuntimeConfig, opts?: Record<string, unknown>) => Promise<RuntimeEnvelope>;
      };
      const result = await adapter.applySocDataOpsRuntimeConfig(toPayload(form), {
        expected_updated_at: envelope?.updated_at || undefined,
        change_reason: changeReason,
      });
      setPreviewModal(null);
      setEnvelope(result);
      setForm(readForm(result.config));
      setFormErrors({});
      setConflict(false);
      setChangeReason("");
      setError("");
      setSuccess(t("soc.dataops.apply_success"));
    } catch (err) {
      const errWithMeta = err as { status?: number; code?: string } | null;
      if (errWithMeta && (errWithMeta.status === 409 || errWithMeta.code === "CONFIG_CONFLICT")) {
        setConflict(true);
        setError(err instanceof Error ? err.message : t("soc.dataops.conflict_error"));
      } else {
        setConflict(false);
        setError(err instanceof Error ? err.message : t("soc.dataops.apply_failed"));
      }
    } finally {
      setApplying(false);
    }
  };

  const handleReloadCompare = async () => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsRuntimeConfig: () => Promise<RuntimeEnvelope>;
      };
      const fresh = await adapter.getSocDataOpsRuntimeConfig();
      setEnvelope(fresh);
      setForm((prev) => {
        const loaded = readForm(fresh.config);
        const isUntouched = JSON.stringify(prev) === JSON.stringify(DEFAULTS);
        return isUntouched ? loaded : prev;
      });
      const before = fresh.config;
      const after = toPayload(form);
      const diff = diffObjects(before, after);
      const impactWarnings = diff
        .filter((row) => row.impact !== "none")
        .map((row) => `${row.key}: ${row.before} \u2192 ${row.after}`);
      setPreviewModal({ before, after, diff, impactWarnings, validationErrors: [] });
      setConflict(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.config_load_failed"));
    }
  };

  const handleRevert = async (entry: AuditEntry) => {
    if (!entry.before_snapshot) return;
    if (typeof window !== "undefined" && !window.confirm(t("soc.dataops.revert_confirm"))) return;
    setApplying(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        applySocDataOpsRuntimeConfig: (cfg: RuntimeConfig, opts?: Record<string, unknown>) => Promise<RuntimeEnvelope>;
      };
      const result = await adapter.applySocDataOpsRuntimeConfig(entry.before_snapshot, {
        expected_updated_at: envelope?.updated_at || undefined,
        change_reason: t("soc.dataops.change_reason_revert"),
        audit_action: "rollback",
      });
      setPreviewModal(null);
      setEnvelope(result);
      setForm(readForm(result.config));
      setFormErrors({});
      setChangeReason("");
      setError("");
      setSuccess(t("soc.dataops.revert_success"));
      await fetchAuditOnly(auditPage);
    } catch (err) {
      const errWithMeta = err as { status?: number; code?: string } | null;
      if (errWithMeta && (errWithMeta.status === 409 || errWithMeta.code === "CONFIG_CONFLICT")) {
        setConflict(true);
        setError(err instanceof Error ? err.message : t("soc.dataops.conflict_error"));
      } else {
        setError(err instanceof Error ? err.message : t("soc.dataops.apply_failed"));
      }
    } finally {
      setApplying(false);
    }
  };

  const handleExportAudits = async () => {
    setExportingAudits(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        exportSocConfigAudits: (params?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
      };
      const rows = await adapter.exportSocConfigAudits({
        service_key: "matrix_cycle_coordinator",
        limit: 50,
      });
      const dateStr = new Date().toISOString().split("T")[0];
      downloadCsv(
        rows,
        [
          { key: "service_key", label: t("soc.export.col_service") },
          { key: "action", label: t("soc.export.col_action") },
          { key: "actor", label: t("soc.export.col_actor") },
          { key: "actor_ip", label: t("soc.export.col_actor_ip") },
          { key: "change_summary", label: t("soc.export.col_summary") },
          { key: "timestamp", label: t("soc.export.col_timestamp") },
          { key: "request_id", label: t("soc.export.col_request_id") },
        ],
        `soc-config-audits-${dateStr}.csv`,
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.export.error_failed"));
    } finally {
      setExportingAudits(false);
    }
  };

  const auditActors = Array.from(
    new Set(auditTrail.map((entry) => entry.actor).filter((actor): actor is string => !!actor)),
  ).sort();

  const filteredAudit = auditTrail.filter((entry) => {
    if (auditActorFilter && (entry.actor || "") !== auditActorFilter) return false;
    if (auditFromDate && String(entry.timestamp || "") < auditFromDate) return false;
    if (auditSearch && !String(entry.change_summary || "").toLowerCase().includes(auditSearch.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  const ownership = envelope?.ownership;
  const globals = createElement(
    "div",
    { className: styles.fieldGrid },
    createElement(NumberInput, {
      id: "decay_days",
      label: t("soc.dataops.field_decay_days"),
      value: form.decay_days,
      min: schemaFields["decay_days"]?.min ?? GLOBAL_FIELD_RANGES.decay_days.min,
      max: schemaFields["decay_days"]?.max ?? GLOBAL_FIELD_RANGES.decay_days.max,
      unit: t("soc.dataops.unit_days"),
      help: schemaFields["decay_days"]?.help ?? t("soc.dataops.field_decay_days_help"),
      error: formErrors.decay_days,
      disabled: lockedFields.includes("decay_days"),
      locked: lockedFields.includes("decay_days"),
      lockReason: lockedFields.includes("decay_days") ? lockedFieldReason("decay_days") : undefined,
      onChange: (value) => updateGlobalField("decay_days", value),
    }),
    createElement(NumberInput, {
      id: "parity_snapshot_retention_days",
      label: t("soc.dataops.field_parity_retention_days"),
      value: form.parity_snapshot_retention_days,
      min: schemaFields["parity_snapshot_retention_days"]?.min ?? GLOBAL_FIELD_RANGES.parity_snapshot_retention_days.min,
      max: schemaFields["parity_snapshot_retention_days"]?.max ?? GLOBAL_FIELD_RANGES.parity_snapshot_retention_days.max,
      unit: t("soc.dataops.unit_days"),
      help: schemaFields["parity_snapshot_retention_days"]?.help ?? t("soc.dataops.field_parity_retention_days_help"),
      error: formErrors.parity_snapshot_retention_days,
      disabled: lockedFields.includes("parity_snapshot_retention_days"),
      locked: lockedFields.includes("parity_snapshot_retention_days"),
      lockReason: lockedFields.includes("parity_snapshot_retention_days")
        ? lockedFieldReason("parity_snapshot_retention_days")
        : undefined,
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
    conflict
      ? createElement(
          "div",
          { className: styles.conflictBanner, role: "alert" },
          t("soc.dataops.conflict_error"),
          createElement(
            "button",
            { className: styles.actionBtn, onClick: handleReloadCompare },
            t("soc.dataops.reload_compare"),
          ),
        )
      : null,

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
            "div",
            { className: styles.lockedFieldList },
            createElement("span", { className: styles.lockedFieldListLabel }, `${t("soc.dataops.locked_fields")}:`),
            ownership.locked_fields.map((fieldKey) =>
              createElement(
                "span",
                { key: fieldKey, className: styles.lockedFieldBadge, title: lockedFieldReason(fieldKey), "data-locked": fieldKey },
                "\u{1F512} ",
                fieldKey,
              ),
            ),
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
            schema: schemaFields,
            onChange: updateTierField,
          }),
        ),
      ),
      createElement(
        "div",
        { },
        createElement("div", { className: styles.fieldRow },
          createElement("label", { className: styles.fieldLabel, htmlFor: "change_reason" }, t("soc.dataops.change_reason")),
          createElement(
            "textarea",
            {
              id: "change_reason",
              className: styles.fieldInput,
              rows: 2,
              placeholder: t("soc.dataops.change_reason_placeholder"),
              value: changeReason,
              "aria-label": t("soc.dataops.change_reason"),
              onChange: (event) => setChangeReason((event.target as HTMLTextAreaElement).value),
            },
            null,
          ),
        ),
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

    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.audit_title")),
      createElement("p", { className: styles.helpText }, t("soc.dataops.audit_description")),
      createElement("p", { className: styles.helpText }, `${t("soc.dataops.audit_total")}: ${auditTotal}`),
      createElement(
        "div",
        { className: styles.auditFilters },
        createElement(
          "select",
          {
            value: auditActorFilter,
            onChange: (event) => setAuditActorFilter((event.target as HTMLSelectElement).value),
            className: styles.fieldInput,
            "aria-label": t("soc.dataops.audit_filter_actor"),
          },
          createElement("option", { value: "" }, t("soc.dataops.audit_filter_all")),
          auditActors.map((actor) => createElement("option", { key: actor, value: actor }, actor)),
        ),
        createElement("input", {
          type: "date",
          value: auditFromDate,
          onChange: (event) => setAuditFromDate((event.target as HTMLInputElement).value),
          className: styles.fieldInput,
          "aria-label": t("soc.dataops.audit_filter_from"),
        }),
        createElement("input", {
          type: "search",
          value: auditSearch,
          onChange: (event) => setAuditSearch((event.target as HTMLInputElement).value),
          placeholder: t("soc.dataops.audit_filter_search"),
          className: styles.fieldInput,
          "aria-label": t("soc.dataops.audit_filter_search"),
        }),
      ),
      filteredAudit.length === 0
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.audit_empty"))
        : createElement(
            "div",
            { className: styles.diffTableWrap },
            createElement(
              "table",
              { className: styles.diffTable },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_actor")),
                  createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_timestamp")),
                  createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_change_summary")),
                  createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_diff")),
                  createElement("th", { className: styles.diffTableHeader }, t("soc.actions.actions")),
                ),
              ),
              createElement(
                "tbody",
                null,
                filteredAudit.map((entry) => {
                  const id = typeof entry.id === "number" ? entry.id : undefined;
                  const expanded = id !== undefined && auditExpandedId === id;
                  const diffRows = expanded ? diffObjects(entry.before_snapshot || {}, entry.after_snapshot || {}) : [];
                  const when = formatLastCheck(entry.timestamp, localeTag || "vi-VN", t);
                  const rowKey = `audit-${id ?? entry.timestamp ?? ""}`;
                  const row = createElement(
                    "tr",
                    { key: rowKey },
                    createElement("td", null, entry.actor || "system"),
                    createElement("td", { title: when.title }, when.display),
                    createElement("td", null, entry.change_summary || "\u2014"),
                    createElement(
                      "td",
                      null,
                      createElement(
                        "button",
                        {
                          className: styles.linkBtn,
                          disabled: id === undefined,
                          "aria-expanded": expanded,
                          onClick: () => setAuditExpandedId(expanded ? null : (id ?? null)),
                        },
                        t(expanded ? "soc.dataops.audit_hide" : "soc.dataops.audit_view"),
                      ),
                    ),
                    createElement(
                      "td",
                      null,
                      createElement(
                        "button",
                        {
                          className: styles.actionBtn,
                          disabled: ownership?.can_apply === false || !entry.before_snapshot || applying,
                          onClick: () => handleRevert(entry),
                        },
                        t("soc.dataops.revert"),
                      ),
                    ),
                  );
                  if (!expanded) return row;
                  const detail = createElement(
                    "tr",
                    { key: `${rowKey}-diff` },
                    createElement(
                      "td",
                      { colSpan: 5 },
                      diffRows.length === 0
                        ? "\u2014"
                        : createElement(
                            "table",
                            { className: styles.diffTable },
                            createElement(
                              "thead",
                              null,
                              createElement(
                                "tr",
                                null,
                                createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_diff_field")),
                                createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_diff_before")),
                                createElement("th", { className: styles.diffTableHeader }, t("soc.dataops.audit_diff_after")),
                              ),
                            ),
                            createElement(
                              "tbody",
                              null,
                              diffRows.map((rowItem) =>
                                createElement(
                                  "tr",
                                  { key: rowItem.key },
                                  createElement("td", { className: styles.diffCellKey }, rowItem.key),
                                  createElement("td", { className: styles.diffBefore }, JSON.stringify(rowItem.before)),
                                  createElement("td", { className: styles.diffAfter }, JSON.stringify(rowItem.after)),
                                ),
                              ),
                            ),
                          ),
                    ),
                  );
                  return [row, detail];
                }),
              ),
            ),
          ),
      createElement(
        "div",
        { className: styles.auditPager },
        createElement(
          "button",
          {
            onClick: () => setAuditPage((p) => Math.max(1, p - 1)),
            disabled: auditPage <= 1,
            className: styles.actionBtn,
            "aria-label": t("soc.dataops.audit_previous"),
          },
          "\u25C0 " + t("soc.dataops.audit_previous"),
        ),
        createElement("span", null, `${t("soc.dataops.audit_page")} ${auditPage}`),
        createElement(
          "button",
          {
            onClick: () => setAuditPage((p) => p + 1),
            disabled: !auditHasMore,
            className: styles.actionBtn,
            "aria-label": t("soc.dataops.audit_next"),
          },
          t("soc.dataops.audit_next") + " \u25B6",
        ),
        createElement(
          "button",
          {
            onClick: handleExportAudits,
            disabled: exportingAudits,
            className: styles.actionBtn,
          },
          exportingAudits ? t("soc.export.exporting") : t("soc.export.export_config_audits"),
        ),
      ),
    ),

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
