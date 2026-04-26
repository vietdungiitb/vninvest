import { useState, useEffect } from 'react';
import { 
  CpuChipIcon, 
  AdjustmentsHorizontalIcon, 
  KeyIcon, 
  BeakerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Tab } from '@headlessui/react';
import { getAIConfig, testAIConnection, updateAIConfig } from '../api/client';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const DEFAULT_AI_CONFIG = {
  ai_provider: 'openclaw',
  ai_model: '',
  ai_api_key: '',
  ai_api_key_configured: false,
  ai_ready: false,
  effective_ai_source: 'Unknown',
  ai_prompt_config: {},
  advisory_refresh_interval_hours: 24,
  advisory_max_auto_refreshes_per_day: 24,
  advisory_max_tokens_per_day: 5000,
};

const AICommandCenter = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [testStatus, setTestStatus] = useState(null); // 'testing', 'success', 'error'
  const [testResult, setTestResult] = useState('');
  const currentConfig = config || DEFAULT_AI_CONFIG;

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const resp = await getAIConfig();
      setConfig({
        ...DEFAULT_AI_CONFIG,
        ...(resp?.data || {}),
        ai_prompt_config: resp?.data?.ai_prompt_config || {},
      });
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedFields) => {
    setSaving(true);
    try {
      const resp = await updateAIConfig(updatedFields);
      const responseData = resp?.data || {};
      setConfig((prev) => {
        const nextConfig = {
          ...DEFAULT_AI_CONFIG,
          ...(prev || {}),
          ...(updatedFields || {}),
          ...responseData,
          ai_prompt_config:
            responseData.ai_prompt_config ||
            updatedFields?.ai_prompt_config ||
            prev?.ai_prompt_config ||
            {},
        };

        if (Object.prototype.hasOwnProperty.call(updatedFields || {}, 'ai_api_key')) {
          nextConfig.ai_api_key = '';
          if (typeof responseData.ai_api_key_configured === 'boolean') {
            nextConfig.ai_api_key_configured = responseData.ai_api_key_configured;
          }
        }

        return nextConfig;
      });
    } catch (err) {
      console.error('Failed to save AI config:', err);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const payload = {
        ai_provider: currentConfig.ai_provider,
        ai_model: currentConfig.ai_model,
      };
      const apiKey = String(currentConfig.ai_api_key || '').trim();
      if (apiKey) {
        payload.ai_api_key = apiKey;
      }
      const resp = await testAIConnection(payload);
      setTestStatus('success');
      setTestResult(resp.data.message || 'Connection successful!');
      // After testing connection, we might want to refresh config to see if ai_ready changed
      fetchConfig();
    } catch (err) {
      setTestStatus('error');
      setTestResult(err.response?.data?.message || 'Connection failed.');
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            AI Command Center
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Hệ thống quản trị và điều phối trí tuệ nhân tạo toàn diện.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700/50">
          <div className={classNames(
            "w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]",
            currentConfig.ai_ready ? "bg-emerald-500" : "bg-red-500"
          )}></div>
          <span className="text-sm font-medium text-slate-300">
            {currentConfig.ai_ready ? 'AI Runtime: Ready' : 'AI Runtime: Offline'}
          </span>
        </div>
      </div>

      {/* Main Configuration Tabs */}
      <Tab.Group>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Tabs */}
          <Tab.List className="flex lg:flex-col gap-2 bg-slate-900/50 backdrop-blur-md p-3 rounded-2xl border border-slate-800 h-fit overflow-x-auto lg:overflow-visible">
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <CpuChipIcon className="w-5 h-5" />
              <span>Engine Control</span>
            </Tab>
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span>Task Tuning</span>
            </Tab>
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <BeakerIcon className="w-5 h-5" />
              <span>Audit & Logs</span>
            </Tab>
          </Tab.List>

          {/* Content Panels */}
          <Tab.Panels className="lg:col-span-3 space-y-6">
            
            {/* Panel 1: Engine Control */}
            <Tab.Panel className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl">
                      <KeyIcon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Cấu hình Provider</h2>
                      <p className="text-slate-400 text-sm">Thiết lập bộ não và kết nối API.</p>
                    </div>
                  </div>
                  {saving && (
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold animate-pulse">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Saving...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* AI Provider */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      AI Provider
                    </label>
                    <select 
                      value={currentConfig.ai_provider}
                      onChange={(e) => handleSave({ ai_provider: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="openai">OpenAI (ChatGPT)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="claude">Anthropic (Claude)</option>
                      <option value="openclaw">OpenClaw (System Default)</option>
                    </select>
                  </div>

                  {/* AI Model */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">AI Model</label>
                    <input 
                      type="text"
                      value={currentConfig.ai_model || ''}
                      onChange={(e) => setConfig({ ...currentConfig, ai_model: e.target.value })}
                      onBlur={(e) => handleSave({ ai_model: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. gpt-4o, gemini-1.5-pro"
                    />
                  </div>

                  {/* API Key */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-slate-300">API Key</label>
                    <div className="relative">
                      <input 
                        type="password"
                        value={currentConfig.ai_api_key || ''}
                        onChange={(e) => setConfig({ ...currentConfig, ai_api_key: e.target.value })}
                        onBlur={(e) => {
                          const apiKey = String(e.target.value || '').trim();
                          if (!apiKey) return;
                          handleSave({ ai_api_key: apiKey });
                        }}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                        placeholder={currentConfig.ai_api_key_configured ? 'Đã lưu, nhập key mới để thay đổi' : 'Nhập API Key của bạn...'}
                      />
                      {currentConfig.ai_api_key_configured && !currentConfig.ai_api_key && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Configured</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Runtime Visibility */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Effective Source</span>
                    <span className="text-sm text-slate-300 font-mono">{currentConfig.effective_ai_source || 'Unknown'}</span>
                  </div>
                  <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Runtime Status</span>
                    <span className={classNames(
                      "text-sm font-bold",
                      currentConfig.ai_ready ? "text-emerald-400" : "text-red-400"
                    )}>
                      {currentConfig.ai_ready ? "Ready to compute" : "Setup Required"}
                    </span>
                  </div>
                </div>

                {/* Test Connection Section */}
                <div className="mt-12 p-6 bg-slate-800/30 border border-slate-700/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Test Connection</h3>
                      <p className="text-xs text-slate-500 mt-1">Xác thực kết nối tới AI Provider hiện tại.</p>
                    </div>
                    <button 
                      onClick={testConnection}
                      disabled={testStatus === 'testing'}
                      className={classNames(
                        "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                        testStatus === 'testing' 
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
                          : "bg-white text-slate-900 hover:bg-slate-200 shadow-lg"
                      )}
                    >
                      {testStatus === 'testing' && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                      {testStatus === 'testing' ? 'Verifying...' : 'Run Test'}
                    </button>
                  </div>

                  {testStatus && testStatus !== 'testing' && (
                    <div className={classNames(
                      "flex items-start gap-3 p-4 rounded-xl border animate-in zoom-in-95",
                      testStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                    )}>
                      {testStatus === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <ExclamationCircleIcon className="w-5 h-5" />}
                      <div className="text-sm font-medium">
                        {testResult}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tab.Panel>

            {/* Panel 2: Task Tuning */}
            <Tab.Panel className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <AdjustmentsHorizontalIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Task Tuning</h2>
                    <p className="text-slate-400 text-sm">Tinh chỉnh nguồn dữ liệu và tham số cho từng tác vụ.</p>
                  </div>
                </div>

                <div className="space-y-12">
                  {/* Stock Advisory Tuning */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                      <h3 className="text-lg font-bold text-white">Stock Advisory Synthesis</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['technical', 'whale', 'fundamental', 'sentiment', 'news', 'dark_flow', 'market', 'ownership', 'sector'].map((sourceId) => {
                        const stockAdvisory = currentConfig.ai_prompt_config?.tasks?.stock_advisory || currentConfig.ai_prompt_config?.stock_advisory || {};
                        const sources = stockAdvisory.sources || {};
                        
                        // Support both string list and object dict
                        const isEnabled = Array.isArray(sources) 
                          ? sources.includes(sourceId)
                          : sources[sourceId]?.enabled;
                        
                        return (
                          <div key={sourceId} className={classNames(
                            "p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
                            isEnabled ? "bg-indigo-500/5 border-indigo-500/20" : "bg-slate-800/20 border-slate-800/50 opacity-60"
                          )} onClick={() => {
                            const newPromptConfig = { ...(currentConfig.ai_prompt_config || {}) };
                            if (!newPromptConfig.tasks) newPromptConfig.tasks = {};
                            if (!newPromptConfig.tasks.stock_advisory) newPromptConfig.tasks.stock_advisory = { sources: {} };
                            
                            const currentSources = { ...(newPromptConfig.tasks.stock_advisory.sources || {}) };
                            if (isEnabled) {
                              if (Array.isArray(currentSources)) {
                                newPromptConfig.tasks.stock_advisory.sources = currentSources.filter(s => s !== sourceId);
                              } else {
                                delete currentSources[sourceId];
                                newPromptConfig.tasks.stock_advisory.sources = currentSources;
                              }
                            } else {
                              if (Array.isArray(currentSources)) {
                                newPromptConfig.tasks.stock_advisory.sources = [...currentSources, sourceId];
                              } else {
                                currentSources[sourceId] = { enabled: true, lookback: 30 };
                                newPromptConfig.tasks.stock_advisory.sources = currentSources;
                              }
                            }
                            handleSave({ ai_prompt_config: newPromptConfig });
                          }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-slate-200 capitalize">{sourceId.replace('_', ' ')}</span>
                              <div className={classNames(
                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                isEnabled ? "bg-indigo-600 border-indigo-500" : "bg-slate-800 border-slate-700"
                              )}>
                                {isEnabled && <CheckCircleIcon className="w-4 h-4 text-white" />}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {sourceId === 'technical' && 'SMA, RSI, Bollinger Bands, Volume indicators'}
                              {sourceId === 'whale' && 'Institutional flow, Dark money, Order flow intensity'}
                              {sourceId === 'fundamental' && 'P/E, EPS, Revenue, Debt/Equity, Growth metrics'}
                              {sourceId === 'sentiment' && 'Social media, News sentiment, Fear & Greed'}
                              {sourceId === 'news' && 'Recent headlines, Corporate announcements'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advisory Global Constraints */}
                  <div className="pt-8 border-t border-slate-800 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                      <h3 className="text-lg font-bold text-white">Global Advisory Constraints</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Refresh Interval</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            value={currentConfig.advisory_refresh_interval_hours || 0}
                            onChange={(e) => setConfig({ ...currentConfig, advisory_refresh_interval_hours: parseInt(e.target.value) || 0 })}
                            onBlur={(e) => handleSave({ advisory_refresh_interval_hours: parseInt(e.target.value) || 0 })}
                            className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white w-full outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-500">hrs</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max Auto Refresh/Day</label>
                        <input 
                          type="number"
                          value={currentConfig.advisory_max_auto_refreshes_per_day || 0}
                          onChange={(e) => setConfig({ ...currentConfig, advisory_max_auto_refreshes_per_day: parseInt(e.target.value) || 0 })}
                          onBlur={(e) => handleSave({ advisory_max_auto_refreshes_per_day: parseInt(e.target.value) || 0 })}
                          className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white w-full outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daily Token Budget</label>
                        <input 
                          type="number"
                          value={currentConfig.advisory_max_tokens_per_day || 0}
                          onChange={(e) => setConfig({ ...currentConfig, advisory_max_tokens_per_day: parseInt(e.target.value) || 0 })}
                          onBlur={(e) => handleSave({ advisory_max_tokens_per_day: parseInt(e.target.value) || 0 })}
                          className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white w-full outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Panel 3: Audit (Placeholder) */}
            <Tab.Panel className="animate-in slide-in-from-right-4 duration-500">
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-xl min-h-[400px] flex flex-col items-center justify-center text-center">
                <BeakerIcon className="w-16 h-16 text-slate-700 mb-4" />
                <h2 className="text-xl font-bold text-slate-300">AI Usage Audit</h2>
                <p className="text-slate-500 mt-2 max-w-md">
                  Theo dõi lịch sử gọi API, token đã dùng và các phản hồi từ AI.
                </p>
                <div className="mt-8 text-xs text-slate-600 font-mono">
                  Module: backend/portfolio/views_ai_runtime_stats.py
                </div>
              </div>
            </Tab.Panel>

          </Tab.Panels>
        </div>
      </Tab.Group>
    </div>
  );
};

export default AICommandCenter;
