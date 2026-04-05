import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAIOptions,
  getUserConfig,
  refreshWhaleAdvisory,
  getWhaleAdvisories,
  testAIConnection,
  updateUserConfig,
} from '../api/client';
import { usePortfolio } from '../context/PortfolioContext';
import Can from '../components/Can';
import { useI18n } from '../context/LangContext';

const FALLBACK_MODELS = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  copilot: ['openai/gpt-4.1-mini', 'openai/gpt-4.1'],
  openclaw: ['default'],
};

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
function AdvisoryCell({ item, onRefresh, refreshing }) {
  const { t } = useI18n();
  const side = (item.side || '').toUpperCase();
  const isBuy = side === 'BUY';

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
          <span className="text-xs font-semibold text-slate-100">
            {fmtCompact(item.matched_value)} VND
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
          <span>{fmtTime(item.created_at)}</span>
          <span className="uppercase tracking-widest">{item.ai_provider || 'openclaw'}</span>
        </div>
      </div>

      {/* AI Summary */}
      <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
        <p className="text-xs leading-6 whitespace-pre-line text-slate-300">
          {item.ai_summary || t('whaleHub.noAiSummary')}
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
        {item.ai_detail ? (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-xs leading-6 whitespace-pre-line text-slate-400">
              {item.ai_detail}
            </p>
          </div>
        ) : null}
      </Can>

      {/* Liên kết nhanh */}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => onRefresh?.(item.symbol)}
          disabled={Boolean(refreshing)}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {refreshing ? t('whaleAdvisory.refreshing') : t('whaleAdvisory.refreshAi')}
        </button>
        <Link
          to={`/whale-alerts/${item.symbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {t('whaleHub.openSymbolDashboard')}
        </Link>
        <Link
          to={`/stocks/${item.symbol}`}
          className="btn-secondary inline-flex items-center justify-center text-[11px]"
        >
          {t('whaleHub.openStockWorkspace')}
        </Link>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiProviders, setAiProviders] = useState(FALLBACK_MODELS);
  const [aiProvider, setAiProvider] = useState('openclaw');
  const [aiModel, setAiModel] = useState('default');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiKeyConfigured, setAiKeyConfigured] = useState(false);
  const [refreshingSymbol, setRefreshingSymbol] = useState('');
  const [refreshMessage, setRefreshMessage] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getWhaleAdvisories();
      setItems(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || t('whaleAdvisory.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let mounted = true;

    async function fetchAiSettings() {
      try {
        const [optionsResp, cfgResp] = await Promise.all([getAIOptions(), getUserConfig()]);
        if (!mounted) return;

        const providers = optionsResp?.data?.providers || FALLBACK_MODELS;
        const cfg = cfgResp?.data || {};
        const provider = (cfg.ai_provider || 'openclaw').toLowerCase();
        const providerModels = providers[provider] || FALLBACK_MODELS[provider] || ['default'];
        const model = cfg.ai_model || providerModels[0] || 'default';

        setAiProviders(providers);
        setAiProvider(provider);
        setAiModel(model);
        setAiKeyConfigured(Boolean(cfg.ai_api_key_configured));
      } catch (_) {
        // Không chặn trang advisory khi API options lỗi.
      }
    }

    fetchAiSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const modelOptions = useMemo(() => aiProviders[aiProvider] || ['default'], [aiProvider, aiProviders]);

  useEffect(() => {
    if (!modelOptions.includes(aiModel)) {
      setAiModel(modelOptions[0] || 'default');
    }
  }, [aiModel, modelOptions]);

  const handleSaveAiConfig = useCallback(async () => {
    setSavingAi(true);
    setAiMessage('');
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

  const handleRefreshAdvisory = useCallback(async (symbol) => {
    if (!symbol) return;
    setRefreshingSymbol(symbol);
    setRefreshMessage('');
    try {
      const resp = await refreshWhaleAdvisory(symbol);
      setRefreshMessage(resp?.data?.message || t('whaleAdvisory.refreshQueued', { symbol }));
      await fetchData();
    } catch (err) {
      const message = err?.response?.data?.message || t('whaleAdvisory.refreshFailed');
      setRefreshMessage(message);
    } finally {
      setRefreshingSymbol('');
    }
  }, [fetchData, t]);

  const symbolStats = useMemo(() => buildSymbolStats(items), [items]);

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
              {modelOptions.map((model) => (
                <option key={model} value={model}>{model}</option>
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
        ) : symbolStats.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-400">{t('whaleAdvisory.emptyTitle')}</p>
            <p className="mt-2 text-xs text-slate-600">
              {t('whaleAdvisory.emptyDescription')}
            </p>
          </div>
        ) : (
          <div>
            {symbolStats.map((stats, idx) => {
              const latest = items.find(i => i.symbol === stats.symbol) || null;

              return (
                <div key={stats.symbol} className={`grid grid-cols-[220px_1fr] divide-x divide-slate-800 ${idx > 0 ? 'border-t border-slate-800' : ''}`}>
                  {/* Cột trái */}
                  <div>
                    <SymbolCell stats={stats} isActive={false} onClick={() => {}} />
                  </div>

                  {/* Cột phải: Advisory mới nhất */}
                  <div>
                    {latest ? (
                      <AdvisoryCell
                        item={latest}
                        onRefresh={handleRefreshAdvisory}
                        refreshing={refreshingSymbol === latest.symbol}
                      />
                    ) : (
                      <div className="flex items-center p-4 text-xs text-slate-600">
                        {t('whaleAdvisory.noAdvisory')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
