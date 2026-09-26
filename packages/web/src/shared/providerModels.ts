export interface ProviderModelOption {
  key: string;
  label: string;
}

export const PROVIDER_MODELS: Record<string, ProviderModelOption[]> = {
  openai: [
    { key: "gpt-4.1", label: "gpt-4.1" },
    { key: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { key: "gpt-4o", label: "gpt-4o" },
    { key: "gpt-4o-mini", label: "gpt-4o-mini" },
    { key: "o3", label: "o3" },
    { key: "o3-mini", label: "o3-mini" },
    { key: "gpt-3.5-turbo", label: "gpt-3.5-turbo" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  gemini: [
    // Bằng chứng 2026-09-26: probe thật với key Gemini qua endpoint
    // OpenAI-compat `generativelanguage.googleapis.com`. 4/6 model cũ trả 404
    // nên người dùng chọn là chắc chắn hỏng:
    //   gemini-2.5-pro   404 "no longer available to new users"
    //   gemini-2.0-flash 404 "no longer available"
    //   gemini-1.5-flash 404 "not found for API version v1main"
    //   gemini-1.5-pro   404 "not found for API version v1main"
    //   gemini-pro       404 "not found for API version v1main"
    // Chỉ giữ model trả 200. Model OpenAI/Claude/local không sửa vì không có
    // key để verify trong dev — `custom` vẫn cho nhập tự do.
    { key: "gemini-3.8-flash", label: "gemini-3.8-flash" },
    { key: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { key: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
    { key: "gemini-flash-latest", label: "gemini-flash-latest" },
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ],
  claude: [
    { key: "claude-opus-4", label: "claude-opus-4" },
    { key: "claude-sonnet-4", label: "claude-sonnet-4" },
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
  // `copilot` đã gỡ 2026-09-26. Bằng chứng probe thật: key là GitHub PAT
  // classic, `GET /user` → 200 và scope `copilot` CÓ, nhưng
  // `copilot_internal/v2/token` → 404 "Not Found" với cả `token` lẫn `Bearer`
  // (endpoint nội bộ không nhận PAT). Ngoài ra orchestrator chỉ có 3 nhánh
  // endpoint (`local`/`gemini`/`else→api.openai.com`) nên `copilot` rơi vào
  // `else` ⇒ gửi model tới OpenAI kèm GitHub token ⇒ 401. Chi tiết ở
  // `advisory/models.py` `UserAICredential.ProviderChoices`.
  //
  // Cố ý KHÔNG thay bằng provider khác: Copilot không phải API LLM dùng chung,
  // không có endpoint chính thức cho ứng dụng bên thứ ba.
};

export const PROVIDER_OPTIONS: ProviderModelOption[] = [
  { key: "openclaw", label: "OpenClaw (System Default)" },
  { key: "openai", label: "OpenAI (ChatGPT)" },
  { key: "gemini", label: "Google Gemini" },
  { key: "claude", label: "Anthropic (Claude)" },
  { key: "local", label: "Local Model (Ollama/vLLM)" }
];
