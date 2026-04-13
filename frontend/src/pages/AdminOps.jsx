/**
 * AdminOps.jsx — Trang quản trị hệ thống (chỉ dành cho is_staff).
 * Route: /admin-ops
 *
 * Panels:
 *  - Thống kê hệ thống: user/portfolio/symbol/watchlist counts
 *  - Trạng thái realtime: channel layer, redis health
 *  - Lần sync cuối: market groups, stock profiles
 *  - Shortcuts đồng bộ nhanh
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminOpsStats,
  getAdminPrefetchRuntimeSettings,
  getAdminPrefetchTimePolicy,
  getAdminSystemAiSettings,
  getAdminVnstockConfigChangelog,
  getAdminVnstockConfigCurrent,
  syncMarketGroups,
  resetAdminVnstockConfig,
  syncStockProfile,
  syncWatchlistPrices,
  updateAdminVnstockConfig,
  updateAdminPrefetchRuntimeSettings,
  updateAdminPrefetchTimePolicy,
  updateAdminSystemAiSettings,
  warmTickerPrefetch,
} from '../api/client';
import { useI18n } from '../context/LangContext';
import RuntimeKPIPanel from '../components/RuntimeKPIPanel';
import VnstockBenchmarkPanel from '../components/adminops/VnstockBenchmarkPanel';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function toneClasses(tone) {
  const tones = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    slate: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  };
  return tones[tone] || tones.slate;
}

function Pill({ children, tone = 'slate' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses(tone)}`}>
      {children}
    </span>
  );
}

function SignalBadge({ signal, t }) {
  if (!signal) return <Pill>{t('adminOps.none')}</Pill>;
  const normalized = String(signal).toLowerCase();
  const tone = normalized === 'green' ? 'green' : normalized === 'amber' ? 'amber' : 'red';
  return <Pill tone={tone}>{normalized.toUpperCase()}</Pill>;
}

function RolloutStatusBadge({ status, t }) {
  if (!status) return <Pill>{t('adminOps.none')}</Pill>;
  const normalized = String(status).toLowerCase();
  const toneMap = {
    running: 'blue',
    completed: 'green',
    pending: 'amber',
    failed: 'red',
    rolled_back: 'red',
  };
  return <Pill tone={toneMap[normalized] || 'slate'}>{normalized}</Pill>;
}

function MiniMetric({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

function KeyValueRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 text-right">{value ?? '—'}</span>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ ok, t }) {
  if (ok === null || ok === undefined)
    return <span className="text-xs text-gray-400">{t('adminOps.na')}</span>;
  return ok
    ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{t('adminOps.ok')}</span>
    : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">{t('adminOps.fail')}</span>;
}

function PrefetchHealthBadge({ snapshot, t }) {
  if (!snapshot || !snapshot.meta_present) {
    return <Pill>{t('adminOps.noMeta')}</Pill>;
  }
  if (snapshot.healthy) {
    return <Pill tone="green">{t('adminOps.healthy')}</Pill>;
  }
  const statusValue = String(snapshot.prefetch?.status || '').toLowerCase();
  if (statusValue === 'retrying') {
    return <Pill tone="amber">{t('adminOps.retrying')}</Pill>;
  }
  return <Pill tone="red">{t('adminOps.degraded')}</Pill>;
}

function SyncRow({ label, log, t }) {
  if (!log) return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-xs text-gray-400">{t('adminOps.noData')}</span>
    </div>
  );
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400">{t('adminOps.mode')}: {log.mode} · {fmtDateTime(log.started_at)}</p>
        {log.message && <p className="text-xs text-gray-400 truncate max-w-xs">{log.message}</p>}
      </div>
      <StatusBadge ok={log.success} t={t} />
    </div>
  );
}

function withTimeout(promise, ms = 12000, label = 'request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const err = new Error(`${label} timeout`);
      err.code = 'TIMEOUT';
      window.setTimeout(() => reject(err), ms);
    }),
  ]);
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminOps() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [systemAiSettings, setSystemAiSettings] = useState(null);
  const [thresholdForm, setThresholdForm] = useState({ warning: '', critical: '', cooldown: '' });
  const [thresholdState, setThresholdState] = useState('idle');
  const [thresholdMessage, setThresholdMessage] = useState('');
  const [prefetchSettingsForm, setPrefetchSettingsForm] = useState({
    batch_size: '',
    symbol_limit: '',
    max_retries: '',
    retry_base_seconds: '',
    retry_max_seconds: '',
    rate_limit_cooldown_seconds: '',
    circuit_window_seconds: '',
    circuit_breaker_timeout_threshold: '',
    circuit_breaker_cooldown_seconds: '',
    include_group_symbols: false,
  });
  const [prefetchSettingsState, setPrefetchSettingsState] = useState('idle');
  const [prefetchSettingsMessage, setPrefetchSettingsMessage] = useState('');
  const [prefetchTimePolicyForm, setPrefetchTimePolicyForm] = useState({
    timezone: 'Asia/Ho_Chi_Minh',
    open_time: '09:00',
    close_time: '15:00',
    pre_open_minutes: '30',
    post_close_minutes: '30',
    lunch_enabled: true,
    lunch_start: '11:30',
    lunch_end: '13:00',
    weekend_mode: 'offhours',
    pre_open_query_enabled: true,
    pre_open_interval_seconds: '90',
    market_open_query_enabled: true,
    market_open_interval_seconds: '35',
    lunch_break_query_enabled: true,
    lunch_break_interval_seconds: '180',
    pre_close_query_enabled: true,
    pre_close_interval_seconds: '60',
    post_close_query_enabled: true,
    post_close_interval_seconds: '180',
    offhours_query_enabled: false,
    offhours_interval_seconds: '600',
    jitter_percent: '15',
    cooldown_multiplier_on_429: '2.0',
    max_interval_seconds: '1800',
  });
  const [prefetchTimePolicyState, setPrefetchTimePolicyState] = useState('idle');
  const [prefetchTimePolicyMessage, setPrefetchTimePolicyMessage] = useState('');
  const [prefetchTimePolicyErrors, setPrefetchTimePolicyErrors] = useState({});
  const [prefetchTimePolicyInitial, setPrefetchTimePolicyInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStates, setSyncStates] = useState({});
  const [syncCooldowns, setSyncCooldowns] = useState({});
  const [vnstockConfigForm, setVnstockConfigForm] = useState({
    max_concurrency: '12',
    retry_attempts: '1',
    retry_backoff_seconds: '0.35',
    rate_limit_cooldown_seconds: '20',
    price_board_source: 'KBS',
    fallback_sources: 'VCI',
    timeout_price_board: '8',
    timeout_intraday: '8',
    timeout_financial_ratio: '10',
    timeout_history: '12',
    timeout_listing: '12',
    timeout_general: '8',
    enable_caching: true,
    enable_rate_limit_detection: true,
    enable_concurrent_limit: true,
  });
  const [vnstockConfigState, setVnstockConfigState] = useState('idle');
  const [vnstockConfigMessage, setVnstockConfigMessage] = useState('');
  const [vnstockChangelog, setVnstockChangelog] = useState([]);
  const syncCooldownTimersRef = useRef({});
  const prefetchTimePolicyRulebook = systemAiSettings?.prefetch_time_policy_rulebook || {};
  const [activePage, setActivePage] = useState('overview');

  const clearSyncCooldownTimer = useCallback((key) => {
    const timerId = syncCooldownTimersRef.current[key];
    if (timerId) {
      window.clearInterval(timerId);
      delete syncCooldownTimersRef.current[key];
    }
  }, []);

  const startSyncCooldown = useCallback((key, seconds) => {
    clearSyncCooldownTimer(key);
    const initial = Math.max(Math.ceil(Number(seconds) || 0), 1);
    setSyncCooldowns((prev) => ({ ...prev, [key]: initial }));

    syncCooldownTimersRef.current[key] = window.setInterval(() => {
      setSyncCooldowns((prev) => {
        const current = Number(prev[key] || 0);
        if (current <= 1) {
          clearSyncCooldownTimer(key);
          return { ...prev, [key]: 0 };
        }
        return { ...prev, [key]: current - 1 };
      });
    }, 1000);
  }, [clearSyncCooldownTimer]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      // stats la du lieu bat buoc cho trang; cac panel con lai fail-soft de tranh treo spinner.
      const statsRes = await withTimeout(getAdminOpsStats(), 15000, 'admin-ops-stats');
      const [settingsRes, vnstockRes, vnstockChangelogRes] = await Promise.allSettled([
        withTimeout(getAdminPrefetchTimePolicy(), 12000, 'admin-ops-settings'),
        withTimeout(getAdminVnstockConfigCurrent(), 12000, 'admin-ops-vnstock-current'),
        withTimeout(getAdminVnstockConfigChangelog(20, 0), 12000, 'admin-ops-vnstock-changelog'),
      ]);
      setStats(statsRes.data);
      const payload = settingsRes.status === 'fulfilled' ? (settingsRes.value.data?.settings || null) : null;
      if (payload) {
        setSystemAiSettings(payload);
      }
      const vnstockSettings = vnstockRes.status === 'fulfilled' ? (vnstockRes.value.data?.settings || null) : null;
      if (vnstockSettings) {
        setVnstockConfigForm({
          max_concurrency: String(vnstockSettings.max_concurrency ?? ''),
          retry_attempts: String(vnstockSettings.retry_attempts ?? ''),
          retry_backoff_seconds: String(vnstockSettings.retry_backoff_seconds ?? ''),
          rate_limit_cooldown_seconds: String(vnstockSettings.rate_limit_cooldown_seconds ?? ''),
          price_board_source: String(vnstockSettings.price_board_source || 'KBS'),
          fallback_sources: Array.isArray(vnstockSettings.fallback_sources) ? vnstockSettings.fallback_sources.join(',') : '',
          timeout_price_board: String(vnstockSettings.timeout_config?.price_board ?? ''),
          timeout_intraday: String(vnstockSettings.timeout_config?.intraday ?? ''),
          timeout_financial_ratio: String(vnstockSettings.timeout_config?.financial_ratio ?? ''),
          timeout_history: String(vnstockSettings.timeout_config?.history ?? ''),
          timeout_listing: String(vnstockSettings.timeout_config?.listing ?? ''),
          timeout_general: String(vnstockSettings.timeout_config?.general ?? ''),
          enable_caching: Boolean(vnstockSettings.enable_caching),
          enable_rate_limit_detection: Boolean(vnstockSettings.enable_rate_limit_detection),
          enable_concurrent_limit: Boolean(vnstockSettings.enable_concurrent_limit),
        });
      }
      if (vnstockChangelogRes.status === 'fulfilled') {
        setVnstockChangelog(Array.isArray(vnstockChangelogRes.value.data?.results) ? vnstockChangelogRes.value.data.results : []);
      }
      if (payload?.governance_delta_thresholds) {
        setThresholdForm({
          warning: String(payload.governance_delta_thresholds.warning ?? ''),
          critical: String(payload.governance_delta_thresholds.critical ?? ''),
          cooldown: String(payload.governance_delta_thresholds.cooldown ?? ''),
        });
      }
      if (payload?.prefetch_runtime_settings) {
        const runtime = payload.prefetch_runtime_settings;
        setPrefetchSettingsForm({
          batch_size: String(runtime.batch_size ?? ''),
          symbol_limit: String(runtime.symbol_limit ?? ''),
          max_retries: String(runtime.max_retries ?? ''),
          retry_base_seconds: String(runtime.retry_base_seconds ?? ''),
          retry_max_seconds: String(runtime.retry_max_seconds ?? ''),
          rate_limit_cooldown_seconds: String(runtime.rate_limit_cooldown_seconds ?? ''),
          circuit_window_seconds: String(runtime.circuit_window_seconds ?? ''),
          circuit_breaker_timeout_threshold: String(runtime.circuit_breaker_timeout_threshold ?? ''),
          circuit_breaker_cooldown_seconds: String(runtime.circuit_breaker_cooldown_seconds ?? ''),
          include_group_symbols: Boolean(runtime.include_group_symbols),
        });
      }
      if (payload?.prefetch_time_policy) {
        const policy = payload.prefetch_time_policy;
        const market = policy.market || {};
        const profiles = policy.profiles || {};
        const guard = policy.rate_limit_guard || {};
        const readProfile = (name, fallbackInterval) => {
          const profile = profiles[name] || {};
          return {
            query_enabled: Boolean(profile.query_enabled),
            interval_seconds: String(profile.interval_seconds ?? fallbackInterval),
          };
        };
        const preOpen = readProfile('pre_open', 90);
        const marketOpen = readProfile('market_open', 35);
        const lunchBreak = readProfile('lunch_break', 180);
        const preClose = readProfile('pre_close', 60);
        const postClose = readProfile('post_close', 180);
        const offhours = readProfile('offhours', 600);

        setPrefetchTimePolicyForm({
          timezone: String(policy.timezone || 'Asia/Ho_Chi_Minh'),
          open_time: String(market.open_time || '09:00'),
          close_time: String(market.close_time || '15:00'),
          pre_open_minutes: String(market.pre_open_minutes ?? 30),
          post_close_minutes: String(market.post_close_minutes ?? 30),
          lunch_enabled: Boolean(market.lunch_break?.enabled),
          lunch_start: String(market.lunch_break?.start || '11:30'),
          lunch_end: String(market.lunch_break?.end || '13:00'),
          weekend_mode: String(market.weekend_mode || 'offhours'),
          pre_open_query_enabled: preOpen.query_enabled,
          pre_open_interval_seconds: preOpen.interval_seconds,
          market_open_query_enabled: marketOpen.query_enabled,
          market_open_interval_seconds: marketOpen.interval_seconds,
          lunch_break_query_enabled: lunchBreak.query_enabled,
          lunch_break_interval_seconds: lunchBreak.interval_seconds,
          pre_close_query_enabled: preClose.query_enabled,
          pre_close_interval_seconds: preClose.interval_seconds,
          post_close_query_enabled: postClose.query_enabled,
          post_close_interval_seconds: postClose.interval_seconds,
          offhours_query_enabled: offhours.query_enabled,
          offhours_interval_seconds: offhours.interval_seconds,
          jitter_percent: String(guard.jitter_percent ?? 15),
          cooldown_multiplier_on_429: String(guard.cooldown_multiplier_on_429 ?? 2.0),
          max_interval_seconds: String(guard.max_interval_seconds ?? 1800),
        });
        setPrefetchTimePolicyInitial({
          timezone: String(policy.timezone || 'Asia/Ho_Chi_Minh'),
          open_time: String(market.open_time || '09:00'),
          close_time: String(market.close_time || '15:00'),
          pre_open_minutes: String(market.pre_open_minutes ?? 30),
          post_close_minutes: String(market.post_close_minutes ?? 30),
          lunch_enabled: Boolean(market.lunch_break?.enabled),
          lunch_start: String(market.lunch_break?.start || '11:30'),
          lunch_end: String(market.lunch_break?.end || '13:00'),
          weekend_mode: String(market.weekend_mode || 'offhours'),
          pre_open_query_enabled: preOpen.query_enabled,
          pre_open_interval_seconds: preOpen.interval_seconds,
          market_open_query_enabled: marketOpen.query_enabled,
          market_open_interval_seconds: marketOpen.interval_seconds,
          lunch_break_query_enabled: lunchBreak.query_enabled,
          lunch_break_interval_seconds: lunchBreak.interval_seconds,
          pre_close_query_enabled: preClose.query_enabled,
          pre_close_interval_seconds: preClose.interval_seconds,
          post_close_query_enabled: postClose.query_enabled,
          post_close_interval_seconds: postClose.interval_seconds,
          offhours_query_enabled: offhours.query_enabled,
          offhours_interval_seconds: offhours.interval_seconds,
          jitter_percent: String(guard.jitter_percent ?? 15),
          cooldown_multiplier_on_429: String(guard.cooldown_multiplier_on_429 ?? 2.0),
          max_interval_seconds: String(guard.max_interval_seconds ?? 1800),
        });
        setPrefetchTimePolicyErrors({});
      }
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        setError('403');
      } else if (status === 429) {
        setError('429');
      } else {
        setError(err.message || t('adminOps.unknownError'));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => {
      load({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
      Object.keys(syncCooldownTimersRef.current).forEach((key) => {
        clearSyncCooldownTimer(key);
      });
    };
  }, [clearSyncCooldownTimer, load]);

  const handleSync = useCallback(async (key, apiFn, ...args) => {
    const currentCooldown = Number(syncCooldowns[key] || 0);
    if (currentCooldown > 0) {
      return;
    }

    setSyncStates((s) => ({ ...s, [key]: 'loading' }));
    try {
      await apiFn(...args);
      setSyncStates((s) => ({ ...s, [key]: 'ok' }));
      setSyncCooldowns((prev) => ({ ...prev, [key]: 0 }));
      await load();
    } catch (err) {
      const retryAfter = Number(err?.response?.data?.retry_after_seconds);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        startSyncCooldown(key, retryAfter);
        setSyncStates((s) => ({ ...s, [key]: 'idle' }));
      } else {
        setSyncStates((s) => ({ ...s, [key]: 'error' }));
      }
    }
  }, [load, startSyncCooldown, syncCooldowns]);

  const handleThresholdInput = useCallback((field, value) => {
    setThresholdForm((prev) => ({ ...prev, [field]: value }));
    if (thresholdState !== 'idle') {
      setThresholdState('idle');
      setThresholdMessage('');
    }
  }, [thresholdState]);

  const handleThresholdSave = useCallback(async (event) => {
    event.preventDefault();
    const warning = Number(thresholdForm.warning);
    const critical = Number(thresholdForm.critical);
    const cooldown = Number(thresholdForm.cooldown);

    if ([warning, critical, cooldown].some((value) => Number.isNaN(value))) {
      setThresholdState('error');
      setThresholdMessage(t('adminOps.thresholdValidationNumber'));
      return;
    }

    setThresholdState('saving');
    setThresholdMessage('');
    try {
      const response = await updateAdminSystemAiSettings({
        governance_delta_thresholds: {
          warning,
          critical,
          cooldown,
        },
      });
      const payload = response.data?.settings || null;
      setSystemAiSettings(payload);
      if (payload?.governance_delta_thresholds) {
        setThresholdForm({
          warning: String(payload.governance_delta_thresholds.warning ?? ''),
          critical: String(payload.governance_delta_thresholds.critical ?? ''),
          cooldown: String(payload.governance_delta_thresholds.cooldown ?? ''),
        });
      }
      setThresholdState('success');
      setThresholdMessage(t('adminOps.thresholdSaveSuccess'));
      await load({ silent: true });
    } catch (err) {
      setThresholdState('error');
      setThresholdMessage(err.response?.data?.message || t('adminOps.thresholdSaveFailed'));
    }
  }, [load, t, thresholdForm]);

  const handlePrefetchSettingsInput = useCallback((field, value) => {
    setPrefetchSettingsForm((prev) => ({ ...prev, [field]: value }));
    if (prefetchSettingsState !== 'idle') {
      setPrefetchSettingsState('idle');
      setPrefetchSettingsMessage('');
    }
  }, [prefetchSettingsState]);

  const handlePrefetchSettingsSave = useCallback(async (event) => {
    event.preventDefault();

    const payload = {
      batch_size: Number(prefetchSettingsForm.batch_size),
      symbol_limit: Number(prefetchSettingsForm.symbol_limit),
      max_retries: Number(prefetchSettingsForm.max_retries),
      retry_base_seconds: Number(prefetchSettingsForm.retry_base_seconds),
      retry_max_seconds: Number(prefetchSettingsForm.retry_max_seconds),
      rate_limit_cooldown_seconds: Number(prefetchSettingsForm.rate_limit_cooldown_seconds),
      circuit_window_seconds: Number(prefetchSettingsForm.circuit_window_seconds),
      circuit_breaker_timeout_threshold: Number(prefetchSettingsForm.circuit_breaker_timeout_threshold),
      circuit_breaker_cooldown_seconds: Number(prefetchSettingsForm.circuit_breaker_cooldown_seconds),
      include_group_symbols: Boolean(prefetchSettingsForm.include_group_symbols),
    };

    if (Object.values(payload).some((value) => typeof value === 'number' && Number.isNaN(value))) {
      setPrefetchSettingsState('error');
      setPrefetchSettingsMessage(t('adminOps.prefetchSettingsValidationNumber'));
      return;
    }

    setPrefetchSettingsState('saving');
    setPrefetchSettingsMessage('');
    try {
      const response = await updateAdminPrefetchRuntimeSettings(payload);
      const runtime = response.data?.settings?.prefetch_runtime_settings || payload;
      setPrefetchSettingsForm({
        batch_size: String(runtime.batch_size ?? ''),
        symbol_limit: String(runtime.symbol_limit ?? ''),
        max_retries: String(runtime.max_retries ?? ''),
        retry_base_seconds: String(runtime.retry_base_seconds ?? ''),
        retry_max_seconds: String(runtime.retry_max_seconds ?? ''),
        rate_limit_cooldown_seconds: String(runtime.rate_limit_cooldown_seconds ?? ''),
        circuit_window_seconds: String(runtime.circuit_window_seconds ?? ''),
        circuit_breaker_timeout_threshold: String(runtime.circuit_breaker_timeout_threshold ?? ''),
        circuit_breaker_cooldown_seconds: String(runtime.circuit_breaker_cooldown_seconds ?? ''),
        include_group_symbols: Boolean(runtime.include_group_symbols),
      });
      setPrefetchSettingsState('success');
      setPrefetchSettingsMessage(t('adminOps.prefetchSettingsSaveSuccess'));
      await load({ silent: true });
    } catch (err) {
      setPrefetchSettingsState('error');
      setPrefetchSettingsMessage(err.response?.data?.message || t('adminOps.prefetchSettingsSaveFailed'));
    }
  }, [load, prefetchSettingsForm, t]);

  const handlePrefetchTimePolicyInput = useCallback((field, value) => {
    setPrefetchTimePolicyForm((prev) => ({ ...prev, [field]: value }));
    setPrefetchTimePolicyErrors((prev) => {
      if (!prev[field]) return prev;
      const cloned = { ...prev };
      delete cloned[field];
      return cloned;
    });
    if (prefetchTimePolicyState !== 'idle') {
      setPrefetchTimePolicyState('idle');
      setPrefetchTimePolicyMessage('');
    }
  }, [prefetchTimePolicyState]);

  const handlePrefetchTimePolicyReset = useCallback(() => {
    if (!prefetchTimePolicyInitial) {
      return;
    }
    setPrefetchTimePolicyForm(prefetchTimePolicyInitial);
    setPrefetchTimePolicyErrors({});
    setPrefetchTimePolicyState('idle');
    setPrefetchTimePolicyMessage('');
  }, [prefetchTimePolicyInitial]);

  const handlePrefetchTimePolicySave = useCallback(async (event) => {
    event.preventDefault();

    const payload = {
      timezone: String(prefetchTimePolicyForm.timezone || 'Asia/Ho_Chi_Minh').trim(),
      market: {
        open_time: String(prefetchTimePolicyForm.open_time || '').trim(),
        close_time: String(prefetchTimePolicyForm.close_time || '').trim(),
        pre_open_minutes: Number(prefetchTimePolicyForm.pre_open_minutes),
        post_close_minutes: Number(prefetchTimePolicyForm.post_close_minutes),
        lunch_break: {
          enabled: Boolean(prefetchTimePolicyForm.lunch_enabled),
          start: String(prefetchTimePolicyForm.lunch_start || '').trim(),
          end: String(prefetchTimePolicyForm.lunch_end || '').trim(),
        },
        weekend_mode: String(prefetchTimePolicyForm.weekend_mode || 'offhours').trim(),
      },
      profiles: {
        pre_open: {
          query_enabled: Boolean(prefetchTimePolicyForm.pre_open_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.pre_open_interval_seconds),
        },
        market_open: {
          query_enabled: Boolean(prefetchTimePolicyForm.market_open_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.market_open_interval_seconds),
        },
        lunch_break: {
          query_enabled: Boolean(prefetchTimePolicyForm.lunch_break_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.lunch_break_interval_seconds),
        },
        pre_close: {
          query_enabled: Boolean(prefetchTimePolicyForm.pre_close_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.pre_close_interval_seconds),
        },
        post_close: {
          query_enabled: Boolean(prefetchTimePolicyForm.post_close_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.post_close_interval_seconds),
        },
        offhours: {
          query_enabled: Boolean(prefetchTimePolicyForm.offhours_query_enabled),
          interval_seconds: Number(prefetchTimePolicyForm.offhours_interval_seconds),
        },
      },
      rate_limit_guard: {
        jitter_percent: Number(prefetchTimePolicyForm.jitter_percent),
        cooldown_multiplier_on_429: Number(prefetchTimePolicyForm.cooldown_multiplier_on_429),
        max_interval_seconds: Number(prefetchTimePolicyForm.max_interval_seconds),
      },
    };

    if (!payload.market.open_time || !payload.market.close_time || !payload.market.lunch_break.start || !payload.market.lunch_break.end) {
      setPrefetchTimePolicyState('error');
      setPrefetchTimePolicyMessage(t('adminOps.prefetchTimePolicyValidationRequired'));
      return;
    }

    const nextErrors = {};
    const setError = (field, message) => {
      nextErrors[field] = message;
    };
    const timeRegex = /^\d{2}:\d{2}$/;
    const parseTime = (value) => {
      const [hh, mm] = String(value || '').split(':');
      return Number(hh) * 60 + Number(mm);
    };

    if (!timeRegex.test(payload.market.open_time)) {
      setError('open_time', t('adminOps.prefetchTimePolicyValidationTimeFormat'));
    }
    if (!timeRegex.test(payload.market.close_time)) {
      setError('close_time', t('adminOps.prefetchTimePolicyValidationTimeFormat'));
    }
    if (!timeRegex.test(payload.market.lunch_break.start)) {
      setError('lunch_start', t('adminOps.prefetchTimePolicyValidationTimeFormat'));
    }
    if (!timeRegex.test(payload.market.lunch_break.end)) {
      setError('lunch_end', t('adminOps.prefetchTimePolicyValidationTimeFormat'));
    }

    if (Object.keys(nextErrors).length === 0) {
      if (parseTime(payload.market.open_time) >= parseTime(payload.market.close_time)) {
        setError('open_time', t('adminOps.prefetchTimePolicyValidationOpenClose'));
      }
      if (payload.market.lunch_break.enabled && parseTime(payload.market.lunch_break.start) >= parseTime(payload.market.lunch_break.end)) {
        setError('lunch_start', t('adminOps.prefetchTimePolicyValidationLunchRange'));
      }
    }

    const numericValues = [
      payload.market.pre_open_minutes,
      payload.market.post_close_minutes,
      payload.profiles.pre_open.interval_seconds,
      payload.profiles.market_open.interval_seconds,
      payload.profiles.lunch_break.interval_seconds,
      payload.profiles.pre_close.interval_seconds,
      payload.profiles.post_close.interval_seconds,
      payload.profiles.offhours.interval_seconds,
      payload.rate_limit_guard.jitter_percent,
      payload.rate_limit_guard.cooldown_multiplier_on_429,
      payload.rate_limit_guard.max_interval_seconds,
    ];
    if (numericValues.some((value) => Number.isNaN(value))) {
      setPrefetchTimePolicyState('error');
      setPrefetchTimePolicyMessage(t('adminOps.prefetchTimePolicyValidationNumber'));
      return;
    }

    const intervalMin = Number(prefetchTimePolicyRulebook?.profiles?.interval_seconds_min ?? 5);
    const jitterMin = Number(prefetchTimePolicyRulebook?.rate_limit_guard?.jitter_percent_min ?? 0);
    const jitterMax = Number(prefetchTimePolicyRulebook?.rate_limit_guard?.jitter_percent_max ?? 50);
    const multiplierMin = Number(prefetchTimePolicyRulebook?.rate_limit_guard?.cooldown_multiplier_on_429_min ?? 1);
    const maxIntervalMin = Number(prefetchTimePolicyRulebook?.rate_limit_guard?.max_interval_seconds_min ?? 60);

    if (payload.rate_limit_guard.jitter_percent < jitterMin || payload.rate_limit_guard.jitter_percent > jitterMax) {
      setError('jitter_percent', t('adminOps.prefetchTimePolicyValidationJitter'));
    }
    if (payload.rate_limit_guard.cooldown_multiplier_on_429 < multiplierMin) {
      setError('cooldown_multiplier_on_429', t('adminOps.prefetchTimePolicyValidationMultiplier'));
    }
    if (payload.rate_limit_guard.max_interval_seconds < maxIntervalMin) {
      setError('max_interval_seconds', t('adminOps.prefetchTimePolicyValidationMaxInterval'));
    }

    const profileIntervals = {
      pre_open_interval_seconds: payload.profiles.pre_open.interval_seconds,
      market_open_interval_seconds: payload.profiles.market_open.interval_seconds,
      lunch_break_interval_seconds: payload.profiles.lunch_break.interval_seconds,
      pre_close_interval_seconds: payload.profiles.pre_close.interval_seconds,
      post_close_interval_seconds: payload.profiles.post_close.interval_seconds,
      offhours_interval_seconds: payload.profiles.offhours.interval_seconds,
    };
    Object.entries(profileIntervals).forEach(([field, value]) => {
      if (value < intervalMin) {
        setError(field, t('adminOps.prefetchTimePolicyValidationIntervalMin', { value: intervalMin }));
      }
      if (value > payload.rate_limit_guard.max_interval_seconds) {
        setError(field, t('adminOps.prefetchTimePolicyValidationIntervalMax'));
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setPrefetchTimePolicyErrors(nextErrors);
      setPrefetchTimePolicyState('error');
      setPrefetchTimePolicyMessage(t('adminOps.prefetchTimePolicyValidationFailed'));
      return;
    }

    setPrefetchTimePolicyState('saving');
    setPrefetchTimePolicyMessage('');
    setPrefetchTimePolicyErrors({});
    try {
      await updateAdminPrefetchTimePolicy(payload);
      setPrefetchTimePolicyState('success');
      setPrefetchTimePolicyMessage(t('adminOps.prefetchTimePolicySaveSuccess'));
      await load({ silent: true });
    } catch (err) {
      const fieldErrors = err.response?.data?.field_errors;
      if (fieldErrors && typeof fieldErrors === 'object') {
        const parsed = {};
        Object.entries(fieldErrors).forEach(([fieldPath, message]) => {
          const key = String(fieldPath)
            .replace('prefetch_time_policy.market.', '')
            .replace('prefetch_time_policy.rate_limit_guard.', '')
            .replace('prefetch_time_policy.profiles.pre_open.', 'pre_open_')
            .replace('prefetch_time_policy.profiles.market_open.', 'market_open_')
            .replace('prefetch_time_policy.profiles.lunch_break.', 'lunch_break_')
            .replace('prefetch_time_policy.profiles.pre_close.', 'pre_close_')
            .replace('prefetch_time_policy.profiles.post_close.', 'post_close_')
            .replace('prefetch_time_policy.profiles.offhours.', 'offhours_');
          parsed[key] = String(message);
        });
        setPrefetchTimePolicyErrors(parsed);
      }
      setPrefetchTimePolicyState('error');
      setPrefetchTimePolicyMessage(err.response?.data?.message || t('adminOps.prefetchTimePolicySaveFailed'));
    }
  }, [load, prefetchTimePolicyForm, prefetchTimePolicyRulebook, t]);

  const handleVnstockConfigInput = useCallback((field, value) => {
    setVnstockConfigForm((prev) => ({ ...prev, [field]: value }));
    if (vnstockConfigState !== 'idle') {
      setVnstockConfigState('idle');
      setVnstockConfigMessage('');
    }
  }, [vnstockConfigState]);

  const handleVnstockConfigSave = useCallback(async (event) => {
    event.preventDefault();
    const payload = {
      max_concurrency: Number(vnstockConfigForm.max_concurrency),
      retry_attempts: Number(vnstockConfigForm.retry_attempts),
      retry_backoff_seconds: Number(vnstockConfigForm.retry_backoff_seconds),
      rate_limit_cooldown_seconds: Number(vnstockConfigForm.rate_limit_cooldown_seconds),
      price_board_source: String(vnstockConfigForm.price_board_source || '').trim().toUpperCase(),
      fallback_sources: String(vnstockConfigForm.fallback_sources || '')
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
      timeout_config: {
        price_board: Number(vnstockConfigForm.timeout_price_board),
        intraday: Number(vnstockConfigForm.timeout_intraday),
        financial_ratio: Number(vnstockConfigForm.timeout_financial_ratio),
        history: Number(vnstockConfigForm.timeout_history),
        listing: Number(vnstockConfigForm.timeout_listing),
        general: Number(vnstockConfigForm.timeout_general),
      },
      enable_caching: Boolean(vnstockConfigForm.enable_caching),
      enable_rate_limit_detection: Boolean(vnstockConfigForm.enable_rate_limit_detection),
      enable_concurrent_limit: Boolean(vnstockConfigForm.enable_concurrent_limit),
    };

    const scalarNums = [
      payload.max_concurrency,
      payload.retry_attempts,
      payload.retry_backoff_seconds,
      payload.rate_limit_cooldown_seconds,
      ...Object.values(payload.timeout_config),
    ];
    if (scalarNums.some((item) => Number.isNaN(item))) {
      setVnstockConfigState('error');
      setVnstockConfigMessage('Gia tri cau hinh vnstock khong hop le.');
      return;
    }

    setVnstockConfigState('saving');
    setVnstockConfigMessage('');
    try {
      await updateAdminVnstockConfig(payload);
      await load({ silent: true });
      setVnstockConfigState('success');
      setVnstockConfigMessage('Da cap nhat Runtime Vnstock Config.');
    } catch (err) {
      setVnstockConfigState('error');
      setVnstockConfigMessage(err.response?.data?.message || 'Cap nhat Runtime Vnstock Config that bai.');
    }
  }, [load, vnstockConfigForm]);

  const handleVnstockConfigReset = useCallback(async () => {
    setVnstockConfigState('saving');
    setVnstockConfigMessage('');
    try {
      await resetAdminVnstockConfig();
      await load({ silent: true });
      setVnstockConfigState('success');
      setVnstockConfigMessage('Da reset Runtime Vnstock Config ve mac dinh.');
    } catch (err) {
      setVnstockConfigState('error');
      setVnstockConfigMessage(err.response?.data?.message || 'Reset Runtime Vnstock Config that bai.');
    }
  }, [load]);

  const handleApplyVnstockBenchmarkRecommendation = useCallback((recommendation) => {
    const primary = String(recommendation?.primary_provider || '').trim().toUpperCase();
    const fallback = String(recommendation?.fallback_provider || '').trim().toUpperCase();
    if (!primary) {
      return;
    }
    setVnstockConfigForm((prev) => ({
      ...prev,
      price_board_source: primary,
      fallback_sources: fallback && fallback !== primary ? fallback : '',
    }));
    setVnstockConfigState('idle');
    setVnstockConfigMessage('');
  }, []);

  // ─── Render states ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error === '403') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-lg font-semibold text-red-500">{t('adminOps.noAccess')}</p>
        <button
          className="text-blue-500 hover:underline text-sm"
          onClick={() => navigate('/dashboard')}
        >
          ← {t('adminOps.backToDashboard')}
        </button>
      </div>
    );
  }

  if (error === '429') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-yellow-600 dark:text-yellow-400 font-semibold">{t('adminOps.tooManyRequests')}</p>
        <p className="text-sm text-gray-500">{t('adminOps.tooManyRequestsDescription')}</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>{t('adminOps.retry')}</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>{t('adminOps.retry')}</button>
      </div>
    );
  }

  if (!stats) return null;

  const dashboard = stats.whale_config_dashboard || {};
  const propagation = dashboard.propagation || stats.whale_config_propagation;
  const anomaly = dashboard.anomaly || stats.whale_config_anomaly;
  const alerts = dashboard.alerts || {};
  const workerSummary = dashboard.worker_summary || {};
  const workerRows = Array.isArray(workerSummary.workers) ? workerSummary.workers.slice(0, 5) : [];
  const prefetch = stats.ticker_prefetch || {};
  const governanceThresholds = systemAiSettings?.governance_delta_thresholds || {};
  const governanceRulebook = systemAiSettings?.governance_delta_rulebook || {};
  const prefetchRulebook = systemAiSettings?.prefetch_runtime_rulebook || {};
  const activePrefetchPolicy = prefetch?.prefetch?.policy || null;

  const syncBtn = (key, label, fn, ...args) => {
    const st = syncStates[key];
    const cooldown = Number(syncCooldowns[key] || 0);
    const inCooldown = cooldown > 0;
    return (
      <button
        disabled={st === 'loading' || inCooldown}
        onClick={() => handleSync(key, fn, ...args)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          st === 'loading'
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : inCooldown
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 cursor-not-allowed'
            : st === 'ok'
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : st === 'error'
            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {st === 'loading'
          ? t('adminOps.syncing')
          : inCooldown
          ? t('adminOps.retryIn', { value: cooldown })
          : st === 'ok'
          ? t('adminOps.done')
          : st === 'error'
          ? t('adminOps.errorShort')
          : label}
      </button>
    );
  };

  const pageBtnClass = (key) => (
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activePage === key
        ? 'bg-blue-600 text-white'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700'
    }`
  );

  // ─── Full render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('adminOps.title')}</h1>
        <button
          onClick={load}
          className="text-xs text-blue-500 hover:underline"
        >
          {t('adminOps.refresh')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={pageBtnClass('overview')} onClick={() => setActivePage('overview')}>Tong quan</button>
        <button className={pageBtnClass('whale')} onClick={() => setActivePage('whale')}>Whale Ops</button>
        <button className={pageBtnClass('governance')} onClick={() => setActivePage('governance')}>Governance</button>
        <button className={pageBtnClass('prefetch')} onClick={() => setActivePage('prefetch')}>Prefetch</button>
        <button className={pageBtnClass('vnstock')} onClick={() => setActivePage('vnstock')}>Vnstock Config</button>
        <button className={pageBtnClass('kpi')} onClick={() => setActivePage('kpi')}>Runtime KPI</button>
      </div>

      {/* Thống kê hệ thống */}
      {activePage === 'overview' ? (<>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.systemStats')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('adminOps.users')} value={stats.user_count} />
          <StatCard label={t('adminOps.portfolios')} value={stats.portfolio_count} />
          <StatCard label={t('adminOps.trackedSymbols')} value={stats.tracked_symbol_count} />
          <StatCard label={t('adminOps.watchlistItems')} value={stats.watchlist_item_count} />
        </div>
      </section>

      {/* Trạng thái Realtime */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.realtimeStatus')}</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('adminOps.channelLayer')}</span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{stats.channel_layer_type}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('adminOps.realtimeEnabled')}</span>
            <StatusBadge ok={stats.realtime_enabled} t={t} />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('adminOps.redis')}</span>
            <StatusBadge ok={stats.redis_ok} t={t} />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('adminOps.prefetchHealth')}</span>
            <PrefetchHealthBadge snapshot={prefetch} t={t} />
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label={t('adminOps.freshness')} value={prefetch.freshness_seconds != null ? `${fmtNumber(prefetch.freshness_seconds)}s` : '—'} />
              <MiniMetric label={t('adminOps.cacheHits')} value={`${fmtNumber(prefetch.sample_cache_hits || 0)}/${fmtNumber(prefetch.sample_cache_total || 0)}`} />
              <MiniMetric label={t('adminOps.prefetchStatus')} value={prefetch.prefetch?.status || '—'} hint={prefetch.prefetch?.retry_after_seconds ? t('adminOps.retryIn', { value: fmtNumber(prefetch.prefetch.retry_after_seconds) }) : (prefetch.prefetch?.reason || '—')} />
            </div>
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminOps.tickerPrefetch')}</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('adminOps.lastRunSummary', { time: fmtDateTime(prefetch.prefetch?.generated_at), symbols: fmtNumber(prefetch.prefetch?.symbols), cached: fmtNumber(prefetch.prefetch?.cached) })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrefetchHealthBadge snapshot={prefetch} t={t} />
                  {prefetch.prefetch?.batch_size ? <Pill tone="blue">{t('adminOps.batch', { value: prefetch.prefetch.batch_size })}</Pill> : null}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KeyValueRow label={t('adminOps.tracked')} value={fmtNumber(prefetch.prefetch?.source_counts?.tracked_symbols)} />
                <KeyValueRow label={t('adminOps.watchlist')} value={fmtNumber(prefetch.prefetch?.source_counts?.watchlist_items)} />
                <KeyValueRow label={t('adminOps.alerts')} value={fmtNumber(prefetch.prefetch?.source_counts?.price_alerts)} />
                <KeyValueRow label={t('adminOps.transactions')} value={fmtNumber(prefetch.prefetch?.source_counts?.portfolio_transactions)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lần sync cuối */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.lastSync')}</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 px-5">
          <SyncRow label={t('adminOps.marketGroups')} log={stats.last_market_group_sync} t={t} />
          <SyncRow label={t('adminOps.stockProfiles')} log={stats.last_stock_profile_sync} t={t} />
        </div>
      </section>

      {/* Shortcuts đồng bộ */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.quickSync')}</h2>
        <div className="flex flex-wrap gap-3">
          {syncBtn('stockprofile', t('adminOps.syncStockProfiles'), syncStockProfile)}
          {syncBtn('watchlist', t('adminOps.syncWatchlistPrices'), syncWatchlistPrices, 5)}
          {syncBtn('marketgroups', t('adminOps.syncMarketGroups'), syncMarketGroups)}
          {syncBtn('prefetchwarmAsync', t('adminOps.triggerPrefetchAsync'), warmTickerPrefetch, 'async')}
          {syncBtn('prefetchwarmSync', t('adminOps.triggerPrefetchSync'), warmTickerPrefetch, 'sync')}
        </div>
      </section>
      </>) : null}

      {activePage === 'whale' ? (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('adminOps.missionControl')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('adminOps.missionControlDescription')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/portfolio/whaleconfigversion/"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('adminOps.openVersions')}
            </a>
            <a
              href="/admin/portfolio/whaleconfigrollout/"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('adminOps.openRollouts')}
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('adminOps.activeVersion')}
            value={dashboard.active_version?.version_code || '—'}
            sub={dashboard.active_version?.activated_at ? t('adminOps.activatedAt', { time: fmtDateTime(dashboard.active_version.activated_at) }) : t('adminOps.noActiveVersion')}
          />
          <StatCard
            label={t('adminOps.pendingRollout')}
            value={dashboard.pending_rollout?.version_code || '—'}
            sub={dashboard.pending_rollout?.effective_from ? t('adminOps.etaAt', { time: fmtDateTime(dashboard.pending_rollout.effective_from) }) : t('adminOps.noPendingRollout')}
          />
          <StatCard
            label={t('adminOps.propagation')}
            value={propagation?.summary || t('adminOps.noRollout')}
            sub={propagation?.version_code ? t('adminOps.versionLabel', { version: propagation.version_code }) : t('adminOps.noActiveRollout')}
          />
          <StatCard
            label={t('adminOps.autoRevertGuard')}
            value={anomaly ? (anomaly.healthy ? t('adminOps.healthyState') : t('adminOps.alertState')) : '—'}
            sub={anomaly?.summary || t('adminOps.noAnomalySnapshot')}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('adminOps.rolloutPostCheck')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('adminOps.rolloutPostCheckDescription')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <RolloutStatusBadge status={dashboard.active_rollout?.status || dashboard.pending_rollout?.status} t={t} />
                <SignalBadge signal={propagation?.signal} t={t} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric
                label={t('adminOps.alerts5m')}
                value={fmtNumber(alerts.last_5m_count)}
                hint={t('adminOps.symbolsCount', { count: fmtNumber(alerts.unique_symbols_last_5m) })}
              />
              <MiniMetric
                label={t('adminOps.alerts10m')}
                value={fmtNumber(alerts.last_10m_count)}
                hint={t('adminOps.symbolsCount', { count: fmtNumber(alerts.unique_symbols_last_10m) })}
              />
              <MiniMetric
                label={t('adminOps.ackWorkers')}
                value={`${fmtNumber(workerSummary.acknowledged_count || 0)}/${fmtNumber(workerSummary.ack_expected_count || 0)}`}
                hint={t('adminOps.staleCount', { count: fmtNumber(workerSummary.stale_ack_count || 0) })}
              />
              <MiniMetric
                label={t('adminOps.workersLive')}
                value={fmtNumber(workerSummary.live_count)}
                hint={workerSummary.source || '—'}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminOps.versionsAndRollout')}</h4>
                <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                  <KeyValueRow label={t('adminOps.activeVersionRow')} value={dashboard.active_version?.version_code || '—'} />
                  <KeyValueRow label={t('adminOps.pendingRolloutRow')} value={dashboard.pending_rollout?.version_code || '—'} />
                  <KeyValueRow label={t('adminOps.rolloutMode')} value={dashboard.active_rollout?.mode || dashboard.pending_rollout?.mode || '—'} />
                  <KeyValueRow label={t('adminOps.propagation')} value={propagation?.summary || t('adminOps.none')} />
                  <KeyValueRow label={t('adminOps.anomalyReason')} value={anomaly?.reason_codes?.join(', ') || t('adminOps.none')} />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminOps.anomalySnapshot')}</h4>
                <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                  <KeyValueRow label={t('adminOps.observed')} value={fmtDateTime(anomaly?.observed_at)} />
                  <KeyValueRow label={t('adminOps.currentAdvisoryRate')} value={anomaly ? `${fmtNumber(anomaly.current_advisory_rate, 2)}/m` : '—'} />
                  <KeyValueRow label={t('adminOps.advisoryRatio')} value={anomaly?.advisory_rate_ratio ?? '—'} />
                  <KeyValueRow label={t('adminOps.tickRatio')} value={anomaly?.tick_rate_ratio ?? '—'} />
                  <KeyValueRow label={t('adminOps.autoRevert')} value={anomaly ? (anomaly.should_auto_revert ? t('adminOps.readyToTrigger') : t('adminOps.notTriggered')) : '—'} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('adminOps.workerSummary')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('adminOps.workerSummaryDescription')}</p>
              </div>
              <Pill tone={workerSummary.ok ? 'green' : 'red'}>{workerSummary.detail || t('adminOps.noWorkers')}</Pill>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label={t('adminOps.cpuTotal')} value={workerSummary.total_cpu_seconds != null ? `${fmtNumber(workerSummary.total_cpu_seconds, 2)}s` : '—'} />
              <MiniMetric label={t('adminOps.ramTotal')} value={workerSummary.total_maxrss_mb != null ? `${fmtNumber(workerSummary.total_maxrss_mb, 1)} MB` : '—'} />
              <MiniMetric label={t('adminOps.poolProc')} value={fmtNumber(workerSummary.pool_process_count || 0)} />
              <MiniMetric label={t('adminOps.statsReady')} value={fmtNumber(workerSummary.reporting_stats_count || 0)} />
            </div>

            <div className="mt-4 space-y-3">
              {workerRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {t('adminOps.noWorkerReport')}
                </div>
              ) : workerRows.map((worker) => (
                <div key={worker.worker_name} className="rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{worker.worker_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{worker.worker_version || t('adminOps.noVersionReported')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={worker.live ? 'green' : 'red'}>{worker.live ? t('adminOps.live') : t('adminOps.offline')}</Pill>
                      <Pill tone={worker.ack_state === 'acked' ? 'green' : worker.ack_state === 'pending' ? 'amber' : worker.ack_state === 'stale' ? 'red' : 'slate'}>
                        {worker.ack_state}
                      </Pill>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>CPU {worker.cpu_user_seconds != null ? `${fmtNumber(worker.cpu_user_seconds, 2)}s` : '—'}</span>
                    <span>SYS {worker.cpu_system_seconds != null ? `${fmtNumber(worker.cpu_system_seconds, 2)}s` : '—'}</span>
                    <span>RAM {worker.maxrss_mb != null ? `${fmtNumber(worker.maxrss_mb, 1)} MB` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>

            {alerts.latest_advisory ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                {t('adminOps.latestAdvisory')}: {alerts.latest_advisory.symbol} · {alerts.latest_advisory.side} · {fmtDateTime(alerts.latest_advisory.created_at)}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {/* S24-04: Runtime KPI Panel */}
      {activePage === 'governance' ? (
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.governanceThresholdsTitle')}</h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('adminOps.governanceThresholdsDescription')}
          </p>
          <form onSubmit={handleThresholdSave} className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.thresholdWarning')}</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={thresholdForm.warning}
                onChange={(event) => handleThresholdInput('warning', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.thresholdCritical')}</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={thresholdForm.critical}
                onChange={(event) => handleThresholdInput('critical', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.thresholdCooldown')}</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={thresholdForm.cooldown}
                onChange={(event) => handleThresholdInput('cooldown', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={thresholdState === 'saving'}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${thresholdState === 'saving' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {thresholdState === 'saving' ? t('adminOps.thresholdSaving') : t('adminOps.thresholdSave')}
              </button>
              {thresholdMessage ? (
                <span className={`text-sm ${thresholdState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {thresholdMessage}
                </span>
              ) : null}
            </div>
          </form>
          <div className="grid gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p>{t('adminOps.thresholdRuleMin', { value: governanceRulebook.warning_min ?? 0 })}</p>
            <p>{t('adminOps.thresholdRuleCritical')}</p>
            <p>{t('adminOps.thresholdRuleDefault', { warning: governanceRulebook.recommended?.warning ?? governanceThresholds.warning ?? '2.0', critical: governanceRulebook.recommended?.critical ?? governanceThresholds.critical ?? '4.0', cooldown: governanceRulebook.recommended?.cooldown ?? governanceThresholds.cooldown ?? '2.0' })}</p>
          </div>
        </div>
      </section>
      ) : null}

      {activePage === 'prefetch' ? (<>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.prefetchSettingsTitle')}</h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('adminOps.prefetchSettingsDescription')}</p>
          <div className="flex flex-wrap gap-3">
            {syncBtn('prefetchwarmAsync', t('adminOps.triggerPrefetchAsync'), warmTickerPrefetch, 'async')}
            {syncBtn('prefetchwarmSync', t('adminOps.triggerPrefetchSync'), warmTickerPrefetch, 'sync')}
          </div>
          <form onSubmit={handlePrefetchSettingsSave} className="grid gap-4 md:grid-cols-3">
            {[
              ['batch_size', t('adminOps.prefetchBatchSize')],
              ['symbol_limit', t('adminOps.prefetchSymbolLimit')],
              ['max_retries', t('adminOps.prefetchMaxRetries')],
              ['retry_base_seconds', t('adminOps.prefetchRetryBase')],
              ['retry_max_seconds', t('adminOps.prefetchRetryMax')],
              ['rate_limit_cooldown_seconds', t('adminOps.prefetchRateLimitCooldown')],
              ['circuit_window_seconds', t('adminOps.prefetchCircuitWindow')],
              ['circuit_breaker_timeout_threshold', t('adminOps.prefetchCircuitThreshold')],
              ['circuit_breaker_cooldown_seconds', t('adminOps.prefetchCircuitCooldown')],
            ].map(([field, label]) => (
              <label key={field} className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prefetchSettingsForm[field]}
                  onChange={(event) => handlePrefetchSettingsInput(field, event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            ))}
            <label className="md:col-span-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={prefetchSettingsForm.include_group_symbols}
                onChange={(event) => handlePrefetchSettingsInput('include_group_symbols', event.target.checked)}
              />
              <span>{t('adminOps.prefetchIncludeGroupSymbols')}</span>
            </label>
            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={prefetchSettingsState === 'saving'}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${prefetchSettingsState === 'saving' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {prefetchSettingsState === 'saving' ? t('adminOps.prefetchSettingsSaving') : t('adminOps.prefetchSettingsSave')}
              </button>
              {prefetchSettingsMessage ? (
                <span className={`text-sm ${prefetchSettingsState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {prefetchSettingsMessage}
                </span>
              ) : null}
            </div>
          </form>
          <div className="grid gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p>{t('adminOps.prefetchRuleMin')}</p>
            <p>{t('adminOps.prefetchRuleRetry')}</p>
            <p>{t('adminOps.prefetchRuleDefault', {
              batch: prefetchRulebook.recommended?.batch_size ?? prefetchSettingsForm.batch_size ?? '20',
              limit: prefetchRulebook.recommended?.symbol_limit ?? prefetchSettingsForm.symbol_limit ?? '40',
              retries: prefetchRulebook.recommended?.max_retries ?? prefetchSettingsForm.max_retries ?? '4',
            })}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('adminOps.prefetchTimePolicyTitle')}</h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('adminOps.prefetchTimePolicyDescription')}</p>
          {Object.keys(prefetchTimePolicyErrors).length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <p className="font-semibold">{t('adminOps.prefetchTimePolicyFieldErrorsTitle')}</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {Object.entries(prefetchTimePolicyErrors).map(([field, message]) => (
                  <li key={field}>{field}: {message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <form onSubmit={handlePrefetchTimePolicySave} className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyTimezone')}</span>
              <input
                value={prefetchTimePolicyForm.timezone}
                onChange={(event) => handlePrefetchTimePolicyInput('timezone', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyOpenTime')}</span>
              <input
                value={prefetchTimePolicyForm.open_time}
                onChange={(event) => handlePrefetchTimePolicyInput('open_time', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyCloseTime')}</span>
              <input
                value={prefetchTimePolicyForm.close_time}
                onChange={(event) => handlePrefetchTimePolicyInput('close_time', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyPreOpenMinutes')}</span>
              <input
                type="number"
                min="0"
                value={prefetchTimePolicyForm.pre_open_minutes}
                onChange={(event) => handlePrefetchTimePolicyInput('pre_open_minutes', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyPostCloseMinutes')}</span>
              <input
                type="number"
                min="0"
                value={prefetchTimePolicyForm.post_close_minutes}
                onChange={(event) => handlePrefetchTimePolicyInput('post_close_minutes', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyWeekendMode')}</span>
              <input
                value={prefetchTimePolicyForm.weekend_mode}
                onChange={(event) => handlePrefetchTimePolicyInput('weekend_mode', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="md:col-span-3 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={prefetchTimePolicyForm.lunch_enabled}
                onChange={(event) => handlePrefetchTimePolicyInput('lunch_enabled', event.target.checked)}
              />
              <span>{t('adminOps.prefetchPolicyLunchEnabled')}</span>
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyLunchStart')}</span>
              <input
                value={prefetchTimePolicyForm.lunch_start}
                onChange={(event) => handlePrefetchTimePolicyInput('lunch_start', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyLunchEnd')}</span>
              <input
                value={prefetchTimePolicyForm.lunch_end}
                onChange={(event) => handlePrefetchTimePolicyInput('lunch_end', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>

            {[
              ['pre_open', t('adminOps.prefetchPolicyProfilePreOpen')],
              ['market_open', t('adminOps.prefetchPolicyProfileMarketOpen')],
              ['lunch_break', t('adminOps.prefetchPolicyProfileLunchBreak')],
              ['pre_close', t('adminOps.prefetchPolicyProfilePreClose')],
              ['post_close', t('adminOps.prefetchPolicyProfilePostClose')],
              ['offhours', t('adminOps.prefetchPolicyProfileOffhours')],
            ].map(([key, label]) => (
              <div key={key} className="md:col-span-3 grid gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-700 md:grid-cols-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(prefetchTimePolicyForm[`${key}_query_enabled`])}
                    onChange={(event) => handlePrefetchTimePolicyInput(`${key}_query_enabled`, event.target.checked)}
                  />
                  <span>{t('adminOps.prefetchPolicyQueryEnabled')}</span>
                </label>
                <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <span>{t('adminOps.prefetchPolicyIntervalSeconds')}</span>
                  <input
                    type="number"
                    min="0"
                    value={prefetchTimePolicyForm[`${key}_interval_seconds`]}
                    onChange={(event) => handlePrefetchTimePolicyInput(`${key}_interval_seconds`, event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  />
                </label>
              </div>
            ))}

            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyJitterPercent')}</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={prefetchTimePolicyForm.jitter_percent}
                onChange={(event) => handlePrefetchTimePolicyInput('jitter_percent', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyCooldownMultiplier')}</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={prefetchTimePolicyForm.cooldown_multiplier_on_429}
                onChange={(event) => handlePrefetchTimePolicyInput('cooldown_multiplier_on_429', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.prefetchPolicyMaxInterval')}</span>
              <input
                type="number"
                min="60"
                value={prefetchTimePolicyForm.max_interval_seconds}
                onChange={(event) => handlePrefetchTimePolicyInput('max_interval_seconds', event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>

            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={prefetchTimePolicyState === 'saving'}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${prefetchTimePolicyState === 'saving' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {prefetchTimePolicyState === 'saving' ? t('adminOps.prefetchTimePolicySaving') : t('adminOps.prefetchTimePolicySave')}
              </button>
              <button
                type="button"
                onClick={handlePrefetchTimePolicyReset}
                disabled={prefetchTimePolicyState === 'saving' || !prefetchTimePolicyInitial}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t('adminOps.prefetchTimePolicyReset')}
              </button>
              {prefetchTimePolicyMessage ? (
                <span className={`text-sm ${prefetchTimePolicyState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {prefetchTimePolicyMessage}
                </span>
              ) : null}
              {activePrefetchPolicy ? (
                <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-3 py-1 dark:bg-blue-900 dark:text-blue-300">
                  {t('adminOps.prefetchPolicyActivePreview', {
                    profile: activePrefetchPolicy.profile || '—',
                    interval: activePrefetchPolicy.effective_interval_seconds ?? '—',
                    query: activePrefetchPolicy.query_enabled ? 'on' : 'off',
                  })}
                </span>
              ) : null}
            </div>
          </form>
          <div className="grid gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p>{t('adminOps.prefetchTimePolicyRuleTime')}</p>
            <p>{t('adminOps.prefetchTimePolicyRuleProfile')}</p>
            <p>{t('adminOps.prefetchTimePolicyRuleGuard')}</p>
            <p>{t('adminOps.prefetchTimePolicyRulebookHint', { format: prefetchTimePolicyRulebook.time_format || 'HH:MM' })}</p>
          </div>
        </div>
      </section>
      </>) : null}

      {activePage === 'vnstock' ? (<>
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Runtime Vnstock Config</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cap nhat cau hinh vnstock runtime khong can restart backend.
          </p>
        </div>

        <VnstockBenchmarkPanel onApplyRecommendation={handleApplyVnstockBenchmarkRecommendation} />

        <form onSubmit={handleVnstockConfigSave} className="grid gap-4 md:grid-cols-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Max Concurrency
            <input
              type="number"
              min="1"
              max="50"
              value={vnstockConfigForm.max_concurrency}
              onChange={(event) => handleVnstockConfigInput('max_concurrency', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Retry Attempts
            <input
              type="number"
              min="0"
              max="5"
              value={vnstockConfigForm.retry_attempts}
              onChange={(event) => handleVnstockConfigInput('retry_attempts', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Retry Backoff (s)
            <input
              type="number"
              min="0"
              max="5"
              step="0.05"
              value={vnstockConfigForm.retry_backoff_seconds}
              onChange={(event) => handleVnstockConfigInput('retry_backoff_seconds', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Rate Limit Cooldown (s)
            <input
              type="number"
              min="5"
              max="120"
              value={vnstockConfigForm.rate_limit_cooldown_seconds}
              onChange={(event) => handleVnstockConfigInput('rate_limit_cooldown_seconds', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Price Board Source
            <input
              type="text"
              value={vnstockConfigForm.price_board_source}
              onChange={(event) => handleVnstockConfigInput('price_board_source', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Fallback Sources (comma separated)
            <input
              type="text"
              value={vnstockConfigForm.fallback_sources}
              onChange={(event) => handleVnstockConfigInput('fallback_sources', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout Price Board (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_price_board} onChange={(event) => handleVnstockConfigInput('timeout_price_board', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout Intraday (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_intraday} onChange={(event) => handleVnstockConfigInput('timeout_intraday', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout Financial Ratio (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_financial_ratio} onChange={(event) => handleVnstockConfigInput('timeout_financial_ratio', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout History (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_history} onChange={(event) => handleVnstockConfigInput('timeout_history', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout Listing (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_listing} onChange={(event) => handleVnstockConfigInput('timeout_listing', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Timeout General (s)
            <input type="number" min="1" max="120" value={vnstockConfigForm.timeout_general} onChange={(event) => handleVnstockConfigInput('timeout_general', event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={vnstockConfigForm.enable_caching} onChange={(event) => handleVnstockConfigInput('enable_caching', event.target.checked)} />
            Enable Caching
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={vnstockConfigForm.enable_rate_limit_detection} onChange={(event) => handleVnstockConfigInput('enable_rate_limit_detection', event.target.checked)} />
            Enable Rate Limit Detection
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={vnstockConfigForm.enable_concurrent_limit} onChange={(event) => handleVnstockConfigInput('enable_concurrent_limit', event.target.checked)} />
            Enable Concurrent Limit
          </label>

          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={vnstockConfigState === 'saving'}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${vnstockConfigState === 'saving' ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {vnstockConfigState === 'saving' ? 'Dang luu...' : 'Luu Runtime Config'}
            </button>
            <button
              type="button"
              disabled={vnstockConfigState === 'saving'}
              onClick={handleVnstockConfigReset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Reset Defaults
            </button>
            {vnstockConfigMessage ? (
              <span className={`text-sm ${vnstockConfigState === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {vnstockConfigMessage}
              </span>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Change Log</h3>
          {vnstockChangelog.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Chua co thay doi nao.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {vnstockChangelog.map((item, index) => (
                <div key={`${item.timestamp || 'ts'}-${index}`} className="rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {fmtDateTime(item.timestamp)} · {item.actor || 'system'} · {item.reason || 'update_config'}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-200">{JSON.stringify(item.changes || {}, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      </>) : null}

      {activePage === 'kpi' ? (
      <section>
        <RuntimeKPIPanel />
      </section>
      ) : null}
    </div>
  );
}
