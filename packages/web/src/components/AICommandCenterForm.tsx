import {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
  createElement,
  FormEvent,
  ChangeEvent,
} from "react";
import { useI18n } from "../context/LangContext.js";
import styles from "./aiSettings.module.css";
import { PROVIDER_MODELS, PROVIDER_OPTIONS } from "../shared/providerModels.js";

const e = createElement;

const LazyPromptConfigDrawer = lazy(() =>
  import("./AIAdvisoryPromptConfigDrawer.js").then((m) => ({
    default: m.AIAdvisoryPromptConfigDrawer,
  }))
);

export interface AISettings {
  ai_provider?: string;
  ai_model?: string;
  custom_endpoint?: string;
  advisory_max_tokens_per_day?: number;
  advisory_refresh_interval_hours?: number;
  advisory_max_auto_refreshes_per_day?: number;
  temperature?: number;
  fallback_quota_max?: number;
  fallback_quota_remaining?: number;
  fallback_quota_reset?: string;
  ai_api_key_configured?: boolean;
  ai_api_key_masked?: string;
  system_prompt_template?: string;
  ai_prompt_config?: Record<string, unknown> | null;
  ai_prompt_config_history?: PromptConfigHistoryEntry[];
  effective_ai_source?: string;
  effective_ai_provider?: string;
  effective_ai_model?: string;
  ai_ready?: boolean;
  ai_config_message?: string;
  [key: string]: unknown;
}

export interface PromptConfigHistoryEntry {
  version: number;
  config: Record<string, unknown>;
  saved_at: string;
  source?: string;
}

/** F-AC8 field checklist — both SaaS page and Shell must render these testids. */
export const AI_CC_FORM_FIELD_TESTIDS = [
  "field-ai-provider",
  "field-ai-model",
  "field-custom-model",
  "field-custom-endpoint",
  "field-api-key",
  "field-max-tokens",
  "field-refresh-interval",
  "field-temperature",
] as const;

export interface AICommandCenterTransport {
  getConfig: () => Promise<AISettings>;
  updateConfig: (payload: Record<string, unknown>) => Promise<AISettings>;
  testConnection: (
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
}

export interface AICommandCenterFormProps {
  transport: AICommandCenterTransport;
  className?: string;
  /** Optional i18n override (Shell embed without LangProvider). */
  t?: (key: string, varsOrDefault?: Record<string, unknown> | string) => string;
  localeTag?: string;
  onSettingsChange?: (data: AISettings) => void;
  onSettingsSaved?: (data: AISettings) => void;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
  onPromptConfigChange?: (config: Record<string, unknown> | null) => void;
  /** R0.3: chi drawer edit goi (load/drawer-mo KHONG goi) — parent danh dau dirty. */
  onPromptConfigEdited?: (config: Record<string, unknown>) => void;
  /** Extra PUT fields (e.g. ai_prompt_config owned by parent).
   * R0.3: drawer edit rieng bao qua onPromptConfigEdited de parent biet
   * dirty (load thuong qua onPromptConfigChange KHONG danh dau dirty). */
  getExtraPayload?: () => Record<string, unknown>;
  showRefreshButton?: boolean;
  showPromptConfigButton?: boolean;
}

function errMsg(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? (err as Error).message
    : fallback;
}

/**
 * Shared runtime-config form (F8). SaaS `AICommandCenterPage` and
 * `ShellAiCommandCenterPage` both import this — 0 field drift by construction.
 */
export function AICommandCenterForm({
  transport,
  className = "",
  t: tProp,
  localeTag: localeTagProp,
  onSettingsChange,
  onSettingsSaved,
  onError,
  onNotice,
  onPromptConfigChange,
  onPromptConfigEdited,
  getExtraPayload,
  showRefreshButton = true,
  showPromptConfigButton = true,
}: AICommandCenterFormProps) {
  const i18n = useI18n();
  const t = tProp ?? i18n.t;
  const localeTag = localeTagProp ?? i18n.localeTag;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState("");
  const [testLatency, setTestLatency] = useState<number | null>(null);

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

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [promptConfigOpen, setPromptConfigOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<Record<string, unknown> | null>(
    null
  );

  const transportRef = useRef(transport);
  transportRef.current = transport;

  const emitError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const emitNotice = useCallback(
    (message: string) => {
      setNotice(message);
      onNotice?.(message);
      setTimeout(() => setNotice(""), 3000);
    },
    [onNotice]
  );

  const applySettings = useCallback(
    (data: AISettings) => {
      setSettings(data);
      onSettingsChange?.(data);

      setAiProvider(data.ai_provider || "openclaw");

      const currentModel = data.ai_model || "";
      const modelsForProvider = PROVIDER_MODELS[data.ai_provider || "openclaw"] || [];
      const isKnownModel = modelsForProvider.some((m) => m.key === currentModel);

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
      setTemperature(Number(data.temperature ?? 0.3));
      setAiApiKey("");
      setTestLatency(null);

      if (data.ai_prompt_config) {
        setPromptConfig(data.ai_prompt_config);
        onPromptConfigChange?.(data.ai_prompt_config);
      }
    },
    [onSettingsChange, onPromptConfigChange]
  );

  const loadSettings = useCallback(
    async (showNoticeFlag = false) => {
      setLoading(true);
      setError("");
      try {
        const data = await transportRef.current.getConfig();
        applySettings(data);
        if (showNoticeFlag) {
          emitNotice(t("aiCommandCenter.noticeRefreshed"));
        }
      } catch (err: unknown) {
        emitError(errMsg(err, t("aiCommandCenter.errorLoadConfig")));
      } finally {
        setLoading(false);
      }
    },
    [applySettings, emitError, emitNotice, t]
  );

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProviderChange = (ev: ChangeEvent<HTMLSelectElement>) => {
    const provider = ev.target.value;
    setAiProvider(provider);
    setShowCustomEndpoint(provider === "local");

    const models = PROVIDER_MODELS[provider] || [];
    if (models.length > 0) {
      const defaultModel = models[0].key;
      setAiModel(defaultModel);
      setShowCustomModel(defaultModel === "custom");
      setCustomModel("");
    } else {
      setAiModel("custom");
      setShowCustomModel(true);
      setCustomModel("");
    }
  };

  const handleModelChange = (ev: ChangeEvent<HTMLSelectElement>) => {
    const val = ev.target.value;
    setAiModel(val);
    setShowCustomModel(val === "custom");
  };

  const buildCorePayload = () => {
    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    const parsedMaxTokens = Number(maxTokens);
    const parsedRefreshInterval = Number(refreshInterval);
    return { finalModel, parsedMaxTokens, parsedRefreshInterval };
  };

  const handleSaveSettings = async (ev: FormEvent) => {
    if (ev && ev.preventDefault) ev.preventDefault();

    setSaving(true);
    setNotice("");
    setError("");

    const { finalModel, parsedMaxTokens, parsedRefreshInterval } = buildCorePayload();
    if (!finalModel) {
      emitError(t("aiCommandCenter.errorEmptyModel"));
      setSaving(false);
      return;
    }
    if (!Number.isFinite(parsedMaxTokens) || parsedMaxTokens < 1) {
      emitError(t("aiCommandCenter.errorTokensPositive"));
      setSaving(false);
      return;
    }
    if (!Number.isFinite(parsedRefreshInterval) || parsedRefreshInterval < 1) {
      emitError(t("aiCommandCenter.errorRefreshPositive"));
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
    if (getExtraPayload) {
      Object.assign(payload, getExtraPayload());
    }

    try {
      const nextData = await transportRef.current.updateConfig(payload);
      setSettings(nextData);
      setAiApiKey("");
      onSettingsChange?.(nextData);
      onSettingsSaved?.(nextData);
      emitNotice(t("aiCommandCenter.noticeSaved"));
    } catch (err: unknown) {
      emitError(errMsg(err, t("aiCommandCenter.errorSaveConfig")));
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    if (saving || !settings?.ai_api_key_configured) return;
    setSaving(true);
    setError("");
    try {
      const nextData = await transportRef.current.updateConfig({ ai_api_key: "" });
      setSettings(nextData);
      setAiApiKey("");
      onSettingsChange?.(nextData);
      emitNotice(t("aiCommandCenter.apiKeyCleared"));
    } catch (err: unknown) {
      emitError(errMsg(err, t("aiCommandCenter.apiKeyClearFailed")));
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestStatus("testing");
    setTestResult("");
    setTestLatency(null);

    const { finalModel } = buildCorePayload();
    const payload: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
    };
    if (aiApiKey.trim()) payload.ai_api_key = aiApiKey.trim();
    if (aiProvider === "local" && customEndpoint.trim()) {
      payload.custom_endpoint = customEndpoint.trim();
    }

    try {
      const data = await transportRef.current.testConnection(payload);
      if (data?.ok ?? true) {
        setTestStatus("success");
        setTestResult((data?.message as string) || t("aiCommandCenter.testSuccess"));
        if (data?.latency_ms != null) {
          setTestLatency(data.latency_ms as number);
        }
      } else {
        setTestStatus("error");
        setTestResult((data?.message as string) || t("aiCommandCenter.testError"));
      }
    } catch (err: unknown) {
      setTestStatus("error");
      setTestResult(errMsg(err, t("aiCommandCenter.testNetworkError")));
    }
  };

  if (loading) {
    return e(
      "p",
      { className: styles.loading + (className ? " " + className : "") },
      t("aiCommandCenter.loadingConfig")
    );
  }

  const modelsForSelectedProvider = PROVIDER_MODELS[aiProvider] || [];

  return e(
    "div",
    { className: className || undefined },
    e(
      "form",
      { className: styles.formGrid, onSubmit: handleSaveSettings, "data-testid": "ai-cc-form" },
      [
        e(
          "div",
          { key: "provider-block", className: styles.field, "data-testid": "field-ai-provider" },
          [
            e("label", { className: styles.label }, t("aiCommandCenter.providerLabel")),
            e(
              "select",
              {
                className: styles.select,
                value: aiProvider,
                onChange: handleProviderChange,
              },
              PROVIDER_OPTIONS.map((p) =>
                e("option", { key: p.key, value: p.key }, p.label)
              )
            ),
          ]
        ),

        e(
          "div",
          { key: "model-block", className: styles.field, "data-testid": "field-ai-model" },
          [
            e("label", { className: styles.label }, t("aiCommandCenter.modelLabel")),
            e(
              "select",
              {
                className: styles.select,
                value: aiModel,
                onChange: handleModelChange,
              },
              modelsForSelectedProvider.map((m) =>
                e("option", { key: m.key, value: m.key }, m.label)
              )
            ),
          ]
        ),

        showCustomModel
          ? e(
              "div",
              {
                key: "custom-model-row",
                className: styles.field,
                "data-testid": "field-custom-model",
              },
              [
                e("label", { className: styles.label }, t("aiCommandCenter.customModelLabel")),
                e("input", {
                  type: "text",
                  className: styles.input,
                  value: customModel,
                  onChange: (ev: ChangeEvent<HTMLInputElement>) =>
                    setCustomModel(ev.target.value),
                  placeholder: t("aiCommandCenter.customModelPlaceholder"),
                  required: true,
                }),
              ]
            )
          : null,

        showCustomEndpoint
          ? e(
              "div",
              {
                key: "custom-endpoint-row",
                className: styles.field,
                "data-testid": "field-custom-endpoint",
              },
              [
                e(
                  "label",
                  { className: styles.label },
                  t("aiCommandCenter.customEndpointLabel")
                ),
                e("input", {
                  type: "text",
                  className: styles.input,
                  value: customEndpoint,
                  onChange: (ev: ChangeEvent<HTMLInputElement>) =>
                    setCustomEndpoint(ev.target.value),
                  placeholder: t("aiCommandCenter.customEndpointPlaceholder"),
                  required: false,
                }),
                e(
                  "p",
                  { className: styles.helpText },
                  t("aiCommandCenter.customEndpointHelp")
                ),
              ]
            )
          : null,

        e(
          "div",
          { key: "api-key-block", className: styles.field, "data-testid": "field-api-key" },
          [
            e("label", { className: styles.label }, t("aiCommandCenter.apiKeyLabel")),
            settings?.ai_api_key_configured &&
            settings?.ai_api_key_masked &&
            !aiApiKey
              ? e(
                  "div",
                  { key: "mask-row", className: styles.toolbar, style: { marginBottom: 8 } },
                  [
                    e(
                      "span",
                      {
                        key: "mask",
                        className: styles.helpText,
                        "data-testid": "api-key-mask",
                        style: { fontFamily: "monospace" },
                      },
                      `${t("aiCommandCenter.apiKeyMaskedLabel")}: ${settings.ai_api_key_masked}`
                    ),
                    e(
                      "button",
                      {
                        key: "clear-key",
                        type: "button",
                        className: `${styles.btn} ${styles.btnSm} ${styles.btnDanger}`,
                        disabled: saving,
                        onClick: handleClearApiKey,
                        "data-testid": "clear-api-key",
                      },
                      t("aiCommandCenter.clearApiKey")
                    ),
                  ]
                )
              : null,
            e("input", {
              type: "password",
              className: styles.input,
              value: aiApiKey,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => setAiApiKey(ev.target.value),
              placeholder: settings?.ai_api_key_configured
                ? t("aiCommandCenter.apiKeyPlaceholderConfigured")
                : t("aiCommandCenter.apiKeyPlaceholderNew"),
              autoComplete: "new-password",
            }),
          ]
        ),

        e(
          "div",
          { key: "token-block", className: styles.field, "data-testid": "field-max-tokens" },
          [
            e("label", { className: styles.label }, t("aiCommandCenter.maxTokensLabel")),
            e("input", {
              type: "number",
              min: "1",
              className: styles.input,
              value: maxTokens,
              onChange: (ev: ChangeEvent<HTMLInputElement>) =>
                setMaxTokens(Number(ev.target.value)),
              placeholder: "5000",
            }),
          ]
        ),

        e(
          "div",
          { key: "refresh-block", className: styles.field, "data-testid": "field-refresh-interval" },
          [
            e(
              "label",
              { className: styles.label },
              t("aiCommandCenter.refreshIntervalLabel")
            ),
            e("input", {
              type: "number",
              min: "1",
              className: styles.input,
              value: refreshInterval,
              onChange: (ev: ChangeEvent<HTMLInputElement>) =>
                setRefreshInterval(Number(ev.target.value)),
              placeholder: "24",
            }),
          ]
        ),

        e(
          "div",
          { key: "temperature-block", className: styles.field, "data-testid": "field-temperature" },
          [
            e(
              "label",
              { className: styles.label },
              `${t("aiCommandCenter.temperatureLabel")}: ${Number(temperature).toFixed(1)}`
            ),
            e("input", {
              type: "range",
              min: "0",
              max: "1",
              step: "0.1",
              className: styles.range,
              value: temperature,
              onChange: (ev: ChangeEvent<HTMLInputElement>) =>
                setTemperature(Number(ev.target.value)),
            }),
            e("p", { className: styles.helpText }, t("aiCommandCenter.temperatureHelp")),
          ]
        ),

        e("div", { key: "form-actions", className: styles.toolbar }, [
          e(
            "button",
            {
              key: "save-btn",
              type: "submit",
              disabled: saving,
              className: styles.btn + " " + styles.btnPrimary,
              "data-testid": "save-config",
            },
            saving ? t("aiCommandCenter.savingBtn") : t("aiCommandCenter.saveBtn")
          ),

          e(
            "button",
            {
              key: "test-btn",
              type: "button",
              onClick: testConnection,
              disabled: testStatus === "testing",
              className: styles.btn,
              "data-testid": "test-connection",
            },
            testStatus === "testing" ? t("aiCommandCenter.testingBtn") : t("aiCommandCenter.testBtn")
          ),

          showRefreshButton
            ? e(
                "button",
                {
                  key: "refresh-btn",
                  type: "button",
                  onClick: () => loadSettings(true),
                  className: styles.btn + " " + styles.btnGhost,
                  "data-testid": "refresh-form",
                },
                t("aiCommandCenter.refreshFormBtn")
              )
            : null,

          showPromptConfigButton
            ? e(
                "button",
                {
                  key: "prompt-config-btn",
                  type: "button",
                  onClick: () => setPromptConfigOpen(true),
                  className: styles.btn + " " + styles.btnGhost,
                  "data-testid": "open-prompt-config",
                },
                t("aiCommandCenter.promptConfig")
              )
            : null,
        ]),

        // Parent (SaaS page) owns banner display when onError/onNotice provided —
        // avoid duplicate text in DOM (getByText multi-match).
        notice && !onNotice
          ? e(
              "div",
              { key: "form-notice", className: styles.alert + " " + styles.alertSuccess, "data-testid": "form-notice" },
              notice
            )
          : null,
        error && !onError
          ? e(
              "div",
              { key: "form-error", className: styles.alert + " " + styles.alertError, "data-testid": "form-error" },
              error
            )
          : null,

        testStatus && testResult
          ? e(
              "div",
              {
                key: "test-feedback",
                className:
                  styles.alert +
                  " " +
                  (testStatus === "success" ? styles.alertSuccess : styles.alertError),
                "data-testid": "test-feedback",
              },
              [
                e("p", { key: "msg" }, testResult),
                testLatency != null
                  ? e(
                      "p",
                      { key: "latency", className: styles.helpText },
                      `${t("aiCommandCenter.latencyLabel")}: ${testLatency}ms`
                    )
                  : null,
              ]
            )
          : null,
      ]
    ),

    promptConfigOpen
      ? e(Suspense, { key: "drawer-suspense", fallback: null },
          e(LazyPromptConfigDrawer, {
            key: "prompt-config-drawer",
            isOpen: promptConfigOpen,
            onClose: () => setPromptConfigOpen(false),
            config: promptConfig,
            onConfigChange: (nextConfig: Record<string, unknown>) => {
              setPromptConfig(nextConfig);
              onPromptConfigChange?.(nextConfig);
              onPromptConfigEdited?.(nextConfig);
            },
          })
        )
      : null,

    // localeTag reserved for future date formatting in form help text
    e("span", { key: "locale-anchor", hidden: true, "data-locale": localeTag })
  );
}
