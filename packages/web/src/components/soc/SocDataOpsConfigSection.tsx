import { createElement, useCallback, useContext, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { NumberInput, SocQueueTierFieldSet, type QueueTierConfig } from "./SocQueueTierFieldSet.js";
import { diffObjects, type DiffRow } from "../../lib/diffUtil.js";
import { formatLastCheck } from "./socTime.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { DataOpsContext } from "./DataOpsContext.js";
// WAVE 6 / NAV-1 — hook URL có sẵn; `useUrlState` ⇒ cần `<Router>` (test đã bọc).
import { useUrlState, intCodec, stringCodec, type UrlStateCodec } from "../../hooks/useUrlState";

/** WAVE 6 — spec ở MODULE SCOPE: `useUrlState` memo hoá theo `spec`/`defaults`. */
type AuditUrl = { page: number; actor: string; q: string };
const AUDIT_URL_SPEC: { [K in keyof AuditUrl]: UrlStateCodec<AuditUrl[K]> } = {
  page: intCodec,
  actor: stringCodec,
  q: stringCodec,
};
/** Fallback = đúng giá trị `useState` cũ. */
const AUDIT_URL_DEFAULTS: AuditUrl = { page: 1, actor: "", q: "" };
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

const PRESET_TIERS: Record<"saving" | "balanced" | "performance", QueueTierConfig> = {
  saving: { poll_interval_seconds: 60, max_batch_size: 30, max_dispatch_per_cycle: 30 },
  balanced: { poll_interval_seconds: 30, max_batch_size: 50, max_dispatch_per_cycle: 50 },
  performance: { poll_interval_seconds: 15, max_batch_size: 100, max_dispatch_per_cycle: 100 },
};

const PRESET_KEYS: Array<keyof typeof PRESET_TIERS> = ["saving", "balanced", "performance"];

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
  const confirm = useConfirm();
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
  // WAVE 6 / NAV-1 — audit: phân trang + 2 bộ lọc đồng bộ URL (gộp 1 patch để
  // một lần bấm chỉ tạo một history entry).
  const [auditState, setAuditState] = useUrlState(AUDIT_URL_SPEC, AUDIT_URL_DEFAULTS, {
    replaceKeys: ["actor", "q"],
  });
  const auditPage = auditState.page;
  const setAuditPage = (v: number) => setAuditState({ page: v });
  const auditActorFilter = auditState.actor;
  const setAuditActorFilter = (v: string) => setAuditState({ actor: v });
  const auditSearch = auditState.q;
  const setAuditSearch = (v: string) => setAuditState({ q: v });
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditExpandedId, setAuditExpandedId] = useState<number | null>(null);
  const [exportingAudits, setExportingAudits] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [schemaFields, setSchemaFields] = useState<Record<string, SchemaField>>({});
  const [staleNote, setStaleNote] = useState(false);
  const dataOpsCtx = useContext(DataOpsContext);

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
    if (dataOpsCtx) {
      dataOpsCtx.actions.refreshConfig();
    } else {
      fetchConfigOnly();
    }
  }, [dataOpsCtx, fetchConfigOnly]);

  useEffect(() => {
    const fresh = dataOpsCtx?.state.config ?? null;
    if (!fresh) return;
    setEnvelope((prev) => {
      const prevUpdated = prev?.updated_at ?? null;
      const unchanged = prevUpdated && fresh.updated_at && prevUpdated === fresh.updated_at;
      if (prev && !unchanged) {
        const dirty = JSON.stringify(form) !== JSON.stringify(DEFAULTS) || changeReason !== "";
        if (dirty) {
          setStaleNote(true);
          setAuditPage(1);
          setError("");
        } else if (JSON.stringify(form) === JSON.stringify(DEFAULTS) && changeReason === "") {
          setForm(readForm(fresh.config));
        }
      }
      if (!prev) {
        if (JSON.stringify(form) === JSON.stringify(DEFAULTS)) setForm(readForm(fresh.config));
        setLoading(false);
      }
      return fresh;
    });
  }, [dataOpsCtx?.state.config]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyPreset = async (presetKey: keyof typeof PRESET_TIERS) => {
    const isDirty = JSON.stringify(form) !== JSON.stringify(readForm(envelope?.config));
    if (isDirty) {
      const ok = await confirm({
        title: t("soc.dataops.confirm"),
        message: t("soc.dataops.preset_confirm"),
      });
      if (!ok) return;
    }
    const tier = PRESET_TIERS[presetKey];
    setForm((prev) => {
      const next = { ...prev };
      TIER_KEYS.forEach((tierKey) => {
        next[tierKey] = { ...tier };
      });
      return next;
    });
    setFormErrors({});
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
    if (!changeReason.trim()) {
      setError(t("soc.dataops.change_reason_required"));
      const target = document.querySelector('#change_reason') as HTMLTextAreaElement | null;
      target?.focus();
      return;
    }
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
      setStaleNote(false);
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
      setStaleNote(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("soc.dataops.config_load_failed"));
    }
  };

  const handleRevert = async (entry: AuditEntry) => {
    if (!entry.before_snapshot) return;
    const ok = await confirm({
      title: t("common.confirmTitle"),
      message: t("soc.dataops.revert_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
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

  const isBalanced = JSON.stringify(form) === JSON.stringify({ ...DEFAULTS, hot_user_demand: PRESET_TIERS.balanced, warm_liquid_market: PRESET_TIERS.balanced, cold_full_market: PRESET_TIERS.balanced, recovery_backlog: PRESET_TIERS.balanced });
  const isSaving = JSON.stringify(form.hot_user_demand) === JSON.stringify(PRESET_TIERS.saving) && TIER_KEYS.every((k) => JSON.stringify(form[k]) === JSON.stringify(PRESET_TIERS.saving));
  const isPerformance = JSON.stringify(form.hot_user_demand) === JSON.stringify(PRESET_TIERS.performance) && TIER_KEYS.every((k) => JSON.stringify(form[k]) === JSON.stringify(PRESET_TIERS.performance));
  const selectedPreset = isPerformance ? "performance" : isSaving ? "saving" : isBalanced ? "balanced" : null as string | null;

  return createElement(
    "div",
    { className: styles.configPageStack },
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
    staleNote
      ? createElement(
          "div",
          { className: styles.conflictBanner, role: "status" },
          t("soc.dataops.new_update_note"),
          createElement(
            "button",
            { className: styles.actionBtn, onClick: handleReloadCompare },
            t("soc.dataops.reload_compare"),
          ),
        )
      : null,

    createElement(
      "div",
      { className: styles.glassPanel + " " + styles.configHeaderMeta },
      createElement(
        "div",
        { className: styles.configHeaderTopRow },
        createElement(
          "div",
          { className: styles.configEyebrow },
          createElement(LucideIcon, { name: "Settings2", size: 14 }),
          " SOC / DataOps",
        ),
        ownership
          ? createElement(SocOwnershipBadge, {
              team: ownership.owner_team,
              writable: ownership.can_apply,
              accessLevel: ownership.mode,
            })
          : null,
      ),
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
      ownership?.write_block_reason
        ? createElement(SocWriteGuardBanner, {
            owner: ownership.owner_team,
            writer: ownership.writer || ownership.owner_team,
            surface: ownership.write_surface,
          })
        : null,
    ),

    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.global_config")),
      createElement("p", { className: styles.helpText }, t("soc.dataops.global_config_help")),
      envelope?.updated_at
        ? createElement(
            "p",
            { className: styles.helpText, title: formatLastCheck(envelope.updated_at, localeTag, t).title },
            `${t("soc.dataops.last_updated")}: ${formatLastCheck(envelope.updated_at, localeTag, t).display}`,
          )
        : null,
      globals,
      createElement(
        "div",
        { className: styles.presetRow },
        createElement("span", { className: styles.presetLabel }, t("soc.dataops.preset_label")),
        PRESET_KEYS.map((presetKey) =>
          createElement(
            "button",
            {
              key: presetKey,
              type: "button",
              title: t("soc.dataops.preset_tooltip"),
              className: presetKey === selectedPreset ? styles.filterBtnActive : styles.filterBtnInactive,
              onClick: () => applyPreset(presetKey),
            },
            t(`soc.dataops.preset_${presetKey}`),
          ),
        ),
      ),
    ),

    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers_config")),
      createElement("p", { className: styles.helpText }, t("soc.dataops.queue_tiers_help")),
      createElement(
        "div",
        { className: styles.configTierGrid },
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
    ),

    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.change_reason") + " ", createElement("span", { className: styles.fieldRequired }, "*")),
      createElement("p", { className: styles.helpText }, t("soc.dataops.reason_section_help")),
      createElement(
        "div",
        { className: styles.stickyActionBar },
        createElement("div", { className: styles.fieldRow },
          createElement("label", { className: styles.fieldLabel, htmlFor: "change_reason" }, t("soc.dataops.change_reason")),
          createElement(
            "textarea",
            {
              id: "change_reason",
              className: styles.fieldInput,
              rows: 2,
              maxLength: 200,
              placeholder: t("soc.dataops.change_reason_placeholder"),
              value: changeReason,
              "aria-label": t("soc.dataops.change_reason"),
              "aria-required": true,
              onChange: (event) => setChangeReason((event.target as HTMLTextAreaElement).value),
            },
            null,
          ),
          createElement("p", { className: styles.helpText }, t("soc.dataops.chars_remaining", { count: 200 - changeReason.length, max: 200 })),
        ),
        createElement(
          "div",
          { className: styles.stickyActionButtons },
          createElement(
            "button",
            { type: "button", onClick: handleResetDefaults, className: `${styles.actionBtn} ${styles.actionBtnDanger}` },
            t("soc.dataops.reset_defaults"),
          ),
          createElement(
            "button",
            { type: "button", onClick: handleReset, className: styles.filterBtnInactive },
            t("soc.actions.reset"),
          ),
          createElement(
            "button",
            { type: "button", onClick: handlePreview, className: styles.actionBtn, style: { background: "rgba(var(--soc-rgb-16d7a0) / 0.2)", color: "var(--accent-emerald, #10b981)", fontWeight: 700 } as unknown as Record<string,string>, disabled: envelope?.ownership?.can_apply === false },
            t("soc.actions.preview"),
          ),
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
        { className: styles.auditToolbarGrid },
        createElement("div", { className: styles.fieldRow },
          createElement("label", { className: styles.fieldLabel }, t("soc.dataops.audit_filter_actor")),
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
        ),
        createElement("div", { className: styles.fieldRow },
          createElement("label", { className: styles.fieldLabel }, t("soc.dataops.audit_filter_from")),
          createElement("input", {
            type: "date",
            value: auditFromDate,
            onChange: (event) => setAuditFromDate((event.target as HTMLInputElement).value),
            className: styles.fieldInput,
            "aria-label": t("soc.dataops.audit_filter_from"),
          }),
        ),
        createElement("div", { className: styles.fieldRow },
          createElement("label", { className: styles.fieldLabel }, t("soc.dataops.audit_filter_search")),
          createElement("input", {
            type: "search",
            value: auditSearch,
            onChange: (event) => setAuditSearch((event.target as HTMLInputElement).value),
            placeholder: t("soc.dataops.audit_filter_search"),
            className: styles.fieldInput,
            "aria-label": t("soc.dataops.audit_filter_search"),
          }),
        ),
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
            // WAVE 6: setter của `useUrlState` nhận **giá trị**, KHÔNG phải updater lambda
// như `useState` — truyền lambda sẽ ghi chuỗi hàm vào URL.
onClick: () => setAuditPage(Math.max(1, auditPage - 1)),
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
            onClick: () => setAuditPage(auditPage + 1),
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
