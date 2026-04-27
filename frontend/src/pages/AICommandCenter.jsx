import { useState, useEffect } from 'react';
import { 
  CpuChipIcon, 
  AdjustmentsHorizontalIcon, 
  KeyIcon, 
  BeakerIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Tab } from '@headlessui/react';
import {
  getAICommandCenterAuditLogs,
  getAICommandCenterConfig,
  testAICommandCenterConnection,
  updateAICommandCenterConfig,
} from '../api/client';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const AUDIT_PAGE_SIZE = 1;

const AUDIT_ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'update_settings', label: 'Cập nhật cấu hình' },
  { value: 'test_connection_success', label: 'Test kết nối thành công' },
  { value: 'test_connection_failed', label: 'Test kết nối thất bại' },
];

const DEFAULT_AUDIT_FILTERS = {
  action: '',
  actor: '',
  date_from: '',
  date_to: '',
};

const TECHNICAL_INDICATOR_OPTIONS = [
  { id: 'vols', label: 'Khối lượng', description: 'Thanh khoản, volume spike, dòng tiền vào/ra.' },
  { id: 'prices', label: 'Giá', description: 'Xu hướng giá, breakout, hỗ trợ và kháng cự.' },
  { id: 'cdms', label: 'Dòng tiền', description: 'CVD, tích lũy, phân phối và áp lực lệnh.' },
  { id: 'ma20', label: 'MA 20', description: 'Xu hướng ngắn hạn và nhịp hồi.' },
  { id: 'ma50', label: 'MA 50', description: 'Xu hướng trung hạn và cấu trúc giá.' },
  { id: 'rsi', label: 'RSI', description: 'Động lượng và trạng thái quá mua/quá bán.' },
  { id: 'bollinger', label: 'Bollinger', description: 'Biến động và biên độ dao động.' },
  { id: 'snapshot', label: 'Snapshot', description: 'Bối cảnh tổng quan trong một mắt nhìn.' },
];

const PROMPT_SOURCE_DEFINITIONS = [
  {
    id: 'whale',
    label: 'Whale / dòng tiền lớn',
    description: 'Dữ liệu giao dịch lớn, tín hiệu tích lũy và phân phối.',
    enabledByDefault: true,
    defaultLookback: 180,
    lookbackUnit: 'ngày',
    lookbackOptions: [30, 60, 90, 120, 180, 365],
  },
  {
    id: 'dark_flow',
    label: 'Dark flow / order flow',
    description: 'Dòng lệnh ẩn, chuyển động của lệnh và áp lực khối lượng.',
    enabledByDefault: true,
    defaultLookback: 90,
    lookbackUnit: 'ngày',
    lookbackOptions: [14, 30, 60, 90, 180],
  },
  {
    id: 'technical',
    label: 'Phân tích kỹ thuật',
    description: 'Chỉ báo xu hướng, động lượng và biến động giá.',
    enabledByDefault: true,
    defaultLookback: 30,
    lookbackUnit: 'phiên',
    lookbackOptions: [10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'news',
    label: 'Tin tức / sự kiện',
    description: 'Tin nóng, công bố doanh nghiệp và bối cảnh thị trường.',
    enabledByDefault: true,
    defaultLookback: 14,
    lookbackUnit: 'ngày',
    lookbackOptions: [3, 5, 7, 14, 21, 30],
  },
  {
    id: 'market',
    label: 'Bối cảnh thị trường',
    description: 'VNINDEX, độ rộng thị trường và tâm lý chung.',
    enabledByDefault: true,
    defaultLookback: 7,
    lookbackUnit: 'ngày',
    lookbackOptions: [3, 5, 7, 14, 21, 30],
  },
  {
    id: 'fundamental',
    label: 'Nền tảng cơ bản',
    description: 'KQKD, định giá, tăng trưởng và chất lượng doanh nghiệp.',
    enabledByDefault: false,
    defaultLookback: 1,
    lookbackUnit: 'quý',
    lookbackOptions: [1, 2, 4, 8],
  },
  {
    id: 'ownership',
    label: 'Sở hữu / nội bộ',
    description: 'Giao dịch nội bộ, thay đổi sở hữu và hành vi cổ đông lớn.',
    enabledByDefault: false,
    defaultLookback: 365,
    lookbackUnit: 'ngày',
    lookbackOptions: [90, 180, 365],
  },
  {
    id: 'sector',
    label: 'Ngành / peer group',
    description: 'So sánh cùng ngành, benchmark và tương quan nhóm cổ phiếu.',
    enabledByDefault: false,
    defaultLookback: 60,
    lookbackUnit: 'phiên',
    lookbackOptions: [20, 40, 60, 90, 120, 180],
  },
];

function getSourceDefinition(sourceId) {
  return PROMPT_SOURCE_DEFINITIONS.find((item) => item.id === sourceId) || PROMPT_SOURCE_DEFINITIONS[0];
}

function createDefaultSourceConfig(sourceDefinition) {
  const baseConfig = {
    enabled: Boolean(sourceDefinition.enabledByDefault),
    lookback: sourceDefinition.defaultLookback,
    lookback_unit: sourceDefinition.lookbackUnit,
  };

  if (sourceDefinition.id === 'technical') {
    baseConfig.indicators = TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id);
  }

  return baseConfig;
}

function createDefaultPromptConfig() {
  return Object.fromEntries(
    PROMPT_SOURCE_DEFINITIONS.map((definition) => [definition.id, createDefaultSourceConfig(definition)]),
  );
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function extractPromptSourceBucket(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return {};
  }

  if (rawConfig.sources && typeof rawConfig.sources === 'object') {
    return rawConfig.sources;
  }

  const legacyTasks = rawConfig.tasks;
  if (legacyTasks && typeof legacyTasks === 'object') {
    const stockAdvisory = legacyTasks.stock_advisory;
    if (stockAdvisory && typeof stockAdvisory === 'object' && stockAdvisory.sources && typeof stockAdvisory.sources === 'object') {
      return stockAdvisory.sources;
    }
  }

  const legacyStockAdvisory = rawConfig.stock_advisory;
  if (legacyStockAdvisory && typeof legacyStockAdvisory === 'object' && legacyStockAdvisory.sources && typeof legacyStockAdvisory.sources === 'object') {
    return legacyStockAdvisory.sources;
  }

  return rawConfig;
}

function normalizePromptConfig(rawConfig) {
  const sourceBucket = extractPromptSourceBucket(rawConfig);
  const normalized = createDefaultPromptConfig();

  if (Array.isArray(sourceBucket)) {
    sourceBucket.forEach((sourceId) => {
      if (normalized[sourceId]) {
        normalized[sourceId] = { ...normalized[sourceId], enabled: true };
      }
    });
    return normalized;
  }

  PROMPT_SOURCE_DEFINITIONS.forEach((definition) => {
    const rawSource = sourceBucket?.[definition.id];
    if (rawSource === undefined || rawSource === null) {
      return;
    }

    if (typeof rawSource === 'boolean') {
      normalized[definition.id] = { ...normalized[definition.id], enabled: rawSource };
      return;
    }

    if (Array.isArray(rawSource)) {
      if (definition.id === 'technical') {
        const indicators = rawSource.filter((indicator) => TECHNICAL_INDICATOR_OPTIONS.some((option) => option.id === indicator));
        normalized[definition.id] = {
          ...normalized[definition.id],
          enabled: true,
          indicators: indicators.length > 0 ? indicators : TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id),
        };
      } else {
        normalized[definition.id] = { ...normalized[definition.id], enabled: rawSource.length > 0 };
      }
      return;
    }

    if (typeof rawSource !== 'object') {
      return;
    }

    const nextSource = { ...normalized[definition.id] };
    if (Object.prototype.hasOwnProperty.call(rawSource, 'enabled')) {
      nextSource.enabled = Boolean(rawSource.enabled);
    }
    if (Object.prototype.hasOwnProperty.call(rawSource, 'lookback')) {
      nextSource.lookback = clampInt(rawSource.lookback, 1, 365, nextSource.lookback);
    }
    if (typeof rawSource.lookback_unit === 'string' && rawSource.lookback_unit.trim()) {
      nextSource.lookback_unit = rawSource.lookback_unit.trim().toLowerCase();
    }
    if (definition.id === 'technical') {
      const rawIndicators = Array.isArray(rawSource.indicators) ? rawSource.indicators : [];
      const indicators = rawIndicators.filter((indicator) => TECHNICAL_INDICATOR_OPTIONS.some((option) => option.id === indicator));
      nextSource.indicators = indicators.length > 0 ? indicators : TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id);
    }
    normalized[definition.id] = nextSource;
  });

  return normalized;
}

function updatePromptConfigSource(promptConfig, sourceId, updater) {
  const normalized = normalizePromptConfig(promptConfig);
  const definition = getSourceDefinition(sourceId);
  const currentSource = normalized[sourceId] || createDefaultSourceConfig(definition);

  return {
    ...normalized,
    [sourceId]: updater({ ...currentSource }),
  };
}

function buildPromptConfigPreset(presetId) {
  const nextConfig = createDefaultPromptConfig();

  if (presetId === 'flow_first') {
    nextConfig.whale.lookback = 180;
    nextConfig.dark_flow.lookback = 120;
    nextConfig.technical.lookback = 45;
    nextConfig.technical.indicators = ['vols', 'prices', 'cdms', 'rsi', 'bollinger', 'snapshot'];
    nextConfig.news.enabled = true;
    nextConfig.market.enabled = true;
    nextConfig.fundamental.enabled = false;
    nextConfig.ownership.enabled = false;
    nextConfig.sector.enabled = false;
  }

  if (presetId === 'deep_dive') {
    nextConfig.whale.lookback = 365;
    nextConfig.dark_flow.lookback = 180;
    nextConfig.technical.lookback = 120;
    nextConfig.technical.indicators = TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id);
    nextConfig.news.lookback = 30;
    nextConfig.market.lookback = 21;
    nextConfig.fundamental.enabled = true;
    nextConfig.fundamental.lookback = 8;
    nextConfig.ownership.enabled = true;
    nextConfig.ownership.lookback = 365;
    nextConfig.sector.enabled = true;
    nextConfig.sector.lookback = 120;
  }

  if (presetId === 'cost_control') {
    nextConfig.whale.lookback = 90;
    nextConfig.dark_flow.lookback = 60;
    nextConfig.technical.lookback = 20;
    nextConfig.technical.indicators = ['vols', 'prices', 'rsi', 'snapshot'];
    nextConfig.news.lookback = 7;
    nextConfig.market.lookback = 5;
    nextConfig.fundamental.enabled = false;
    nextConfig.ownership.enabled = false;
    nextConfig.sector.enabled = false;
  }

  return nextConfig;
}

const DEFAULT_AI_CONFIG = {
  ai_provider: 'openclaw',
  ai_model: '',
  ai_api_key: '',
  ai_api_key_configured: false,
  ai_ready: false,
  effective_ai_source: 'Unknown',
  ai_prompt_config: createDefaultPromptConfig(),
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilters, setAuditFilters] = useState(DEFAULT_AUDIT_FILTERS);
  const [appliedAuditFilters, setAppliedAuditFilters] = useState(DEFAULT_AUDIT_FILTERS);
  const currentConfig = config || DEFAULT_AI_CONFIG;
  const currentPromptConfig = normalizePromptConfig(currentConfig.ai_prompt_config);
  const totalAuditPages = Math.max(1, Math.ceil((auditTotal || 0) / AUDIT_PAGE_SIZE));
  const activeSourceCount = PROMPT_SOURCE_DEFINITIONS.filter((definition) => currentPromptConfig?.[definition.id]?.enabled).length;

  useEffect(() => {
    fetchConfig();
    loadAuditLogs(1);
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const resp = await getAICommandCenterConfig();
      setConfig({
        ...DEFAULT_AI_CONFIG,
        ...(resp?.data || {}),
        ai_prompt_config: normalizePromptConfig(resp?.data?.ai_prompt_config || {}),
      });
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (page = 1, filters = appliedAuditFilters) => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const limit = AUDIT_PAGE_SIZE;
      const offset = Math.max(0, (page - 1) * limit);
      const resp = await getAICommandCenterAuditLogs({
        limit,
        offset,
        order: 'desc',
        ...(filters || {}),
      });
      setAuditPage(page);
      setAuditTotal(Number(resp?.data?.total || 0));
      setAuditLogs(Array.isArray(resp?.data?.results) ? resp.data.results : []);
    } catch (err) {
      setAuditError(err?.response?.data?.message || 'Không tải được lịch sử audit.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSave = async (updatedFields) => {
    setSaving(true);
    try {
      const resp = await updateAICommandCenterConfig(updatedFields);
      const responseData = resp?.data || {};
      setConfig((prev) => {
        const nextPromptConfig = normalizePromptConfig(
          responseData.ai_prompt_config ||
          updatedFields?.ai_prompt_config ||
          prev?.ai_prompt_config ||
          currentPromptConfig,
        );

        const nextConfig = {
          ...DEFAULT_AI_CONFIG,
          ...(prev || {}),
          ...(updatedFields || {}),
          ...responseData,
          ai_prompt_config: nextPromptConfig,
        };

        if (Object.prototype.hasOwnProperty.call(updatedFields || {}, 'ai_api_key')) {
          nextConfig.ai_api_key = '';
          if (typeof responseData.ai_api_key_configured === 'boolean') {
            nextConfig.ai_api_key_configured = responseData.ai_api_key_configured;
          }
        }

        return nextConfig;
      });
      await loadAuditLogs(1);
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
      const resp = await testAICommandCenterConnection(payload);
      setTestStatus('success');
      setTestResult(resp.data.message || 'Connection successful!');
      // After testing connection, we might want to refresh config to see if ai_ready changed
      fetchConfig();
      await loadAuditLogs(1);
    } catch (err) {
      setTestStatus('error');
      setTestResult(err.response?.data?.message || 'Connection failed.');
    }
  };

  const savePromptConfig = async (nextPromptConfig) => {
    const normalizedPromptConfig = normalizePromptConfig(nextPromptConfig);
    setConfig((prev) => ({
      ...prev,
      ai_prompt_config: normalizedPromptConfig,
    }));
    await handleSave({ ai_prompt_config: normalizedPromptConfig });
  };

  const togglePromptSource = async (sourceId) => {
    await savePromptConfig(
      updatePromptConfigSource(currentPromptConfig, sourceId, (sourceConfig) => ({
        ...sourceConfig,
        enabled: !Boolean(sourceConfig.enabled),
      })),
    );
  };

  const changePromptSourceLookback = async (sourceId, lookbackValue) => {
    const definition = getSourceDefinition(sourceId);
    await savePromptConfig(
      updatePromptConfigSource(currentPromptConfig, sourceId, (sourceConfig) => ({
        ...sourceConfig,
        lookback: clampInt(lookbackValue, 1, 365, definition.defaultLookback),
      })),
    );
  };

  const toggleTechnicalIndicator = async (indicatorId) => {
    await savePromptConfig(
      updatePromptConfigSource(currentPromptConfig, 'technical', (sourceConfig) => {
        const selectedIndicators = Array.isArray(sourceConfig.indicators)
          ? [...sourceConfig.indicators]
          : TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id);

        const nextIndicators = selectedIndicators.includes(indicatorId)
          ? selectedIndicators.filter((item) => item !== indicatorId)
          : [...selectedIndicators, indicatorId];

        return {
          ...sourceConfig,
          enabled: true,
          indicators: nextIndicators.length > 0
            ? nextIndicators
            : TECHNICAL_INDICATOR_OPTIONS.map((option) => option.id),
        };
      }),
    );
  };

  const applyPromptPreset = async (presetId) => {
    await savePromptConfig(buildPromptConfigPreset(presetId));
  };

  const applyAuditFilters = async () => {
    const nextFilters = {
      action: String(auditFilters.action || '').trim(),
      actor: String(auditFilters.actor || '').trim(),
      date_from: String(auditFilters.date_from || '').trim(),
      date_to: String(auditFilters.date_to || '').trim(),
    };
    setAppliedAuditFilters(nextFilters);
    await loadAuditLogs(1, nextFilters);
  };

  const resetAuditFilters = async () => {
    setAuditFilters(DEFAULT_AUDIT_FILTERS);
    setAppliedAuditFilters(DEFAULT_AUDIT_FILTERS);
    await loadAuditLogs(1, DEFAULT_AUDIT_FILTERS);
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
                      <option value="copilot">GitHub Copilot</option>
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
              <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <AdjustmentsHorizontalIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Tinh chỉnh nguồn dữ liệu</h2>
                    <p className="text-slate-400 text-sm">Chọn nguồn, khoảng nhìn lại và chỉ báo cho từng tác vụ.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Mẫu cấu hình nhanh</div>
                      <p className="mt-1 text-sm text-slate-400">Dùng preset làm điểm xuất phát, rồi chỉnh từng nguồn theo nhu cầu thực tế.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'balanced', label: 'Cân bằng' },
                        { id: 'flow_first', label: 'Ưu tiên dòng tiền' },
                        { id: 'deep_dive', label: 'Chuyên sâu' },
                        { id: 'cost_control', label: 'Tiết kiệm token' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => void applyPromptPreset(preset.id)}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500/40 hover:bg-indigo-500/10"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nguồn đang bật</div>
                    <div className="mt-2 text-3xl font-black text-white">{activeSourceCount}</div>
                    <div className="mt-1 text-xs text-slate-400">trên {PROMPT_SOURCE_DEFINITIONS.length} nguồn có thể chọn</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chỉ báo kỹ thuật</div>
                    <div className="mt-2 text-3xl font-black text-white">{currentPromptConfig.technical?.indicators?.length || 0}</div>
                    <div className="mt-1 text-xs text-slate-400">chỉ báo đang được nạp vào prompt</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Whale lookback</div>
                    <div className="mt-2 text-3xl font-black text-white">{currentPromptConfig.whale?.lookback || 0}</div>
                    <div className="mt-1 text-xs text-slate-400">{getSourceDefinition('whale').lookbackUnit}</div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {PROMPT_SOURCE_DEFINITIONS.map((definition) => {
                    const sourceConfig = currentPromptConfig?.[definition.id] || createDefaultSourceConfig(definition);
                    const enabled = Boolean(sourceConfig.enabled);

                    return (
                      <article
                        key={definition.id}
                        className={classNames(
                          'rounded-3xl border p-5 transition-all duration-300',
                          enabled
                            ? 'border-indigo-500/20 bg-indigo-500/5'
                            : 'border-slate-800/70 bg-slate-950/35 opacity-80',
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
                                {definition.label}
                              </span>
                              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                {definition.lookbackUnit}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-400">{definition.description}</p>
                          </div>
                          <label className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => void togglePromptSource(definition.id)}
                            />
                            <span>{enabled ? 'Bật' : 'Tắt'}</span>
                          </label>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <label className="text-xs font-medium text-slate-400">
                            Khoảng nhìn lại
                            <select
                              value={sourceConfig.lookback}
                              onChange={(e) => void changePromptSourceLookback(definition.id, e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                            >
                              {definition.lookbackOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option} {definition.lookbackUnit}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                            <div className="font-semibold text-slate-200">Mô tả nhanh</div>
                            <p className="mt-1 leading-5">
                              {definition.id === 'technical' && 'Tùy chỉnh thêm bộ chỉ báo, ưu tiên động lượng, xu hướng hoặc biến động.'}
                              {definition.id === 'whale' && 'Phù hợp khi cần theo dõi dòng tiền lớn trong nhiều phiên.'}
                              {definition.id === 'dark_flow' && 'Giữ nguồn này bật để nhìn rõ áp lực đặt lệnh và tín hiệu ẩn.'}
                              {definition.id === 'news' && 'Hữu ích cho các tác vụ cần bám sát tin tức gần đây.'}
                              {definition.id === 'market' && 'Giúp AI đặt kết quả vào bối cảnh thị trường tổng thể.'}
                              {definition.id === 'fundamental' && 'Dùng khi cần phân tích dài hơi và bền vững hơn.'}
                              {definition.id === 'ownership' && 'Quan trọng khi muốn kiểm tra thay đổi sở hữu nội bộ.'}
                              {definition.id === 'sector' && 'Hữu ích khi muốn so sánh tương quan với nhóm ngành.'}
                            </p>
                          </div>
                        </div>

                        {definition.id === 'technical' ? (
                          <div className="mt-5 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Chỉ báo kỹ thuật</div>
                                <p className="mt-1 text-xs text-slate-400">Bấm để chọn nhiều chỉ báo cùng lúc.</p>
                              </div>
                              <div className="text-xs text-slate-500">
                                {sourceConfig.indicators?.length || 0} / {TECHNICAL_INDICATOR_OPTIONS.length}
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {TECHNICAL_INDICATOR_OPTIONS.map((indicator) => {
                                const isSelected = Array.isArray(sourceConfig.indicators) && sourceConfig.indicators.includes(indicator.id);
                                return (
                                  <button
                                    key={indicator.id}
                                    type="button"
                                    onClick={() => void toggleTechnicalIndicator(indicator.id)}
                                    className={classNames(
                                      'rounded-2xl border p-3 text-left transition-all',
                                      isSelected
                                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
                                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700',
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold">{indicator.label}</span>
                                      <span className={classNames(
                                        'h-2.5 w-2.5 rounded-full',
                                        isSelected ? 'bg-cyan-400' : 'bg-slate-600',
                                      )} />
                                    </div>
                                    <p className="mt-2 text-[11px] leading-5 text-slate-400">{indicator.description}</p>
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void savePromptConfig(updatePromptConfigSource(currentPromptConfig, 'technical', (sourceConfig) => ({
                                  ...sourceConfig,
                                  enabled: true,
                                  indicators: TECHNICAL_INDICATOR_OPTIONS.map((indicator) => indicator.id),
                                }))) }
                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                              >
                                Bật toàn bộ
                              </button>
                              <button
                                type="button"
                                onClick={() => void savePromptConfig(updatePromptConfigSource(currentPromptConfig, 'technical', (sourceConfig) => ({
                                  ...sourceConfig,
                                  enabled: true,
                                  indicators: ['vols', 'prices', 'rsi', 'snapshot'],
                                }))) }
                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                              >
                                Bộ gọn nhẹ
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    <h3 className="text-lg font-bold text-white">Chính sách AI advisory</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Khoảng cách làm mới (giờ)</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          value={currentConfig.advisory_refresh_interval_hours || 0}
                          onChange={(e) => setConfig({ ...currentConfig, advisory_refresh_interval_hours: parseInt(e.target.value, 10) || 0 })}
                          onBlur={(e) => handleSave({ advisory_refresh_interval_hours: parseInt(e.target.value, 10) || 0 })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-500">giờ</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Số lần auto refresh tối đa/ngày</label>
                      <input
                        type="number"
                        min="1"
                        value={currentConfig.advisory_max_auto_refreshes_per_day || 0}
                        onChange={(e) => setConfig({ ...currentConfig, advisory_max_auto_refreshes_per_day: parseInt(e.target.value, 10) || 0 })}
                        onBlur={(e) => handleSave({ advisory_max_auto_refreshes_per_day: parseInt(e.target.value, 10) || 0 })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ngân sách token tối đa/ngày</label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={currentConfig.advisory_max_tokens_per_day || 0}
                        onChange={(e) => setConfig({ ...currentConfig, advisory_max_tokens_per_day: parseInt(e.target.value, 10) || 0 })}
                        onBlur={(e) => handleSave({ advisory_max_tokens_per_day: parseInt(e.target.value, 10) || 0 })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Tab.Panel>

            {/* Panel 3: Audit */}
            <Tab.Panel className="animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl backdrop-blur-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Nhật ký audit Command Center</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Mỗi trang chỉ hiển thị một bản ghi để bạn tập trung vào một cấu hình tại một thời điểm.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAuditLogs(1)}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      Làm mới
                    </button>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm text-slate-300">
                      Trang {auditPage} / {totalAuditPages}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                  <div className="text-xs text-slate-400">
                    {auditTotal > 0
                      ? `Đang xem bản ghi ${Math.min(auditTotal, (auditPage - 1) * AUDIT_PAGE_SIZE + 1)} / ${auditTotal}`
                      : 'Chưa có bản ghi nào.'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAuditLogs(Math.max(1, auditPage - 1), appliedAuditFilters)}
                      disabled={auditPage <= 1 || auditLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-800"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadAuditLogs(Math.min(totalAuditPages, auditPage + 1), appliedAuditFilters)}
                      disabled={auditPage >= totalAuditPages || auditLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-800"
                    >
                      Sau
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Bộ lọc audit</div>
                      <p className="mt-1 text-xs text-slate-400">Lọc theo hành động, actor và ngày để tập trung vào đúng thay đổi.</p>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Đang áp dụng: {appliedAuditFilters.action || 'all'} · {appliedAuditFilters.actor || 'any'}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-400">
                      Hành động
                      <select
                        value={auditFilters.action}
                        onChange={(e) => setAuditFilters((prev) => ({ ...prev, action: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                      >
                        {AUDIT_ACTION_OPTIONS.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-400">
                      Actor
                      <input
                        type="text"
                        value={auditFilters.actor}
                        onChange={(e) => setAuditFilters((prev) => ({ ...prev, actor: e.target.value }))}
                        placeholder="username hoặc system"
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-400">
                      Từ ngày
                      <input
                        type="date"
                        value={auditFilters.date_from}
                        onChange={(e) => setAuditFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-400">
                      Đến ngày
                      <input
                        type="date"
                        value={auditFilters.date_to}
                        onChange={(e) => setAuditFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void applyAuditFilters()}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                      Áp dụng bộ lọc
                    </button>
                    <button
                      type="button"
                      onClick={() => void resetAuditFilters()}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                </div>

                {auditLoading ? (
                  <div className="flex items-center gap-3 text-slate-400">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Đang tải audit logs...
                  </div>
                ) : auditError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {auditError}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 text-sm text-slate-400">
                    Chưa có bản ghi audit nào.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => {
                      const beforeSnapshot = log.before_json || {};
                      const afterSnapshot = log.after_json || {};

                      return (
                        <article key={log.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-300">
                                  {log.action}
                                </span>
                                <span className="text-sm text-slate-200">{log.reason || 'Không có lý do chi tiết.'}</span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {log.actor ? `Bởi ${log.actor}` : 'Bởi hệ thống'} · {log.created_at || 'N/A'}
                              </div>
                              <div className="text-xs text-cyan-300/90">
                                {log.diff_summary || 'Không có diff summary.'}
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 md:text-right">
                              Cấu hình #{log.command_center_config_id}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trước</div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Provider</div>
                                  <div className="mt-1 font-semibold text-slate-100">{beforeSnapshot.ai_provider || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Model</div>
                                  <div className="mt-1 font-semibold text-slate-100">{beforeSnapshot.ai_model || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Nguồn hiệu lực</div>
                                  <div className="mt-1 font-semibold text-slate-100">{beforeSnapshot.effective_ai_source || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Sẵn sàng</div>
                                  <div className="mt-1 font-semibold text-slate-100">{beforeSnapshot.ai_ready ? 'Có' : 'Không'}</div>
                                </div>
                              </div>
                              <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-slate-400">
                                  Xem JSON snapshot trước
                                </summary>
                                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-300">
                                  {JSON.stringify(beforeSnapshot, null, 2)}
                                </pre>
                              </details>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sau</div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Provider</div>
                                  <div className="mt-1 font-semibold text-slate-100">{afterSnapshot.ai_provider || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Model</div>
                                  <div className="mt-1 font-semibold text-slate-100">{afterSnapshot.ai_model || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Nguồn hiệu lực</div>
                                  <div className="mt-1 font-semibold text-slate-100">{afterSnapshot.effective_ai_source || 'N/A'}</div>
                                </div>
                                <div className="rounded-xl bg-slate-950/70 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Sẵn sàng</div>
                                  <div className="mt-1 font-semibold text-slate-100">{afterSnapshot.ai_ready ? 'Có' : 'Không'}</div>
                                </div>
                              </div>
                              <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-slate-400">
                                  Xem JSON snapshot sau
                                </summary>
                                <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-300">
                                  {JSON.stringify(afterSnapshot, null, 2)}
                                </pre>
                              </details>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </Tab.Panel>

          </Tab.Panels>
        </div>
      </Tab.Group>
    </div>
  );
};

export default AICommandCenter;
