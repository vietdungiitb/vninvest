import { useState, useEffect, useCallback, useRef, lazy, Suspense, memo, createElement, FormEvent, ChangeEvent } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { AISettingsErrorBoundary } from "../components/AISettingsErrorBoundary.js";
import { ShellPanel } from "../components/ShellPageTemplate.js";
import styles from "../components/aiSettings.module.css";
import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../shared/providerModels.js";

const e = createElement;

const LazyAuditLogsPanel = lazy(() =>
  import("../components/AIAuditLogsPanel.js").then((m) => ({ default: m.AIAuditLogsPanel }))
);
const LazyPromptConfigDrawer = lazy(() =>
  import("../components/AIAdvisoryPromptConfigDrawer.js").then((m) => ({ default: m.AIAdvisoryPromptConfigDrawer }))
);

const SummaryCard = memo(function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return e("div", { className: styles.summaryCard }, [
    e("p", { key: "title", className: styles.summaryLabel }, title),
    e("p", { key: "value", className: styles.summaryValue }, value),
    e("p", { key: "sub", className: styles.summarySub }, subtitle),
  ]);
});

interface AISettings {
  ai_provider?: string;
  ai_model?: string;
  custom_endpoint?: string;
  advisory_max_tokens_per_day?: number;
  advisory_refresh_interval_hours?: number;
  fallback_quota_max?: number;
  fallback_quota_remaining?: number;
  fallback_quota_reset?: string;
  ai_api_key_configured?: boolean;
  [key: string]: unknown;
}

interface AICommandCenterPageProps {
  className?: string;
}

export function AICommandCenterPage({ className = "" }: AICommandCenterPageProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState("");

  const [aiProvider, setAiProvider] = useState("openclaw");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [customModel, setCustomModel] = useState("");
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [aiApiKey, setAiApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [showCustomEndpoint, setShowCustomEndpoint] = useState(false);
  const [maxTokens, setMaxTokens] = useState(5000);
  const [refreshInterval, setRefreshInterval] = useState(24);
  const [temperature, setTemperature] = useState(0.3);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const [effectiveSource, setEffectiveSource] = useState("command_center");
  const [effectiveProvider, setEffectiveProvider] = useState("");
  const [effectiveModel, setEffectiveModel] = useState("");
  const [aiReady, setAiReady] = useState(false);
  const [aiConfigMessage, setAiConfigMessage] = useState("");
  const [refreshIntervalDisplay, setRefreshIntervalDisplay] = useState(24);
  const [maxAutoRefreshes, setMaxAutoRefreshes] = useState(24);
  const [eventGateEnabled, setEventGateEnabled] = useState<boolean | null>(null);
  const [eventGateSaving, setEventGateSaving] = useState(false);

  const refreshIntervalRef = useRef(refreshInterval);
  refreshIntervalRef.current = refreshInterval;
  const [promptConfigOpen, setPromptConfigOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<Record<string, unknown> | null>(null);
  const [refreshAuditKey, setRefreshAuditKey] = useState(0);

  const loadSettings = useCallback(async (showNoticeFlag = false) => {
    setLoading(true);
    setError("");
    try {
      const data: AISettings = await (coreApiAdapter as any).getAICommandCenterConfig();
      setSettings(data);

      setAiProvider(data.ai_provider || "openclaw");

      const currentModel = data.ai_model || "";
      const modelsForProvider = PROVIDER_MODELS[data.ai_provider || "openclaw"] || [];
      const isKnownModel = modelsForProvider.some(m => m.key === currentModel);

      if (isKnownModel && currentModel !== "custom") {
        setAiModel(currentModel);
        setShowCustomModel(false);
        setCustomModel("");
      } else {
        setAiModel("custom");
        setShowCustomModel(true);
        setCustomModel(currentModel);
      }

      setCustomEndpoint(data.custom_endpoint || "");
      setShowCustomEndpoint(data.ai_provider === "local");
      setMaxTokens(data.advisory_max_tokens_per_day || 5000);
      setRefreshInterval(data.advisory_refresh_interval_hours || 24);
      setTemperature((data as any).temperature ?? 0.3);
      setAiApiKey("");
      setTestLatency(null);

      setEffectiveSource((data as any).effective_ai_source || "command_center");
      setEffectiveProvider((data as any).effective_ai_provider || data.ai_provider || "openclaw");
      setEffectiveModel((data as any).effective_ai_model || data.ai_model || "");
      setAiReady((data as any).ai_ready ?? false);
      setAiConfigMessage((data as any).ai_config_message || "");
      setRefreshIntervalDisplay((data as any).advisory_refresh_interval_hours ?? refreshIntervalRef.current);
      setMaxAutoRefreshes((data as any).advisory_max_auto_refreshes_per_day ?? 24);

      if ((data as any).ai_prompt_config) {
        setPromptConfig((data as any).ai_prompt_config);
      }

      // Load event gate status
      try {
        const userConfig = await (coreApiAdapter as any).getUserConfig();
        const prefs = userConfig?.preferences || {};
        setEventGateEnabled(prefs.advisory_whale_signal_enabled !== false);
      } catch { /* silent fail */ }

      if (showNoticeFlag) {
        setNotice(t("aiCommandCenter.noticeRefreshed") || "Đã làm mới cấu hình AI.");
        setTimeout(() => setNotice(""), 3000);
      }
    } catch (err: unknown) {
      setError((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t("aiCommandCenter.errorLoadConfig") || "Lỗi khi tải cấu hình AI.");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value;
    setAiProvider(provider);
    setShowCustomEndpoint(provider === "local");

    const models = PROVIDER_MODELS[provider] || [];
    if (models.length > 0) {
      const defaultModel = models[0].key;
      setAiModel(defaultModel);
      if (defaultModel === "custom") {
        setShowCustomModel(true);
        setCustomModel("");
      } else {
        setShowCustomModel(false);
        setCustomModel("");
      }
    } else {
      setAiModel("custom");
      setShowCustomModel(true);
      setCustomModel("");
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAiModel(val);
    if (val === "custom") {
      setShowCustomModel(true);
    } else {
      setShowCustomModel(false);
    }
  };

  const handleSaveSettings = async (ev: FormEvent) => {
    if (ev && ev.preventDefault) ev.preventDefault();

    setSaving(true);
    setNotice("");
    setError("");

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    if (!finalModel) {
      setError(t("aiCommandCenter.errorEmptyModel") || "Mô hình AI không được để trống.");
      setSaving(false);
      return;
    }

    const parsedMaxTokens = Number(maxTokens);
    const parsedRefreshInterval = Number(refreshInterval);
    if (!Number.isFinite(parsedMaxTokens) || parsedMaxTokens < 1) {
      setError(t("aiCommandCenter.errorTokensPositive") || "Định mức token/ngày phải lớn hơn 0.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(parsedRefreshInterval) || parsedRefreshInterval < 1) {
      setError(t("aiCommandCenter.errorRefreshPositive") || "Khoảng làm mới (giờ) phải lớn hơn 0.");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
      advisory_max_tokens_per_day: Math.max(1, Math.floor(parsedMaxTokens)),
      advisory_refresh_interval_hours: Math.max(1, Math.floor(parsedRefreshInterval)),
      temperature: Math.min(1, Math.max(0, Number(temperature) || 0.3)),
    };

    if (aiProvider === "local" && customEndpoint.trim()) {
      payload.custom_endpoint = customEndpoint.trim();
    }

    if (aiApiKey.trim()) {
      payload.ai_api_key = aiApiKey.trim();
    }

    if (promptConfig) {
      payload.ai_prompt_config = promptConfig;
    }

    try {
      const nextData: AISettings = await (coreApiAdapter as any).updateAICommandCenterConfig(payload);
      setSettings(nextData);
      setAiApiKey("");
      setEffectiveSource((nextData as any).effective_ai_source || "command_center");
      setEffectiveProvider((nextData as any).effective_ai_provider || aiProvider);
      setEffectiveModel((nextData as any).effective_ai_model || finalModel);
      setAiReady((nextData as any).ai_ready ?? false);
      setRefreshAuditKey(k => k + 1);
      setNotice(t("aiCommandCenter.noticeSaved") || "Lưu cấu hình AI thành công.");
      setTimeout(() => setNotice(""), 3000);
    } catch (err: unknown) {
      setError((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t("aiCommandCenter.errorSaveConfig") || "Lỗi khi lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const handleEventGateToggle = async () => {
    if (eventGateEnabled === null || eventGateSaving) return;
    setEventGateSaving(true);
    setError("");
    try {
      const next = !(eventGateEnabled as boolean);
      const res = await (coreApiAdapter as any).updateUserConfig({ advisory_whale_signal_enabled: next });
      setEventGateEnabled(res?.advisory_whale_signal_enabled ?? next);
    } catch (err: unknown) {
      setError((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t("aiCommandCenter.errorEventGate") || "Lỗi khi cập nhật gate sự kiện.");
    } finally {
      setEventGateSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestResult("");
    setTestLatency(null);

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    const payload: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
    };

    if (aiApiKey.trim()) {
      payload.ai_api_key = aiApiKey.trim();
    }

    if (aiProvider === "local" && customEndpoint.trim()) {
      payload.custom_endpoint = customEndpoint.trim();
    }

    try {
      const data = await (coreApiAdapter as any).testAICommandCenterConnection(payload) as Record<string, unknown>;
      if (data?.ok ?? true) {
        setTestStatus("success");
        setTestResult((data?.message as string) || t("aiCommandCenter.testSuccess") || "Kết nối thành công!");
        if (data?.latency_ms != null) {
          setTestLatency(data.latency_ms as number);
        }
      } else {
        setTestStatus("error");
        setTestResult((data?.message as string) || t("aiCommandCenter.testError") || "Kết nối thất bại.");
      }
    } catch (err: unknown) {
      setTestStatus("error");
      setTestResult((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t("aiCommandCenter.testNetworkError") || "Lỗi mạng khi thử nghiệm kết nối.");
    }
  };

  if (loading) {
    return e("div", { className: styles.panel + " " + className },
      e("p", { className: styles.loading }, t("aiCommandCenter.loadingConfig") || "Đang tải cấu hình AI...")
    );
  }

  const providerOptions = PROVIDER_OPTIONS;

  const modelsForSelectedProvider = PROVIDER_MODELS[aiProvider] || [];

  return e(AISettingsErrorBoundary, {
      fallbackTitle: t("aiCommandCenter.errorBoundaryTitle") || "Lỗi Trung tâm điều hành AI",
      errorMessage: t("aiCommandCenter.unknownError") || "Lỗi không xác định.",
      retryLabel: t("aiCommandCenter.retryButton") || "Thử lại"
    },
    e("div", { className: "shellPage " + className, style: { display: "flex", flexDirection: "column", gap: "20px", maxWidth: 1200, margin: "0 auto" } }, [
      e("header", { className: styles.pageHeader },
        e("div", null, [
          e("span", { key: "eyebrow", className: styles.pageEyebrow }, t("aiCommandCenter.eyebrow") || "Cài đặt"),
          e("h1", { key: "title", className: styles.pageTitle }, t("aiCommandCenter.title") || "Trung tâm điều hành AI"),
          e("p", { key: "desc", className: styles.pageDesc }, t("aiCommandCenter.description") || "Cấu hình nhà cung cấp AI, lựa chọn mô hình và API key phục vụ AI Advisor."),
        ])
      ),

      // Summary Cards
      e(ShellPanel, { key: "overview", title: t("aiCommandCenter.overview") || "Tổng quan" },
        e("div", { className: styles.summaryGrid }, [
          e(SummaryCard, { key: "card-provider", title: t("aiCommandCenter.effectiveProvider"), value: effectiveProvider || "—", subtitle: t("aiCommandCenter.effectiveProviderDesc") }),
          e(SummaryCard, { key: "card-model", title: t("aiCommandCenter.effectiveModel"), value: effectiveModel || t("aiCommandCenter.needsConfig"), subtitle: t("aiCommandCenter.effectiveModelDesc") }),
          e(SummaryCard, { key: "card-source", title: t("aiCommandCenter.effectiveSource"), value: effectiveSource, subtitle: t("aiCommandCenter.effectiveSourceDesc") }),
          e(SummaryCard, { key: "card-status", title: t("aiCommandCenter.runtimeStatus"), value: aiReady ? t("aiCommandCenter.ready") : t("aiCommandCenter.needsConfig"), subtitle: aiReady ? t("aiCommandCenter.readyDesc") : t("aiCommandCenter.needsConfigDesc") }),
        ])
      ),

      // Policy Section
      e(ShellPanel, { key: "policy", title: t("aiCommandCenter.operationPolicy") || "Chính sách vận hành" },
        e("div", { className: styles.metricGrid }, [
          e("div", { key: "pol-gate", className: styles.metricCard }, [
            e("p", { key: "l", className: styles.metricLabel }, t("aiCommandCenter.eventGate") || "Gate sự kiện"),
            e("label", { key: "v", className: styles.toggleRow },
              e("input", {
                type: "checkbox",
                className: styles.checkbox,
                checked: eventGateEnabled === true,
                disabled: eventGateEnabled === null || eventGateSaving,
                onChange: handleEventGateToggle,
              }),
              e("span", null,
                eventGateEnabled === null ? t("aiCommandCenter.gateUnknown") || "Chưa đọc" : eventGateEnabled ? t("aiCommandCenter.gateEnabled") || "Bật" : t("aiCommandCenter.gateDisabled") || "Tắt"
              )
            ),
          ]),
          e("div", { key: "pol-refresh", className: styles.metricCard }, [
            e("p", { key: "l", className: styles.metricLabel }, t("aiCommandCenter.refreshInterval") || "Khoảng làm mới"),
            e("p", { key: "v", className: styles.metricValue }, `${refreshIntervalDisplay} giờ/lần`),
          ]),
          e("div", { key: "pol-auto", className: styles.metricCard }, [
            e("p", { key: "l", className: styles.metricLabel }, t("aiCommandCenter.autoRefreshPerDay") || "Auto refresh/ngày"),
            e("p", { key: "v", className: styles.metricValue }, `${maxAutoRefreshes}`),
          ]),
          e("div", { key: "pol-tokens", className: styles.metricCard }, [
            e("p", { key: "l", className: styles.metricLabel }, t("aiCommandCenter.tokensPerDay") || "Token/ngày"),
            e("p", { key: "v", className: styles.metricValue }, `${maxTokens}`),
          ]),
        ]),
        aiConfigMessage
          ? e("div", { key: "pol-msg", className: styles.helpText },
              `${t("aiCommandCenter.configMessagePrefix") || "Thông điệp cấu hình:"} ${aiConfigMessage}`
            )
          : null
      ),

      notice ? e("div", { key: "notice-banner", className: styles.alert + " " + styles.alertSuccess }, notice) : null,
      error ? e("div", { key: "error-banner", className: styles.alert + " " + styles.alertError }, error) : null,

      // Runtime config form
      e(ShellPanel, { key: "form", title: t("aiCommandCenter.runtimeConfig") || "CẤU HÌNH AI RUNTIME" },
        e("form", { className: styles.formGrid, onSubmit: handleSaveSettings }, [
          e("div", { key: "provider-block", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.providerLabel") || "Nhà cung cấp AI"),
            e("select", {
              className: styles.select,
              value: aiProvider,
              onChange: handleProviderChange,
            }, providerOptions.map(p =>
              e("option", { key: p.key, value: p.key }, p.label)
            ))
          ]),

          e("div", { key: "model-block", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.modelLabel") || "Mô hình AI"),
            e("select", {
              className: styles.select,
              value: aiModel,
              onChange: handleModelChange,
            }, modelsForSelectedProvider.map(m =>
              e("option", { key: m.key, value: m.key }, m.label)
            ))
          ]),

          showCustomModel ? e("div", { key: "custom-model-row", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.customModelLabel") || "Tên mô hình tùy chỉnh"),
            e("input", {
              type: "text",
              className: styles.input,
              value: customModel,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setCustomModel(ev.target.value),
              placeholder: t("aiCommandCenter.customModelPlaceholder") || "Ví dụ: o1-preview, gemini-2.5-pro",
              required: true
            })
          ]) : null,

          showCustomEndpoint ? e("div", { key: "custom-endpoint-row", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.customEndpointLabel") || "Custom Endpoint (API gốc)"),
            e("input", {
              type: "text",
              className: styles.input,
              value: customEndpoint,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setCustomEndpoint(ev.target.value),
              placeholder: t("aiCommandCenter.customEndpointPlaceholder") || "http://localhost:11434/v1",
              required: false
            }),
            e("p", { className: styles.helpText }, t("aiCommandCenter.customEndpointHelp") || "Để trống nếu dùng Ollama mặc định (http://localhost:11434/v1). Điền endpoint nếu dùng vLLM hoặc remote.")
          ]) : null,

          e("div", { key: "api-key-block", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.apiKeyLabel") || "API Key"),
            e("input", {
              type: "password",
              className: styles.input,
              value: aiApiKey,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setAiApiKey(ev.target.value),
              placeholder: settings?.ai_api_key_configured
                ? t("aiCommandCenter.apiKeyPlaceholderConfigured") || "Đã có API Key, nhập key mới để thay đổi..."
                : t("aiCommandCenter.apiKeyPlaceholderNew") || "Nhập API Key của nhà cung cấp...",
              autoComplete: "new-password"
            })
          ]),

          e("div", { key: "token-block", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.maxTokensLabel") || "Định mức Token / ngày"),
            e("input", {
              type: "number",
              min: "1",
              className: styles.input,
              value: maxTokens,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setMaxTokens(Number(ev.target.value)),
              placeholder: "5000"
            })
          ]),

          e("div", { key: "refresh-block", className: styles.field }, [
            e("label", { className: styles.label }, t("aiCommandCenter.refreshIntervalLabel") || "Khoảng làm mới tự động (giờ)"),
            e("input", {
              type: "number",
              min: "1",
              className: styles.input,
              value: refreshInterval,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setRefreshInterval(Number(ev.target.value)),
              placeholder: "24"
            })
          ]),

          e("div", { key: "temperature-block", className: styles.field }, [
            e("label", { className: styles.label }, `${t("aiCommandCenter.temperatureLabel") || "Temperature (0.0 - 1.0)"}: ${Number(temperature).toFixed(1)}`),
            e("input", {
              type: "range",
              min: "0",
              max: "1",
              step: "0.1",
              className: styles.range,
              value: temperature,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setTemperature(Number(ev.target.value)),
            }),
            e("p", { className: styles.helpText }, t("aiCommandCenter.temperatureHelp") || "0 = deterministic, 1 = creative. Mặc định 0.3.")
          ]),

          e("div", { key: "form-actions", className: styles.toolbar }, [
            e("button", {
              key: "save-btn",
              type: "submit",
              disabled: saving,
              className: styles.btn + " " + styles.btnPrimary
            }, saving ? t("aiCommandCenter.savingBtn") || "Đang lưu cấu hình..." : t("aiCommandCenter.saveBtn") || "Lưu cấu hình"),

            e("button", {
              key: "test-btn",
              type: "button",
              onClick: testConnection,
              disabled: testStatus === "testing",
              className: styles.btn
            }, testStatus === "testing" ? t("aiCommandCenter.testingBtn") || "Đang kết nối..." : t("aiCommandCenter.testBtn") || "Kiểm tra kết nối"),

            e("button", {
              key: "refresh-btn",
              type: "button",
              onClick: () => loadSettings(true),
              className: styles.btn + " " + styles.btnGhost
            }, t("aiCommandCenter.refreshFormBtn") || "Làm mới form"),

            e("button", {
              key: "prompt-config-btn",
              type: "button",
              onClick: () => setPromptConfigOpen(true),
              className: styles.btn + " " + styles.btnGhost
            }, t("aiCommandCenter.promptConfig") || "Tinh chỉnh nguồn dữ liệu")
          ]),

          testStatus && testResult
            ? e("div", {
                key: "test-feedback",
                className: styles.alert + " " + (testStatus === "success" ? styles.alertSuccess : styles.alertError),
              }, [
                e("p", { key: "msg" }, testResult),
                testLatency != null
                  ? e("p", { key: "latency", className: styles.helpText }, `${t("aiCommandCenter.latencyLabel") || "Độ trễ"}: ${testLatency}ms`)
                  : null
              ])
            : null
        ])
      ),

      settings && settings.fallback_quota_max != null && settings.fallback_quota_max > 0 && aiProvider !== "openclaw" && aiProvider !== "local"
        ? e(ShellPanel, { key: "quota", title: t("aiCommandCenter.fallbackTitle") || "Sao lưu hệ thống AI (Fallback)" },
            e("div", { className: styles.toolbar }, [
              e("div", {
                key: "quota-bar",
                className: styles.quotaBar
              }, [
                e("div", {
                  style: {
                    width: `${settings.fallback_quota_max > 0
                      ? (settings.fallback_quota_remaining! / settings.fallback_quota_max) * 100
                      : 0}%`
                  } as React.CSSProperties,
                  className: styles.quotaFill + " " + (settings.fallback_quota_remaining! > 0 ? "" : styles.quotaFillEmpty)
                })
              ]),
              e("span", { className: styles.metricLabel },
                `${settings.fallback_quota_remaining} ${t("aiCommandCenter.quotaUsed") || "lượt"} / ${settings.fallback_quota_max} ${t("aiCommandCenter.quotaUsed") || "lượt"}`
              )
            ]),
            settings.fallback_quota_reset
              ? e("p", { className: styles.helpText },
                  `${t("aiCommandCenter.fallbackReset") || "Đặt lại"}: ${new Date(settings.fallback_quota_reset).toLocaleDateString("vi-VN")}`)
              : null,
            settings.fallback_quota_remaining === 0
              ? e("p", { className: styles.alert + " " + styles.alertError },
                  t("aiCommandCenter.fallbackExhausted") || "Đã hết lượt fallback hôm nay. Vui lòng cấu hình API Key cá nhân để tiếp tục sử dụng AI Advisor.")
              : e("p", { className: styles.helpText },
                  t("aiCommandCenter.fallbackInfo") || "Nếu API Key cá nhân gặp lỗi, hệ thống sẽ tự động dùng key sao lưu.")
          )
        : null,

      // Audit Logs Section
      e(ShellPanel, {
          key: "audit",
          title: t("aiCommandCenter.auditLogsTitle") || "Nhật ký audit Command Center",
          subtitle: t("aiCommandCenter.auditLogsDesc") || "Mỗi trang hiển thị 10 bản ghi.",
        },
        e(Suspense, { key: "audit-suspense", fallback: e("p", { className: styles.loading }, t("aiCommandCenter.auditLogsLoading") || "Đang tải nhật ký...") },
          e(LazyAuditLogsPanel, { key: `audit-panel-${refreshAuditKey}`, refreshKey: refreshAuditKey })
        )
      ),

      // Drawer overlay (rendered outside main flow)
      promptConfigOpen
        ? e(Suspense, { key: "drawer-suspense", fallback: null },
            e(LazyPromptConfigDrawer, {
              key: "prompt-config-drawer",
              isOpen: promptConfigOpen,
              onClose: () => setPromptConfigOpen(false),
              config: promptConfig,
              onConfigChange: (nextConfig: Record<string, unknown>) => {
                setPromptConfig(nextConfig);
              },
            })
          )
        : null
    ])
  );
}
