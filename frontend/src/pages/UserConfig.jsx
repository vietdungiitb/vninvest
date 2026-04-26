import React, { useEffect, useMemo, useState } from 'react';
import {
  getAIOptions,
  getUserConfig,
  getPortfolioUserConfig,
  testAIConnection,
  updateUserConfig,
  updatePortfolioUserConfig,
} from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useInterface } from '../context/InterfaceContext';


const FALLBACK_MODELS = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  copilot: ['openai/gpt-4.1-mini', 'openai/gpt-4.1'],
  openclaw: ['default'],
};

function buildFallbackModelCatalog(providerMap) {
  return Object.fromEntries(
    Object.entries(providerMap || {}).map(([provider, models]) => [
      provider,
      (models || []).map((model) => ({
        id: model,
        label: model,
        capabilities: ['text_advisory'],
        validated_for_runtime: true,
      })),
    ]),
  );
}

export default function UserConfig() {
  const { t, setLanguage } = useI18n();
  const { isAuthenticated } = usePortfolio();
  const { uiMode, setUiMode } = useInterface();


  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [aiMessage, setAiMessage] = useState('');

  const [aiProviders, setAiProviders] = useState(FALLBACK_MODELS);
  const [aiModelCatalog, setAiModelCatalog] = useState(buildFallbackModelCatalog(FALLBACK_MODELS));

  const [form, setForm] = useState({
    language: 'vi',
    theme: 'dark',
    whale_alert_threshold: 500,
    advisory_auto_generation_enabled: true,
    advisory_whale_signal_enabled: false,
    advisory_manual_refresh_enabled: true,
    advisory_refresh_interval_hours: 24,
    advisory_max_auto_refreshes_per_day: 24,
    advisory_max_tokens_per_day: 5000,
    ai_provider: 'openclaw',
    ai_model: '',
    ai_api_key: '',
  });

  const [aiState, setAiState] = useState({
    ai_key_configured: false,
    ai_ready: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [optionsResp, aiResp, userResp] = await Promise.all([
          getAIOptions(),
          getUserConfig(),
          getPortfolioUserConfig(),
        ]);
        if (!mounted) return;

        const providers = optionsResp?.data?.providers || FALLBACK_MODELS;
        const modelCatalog = optionsResp?.data?.model_catalog || buildFallbackModelCatalog(providers);
        const aiCfg = aiResp?.data || {};
        const userCfg = userResp?.data || {};

        setAiProviders(providers);
        setAiModelCatalog(modelCatalog);

        setForm((prev) => ({
          ...prev,
          language: userCfg.language || prev.language,
          theme: userCfg.theme || prev.theme,
          whale_alert_threshold: Number(userCfg.whale_alert_threshold ?? prev.whale_alert_threshold),
          advisory_auto_generation_enabled: Boolean(userCfg.advisory_auto_generation_enabled ?? prev.advisory_auto_generation_enabled),
          advisory_whale_signal_enabled: false,
          advisory_manual_refresh_enabled: Boolean(userCfg.advisory_manual_refresh_enabled ?? prev.advisory_manual_refresh_enabled),
          advisory_refresh_interval_hours: Number(userCfg.advisory_refresh_interval_hours ?? prev.advisory_refresh_interval_hours),
          advisory_max_auto_refreshes_per_day: Number(userCfg.advisory_max_auto_refreshes_per_day ?? prev.advisory_max_auto_refreshes_per_day),
          advisory_max_tokens_per_day: Number(userCfg.advisory_max_tokens_per_day ?? prev.advisory_max_tokens_per_day),
          ai_provider: (aiCfg.ai_provider || prev.ai_provider).toLowerCase(),
          ai_model: (aiCfg.ai_model || prev.ai_model).trim(),
          ai_api_key: '',
        }));

        setAiState({
          ai_key_configured: Boolean(aiCfg.ai_api_key_configured),
          ai_ready: Boolean(aiCfg.ai_ready),
        });
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || 'Failed to load settings.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [t, isAuthenticated]);

  const modelOptions = useMemo(() => {
    const provider = form.ai_provider;
    const entries = aiModelCatalog[provider] || [];
    const filtered = entries.filter((entry) => {
      const capabilities = Array.isArray(entry?.capabilities) ? entry.capabilities : [];
      return Boolean(entry?.validated_for_runtime) && capabilities.includes('text_advisory');
    });
    if (filtered.length > 0) {
      return filtered.map((entry) => entry.id);
    }
    return aiProviders[provider] || [];
  }, [aiModelCatalog, aiProviders, form.ai_provider]);

  const onField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveGeneralSettings = async () => {
    setSavingGeneral(true);
    setMessage('');
    setError('');
    try {
      await updatePortfolioUserConfig({
        language: form.language,
        theme: form.theme,
        whale_alert_threshold: Math.max(1, Number(form.whale_alert_threshold) || 500),
        advisory_auto_generation_enabled: Boolean(form.advisory_auto_generation_enabled),
        advisory_whale_signal_enabled: false,
        advisory_manual_refresh_enabled: Boolean(form.advisory_manual_refresh_enabled),
        advisory_refresh_interval_hours: Math.max(1, Number(form.advisory_refresh_interval_hours) || 24),
        advisory_max_auto_refreshes_per_day: Math.max(1, Number(form.advisory_max_auto_refreshes_per_day) || 24),
        advisory_max_tokens_per_day: Math.max(100, Number(form.advisory_max_tokens_per_day) || 5000),
      });
      setLanguage(form.language);
      setMessage(t('common.save'));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Save failed.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const saveAiSettings = async () => {
    setSavingAi(true);
    setAiMessage('');
    try {
      const payload = {
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
      };
      if (String(form.ai_api_key || '').trim()) {
        payload.ai_api_key = String(form.ai_api_key).trim();
      }
      const resp = await updateUserConfig(payload);
      setAiState({
        ai_key_configured: Boolean(resp?.data?.ai_api_key_configured) || Boolean(payload.ai_api_key),
        ai_ready: Boolean(resp?.data?.ai_ready),
      });
      onField('ai_api_key', '');
      setAiMessage(t('common.save'));
    } catch (err) {
      setAiMessage(err?.response?.data?.detail || err?.response?.data?.message || 'Save failed.');
    } finally {
      setSavingAi(false);
    }
  };

  const checkAiConnection = async () => {
    setTestingAi(true);
    setAiMessage('');
    try {
      const payload = {
        ai_provider: form.ai_provider,
        ai_model: form.ai_model,
      };
      if (String(form.ai_api_key || '').trim()) {
        payload.ai_api_key = String(form.ai_api_key).trim();
      }
      const resp = await testAIConnection(payload);
      setAiMessage(resp?.data?.message || 'Connection test passed.');
    } catch (err) {
      setAiMessage(err?.response?.data?.message || 'Connection test failed.');
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 xl:px-5">
      <section className="card-section px-5 py-4">
        <h1 className="text-2xl font-semibold text-slate-100">UserConfig</h1>
        <p className="mt-2 text-sm text-slate-400">
          {t('settings.pageDescription')}
        </p>
      </section>

      {loading ? (
        <section className="card-section px-5 py-6 text-sm text-slate-400">{t('common.loading')}</section>
      ) : null}

      {!loading && (
        <>
          <section className="card-section px-5 py-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.general')}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-slate-400">
                {t('common.language')}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.language}
                  onChange={(e) => onField('language', e.target.value)}
                >
                  <option value="vi">{t('common.vietnamese')}</option>
                  <option value="en">{t('common.english')}</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {t('settings.theme')}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.theme}
                  onChange={(e) => onField('theme', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {t('settings.whaleThreshold')}
                <input
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.whale_alert_threshold}
                  onChange={(e) => onField('whale_alert_threshold', e.target.value)}
                />
              </label>

              <label className="text-xs text-slate-400">
                Interface Mode
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={uiMode}
                  onChange={(e) => setUiMode(e.target.value)}
                >
                  <option value="legacy">Legacy (Standard)</option>
                  <option value="modern">Modern (Workstation)</option>
                  <option value="decision_hub">Decision Hub (Pro)</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card-section px-5 py-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.aiConfig')}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-slate-400">
                {t('whaleAdvisory.provider')}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.ai_provider}
                  onChange={(e) => onField('ai_provider', e.target.value)}
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
                  value={form.ai_model}
                  onChange={(e) => onField('ai_model', e.target.value)}
                >
                  <option value="">{t('whaleAdvisory.selectModel')}</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {t('whaleAdvisory.apiKeyOptional')}
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.ai_api_key}
                  onChange={(e) => onField('ai_api_key', e.target.value)}
                  placeholder={t('whaleAdvisory.apiKeyPlaceholder')}
                />
              </label>
            </div>
            <div className="text-xs text-slate-400">
              {t('settings.aiStatus')} <span className="text-slate-200">{aiState.ai_key_configured ? 'Yes' : 'No'}</span>
              {' · '}
              {t('settings.aiReady')} <span className="text-slate-200">{aiState.ai_ready ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={savingAi} onClick={saveAiSettings}>
                {savingAi ? t('whaleAdvisory.saving') : t('whaleAdvisory.saveConfig')}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
                disabled={testingAi}
                onClick={checkAiConnection}
              >
                {testingAi ? t('whaleAdvisory.testing') : t('whaleAdvisory.testConnection')}
              </button>
            </div>
            {aiMessage ? <p className="text-xs text-cyan-300">{aiMessage}</p> : null}
          </section>

          <section className="card-section px-5 py-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.advisoryPolicy')}</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.advisory_auto_generation_enabled} onChange={(e) => onField('advisory_auto_generation_enabled', e.target.checked)} />
                {t('settings.periodicAuto')}
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.advisory_manual_refresh_enabled} onChange={(e) => onField('advisory_manual_refresh_enabled', e.target.checked)} />
                {t('settings.manualRefresh')}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-slate-400">
                {t('settings.refreshIntervalHours')}
                <input type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={form.advisory_refresh_interval_hours} onChange={(e) => onField('advisory_refresh_interval_hours', e.target.value)} />
              </label>
              <label className="text-xs text-slate-400">
                {t('settings.maxAutoPerDay')}
                <input type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={form.advisory_max_auto_refreshes_per_day} onChange={(e) => onField('advisory_max_auto_refreshes_per_day', e.target.value)} />
              </label>
              <label className="text-xs text-slate-400">
                {t('settings.maxTokensPerDay')}
                <input type="number" min="100" step="100" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" value={form.advisory_max_tokens_per_day} onChange={(e) => onField('advisory_max_tokens_per_day', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="card-section px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={savingGeneral} onClick={saveGeneralSettings}>
                {savingGeneral ? t('whaleAdvisory.saving') : t('common.save')}
              </button>
            </div>
            {message ? <p className="mt-2 text-xs text-cyan-300">{message}</p> : null}
            {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
          </section>
        </>
      )}
    </div>
  );
}
