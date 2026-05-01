import { useCallback, useEffect, useState } from 'react';
import {
  applyAdminSignalsUniverse,
  getAdminSignalJobs,
  getAdminSignalRecentEvents,
  getAdminSignalsConfig,
  getAdminSignalsSummary,
  previewAdminSignalMaterialization,
  previewAdminSignalRetention,
  previewAdminSignalsConfig,
  previewAdminSignalsUniverse,
  retryAdminSignalJob,
  runAdminSignalJob,
  updateAdminSignalsConfig,
} from '../../api/client';
import { useI18n } from '../../context/LangContext';
import PaginationBar from '../shared/PaginationBar';

const DEFAULT_PAGE_SIZE = 10;

function formatDateTimeValue(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('vi-VN');
}

function formatNumberValue(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat('vi-VN').format(numeric);
}

function resolvePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function statusTone(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (normalized === 'PARTIAL') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  if (normalized === 'FAILED') return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
  if (normalized === 'RUNNING') return 'border-sky-500/40 bg-sky-500/10 text-sky-300';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

function ServiceSummaryCard({ title, summary, enabled, t }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {enabled ? t('adminOps.signalCenterServiceEnabled', { defaultValue: 'Đang bật' }) : t('adminOps.signalCenterServiceDisabled', { defaultValue: 'Đang tắt' })}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
          {enabled ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' })}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterRecentEvents24h', { defaultValue: 'Sự kiện 24h' })}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumberValue(summary?.recent_event_count_24h)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterTotalEvents', { defaultValue: 'Tổng sự kiện' })}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumberValue(summary?.total_event_count)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterLastSuccess', { defaultValue: 'Lần chạy thành công gần nhất' })}</p>
          <p className="mt-2 text-sm font-medium text-slate-200">{formatDateTimeValue(summary?.last_successful_run?.finished_at || summary?.last_successful_run?.created_at)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterLastFailure', { defaultValue: 'Lần lỗi gần nhất' })}</p>
          <p className="mt-2 text-sm font-medium text-slate-200">{formatDateTimeValue(summary?.last_failed_run?.finished_at || summary?.last_failed_run?.created_at)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>{t('adminOps.signalCenterLatestEvent', { defaultValue: 'Sự kiện mới nhất' })}: {summary?.latest_event?.symbol || '—'}</span>
        <span>{t('adminOps.freshness', { defaultValue: 'Freshness' })}: {formatDateTimeValue(summary?.cache_freshness?.cached_at)}</span>
      </div>
    </div>
  );
}

function JsonPreview({ title, payload, emptyText }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {payload ? JSON.stringify(payload, null, 2) : emptyText}
      </pre>
    </div>
  );
}

function BoundaryPanel({ title, ownerLabel, modeLabel, statusLabel, items, payload, emptyText, note }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-[0_16px_48px_rgba(2,6,23,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">{note}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">{ownerLabel}</span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">{modeLabel}</span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">{statusLabel}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <pre className="max-h-64 overflow-auto p-3 text-xs text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {payload ? JSON.stringify(payload, null, 2) : emptyText}
        </pre>
      </div>
    </div>
  );
}

function formatAuditWarning(warning) {
  if (warning && typeof warning === 'object') {
    const fieldLabel = warning.field ? `${warning.field}: ` : '';
    return `${fieldLabel}${warning.message || 'Cảnh báo ngưng dùng'}`;
  }
  return String(warning ?? 'Cảnh báo ngưng dùng');
}

export default function SignalControlCenter() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsPageSize, setJobsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize, setEventsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [retentionPreview, setRetentionPreview] = useState(null);
  const [materializationPreview, setMaterializationPreview] = useState(null);
  const [configPreview, setConfigPreview] = useState(null);
  const [universePreview, setUniversePreview] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [jobSymbol, setJobSymbol] = useState('');
  const [form, setForm] = useState({
    whaleEnabled: true,
    whaleThreshold: '500000000',
    whaleCooldown: '120',
    darkFlowEnabled: true,
    darkFlowWindow: '300',
    darkFlowWarning: '40',
    darkFlowUrgent: '70',
    darkFlowCooldown: '300',
    websocketEnabled: true,
    historyEnabled: true,
    fanoutBatchSize: '200',
    intradayTickKeepDays: '7',
    whaleEventKeepDays: '90',
    darkFlowKeepDays: '90',
    includeTrackedSymbols: true,
    includeWatchlistSymbols: true,
    includeAlertSymbols: true,
    includePortfolioSymbols: true,
    includeGroupSymbols: false,
    adminSymbols: '',
  });
  const ownershipSnapshot = configPreview?.ownership || summary?.ownership || null;
  const whaleGovernanceSnapshot = summary?.whale_governance || null;
  const rawIntradayKeepDays = retentionPreview?.raw_intraday?.keep_days ?? null;
  const lifecycle = summary?.lifecycle || {};
  const sharedLifecyclePayload = summary ? {
    effective_owner_matrix: lifecycle.effective_owner_matrix || null,
    tiers: lifecycle.tiers || null,
    materialization_lag: lifecycle.materialization_lag || null,
    anomaly_backlog: lifecycle.anomaly_backlog || null,
    deprecation_warnings: lifecycle.deprecation_warnings || [],
  } : null;
  const materializationPanelPayload = materializationPreview ? {
    preview: materializationPreview.preview || null,
    effective_owner: materializationPreview.effective_owner || null,
    effective_values: materializationPreview.effective_values || null,
    diff: materializationPreview.diff || null,
    impacted_counts: materializationPreview.impacted_counts || null,
    freshness: materializationPreview.freshness || null,
    warnings: materializationPreview.effective_value_warnings || [],
  } : null;
  const storageRetentionPanelPayload = retentionPreview ? {
    retention_preview: retentionPreview,
    storage_tiers: lifecycle.tiers || null,
    freshness: summary?.cache_freshness || null,
  } : null;
  const whaleGovernancePanel = whaleGovernanceSnapshot ? {
    title: t('adminOps.signalCenterWhaleGovernancePanelTitle', { defaultValue: 'Phân ranh whale governance' }),
    ownerLabel: t('adminOps.signalCenterWhaleGovernanceOwner', { defaultValue: 'Whale mission-control' }),
    modeLabel: t('adminOps.signalCenterWhaleGovernanceMode', { defaultValue: 'Write-through bridge' }),
    statusLabel: whaleGovernanceSnapshot?.active_rollout?.status || t('adminOps.none', { defaultValue: 'Chưa có' }),
    note: t('adminOps.signalCenterWhaleGovernanceNote', { defaultValue: 'Whale policy đi qua pending/draft bridge và chỉ active publish sau approval từ mission-control.' }),
    items: [
      {
        label: t('adminOps.signalCenterWhaleActiveVersion', { defaultValue: 'Phiên bản active' }),
        value: whaleGovernanceSnapshot?.active_version?.version_code || '—',
      },
      {
        label: t('adminOps.signalCenterWhaleRolloutStatus', { defaultValue: 'Trạng thái rollout' }),
        value: whaleGovernanceSnapshot?.active_rollout?.status || '—',
      },
      {
        label: t('adminOps.signalCenterWhalePropagationSignal', { defaultValue: 'Propagation' }),
        value: whaleGovernanceSnapshot?.propagation?.signal || '—',
      },
    ],
    payload: whaleGovernanceSnapshot,
  } : null;
  const darkFlowPolicyPanel = summary?.services?.dark_flow ? {
    title: t('adminOps.signalCenterDarkFlowPolicyPanelTitle', { defaultValue: 'Phân ranh dark flow policy' }),
    ownerLabel: t('adminOps.signalCenterDarkFlowOwner', { defaultValue: 'Signal Control Center' }),
    modeLabel: t('adminOps.signalCenterDarkFlowMode', { defaultValue: 'Direct writer' }),
    statusLabel: summary?.services?.dark_flow?.enabled ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' }),
    note: t('adminOps.signalCenterDarkFlowPolicyNote', { defaultValue: 'Dark-flow policy ghi trực tiếp qua control center, không đi qua whale bridge.' }),
    items: [
      {
        label: t('adminOps.signalCenterDarkFlowPendingRuns', { defaultValue: 'Pending runs' }),
        value: formatNumberValue(summary?.services?.dark_flow?.pending_run_count),
      },
      {
        label: t('adminOps.signalCenterDarkFlowFreshness', { defaultValue: 'Freshness' }),
        value: summary?.services?.dark_flow?.materialization?.freshness_state || '—',
      },
      {
        label: t('adminOps.signalCenterDarkFlowAnomalies', { defaultValue: 'Anomaly backlog' }),
        value: formatNumberValue(summary?.services?.dark_flow?.anomaly_markers?.length),
      },
    ],
    payload: {
      materialization: summary?.services?.dark_flow?.materialization || null,
      session_summary: summary?.services?.dark_flow?.session_summary || null,
      anomaly_markers: summary?.services?.dark_flow?.anomaly_markers || [],
      pending_run_count: summary?.services?.dark_flow?.pending_run_count ?? 0,
    },
  } : null;
  const auditWarnings = Array.from(new Set([
    ...(sharedLifecyclePayload?.deprecation_warnings || []),
    ...(materializationPanelPayload?.warnings || []),
  ].filter(Boolean)));

  const applyConfigToForm = useCallback((payload, retentionPreviewPayload = null) => {
    const servicesConfig = payload?.services_config || {};
    const whaleService = servicesConfig?.whale_service || {};
    const darkFlowService = servicesConfig?.dark_flow_service || {};
    const distribution = servicesConfig?.distribution || {};
    const retentionPolicy = payload?.retention_policy || {};
    const runtimeKeepDays = retentionPreviewPayload?.raw_intraday?.keep_days ?? retentionPolicy.raw_intraday_keep_days ?? 7;
    const universePolicy = payload?.universe_policy || {};

    setForm({
      whaleEnabled: Boolean(whaleService.enabled ?? true),
      whaleThreshold: String(whaleService.default_threshold_vnd ?? 500000000),
      whaleCooldown: String(whaleService.cooldown_seconds ?? 120),
      darkFlowEnabled: Boolean(darkFlowService.enabled ?? true),
      darkFlowWindow: String(darkFlowService.window_seconds ?? 300),
      darkFlowWarning: String(darkFlowService.warning_strength ?? 40),
      darkFlowUrgent: String(darkFlowService.urgent_strength ?? 70),
      darkFlowCooldown: String(darkFlowService.cooldown_seconds ?? 300),
      websocketEnabled: Boolean(distribution.websocket_enabled ?? true),
      historyEnabled: Boolean(distribution.history_enabled ?? true),
      fanoutBatchSize: String(distribution.fanout_batch_size ?? 200),
      intradayTickKeepDays: String(runtimeKeepDays),
      whaleEventKeepDays: String(retentionPolicy.whale_event_keep_days ?? 90),
      darkFlowKeepDays: String(retentionPolicy.dark_flow_keep_days ?? 90),
      includeTrackedSymbols: Boolean(universePolicy.include_tracked_symbols ?? true),
      includeWatchlistSymbols: Boolean(universePolicy.include_watchlist_symbols ?? true),
      includeAlertSymbols: Boolean(universePolicy.include_alert_symbols ?? true),
      includePortfolioSymbols: Boolean(universePolicy.include_portfolio_symbols ?? true),
      includeGroupSymbols: Boolean(universePolicy.include_group_symbols ?? false),
      adminSymbols: Array.isArray(universePolicy.admin_symbols) ? universePolicy.admin_symbols.join(', ') : '',
    });
  }, []);

  const loadStaticData = useCallback(async () => {
    const [summaryRes, configRes, retentionRes, materializationRes] = await Promise.all([
      getAdminSignalsSummary(),
      getAdminSignalsConfig(),
      previewAdminSignalRetention({}),
      previewAdminSignalMaterialization({}),
    ]);
    setSummary(summaryRes.data || null);
    applyConfigToForm(configRes.data || null, retentionRes.data?.preview || null);
    setRetentionPreview(retentionRes.data?.preview || null);
    setMaterializationPreview(materializationRes.data || null);
  }, [applyConfigToForm]);

  const loadJobsPage = useCallback(async (page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
    setJobsLoading(true);
    try {
      const jobsRes = await getAdminSignalJobs({
        page,
        page_size: pageSize,
      });
      const results = Array.isArray(jobsRes.data?.results) ? jobsRes.data.results : [];
      setJobs(results);
      setJobsTotal(resolvePositiveInteger(jobsRes.data?.count, results.length));
      setJobsPage(resolvePositiveInteger(jobsRes.data?.page, page));
      setJobsPageSize(resolvePositiveInteger(jobsRes.data?.page_size, pageSize));
      setJobsLoaded(true);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadEventsPage = useCallback(async (page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
    setEventsLoading(true);
    try {
      const eventsRes = await getAdminSignalRecentEvents({
        domain: 'all',
        page,
        page_size: pageSize,
      });
      const results = Array.isArray(eventsRes.data?.results) ? eventsRes.data.results : [];
      setEvents(results);
      setEventsTotal(resolvePositiveInteger(eventsRes.data?.count, results.length));
      setEventsPage(resolvePositiveInteger(eventsRes.data?.page, page));
      setEventsPageSize(resolvePositiveInteger(eventsRes.data?.page_size, pageSize));
      setEventsLoaded(true);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const refreshControlCenter = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      await loadStaticData();
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [loadStaticData, t]);

  useEffect(() => {
    const loadInitialState = async () => {
      setLoading(true);
      try {
        await loadStaticData();
      } catch (error) {
        setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
      } finally {
        setLoading(false);
      }
    };

    void loadInitialState();
  }, [loadStaticData, t]);

  const handleLoadJobs = useCallback(async () => {
    setMessage('');
    try {
      await loadJobsPage(1, DEFAULT_PAGE_SIZE);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [loadJobsPage, t]);

  const handleLoadEvents = useCallback(async () => {
    setMessage('');
    try {
      await loadEventsPage(1, DEFAULT_PAGE_SIZE);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [loadEventsPage, t]);

  const updateField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const buildServicesPayload = useCallback(() => ({
    whale_service: {
      enabled: Boolean(form.whaleEnabled),
      default_threshold_vnd: Number(form.whaleThreshold || 0),
      cooldown_seconds: Number(form.whaleCooldown || 0),
    },
    dark_flow_service: {
      enabled: Boolean(form.darkFlowEnabled),
      window_seconds: Number(form.darkFlowWindow || 0),
      warning_strength: Number(form.darkFlowWarning || 0),
      urgent_strength: Number(form.darkFlowUrgent || 0),
      cooldown_seconds: Number(form.darkFlowCooldown || 0),
    },
    distribution: {
      websocket_enabled: Boolean(form.websocketEnabled),
      history_enabled: Boolean(form.historyEnabled),
      fanout_batch_size: Number(form.fanoutBatchSize || 0),
    },
  }), [form]);

  const buildRetentionPayload = useCallback(() => ({
    whale_event_keep_days: Number(form.whaleEventKeepDays || 0),
    dark_flow_keep_days: Number(form.darkFlowKeepDays || 0),
  }), [form]);

  const buildUniversePayload = useCallback(() => ({
    include_tracked_symbols: Boolean(form.includeTrackedSymbols),
    include_watchlist_symbols: Boolean(form.includeWatchlistSymbols),
    include_alert_symbols: Boolean(form.includeAlertSymbols),
    include_portfolio_symbols: Boolean(form.includePortfolioSymbols),
    include_group_symbols: Boolean(form.includeGroupSymbols),
    admin_symbols: String(form.adminSymbols || '')
      .split(/[\n,]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  }), [form]);

  const handlePreviewConfig = useCallback(async () => {
    setBusyAction('preview-config');
    setMessage('');
    try {
      const response = await previewAdminSignalsConfig({
        services_config: buildServicesPayload(),
        retention_policy: buildRetentionPayload(),
        universe_policy: buildUniversePayload(),
      });
      setConfigPreview(response.data || null);
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterPreviewFailed', { defaultValue: 'Không xem trước được cấu hình signals.' }));
    } finally {
      setBusyAction('');
    }
  }, [buildRetentionPayload, buildServicesPayload, buildUniversePayload, t]);

  const handleApplyConfig = useCallback(async () => {
    setBusyAction('apply-config');
    setMessage('');
    try {
      await updateAdminSignalsConfig({
        services_config: buildServicesPayload(),
        retention_policy: buildRetentionPayload(),
      });
      setMessage(t('adminOps.signalCenterConfigApplied', { defaultValue: 'Đã áp dụng cấu hình services và retention.' }));
      await refreshControlCenter({ silent: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterApplyFailed', { defaultValue: 'Không áp dụng được cấu hình signals.' }));
    } finally {
      setBusyAction('');
    }
  }, [buildRetentionPayload, buildServicesPayload, refreshControlCenter, t]);

  const handlePreviewUniverse = useCallback(async () => {
    setBusyAction('preview-universe');
    setMessage('');
    try {
      const response = await previewAdminSignalsUniverse(buildUniversePayload());
      setUniversePreview(response.data || null);
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterUniversePreviewFailed', { defaultValue: 'Không xem trước được universe policy.' }));
    } finally {
      setBusyAction('');
    }
  }, [buildUniversePayload, t]);

  const handleApplyUniverse = useCallback(async () => {
    if (!window.confirm(t('adminOps.signalCenterUniverseApplyConfirm', { defaultValue: 'Áp dụng universe policy này?' }))) {
      return;
    }

    setBusyAction('apply-universe');
    setMessage('');
    try {
      const response = await applyAdminSignalsUniverse({ confirm: true, policy: buildUniversePayload() });
      setUniversePreview(response.data || null);
      setMessage(t('adminOps.signalCenterUniverseApplied', { defaultValue: 'Đã áp dụng universe policy.' }));
      await refreshControlCenter({ silent: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterUniverseApplyFailed', { defaultValue: 'Không áp dụng được universe policy.' }));
    } finally {
      setBusyAction('');
    }
  }, [buildUniversePayload, refreshControlCenter, t]);

  const handleRunJob = useCallback(async (serviceDomain) => {
    setBusyAction(`run-${serviceDomain}`);
    setMessage('');
    try {
      await runAdminSignalJob({
        service_domain: serviceDomain,
        symbol: String(jobSymbol || '').trim().toUpperCase() || undefined,
      });
      setMessage(t('adminOps.signalCenterJobQueued', { defaultValue: 'Đã xếp hàng tác vụ signal.' }));
      await refreshControlCenter({ silent: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterJobQueueFailed', { defaultValue: 'Không xếp được tác vụ signal.' }));
    } finally {
      setBusyAction('');
    }
  }, [jobSymbol, refreshControlCenter, t]);

  const handleRetryRun = useCallback(async (runId) => {
    setBusyAction(`retry-${runId}`);
    setMessage('');
    try {
      await retryAdminSignalJob(runId);
      setMessage(t('adminOps.signalCenterRetryQueued', { defaultValue: 'Đã xếp hàng retry signal run.' }));
      await refreshControlCenter({ silent: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || t('adminOps.signalCenterRetryFailed', { defaultValue: 'Không retry được signal run.' }));
    } finally {
      setBusyAction('');
    }
  }, [refreshControlCenter, t]);

  const handleJobsPageChange = useCallback(async (nextPage) => {
    setMessage('');
    try {
      await loadJobsPage(nextPage, jobsPageSize);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [jobsPageSize, loadJobsPage, t]);

  const handleJobsPageSizeChange = useCallback(async (nextPageSize) => {
    setMessage('');
    try {
      await loadJobsPage(1, nextPageSize);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [loadJobsPage, t]);

  const handleEventsPageChange = useCallback(async (nextPage) => {
    setMessage('');
    try {
      await loadEventsPage(nextPage, eventsPageSize);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [eventsPageSize, loadEventsPage, t]);

  const handleEventsPageSizeChange = useCallback(async (nextPageSize) => {
    setMessage('');
    try {
      await loadEventsPage(1, nextPageSize);
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.response?.data?.detail || t('adminOps.unknownError'));
    }
  }, [loadEventsPage, t]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
        {t('adminOps.loading', { defaultValue: 'Đang tải...' })}
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">{t('adminOps.signalCenterEyebrow', { defaultValue: 'Trung tâm dòng tiền' })}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100">{t('adminOps.signalCenterTitle', { defaultValue: 'Vận hành whale, dark flow và lifecycle' })}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{t('adminOps.signalCenterDescription', { defaultValue: 'Một surface vận hành thống nhất cho summary, preview/apply, manual run, recent events và retention/materialization của hai global detector.' })}</p>
        </div>
        <button
          type="button"
          onClick={() => refreshControlCenter()}
          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
        >
          {t('adminOps.refresh', { defaultValue: 'Làm mới' })}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-200">{message}</div>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ServiceSummaryCard
          title={t('adminOps.signalCenterWhaleTitle', { defaultValue: 'Whale Alerts Global Service' })}
          summary={summary?.services?.whale}
          enabled={Boolean(summary?.services?.whale?.enabled)}
          t={t}
        />
        <ServiceSummaryCard
          title={t('adminOps.signalCenterDarkFlowTitle', { defaultValue: 'Dark Flow Global Service' })}
          summary={summary?.services?.dark_flow}
          enabled={Boolean(summary?.services?.dark_flow?.enabled)}
          t={t}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <JsonPreview
          title={t('adminOps.signalCenterSharedLifecycleTitle', { defaultValue: 'Vòng đời dùng chung' })}
          payload={sharedLifecyclePayload}
          emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
        />
        <JsonPreview
          title={t('adminOps.signalCenterMaterializationTitle', { defaultValue: 'Vật hoá dữ liệu' })}
          payload={materializationPanelPayload}
          emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
        />
        <JsonPreview
          title={t('adminOps.signalCenterStorageRetentionTitle', { defaultValue: 'Lưu trữ và lưu giữ' })}
          payload={storageRetentionPanelPayload}
          emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {whaleGovernancePanel ? (
          <BoundaryPanel
            title={whaleGovernancePanel.title}
            ownerLabel={whaleGovernancePanel.ownerLabel}
            modeLabel={whaleGovernancePanel.modeLabel}
            statusLabel={whaleGovernancePanel.statusLabel}
            items={whaleGovernancePanel.items}
            payload={whaleGovernancePanel.payload}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
            note={whaleGovernancePanel.note}
          />
        ) : null}
        {darkFlowPolicyPanel ? (
          <BoundaryPanel
            title={darkFlowPolicyPanel.title}
            ownerLabel={darkFlowPolicyPanel.ownerLabel}
            modeLabel={darkFlowPolicyPanel.modeLabel}
            statusLabel={darkFlowPolicyPanel.statusLabel}
            items={darkFlowPolicyPanel.items}
            payload={darkFlowPolicyPanel.payload}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
            note={darkFlowPolicyPanel.note}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterDistributionTitle', { defaultValue: 'Distribution và operator state' })}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('adminOps.signalCenterDistributionDescription', { defaultValue: 'Hiển thị global enablement, delivery switches và các nguồn audience đang đóng góp vào effective universe.' })}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${Boolean(summary?.celery?.alive) ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/40 bg-rose-500/10 text-rose-300'}`}>
            {t('adminOps.signalCenterCeleryAlive', { defaultValue: 'Celery alive' })}: {Boolean(summary?.celery?.alive) ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.fail', { defaultValue: 'FAIL' })}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterGlobalSwitch', { defaultValue: 'Global switch' })}</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{summary?.services?.enabled ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' })}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterWebsocketEnabled', { defaultValue: 'Bật websocket fan-out' })}</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{form.websocketEnabled ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' })}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterHistoryEnabled', { defaultValue: 'Bật UserAlertHistory' })}</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{form.historyEnabled ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' })}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterFanoutBatch', { defaultValue: 'Fan-out batch size' })}</p>
            <p className="mt-2 text-lg font-semibold text-slate-100">{formatNumberValue(form.fanoutBatchSize)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{t('adminOps.signalCenterIncludeTracked', { defaultValue: 'Gộp tracked symbols' })}: <span className="font-semibold text-slate-100">{form.includeTrackedSymbols ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.none', { defaultValue: 'Chưa có' })}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{t('adminOps.signalCenterIncludeWatchlist', { defaultValue: 'Gộp watchlist symbols' })}: <span className="font-semibold text-slate-100">{form.includeWatchlistSymbols ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.none', { defaultValue: 'Chưa có' })}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{t('adminOps.signalCenterIncludeAlerts', { defaultValue: 'Gộp price alerts' })}: <span className="font-semibold text-slate-100">{form.includeAlertSymbols ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.none', { defaultValue: 'Chưa có' })}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{t('adminOps.signalCenterIncludePortfolio', { defaultValue: 'Gộp symbols từ giao dịch' })}: <span className="font-semibold text-slate-100">{form.includePortfolioSymbols ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.none', { defaultValue: 'Chưa có' })}</span></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">{t('adminOps.signalCenterIncludeGroups', { defaultValue: 'Bật curated group universe' })}: <span className="font-semibold text-slate-100">{form.includeGroupSymbols ? t('adminOps.ok', { defaultValue: 'OK' }) : t('adminOps.none', { defaultValue: 'Chưa có' })}</span></div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterConfigTitle', { defaultValue: 'Services, retention và ownership' })}</h3>
          {ownershipSnapshot?.deprecation_notes?.length ? (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-6 text-amber-100">
              <p className="font-semibold uppercase tracking-[0.16em] text-amber-200">{t('adminOps.signalCenterOwnershipWarningTitle', { defaultValue: 'Cảnh báo chủ sở hữu và ngưng dùng' })}</p>
              <ul className="mt-2 space-y-1">
                {ownershipSnapshot.deprecation_notes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{t('adminOps.signalCenterWhaleEnabled', { defaultValue: 'Bật whale service' })}</span>
                <input type="checkbox" checked={form.whaleEnabled} onChange={(event) => updateField('whaleEnabled', event.target.checked)} />
              </label>
              <label className="block text-sm text-slate-300">
                <span>{t('adminOps.signalCenterWhaleThreshold', { defaultValue: 'Ngưỡng whale mặc định (VND)' })}</span>
                <input value={form.whaleThreshold} onChange={(event) => updateField('whaleThreshold', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="block text-sm text-slate-300">
                <span>{t('adminOps.signalCenterWhaleCooldown', { defaultValue: 'Cooldown whale (giây)' })}</span>
                <input value={form.whaleCooldown} onChange={(event) => updateField('whaleCooldown', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{t('adminOps.signalCenterDarkFlowEnabled', { defaultValue: 'Bật dark flow service' })}</span>
                <input type="checkbox" checked={form.darkFlowEnabled} onChange={(event) => updateField('darkFlowEnabled', event.target.checked)} />
              </label>
              <label className="block text-sm text-slate-300">
                <span>{t('adminOps.signalCenterDarkFlowWindow', { defaultValue: 'Cửa sổ dark flow (giây)' })}</span>
                <input value={form.darkFlowWindow} onChange={(event) => updateField('darkFlowWindow', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  <span>{t('adminOps.signalCenterDarkFlowWarning', { defaultValue: 'Warning strength' })}</span>
                  <input value={form.darkFlowWarning} onChange={(event) => updateField('darkFlowWarning', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="block text-sm text-slate-300">
                  <span>{t('adminOps.signalCenterDarkFlowUrgent', { defaultValue: 'Urgent strength' })}</span>
                  <input value={form.darkFlowUrgent} onChange={(event) => updateField('darkFlowUrgent', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                <span>{t('adminOps.signalCenterDarkFlowCooldown', { defaultValue: 'Cooldown dark flow (giây)' })}</span>
                <input value={form.darkFlowCooldown} onChange={(event) => updateField('darkFlowCooldown', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{t('adminOps.signalCenterWebsocketEnabled', { defaultValue: 'Bật websocket fan-out' })}</span>
                <input type="checkbox" checked={form.websocketEnabled} onChange={(event) => updateField('websocketEnabled', event.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                <span>{t('adminOps.signalCenterHistoryEnabled', { defaultValue: 'Bật UserAlertHistory' })}</span>
                <input type="checkbox" checked={form.historyEnabled} onChange={(event) => updateField('historyEnabled', event.target.checked)} />
              </label>
              <label className="block text-sm text-slate-300">
                <span>{t('adminOps.signalCenterFanoutBatch', { defaultValue: 'Fan-out batch size' })}</span>
                <input value={form.fanoutBatchSize} onChange={(event) => updateField('fanoutBatchSize', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm text-slate-300">
                  <span>{t('adminOps.signalCenterRawKeepDays', { defaultValue: 'Giữ IntradayTick (ngày)' })}</span>
                  <input value={form.intradayTickKeepDays} readOnly className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 outline-none" />
                  <p className="mt-1 text-xs text-amber-300">{t('adminOps.signalCenterRawKeepDaysHint', { defaultValue: 'Chỉ đọc từ runtime policy; Signal Control Center không ghi giá trị này.' })}</p>
                </label>
                <label className="block text-sm text-slate-300">
                  <span>{t('adminOps.signalCenterWhaleKeepDays', { defaultValue: 'Whale keep days' })}</span>
                  <input value={form.whaleEventKeepDays} onChange={(event) => updateField('whaleEventKeepDays', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="block text-sm text-slate-300">
                  <span>{t('adminOps.signalCenterDarkKeepDays', { defaultValue: 'Dark flow keep days' })}</span>
                  <input value={form.darkFlowKeepDays} onChange={(event) => updateField('darkFlowKeepDays', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={handlePreviewConfig} disabled={busyAction !== ''} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50">
              {busyAction === 'preview-config' ? t('adminOps.signalCenterPreviewing', { defaultValue: 'Đang xem trước...' }) : t('adminOps.signalCenterPreviewConfig', { defaultValue: 'Xem trước config' })}
            </button>
            <button type="button" onClick={handleApplyConfig} disabled={busyAction !== ''} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busyAction === 'apply-config' ? t('adminOps.signalCenterApplying', { defaultValue: 'Đang áp dụng...' }) : t('adminOps.signalCenterApplyConfig', { defaultValue: 'Áp dụng config' })}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterUniverseTitle', { defaultValue: 'Universe preview và apply' })}</h3>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-slate-300">
              <span>{t('adminOps.signalCenterAdminSymbols', { defaultValue: 'Admin symbols (phân tách bằng dấu phẩy hoặc xuống dòng)' })}</span>
              <textarea value={form.adminSymbols} onChange={(event) => updateField('adminSymbols', event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"><span>{t('adminOps.signalCenterIncludeTracked', { defaultValue: 'Gộp tracked symbols' })}</span><input type="checkbox" checked={form.includeTrackedSymbols} onChange={(event) => updateField('includeTrackedSymbols', event.target.checked)} /></label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"><span>{t('adminOps.signalCenterIncludeWatchlist', { defaultValue: 'Gộp watchlist symbols' })}</span><input type="checkbox" checked={form.includeWatchlistSymbols} onChange={(event) => updateField('includeWatchlistSymbols', event.target.checked)} /></label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"><span>{t('adminOps.signalCenterIncludeAlerts', { defaultValue: 'Gộp price alerts' })}</span><input type="checkbox" checked={form.includeAlertSymbols} onChange={(event) => updateField('includeAlertSymbols', event.target.checked)} /></label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"><span>{t('adminOps.signalCenterIncludePortfolio', { defaultValue: 'Gộp symbols từ giao dịch' })}</span><input type="checkbox" checked={form.includePortfolioSymbols} onChange={(event) => updateField('includePortfolioSymbols', event.target.checked)} /></label>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"><span>{t('adminOps.signalCenterIncludeGroups', { defaultValue: 'Bật curated group universe' })}</span><input type="checkbox" checked={form.includeGroupSymbols} onChange={(event) => updateField('includeGroupSymbols', event.target.checked)} /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={handlePreviewUniverse} disabled={busyAction !== ''} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50">
              {busyAction === 'preview-universe' ? t('adminOps.signalCenterPreviewing', { defaultValue: 'Đang xem trước...' }) : t('adminOps.signalCenterPreviewUniverse', { defaultValue: 'Xem trước universe' })}
            </button>
            <button type="button" onClick={handleApplyUniverse} disabled={busyAction !== ''} className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busyAction === 'apply-universe' ? t('adminOps.signalCenterApplying', { defaultValue: 'Đang áp dụng...' }) : t('adminOps.signalCenterApplyUniverse', { defaultValue: 'Áp dụng universe' })}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
            <p>{t('adminOps.signalCenterUniverseEffectiveCount', { defaultValue: 'Effective symbols' })}: <span className="font-semibold text-slate-100">{formatNumberValue(universePreview?.preview?.counts?.effective ?? summary?.universe?.counts?.effective)}</span></p>
            <p className="mt-1">{t('adminOps.signalCenterUniverseGeneratedAt', { defaultValue: 'Generated at' })}: <span className="font-semibold text-slate-100">{formatDateTimeValue(universePreview?.preview?.generated_at ?? summary?.universe?.generated_at)}</span></p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterJobsAuditTitle', { defaultValue: 'Tác vụ và kiểm toán' })}</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">{t('adminOps.signalCenterJobsAuditDescription', { defaultValue: 'Tác vụ chạy tay, sự kiện canonical gần đây, preview retention và cảnh báo ngưng dùng được gom trên cùng một surface để operator đọc nhanh trạng thái audit.' })}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">{t('adminOps.signalCenterJobsAuditJobsCount', { defaultValue: 'Jobs' })}: {formatNumberValue(jobsTotal)}</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">{t('adminOps.signalCenterJobsAuditEventsCount', { defaultValue: 'Recent actions' })}: {formatNumberValue(eventsTotal)}</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">{t('adminOps.signalCenterJobsAuditWarningsCount', { defaultValue: 'Cảnh báo ngưng dùng' })}: {formatNumberValue(auditWarnings.length)}</span>
          </div>
        </div>
        {auditWarnings.length ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs leading-6 text-amber-100">
            <p className="font-semibold uppercase tracking-[0.16em] text-amber-200">{t('adminOps.signalCenterJobsAuditWarningsTitle', { defaultValue: 'Cảnh báo ngưng dùng' })}</p>
            <ul className="mt-2 space-y-1">
              {auditWarnings.map((warning, index) => (
                <li key={`${typeof warning === 'object' ? warning.field || warning.message || index : warning}-${index}`}>• {formatAuditWarning(warning)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-400">
            {t('adminOps.signalCenterJobsAuditWarningsEmpty', { defaultValue: 'Không có cảnh báo ngưng dùng.' })}
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterJobsTitle', { defaultValue: 'Manual runs và job registry' })}</h3>
            <div className="flex flex-wrap gap-2">
              <input value={jobSymbol} onChange={(event) => setJobSymbol(event.target.value)} placeholder={t('adminOps.signalCenterJobSymbolPlaceholder', { defaultValue: 'Mã tùy chọn, ví dụ FPT' })} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              <button type="button" onClick={() => handleRunJob('whale')} disabled={busyAction !== ''} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{t('adminOps.signalCenterRunWhale', { defaultValue: 'Chạy whale' })}</button>
              <button type="button" onClick={() => handleRunJob('dark_flow')} disabled={busyAction !== ''} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{t('adminOps.signalCenterRunDarkFlow', { defaultValue: 'Chạy dark flow' })}</button>
            </div>
          </div>
          {jobsLoaded ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-2 py-2">ID</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterServiceColumn', { defaultValue: 'Service' })}</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterRunTypeColumn', { defaultValue: 'Run type' })}</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterStatusColumn', { defaultValue: 'Status' })}</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterStoredColumn', { defaultValue: 'Stored' })}</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterCreatedAtColumn', { defaultValue: 'Created' })}</th>
                      <th className="px-2 py-2">{t('adminOps.signalCenterActionColumn', { defaultValue: 'Action' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.length === 0 ? (
                      <tr>
                        <td className="px-2 py-4 text-center text-slate-500" colSpan={7}>{t('adminOps.noData', { defaultValue: 'Chưa có dữ liệu' })}</td>
                      </tr>
                    ) : jobs.map((job) => {
                      const retryBusy = busyAction === `retry-${job.id}`;
                      const canRetry = !['QUEUED', 'RUNNING'].includes(String(job.status || '').toUpperCase());
                      return (
                        <tr key={job.id} className="border-b border-slate-900/80">
                          <td className="px-2 py-3 font-semibold text-slate-100">#{job.id}</td>
                          <td className="px-2 py-3">{job.service_domain_display || job.service_domain}</td>
                          <td className="px-2 py-3">{job.run_type_display || job.run_type}</td>
                          <td className="px-2 py-3"><span className={`rounded-full border px-2 py-1 ${statusTone(job.status)}`}>{job.status_display || job.status}</span></td>
                          <td className="px-2 py-3">{formatNumberValue(job.stored_items)}</td>
                          <td className="px-2 py-3">{formatDateTimeValue(job.created_at)}</td>
                          <td className="px-2 py-3">
                            <button type="button" disabled={!canRetry || retryBusy} onClick={() => handleRetryRun(job.id)} className="rounded-full border border-slate-700 px-3 py-1 font-semibold text-slate-100 disabled:opacity-40">
                              {retryBusy ? t('adminOps.signalCenterRetrying', { defaultValue: 'Đang retry...' }) : t('adminOps.retry', { defaultValue: 'Retry' })}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                mode="offset"
                total={jobsTotal}
                page={jobsPage}
                size={jobsPageSize}
                onPageChange={handleJobsPageChange}
                onSizeChange={handleJobsPageSizeChange}
              />
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-5">
              <p className="text-sm text-slate-300">{t('adminOps.signalCenterJobsLazyHint', { defaultValue: 'Nhấn để tải lịch sử chạy.' })}</p>
              <button
                type="button"
                onClick={handleLoadJobs}
                disabled={jobsLoading}
                className="mt-3 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
              >
                {jobsLoading ? t('adminOps.loading', { defaultValue: 'Đang tải...' }) : t('adminOps.signalCenterLoadJobs', { defaultValue: 'Tải lịch sử chạy' })}
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <JsonPreview
            title={t('adminOps.signalCenterWhaleGovernanceTitle', { defaultValue: 'Quản trị whale hiện hành' })}
            payload={whaleGovernanceSnapshot}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
          />
          <JsonPreview
            title={t('adminOps.signalCenterOwnershipTitle', { defaultValue: 'Chủ sở hữu hiệu lực' })}
            payload={ownershipSnapshot}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
          />
          <JsonPreview
            title={t('adminOps.signalCenterConfigPreviewTitle', { defaultValue: 'Preview config' })}
            payload={configPreview?.changes || configPreview?.preview}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
          />
          <JsonPreview
            title={t('adminOps.signalCenterUniversePreviewTitle', { defaultValue: 'Preview universe' })}
            payload={universePreview?.preview || universePreview?.policy}
            emptyText={t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}
          />
        </div>
      </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterRecentEventsTitle', { defaultValue: 'Recent canonical events' })}</h3>
          {eventsLoaded ? (
            <>
              <div className="mt-4 space-y-3">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('adminOps.noData', { defaultValue: 'Chưa có dữ liệu' })}</p>
                ) : events.map((event) => (
                  <div key={`${event.domain}-${event.event_id}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{event.symbol} · {event.domain}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDateTimeValue(event.ts)}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone(event.severity)}`}>{event.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{t('adminOps.signalCenterSummaryValue', { defaultValue: 'Giá trị tóm tắt' })}: {formatNumberValue(event.summary_value)}</p>
                  </div>
                ))}
              </div>
              <PaginationBar
                mode="offset"
                total={eventsTotal}
                page={eventsPage}
                size={eventsPageSize}
                onPageChange={handleEventsPageChange}
                onSizeChange={handleEventsPageSizeChange}
              />
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-5">
              <p className="text-sm text-slate-300">{t('adminOps.signalCenterEventsLazyHint', { defaultValue: 'Nhấn để tải sự kiện gần đây.' })}</p>
              <button
                type="button"
                onClick={handleLoadEvents}
                disabled={eventsLoading}
                className="mt-3 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
              >
                {eventsLoading ? t('adminOps.loading', { defaultValue: 'Đang tải...' }) : t('adminOps.signalCenterLoadEvents', { defaultValue: 'Tải sự kiện gần đây' })}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">{t('adminOps.signalCenterRetentionTitle', { defaultValue: 'Retention preview' })}</h3>
            <button type="button" onClick={() => refreshControlCenter({ silent: true })} className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100">{t('adminOps.refresh', { defaultValue: 'Làm mới' })}</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterRawIntraday', { defaultValue: 'IntradayTick (runtime canonical)' })}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumberValue(retentionPreview?.raw_intraday?.rows_total)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTimeValue(retentionPreview?.raw_intraday?.purge_before)}</p>
              <p className="mt-1 text-xs text-amber-300">{rawIntradayKeepDays != null ? t('adminOps.signalCenterRawKeepDaysValue', { defaultValue: `Giữ ${formatNumberValue(rawIntradayKeepDays)} ngày` }) : t('adminOps.signalCenterPreviewEmpty', { defaultValue: 'Chưa có preview.' })}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterWhaleEvents', { defaultValue: 'Whale events' })}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumberValue(retentionPreview?.whale_events?.rows_total)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTimeValue(retentionPreview?.whale_events?.purge_before)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('adminOps.signalCenterDarkFlowEvents', { defaultValue: 'Dark flow events' })}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNumberValue(retentionPreview?.dark_flow_events?.rows_total)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTimeValue(retentionPreview?.dark_flow_events?.purge_before)}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}