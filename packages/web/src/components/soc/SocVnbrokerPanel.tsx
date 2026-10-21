import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { SocConfigPreviewModal } from "./SocConfigPreviewModal.js";
import { SocOwnershipBadge } from "./SocOwnershipBadge.js";
import { SocWriteGuardBanner } from "./SocWriteGuardBanner.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { getStatusBadgeStyle, toneColor } from "./socStatusColors.js";
import { diffObjects, type DiffRow } from "../../lib/diffUtil.js";
import { CommercialTable } from "../commercial/primitives/CommercialTable.js";
import { CommercialMeta } from "../commercial/primitives/CommercialMeta.js";
import styles from "./soc.module.css";

interface VnbrokerTimeout {
  connect?: number;
  read?: number;
  write?: number;
  pool?: number;
}

interface VnbrokerPerProviderConfig {
  timeout?: VnbrokerTimeout;
  max_retries?: number;
  retry_delay_seconds?: number;
  requests_per_minute?: number;
  burst_limit?: number;
}

/**
 * CONFIG PAYLOAD THẬT của domain vnbroker.
 * KHÔNG bao giờ gửi envelope (`id` / `service` / `providers_catalog`…) làm
 * `config_payload` — BE `VnbrokerDomainConfig.from_dict` chỉ đọc key cấp 1
 * nên toàn bộ chỉnh sửa của operator sẽ bị ghi đè bằng mặc định.
 */
interface VnbrokerConfigPayload {
  timeout?: VnbrokerTimeout;
  max_retries?: number;
  retry_delay_seconds?: number;
  preferred_provider?: string;
  fallback_providers?: string[];
  enabled?: boolean;
  circuit_breaker_threshold?: number;
  circuit_breaker_window_seconds?: number;
  circuit_breaker_cooldown_seconds?: number;
  requests_per_minute?: number;
  burst_limit?: number;
  per_provider_config?: Record<string, VnbrokerPerProviderConfig>;
  [key: string]: unknown;
}

interface VnbrokerCatalogEntry {
  provider: string;
  label: string;
  enabled: boolean;
  in_active_cycle: boolean;
  runtime_ready: boolean;
  credential_mode: string;
  requires_runtime_credentials: boolean;
  required_runtime_envs: string[];
  runtime_gate: string;
  readiness_reason: string;
  default_selected: boolean;
  supports_vnbroker: boolean;
}

interface VnbrokerProviderHealthRow {
  provider: string;
  label: string;
  status: string;
  latency_ms: number | null;
  success_rate: number | null;
  error_rate: number | null;
  total_requests: number;
  failed_requests: number;
  last_success_at: string | null;
  last_error: string;
  circuit_state: string;
}

interface VnbrokerHealthSnapshot {
  service_key: string;
  status: string;
  last_check_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  avg_response_ms: number | null;
  detail: Record<string, unknown>;
}

interface VnbrokerBreakerSnapshot {
  status: string;
  failures: number;
  threshold: number;
  window_seconds: number;
  cooldown_seconds: number;
  source: string;
  per_provider: Record<string, { status: string; failures: number }>;
}

interface VnbrokerBenchmarkRow {
  provider: string;
  concurrency: number;
  runs: number;
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  rate_limited_requests: number;
  timeout_errors: number;
  transport_errors: number;
  rpm: number;
  success_rate: number;
  rate_limit_pct: number;
  latency_ms: number;
  p95_latency_ms: number;
}

interface VnbrokerBenchmarkReport {
  symbol: string;
  started_at: string | null;
  finished_at: string | null;
  providers: string[];
  concurrency_levels: number[];
  results: VnbrokerBenchmarkRow[];
  recommendation: {
    primary_provider?: string;
    fallback_provider?: string;
    adaptive_start_concurrency?: number;
    reason?: string;
  } | null;
}

interface VnbrokerOwnership {
  domain?: string;
  mode?: string;
  writer?: string;
  owner_team?: string;
  write_surface?: string;
  can_apply?: boolean;
  locked_fields?: string[];
  write_block_reason?: string | null;
}

const vnbrokerAdapter = defaultCoreApiAdapter as unknown as {
  getSocVnbrokerConfig: () => Promise<{
    service_key: string;
    config_schema_version: string;
    config: VnbrokerConfigPayload;
    providers_catalog: VnbrokerCatalogEntry[];
    applied_by: string;
    applied_at: string | null;
    change_reason: string;
    is_current: boolean;
  }>;
  applySocVnbrokerConfig: (
    config: VnbrokerConfigPayload,
    options?: { changeReason?: string; expectedUpdatedAt?: string | null },
  ) => Promise<unknown>;
  previewSocVnbrokerConfig: (config: VnbrokerConfigPayload) => Promise<{
    valid: boolean;
    validationErrors: string[];
    impactWarnings: string[];
    configPayload: VnbrokerConfigPayload;
    providersCatalog: VnbrokerCatalogEntry[];
  }>;
  getSocVnbrokerHealth: () => Promise<VnbrokerHealthSnapshot>;
  getSocVnbrokerProviderHealth: () => Promise<{
    checked_at: string | null;
    source: string;
    providers: VnbrokerProviderHealthRow[];
  }>;
  getSocVnbrokerProviders: () => Promise<{
    primary: string;
    fallback: string[];
    enabled: boolean;
    providers: VnbrokerCatalogEntry[];
  }>;
  getSocVnbrokerBenchmarkLatest: () => Promise<{
    has_report: boolean;
    report: VnbrokerBenchmarkReport | null;
  }>;
  runSocVnbrokerBenchmark: (payload: Record<string, unknown>) => Promise<{
    has_report: boolean;
    report: VnbrokerBenchmarkReport | null;
  }>;
  getSocVnbrokerCircuitBreaker: () => Promise<VnbrokerBreakerSnapshot>;
  getSocVnbrokerOwnership: () => Promise<VnbrokerOwnership>;
  testSocVnbrokerConnection: (provider: string) => Promise<{
    provider: string;
    status: string;
    latency_ms: number;
  }>;
};

const EMPTY_TIMEOUT: VnbrokerTimeout = { connect: 10, read: 30, write: 10, pool: 5 };

/**
 * Mỗi request có trần thời gian: 1 endpoint chậm KHÔNG được kéo dài cả panel.
 *
 * Ngưỡng CHỌN TỪ SỐ ĐO THẬT trên staging (2026-10-20, Playwright):
 * 1 endpoint (không tải) mất 1.4–7.8s; 7 request song song mất ~60s ⇒ timeout
 * cũ 12s cắt mất endpoint còn sống. 30s là trần trên đo được, không phải
 * con số đoán.
 */
const REQUEST_TIMEOUT_MS = 30_000;
const RUNTIME_POLL_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms);
    }),
  ]);
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("vi-VN");
}

/** Bỏ key có giá trị `undefined` để diff với BE không bị nhiễu. */
function compactPayload(payload: VnbrokerConfigPayload): VnbrokerConfigPayload {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = compactPayload(value as VnbrokerConfigPayload);
      if (Object.keys(nested).length === 0) continue;
      out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out as VnbrokerConfigPayload;
}

/** BE từ chối `fallback_providers` chứa `preferred_provider` — FE chặn trước. */
function sanitizeDraft(draft: VnbrokerConfigPayload): VnbrokerConfigPayload {
  const primary = String(draft.preferred_provider || "").toLowerCase();
  const rawFallback = draft.fallback_providers;
  if (!primary || !rawFallback) return { ...draft };
  const fallback = rawFallback.filter(
    (provider) => String(provider).toLowerCase() !== primary,
  );
  return { ...draft, fallback_providers: fallback };
}

export function SocVnbrokerPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingOwnership, setLoadingOwnership] = useState(true);
  const [loadingRuntime, setLoadingRuntime] = useState(true);
  const [loadingBenchmark, setLoadingBenchmark] = useState(true);
  const [configError, setConfigError] = useState("");
  const [providersError, setProvidersError] = useState("");
  const [runtimeError, setRuntimeError] = useState("");
  const [benchmarkError, setBenchmarkError] = useState("");

  const [configMeta, setConfigMeta] = useState<{
    service_key: string;
    applied_by: string;
    applied_at: string | null;
  } | null>(null);
  const [savedConfig, setSavedConfig] = useState<VnbrokerConfigPayload>({});
  const [draft, setDraft] = useState<VnbrokerConfigPayload>({});

  const [primary, setPrimary] = useState("");
  const [fallback, setFallback] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<VnbrokerCatalogEntry[]>([]);
  const [providerHealth, setProviderHealth] = useState<VnbrokerProviderHealthRow[]>([]);
  const [providerHealthSource, setProviderHealthSource] = useState("unknown");
  const [providerHealthCheckedAt, setProviderHealthCheckedAt] = useState<string | null>(null);
  const [health, setHealth] = useState<VnbrokerHealthSnapshot | null>(null);
  const [breaker, setBreaker] = useState<VnbrokerBreakerSnapshot | null>(null);
  const [benchmark, setBenchmark] = useState<VnbrokerBenchmarkReport | null>(null);
  const [ownership, setOwnership] = useState<VnbrokerOwnership | null>(null);

  const [changeReason, setChangeReason] = useState("");
  const [changeReasonTouched, setChangeReasonTouched] = useState(false);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDiff, setPreviewDiff] = useState<DiffRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkProvider, setBenchmarkProvider] = useState("all");
  const [testingProvider, setTestingProvider] = useState("");

  const errorText = useCallback(
    (err: unknown, fallbackKey: string) => {
      if (err instanceof Error) {
        if (err.message.startsWith("TIMEOUT:")) return t("soc.vnbroker.request_timeout");
        return err.message;
      }
      return t(fallbackKey);
    },
    [t],
  );

  // ── Tải TỪNG KHỐI RIÊNG (đo thật staging: 1 request 1.4–7.8s; 7 request
  // song song ~60s ⇒ 1 endpoint chậm KHÔNG được chặn cả panel).
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError("");
    try {
      const res = await withTimeout(
        vnbrokerAdapter.getSocVnbrokerConfig(),
        REQUEST_TIMEOUT_MS,
        "config",
      );
      const payload = res.config || {};
      setConfigMeta({
        service_key: res.service_key,
        applied_by: res.applied_by,
        applied_at: res.applied_at,
      });
      setSavedConfig(payload);
      setDraft(payload);
    } catch (err) {
      setConfigError(errorText(err, "soc.vnbroker.load_failed"));
    } finally {
      setLoadingConfig(false);
    }
  }, [errorText]);

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    setProvidersError("");
    try {
      const res = await withTimeout(
        vnbrokerAdapter.getSocVnbrokerProviders(),
        REQUEST_TIMEOUT_MS,
        "providers",
      );
      setPrimary(res.primary || "");
      setFallback(res.fallback || []);
      setCatalog(res.providers || []);
    } catch (err) {
      setProvidersError(errorText(err, "soc.vnbroker.load_failed"));
    } finally {
      setLoadingProviders(false);
    }
  }, [errorText]);

  const loadOwnership = useCallback(async () => {
    setLoadingOwnership(true);
    try {
      const res = await withTimeout(
        vnbrokerAdapter.getSocVnbrokerOwnership(),
        REQUEST_TIMEOUT_MS,
        "ownership",
      );
      setOwnership(res);
    } catch {
      // Ownership chỉ là thông tin phụ — không chặn phần còn lại của panel.
    } finally {
      setLoadingOwnership(false);
    }
  }, []);

  // ── Nhóm 2: sức khỏe runtime (nhanh hơn, poll riêng) ──
  const loadRuntime = useCallback(async () => {
    setLoadingRuntime(true);
    setRuntimeError("");
    const results = await Promise.allSettled([
      withTimeout(vnbrokerAdapter.getSocVnbrokerHealth(), REQUEST_TIMEOUT_MS, "health"),
      withTimeout(vnbrokerAdapter.getSocVnbrokerProviderHealth(), REQUEST_TIMEOUT_MS, "provider-health"),
      withTimeout(vnbrokerAdapter.getSocVnbrokerCircuitBreaker(), REQUEST_TIMEOUT_MS, "breaker"),
    ]);
    const [healthRes, phRes, cbRes] = results;
    if (healthRes.status === "fulfilled") setHealth(healthRes.value);
    if (phRes.status === "fulfilled") {
      setProviderHealth(phRes.value.providers || []);
      setProviderHealthSource(phRes.value.source || "unknown");
      setProviderHealthCheckedAt(phRes.value.checked_at || null);
    }
    if (cbRes.status === "fulfilled") setBreaker(cbRes.value);
    const failed = [healthRes, phRes, cbRes].filter((r) => r.status === "rejected");
    if (failed.length) {
      setRuntimeError(errorText((failed[0] as PromiseRejectedResult).reason, "soc.vnbroker.load_failed"));
    }
    setLoadingRuntime(false);
  }, [errorText]);

  // ── Nhóm 3: benchmark (nặng nhất, tách riêng) ──
  const loadBenchmark = useCallback(async () => {
    setLoadingBenchmark(true);
    setBenchmarkError("");
    try {
      const result = await withTimeout(
        vnbrokerAdapter.getSocVnbrokerBenchmarkLatest(),
        REQUEST_TIMEOUT_MS,
        "benchmark",
      );
      setBenchmark(result.report || null);
    } catch (err) {
      setBenchmarkError(errorText(err, "soc.vnbroker.load_failed"));
    } finally {
      setLoadingBenchmark(false);
    }
  }, [errorText]);

  useEffect(() => {
    void loadConfig();
    void loadProviders();
    void loadOwnership();
    void loadRuntime();
    void loadBenchmark();
  }, [loadConfig, loadProviders, loadOwnership, loadRuntime, loadBenchmark]);

  // Tự làm mới số liệu runtime (tab ẩn thì không poll).
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadRuntime();
    }, RUNTIME_POLL_MS);
    return () => clearInterval(timer);
  }, [loadRuntime]);

  const updateDraft = useCallback((patch: Partial<VnbrokerConfigPayload>) => {
    setDraft((prev) => sanitizeDraft({ ...prev, ...patch }));
  }, []);

  const updateTimeout = useCallback((key: keyof VnbrokerTimeout, value: number) => {
    setDraft((prev) =>
      sanitizeDraft({
        ...prev,
        timeout: { ...(prev.timeout || EMPTY_TIMEOUT), [key]: value },
      }),
    );
  }, []);

  const setPreferred = useCallback((provider: string) => {
    // Đổi provider chính ⇒ provider cũ rời khỏi chuỗi dự phòng, provider mới
    // không được nằm trong chuỗi dự phòng (BE validate sẽ từ chối nếu không).
    setDraft((prev) => {
      const next = sanitizeDraft({ ...prev, preferred_provider: provider });
      const previousPrimary = String(prev.preferred_provider || "").toLowerCase();
      if (previousPrimary && previousPrimary !== provider) {
        const kept = (next.fallback_providers || []).filter(
          (item) => String(item).toLowerCase() !== previousPrimary,
        );
        next.fallback_providers = kept;
      }
      return next;
    });
  }, []);

  const toggleFallback = useCallback((provider: string) => {
    setDraft((prev) => {
      const current = prev.fallback_providers || [];
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return sanitizeDraft({ ...prev, fallback_providers: next });
    });
  }, []);

  const readyCount = useMemo(
    () => catalog.filter((p) => p.runtime_ready).length,
    [catalog],
  );

  const healthByProvider = useMemo(() => {
    const map = new Map<string, VnbrokerProviderHealthRow>();
    for (const row of providerHealth) map.set(row.provider, row);
    return map;
  }, [providerHealth]);

  const roleOf = useCallback(
    (provider: string) => {
      if (provider === primary) return "primary";
      if (fallback.includes(provider)) return "fallback";
      return "inactive";
    },
    [primary, fallback],
  );

  const roleLabel = useCallback(
    (role: string) => {
      if (role === "primary") return t("soc.vnbroker.role_primary");
      if (role === "fallback") return t("soc.vnbroker.role_fallback");
      return t("soc.vnbroker.role_inactive");
    },
    [t],
  );

  const canApply = ownership?.can_apply !== false;

  const dirty = useMemo(
    () => JSON.stringify(compactPayload(sanitizeDraft(draft))) !== JSON.stringify(compactPayload(savedConfig)),
    [draft, savedConfig],
  );

  const handlePreview = useCallback(async () => {
    if (!changeReason.trim()) {
      setChangeReasonTouched(true);
      return;
    }
    setChangeReasonTouched(true);
    try {
      setPreviewing(true);
      const result = await vnbrokerAdapter.previewSocVnbrokerConfig(compactPayload(sanitizeDraft(draft)));
      setPreviewErrors(result.validationErrors || []);
      setPreviewWarnings(result.impactWarnings || []);
      if ((result.validationErrors || []).length > 0) {
        setPreviewOpen(false);
        return;
      }
      setPreviewDiff(diffObjects(savedConfig, result.configPayload || draft));
      setPreviewOpen(true);
    } catch (err) {
      toast.error(errorText(err, "soc.vnbroker.preview_failed"));
    } finally {
      setPreviewing(false);
    }
  }, [changeReason, draft, savedConfig, toast, errorText]);

  const handleApply = useCallback(async () => {
    try {
      setApplying(true);
      await vnbrokerAdapter.applySocVnbrokerConfig(compactPayload(sanitizeDraft(draft)), {
        changeReason: changeReason.trim(),
        expectedUpdatedAt: configMeta?.applied_at || null,
      });
      setPreviewOpen(false);
      setChangeReason("");
      setChangeReasonTouched(false);
      setPreviewErrors([]);
      setPreviewWarnings([]);
      toast.success(t("soc.vnbroker.apply_success"));
      await Promise.all([loadConfig(), loadProviders(), loadRuntime()]);
    } catch (err) {
      toast.error(errorText(err, "soc.vnbroker.apply_failed"));
    } finally {
      setApplying(false);
    }
  }, [changeReason, configMeta, draft, loadConfig, loadProviders, loadRuntime, toast, t, errorText]);

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: t("soc.vnbroker.reset_title"),
      message: t("soc.vnbroker.reset_confirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await vnbrokerAdapter.applySocVnbrokerConfig(
        {},
        { changeReason: t("soc.vnbroker.reset_reason") },
      );
      setChangeReason("");
      setChangeReasonTouched(false);
      toast.success(t("soc.vnbroker.reset_success"));
      await Promise.all([loadConfig(), loadProviders(), loadRuntime()]);
    } catch (err) {
      toast.error(errorText(err, "soc.vnbroker.apply_failed"));
    }
  }, [confirm, loadConfig, loadProviders, loadRuntime, toast, t, errorText]);

  const handleRunBenchmark = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      const payload = benchmarkProvider !== "all" ? { provider: benchmarkProvider } : {};
      const result = await vnbrokerAdapter.runSocVnbrokerBenchmark(payload);
      setBenchmark(result.report || null);
      if (!result.report) toast.info(t("soc.vnbroker.benchmark_no_report"));
    } catch (err) {
      toast.error(errorText(err, "soc.vnbroker.benchmark_failed"));
    } finally {
      setBenchmarkLoading(false);
    }
  }, [benchmarkProvider, toast, t, errorText]);

  const handleTestConnection = useCallback(
    async (provider: string) => {
      setTestingProvider(provider);
      try {
        const result = await vnbrokerAdapter.testSocVnbrokerConnection(provider);
        toast.success(
          `${t("soc.vnbroker.connection_success")} (${result.latency_ms ?? "—"}ms)`,
        );
        await loadRuntime();
      } catch (err) {
        toast.error(errorText(err, "soc.vnbroker.connection_failed"));
      } finally {
        setTestingProvider("");
      }
    },
    [toast, t, errorText, loadRuntime],
  );

  const applyOptimizedConfig = useCallback(async () => {
    const recommendation = benchmark?.recommendation;
    if (!recommendation?.primary_provider) return;
    const primaryId = recommendation.primary_provider.toLowerCase();
    const fallbackId = (recommendation.fallback_provider || "").toLowerCase();
    const next: VnbrokerConfigPayload = {
      ...draft,
      preferred_provider: primaryId,
      fallback_providers: fallbackId && fallbackId !== primaryId ? [fallbackId] : [],
    };
    setDraft(sanitizeDraft(next));
    setChangeReason(t("soc.vnbroker.optimized_reason"));
    toast.info(t("soc.vnbroker.optimized_preview_warning"));
  }, [benchmark, draft, toast, t]);

  const breakerOpen = breaker?.status === "open" || breaker?.status === "tripped";
  const draftTimeout = draft.timeout || EMPTY_TIMEOUT;
  const benchmarkRows = benchmark?.results || [];
  const draftPrimary = String(draft.preferred_provider || "").toLowerCase();
  const canPreview = Boolean(changeReason.trim()) && !previewing;

  return (
    <div className={`${styles.glassPanel} ${styles.vnbConsole}`} data-testid="vnb-console">
      {providersError ? (
        <div className={styles.inlineError} role="alert" data-testid="vnb-error">
          {providersError}{" "}
          <button type="button" className={styles.vnbActionBtn} onClick={() => void loadProviders()}>
            {t("soc.vnbroker.retry")}
          </button>
        </div>
      ) : null}

      {!canApply ? (
        <SocWriteGuardBanner
          owner={ownership?.owner_team}
          writer={ownership?.writer}
          surface={ownership?.write_surface}
        />
      ) : null}

      <CommercialMeta
        className={styles.vnbMetaStrip}
        items={[
          {
            label: t("soc.vnbroker.applied_by"),
            value: configMeta?.applied_by
              ? `${configMeta.applied_by} · ${formatTime(configMeta.applied_at)}`
              : t("soc.vnbroker.not_applied_yet"),
          },
          {
            label: t("soc.vnbroker.write_permission"),
            value: canApply
              ? t("soc.badge.writable_yes")
              : t("soc.badge.writable_no"),
          },
        ]}
      />

      {/* ── 0. KPI strip ─────────────────────────────────────────────── */}
      <h2 className={styles.metricLabel} data-testid="vnb-kpi-title">
        {t("soc.vnbroker.kpi_title")}
      </h2>
      {loadingProviders ? (
        <div className={styles.metricGrid} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${styles.skeleton} ${styles.vnbSkeletonCard}`} />
          ))}
        </div>
      ) : (
        <div className={styles.metricGrid} data-testid="vnb-kpi">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_primary")}</div>
            <div className={styles.metricValue} data-testid="vnb-kpi-primary">
              {(primary || "—").toUpperCase()}
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_fallback")}</div>
            <div className={styles.metricValue} data-testid="vnb-kpi-fallback">
              {fallback.length ? fallback.map((p) => p.toUpperCase()).join(", ") : "—"}
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_ready")}</div>
            <div className={styles.metricValue} data-testid="vnb-kpi-ready">
              {readyCount}/{catalog.length}
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_breaker")}</div>
            <div
              className={styles.metricValue}
              data-testid="vnb-kpi-breaker"
              style={{ color: breakerOpen ? toneColor("danger") : toneColor("success") }}
            >
              {breakerOpen ? t("soc.vnbroker.breaker_tripped") : t("soc.vnbroker.breaker_closed")}
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Bộ nhà cung cấp ───────────────────────────────────────── */}
      <section className={styles.sectionCard} data-testid="vnb-providers">
        <h3 className={styles.sectionCardTitle}>{t("soc.vnbroker.providers_title")}</h3>
        {loadingProviders ? (
          <div className={styles.vnbTileGrid} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${styles.skeleton} ${styles.vnbSkeletonCard}`} />
            ))}
          </div>
        ) : (
          <CommercialTable
            className={styles.vnbSourceTable}
            caption={t("soc.vnbroker.table_caption")}
            columns={[
              { key: "source", label: t("soc.vnbroker.col_source"), rowHeader: true },
              { key: "role", label: t("soc.vnbroker.col_role") },
              { key: "ready", label: t("soc.vnbroker.col_ready") },
              { key: "perf", label: t("soc.vnbroker.col_perf") },
              { key: "requests", label: t("soc.vnbroker.col_requests") },
              { key: "circuit", label: t("soc.vnbroker.col_circuit") },
              { key: "actions", label: t("soc.vnbroker.col_actions") },
            ]}
            rows={catalog.map((entry) => {
              const role = roleOf(entry.provider);
              const row = healthByProvider.get(entry.provider);
              const ready = entry.runtime_ready;
              const isPrimary = role === "primary";
              const name = entry.label || entry.provider.toUpperCase();
              return {
                id: entry.provider,
                testId: `vnb-provider-${entry.provider}`,
                cells: {
                  source: (
                    <span
                      className={styles.vnbCellSource}
                      data-testid={`vnb-provider-${entry.provider}-name`}
                    >
                      <strong>{name}</strong>
                      <span className={styles.domainPill}>
                        {entry.credential_mode === "api-key"
                          ? t("soc.vnbroker.credential_mode_api_key")
                          : t("soc.vnbroker.credential_mode_builtin")}
                      </span>
                    </span>
                  ),
                  role: (
                    <span
                      className={`${styles.brokerBadge} ${
                        isPrimary
                          ? styles.brokerBadgeOk
                          : role === "fallback"
                            ? styles.brokerBadgeWarn
                            : styles.brokerBadge
                      }`}
                      data-testid={`vnb-provider-${entry.provider}-role`}
                    >
                      {roleLabel(role)}
                    </span>
                  ),
                  ready: (
                    <span
                      className={styles.vnbCellStack}
                      title={`${t("soc.vnbroker.last_check")}: ${
                        row?.last_success_at ? formatTime(row.last_success_at) : "—"
                      }`}
                    >
                      <span
                        className={styles.statusBadge}
                        style={getStatusBadgeStyle(ready ? "healthy" : "degraded")}
                      >
                        {ready
                          ? t("soc.vnbroker.provider_ready")
                          : t("soc.vnbroker.provider_not_ready")}
                      </span>
                      <span
                        className={styles.vnbStatValue}
                        data-testid={`vnb-provider-${entry.provider}-readiness`}
                      >
                        {entry.readiness_reason || entry.runtime_gate}
                      </span>
                      {entry.required_runtime_envs.length ? (
                        <span className={styles.vnbEnvList}>
                          {entry.required_runtime_envs.map((env) => (
                            <span key={env} className={styles.domainPill}>
                              {env}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  ),
                  perf: (
                    <span className={styles.vnbStatValue}>
                      {row?.latency_ms == null ? "—" : `${row.latency_ms}ms`}
                      {" · "}
                      {row?.success_rate == null ? "—" : `${row.success_rate}%`}
                    </span>
                  ),
                  requests: (
                    <span className={styles.vnbStatValue}>
                      {row ? `${row.total_requests} / ${row.failed_requests}` : "—"}
                    </span>
                  ),
                  circuit: (
                    <span
                      className={styles.vnbStatValue}
                      title={row?.last_error || undefined}
                    >
                      {row?.circuit_state
                        ? t(`soc.vnbroker.circuit_state_${row.circuit_state}`)
                        : "—"}
                    </span>
                  ),
                  actions: (
                    <span className={styles.vnbTileActions}>
                      <button
                        type="button"
                        className={styles.vnbActionBtn}
                        disabled={!ready || testingProvider === entry.provider}
                        title={
                          ready
                            ? t("soc.vnbroker.test_connection")
                            : entry.readiness_reason || t("soc.vnbroker.provider_not_ready")
                        }
                        aria-label={`${t("soc.vnbroker.test_connection")} — ${name}`}
                        onClick={() => void handleTestConnection(entry.provider)}
                      >
                        {testingProvider === entry.provider
                          ? t("soc.vnbroker.testing_connection")
                          : t("soc.vnbroker.test_connection")}
                      </button>
                      <button
                        type="button"
                        className={styles.vnbActionBtn}
                        disabled={isPrimary}
                        title={
                          isPrimary
                            ? t("soc.vnbroker.already_primary")
                            : t("soc.vnbroker.set_primary")
                        }
                        aria-label={`${t("soc.vnbroker.set_primary")} — ${name}`}
                        onClick={() => {
                          setPreferred(entry.provider);
                          setChangeReason(
                            t("soc.vnbroker.change_reason_primary", { provider: entry.provider }),
                          );
                        }}
                      >
                        {t("soc.vnbroker.set_primary")}
                      </button>
                    </span>
                  ),
                },
              };
            })}
          />
        )}
      </section>

      {/* ── 2. Cấu hình ──────────────────────────────────────────────── */}
      <section className={styles.sectionCard} data-testid="vnb-config-form">
        <h3 className={styles.sectionCardTitle}>{t("soc.vnbroker.core_config_title")}</h3>
        {configError ? (
          <div className={styles.inlineError} role="alert" data-testid="vnb-config-error">
            {configError}{" "}
            <button
              type="button"
              className={styles.vnbActionBtn}
              onClick={() => void loadConfig()}
            >
              {t("soc.vnbroker.retry")}
            </button>
          </div>
        ) : null}
        {loadingConfig ? (
          <div className={styles.vnbFormGrid} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <div key={i} className={`${styles.skeleton} ${styles.vnbSkeletonCard}`} />
            ))}
          </div>
        ) : (
          <>
        {dirty ? (
          <p className={styles.vnbDirtyBadge} data-testid="vnb-dirty-badge">
            {t("soc.vnbroker.config_dirty")}
          </p>
        ) : null}

        <div className={styles.vnbFormGrid}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-preferred-provider">
              {t("soc.vnbroker.preferred_provider")}
            </label>
            <select
              id="vnb-preferred-provider"
              data-testid="vnb-field-preferred_provider"
              className={styles.fieldInput}
              value={draft.preferred_provider || ""}
              onChange={(e) => setPreferred(e.target.value)}
            >
              {catalog.map((entry) => (
                <option key={entry.provider} value={entry.provider}>
                  {entry.label || entry.provider.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel} id="vnb-fallback-label">
              {t("soc.vnbroker.fallback_providers")}
            </span>
            <div
              className={styles.brokerTileBadges}
              role="group"
              aria-labelledby="vnb-fallback-label"
            >
              {catalog.map((entry) => {
                const isPrimary = entry.provider === draftPrimary;
                return (
                  <label
                    key={entry.provider}
                    className={styles.domainPill}
                    title={isPrimary ? t("soc.vnbroker.primary_not_fallback") : undefined}
                  >
                    <input
                      type="checkbox"
                      data-testid={`vnb-field-fallback-${entry.provider}`}
                      checked={(draft.fallback_providers || []).includes(entry.provider)}
                      disabled={isPrimary}
                      onChange={() => toggleFallback(entry.provider)}
                    />{" "}
                    {entry.label || entry.provider.toUpperCase()}
                  </label>
                );
              })}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{t("soc.vnbroker.state_section")}</span>
            <label className={styles.fieldLabel}>
              <input
                id="vnb-enabled"
                type="checkbox"
                data-testid="vnb-field-enabled"
                checked={draft.enabled !== false}
                onChange={(e) => updateDraft({ enabled: e.target.checked })}
              />{" "}
              {t("soc.vnbroker.enabled")}
            </label>
          </div>

          <h4 className={styles.vnbFormGroupTitle}>{t("soc.vnbroker.timeout_section")}</h4>
          {(["connect", "read", "write", "pool"] as const).map((key) => (
            <div className={styles.fieldRow} key={key}>
              <label className={styles.fieldLabel} htmlFor={`vnb-timeout-${key}`}>
                {t(`soc.vnbroker.timeout_${key}`)}
              </label>
              <div className={styles.vnbFieldWithUnit}>
                <input
                  id={`vnb-timeout-${key}`}
                  type="number"
                  data-testid={`vnb-field-timeout_${key}`}
                  className={styles.fieldInput}
                  value={toNumber(draftTimeout[key], 0)}
                  onChange={(e) => updateTimeout(key, toNumber(e.target.value, 0))}
                />
                <span className={styles.fieldUnit}>s</span>
              </div>
            </div>
          ))}

          <h4 className={styles.vnbFormGroupTitle}>{t("soc.vnbroker.retry_section")}</h4>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-max-retries">
              {t("soc.vnbroker.max_retries")}
            </label>
            <input
              id="vnb-max-retries"
              type="number"
              data-testid="vnb-field-max_retries"
              className={styles.fieldInput}
              value={toNumber(draft.max_retries, 0)}
              onChange={(e) => updateDraft({ max_retries: toNumber(e.target.value, 0) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-retry-delay">
              {t("soc.vnbroker.retry_delay_seconds")}
            </label>
            <div className={styles.vnbFieldWithUnit}>
              <input
                id="vnb-retry-delay"
                type="number"
                data-testid="vnb-field-retry_delay_seconds"
                className={styles.fieldInput}
                value={toNumber(draft.retry_delay_seconds, 0)}
                onChange={(e) => updateDraft({ retry_delay_seconds: toNumber(e.target.value, 0) })}
              />
              <span className={styles.fieldUnit}>s</span>
            </div>
          </div>

          <h4 className={styles.vnbFormGroupTitle}>{t("soc.vnbroker.rate_limit_section")}</h4>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-rpm">
              {t("soc.vnbroker.requests_per_minute")}
            </label>
            <input
              id="vnb-rpm"
              type="number"
              data-testid="vnb-field-requests_per_minute"
              className={styles.fieldInput}
              value={toNumber(draft.requests_per_minute, 0)}
              onChange={(e) => updateDraft({ requests_per_minute: toNumber(e.target.value, 0) })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-burst">
              {t("soc.vnbroker.burst_limit")}
            </label>
            <input
              id="vnb-burst"
              type="number"
              data-testid="vnb-field-burst_limit"
              className={styles.fieldInput}
              value={toNumber(draft.burst_limit, 0)}
              onChange={(e) => updateDraft({ burst_limit: toNumber(e.target.value, 0) })}
            />
          </div>

          <h4 className={styles.vnbFormGroupTitle}>
            {t("soc.vnbroker.circuit_breaker_title")}
          </h4>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-cb-threshold">
              {t("soc.vnbroker.circuit_breaker_threshold")}
            </label>
            <input
              id="vnb-cb-threshold"
              type="number"
              data-testid="vnb-field-circuit_breaker_threshold"
              className={styles.fieldInput}
              value={toNumber(draft.circuit_breaker_threshold, 0)}
              onChange={(e) =>
                updateDraft({ circuit_breaker_threshold: toNumber(e.target.value, 0) })
              }
            />
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-cb-window">
              {t("soc.vnbroker.circuit_breaker_window")}
            </label>
            <div className={styles.vnbFieldWithUnit}>
              <input
                id="vnb-cb-window"
                type="number"
                data-testid="vnb-field-circuit_breaker_window_seconds"
                className={styles.fieldInput}
                value={toNumber(draft.circuit_breaker_window_seconds, 0)}
                onChange={(e) =>
                  updateDraft({ circuit_breaker_window_seconds: toNumber(e.target.value, 0) })
                }
              />
              <span className={styles.fieldUnit}>s</span>
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-cb-cooldown">
              {t("soc.vnbroker.circuit_breaker_cooldown")}
            </label>
            <div className={styles.vnbFieldWithUnit}>
              <input
                id="vnb-cb-cooldown"
                type="number"
                data-testid="vnb-field-circuit_breaker_cooldown_seconds"
                className={styles.fieldInput}
                value={toNumber(draft.circuit_breaker_cooldown_seconds, 0)}
                onChange={(e) =>
                  updateDraft({ circuit_breaker_cooldown_seconds: toNumber(e.target.value, 0) })
                }
              />
              <span className={styles.fieldUnit}>s</span>
            </div>
          </div>

          <div className={`${styles.fieldRow} ${styles.vnbFormGridFull}`}>
            <label className={styles.fieldLabel} htmlFor="vnb-change-reason">
              {t("soc.vnbroker.change_reason")}
            </label>
            <input
              id="vnb-change-reason"
              type="text"
              data-testid="vnb-change-reason"
              className={styles.fieldInput}
              placeholder={t("soc.vnbroker.change_reason_placeholder")}
              value={changeReason}
              required
              aria-required="true"
              aria-invalid={!changeReason.trim()}
              aria-describedby="vnb-change-reason-help"
              onChange={(e) => {
                setChangeReason(e.target.value);
                setChangeReasonTouched(true);
              }}
            />
            <p
              id="vnb-change-reason-help"
              className={changeReasonTouched && !changeReason.trim() ? styles.fieldError : styles.metricLabel}
              role={changeReasonTouched && !changeReason.trim() ? "alert" : undefined}
            >
              {changeReasonTouched && !changeReason.trim()
                ? t("soc.vnbroker.change_reason_required")
                : t("soc.vnbroker.change_reason_hint")}
            </p>
          </div>
        </div>

        {/* Vùng live LUÔN có trong DOM (mount sẵn) — nếu render động thì
            screen reader bỏ qua (L-V04 / WCAG 4.1.3). Phần màu nằm BÊN TRONG
            để không để lại dải đỏ/vàng rỗng khi chưa có nội dung. */}
        <div role="alert" aria-live="assertive" data-testid="vnb-preview-errors">
          {previewErrors.length > 0 ? (
            <div className={styles.inlineError}>
              <div>{t("soc.config_preview.validation_errors")}</div>
              {previewErrors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          ) : null}
        </div>
        <div role="status" aria-live="polite" data-testid="vnb-preview-warnings">
          {previewWarnings.length > 0 ? (
            <div className={styles.vnbWarning}>
              <div>{t("soc.config_preview.impact_warnings")}</div>
              {previewWarnings.map((code) => (
                <div key={code}>⚠ {t(`soc.vnbroker.preview_warning_${code}`)}</div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.vnbToolbar}>
          <button
            type="button"
            className={styles.vnbActionBtn}
            data-testid="vnb-btn-preview"
            disabled={!canPreview}
            onClick={() => void handlePreview()}
          >
            {previewing ? t("soc.prefetch.loading") : t("soc.actions.preview")}
          </button>
          <button
            type="button"
            className={styles.vnbActionBtn}
            data-testid="vnb-btn-reset"
            onClick={() => void handleReset()}
          >
            {t("soc.vnbroker.reset_to_defaults")}
          </button>
        </div>
          </>
        )}
      </section>

      {/* ── 3. Quan sát ──────────────────────────────────────────────── */}
      <section className={styles.sectionCard} data-testid="vnb-observation">
        <div className={styles.toolbarRow}>
          <h3 className={styles.sectionCardTitle} style={{ margin: 0 }}>
            {t("soc.vnbroker.observation_title")}
          </h3>
          <button
            type="button"
            className={styles.vnbActionBtn}
            data-testid="vnb-btn-refresh"
            disabled={loadingRuntime}
            onClick={() => void loadRuntime()}
          >
            {loadingRuntime ? t("soc.prefetch.loading") : t("soc.vnbroker.refresh")}
          </button>
        </div>
        {providerHealthCheckedAt ? (
          <p className={styles.metricLabel} data-testid="vnb-runtime-updated">
            {t("soc.vnbroker.last_updated")}: {formatTime(providerHealthCheckedAt)}
          </p>
        ) : null}
        {runtimeError ? (
          <div className={styles.inlineError} role="alert" data-testid="vnb-runtime-error">
            {runtimeError}
          </div>
        ) : null}

        <div className={styles.metricGrid} aria-live="polite" data-testid="vnb-runtime-live">
          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.circuit_breaker_title")}</div>
            <div
              className={styles.metricValue}
              data-testid="vnb-cb-status"
              style={{ color: breakerOpen ? toneColor("danger") : toneColor("success") }}
            >
              {breakerOpen ? t("soc.vnbroker.breaker_tripped") : t("soc.vnbroker.breaker_closed")}
            </div>
            <div className={styles.vnbStatRow} data-testid="vnb-cb-failures">
              <span className={styles.vnbStatLabel}>{t("soc.vnbroker.breaker_failures")}</span>
              <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>
                {breaker?.failures ?? 0} / {breaker?.threshold ?? 0}
              </span>
            </div>
            {breaker?.source && breaker.source !== "runtime" ? (
              <div className={styles.metricLabel} data-testid="vnb-cb-source">
                {t("soc.vnbroker.circuit_breaker_source_unknown")}
              </div>
            ) : null}
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.health_title")}</div>
            <div className={styles.metricValue} data-testid="vnb-health-status">
              {t(`soc.vnbroker.provider_status_${health?.status || "unknown"}`)}
            </div>
            <div className={styles.vnbStatRow}>
              <span className={styles.vnbStatLabel}>{t("soc.vnbroker.last_check")}</span>
              <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>{formatTime(health?.last_check_at)}</span>
            </div>
            <div className={styles.vnbStatRow}>
              <span className={styles.vnbStatLabel}>{t("soc.vnbroker.consecutive_failures")}</span>
              <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>{health?.consecutive_failures ?? 0}</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.provider_health_title")}</div>
            {loadingRuntime && !providerHealth.length ? (
              <div
                className={`${styles.skeleton} ${styles.vnbSkeletonCard}`}
                aria-hidden="true"
              />
            ) : providerHealth.length ? (
              <>
                {providerHealth.map((row) => (
                  <div className={styles.vnbStatRow} key={row.provider}>
                    <span className={styles.vnbStatLabel}>{row.label || row.provider}</span>
                    <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>
                      {row.latency_ms == null ? "—" : `${row.latency_ms}ms`} ·{" "}
                      {row.success_rate == null ? "—" : `${row.success_rate}%`}
                    </span>
                  </div>
                ))}
                <div className={styles.vnbStatRow} data-testid="vnb-provider-health-source">
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.data_source")}</span>
                  <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>{providerHealthSource}</span>
                </div>
              </>
            ) : (
              <p className={styles.emptyState} data-testid="vnb-provider-health-empty">
                {t("soc.vnbroker.provider_health_unavailable")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 4. Benchmark ─────────────────────────────────────────────── */}
      <section className={styles.sectionCard} data-testid="vnb-benchmark">
        <h3 className={styles.sectionCardTitle}>{t("soc.vnbroker.benchmark_title")}</h3>

        <div className={styles.vnbToolbar}>
          <label className={styles.fieldLabel} htmlFor="vnb-benchmark-provider">
            {t("soc.vnbroker.benchmark_provider_label")}
          </label>
          <select
            id="vnb-benchmark-provider"
            className={`${styles.fieldInput} ${styles.vnbSelect}`}
            data-testid="vnb-benchmark-provider"
            value={benchmarkProvider}
            onChange={(e) => setBenchmarkProvider(e.target.value)}
          >
            <option value="all">{t("soc.vnbroker.all_providers")}</option>
            {catalog.map((entry) => (
              <option key={entry.provider} value={entry.provider}>
                {entry.label || entry.provider.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.vnbActionBtn}
            data-testid="vnb-btn-benchmark"
            disabled={benchmarkLoading}
            onClick={() => void handleRunBenchmark()}
          >
            {benchmarkLoading ? t("soc.vnbroker.running_benchmark") : t("soc.vnbroker.benchmark_run")}
          </button>
          {benchmark?.recommendation?.primary_provider ? (
            <button
              type="button"
              className={styles.vnbActionBtn}
              data-testid="vnb-btn-optimized"
              onClick={() => void applyOptimizedConfig()}
            >
              {t("soc.vnbroker.optimized_save")}
            </button>
          ) : null}
        </div>

        {benchmark?.recommendation?.primary_provider ? (
          <div className={styles.vnbStatRow} data-testid="vnb-benchmark-recommendation">
            <span className={styles.vnbStatLabel}>{t("soc.vnbroker.optimized_primary")}</span>
            <span className={`${styles.vnbStatValue} ${styles.vnbCellValue}`}>
              {benchmark.recommendation.primary_provider} ·{" "}
              {t("soc.vnbroker.optimized_fallback")}:{" "}
              {benchmark.recommendation.fallback_provider || "—"} ·{" "}
              {t("soc.vnbroker.optimized_concurrency")}:{" "}
              {benchmark.recommendation.adaptive_start_concurrency ?? "—"}
            </span>
          </div>
        ) : null}

        {benchmarkError ? (
          <div className={styles.inlineError} role="alert" data-testid="vnb-benchmark-error">
            {benchmarkError}
          </div>
        ) : null}

        {loadingBenchmark ? (
          <div
            className={`${styles.skeleton} ${styles.vnbSkeletonCard}`}
            aria-hidden="true"
            data-testid="vnb-benchmark-loading"
          />
        ) : benchmarkRows.length ? (
          <div className={styles.socDataTableWrap}>
            <table className={styles.socDataTable} data-testid="vnb-benchmark-table">
              <caption className={styles.metricLabel}>
                {t("soc.vnbroker.benchmark_table_caption")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_provider")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_concurrency")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_latency")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_rpm")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_success")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_rate_limited")}</th>
                  <th scope="col">{t("soc.vnbroker.benchmark_col_requests")}</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkRows.map((row) => (
                  <tr
                    key={`${row.provider}-${row.concurrency}`}
                    data-testid={`vnb-benchmark-row-${row.provider.toLowerCase()}-${row.concurrency}`}
                  >
                    <th scope="row">{row.provider}</th>
                    <td>{row.concurrency}</td>
                    <td>{`${row.latency_ms}ms`}</td>
                    <td>{row.rpm}</td>
                    <td>{`${row.success_rate}%`}</td>
                    <td>{`${row.rate_limit_pct}%`}</td>
                    <td>{row.total_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyState} data-testid="vnb-benchmark-empty">
            {t("soc.vnbroker.benchmark_no_report")}
          </p>
        )}
      </section>

      {/* ── 5. Quyền & nhật ký ───────────────────────────────────────── */}
      {ownership ? (
        <SocOwnershipBadge
          team={ownership.owner_team}
          writable={ownership.can_apply !== false}
          accessLevel={ownership.mode}
        />
      ) : loadingOwnership ? (
        <div
          className={`${styles.skeleton} ${styles.vnbSkeletonCard}`}
          aria-hidden="true"
          data-testid="vnb-ownership-loading"
        />
      ) : null}

      {previewOpen ? (
        <SocConfigPreviewModal
          before={savedConfig}
          after={draft}
          diff={previewDiff}
          validationErrors={previewErrors}
          impactWarnings={previewWarnings}
          confirmTestId="vnb-btn-apply-confirm"
          onConfirm={() => void handleApply()}
          onCancel={() => setPreviewOpen(false)}
          loading={applying}
        />
      ) : null}
    </div>
  );
}
