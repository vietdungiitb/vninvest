# R2.4 gates — adapter `copilot` (2026-10-17)

Branch `feat/ai-r24-copilot` ← `dev`. Claim `ai-r24`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:854-887` + D-03b (`:126-154`).

## Fail-before
- `ModuleNotFoundError: advisory.copilot_tokens` / `advisory.ai_clients.copilot`
  (test commit RED `e3902a944`).

## Thực hiện
- `advisory/copilot_tokens.py` (mới): `CopilotTokenManager` — cache module-level theo
  `sha256(raw_token)`, `refresh_margin` mặc định 60 s, `threading.Lock` **riêng theo key**
  (token user A không chặn user B), clock `time.monotonic`.
- `advisory/ai_clients/copilot.py` (mới): `CopilotClient` — `Bearer <session>` +
  `Copilot-Integration-Id: vscode-chat`, base URL lấy từ `endpoints.api` (không hardcode),
  override `COPILOT_API_BASE_URL`, `catalog()` lọc `policy.state` + `model_picker_enabled`,
  retry **1 lần** khi 401 giữa chừng.
- `CopilotTokenExchangeError` với `error_code='copilot_token_exchange_failed'` + message
  chỉ rõ cần `ghu_` (404) / token hết hạn (401/403) / lỗi mạng / payload sai định dạng.
- Registry factory: `'copilot'` + cờ `self_endpoint` (endpoint tự lo, **không** resolve
  theo bảng OpenAI/Gemini — sẽ gọi sai host).
- `ProviderChoices.COPILOT` bật lại (kèm bằng chứng 404 vẫn đúng — chỉ đổi cách dùng),
  `FREEFORM_PROVIDERS += 'copilot'`, `PROVIDER_LABELS['copilot']`.

## Quyết định (đã ghi)
- **Token raw không bao giờ log**: khoá cache = sha256(raw); `SessionToken.__repr__` chỉ in
  base URL + mốc hết hạn. Test AC1 chốt điều này.
- **AC11 giữ fallback raw token cho `catalog()`** (tắt được bằng
  `allow_raw_token_catalog_fallback=False`) nhưng `complete()` **không** fallback — sinh
  văn bản bằng token không đúng quyền là đường lách, không phải tính năng.
- **Sửa test R2.2 (`test_ai_clients.py` AC4)**: provider mẫu "chưa có client" từng là
  `copilot`; nay copilot đã có client nên dùng provider thật sự chưa có + thêm case
  chiều nghịch (`copilot` phải có client). Giữ `claude`/`openclaw` (R2.3/R2.5 chưa làm).

## Bẫy đã gặp
- **CRLF do sửa file bằng editor** ⇒ pre-commit chặn (L-T01) **và** làm self-test
  `hook-mode` FAIL với thông báo sai lệch ("trailer ... cho qua") — vì commit thật bị
  chặn, không phải vì trailer. Sửa: `node scripts/normalize-eol.mjs --fix` **trước khi commit**.
- Cache token ở cấp module ⇒ test phải `clear_cache()` ở `setUp`; thiếu một chỗ là
  `AC12` đếm được 1 chat thay vì 2 (đọc nhầm cache của test trước).

## Gates (VPS Postgres thật, EXIT=0)
- Mới **25/25** · ai_clients (sửa AC4) **7/7** · pricing 22/22 · budget 21/21 · usage 6/6 ·
  mgmt 30/30 · config 9/9 · policy 9/9 · r06 5/5 · advisory_budget 12/12 = **146 test**.
- `manage.py check` 0 · `makemigrations --check` 0 (choices không đổi schema) ·
  pre-push 23/23 · normalize-eol OK.

## CHƯA CHẠY (nói thẳng, không tính là xong)
- **AC13 (FE)**: nút "Kiểm tra kết nối" báo đúng 4 trạng thái 4 bẫy + link hướng dẫn lấy `ghu_`.
- **`providerModels.ts`**: bỏ danh sách hardcode 1 model `custom`, gom nhóm + nút "Tải lại".
- **i18n** `aiProviders.copilot.*` 6 key × 2 locale.
- **`portfolio_analytics_views.py:940-943`**: `test-connection` chưa đi qua `CopilotClient`
  ⇒ nút "Kiểm tra ngay" **vẫn** gọi endpoint OpenAI cho provider copilot. Đây là nợ thật,
  ghi lại ở R2.6/R2.10 khi nối endpoint catalog + probe.
- Nhánh dự phòng `AI_COPILOT_TRANSPORT=github_models` — env đã ghi nhưng **chưa** viết nhánh.
- full BE ngoài scope · ruff · E2E · staging deploy · probe thật với token `ghu_` thật.