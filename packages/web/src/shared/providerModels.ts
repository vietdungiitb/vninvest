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
    { key: "gemini-3.8-flash", label: "gemini-3.8-flash" },
    { key: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    { key: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { key: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    { key: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { key: "gemini-pro", label: "gemini-pro" },
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
  copilot: [
    { key: "custom", label: "Mô hình tùy chỉnh..." }
  ]
};

export const PROVIDER_OPTIONS: ProviderModelOption[] = [
  { key: "openclaw", label: "OpenClaw (System Default)" },
  { key: "openai", label: "OpenAI (ChatGPT)" },
  { key: "gemini", label: "Google Gemini" },
  { key: "claude", label: "Anthropic (Claude)" },
  { key: "local", label: "Local Model (Ollama/vLLM)" },
  { key: "copilot", label: "GitHub Copilot" }
];
