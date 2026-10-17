# R2.3 gates — adapter `anthropic` (2026-10-17)

Branch `feat/ai-r23-anthropic` ← `dev`. Claim `ai-r23`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:831-851`.

## Fail-before
- `ModuleNotFoundError: advisory.ai_clients.anthropic`; `get_ai_client('claude')` raise
  `FactoryError` ⇒ orchestrator rơi về endpoint OpenAI với Bearer ⇒ 401 (đúng F-06).

## Thực hiện
- `advisory/ai_clients/anthropic.py` (mới): `AnthropicClient` — `POST /v1/messages`,
  header `x-api-key` + `anthropic-version: 2023-06-01`, **không** `Authorization`;
  `system` là tham số riêng; usage đọc `input_tokens`/`output_tokens`;
  `AnthropicDisabledError` (fail-closed).
- Registry `'claude'` + cờ `self_endpoint` (endpoint do adapter lo, **không** resolve
  theo bảng OpenAI/Gemini).
- `AI_ENABLE_ANTHROPIC` **không khai trong `settings.py`** ⇒ mặc định TẮT (fail-closed).
  Cần owner bật tường minh sau khi cấu hình khoá.
- CC PUT: đổi lỗi model/provider về `provider_model_mismatch` (trước là
  `ValidationError({'ai_model': ...})` không có mã).

## Quyết định (đã ghi)
- **Không thêm SDK `anthropic`** — dùng `httpx` thuần như plan đã phản biện.
- **Usage có hàm riêng**, không dùng `parse_usage_dict` của R2.2: hàm đó đọc
  `prompt_tokens`/`completion_tokens` nên nếu dùng nhầm thì **mọi** lượt gọi Claude đều báo
  "không có usage" ⇒ số liệu usage sai âm thầm.
- **`complete()` raise `ProviderHTTPError`**, không phải `httpx.HTTPStatusError`. Đây là
  hợp đồng của `AiClient`: tầng retry R2.9 cần đọc `status_code` để biết 401 (fail ngay)
  hay 429/5xx (retry). `HTTPStatusError` lọt qua sẽ bị coi là lỗi lạ.
- **`probe()` dùng `GET /v1/models`**, không `POST /messages`: nhẹ hơn, không tốn token,
  và 401 ở đây *là* "sai khoá" (đúng ý nghĩa AC4) còn 404 *là* "endpoint/model sai".

## CONTRADICTION plan ↔ code (đã ghi, không sửa âm thầm)
Plan (Phụ lục B) nói lỗi trả `error_code`; code thật của repo đặt ở key **`code`**
(`StandardErrorEnvelope` trong `vninvest_core/exceptions.py`). Test chốt theo **code thật**.
⇒ Mọi mã lỗi mới (`provider_model_mismatch`, `provider_circuit_open`,
`ai_budget_exhausted`, `copilot_token_exchange_failed`) đều nằm ở `code`. Nếu FE đọc
`error_code` thì sẽ không thấy mã nào — **cần đối chiếu ở phần FE**.

## Ghi chú về D-03 mục 3
Ghi chú plan nói "`model_choices.py` là code chết 108 dòng, không ai import" — **đã cũ**:
R0.5 đã nối nó vào CC PUT (`portfolio_analytics_views.py:1221`). R2.3 chỉ bổ sung mã lỗi.

## Sửa test slice khác
`test_ai_clients.py` AC4 liệt kê `claude` là provider "chưa có client" — nay đã có adapter
thật. Đổi thành `openclaw` (R2.5) + thêm case chiều nghịch `claude` phải có client.

## Bẫy đã gặp
- **Test của provider tắt mặc định**: tôi viết test mạng mà không
  `@override_settings(AI_ENABLE_ANTHROPIC=True)` ⇒ 5 fail với `provider_disabled`. Đây là
  hệ quả đúng của thiết kế fail-closed, không phải bug code.
- **Test API thiếu workspace permission** ⇒ 403 trước khi tới kiểm tra payload (đã biết từ
  `test_ai_cc_config_isolation`; cần `grant_tenant`).
- **Đọc nhầm traceback là gọi mạng thật**: `httpx.HTTPStatusError` in URL `api.anthropic.com`
  dù request đi qua MockTransport. Phải kiểm handler, không đoán.

## Gates (VPS Postgres thật, EXIT=0)
- Mới **22/22** · ai_clients (sửa AC4) **8/8** · copilot 25/25 · breaker 20/20 · routing 22/22 ·
  catalog 19/19 · pricing 22/22 · budget 21/21 · usage 6/6 · mgmt 30/30 · config 9/9 ·
  policy 9/9 · r06 5/5 · advisory_budget 12/12 = **230 test**.
- `manage.py check` 0 · `makemigrations --check` 0 · pre-push 23/23 · openapi-budget
  NO CON Errors=32 · normalize-eol OK.

## CHƯA CHẠY
- **FE**: `providerModels.ts` bỏ `disabled` cho claude (D-03 cần Owner — **giữ nguyên
  `disabled`**), i18n, nút "Tải lại danh mục".
- Probe thật tới `api.anthropic.com` (không có khoá `sk-ant-` trong staging) — mọi AC dùng
  MockTransport nên AC1/AC2/AC3/AC4/AC6 là test mức **hợp đồng**, chưa phải probe thật.
- full BE ngoài scope · ruff · E2E · staging deploy.