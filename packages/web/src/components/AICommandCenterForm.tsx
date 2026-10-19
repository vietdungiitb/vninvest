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
import { AiConfigPreviewModal, type AiConfigConflict } from "./AiConfigPreviewModal.js";

const e = createElement;

// R5.3: 4 system sub-agent prompt (technical/flow/sentiment/synthesis). Chỉ staff
// thấy và sửa — BE cũng chặn 403, UI chặn để user thường không thấy ô trống.
//
// PHẢI Ở CẤP MODULE: khai trong thân component thì identity đổi mỗi render, khiến
// `useCallback(applySettings)` phải thêm dep vô hạn hoặc nuốt dep (L-F10).
// `npm run lint` bắt đúng lỗi này: `react-hooks/exhaustive-deps` tại dòng `applySettings`.
const SUB_AGENT_PROMPT_FIELDS = [
  "technical_agent_prompt",
  "flow_agent_prompt",
  "sentiment_agent_prompt",
  "synthesis_agent_prompt",
] as const;

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
  // R4.2 AC5: chỉ mốc thời gian + scope, không bao giờ chứa bản mã.
  ai_key_rotation?: {
    key_scope?: string;
    key_rotated_at?: string | null;
    grace_until?: string | null;
    within_grace?: boolean;
    days_until_grace_end?: number | null;
    next_rotation_at?: string | null;
  };
  system_prompt_template?: string;
  ai_prompt_config?: Record<string, unknown> | null;
  ai_prompt_config_history?: PromptConfigHistoryEntry[];
  // R5.3: 4 system sub-agent prompt. BE **bỏ hẳn key** khi user không phải staff
  // (`response_data.pop(...)`) nên type phải cho phép vắng, không phải null.
  sub_agent_prompts?: Record<string, string> | null;
  sub_agent_prompts_version?: number;
  effective_ai_source?: string;
  effective_ai_provider?: string;
  effective_ai_model?: string;
  ai_ready?: boolean;
  config_updated_at?: string | null;
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
  /** R1.4 AC2: dirty từ cha (vd promptConfig của page) cũng bật nút Lưu. */
  externalDirty?: boolean;
  /** R1.4 AC3: báo dirty của field về cha để đăng ký beforeunload. */
  onFieldsDirtyChange?: (dirty: boolean) => void;
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
  externalDirty = false,
  onFieldsDirtyChange,
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
  // R1.4 AC2: field nào đổi (so với lần load/save gần nhất) ⇒ dirty ⇒ bật nút Lưu.
  const [fieldsDirty, setFieldsDirty] = useState(false);
  // R1.9: token optimistic lock (lấy từ GET/lần lưu trước, gửi kèm PUT sau).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  // R1.9 AC4/AC5: preview trước lưu + màn xung đột 409.
  interface PreviewEntry {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    payload: Record<string, unknown>;
  }
  const [preview, setPreview] = useState<PreviewEntry | null>(null);
  const [conflict, setConflict] = useState<AiConfigConflict | null>(null);
  const [previewSaving, setPreviewSaving] = useState(false);
  const [subAgentPrompts, setSubAgentPrompts] = useState<Record<string, string>>({
  technical_agent_prompt: "",
  flow_agent_prompt: "",
  sentiment_agent_prompt: "",
  synthesis_agent_prompt: "",
});
const [subAgentPromptsVersion, setSubAgentPromptsVersion] = useState(0);
  // R5.3: bản đã load để so "có đổi không" + làm mốc cho modal diff.
  const loadedSubAgentPromptsRef = useRef<Record<string, string>>({
    technical_agent_prompt: "",
    flow_agent_prompt: "",
    sentiment_agent_prompt: "",
    synthesis_agent_prompt: "",
  });
  // Cờ staff **lấy từ chính payload của BE**: server bỏ hẳn key khi user không
  // phải staff (`response_data.pop`). Dùng cờ đó thay vì `usePortfolio()` để
  // không thêm phụ thuộc context mới (nhiều test render form không bọc
  // PortfolioProvider) — và tránh hai nơi phản quyết định "ai là staff".
  const canEditSubAgentPrompts =
    settings != null &&
    settings.sub_agent_prompts != null &&
    settings.sub_agent_prompts !== undefined;
  useEffect(() => {
    onFieldsDirtyChange?.(fieldsDirty);
  }, [fieldsDirty, onFieldsDirtyChange]);
  // R1.4 AC4/AC6: timer notice có cleanup khi unmount.
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);
  const scheduleNoticeClear = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 3000);
  }, []);
  const [promptConfigOpen, setPromptConfigOpen] = useState(false);
  const [promptConfig, setPromptConfig] = useState<Record<string, unknown> | null>(
    null
  );

  const transportRef = useRef(transport);
  transportRef.current = transport;
  // R1.9 AC4: snapshot hiệu lực lúc load — preview diff so với bản này.
  const loadedEffectiveRef = useRef<Record<string, unknown>>({});

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
      scheduleNoticeClear();
    },
    [onNotice, scheduleNoticeClear]
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
      setFieldsDirty(false);
      // Snapshot hiệu lực lúc load — preview diff so với bản này.
      loadedEffectiveRef.current = {
        ai_provider: data.ai_provider || "openclaw",
        ai_model: data.ai_model || "",
        advisory_max_tokens_per_day: data.advisory_max_tokens_per_day || 5000,
        advisory_refresh_interval_hours: data.advisory_refresh_interval_hours || 24,
        temperature: Number(data.temperature ?? 0.3),
      };
      if (typeof data.config_updated_at === "string") {
        setLastUpdatedAt(data.config_updated_at);
      }

      if (data.ai_prompt_config) {
        setPromptConfig(data.ai_prompt_config);
        onPromptConfigChange?.(data.ai_prompt_config);
      }

      // R5.3: nạp 4 prompt + version hiện hành. Thiếu key (user thường) ⇒ để rỗng,
      // và UI tự ẩn (xem `canEditSubAgentPrompts`).
      const loadedPrompts = data.sub_agent_prompts || {};
      const nextPrompts: Record<string, string> = {};
      for (const key of SUB_AGENT_PROMPT_FIELDS) {
        nextPrompts[key] = String(loadedPrompts[key] ?? "");
      }
      setSubAgentPrompts(nextPrompts);
      setSubAgentPromptsVersion(Number(data.sub_agent_prompts_version ?? 0));
      loadedSubAgentPromptsRef.current = nextPrompts;
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
    setFieldsDirty(true);
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
    setFieldsDirty(true);
    setShowCustomModel(val === "custom");
  };

  const buildCorePayload = () => {
    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    const parsedMaxTokens = Number(maxTokens);
    const parsedRefreshInterval = Number(refreshInterval);
    return { finalModel, parsedMaxTokens, parsedRefreshInterval };
  };

  /** Giá trị hiệu lực hiện trên form (để preview diff với bản đã load). */
  const currentEffective = () => {
    const { finalModel, parsedMaxTokens, parsedRefreshInterval } = buildCorePayload();
    const effective: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
      advisory_max_tokens_per_day: Math.max(1, Math.floor(parsedMaxTokens)),
      advisory_refresh_interval_hours: Math.max(1, Math.floor(parsedRefreshInterval)),
      temperature: Math.min(1, Math.max(0, Number(temperature) || 0.3)),
    };
    // R5.3: kèm 4 prompt để modal diff (R1.9) hiện chúng khi staff sửa.
    if (canEditSubAgentPrompts) {
      for (const key of SUB_AGENT_PROMPT_FIELDS) effective[key] = subAgentPrompts[key] ?? "";
    }
    return effective;
  };

  const buildValidatedPayload = (): Record<string, unknown> | null => {
    const { finalModel, parsedMaxTokens, parsedRefreshInterval } = buildCorePayload();
    if (!finalModel) {
      emitError(t("aiCommandCenter.errorEmptyModel"));
      return null;
    }
    if (!Number.isFinite(parsedMaxTokens) || parsedMaxTokens < 1) {
      emitError(t("aiCommandCenter.errorTokensPositive"));
      return null;
    }
    if (!Number.isFinite(parsedRefreshInterval) || parsedRefreshInterval < 1) {
      emitError(t("aiCommandCenter.errorRefreshPositive"));
      return null;
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
    // R5.3: chỉ gửi khi staff VÀ nội dung thật sự đổi so với bản đã load —
    // BE tăng version mỗi lần nhận giá trị khác, gửi y hệt là vô nghĩa.
    if (canEditSubAgentPrompts) {
      const loaded = loadedSubAgentPromptsRef.current;
      const changed = SUB_AGENT_PROMPT_FIELDS.filter(
        (key) => (subAgentPrompts[key] ?? "") !== (loaded[key] ?? ""),
      );
      if (changed.length > 0) {
        const next: Record<string, string> = {};
        for (const key of SUB_AGENT_PROMPT_FIELDS) next[key] = subAgentPrompts[key] ?? "";
        payload.sub_agent_prompts = next;
      }
    }
    if (getExtraPayload) {
      Object.assign(payload, getExtraPayload());
    }
    return payload;
  };

  const doSaveWithExpected = async (
    payload: Record<string, unknown>,
    expected: string | null
  ): Promise<boolean> => {
    const body: Record<string, unknown> = { ...payload };
    if (expected) body.expected_updated_at = expected;
    setSaving(true);
    setPreviewSaving(true);
    setNotice("");
    setError("");
    try {
      const nextData = await transportRef.current.updateConfig(body);
      setSettings(nextData);
      setAiApiKey("");
      setFieldsDirty(false);
      loadedEffectiveRef.current = currentEffective();
      if (typeof nextData.config_updated_at === "string") {
        setLastUpdatedAt(nextData.config_updated_at);
      }
      onSettingsChange?.(nextData);
      onSettingsSaved?.(nextData);
      emitNotice(t("aiCommandCenter.noticeSaved"));
      setPreview(null);
      setConflict(null);
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: unknown }).code;
      const statusCode = (err as { status?: unknown }).status;
      const errPayload = (err as { payload?: unknown }).payload;
      // R1.9 AC5: 409 xung đột → màn 2 lựa chọn, không lỗi thô.
      if (code === "ai_config_conflict" || statusCode === 409) {
        const body2 = (errPayload && typeof errPayload === "object" ? errPayload : {}) as Record<string, unknown>;
        setConflict({
          currentUpdatedAt:
            typeof body2.current_updated_at === "string" ? body2.current_updated_at : null,
          current:
            body2.current && typeof body2.current === "object"
              ? (body2.current as Record<string, unknown>)
              : {},
        });
        return false;
      }
      emitError(errMsg(err, t("aiCommandCenter.errorSaveConfig")));
      return false;
    } finally {
      setSaving(false);
      setPreviewSaving(false);
    }
  };

  // R1.9 AC4: bấm Lưu → mở preview diff trước, chưa gửi PUT.
  const handleSaveSettings = (ev: FormEvent) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    const payload = buildValidatedPayload();
    if (!payload) return;
    setConflict(null);
    setPreview({ before: loadedEffectiveRef.current, after: currentEffective(), payload });
  };

  const confirmPreviewSave = () => {
    if (!preview) return;
    void doSaveWithExpected(preview.payload, lastUpdatedAt);
  };

  const reloadOverwrite = () => {
    if (!preview || !conflict?.currentUpdatedAt) return;
    void doSaveWithExpected(preview.payload, conflict.currentUpdatedAt);
  };

  const handleClearApiKey = async () => {
    if (saving || !settings?.ai_api_key_configured) return;
    setSaving(true);
    setError("");
    try {
      const nextData = await transportRef.current.updateConfig({ ai_api_key: "" });
      setSettings(nextData);
      setAiApiKey("");
      setFieldsDirty(false);
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
    // R1.4 AC1: skeleton — ẩn mọi giá trị tới khi GET xong (không hiện số giả).
    return e(
      "p",
      {
        className: styles.loading + (className ? " " + className : ""),
        role: "status",
        "aria-busy": true,
      },
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
                e("option", { key: p.key, value: p.key }, t(p.labelKey ?? p.label))
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
                e("option", { key: m.key, value: m.key }, t(m.labelKey ?? m.label))
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
                  onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                    setCustomModel(ev.target.value);
                    setFieldsDirty(true);
                  },
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
                  onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                    setCustomEndpoint(ev.target.value);
                    setFieldsDirty(true);
                  },
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
            // R4.2 AC5: hiện phạm vi khoá + mốc xoay kế tiếp. Dùng **mốc thời
            // gian BE tính sẵn**, không tự suy luận ở FE — hai bên cùng đoán
            // "90 ngày" thì lệch nhau mà không ai thấy.
            settings?.ai_key_rotation
              ? e(
                  "div",
                  {
                    key: "key-rotation-row",
                    className: styles.helpText,
                    "data-testid": "key-rotation-info",
                    style: { marginBottom: 8 },
                  },
                  `${t("aiCommandCenter.keyScopeLabel")}: ${settings.ai_key_rotation.key_scope} · ${t(
                    "aiCommandCenter.nextRotationLabel",
                  )}: ${
                    settings.ai_key_rotation.next_rotation_at
                      ? new Date(settings.ai_key_rotation.next_rotation_at).toLocaleDateString()
                      : t("aiCommandCenter.neverRotated")
                  }`,
                )
              : null,
            e("input", {
              type: "password",
              className: styles.input,
              value: aiApiKey,
              onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                setAiApiKey(ev.target.value);
                setFieldsDirty(true);
              },
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
              onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                setMaxTokens(Number(ev.target.value));
                setFieldsDirty(true);
              },
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
              onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                setRefreshInterval(Number(ev.target.value));
                setFieldsDirty(true);
              },
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
              onChange: (ev: ChangeEvent<HTMLInputElement>) => {
                setTemperature(Number(ev.target.value));
                setFieldsDirty(true);
              },
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
              disabled: saving || (!fieldsDirty && !externalDirty),
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

          // R5.3: 4 system sub-agent prompt (technical/flow/sentiment/synthesis).
          // Chỉ hiện khi BE trả `sub_agent_prompts` — tức là **chỉ staff**
          // (`response_data.pop` bỏ key cho user thường). Không có hai nơi phản
          // quyết định "ai là staff".
          canEditSubAgentPrompts
            ? e(
                "section",
                {
                  key: "sub-agent-prompts",
                  "data-testid": "sub-agent-prompts",
                  className: styles.indicatorsSection,
                  "aria-label": t("aiCommandCenter.subAgent.title"),
                },
                [
                  e(
                    "h3",
                    { key: "h", className: styles.sectionTitle },
                    t("aiCommandCenter.subAgent.title"),
                    " ",
                    e(
                      "span",
                      { key: "ver", className: styles.helpText },
                      t("aiCommandCenter.subAgent.version", { version: subAgentPromptsVersion }),
                    ),
                  ),
                  e(
                    "p",
                    { key: "desc", className: styles.helpText },
                    t("aiCommandCenter.subAgent.desc"),
                  ),
                  ...SUB_AGENT_PROMPT_FIELDS.map((key) =>
                    e("label", { key, className: styles.field }, [
                      e(
                        "span",
                        { key: "lb", className: styles.label },
                        t(`aiCommandCenter.subAgent.fields.${key}`),
                      ),
                      e("textarea", {
                        key: "ta",
                        "data-testid": `sub-agent-${key}`,
                        rows: 4,
                        maxLength: 4000,
                        value: subAgentPrompts[key] ?? "",
                        placeholder: t(`aiCommandCenter.subAgent.placeholders.${key}`),
                        onChange: (ev: ChangeEvent<HTMLTextAreaElement>) => {
                          const next = { ...subAgentPrompts, [key]: ev.target.value };
                          setSubAgentPrompts(next);
                          const loaded = loadedSubAgentPromptsRef.current;
                          setFieldsDirty(
                            SUB_AGENT_PROMPT_FIELDS.some(
                              (k) => (next[k] ?? "") !== (loaded[k] ?? ""),
                            ),
                          );
                        },
                      }),
                    ]),
                  ),
                ],
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

    // R1.9 AC4/AC5: preview diff + màn xung đột 409.
    preview
      ? e(AiConfigPreviewModal, {
          key: "config-preview-modal",
          before: preview.before,
          after: preview.after,
          conflict,
          saving: previewSaving,
          onConfirm: confirmPreviewSave,
          onCancel: () => {
            setPreview(null);
            setConflict(null);
          },
          onReloadOverwrite: reloadOverwrite,
        })
      : null,

    // localeTag reserved for future date formatting in form help text
    e("span", { key: "locale-anchor", hidden: true, "data-locale": localeTag })
  );
}
