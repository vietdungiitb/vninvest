import { useState, useEffect, createElement } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";

const e = createElement;

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
  local: [
    { key: "llama3.2", label: "llama3.2" },
    { key: "llama3.1", label: "llama3.1" },
    { key: "mistral", label: "mistral" },
    { key: "phi4", label: "phi-4" },
    { key: "qwen2.5", label: "qwen2.5" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  copilot: [
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ]
};

export function AICommandCenterPage({ className = "" }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [testStatus, setTestStatus] = useState(null); // "testing", "success", "error"
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
  const [testLatency, setTestLatency] = useState(null);

  const loadSettings = async (showNotice = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await coreApiAdapter.getAICommandCenterConfig();
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
      setAiApiKey(""); // always clear raw input key
      setTestLatency(null);

      if (showNotice) {
        setNotice("Đã làm mới cấu hình AI.");
        setTimeout(() => setNotice(""), 3000);
      }
    } catch (err) {
      setError(err.message || "Lỗi khi tải cấu hình AI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleProviderChange = (e) => {
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

  const handleModelChange = (e) => {
    const val = e.target.value;
    setAiModel(val);
    if (val === "custom") {
      setShowCustomModel(true);
    } else {
      setShowCustomModel(false);
    }
  };

  const handleSaveSettings = async (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();

    setSaving(true);
    setNotice("");
    setError("");

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    if (!finalModel) {
      setError("Mô hình AI không được để trống.");
      setSaving(false);
      return;
    }

    const payload = {
      ai_provider: aiProvider,
      ai_model: finalModel,
      advisory_max_tokens_per_day: parseInt(maxTokens),
      advisory_refresh_interval_hours: parseInt(refreshInterval),
    };

    if (aiProvider === "local" && customEndpoint.trim()) {
      payload.custom_endpoint = customEndpoint.trim();
    }

    if (aiApiKey.trim()) {
      payload.ai_api_key = aiApiKey.trim();
    }

    try {
      const nextData = await coreApiAdapter.updateAICommandCenterConfig(payload);
      setSettings(nextData);
      setAiApiKey(""); // clear input key
      setNotice("Lưu cấu hình AI thành công.");
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err.message || "Lỗi khi lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestResult("");
    setTestLatency(null);

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    const payload = {
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
      const data = await coreApiAdapter.testAICommandCenterConnection(payload);
      if (data?.ok ?? true) {
        setTestStatus("success");
        setTestResult(data?.message || "Kết nối thành công!");
        if (data?.latency_ms != null) {
          setTestLatency(data.latency_ms);
        }
      } else {
        setTestStatus("error");
        setTestResult(data?.message || "Kết nối thất bại.");
      }
    } catch (err) {
      setTestStatus("error");
      setTestResult(err.message || "Lỗi mạng khi thử nghiệm kết nối.");
    }
  };

  if (loading) {
    return e("div", { className: "core-ai-command-center core-page-loading " + className },
      e("p", null, "Đang tải cấu hình AI...")
    );
  }

  const providerOptions = [
    { key: "openclaw", label: "OpenClaw (System Default)" },
    { key: "openai", label: "OpenAI (ChatGPT)" },
    { key: "gemini", label: "Google Gemini" },
    { key: "claude", label: "Anthropic (Claude)" },
    { key: "local", label: "Local Model (Ollama/vLLM)" },
    { key: "copilot", label: "GitHub Copilot" }
  ];

  const modelsForSelectedProvider = PROVIDER_MODELS[aiProvider] || [];

  return e("div", { className: "mx-auto max-w-[1200px] space-y-4 px-5 py-6 " + className }, [
    // Header
    e("header", { key: "header", className: "core-page-header" }, [
      e("h1", { className: "text-xl font-bold text-slate-100" }, "Trung tâm điều hành AI"),
      e("p", { className: "mt-1 text-sm text-slate-400" }, "Cấu hình nhà cung cấp AI, lựa chọn mô hình và API key phục vụ AI Advisor.")
    ]),

    // Notice & Error Banners
    notice ? e("div", { key: "notice-banner", className: "rounded-lg border border-emerald-700/70 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200" }, notice) : null,
    error ? e("div", { key: "error-banner", className: "rounded-lg border border-rose-700/70 bg-rose-900/20 px-3 py-2 text-sm text-rose-200" }, error) : null,

    // Form settings card
    e("form", { key: "settings-form", className: "space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6", onSubmit: handleSaveSettings }, [
      e("h2", { key: "form-title", className: "text-sm font-semibold uppercase tracking-wide text-slate-300" }, "CẤU HÌNH AI RUNTIME"),

      e("div", { key: "row-1", className: "grid grid-cols-1 gap-4 md:grid-cols-2" }, [
        // Provider select
        e("div", { key: "provider-block" }, [
          e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Nhà cung cấp AI"),
          e("select", {
            value: aiProvider,
            onChange: handleProviderChange,
            className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          }, providerOptions.map(p =>
            e("option", { key: p.key, value: p.key }, p.label)
          ))
        ]),

        // Model select
        e("div", { key: "model-block" }, [
          e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Mô hình AI"),
          e("select", {
            value: aiModel,
            onChange: handleModelChange,
            className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          }, modelsForSelectedProvider.map(m =>
            e("option", { key: m.key, value: m.key }, m.label)
          ))
        ])
      ]),

      // Custom model name
      showCustomModel ? e("div", { key: "custom-model-row" }, [
        e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Tên mô hình tùy chỉnh"),
        e("input", {
          type: "text",
          value: customModel,
          onChange: (ev) => setCustomModel(ev.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
          placeholder: "Ví dụ: o1-preview, gemini-2.5-pro",
          required: true
        })
      ]) : null,

      // Custom Endpoint (for local provider)
      showCustomEndpoint ? e("div", { key: "custom-endpoint-row" }, [
        e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Custom Endpoint (API gốc)"),
        e("input", {
          type: "text",
          value: customEndpoint,
          onChange: (ev) => setCustomEndpoint(ev.target.value),
          className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
          placeholder: "http://localhost:11434/v1",
          required: false
        }),
        e("p", { className: "mt-1 text-xs text-slate-500" }, "Để trống nếu dùng Ollama mặc định (http://localhost:11434/v1). Điền endpoint nếu dùng vLLM hoặc remote.")
      ]) : null,

      e("div", { key: "row-2", className: "grid grid-cols-1 gap-4 md:grid-cols-2" }, [
        // API Key
        e("div", { key: "api-key-block" }, [
          e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "API Key"),
          e("input", {
            type: "password",
            value: aiApiKey,
            onChange: (ev) => setAiApiKey(ev.target.value),
            className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
            placeholder: settings?.ai_api_key_configured
              ? "Đã có API Key, nhập key mới để thay đổi..."
              : "Nhập API Key của nhà cung cấp...",
            autoComplete: "new-password"
          })
        ]),

        // Token Limit
        e("div", { key: "token-block" }, [
          e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Định mức Token / ngày"),
          e("input", {
            type: "number",
            value: maxTokens,
            onChange: (ev) => setMaxTokens(ev.target.value),
            className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
            placeholder: "5000"
          })
        ])
      ]),

      // Auto refresh interval
      e("div", { key: "row-3", className: "grid grid-cols-1 gap-4 md:grid-cols-2" }, [
        e("div", { key: "refresh-block" }, [
          e("label", { className: "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Khoảng làm mới tự động (giờ)"),
          e("input", {
            type: "number",
            value: refreshInterval,
            onChange: (ev) => setRefreshInterval(ev.target.value),
            className: "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500",
            placeholder: "24"
          })
        ])
      ]),

      // Actions
      e("div", { key: "form-actions", className: "flex flex-wrap gap-2 pt-2" }, [
        e("button", {
          key: "save-btn",
          type: "submit",
          disabled: saving,
          className: "rounded-lg border border-cyan-600 bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-50"
        }, saving ? "Đang lưu cấu hình..." : "Lưu cấu hình"),

        e("button", {
          key: "test-btn",
          type: "button",
          onClick: testConnection,
          disabled: testStatus === "testing",
          className: "rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        }, testStatus === "testing" ? "Đang kết nối..." : "Kiểm tra kết nối"),

        e("button", {
          key: "refresh-btn",
          type: "button",
          onClick: () => loadSettings(true),
          className: "rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
        }, "Làm mới form")
      ]),

      // Connection test result feedback
      testStatus && testResult
        ? e("div", {
            key: "test-feedback",
            className: `rounded-lg border p-3 text-sm mt-3 ${
              testStatus === "success"
                ? "border-emerald-700/65 bg-emerald-950/40 text-emerald-300"
                : "border-rose-700/65 bg-rose-950/40 text-rose-300"
            }`
          }, [
            e("p", { key: "msg" }, testResult),
            testLatency != null
              ? e("p", { key: "latency", className: "mt-1 text-xs opacity-70" }, `Độ trễ: ${testLatency}ms`)
              : null
          ])
        : null
    ]),

    // Fallback Quota status (only visible when provider is not openclaw/local and personal key is configured)
    settings && settings.fallback_quota_max > 0 && aiProvider !== "openclaw" && aiProvider !== "local"
      ? e("div", { key: "quota-card", className: "rounded-xl border border-slate-800 bg-slate-900/30 p-4" }, [
          e("h3", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400" }, "Sao lưu hệ thống AI (Fallback)"),
          e("div", { className: "flex items-center gap-3" }, [
            e("div", {
              key: "quota-bar",
              className: "h-2 flex-1 overflow-hidden rounded-full bg-slate-800"
            }, [
              e("div", {
                style: {
                  width: `${settings.fallback_quota_max > 0
                    ? (settings.fallback_quota_remaining / settings.fallback_quota_max) * 100
                    : 0}%`
                },
                className: `h-full rounded-full transition-all ${
                  settings.fallback_quota_remaining > 0
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`
              })
            ]),
            e("span", { className: "text-xs text-slate-400" },
              `${settings.fallback_quota_remaining} / ${settings.fallback_quota_max} lượt`
            )
          ]),
          settings.fallback_quota_reset
            ? e("p", { className: "mt-1 text-xs text-slate-500" },
                `Đặt lại: ${new Date(settings.fallback_quota_reset).toLocaleDateString("vi-VN")}`)
            : null,
          settings.fallback_quota_remaining === 0
            ? e("p", { className: "mt-2 text-xs text-rose-400" },
                "Đã hết lượt fallback hôm nay. Vui lòng cấu hình API Key cá nhân để tiếp tục sử dụng AI Advisor.")
            : e("p", { className: "mt-2 text-xs text-slate-500" },
                "Nếu API Key cá nhân gặp lỗi, hệ thống sẽ tự động dùng key sao lưu.")
        ])
      : null
  ]);
}
