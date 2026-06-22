import { useState, useEffect, useRef } from "react";
import {
  ShellPageChrome,
  ShellPanel,
  renderShellField,
  renderShellMetric,
  renderShellSelectField,
} from "../../components/ShellPageTemplate.js";
import {
  buildSurfaceFlags,
  buildVisibilityFlags,
  deriveCoreShellSnapshot,
  filterAbilitiesBySubject,
  filterVisibleRoutes,
  renderAbilityList,
  renderBuildMetaCard,
  renderFlagList,
  renderHealthStatusPill,
  renderRefreshAction,
  renderSummaryCard,
  useCoreShellPageSnapshot,
} from "../coreShellPageHelpers.js";

const PROVIDER_MODELS: Record<string, { key: string; label: string }[]> = {
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

interface AISettings {
  ai_provider?: string;
  ai_model?: string;
  effective_ai_model?: string;
  ai_ready?: boolean;
  ai_api_key_configured?: boolean;
  advisory_max_tokens_per_day?: number;
  advisory_refresh_interval_hours?: number;
  [key: string]: unknown;
}

interface ShellAiCommandCenterPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: (url: string, options?: RequestInit) => Promise<Response>;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

export function ShellAiCommandCenterPage({
  env = {},
  fetchImpl,
  bootstrapLoader,
  autoLoad = true,
  initialSnapshot = null,
}: ShellAiCommandCenterPageProps) {
  const { viewState, handleRefresh } = useCoreShellPageSnapshot({
    env,
    fetchImpl,
    bootstrapLoader,
    autoLoad,
    initialSnapshot: initialSnapshot as null | undefined,
    fallbackErrorMessage: "Không thể tải snapshot điều hành AI từ core runtime.",
    refreshNotice: "Đã làm mới snapshot điều hành AI từ core runtime.",
  });

  const {
    buildMeta,
    health,
    capabilities,
    session,
    identity,
    visibleGroups,
    visibleRoutes,
    abilities,
    surfaces,
  } = deriveCoreShellSnapshot(viewState);

  const aiRoutes = filterVisibleRoutes(visibleRoutes, ["ai-command-center", "ai-advisory"]);
  const aiFlags = buildSurfaceFlags(surfaces, [
    {
      key: "show_ai_command_center",
      label: "show_ai_command_center",
      detail: "Flag chính xác nhận runtime đang mở lane điều hành AI cho shell hiện tại.",
    },
    {
      key: "show_operations_center",
      label: "show_operations_center",
      detail: "Cho biết lane SOC có đồng thời bật để phối hợp với control center AI hay không.",
    },
    {
      key: "show_vip_shell",
      label: "show_vip_shell",
      detail: "Dùng để đối chiếu xem shell AI hiện tại có đang nằm trong build target VIP hay không.",
    },
  ]);
  const aiAbilities = filterAbilitiesBySubject(abilities, "ai");

  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const [testStatus, setTestStatus] = useState<"testing" | "success" | "error" | null>(null);
  const [testResult, setTestResult] = useState("");

  const [aiProvider, setAiProvider] = useState("openclaw");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [customModel, setCustomModel] = useState("");
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [aiApiKey, setAiApiKey] = useState("");
  const [maxTokens, setMaxTokens] = useState(5000);
  const [refreshInterval, setRefreshInterval] = useState(24);

  const fetchSettingsRef = useRef<((url: string, options?: RequestInit) => Promise<Response>) | null>(null);
  fetchSettingsRef.current = fetchImpl ?? null;

  const loadSettings = async (showNotice = false) => {
    if (!fetchSettingsRef.current) return;
    setLoadingSettings(true);
    setSettingsError("");
    try {
      const res = await fetchSettingsRef.current("/core/v1/workspace/ai-command-center/");
      if (!res.ok) throw new Error("Không thể tải cấu hình AI từ core runtime.");
      const data: AISettings = await res.json();
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

      setMaxTokens(data.advisory_max_tokens_per_day || 5000);
      setRefreshInterval(data.advisory_refresh_interval_hours || 24);
      setAiApiKey("");

      if (showNotice) {
        setSettingsNotice("Đã làm mới cấu hình AI.");
        setTimeout(() => setSettingsNotice(""), 3000);
      }
    } catch (err) {
      setSettingsError((err as Error).message || "Lỗi khi tải cấu hình AI.");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value;
    setAiProvider(provider);

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

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAiModel(val);
    setShowCustomModel(val === "custom");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!fetchSettingsRef.current) return;

    setSavingSettings(true);
    setSettingsNotice("");
    setSettingsError("");

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    if (!finalModel) {
      setSettingsError("Mô hình AI không được để trống.");
      setSavingSettings(false);
      return;
    }

    const payload: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
      advisory_max_tokens_per_day: Number(maxTokens),
      advisory_refresh_interval_hours: Number(refreshInterval),
    };

    if (aiApiKey.trim()) {
      payload.ai_api_key = aiApiKey.trim();
    }

    try {
      const res = await fetchSettingsRef.current("/core/v1/workspace/ai-command-center/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Lỗi khi lưu cấu hình AI.");
      }

      const nextData: AISettings = await res.json();
      setSettings(nextData);
      setAiApiKey("");
      setSettingsNotice("Lưu cấu hình AI thành công.");
      setTimeout(() => setSettingsNotice(""), 3000);
      handleRefresh();
    } catch (err) {
      setSettingsError((err as Error).message || "Lỗi kết nối khi lưu cấu hình.");
    } finally {
      setSavingSettings(false);
    }
  };

  const testConnection = async () => {
    if (!fetchSettingsRef.current) return;
    setTestStatus("testing");
    setTestResult("");

    const finalModel = aiModel === "custom" ? customModel.trim() : aiModel;
    const payload: Record<string, unknown> = {
      ai_provider: aiProvider,
      ai_model: finalModel,
    };

    if (aiApiKey.trim()) {
      payload.ai_api_key = aiApiKey.trim();
    }

    try {
      const res = await fetchSettingsRef.current("/core/v1/workspace/ai-command-center/test-connection/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestStatus("success");
        setTestResult(data.message || "Kết nối thành công!");
      } else {
        setTestStatus("error");
        setTestResult(data.message || "Kết nối thất bại.");
      }
    } catch {
      setTestStatus("error");
      setTestResult("Lỗi mạng khi thử nghiệm kết nối.");
    }
  };

  const metrics = [
    renderShellMetric("Build target", buildMeta?.target || capabilities?.build?.target || "n/a"),
    renderShellMetric("AI Provider", settings?.ai_provider || "n/a"),
    renderShellMetric("AI Model", settings?.effective_ai_model || "Chưa cấu hình"),
    renderShellMetric("Runtime Ready", settings?.ai_ready ? "YES" : "NO"),
  ];

  const summaryCards = [
    renderSummaryCard({
      key: "ai-session",
      title: "Operator và session hiện tại",
      rows: [
        { label: "Username", value: identity.username || session?.principal?.username || "Chưa có" },
        { label: "Plan", value: capabilities?.build?.plan || "n/a" },
        { label: "Session ID", value: session?.session_id || "Chưa có" },
      ],
    }),
    renderSummaryCard({
      key: "ai-runtime",
      title: "Core runtime và adapter",
      rows: [
        { label: "Service", value: health?.service || "core-api" },
        { label: "Environment", value: health?.environment || "foundation" },
        { label: "Base URL", value: buildMeta?.baseUrl || "n/a" },
      ],
    }),
  ];

  const groupFlags = buildVisibilityFlags(visibleGroups, {
    activeItem: "system",
    activeDetail: "Đây là group gating chính chứa route AI command center.",
    visibleDetail: "Group này vẫn đi cùng session AI hiện tại.",
  });

  const routeFlags = buildVisibilityFlags(aiRoutes, {
    activeItem: "ai-command-center",
    activeDetail: "Đây là route AI command center chính đang được shell mở cho session hiện tại.",
    visibleDetail: "Route này đang được runtime cho phép xuất hiện trong shell hiện tại.",
  });

  const providerOptions = [
    { key: "openclaw", label: "OpenClaw (System Default)" },
    { key: "openai", label: "OpenAI (ChatGPT)" },
    { key: "gemini", label: "Google Gemini" },
    { key: "claude", label: "Anthropic (Claude)" },
    { key: "copilot", label: "GitHub Copilot" }
  ];

  const modelsForSelectedProvider = PROVIDER_MODELS[aiProvider] || [];

  return (
    <ShellPageChrome
      eyebrow="Core AI command center"
      title="Trung tâm điều hành AI shell"
      description="Trang này cho phép cấu hình Nhà cung cấp AI và Mô hình AI tương ứng trực tiếp cho core runtime, kết nối đồng bộ an toàn qua SaaS-native endpoints."
      badge={(
        <div className="shellPage__heroBadge">
          <span className="shellPage__statusDot" />
          {viewState.loading ? "Đang đồng bộ..." : "Sẵn sàng hoạt động"}
        </div>
      )}
      metrics={metrics}
      notice={settingsNotice || viewState.notice}
      error={settingsError || viewState.error}
    >
      <section className="shellPage__bodyGrid">
        <div className="shellPage__stack">
          <ShellPanel
            title="Cấu hình AI Runtime"
            subtitle="Thiết lập nhà cung cấp AI, lựa chọn mô hình và API key an toàn."
            actions={renderRefreshAction({ onClick: () => loadSettings(true), disabled: loadingSettings, label: "Làm mới form" })}
          >
            {loadingSettings ? (
              <div className="shellPage__empty">Đang tải cấu hình AI...</div>
            ) : (
              <>
                <form key="ai-settings-form" className="shellPage__form" onSubmit={handleSaveSettings}>
                  <div className="shellPage__formGrid">
                    {renderShellSelectField({
                      label: "Nhà cung cấp AI",
                      name: "ai-provider-select",
                      value: aiProvider,
                      options: providerOptions,
                      onChange: handleProviderChange,
                    })}
                    {renderShellSelectField({
                      label: "Mô hình AI",
                      name: "ai-model-select",
                      value: aiModel,
                      options: modelsForSelectedProvider,
                      onChange: handleModelChange,
                    })}
                  </div>

                  {showCustomModel ? (
                    <div className="shellPage__formGrid" key="custom-model-block">
                      {renderShellField({
                        label: "Tên mô hình tùy chỉnh",
                        name: "ai-custom-model-input",
                        value: customModel,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCustomModel(e.target.value),
                        placeholder: "Ví dụ: o1-mini, gemini-2.0-flash",
                        autoComplete: "off",
                      })}
                    </div>
                  ) : null}

                  <div className="shellPage__formGrid">
                    {renderShellField({
                      label: "API Key",
                      name: "ai-api-key-input",
                      type: "password",
                      value: aiApiKey,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAiApiKey(e.target.value),
                      placeholder: settings?.ai_api_key_configured
                        ? "Đã có API Key, nhập key mới để đổi..."
                        : "Nhập API Key của bạn...",
                      autoComplete: "new-password",
                    })}
                    {renderShellField({
                      label: "Định mức Token / ngày",
                      name: "ai-tokens-input",
                      type: "number",
                      value: maxTokens,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMaxTokens(Number(e.target.value)),
                      placeholder: "5000",
                    })}
                  </div>

                  <div className="shellPage__formGrid">
                    {renderShellField({
                      label: "Khoảng làm mới tự động (giờ)",
                      name: "ai-refresh-input",
                      type: "number",
                      value: refreshInterval,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRefreshInterval(Number(e.target.value)),
                      placeholder: "24",
                    })}
                  </div>

                  <div className="shellPage__actions" style={{ marginTop: "12px" }}>
                    <button type="submit" className="shellPage__button shellPage__button--primary" disabled={savingSettings}>
                      {savingSettings ? "Đang lưu cấu hình..." : "Lưu cấu hình"}
                    </button>
                    <button type="button" className="shellPage__button shellPage__button--secondary" onClick={testConnection} disabled={testStatus === "testing"}>
                      {testStatus === "testing" ? "Đang kết nối..." : "Kiểm tra kết nối"}
                    </button>
                  </div>
                </form>

                {testStatus && testResult ? (
                  <div
                    key="test-feedback"
                    className={`shellPage__banner shellPage__banner--${testStatus === "success" ? "notice" : "error"}`}
                    style={{ marginTop: "14px" }}
                  >
                    {testResult}
                  </div>
                ) : null}
              </>
            )}
          </ShellPanel>

          <ShellPanel
            title="Snapshot operator và runtime"
            subtitle="Đọc nhanh session, build meta và runtime health trước khi nối các control AI thật vào page này."
          >
            <section className="shellPage__summaryGrid">
              {summaryCards}
            </section>
          </ShellPanel>
        </div>

        <ShellPanel
          title="Surface flags và AI abilities"
          subtitle="Giữ cùng một viewport cho auditor đọc tình trạng flag AI, route exposure và quyền liên quan."
          actions={renderHealthStatusPill(health)}
        >
          <div key="ai-groups-block">
            <h3 className="shellPage__itemTitle">AI Groups & Routes</h3>
            {renderFlagList(groupFlags, "Session hiện chưa mở group điều hướng nào.", "ai-groups")}
            <div style={{ height: "10px" }} />
            {renderFlagList(routeFlags, "Runtime hiện chưa expose route AI nào.", "ai-routes")}
          </div>
          {renderFlagList(aiFlags, "Runtime chưa công bố surface flag AI nào.", "ai-flags")}
          {renderBuildMetaCard({ key: "ai-build-meta", buildMeta })}
          {renderAbilityList({
            abilities: aiAbilities,
            emptyText: "Runtime hiện chưa trả về ability AI lane nào cho route này.",
            keyPrefix: "ai-ability",
          })}
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
