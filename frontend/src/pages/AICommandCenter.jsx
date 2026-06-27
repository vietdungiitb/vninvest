import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  getPortfolioUserConfig,
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
  { id: 'vols', label: 'Khối lượng', description: 'Volume, thanh khoản, spike.' },
  { id: 'prices', label: 'Giá', description: 'Xu hướng, breakout, hỗ trợ.' },
  { id: 'cdms', label: 'Dòng tiền', description: 'CVD, tích lũy, áp lực lệnh.' },
  { id: 'ma20', label: 'MA 20', description: 'Xu hướng ngắn hạn.' },
  { id: 'ma50', label: 'MA 50', description: 'Xu hướng trung hạn.' },
  { id: 'rsi', label: 'RSI', description: 'Động lượng mua/bán.' },
  { id: 'bollinger', label: 'Bollinger', description: 'Biên độ dao động.' },
  { id: 'snapshot', label: 'Snapshot', description: 'Tổng quan nhanh.' },
];

const PROMPT_SOURCE_DEFINITIONS = [
  {
    id: 'whale',
    label: 'Whale / dòng tiền lớn',
    description: 'Dòng tiền lớn, tích lũy, phân phối.',
    enabledByDefault: true,
    defaultLookback: 180,
    lookbackUnit: 'ngày',
    lookbackOptions: [30, 60, 90, 120, 180, 365],
  },
  {
    id: 'dark_flow',
    label: 'Dark flow / order flow',
    description: 'Lệnh ẩn, áp lực order flow.',
    enabledByDefault: true,
    defaultLookback: 90,
    lookbackUnit: 'ngày',
    lookbackOptions: [14, 30, 60, 90, 180],
  },
  {
    id: 'technical',
    label: 'Phân tích kỹ thuật',
    description: 'Xu hướng, động lượng, biến động.',
    enabledByDefault: true,
    defaultLookback: 30,
    lookbackUnit: 'phiên',
    lookbackOptions: [10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'news',
    label: 'Tin tức / sự kiện',
    description: 'Tin nóng, công bố, sự kiện.',
    enabledByDefault: true,
    defaultLookback: 14,
    lookbackUnit: 'ngày',
    lookbackOptions: [3, 5, 7, 14, 21, 30],
  },
  {
    id: 'market',
    label: 'Bối cảnh thị trường',
    description: 'Bối cảnh thị trường chung.',
    enabledByDefault: true,
    defaultLookback: 7,
    lookbackUnit: 'ngày',
    lookbackOptions: [3, 5, 7, 14, 21, 30],
  },
  {
    id: 'fundamental',
    label: 'Nền tảng cơ bản',
    description: 'KQKD, định giá, tăng trưởng.',
    enabledByDefault: false,
    defaultLookback: 1,
    lookbackUnit: 'quý',
    lookbackOptions: [1, 2, 4, 8],
  },
  {
    id: 'ownership',
    label: 'Sở hữu / nội bộ',
    description: 'Sở hữu, nội bộ, cổ đông lớn.',
    enabledByDefault: false,
    defaultLookback: 365,
    lookbackUnit: 'ngày',
    lookbackOptions: [90, 180, 365],
  },
  {
    id: 'sector',
    label: 'Ngành / peer group',
    description: 'So sánh ngành và peer.',
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

function PromptSourceTabs({
  currentPromptConfig,
  onToggleSource,
  onChangeLookback,
  onToggleTechnicalIndicator,
  onApplyTechnicalPreset,
}) {
  return (
    <Tab.Group>
      <div className="space-y-4">
        <Tab.List className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
          {PROMPT_SOURCE_DEFINITIONS.map((definition) => {
            const sourceConfig = currentPromptConfig?.[definition.id] || createDefaultSourceConfig(definition);
            const enabled = Boolean(sourceConfig.enabled);

            return (
              <Tab
                key={definition.id}
                className={({ selected }) => classNames(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold outline-none transition-all',
                  selected
                    ? 'border-indigo-500/30 bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white',
                )}
              >
                <span className="max-w-[140px] truncate">{definition.label}</span>
                <span className={classNames('h-2 w-2 rounded-full', enabled ? 'bg-emerald-400' : 'bg-slate-500')} />
              </Tab>
            );
          })}
        </Tab.List>

        <Tab.Panels>
          {PROMPT_SOURCE_DEFINITIONS.map((definition) => {
            const sourceConfig = currentPromptConfig?.[definition.id] || createDefaultSourceConfig(definition);
            const enabled = Boolean(sourceConfig.enabled);
            const indicatorCount = Array.isArray(sourceConfig.indicators)
              ? sourceConfig.indicators.length
              : TECHNICAL_INDICATOR_OPTIONS.length;

            return (
              <Tab.Panel key={definition.id} className="space-y-3 outline-none">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-100">
                            {definition.label}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                            {definition.lookbackUnit}
                          </span>
                          <span className={classNames(
                            'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-widest',
                            enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400',
                          )}>
                            {enabled ? 'Bật' : 'Tắt'}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-400">{definition.description}</p>
                      </div>
                      <label className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => void onToggleSource(definition.id)}
                        />
                        <span>{enabled ? 'Bật' : 'Tắt'}</span>
                      </label>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Lookback</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">
                          {sourceConfig.lookback} {definition.lookbackUnit}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">
                          {definition.id === 'technical' ? 'Chỉ báo' : 'Mục đích'}
                        </div>
                        <div className="mt-1 text-sm text-slate-300">
                          {definition.id === 'technical'
                            ? `${indicatorCount} chỉ báo đang nạp`
                            : 'Tối ưu cho quét nhanh.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 space-y-3">
                    <label className="text-xs font-medium text-slate-400">
                      Khoảng nhìn lại
                      <select
                        value={sourceConfig.lookback}
                        onChange={(e) => void onChangeLookback(definition.id, e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                      >
                        {definition.lookbackOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} {definition.lookbackUnit}
                          </option>
                        ))}
                      </select>
                    </label>

                    {definition.id === 'technical' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Chỉ báo kỹ thuật</span>
                          <span>{indicatorCount} / {TECHNICAL_INDICATOR_OPTIONS.length}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {TECHNICAL_INDICATOR_OPTIONS.map((indicator) => {
                            const isSelected = Array.isArray(sourceConfig.indicators) && sourceConfig.indicators.includes(indicator.id);

                            return (
                              <button
                                key={indicator.id}
                                type="button"
                                onClick={() => void onToggleTechnicalIndicator(indicator.id)}
                                className={classNames(
                                  'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all',
                                  isSelected
                                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
                                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700',
                                )}
                              >
                                <span className="text-sm font-medium">{indicator.label}</span>
                                <span className={classNames('h-2.5 w-2.5 rounded-full', isSelected ? 'bg-cyan-400' : 'bg-slate-600')} />
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void onApplyTechnicalPreset('full')}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                          >
                            Bật toàn bộ
                          </button>
                          <button
                            type="button"
                            onClick={() => void onApplyTechnicalPreset('lean')}
                            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                          >
                            Bộ gọn
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs leading-5 text-slate-400">
                        {definition.id === 'whale' && 'Ưu tiên dòng tiền lớn theo phiên.'}
                        {definition.id === 'dark_flow' && 'Giữ tín hiệu ẩn và áp lực lệnh trong tầm nhìn.'}
                        {definition.id === 'news' && 'Bám sát tin gần đây, không lan man.'}
                        {definition.id === 'market' && 'Đặt kết quả vào bối cảnh thị trường.'}
                        {definition.id === 'fundamental' && 'Dùng khi cần góc nhìn dài hơi hơn.'}
                        {definition.id === 'ownership' && 'Hữu ích để kiểm tra động thái sở hữu.'}
                        {definition.id === 'sector' && 'So sánh nhanh với nhóm ngành cùng nhịp.'}
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Panel>
            );
          })}
        </Tab.Panels>
      </div>
    </Tab.Group>
  );
}

const PROVIDER_MODELS = {
  openai: [
    { key: "gpt-4o-mini", label: "gpt-4o-mini" },
    { key: "gpt-4o", label: "gpt-4o" },
    { key: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  gemini: [
    { key: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    { key: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { key: "gemini-pro", label: "gemini-pro" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  claude: [
    { key: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
    { key: "claude-3-haiku", label: "claude-3-haiku" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  openclaw: [
    { key: "gpt-4o-mini", label: "gpt-4o-mini" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  copilot: [
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ]
};

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
  const [userRuntimeConfig, setUserRuntimeConfig] = useState(null);
  const currentConfig = config || DEFAULT_AI_CONFIG;
  const currentPromptConfig = normalizePromptConfig(currentConfig.ai_prompt_config);
  
  const currentProvider = currentConfig.ai_provider || 'openclaw';
  const modelsForSelectedProvider = PROVIDER_MODELS[currentProvider] || [];
  const isCustomModel = currentConfig.ai_model ? !modelsForSelectedProvider.some(m => m.key === currentConfig.ai_model && m.key !== 'custom') : true;
  const displayModelValue = isCustomModel ? 'custom' : (currentConfig.ai_model || '');

  const handleProviderChange = (e) => {
    const nextProvider = e.target.value;
    const models = PROVIDER_MODELS[nextProvider] || [];
    const nextModel = models.length > 0 ? models[0].key : 'custom';
    const nextModelVal = nextModel === 'custom' ? '' : nextModel;
    handleSave({ ai_provider: nextProvider, ai_model: nextModelVal });
  };

  const handleModelSelectChange = (e) => {
    const nextModel = e.target.value;
    if (nextModel === 'custom') {
      setConfig(prev => ({ ...prev, ai_model: '' }));
    } else {
      handleSave({ ai_model: nextModel });
    }
  };

  const totalAuditPages = Math.max(1, Math.ceil((auditTotal || 0) / AUDIT_PAGE_SIZE));
  const activeSourceCount = PROMPT_SOURCE_DEFINITIONS.filter((definition) => currentPromptConfig?.[definition.id]?.enabled).length;
  const eventBasedAdvisoryEnabled = userRuntimeConfig == null
    ? null
    : userRuntimeConfig.advisory_whale_signal_enabled !== false;
  const eventBasedAdvisoryDisabled = eventBasedAdvisoryEnabled === false;
  const effectiveRuntimeProvider = String(currentConfig.effective_ai_provider || currentConfig.ai_provider || 'openclaw').trim().toLowerCase();
  const effectiveRuntimeModel = String(currentConfig.effective_ai_model || currentConfig.ai_model || '').trim() || 'Chưa cấu hình';
  const effectiveRuntimeSource = String(currentConfig.effective_ai_source || 'Unknown').trim() || 'Unknown';
  const effectiveRuntimeMessage = String(currentConfig.ai_config_message || '').trim();
  const eventBasedAdvisoryLabel = eventBasedAdvisoryEnabled === null ? 'Chưa đọc' : (eventBasedAdvisoryDisabled ? 'Tắt' : 'Bật');
  const runtimePolicySummary = `${currentConfig.advisory_refresh_interval_hours || 0} giờ làm mới · ${currentConfig.advisory_max_auto_refreshes_per_day || 0} lần auto refresh/ngày · ${currentConfig.advisory_max_tokens_per_day || 0} token/ngày`;
  const runtimeSummaryCards = [
    {
      label: 'Nhà cung cấp hiệu lực',
      value: effectiveRuntimeProvider,
      valueClassName: 'font-mono text-slate-100',
      caption: 'Nguồn đọc từ AI Command Center.',
    },
    {
      label: 'Mô hình hiệu lực',
      value: effectiveRuntimeModel,
      valueClassName: 'font-mono text-slate-100',
      caption: 'Mô hình đang dùng cho advisory runtime.',
    },
    {
      label: 'Nguồn hiệu lực',
      value: effectiveRuntimeSource,
      valueClassName: 'font-mono text-slate-100',
      caption: 'command_center hoặc system fallback.',
    },
    {
      label: 'Trạng thái runtime',
      value: currentConfig.ai_ready ? 'Sẵn sàng' : 'Cần cấu hình',
      valueClassName: currentConfig.ai_ready ? 'text-emerald-400' : 'text-red-400',
      caption: currentConfig.ai_ready ? 'Runtime có thể sinh advisory.' : 'Thiếu key, model hoặc source hợp lệ.',
    },
  ];

  useEffect(() => {
    fetchConfig();
    fetchUserRuntimeConfig();
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

  const fetchUserRuntimeConfig = async () => {
    try {
      const resp = await getPortfolioUserConfig();
      setUserRuntimeConfig(resp?.data || null);
    } catch (err) {
      console.error('Failed to fetch UserConfig for AI Command Center:', err);
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

  const applyTechnicalPreset = async (presetId) => {
    await savePromptConfig(updatePromptConfigSource(currentPromptConfig, 'technical', (sourceConfig) => ({
      ...sourceConfig,
      enabled: true,
      indicators: presetId === 'full'
        ? TECHNICAL_INDICATOR_OPTIONS.map((indicator) => indicator.id)
        : ['vols', 'prices', 'rsi', 'snapshot'],
    })));
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
    <div className="mx-auto max-w-[1500px] space-y-3 px-4 py-3 animate-in fade-in duration-700 xl:px-5">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-2xl backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-3 md:p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-black text-transparent md:text-4xl">
            AI Command Center
          </h1>
          <p className="mt-2 text-sm text-slate-400 md:text-base">
            Điều phối AI tập trung, ngắn gọn và dễ quét.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/50 px-3 py-2 md:mt-0 md:px-4">
          <div className={classNames(
            'h-3 w-3 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]',
            currentConfig.ai_ready ? "bg-emerald-500" : "bg-red-500"
          )}></div>
          <span className="text-xs font-medium text-slate-300 md:text-sm">
            {currentConfig.ai_ready ? 'AI Runtime: Sẵn sàng' : 'AI Runtime: Chưa sẵn sàng'}
          </span>
        </div>
      </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {runtimeSummaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{card.label}</div>
                <div className={classNames('mt-2 text-sm font-semibold', card.valueClassName || 'text-slate-100')}>
                  {card.value}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{card.caption}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chính sách vận hành</div>
                <h2 className="mt-2 text-lg font-bold text-white">Khung đọc nhanh policy</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tổng hợp gate, budget và nguồn hiệu lực đang áp dụng cho runtime này.
                </p>
              </div>
              <span className={classNames(
                'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest',
                currentConfig.ai_api_key_configured ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300',
              )}>
                {currentConfig.ai_api_key_configured ? 'Đã có key' : 'Chưa có key'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Gate sự kiện</div>
                <div className={classNames('mt-1 text-sm font-semibold', eventBasedAdvisoryDisabled ? 'text-amber-300' : 'text-emerald-300')}>
                  {eventBasedAdvisoryLabel}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Khoảng làm mới</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {currentConfig.advisory_refresh_interval_hours || 0} giờ/lần
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Auto refresh/ngày</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {currentConfig.advisory_max_auto_refreshes_per_day || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Token/ngày</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {currentConfig.advisory_max_tokens_per_day || 0}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              {runtimePolicySummary}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {effectiveRuntimeMessage || 'AI Command Center đang phản ánh cấu hình hiệu lực của runtime và các gate vận hành hiện hành.'}
            </p>
          </div>
        </div>

      {/* Main Configuration Tabs */}
      <Tab.Group>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar Tabs */}
          <Tab.List className="flex h-fit gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-2 backdrop-blur-md xl:flex-col xl:overflow-visible">
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 xl:translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <CpuChipIcon className="w-5 h-5" />
              <span>Điều khiển lõi</span>
            </Tab>
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 xl:translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span>Tinh chỉnh</span>
            </Tab>
            <Tab className={({ selected }) => classNames(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 outline-none',
              selected 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 xl:translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}>
              <BeakerIcon className="w-5 h-5" />
                <span>Nhật ký</span>
            </Tab>
          </Tab.List>

          {/* Content Panels */}
          <Tab.Panels className="min-w-0 space-y-4">
            
            {/* Panel 1: Engine Control */}
            <Tab.Panel className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl md:p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-indigo-500/10 p-3">
                      <KeyIcon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white md:text-xl">Cấu hình runtime</h2>
                      <p className="text-sm text-slate-400">Nhà cung cấp, mô hình, key.</p>
                    </div>
                  </div>
                  {saving && (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 animate-pulse">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Đang lưu...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* AI Provider */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      Nhà cung cấp AI
                    </label>
                    <select 
                      value={currentProvider}
                      onChange={handleProviderChange}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="openclaw">OpenClaw (System Default)</option>
                      <option value="openai">OpenAI (ChatGPT)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="claude">Anthropic (Claude)</option>
                      <option value="copilot">GitHub Copilot</option>
                    </select>
                  </div>

                  {/* AI Model */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Mô hình AI</label>
                    <select 
                      value={displayModelValue}
                      onChange={handleModelSelectChange}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    >
                      {modelsForSelectedProvider.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Model Input */}
                  {displayModelValue === 'custom' && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-300">Tên mô hình tùy chỉnh</label>
                      <input 
                        type="text"
                        value={currentConfig.ai_model || ''}
                        onChange={(e) => setConfig({ ...currentConfig, ai_model: e.target.value })}
                        onBlur={(e) => handleSave({ ai_model: e.target.value })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ví dụ: o1-mini, gemini-2.0-flash"
                      />
                    </div>
                  )}

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
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 font-mono text-white outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                        placeholder={currentConfig.ai_api_key_configured ? 'Đã lưu, nhập key mới để thay đổi' : 'Nhập API Key của bạn...'}
                      />
                      {currentConfig.ai_api_key_configured && !currentConfig.ai_api_key && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Đã cấu hình</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Runtime Visibility */}
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-3">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Nguồn hiệu lực</span>
                    <span className="text-sm text-slate-300 font-mono">{currentConfig.effective_ai_source || 'Unknown'}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-3">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Trạng thái runtime</span>
                    <span className={classNames(
                      "text-sm font-bold",
                      currentConfig.ai_ready ? "text-emerald-400" : "text-red-400"
                    )}>
                      {currentConfig.ai_ready ? 'Sẵn sàng' : 'Cần cấu hình'}
                    </span>
                  </div>
                </div>

                {currentConfig.ai_ready && eventBasedAdvisoryDisabled && (
                  <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      <div>
                        <div className="text-sm font-semibold">AI runtime đã sẵn sàng nhưng advisory theo sự kiện đang tắt</div>
                        <p className="mt-1 text-xs leading-5 text-amber-100/80">
                          Whale, dark flow và reversal sẽ không tự sinh AI Advisory cho tới khi bạn bật lại gate sự kiện trong UserConfig.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/settings"
                      className="inline-flex items-center justify-center rounded-xl border border-amber-300/40 bg-slate-950/40 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-200 hover:bg-slate-950/70"
                    >
                      Mở UserConfig
                    </Link>
                  </div>
                )}

                {/* Test Connection Section */}
                <div className="mt-5 space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Kiểm tra kết nối</h3>
                      <p className="mt-1 text-xs text-slate-500">Xác thực nhanh kết nối hiện tại.</p>
                    </div>
                    <button 
                      onClick={testConnection}
                      disabled={testStatus === 'testing'}
                      className={classNames(
                        'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
                        testStatus === 'testing' 
                          ? 'cursor-not-allowed bg-slate-700 text-slate-400' 
                          : 'bg-white text-slate-900 shadow-lg hover:bg-slate-200'
                      )}
                    >
                      {testStatus === 'testing' && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                      {testStatus === 'testing' ? 'Đang kiểm tra...' : 'Chạy kiểm tra'}
                    </button>
                  </div>

                  {testStatus && testStatus !== 'testing' && (
                    <div className={classNames(
                      'flex items-start gap-3 rounded-xl border p-4 animate-in zoom-in-95',
                      testStatus === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'
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
            <Tab.Panel className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl md:p-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-indigo-500/10 p-3">
                    <AdjustmentsHorizontalIcon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white md:text-xl">Tinh chỉnh nguồn dữ liệu</h2>
                    <p className="text-sm text-slate-400">Chọn nguồn, lookback và chỉ báo trong một màn.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Mẫu cấu hình nhanh</div>
                      <p className="mt-1 text-sm text-slate-400">Chọn preset rồi tinh chỉnh nhanh theo nhu cầu.</p>
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nguồn đang bật</div>
                    <div className="mt-2 text-2xl font-black text-white">{activeSourceCount}</div>
                    <div className="mt-1 text-xs text-slate-400">/{PROMPT_SOURCE_DEFINITIONS.length} nguồn</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chỉ báo kỹ thuật</div>
                    <div className="mt-2 text-2xl font-black text-white">{currentPromptConfig.technical?.indicators?.length || 0}</div>
                    <div className="mt-1 text-xs text-slate-400">chỉ báo nạp vào prompt</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Khoảng whale</div>
                    <div className="mt-2 text-2xl font-black text-white">{currentPromptConfig.whale?.lookback || 0}</div>
                    <div className="mt-1 text-xs text-slate-400">{getSourceDefinition('whale').lookbackUnit}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                  <PromptSourceTabs
                    currentPromptConfig={currentPromptConfig}
                    onToggleSource={togglePromptSource}
                    onChangeLookback={changePromptSourceLookback}
                    onToggleTechnicalIndicator={toggleTechnicalIndicator}
                    onApplyTechnicalPreset={applyTechnicalPreset}
                  />
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-1.5 rounded-full bg-emerald-500"></div>
                    <h3 className="text-lg font-bold text-white">Chính sách tư vấn AI</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-4 shadow-xl backdrop-blur-xl md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white md:text-xl">Nhật ký audit Command Center</h2>
                    <p className="mt-1 text-sm text-slate-400">Mỗi trang chỉ hiển thị một bản ghi.</p>
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
                      <p className="mt-1 text-xs text-slate-400">Lọc theo hành động, actor, ngày.</p>
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
                        onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                        onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-400">
                      Đến ngày
                      <input
                        type="date"
                        value={auditFilters.date_to}
                        onChange={(e) => setAuditFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                        onClick={(e) => { try { e.target.showPicker(); } catch {} }}
                        onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
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
