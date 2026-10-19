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

export function SocVnbrokerPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [configMeta, setConfigMeta] = useState<{
    service_key: string;
    applied_by: string;
    applied_at: string | null;
    change_reason: string;
  } | null>(null);
  const [savedConfig, setSavedConfig] = useState<VnbrokerConfigPayload>({});
  const [draft, setDraft] = useState<VnbrokerConfigPayload>({});

  const [primary, setPrimary] = useState("");
  const [fallback, setFallback] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<VnbrokerCatalogEntry[]>([]);
  const [providerHealth, setProviderHealth] = useState<VnbrokerProviderHealthRow[]>([]);
  const [providerHealthSource, setProviderHealthSource] = useState("unknown");
  const [health, setHealth] = useState<VnbrokerHealthSnapshot | null>(null);
  const [breaker, setBreaker] = useState<VnbrokerBreakerSnapshot | null>(null);
  const [benchmark, setBenchmark] = useState<VnbrokerBenchmarkReport | null>(null);
  const [ownership, setOwnership] = useState<VnbrokerOwnership | null>(null);

  const [changeReason, setChangeReason] = useState("");
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDiff, setPreviewDiff] = useState<DiffRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkProvider, setBenchmarkProvider] = useState("all");
  const [testingProvider, setTestingProvider] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // Mỗi endpoint độc lập: 1 nguồn lỗi không được làm sập cả panel.
    const [cfgRes, providersRes, healthRes, providerHealthRes, breakerRes, benchRes, ownRes] =
      await Promise.allSettled([
        vnbrokerAdapter.getSocVnbrokerConfig(),
        vnbrokerAdapter.getSocVnbrokerProviders(),
        vnbrokerAdapter.getSocVnbrokerHealth(),
        vnbrokerAdapter.getSocVnbrokerProviderHealth(),
        vnbrokerAdapter.getSocVnbrokerCircuitBreaker(),
        vnbrokerAdapter.getSocVnbrokerBenchmarkLatest(),
        vnbrokerAdapter.getSocVnbrokerOwnership(),
      ]);

    const firstError = [cfgRes, providersRes, healthRes].find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult | undefined;
    if (firstError) {
      setError(
        firstError.reason instanceof Error ? firstError.reason.message : String(firstError.reason),
      );
    }

    if (cfgRes.status === "fulfilled") {
      const payload = cfgRes.value.config || {};
      setConfigMeta({
        service_key: cfgRes.value.service_key,
        applied_by: cfgRes.value.applied_by,
        applied_at: cfgRes.value.applied_at,
        change_reason: cfgRes.value.change_reason,
      });
      setSavedConfig(payload);
      setDraft(payload);
    }
    if (providersRes.status === "fulfilled") {
      setPrimary(providersRes.value.primary || "");
      setFallback(providersRes.value.fallback || []);
      setCatalog(providersRes.value.providers || []);
    }
    if (healthRes.status === "fulfilled") setHealth(healthRes.value);
    if (providerHealthRes.status === "fulfilled") {
      setProviderHealth(providerHealthRes.value.providers || []);
      setProviderHealthSource(providerHealthRes.value.source || "unknown");
    }
    if (breakerRes.status === "fulfilled") setBreaker(breakerRes.value);
    if (benchRes.status === "fulfilled") setBenchmark(benchRes.value.report || null);
    if (ownRes.status === "fulfilled") setOwnership(ownRes.value);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = useCallback((patch: Partial<VnbrokerConfigPayload>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateTimeout = useCallback((key: keyof VnbrokerTimeout, value: number) => {
    setDraft((prev) => ({
      ...prev,
      timeout: { ...(prev.timeout || EMPTY_TIMEOUT), [key]: value },
    }));
  }, []);

  const toggleFallback = useCallback((provider: string) => {
    setDraft((prev) => {
      const current = prev.fallback_providers || [];
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return { ...prev, fallback_providers: next };
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

  const handlePreview = useCallback(async () => {
    if (!changeReason.trim()) return;
    try {
      setPreviewing(true);
      const result = await vnbrokerAdapter.previewSocVnbrokerConfig(compactPayload(draft));
      setPreviewErrors(result.validationErrors || []);
      setPreviewWarnings(result.impactWarnings || []);
      if ((result.validationErrors || []).length > 0) {
        setPreviewOpen(false);
        return;
      }
      setPreviewDiff(diffObjects(savedConfig, result.configPayload || draft));
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soc.vnbroker.preview_failed"));
    } finally {
      setPreviewing(false);
    }
  }, [changeReason, draft, savedConfig, toast, t]);

  const handleApply = useCallback(async () => {
    try {
      setApplying(true);
      await vnbrokerAdapter.applySocVnbrokerConfig(compactPayload(draft), {
        changeReason: changeReason.trim(),
        expectedUpdatedAt: configMeta?.applied_at || null,
      });
      setPreviewOpen(false);
      setChangeReason("");
      setPreviewErrors([]);
      setPreviewWarnings([]);
      toast.success(t("soc.vnbroker.apply_success"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soc.vnbroker.apply_failed"));
    } finally {
      setApplying(false);
    }
  }, [changeReason, configMeta, draft, load, toast, t]);

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
      toast.success(t("soc.vnbroker.reset_success"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soc.vnbroker.apply_failed"));
    }
  }, [confirm, load, toast, t]);

  const handleRunBenchmark = useCallback(async () => {
    setBenchmarkLoading(true);
    try {
      const payload = benchmarkProvider !== "all" ? { provider: benchmarkProvider } : {};
      const result = await vnbrokerAdapter.runSocVnbrokerBenchmark(payload);
      setBenchmark(result.report || null);
      if (!result.report) toast.info(t("soc.vnbroker.benchmark_no_report"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("soc.vnbroker.benchmark_failed"));
    } finally {
      setBenchmarkLoading(false);
    }
  }, [benchmarkProvider, toast, t]);

  const handleTestConnection = useCallback(
    async (provider: string) => {
      setTestingProvider(provider);
      try {
        const result = await vnbrokerAdapter.testSocVnbrokerConnection(provider);
        toast.success(
          `${t("soc.vnbroker.connection_success")} (${result.latency_ms ?? "—"}ms)`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("soc.vnbroker.connection_failed"));
      } finally {
        setTestingProvider("");
      }
    },
    [toast, t],
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
    setDraft(next);
    setChangeReason(t("soc.vnbroker.optimized_reason"));
    toast.info(t("soc.vnbroker.optimized_preview_warning"));
  }, [benchmark, draft, toast, t]);

  if (loading) {
    return (
      <div className={styles.glassPanel} data-testid="vnb-loading">
        <p className={styles.emptyState}>{t("soc.vnbroker.loading")}</p>
      </div>
    );
  }

  const breakerOpen = breaker?.status === "open" || breaker?.status === "tripped";
  const draftTimeout = draft.timeout || EMPTY_TIMEOUT;
  const benchmarkRows = benchmark?.results || [];

  return (
    <div className={styles.glassPanel} data-testid="vnb-console">
      {error ? (
        <div className={styles.inlineError} role="alert" data-testid="vnb-error">
          {error}
        </div>
      ) : null}

      {!canApply ? (
        <SocWriteGuardBanner
          owner={ownership?.owner_team}
          writer={ownership?.writer}
          surface={ownership?.write_surface}
        />
      ) : null}

      {/* ── 0. KPI strip ─────────────────────────────────────────────── */}
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
          <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_timeout")}</div>
          <div className={styles.metricValue} data-testid="vnb-kpi-timeout">
            {toNumber(draftTimeout.read, EMPTY_TIMEOUT.read as number)}s
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_rpm")}</div>
          <div className={styles.metricValue} data-testid="vnb-kpi-rpm">
            {toNumber(draft.requests_per_minute, 0)}
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{t("soc.vnbroker.kpi_retry")}</div>
          <div className={styles.metricValue} data-testid="vnb-kpi-retry">
            {toNumber(draft.max_retries, 0)}
          </div>
        </div>
      </div>

      {/* ── 1. Bộ nhà cung cấp ───────────────────────────────────────── */}
      <div className={styles.sectionCard} data-testid="vnb-providers">
        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.providers_title")}</div>
        <div className={styles.brokerTileGrid}>
          {catalog.map((entry) => {
            const role = roleOf(entry.provider);
            const row = healthByProvider.get(entry.provider);
            const ready = entry.runtime_ready;
            return (
              <div
                key={entry.provider}
                className={styles.vnbTile}
                data-testid={`vnb-provider-${entry.provider}`}
              >
                <div className={styles.vnbTileHead}>
                  <strong>{entry.label || entry.provider.toUpperCase()}</strong>
                  <span
                    className={`${styles.brokerBadge} ${
                      role === "primary"
                        ? styles.brokerBadgeOk
                        : role === "fallback"
                          ? styles.brokerBadgeWarn
                          : styles.brokerBadge
                    }`}
                    data-testid={`vnb-provider-${entry.provider}-role`}
                  >
                    {roleLabel(role)}
                  </span>
                </div>

                <div className={styles.brokerTileBadges}>
                  <span
                    className={styles.statusBadge}
                    style={getStatusBadgeStyle(ready ? "healthy" : "degraded")}
                  >
                    {ready ? t("soc.vnbroker.provider_ready") : t("soc.vnbroker.provider_not_ready")}
                  </span>
                  <span className={styles.domainPill}>{entry.credential_mode}</span>
                </div>

                <div
                  className={`${styles.vnbStatRow} ${styles.vnbReadiness}`}
                  data-testid={`vnb-provider-${entry.provider}-readiness`}
                >
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.readiness")}</span>
                  <span className={styles.vnbStatValue}>
                    {entry.readiness_reason || entry.runtime_gate}
                  </span>
                </div>
                {entry.required_runtime_envs.length ? (
                  <div className={styles.brokerTileBadges}>
                    {entry.required_runtime_envs.map((env) => (
                      <span key={env} className={styles.domainPill}>
                        {env}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className={styles.vnbStatRow}>
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.latency")}</span>
                  <span className={styles.vnbStatValue}>
                    {row?.latency_ms == null ? "—" : `${row.latency_ms}ms`}
                  </span>
                </div>
                <div className={styles.vnbStatRow}>
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.success_rate")}</span>
                  <span className={styles.vnbStatValue}>
                    {row?.success_rate == null ? "—" : `${row.success_rate}%`}
                  </span>
                </div>
                <div className={styles.vnbStatRow}>
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.last_check")}</span>
                  <span className={styles.vnbStatValue}>
                    {row?.last_success_at ? formatTime(row.last_success_at) : "—"}
                  </span>
                </div>

                <div className={styles.brokerTileBadges}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={testingProvider === entry.provider}
                    onClick={() => void handleTestConnection(entry.provider)}
                  >
                    {testingProvider === entry.provider
                      ? t("soc.vnbroker.testing_connection")
                      : t("soc.vnbroker.test_connection")}
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      updateDraft({ preferred_provider: entry.provider });
                      setChangeReason(t("soc.vnbroker.change_reason_primary", { provider: entry.provider }));
                    }}
                  >
                    {t("soc.vnbroker.set_primary")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. Cấu hình ──────────────────────────────────────────────── */}
      <div className={styles.sectionCard} data-testid="vnb-config-form">
        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.core_config_title")}</div>

        <div className={styles.fieldGrid}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="vnb-preferred-provider">
              {t("soc.vnbroker.preferred_provider")}
            </label>
            <select
              id="vnb-preferred-provider"
              data-testid="vnb-field-preferred_provider"
              className={styles.fieldInput}
              value={draft.preferred_provider || ""}
              onChange={(e) => updateDraft({ preferred_provider: e.target.value })}
            >
              {catalog.map((entry) => (
                <option key={entry.provider} value={entry.provider}>
                  {entry.label || entry.provider.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>{t("soc.vnbroker.fallback_providers")}</span>
            <div className={styles.brokerTileBadges}>
              {catalog.map((entry) => (
                <label key={entry.provider} className={styles.domainPill}>
                  <input
                    type="checkbox"
                    data-testid={`vnb-field-fallback-${entry.provider}`}
                    checked={(draft.fallback_providers || []).includes(entry.provider)}
                    onChange={() => toggleFallback(entry.provider)}
                  />{" "}
                  {entry.label || entry.provider.toUpperCase()}
                </label>
              ))}
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
        </div>

        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.timeout_section")}</div>
        <div className={styles.fieldGrid}>
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
        </div>

        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.retry_section")}</div>
        <div className={styles.fieldGrid}>
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
        </div>

        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.rate_limit_section")}</div>
        <div className={styles.fieldGrid}>
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
        </div>

        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.circuit_breaker_title")}</div>
        <div className={styles.fieldGrid}>
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
        </div>

        <div className={styles.fieldRow}>
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
            onChange={(e) => setChangeReason(e.target.value)}
          />
          {!changeReason.trim() ? (
            <p className={styles.fieldError}>{t("soc.vnbroker.change_reason_required")}</p>
          ) : null}
        </div>

        {previewErrors.length ? (
          <div className={styles.inlineError} role="alert" data-testid="vnb-preview-errors">
            <div>{t("soc.config_preview.validation_errors")}</div>
            {previewErrors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        ) : null}

        {previewWarnings.length ? (
          <div className={styles.inlineError} role="status" data-testid="vnb-preview-warnings">
            <div>{t("soc.config_preview.impact_warnings")}</div>
            {previewWarnings.map((code) => (
              <div key={code}>⚠ {t(`soc.vnbroker.preview_warning_${code}`)}</div>
            ))}
          </div>
        ) : null}

        <div className={styles.brokerTileBadges}>
          <button
            type="button"
            className={styles.actionBtn}
            data-testid="vnb-btn-preview"
            disabled={previewing || !changeReason.trim()}
            onClick={() => void handlePreview()}
          >
            {previewing ? t("soc.prefetch.loading") : t("soc.actions.preview")}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            data-testid="vnb-btn-reset"
            onClick={() => void handleReset()}
          >
            {t("soc.vnbroker.reset_to_defaults")}
          </button>
        </div>
      </div>

      {/* ── 3. Quan sát ──────────────────────────────────────────────── */}
      <div className={styles.sectionCard} data-testid="vnb-observation">
        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.observation_title")}</div>

        <div className={styles.fieldGrid}>
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
              <span className={styles.vnbStatValue}>
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
              {health?.status || "unknown"}
            </div>
            <div className={styles.vnbStatRow}>
              <span className={styles.vnbStatLabel}>{t("soc.vnbroker.last_check")}</span>
              <span className={styles.vnbStatValue}>{formatTime(health?.last_check_at)}</span>
            </div>
            <div className={styles.vnbStatRow}>
              <span className={styles.vnbStatLabel}>{t("soc.vnbroker.consecutive_failures")}</span>
              <span className={styles.vnbStatValue}>{health?.consecutive_failures ?? 0}</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricLabel}>{t("soc.vnbroker.provider_health_title")}</div>
            {providerHealth.length ? (
              <>
                {providerHealth.map((row) => (
                  <div className={styles.vnbStatRow} key={row.provider}>
                    <span className={styles.vnbStatLabel}>{row.label || row.provider}</span>
                    <span className={styles.vnbStatValue}>
                      {row.latency_ms == null ? "—" : `${row.latency_ms}ms`} ·{" "}
                      {row.success_rate == null ? "—" : `${row.success_rate}%`}
                    </span>
                  </div>
                ))}
                <div className={styles.vnbStatRow} data-testid="vnb-provider-health-source">
                  <span className={styles.vnbStatLabel}>{t("soc.vnbroker.last_check")}</span>
                  <span className={styles.vnbStatValue}>{providerHealthSource}</span>
                </div>
              </>
            ) : (
              <div className={styles.metricLabel} data-testid="vnb-provider-health-empty">
                {t("soc.vnbroker.provider_health_unavailable")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Benchmark ─────────────────────────────────────────────── */}
      <div className={styles.sectionCard} data-testid="vnb-benchmark">
        <div className={styles.sectionCardTitle}>{t("soc.vnbroker.benchmark_title")}</div>

        <div className={styles.brokerTileBadges}>
          <select
            className={styles.fieldInput}
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
            className={styles.actionBtn}
            data-testid="vnb-btn-benchmark"
            disabled={benchmarkLoading}
            onClick={() => void handleRunBenchmark()}
          >
            {benchmarkLoading ? t("soc.vnbroker.running_benchmark") : t("soc.vnbroker.benchmark_run")}
          </button>
          {benchmark?.recommendation?.primary_provider ? (
            <button
              type="button"
              className={styles.actionBtn}
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
            <span className={styles.vnbStatValue}>
              {benchmark.recommendation.primary_provider} ·{" "}
              {t("soc.vnbroker.optimized_fallback")}:{" "}
              {benchmark.recommendation.fallback_provider || "—"} ·{" "}
              {t("soc.vnbroker.optimized_concurrency")}:{" "}
              {benchmark.recommendation.adaptive_start_concurrency ?? "—"}
            </span>
          </div>
        ) : null}

        {benchmarkRows.length ? (
          <div className={styles.socDataTableWrap}>
            <table className={styles.socDataTable} data-testid="vnb-benchmark-table">
              <thead>
                <tr>
                  <th>{t("soc.vnbroker.benchmark_col_provider")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_concurrency")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_latency")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_rpm")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_success")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_rate_limited")}</th>
                  <th>{t("soc.vnbroker.benchmark_col_requests")}</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkRows.map((row) => (
                  <tr
                    key={`${row.provider}-${row.concurrency}`}
                    data-testid={`vnb-benchmark-row-${row.provider.toLowerCase()}-${row.concurrency}`}
                  >
                    <td>{row.provider}</td>
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
      </div>

      {/* ── 5. Quyền & nhật ký ───────────────────────────────────────── */}
      {ownership ? (
        <SocOwnershipBadge
          team={ownership.owner_team}
          writable={ownership.can_apply !== false}
          accessLevel={ownership.mode}
        />
      ) : null}

      {configMeta ? (
        <div className={styles.vnbStatRow} data-testid="vnb-config-meta">
          <span className={styles.vnbStatLabel}>{t("soc.vnbroker.applied_by")}</span>
          <span className={styles.vnbStatValue}>
            {configMeta.applied_by || "—"} · {formatTime(configMeta.applied_at)}
          </span>
        </div>
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
