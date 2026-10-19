export interface ProviderModelOption {
  key: string;
  label: string;
  /** R1.3: key i18n cho label hiển thị; vắng mặt ⇒ dùng `label` nguyên văn. */
  labelKey?: string;
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
    { key: "custom", label: "custom", labelKey: "aiCommandCenter.customModel" }
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
    { key: "custom", label: "custom", labelKey: "aiCommandCenter.customModel" }
  ],
  claude: [
    { key: "claude-opus-4", label: "claude-opus-4" },
    { key: "claude-sonnet-4", label: "claude-sonnet-4" },
    { key: "claude-3-5-sonnet", label: "claude-3-5-sonnet" },
    { key: "claude-3-haiku", label: "claude-3-haiku" },
    { key: "custom", label: "custom", labelKey: "aiCommandCenter.customModel" }
  ],
  openclaw: [
    { key: "gpt-4o-mini", label: "gpt-4o-mini" },
    { key: "custom", label: "custom", labelKey: "aiCommandCenter.customModel" }
  ],
  local: [
    { key: "llama3.2", label: "llama3.2" },
    { key: "llama3.1", label: "llama3.1" },
    { key: "mistral", label: "mistral" },
    { key: "phi4", label: "phi-4" },
    { key: "qwen2.5", label: "qwen2.5" },
    { key: "custom", label: "custom", labelKey: "aiCommandCenter.customModel" }
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
  { key: "openclaw", label: "OpenClaw (System Default)", labelKey: "aiCommandCenter.provider.openclaw" },
  { key: "openai", label: "OpenAI (ChatGPT)", labelKey: "aiCommandCenter.provider.openai" },
  { key: "gemini", label: "Google Gemini", labelKey: "aiCommandCenter.provider.gemini" },
  { key: "claude", label: "Anthropic (Claude)", labelKey: "aiCommandCenter.provider.claude" },
  { key: "local", label: "Local Model (Ollama/vLLM)", labelKey: "aiCommandCenter.provider.local" }
];

/**
 * S3 (2026-10-19): tra nhãn ĐÃ DỊCH cho một provider từ key thô (`gemini` → "Google Gemini").
 *
 * Vì sao cần hàm này: `effective_ai_provider` là **enum**, không phải nhãn. Trước S3,
 * ô "Nhà cung cấp hiệu lực" render thẳng `data.effective_ai_provider` nên người dùng
 * thấy `gemini` (bằng chứng: ảnh chụp màn hình thật trên staging).
 *
 * `labelKey` là field **đã có sẵn** trong `ProviderModelOption` từ R1.3 — chỉ là chưa
 * provider nào dùng tới. Không tạo primitive mới.
 *
 * ⚠ Provider lạ **không** trả `null` nữa: trả `aiCommandCenter.provider.unknown`.
 * Bản đầu trả `null` và call-site fallback bằng chính key thô ⇒ `t("anthropic")` →
 * `getNestedValue` trả `undefined` → UI in ra **chuỗi enum thô**, đúng loại lỗi mà
 * S3 sinh ra để diệt (bất đối xứng với `aiSourceLabelKey` vốn có nhánh `unknown`).
 */
export function providerLabelKey(providerKey: string): string {
  const hit = PROVIDER_OPTIONS.find((p) => p.key === providerKey);
  return hit?.labelKey ?? "aiCommandCenter.provider.unknown";
}

/**
 * S3: tra `i18n key` cho giá trị `effective_ai_source`.
 *
 * Giá trị thật đo được ở backend (`packages/core/backend/src`, 2026-10-19):
 *   - `command_center` — mặc định của **cả 4** chỗ đọc trong
 *     `user_workspace/portfolio_analytics_views.py` (`:1176,1301,1492,1580`).
 *     Quét đệ quy 750 file `.py`: **không chỗ nào GHI** key này ⇒ hôm nay giá trị này
 *     là hằng số, hiển thị như dữ liệu người dùng là sai.
 *   - `native` — chỉ có ở endpoint khác (`market_data/stock_mgmt_native_views.py:2634`),
 *     không phải trang này; vẫn cần khoá để không bao giờ in thô.
 *   - giá trị lạ ⇒ `unknown` thay vì in thẳng chuỗi.
 */
export function aiSourceLabelKey(source: string | null | undefined): string {
  if (source === "command_center") return "aiCommandCenter.source.commandCenter";
  if (source === "native") return "aiCommandCenter.source.native";
  return "aiCommandCenter.source.unknown";
}
