import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAIOptions,
  getUserConfig,
  getPortfolioUserConfig,
  getTrackedSymbols,
  refreshWhaleAdvisory,
  deleteCurrentWhaleAdvisory,
  getWhaleAdvisories,
  testAIConnection,
  updateUserConfig,
  updatePortfolioUserConfig,
  getAdvisoryAutoRefreshInfo,
} from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import Can from '../components/Can';
import { useI18n } from '../context/LangContext';
import RecommendationCardExplainability from '../components/advisory/RecommendationCardExplainability';
import DataFreshnessBadge from '../components/advisory/DataFreshnessBadge';
import ActionChecklist from '../components/advisory/ActionChecklist';
import RiskModeSelector from '../components/advisory/RiskModeSelector';
import RecommendationHistoryMini from '../components/advisory/RecommendationHistoryMini';
import TrustTelemetryPanel from '../components/advisory/TrustTelemetryPanel';

const FALLBACK_MODELS = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  copilot: ['openai/gpt-4.1-mini', 'openai/gpt-4.1'],
  openclaw: ['default'],
};

const ADVISORY_SCOPE = 'text_advisory';

function buildFallbackModelCatalog(providerMap) {
  return Object.fromEntries(
    Object.entries(providerMap || {}).map(([provider, models]) => [
      provider,
      (models || []).map((model) => ({
        id: model,
        label: model,
        capabilities: [ADVISORY_SCOPE],
        validated_for_runtime: true,
      })),
    ]),
  );
}

function fmtCurrency(value) {
  return Number(value || 0).toLocaleString(undefined);
}

function fmtCompact(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString(undefined);
}

function fmtTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(undefined);
}

function inferConfidence(advisory) {
  if (!advisory) return null;
  if (advisory.confidence !== null && advisory.confidence !== undefined) {
    const parsed = Number(advisory.confidence);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const summary = String(advisory.ai_summary || '');
  const matched = summary.match(/(\d{1,3})%/);
  if (!matched) return null;
  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFreshnessSeconds(ts) {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function getRealtimeStatusByFreshness(secondsAgo) {
  if (secondsAgo === null || secondsAgo === undefined) return 'idle';
  if (secondsAgo <= 30) return 'live';
  if (secondsAgo <= 120) return 'polling';
  return 'idle';
}

// ─── Thống kê mỗi mã ────────────────────────────────────────────
function buildSymbolStats(items) {
  const map = {};
  for (const item of items) {
    const sym = item.symbol;
    if (!map[sym]) {
      map[sym] = { symbol: sym, buyCount: 0, sellCount: 0, totalValue: 0, totalVolume: 0, count: 0 };
    }
    const side = (item.side || '').toUpperCase();
    if (side === 'BUY') map[sym].buyCount += 1;
    else if (side === 'SELL') map[sym].sellCount += 1;
    map[sym].totalValue += Number(item.matched_value || 0);
    map[sym].totalVolume += Number(item.volume || 0);
    map[sym].count += 1;
  }
  // šắp theo tổng giá trị (cao nhất trước)
  return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
}

// ─── Ô cột trái: thông tin mã ──────────────────────────────────
function SymbolCell({ stats, isActive, onClick }) {
  const { t } = useI18n();
  const avgValue = stats.count > 0 ? stats.totalValue / stats.count : 0;
  const whaleAvgPrice = stats.totalVolume > 0 ? stats.totalValue / stats.totalVolume : 0;
  const totalOrders = stats.buyCount + stats.sellCount;
  const buyRatio = totalOrders > 0 ? (stats.buyCount / totalOrders) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 transition-colors ${
        isActive
          ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
          : 'hover:bg-slate-800/60 border-l-2 border-transparent'
      }`}
    >
      {/* Tên mã */}
      <p className={`text-sm font-bold ${isActive ? 'text-cyan-300' : 'text-slate-100'}`}>
        {stats.symbol}
      </p>

      {/* Số lệnh mua/bán */}
      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {t('whaleHub.buy')}: {stats.buyCount}
        </span>
        <span className="flex items-center gap-1 text-rose-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          {t('whaleHub.sell')}: {stats.sellCount}
        </span>
      </div>

      {/* Bar mua/bán */}
      {totalOrders > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rose-900/60">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${buyRatio}%` }}
          />
        </div>
      )}

      {/* Giá trị trung bình */}
      <p className="mt-2 text-xs text-slate-400">
        {t('whaleHub.avgOrder')}: <span className="font-medium text-slate-200">{fmtCompact(avgValue)} VND</span>
      </p>
      {whaleAvgPrice > 0 && (
        <p className="mt-0.5 text-xs text-cyan-400">
          {t('whaleHub.avgPrice')}: <span className="font-medium">{whaleAvgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} VND/CP</span>
        </p>
      )}
      <p className="mt-0.5 text-xs text-slate-500">
        {t('whaleHub.totalOrders', { count: stats.count })} · {fmtCompact(stats.totalValue)} VND
      </p>
    </button>
  );
}

// ─── Ô cột phải: AI Advisory tương ứng ────────────────────────
function AdvisoryCell({ item, symbol, onRefresh, onDeleteCurrent, refreshing, deleting, rowMessage }) {
  const { t } = useI18n();
  const advisory = item || {};
  const resolvedSymbol = String(symbol || item?.symbol || '').toUpperCase();
  const hasAdvisory = Boolean(item);
  const side = (advisory.side || '').toUpperCase();
  const isBuy = side === 'BUY';
  const freshnessSeconds = getFreshnessSeconds(advisory.created_at);
  const realtimeStatus = getRealtimeStatusByFreshness(freshnessSeconds);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            isBuy ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
          }`}>
            {side || 'UNKNOWN'}
          </span>
          {advisory.severity && advisory.severity !== 'info' && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              advisory.severity === 'urgent' ? 'bg-red-900/70 text-red-300 animate-pulse'
              : 'bg-amber-900/60 text-amber-300'
            }`}>
              {advisory.severity === 'urgent'
                ? t('whaleAdvisory.severityUrgent')
                : t('whaleAdvisory.severityWarning')}
            </span>
          )}
          {advisory.advisory_type === 'reversal' && (
            <span className="rounded-full bg-fuchsia-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-fuchsia-300">
              {t('whaleAdvisory.advisoryTypeReversal')}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-100">
            {fmtCompact(advisory.matched_value)} VND
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
          <span>{fmtTime(advisory.created_at)}</span>
          <span className="tracking-widest">{[advisory.ai_provider || 'openclaw', advisory.ai_model || 'default'].join(' / ')}</span>
          {advisory.source && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${
              advisory.source === 'periodic_job' ? 'bg-slate-800 text-slate-400'
              : advisory.source === 'user_refresh' ? 'bg-cyan-900/40 text-cyan-400'
              : 'bg-indigo-900/40 text-indigo-400'
            }`}>
              {advisory.source === 'periodic_job' ? 'Auto' : advisory.source === 'user_refresh' ? 'Manual' : advisory.source}
              {advisory.refresh_count > 0 && ` ×${advisory.refresh_count}`}
            </span>
          )}
          {Array.isArray(advisory.merged_sources) && advisory.merged_sources.length > 1 ? (
            <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] text-violet-300">
              Merged: {advisory.merged_sources.join(' + ')}
            </span>
          ) : null}
          {advisory.primary_source ? (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
              Primary: {advisory.primary_source}
            </span>
          ) : null}
          <DataFreshnessBadge
            lastEventAt={advisory.created_at}
            realtimeStatus={realtimeStatus}
            compact
          />
        </div>
      </div>

      <div className="mt-3">
        {hasAdvisory ? (
          <RecommendationCardExplainability
            advisory={advisory}
            freshnessSeconds={freshnessSeconds}
            realtimeStatus={realtimeStatus}
          />
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
            {t('whaleAdvisory.noAdvisory')}
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
        <p className="text-xs leading-6 whitespace-pre-line text-slate-300">
          {hasAdvisory ? (advisory.ai_summary || t('whaleHub.noAiSummary')) : t('whaleAdvisory.noAdvisory')}
        </p>
      </div>

      {/* AI Detail (Premium) */}
      <Can
        I="read"
        a="WhaleAdvisoryDetail"
        fallback={
          <Link
            to="/upgrade"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
          >
            🔒 {t('whaleHub.deepAnalysis')}
          </Link>
        }
      >
        {hasAdvisory && advisory.ai_detail ? (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-xs leading-6 whitespace-pre-line text-slate-400">
              {advisory.ai_detail}
            </p>
          </div>
        ) : null}
      </Can>

      {/* Liên kết nhanh */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => onRefresh?.(resolvedSymbol)}
          disabled={Boolean(refreshing) || Boolean(deleting)}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {refreshing ? t('whaleAdvisory.refreshing') : t('whaleAdvisory.refreshAi')}
        </button>
        <button
          type="button"
          onClick={() => onDeleteCurrent?.(resolvedSymbol)}
          disabled={!hasAdvisory || Boolean(refreshing) || Boolean(deleting)}
          className="inline-flex items-center justify-center rounded-md border border-rose-800/60 bg-rose-950/40 px-2.5 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? 'Đang xóa...' : 'Xóa advisory hiện tại'}
        </button>
        <Link
          to={`/whale-alerts/${resolvedSymbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {t('whaleHub.openSymbolDashboard')}
        </Link>
        <Link
          to={`/stocks/${resolvedSymbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {t('whaleHub.openStockWorkspace')}
        </Link>
      </div>
      {rowMessage ? (
        <p className="mt-2 text-xs text-cyan-300">{rowMessage}</p>
      ) : null}

      {hasAdvisory ? (
        <div className="mt-3">
          <ActionChecklist
            symbol={resolvedSymbol}
            isBlocked={freshnessSeconds !== null && freshnessSeconds > 120}
            blockedReason={
              freshnessSeconds !== null && freshnessSeconds > 120
                ? t('actionChecklist.blockedDefault', { defaultValue: 'Dữ liệu không đủ tin cậy để tiến hành. Hãy làm mới và xem lại khuyến nghị.' })
                : ''
            }
            onProceed={() => onRefresh?.(resolvedSymbol)}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─── Hàng của bảng ────────────────────────────────────────────
function TableRow({ stats, allItems, isFirst, isLast }) {
  const { t } = useI18n();
  const symbolItems = allItems.filter(i => i.symbol === stats.symbol);
  // Lấy advisory mới nhất của mã này
  const latest = symbolItems[0] || null;

  return (
    <div className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${
      isFirst ? '' : 'border-t border-slate-800'
    }`}>
      {/* Cột trái */}
      <div className="flex items-start">
        <SymbolCell stats={stats} isActive={false} onClick={() => {}} />
      </div>

      {/* Cột phải */}
      <div>
        {latest ? (
          <AdvisoryCell item={latest} />
        ) : (
          <div className="flex h-full items-center p-4 text-xs text-slate-600">
            {t('whaleAdvisory.noAdvisory')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function WhaleAdvisory() {
  const { userPlan } = usePortfolio();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiProviders, setAiProviders] = useState(FALLBACK_MODELS);
  const [aiModelCatalog, setAiModelCatalog] = useState(buildFallbackModelCatalog(FALLBACK_MODELS));
  const [aiProvider, setAiProvider] = useState('openclaw');
  const [aiModel, setAiModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [pendingRefreshSymbols, setPendingRefreshSymbols] = useState({});
  const [pendingDeleteSymbols, setPendingDeleteSymbols] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [refreshMessage, setRefreshMessage] = useState('');
  const [riskMode, setRiskMode] = useState(() => {
    const stored = localStorage.getItem('vninvest:risk-mode');
    if (stored === 'conservative' || stored === 'balanced' || stored === 'aggressive') {
      return stored;
    }
    return 'balanced';
  });
  const [riskModeNotice, setRiskModeNotice] = useState('');
  const [activeSymbol, setActiveSymbol] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [advisoryFilter, setAdvisoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('symbol_asc');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  // Advisory schedule settings
  const [scheduleAutoEnabled, setScheduleAutoEnabled] = useState(true);
  const [scheduleIntervalHours, setScheduleIntervalHours] = useState(24);
  const [scheduleMaxRefreshes, setScheduleMaxRefreshes] = useState(24);
  const [scheduleMaxTokens, setScheduleMaxTokens] = useState(5000);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  // Selected symbol auto-refresh quota
  const [refreshInfo, setRefreshInfo] = useState(null);

    // Advisory list filters
    const [watchlistOnly, setWatchlistOnly] = useState(false);

  const fetchDataSnapshot = useCallback(async () => {
    const [advisoryResp, trackedResp] = await Promise.all([
      getWhaleAdvisories(watchlistOnly ? { watchlist_only: 'true' } : {}),
      getTrackedSymbols(),
    ]);
    const advisories = advisoryResp.data || [];
    const tracked = trackedResp.data || [];
    setItems(advisories);
    setTrackedSymbols(tracked);
    return advisories;
  }, [watchlistOnly]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await fetchDataSnapshot();
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleAdvisory.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [fetchDataSnapshot, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let mounted = true;

    async function fetchAiSettings() {
      try {
        const [optionsResult, aiCfgResult, userCfgResult] = await Promise.allSettled([
          getAIOptions(),
          getUserConfig(),
          getPortfolioUserConfig(),
        ]);
        if (!mounted) return;

        const optionsResp = optionsResult.status === 'fulfilled' ? optionsResult.value : null;
        const aiCfgResp = aiCfgResult.status === 'fulfilled' ? aiCfgResult.value : null;
        const userCfgResp = userCfgResult.status === 'fulfilled' ? userCfgResult.value : null;

        const providers = optionsResp?.data?.providers || FALLBACK_MODELS;
        const modelCatalog = optionsResp?.data?.model_catalog || buildFallbackModelCatalog(providers);
        const cfg = aiCfgResp?.data || {};
        const userCfg = userCfgResp?.data || {};
        const provider = (cfg.ai_provider || 'openclaw').toLowerCase();
        const model = (cfg.ai_model || '').trim();

        setAiProviders(providers);
        setAiModelCatalog(modelCatalog);
        setAiProvider(provider);
        setAiModel(model);
        setAiKeyConfigured(Boolean(cfg.ai_api_key_configured));
        setAiReady(Boolean(cfg.ai_ready));

        // Load advisory schedule settings
        if (userCfg.advisory_auto_generation_enabled !== undefined) {
          setScheduleAutoEnabled(Boolean(userCfg.advisory_auto_generation_enabled));
        }
        if (userCfg.advisory_refresh_interval_hours !== undefined) {
          setScheduleIntervalHours(Number(userCfg.advisory_refresh_interval_hours) || 24);
        }
        if (userCfg.advisory_max_auto_refreshes_per_day !== undefined) {
          setScheduleMaxRefreshes(Number(userCfg.advisory_max_auto_refreshes_per_day) || 24);
        }
        if (userCfg.advisory_max_tokens_per_day !== undefined) {
          setScheduleMaxTokens(Number(userCfg.advisory_max_tokens_per_day) || 5000);
        }
      } catch (_) {
        // Không chặn trang advisory khi API options lỗi.
      }
    }

    fetchAiSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const modelOptionEntries = useMemo(() => {
    const entries = aiModelCatalog[aiProvider] || [];
    const filtered = entries.filter((entry) => {
      const capabilities = Array.isArray(entry?.capabilities) ? entry.capabilities : [];
      return Boolean(entry?.validated_for_runtime) && capabilities.includes(ADVISORY_SCOPE);
    });
    if (filtered.length > 0) {
      return filtered;
    }
    return (aiProviders[aiProvider] || []).map((model) => ({
      id: model,
      label: model,
      capabilities: [ADVISORY_SCOPE],
      validated_for_runtime: true,
    }));
  }, [aiModelCatalog, aiProvider, aiProviders]);

  const modelOptions = useMemo(() => modelOptionEntries.map((entry) => entry.id), [modelOptionEntries]);

  useEffect(() => {
    if (aiModel && !modelOptions.includes(aiModel)) {
      setAiModel('');
    }
  }, [aiModel, modelOptions]);

  const hasSelectedAiModel = Boolean(aiModel);

  const ensureAiConfigured = useCallback(async (symbol) => {
    try {
      const cfgResp = await getUserConfig();
      const cfg = cfgResp?.data || {};
      const ready = Boolean(cfg.ai_ready);
      setAiKeyConfigured(Boolean(cfg.ai_api_key_configured));
      setAiReady(ready);
      setAiModel((cfg.ai_model || '').trim());
      setAiProvider((cfg.ai_provider || 'openclaw').toLowerCase());
      if (ready) {
        return true;
      }
      setRowMessages((prev) => ({
        ...prev,
        [symbol]: cfg.ai_config_message || t('whaleAdvisory.configRequired'),
      }));
      return false;
    } catch (err) {
      setRowMessages((prev) => ({
        ...prev,
        [symbol]: err?.response?.data?.message || err?.response?.data?.detail || t('whaleAdvisory.configCheckFailed'),
      }));
      return false;
    }
  }, [t]);

  const handleSaveAiConfig = useCallback(async () => {
    setSavingAi(true);
    setAiMessage('');
    if (!aiModel) {
      setAiMessage(t('whaleAdvisory.modelRequired'));
      setSavingAi(false);
      return;
    }
    try {
      const payload = {
        ai_provider: aiProvider,
        ai_model: aiModel,
      };
      if (apiKey.trim()) {
        payload.ai_api_key = apiKey.trim();
      }
      const resp = await updateUserConfig(payload);
      setAiKeyConfigured(Boolean(resp?.data?.ai_api_key_configured) || Boolean(apiKey.trim()));
      setAiReady(Boolean(resp?.data?.ai_ready));
      setApiKey('');
      setAiMessage(t('whaleAdvisory.saveSuccess'));
    } catch (err) {
      setAiMessage(err?.response?.data?.detail || t('whaleAdvisory.saveFailed'));
    } finally {
      setSavingAi(false);
    }
  }, [aiModel, aiProvider, apiKey, t]);

  const handleTestAiConnection = useCallback(async () => {
    setTestingAi(true);
    setAiMessage('');
    if (!aiModel) {
      setAiMessage(t('whaleAdvisory.modelRequired'));
      setTestingAi(false);
      return;
    }
    try {
      const payload = {
        ai_provider: aiProvider,
        ai_model: aiModel,
      };
      if (apiKey.trim()) {
        payload.ai_api_key = apiKey.trim();
      }
      const resp = await testAIConnection(payload);
      const message = resp?.data?.message || t('whaleAdvisory.testSuccess');
      setAiMessage(message);
    } catch (err) {
      setAiMessage(err?.response?.data?.message || t('whaleAdvisory.testFailed'));
    } finally {
      setTestingAi(false);
    }
  }, [aiModel, aiProvider, apiKey, t]);

  const handleSaveSchedule = useCallback(async () => {
    setSavingSchedule(true);
    setScheduleMessage('');
    try {
      await updatePortfolioUserConfig({
        advisory_auto_generation_enabled: scheduleAutoEnabled,
        advisory_refresh_interval_hours: Math.max(1, Number(scheduleIntervalHours) || 24),
        advisory_max_auto_refreshes_per_day: Math.max(1, Number(scheduleMaxRefreshes) || 24),
        advisory_max_tokens_per_day: Math.max(100, Number(scheduleMaxTokens) || 5000),
      });
      setScheduleMessage(t('whaleAdvisory.scheduleSaveSuccess'));
    } catch (err) {
      setScheduleMessage(err?.response?.data?.detail || t('whaleAdvisory.scheduleSaveFailed'));
    } finally {
      setSavingSchedule(false);
    }
  }, [scheduleAutoEnabled, scheduleIntervalHours, scheduleMaxRefreshes, scheduleMaxTokens, t]);

  const handleLoadRefreshInfo = useCallback(async (symbol) => {
    if (!symbol) return;
    try {
      const resp = await getAdvisoryAutoRefreshInfo(symbol);
      setRefreshInfo(resp?.data || null);
    } catch (_) {
      setRefreshInfo(null);
    }
  }, []);

  useEffect(() => {
    if (activeSymbol) {
      handleLoadRefreshInfo(activeSymbol);
    } else {
      setRefreshInfo(null);
    }
  }, [activeSymbol, handleLoadRefreshInfo]);

  const handleRefreshAdvisory = useCallback(async (symbol) => {
    if (!symbol) return;
    if (pendingRefreshSymbols[symbol]) {
      return;
    }
    if (!(await ensureAiConfigured(symbol))) {
      return;
    }
    const baselineMs = (() => {
      const latestForSymbol = items
        .filter((entry) => String(entry?.symbol || '').toUpperCase() === symbol)
        .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0];
      const parsed = latestForSymbol?.created_at ? new Date(latestForSymbol.created_at).getTime() : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    })();

    setPendingRefreshSymbols((prev) => ({ ...prev, [symbol]: true }));
    setRowMessages((prev) => ({ ...prev, [symbol]: '' }));
    try {
      const resp = await refreshWhaleAdvisory(symbol);
      setRowMessages((prev) => ({
        ...prev,
        [symbol]: resp?.data?.message || t('whaleAdvisory.refreshQueued', { symbol }),
      }));

      let done = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const advisories = await fetchDataSnapshot();
        const latestForSymbol = advisories
          .filter((entry) => String(entry?.symbol || '').toUpperCase() === symbol)
          .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0];
        const currentMs = latestForSymbol?.created_at ? new Date(latestForSymbol.created_at).getTime() : 0;
        if (Number.isFinite(currentMs) && currentMs > baselineMs) {
          done = true;
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
      }

      if (!done) {
        setRowMessages((prev) => ({
          ...prev,
          [symbol]: t('whaleAdvisory.refreshQueued', { symbol }),
        }));
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.detail || t('whaleAdvisory.refreshFailed');
      setRowMessages((prev) => ({ ...prev, [symbol]: message }));
    } finally {
      setPendingRefreshSymbols((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [ensureAiConfigured, fetchDataSnapshot, items, pendingRefreshSymbols, t]);

  const handleDeleteCurrentAdvisory = useCallback(async (symbol) => {
    if (!symbol) return;
    if (pendingDeleteSymbols[symbol] || pendingRefreshSymbols[symbol]) {
      return;
    }

    setPendingDeleteSymbols((prev) => ({ ...prev, [symbol]: true }));
    setRowMessages((prev) => ({ ...prev, [symbol]: '' }));
    try {
      const resp = await deleteCurrentWhaleAdvisory(symbol);
      await fetchDataSnapshot();
      setRowMessages((prev) => ({
        ...prev,
        [symbol]: resp?.data?.message || 'Đã xóa advisory hiện tại.',
      }));
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.detail || 'Không thể xóa advisory hiện tại.';
      setRowMessages((prev) => ({ ...prev, [symbol]: message }));
    } finally {
      setPendingDeleteSymbols((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  }, [fetchDataSnapshot, pendingDeleteSymbols, pendingRefreshSymbols]);

  const filteredItems = useMemo(() => {
    if (riskMode === 'aggressive') return items;
    return items.filter((item) => {
      const confidence = inferConfidence(item);
      if (confidence === null) return riskMode !== 'conservative';
      if (riskMode === 'conservative') return confidence >= 70;
      return confidence >= 40;
    });
  }, [items, riskMode]);

  const trackedSymbolList = useMemo(() => {
    const seen = new Set();
    const symbols = [];
    (trackedSymbols || []).forEach((item) => {
      const symbol = String(item?.symbol || '').trim().toUpperCase();
      if (!symbol || seen.has(symbol)) return;
      seen.add(symbol);
      symbols.push(symbol);
    });
    return symbols;
  }, [trackedSymbols]);

  const symbolStatsMap = useMemo(() => {
    const stats = buildSymbolStats(filteredItems);
    return Object.fromEntries((stats || []).map((row) => [row.symbol, row]));
  }, [filteredItems]);

  const latestBySymbol = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime();
      const tb = new Date(b?.created_at || 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
    const map = {};
    sorted.forEach((item) => {
      const symbol = String(item?.symbol || '').trim().toUpperCase();
      if (!symbol || map[symbol]) return;
      map[symbol] = item;
    });
    return map;
  }, [filteredItems]);

  const advisoryRows = useMemo(() => {
    return trackedSymbolList.map((symbol) => {
      const stats = symbolStatsMap[symbol] || {
        symbol,
        buyCount: 0,
        sellCount: 0,
        totalValue: 0,
        totalVolume: 0,
        count: 0,
      };
      const latest = latestBySymbol[symbol] || null;
      const latestTs = latest?.created_at || null;
      return {
        symbol,
        stats,
        latest,
        hasAdvisory: Boolean(latest),
        latestTs,
        confidence: inferConfidence(latest),
      };
    });
  }, [latestBySymbol, symbolStatsMap, trackedSymbolList]);

  const searchedRows = useMemo(() => {
    const keyword = String(symbolSearch || '').trim().toUpperCase();
    if (!keyword) return advisoryRows;
    return advisoryRows.filter((row) => row.symbol.includes(keyword));
  }, [advisoryRows, symbolSearch]);

  const filteredRows = useMemo(() => {
    if (advisoryFilter === 'with_advisory') {
      return searchedRows.filter((row) => row.hasAdvisory);
    }
    if (advisoryFilter === 'no_advisory') {
      return searchedRows.filter((row) => !row.hasAdvisory);
    }
    if (advisoryFilter === 'buy_dominant') {
      return searchedRows.filter((row) => row.stats.buyCount > row.stats.sellCount);
    }
    if (advisoryFilter === 'sell_dominant') {
      return searchedRows.filter((row) => row.stats.sellCount > row.stats.buyCount);
    }
    return searchedRows;
  }, [advisoryFilter, searchedRows]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    const safeDate = (value) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const safeNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : -Infinity);

    if (sortBy === 'symbol_desc') {
      rows.sort((a, b) => b.symbol.localeCompare(a.symbol));
      return rows;
    }
    if (sortBy === 'value_desc') {
      rows.sort((a, b) => safeNumber(b.stats.totalValue) - safeNumber(a.stats.totalValue));
      return rows;
    }
    if (sortBy === 'value_asc') {
      rows.sort((a, b) => safeNumber(a.stats.totalValue) - safeNumber(b.stats.totalValue));
      return rows;
    }
    if (sortBy === 'recent_desc') {
      rows.sort((a, b) => safeDate(b.latestTs) - safeDate(a.latestTs));
      return rows;
    }
    if (sortBy === 'recent_asc') {
      rows.sort((a, b) => safeDate(a.latestTs) - safeDate(b.latestTs));
      return rows;
    }
    if (sortBy === 'confidence_desc') {
      rows.sort((a, b) => safeNumber(b.confidence) - safeNumber(a.confidence));
      return rows;
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  }, [filteredRows, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  useEffect(() => {
    localStorage.setItem('vninvest:risk-mode', riskMode);
    setRiskModeNotice(t('riskMode.updatedNotice', { defaultValue: 'View updated by risk mode' }));
    const id = window.setTimeout(() => setRiskModeNotice(''), 2500);
    return () => window.clearTimeout(id);
  }, [riskMode, t]);

  useEffect(() => {
    setPage(1);
  }, [symbolSearch, advisoryFilter, sortBy, pageSize]);

  useEffect(() => {
    if (!sortedRows.length) {
      setActiveSymbol('');
      return;
    }
    if (!activeSymbol || !sortedRows.some((row) => row.symbol === activeSymbol)) {
      setActiveSymbol(sortedRows[0].symbol);
    }
  }, [activeSymbol, sortedRows]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 xl:px-5">
      {/* Header */}
      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">{t('whaleAdvisory.intelligence')}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">{t('whaleAdvisory.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {t('whaleAdvisory.description')}{' '}
              <span className="font-semibold text-cyan-300">{userPlan || 'free'}</span>.
            </p>
          </div>
          <button type="button" onClick={fetchData} className="btn-primary">
            {t('whaleAdvisory.refresh')}
          </button>
        </div>
      </section>

      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-label">{t('whaleAdvisory.providerConfig')}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('whaleAdvisory.providerTitle')}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {t('whaleAdvisory.apiKeyStatus', { status: aiKeyConfigured ? t('whaleAdvisory.configured') : t('whaleAdvisory.notConfigured') })}.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.provider')}
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              {Object.keys(aiProviders).map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.model')}
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            >
              <option value="">{t('whaleAdvisory.selectModel')}</option>
              {modelOptionEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.apiKeyOptional')}
            <div className="mt-1 flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('whaleAdvisory.apiKeyPlaceholder')}
              />
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"
                onClick={() => setShowApiKey((prev) => !prev)}
              >
                {showApiKey ? t('whaleAdvisory.hide') : t('whaleAdvisory.show')}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAiConfig}
            disabled={savingAi}
          >
            {savingAi ? t('whaleAdvisory.saving') : t('whaleAdvisory.saveConfig')}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
            onClick={handleTestAiConnection}
            disabled={testingAi}
          >
            {testingAi ? t('whaleAdvisory.testing') : t('whaleAdvisory.testConnection')}
          </button>
        </div>

        {aiMessage && (
          <p className="mt-3 text-xs text-cyan-300">{aiMessage}</p>
        )}
        {!aiReady && (
          <p className="mt-2 text-xs text-amber-300">
            {t('whaleAdvisory.configRequired')}
          </p>
        )}
      </section>

      {/* Advisory Auto-Generation Schedule Settings */}
      <section className="card-section px-5 py-4">
        <div className="mb-3">
          <p className="text-label">{t('whaleAdvisory.scheduleSection')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('whaleAdvisory.scheduleTitle')}</h2>
          <p className="mt-1 text-xs text-slate-400">{t('whaleAdvisory.scheduleDesc')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500"
              checked={scheduleAutoEnabled}
              onChange={(e) => setScheduleAutoEnabled(e.target.checked)}
            />
            {t('whaleAdvisory.scheduleAutoEnabled')}
          </label>

          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.scheduleInterval')}
            <input
              type="number"
              min="1"
              max="720"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={scheduleIntervalHours}
              onChange={(e) => setScheduleIntervalHours(e.target.value)}
            />
          </label>

          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.scheduleMaxRefreshes')}
            <input
              type="number"
              min="1"
              max="100"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={scheduleMaxRefreshes}
              onChange={(e) => setScheduleMaxRefreshes(e.target.value)}
            />
          </label>

          <label className="text-xs text-slate-400">
            {t('whaleAdvisory.scheduleMaxTokens')}
            <input
              type="number"
              min="100"
              max="100000"
              step="100"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={scheduleMaxTokens}
              onChange={(e) => setScheduleMaxTokens(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveSchedule}
            disabled={savingSchedule}
          >
            {savingSchedule ? t('whaleAdvisory.saving') : t('whaleAdvisory.scheduleSave')}
          </button>
        </div>
        {scheduleMessage && (
          <p className="mt-2 text-xs text-cyan-300">{scheduleMessage}</p>
        )}
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 px-5 py-4 text-sm text-rose-200">
          {error}
        </section>
      )}

      {refreshMessage && (
        <section className="rounded-2xl border border-cyan-800/60 bg-cyan-950/20 px-5 py-4 text-sm text-cyan-200">
          {refreshMessage}
        </section>
      )}

      {/* Advisory quota info for active symbol */}
      {activeSymbol && refreshInfo && (
        <section className="card-section px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">{activeSymbol}</span>
              <span>—</span>
              <span>
                {t('whaleAdvisory.quotaAutoRefresh')}{' '}
                <span className={refreshInfo.auto_refreshes_remaining_today === 0 ? 'text-rose-400' : 'text-cyan-300'}>
                  {refreshInfo.auto_refreshes_used_today ?? '—'} / {refreshInfo.advisory_max_auto_refreshes_per_day ?? '—'}
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                {t('whaleAdvisory.quotaTokens')}{' '}
                <span className={(refreshInfo.tokens_remaining_today ?? 0) < 500 ? 'text-amber-400' : 'text-slate-300'}>
                  {(refreshInfo.tokens_remaining_today ?? 0).toLocaleString()}
                </span>
              </span>
            </div>
            {refreshInfo.next_refresh_at && (
              <span className="text-slate-500">
                {t('whaleAdvisory.nextRefreshAt')}{' '}
                <span className="text-slate-300">{fmtTime(refreshInfo.next_refresh_at)}</span>
              </span>
            )}
          </div>
        </section>
      )}

      <section className="card-section px-5 py-4 space-y-3">
        <RiskModeSelector
          symbol={activeSymbol || sortedRows[0]?.symbol || ''}
          value={riskMode}
          onChange={setRiskMode}
        />
        {riskModeNotice && (
          <p className="text-xs text-cyan-300">{riskModeNotice}</p>
        )}
      </section>

      <section className="card-section px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value.toUpperCase())}
              placeholder={t('whaleAdvisory.searchSymbolPlaceholder')}
              className="w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
            <select
              value={advisoryFilter}
              onChange={(e) => setAdvisoryFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">{t('whaleAdvisory.filterAll')}</option>
              <option value="with_advisory">{t('whaleAdvisory.filterWithAdvisory')}</option>
              <option value="no_advisory">{t('whaleAdvisory.filterNoAdvisory')}</option>
              <option value="buy_dominant">{t('whaleAdvisory.filterBuyDominant')}</option>
              <option value="sell_dominant">{t('whaleAdvisory.filterSellDominant')}</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="symbol_asc">{t('whaleAdvisory.sortSymbolAsc')}</option>
              <option value="symbol_desc">{t('whaleAdvisory.sortSymbolDesc')}</option>
              <option value="value_desc">{t('whaleAdvisory.sortValueDesc')}</option>
              <option value="value_asc">{t('whaleAdvisory.sortValueAsc')}</option>
              <option value="recent_desc">{t('whaleAdvisory.sortRecentDesc')}</option>
              <option value="recent_asc">{t('whaleAdvisory.sortRecentAsc')}</option>
              <option value="confidence_desc">{t('whaleAdvisory.sortConfidenceDesc')}</option>
            </select>
          </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-cyan-500"
                checked={watchlistOnly}
                onChange={(e) => setWatchlistOnly(e.target.checked)}
              />
              {t('whaleAdvisory.watchlistOnly')}
            </label>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{t('whaleAdvisory.pageSize')}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 20)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
            >
              {[10, 15, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Bảng */}
      <section className="card-section overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[220px_1fr] divide-x divide-slate-800 border-b border-slate-700 bg-slate-900/70">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('whaleAdvisory.tableSymbolStats')}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t('whaleAdvisory.tableLatest')}
            </p>
          </div>
        </div>

        {/* Rows */}
        {loading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${
                  i > 0 ? 'border-t border-slate-800' : ''
                }`}
              >
                <div className="p-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-800" />
                  <div className="mt-1 h-3 w-20 animate-pulse rounded bg-slate-800" />
                </div>
                <div className="p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
                  <div className="mt-2 h-12 animate-pulse rounded bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-400">
              {trackedSymbolList.length === 0 ? t('whaleAdvisory.emptyTrackedTitle') : t('whaleAdvisory.noMatchFilter')}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {trackedSymbolList.length === 0 ? t('whaleAdvisory.emptyTrackedDescription') : t('whaleAdvisory.emptyDescription')}
            </p>
          </div>
        ) : (
          <div>
            {pagedRows.map((row, idx) => {
              const latest = row.latest;
              const isActive = activeSymbol === row.symbol;

              return (
                <div key={row.symbol} className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${idx > 0 ? 'border-t border-slate-800' : ''}`}>
                  {/* Cột trái */}
                  <div>
                    <SymbolCell
                      stats={row.stats}
                      isActive={isActive}
                      onClick={() => setActiveSymbol(row.symbol)}
                    />
                  </div>

                  {/* Cột phải: Advisory mới nhất */}
                  <div>
                    <AdvisoryCell
                      item={latest}
                      symbol={row.symbol}
                      onRefresh={handleRefreshAdvisory}
                      onDeleteCurrent={handleDeleteCurrentAdvisory}
                      refreshing={Boolean(pendingRefreshSymbols[row.symbol])}
                      deleting={Boolean(pendingDeleteSymbols[row.symbol])}
                      rowMessage={rowMessages[row.symbol] || ''}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
              <span>
                {t('whaleAdvisory.paginationSummary', {
                  from: ((currentPage - 1) * pageSize) + 1,
                  to: Math.min(currentPage * pageSize, sortedRows.length),
                  total: sortedRows.length,
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 disabled:opacity-40"
                >
                  {t('whaleAdvisory.prevPage')}
                </button>
                <span>{t('whaleAdvisory.pageLabel', { page: currentPage, total: totalPages })}</span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 disabled:opacity-40"
                >
                  {t('whaleAdvisory.nextPage')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {activeSymbol && (
        <section className="card-section px-5 py-4">
          <RecommendationHistoryMini symbol={activeSymbol} limit={5} />
        </section>
      )}

      <section className="card-section px-5 py-4">
        <TrustTelemetryPanel />
      </section>
    </div>
  );
}
